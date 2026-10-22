// Reina-Valera 1909 leída por Samuel Montoya: un MP3 por capítulo en archive.org (item BibliaEnAudioRVA1909,
// marcado como dominio público). Los archivos se llaman «01-Génesis 01.mp3»: número del libro en el orden de la
// RV1909 (01-66) y número del capítulo. El número decide el libro, y el nombre lo confirma: si no se parecen
// (por ejemplo, si el NT empezara otra vez en 01), se busca el libro por su nombre o el archivo no se usa.

import { BOOK_SLUGS } from '../src/lib/routes';

const ITEM = 'BibliaEnAudioRVA1909';
const FILES = `https://archive.org/metadata/${ITEM}/files`;
const TTL = 24 * 60 * 60 * 1000;
const ORDER = Object.keys(BOOK_SLUGS);

const compact = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Libro de un archivo «NN-Nombre»: por su número si el nombre coincide; si no, solo por el nombre. */
function bookOf(number: number, name: string): string | undefined {
  const file = compact(name);
  const byNumber = ORDER[number - 1];
  if (byNumber) {
    const slug = compact(BOOK_SLUGS[byNumber]);
    if (file.includes(slug) || file.slice(0, 3) === slug.slice(0, 3)) return byNumber;
  }
  return ORDER.find((id) => compact(BOOK_SLUGS[id]) === file);
}

type ArchiveFile = { name?: string; length?: string; source?: string };
export type MontoyaTrack = { url: string; duration: number };

/** «libro/capítulo» → pista, a partir de la lista de archivos del item. */
export function indexFiles(files: ArchiveFile[]): Map<string, MontoyaTrack> {
  const index = new Map<string, MontoyaTrack>();
  for (const f of files) {
    const m = /^(\d{2})-([^/]*?)\s(\d{1,3})\.mp3$/i.exec(f.name ?? '');
    if (!m) continue;
    const book = bookOf(Number(m[1]), m[2]);
    if (!book) continue;
    const key = `${book}/${Number(m[3])}`;
    if (index.has(key) && f.source !== 'original') continue; // el original antes que una copia derivada
    index.set(key, {
      url: `https://archive.org/download/${ITEM}/${encodeURIComponent(f.name!)}`,
      duration: Number(f.length) || 0,
    });
  }
  return index;
}

let cache: { at: number; index: Promise<Map<string, MontoyaTrack>> } | null = null;

function getIndex(): Promise<Map<string, MontoyaTrack>> {
  if (!cache || Date.now() - cache.at > TTL) {
    const index = fetch(FILES)
      .then((res) => {
        if (!res.ok) throw new Error(`archive.org respondió ${res.status}`);
        return res.json() as Promise<{ result?: ArchiveFile[] }>;
      })
      .then((body) => indexFiles(body.result ?? []));
    cache = { at: Date.now(), index };
    index.catch(() => (cache = null));
  }
  return cache.index;
}

export async function montoyaChapter(book: string, chapter: number) {
  const track = (await getIndex()).get(`${book}/${chapter}`);
  if (!track) return null;
  return {
    tracks: [{ ...track, verseStart: 1 }],
    credit: 'Audio: Reina-Valera 1909 leída por Samuel Montoya · archive.org, dominio público',
  };
}
