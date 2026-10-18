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

// [griego, transliteración, glosa española, glosa inglesa, lema, significado del lema, Strong, morfología]
export type Word = [string, string, string, string, string, string, string, string];

export type CrossRef = [string, number];

const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string, optional = false): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(`${BASE}/${path}`).then((res) => {
      if (res.ok) return res.json();
      if (optional && res.status === 404) return {};
      throw new Error(`No se pudo cargar ${path} (${res.status})`);
    });
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

export function enduringWordUrl(book: Book, chapter: number) {
  return `https://enduringword.com/bible-commentary/es/${book.ewSlug}-${chapter}/`;
}

/** Versículos que cierran párrafo (solo NT, a partir del griego). */
export const getParagraphEnds = (book: string, chapter: number) =>
  load<number[]>(`paragraphs/${book}/${chapter}.json`, true).then((r) => (Array.isArray(r) ? r : []));

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
