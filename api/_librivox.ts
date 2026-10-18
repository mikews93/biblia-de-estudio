// Reina-Valera 1909 leída por voluntarios de LibriVox (dominio público, archivos en archive.org).
// Cada libro es un «audiolibro» de LibriVox titulado «Bible (Reina Valera) NT 04: Juan»; sus secciones
// suelen ser capítulos («Capítulo 01», «Salmo 001»), a veces tramos («capitulos 1-5») o libros enteros
// cuando un audiolibro agrupa varios («28-39: Los 12 Profetas Menores» → «Oseas», «Joel»…).

import { BOOK_SLUGS } from '../src/lib/routes';

const FEED = `https://librivox.org/api/feed/audiobooks/?title=${encodeURIComponent('^Bible (Reina Valera)')}&format=json&extended=1&limit=200`;
const TTL = 24 * 60 * 60 * 1000;
const WHOLE_BOOK = 999;

const ORDER = Object.keys(BOOK_SLUGS); // 39 del AT y 27 del NT, en el orden de la RV1909

type Section = { section_number?: string; title?: string; listen_url?: string; playtime?: string; readers?: { display_name?: string }[] };
type Audiobook = { id: string; title: string; sections?: Section[] };
export type Clip = { from: number; to: number; url: string; duration: number; reader?: string; audiobook: number };

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Libros que cubre un audiolibro según su título («NT 23-25» → 1jn, 2jn, 3jn). */
export function booksOf(title: string): string[] {
  const m = /^bible \(reina valera\)\s+(nt\s+)?(\d+)(?:\s*-\s*(\d+))?\s*:/i.exec(title);
  if (!m) return [];
  const offset = m[1] ? 39 : 0;
  const first = Number(m[2]);
  const last = m[3] ? Number(m[3]) : first;
  return ORDER.slice(offset + first - 1, offset + last).filter(Boolean);
}

/** Capítulo o tramo que lee una sección, a partir del final de su título. */
function chapters(text: string): [number, number] | null {
  const range = /(\d+)(?:\s+(?:a|al|y))?\s+(\d+)$/.exec(text);
  if (range && Number(range[1]) < Number(range[2])) return [Number(range[1]), Number(range[2])];
  const one = /(\d+)$/.exec(text);
  return one ? [Number(one[1]), Number(one[1])] : null;
}

/** Fragmentos por libro de todos los audiolibros de la RV1909. */
export function indexAudiobooks(audiobooks: Audiobook[]): Map<string, Clip[]> {
  const index = new Map<string, Clip[]>();
  const add = (book: string, clip: Clip) => index.set(book, [...(index.get(book) ?? []), clip]);

  for (const ab of audiobooks) {
    const books = booksOf(ab.title);
    if (!books.length) continue;
    const sections = (ab.sections ?? []).filter((s) => s.listen_url);
    // Con un solo libro, las secciones sin número se cuentan como capítulos solo si ninguna lo tiene.
    const numbered = sections.some((s) => chapters(norm(s.title ?? '')));

    for (const s of sections) {
      const title = norm(s.title ?? '');
      const clip = (from: number, to: number) => ({
        from,
        to,
        url: s.listen_url!,
        duration: Number(s.playtime) || 0,
        reader: s.readers?.[0]?.display_name,
        audiobook: Number(ab.id),
      });

      if (books.length === 1) {
        const ch = chapters(title);
        if (ch) add(books[0], clip(ch[0], ch[1]));
        else if (!numbered && Number(s.section_number)) add(books[0], clip(Number(s.section_number), Number(s.section_number)));
        continue;
      }
      // Varios libros: la sección empieza con el nombre del libro («1 Juan 3», «Oseas»).
      const book = books
        .map((id) => ({ id, name: norm(BOOK_SLUGS[id]) }))
        .filter(({ name }) => title === name || title.startsWith(`${name} `))
        .sort((a, b) => b.name.length - a.name.length)[0];
      if (!book) continue;
      const ch = chapters(title.slice(book.name.length).trim());
      add(book.id, ch ? clip(ch[0], ch[1]) : clip(1, WHOLE_BOOK));
    }
  }
  return index;
}

let cache: { at: number; index: Promise<Map<string, Clip[]>> } | null = null;

function getIndex(): Promise<Map<string, Clip[]>> {
  if (!cache || Date.now() - cache.at > TTL) {
    const index = fetch(FEED)
      .then((res) => {
        if (!res.ok) throw new Error(`LibriVox respondió ${res.status}`);
        return res.json() as Promise<{ books?: Audiobook[] }>;
      })
      .then((body) => indexAudiobooks(body.books ?? []));
    cache = { at: Date.now(), index };
    index.catch(() => (cache = null));
  }
  return cache.index;
}

/** Mejor grabación para un capítulo: un archivo solo para él antes que un tramo o el libro entero. */
export function pickClip(clips: Clip[], chapter: number): Clip | undefined {
  return clips
    .filter((c) => c.from <= chapter && chapter <= c.to)
    .sort((a, b) => a.to - a.from - (b.to - b.from) || b.audiobook - a.audiobook)[0];
}

export async function librivoxChapter(book: string, chapter: number) {
  const clip = pickClip((await getIndex()).get(book) ?? [], chapter);
  if (!clip) return null;
  const note =
    clip.from === clip.to
      ? undefined
      : clip.to === WHOLE_BOOK
        ? `Esta grabación lee el libro completo${chapter > 1 ? ', desde el capítulo 1' : ''}.`
        : `Esta grabación lee los capítulos ${clip.from} al ${clip.to}.`;
  const reader = clip.reader ? `leída por ${clip.reader}, ` : '';
  return {
    tracks: [{ url: clip.url, duration: clip.duration, verseStart: 1 }],
    note,
    credit: `Audio: Reina-Valera 1909 ${reader}voluntarios de LibriVox · dominio público`,
  };
}
