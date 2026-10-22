import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { readDownloaded, refreshDownloaded } from './almacen';
import { parseConcordance } from './concordancia';
import { isOnline } from './conexion';
import type { VerseVariants } from './diferencias';
import { reportView } from './fums';
import { OFFLINE_DAYS, OFFLINE_MAX_VERSES, licensedById } from './licenciadas';

// En web los datos se sirven desde public/data; en el teléfono, desde EXPO_PUBLIC_DATA_URL o la web publicada.
// Lo que el teléfono tiene descargado para leer sin conexión (almacen.native.ts) se lee del dispositivo.
const BASE = process.env.EXPO_PUBLIC_DATA_URL ?? (Platform.OS === 'web' ? '/data' : 'https://biblia.migueblanco.com/data');
const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type Book = {
  id: string;
  name: string;
  abbr: string;
  chapters: number;
  testament: 'AT' | 'NT';
  interlinear: boolean;
  ewSlug: string;
};

/** [número, texto, etiqueta si la versión une versículos («9-20»)] */
export type Verse = [number, string, string?];

/** licensed: versión con derechos leída por API.Bible (solo en línea, sin IA ni audio); links: páginas que van con el aviso. */
export type Version = {
  id: string;
  name: string;
  abbr: string;
  credit: string;
  licensed?: boolean;
  links?: { label: string; url: string }[];
  /** Con derechos, pero sus últimos capítulos leídos se guardan unos días para leerlos sin conexión. */
  guardable?: boolean;
};

// [palabra original, transliteración, glosa española, glosa inglesa, lema, significado del lema, Strong, morfología]
export type Word = [string, string, string, string, string, string, string, string];

export { original } from './original';

export type CrossRef = [string, number];

/** Dirección de un archivo de datos (books.json, text/rv1909/jhn/3.json…). */
export const dataUrl = (path: string) => `${BASE}/${path}`;

/** Error de un archivo que no se pudo pedir porque no hay conexión y no está guardado en el dispositivo. */
export const NOT_DOWNLOADED = 'Sin conexión, y esto no está descargado en este dispositivo.';

const cache = new Map<string, Promise<unknown>>();

function fetchData(path: string, optional: boolean): Promise<unknown> {
  return fetch(dataUrl(path)).then(
    (res) => {
      if (res.ok) return res.json();
      if (optional && res.status === 404) return {};
      throw new Error(`No se pudo cargar ${path} (${res.status})`);
    },
    () => {
      // Sin red (y sin copia guardada): lo opcional queda vacío y lo demás avisa. No se recuerda, para
      // volver a pedirlo cuando haya conexión.
      cache.delete(path);
      if (optional) return {};
      throw new Error(NOT_DOWNLOADED);
    },
  );
}

/**
 * En el teléfono, lo descargado se lee del dispositivo al momento y, con conexión, se pone al día por detrás
 * (como hace public/sw.js en la web). Lo que no está descargado se pide a la red.
 */
async function fromDevice(path: string, optional: boolean): Promise<unknown> {
  const saved = await readDownloaded(path);
  if (saved == null) return fetchData(path, optional);
  if (isOnline())
    fetch(dataUrl(path))
      .then((res) => (res.ok ? refreshDownloaded(path, res) : undefined))
      .catch(() => {});
  try {
    return JSON.parse(saved);
  } catch {
    return fetchData(path, optional);
  }
}

export function load<T>(path: string, optional = false): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = Platform.OS === 'web' ? fetchData(path, optional) : fromDevice(path, optional);
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export const getBooks = () => load<Book[]>('books.json');
let licensedVersions: Promise<Version[]> | null = null;

/** Versiones con derechos que la clave de API.Bible tiene (api/biblia.ts); sin red o sin clave, ninguna. */
function getLicensedVersions(): Promise<Version[]> {
  licensedVersions ??= fetch(`${API}/api/biblia?versiones=1`)
    .then((res) => (res.ok ? res.json() : { versions: [] }))
    .then((r: { versions?: Version[] }) => r.versions ?? [])
    .catch(() => {
      licensedVersions = null; // se vuelve a preguntar cuando haya conexión
      return [];
    });
  return licensedVersions;
}

/** Versiones libres (en los datos de la app) y, detrás, las de API.Bible. */
export const getVersions = () =>
  Promise.all([load<Version[]>('versions.json'), getLicensedVersions()]).then(([free, licensed]) => [...free, ...licensed]);

type LicensedChapter = {
  verses: Verse[];
  fums: string | null;
  copyright?: string;
  notes?: Record<number, string[]>;
  /** Solo API.Bible: el capítulo se puede guardar en el dispositivo. */
  guardable?: boolean;
};
const licensedChapters = new Map<string, Promise<LicensedChapter>>();

// Capítulos de API.Bible ya leídos, guardados para leerlos sin conexión: su licencia deja guardar menos de 500
// versículos durante 14 días como mucho. Las versiones de YouVersion no se guardan (en la web no se permite).
const SAVED_KEY = 'licenciadas-guardadas';
type Saved = Record<string, { at: number; chapter: LicensedChapter }>;

async function readSaved(): Promise<Saved> {
  try {
    const saved: Saved = JSON.parse((await AsyncStorage.getItem(SAVED_KEY)) ?? '{}');
    const limit = Date.now() - OFFLINE_DAYS * 86_400_000;
    for (const [k, v] of Object.entries(saved)) if (v.at < limit) delete saved[k];
    return saved;
  } catch {
    return {};
  }
}

async function saveChapter(key: string, chapter: LicensedChapter) {
  const saved = await readSaved();
  saved[key] = { at: Date.now(), chapter };
  // Del más reciente al más antiguo, hasta el tope de versículos
  let total = 0;
  for (const [k, v] of Object.entries(saved).sort(([, a], [, b]) => b.at - a.at)) {
    total += v.chapter.verses.length;
    if (total > OFFLINE_MAX_VERSES) delete saved[k];
  }
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(saved)).catch(() => {});
}

