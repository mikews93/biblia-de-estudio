import { Platform } from 'react-native';

// En web los datos se sirven desde public/data; en el teléfono, desde EXPO_PUBLIC_DATA_URL
// (por ejemplo la web publicada) hasta que lleguen los paquetes descargables sin conexión.
const BASE = process.env.EXPO_PUBLIC_DATA_URL ?? (Platform.OS === 'web' ? '/data' : '');

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

export type Version = { id: string; name: string; abbr: string; credit: string };

// [palabra original, transliteración, glosa española, glosa inglesa, lema, significado del lema, Strong, morfología]
export type Word = [string, string, string, string, string, string, string, string];

export { original } from './original';

export type CrossRef = [string, number];

/** Dirección de un archivo de datos (books.json, text/rv1909/jhn/3.json…). */
export const dataUrl = (path: string) => `${BASE}/${path}`;

/** Error de un archivo que no se pudo pedir porque no hay conexión y no está guardado en el dispositivo. */
export const NOT_DOWNLOADED = 'Sin conexión, y esto no está descargado en este dispositivo.';

const cache = new Map<string, Promise<unknown>>();

export function load<T>(path: string, optional = false): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(dataUrl(path)).then(
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
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export const getBooks = () => load<Book[]>('books.json');
export const getVersions = () => load<Version[]>('versions.json');
export const getChapter = (book: string, chapter: number, version = 'rv1909') =>
  load<Verse[]>(`text/${version}/${book}/${chapter}.json`);
export const getInterlinear = (book: string, chapter: number) =>
  load<Record<string, Word[]>>(`interlinear/${book}/${chapter}.json`, true);
export const getCrossRefs = (book: string, chapter: number) =>
  load<Record<string, CrossRef[]>>(`xrefs/${book}/${chapter}.json`, true);

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
