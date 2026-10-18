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

export type Verse = [number, string];

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
export const getChapter = (book: string, chapter: number) =>
  load<Verse[]>(`text/rv1909/${book}/${chapter}.json`);
export const getInterlinear = (book: string, chapter: number) =>
  load<Record<string, Word[]>>(`interlinear/${book}/${chapter}.json`, true);
export const getCrossRefs = (book: string, chapter: number) =>
  load<Record<string, CrossRef[]>>(`xrefs/${book}/${chapter}.json`, true);

export type RefTarget = { book: string; chapter: number; verse: number };

/** 'rom.5.8' o '1jn.4.9-1jn.4.10' */
export function parseRef(ref: string): { start: RefTarget; end: RefTarget } {
  const [a, b = a] = ref.split('-');
  const part = (s: string) => {
    const [book, chapter, verse] = s.split('.');
    return { book, chapter: Number(chapter), verse: Number(verse) };
  };
  return { start: part(a), end: part(b) };
}

export function formatRef(ref: string, books: Book[]): string {
  const { start, end } = parseRef(ref);
  const name = books.find((b) => b.id === start.book)?.name ?? start.book;
  let label = `${name} ${start.chapter}:${start.verse}`;
  if (end.book !== start.book) {
    const endName = books.find((b) => b.id === end.book)?.name ?? end.book;
    label += ` – ${endName} ${end.chapter}:${end.verse}`;
  } else if (end.chapter !== start.chapter) {
    label += `–${end.chapter}:${end.verse}`;
  } else if (end.verse !== start.verse) {
    label += `-${end.verse}`;
  }
  return label;
}

export function enduringWordUrl(book: Book, chapter: number) {
  return `https://enduringword.com/bible-commentary/es/${book.ewSlug}-${chapter}/`;
}