function getLicensedChapter(book: string, chapter: number, version: string): Promise<Verse[]> {
  const key = `${version}/${book}/${chapter}`;
  let p = licensedChapters.get(key);
  if (!p) {
    const q = new URLSearchParams({ v: version, book, chapter: String(chapter) });
    p = fetch(`${API}/api/biblia?${q}`).then(
      async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `No se pudo cargar ${key} (${res.status})`);
        const c = body as LicensedChapter;
        if (c.guardable) saveChapter(key, c).catch(() => {});
        return c;
      },
      async () => {
        const saved = (await readSaved())[key];
        if (saved) return saved.chapter;
        const abbr = licensedById(version)?.abbr ?? 'esta versión';
        throw new Error(
          `Sin conexión. Este capítulo de la ${abbr} no está guardado: los que lees con internet se guardan ${OFFLINE_DAYS} días.`,
        );
      },
    );
    p.catch(() => licensedChapters.delete(key));
    licensedChapters.set(key, p);
  }
  return p.then(({ verses, fums }) => {
    reportView(fums);
    return verses;
  });
}

/** Aviso de derechos que manda el editor y notas al pie de un capítulo con derechos; null en las versiones libres. */
export const getChapterExtras = (book: string, chapter: number, version: string) =>
  licensedById(version)
    ? (licensedChapters.get(`${version}/${book}/${chapter}`) ?? Promise.resolve(null)).then((c) =>
        c ? { copyright: c.copyright ?? null, notes: c.notes ?? {} } : null,
      )
    : Promise.resolve(null);

export const getChapter = (book: string, chapter: number, version = 'rv1909') =>
  licensedById(version)
    ? getLicensedChapter(book, chapter, version)
    : load<Verse[]>(`text/${version}/${book}/${chapter}.json`);
export const getInterlinear = (book: string, chapter: number) =>
  load<Record<string, Word[]>>(`interlinear/${book}/${chapter}.json`, true);
/** Diferencias entre manuscritos griegos de un capítulo del NT, por versículo (src/lib/diferencias.ts). */
export const getVariants = (book: string, chapter: number) =>
  load<Record<string, VerseVariants>>(`variantes/${book}/${chapter}.json`, true);
export const getCrossRefs = (book: string, chapter: number) =>
  load<Record<string, CrossRef[]>>(`xrefs/${book}/${chapter}.json`, true);

/** Todas las apariciones de un número de Strong (src/lib/concordancia.ts); null si no existe. */
export const getConcordance = (strong: string) =>
  load<unknown>(`concordance/${strong}.json`, true).then((d) =>
    d && !Array.isArray(d) && !Object.keys(d as object).length ? null : parseConcordance(d),
  );

/** Cuántas veces aparece cada palabra de «La historia de una palabra»: [total, AT, NT] (pipeline/build_data.py). */
export const getPalabrasIndex = () =>
  load<Record<string, [number, number, number]>>('palabras/index.json', true).then((r) => r ?? {});

/** Las apariciones de todos los números de Strong de una palabra, en una sola concordancia. */
export async function getPalabraConcordance(strongs: string[]) {
  const all = await Promise.all(strongs.map((s) => getConcordance(s)));
  const first = all.find((c) => c);
  return first ? { ...first, uses: all.flatMap((c) => c?.uses ?? []) } : null;
}

export { formatRef, parseRef } from './refs';
export type { RefTarget } from './refs';

/** Versículos que cierran párrafo, según el griego (NT) o las marcas פ y ס del texto masorético (AT). */
export const getParagraphEnds = (book: string, chapter: number) =>
  load<number[]>(`paragraphs/${book}/${chapter}.json`, true).then((r) => (Array.isArray(r) ? r : []));

/** Palabras por capítulo de la RV1909 (para calcular minutos de lectura). */
export const getWords = () => load<Record<string, number[]>>('words.json', true);

// Lugares de un capítulo (OpenBible.info Bible Geocoding Data, CC BY 4.0). conf: confianza de 0 a 1000.
export type PlaceSpot = { lon: number; lat: number; conf: number };
export type Place = PlaceSpot & { id: string; name: string; en: string; type: string; alt: PlaceSpot[]; verses: number[] };

/** Mapa de fondo: costas, lagos y ríos como listas de [lon, lat]. */
export type Basemap = {
  bbox: [number, number, number, number];
  land: [number, number][][];
  water: { name: string; points: [number, number][] }[];
  rivers: { name: string; points: [number, number][] }[];
};

export const getPlaces = (book: string, chapter: number) =>
  load<Place[]>(`places/${book}/${chapter}.json`, true).then((r) => (Array.isArray(r) ? r : []));
export const getBasemap = () => load<Basemap>('basemap.json');

/** Medida antigua que aparece en el capítulo, con su equivalencia moderna aproximada. */
export type Measure = { id: string; kind: string; name: string; value: string; note: string; verses: number[] };

/** Imagen libre de Wikimedia Commons de un objeto, lugar o mapa del capítulo (verses vacío: todo el capítulo). */
export type Picture = {
  id: string;
  kind: 'objeto' | 'lugar' | 'mapa';
  title: string;
  caption: string;
  verses: number[];
  img: string;
  w: number;
  h: number;
  page: string;
  author: string | null;
  license: string;
};

export const getStudyContext = (book: string, chapter: number) =>
  load<{ medidas?: Measure[]; imagenes?: Picture[] }>(`contexto/${book}/${chapter}.json`, true).then((r) => ({
    medidas: r.medidas ?? [],
    imagenes: r.imagenes ?? [],
  }));
