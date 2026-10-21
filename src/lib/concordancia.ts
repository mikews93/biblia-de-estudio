// Concordancia por número de Strong: todas las veces que aparece una palabra griega o hebrea en la Biblia.
// Los datos los escribe pipeline/build_data.py en concordance/<Strong>.json. Sin dependencias de React Native.

/** [referencia «jhn.3.16», forma en el original, glosa española] */
export type Use = [string, string, string];

export type Concordance = {
  lemma: string;
  /** Significado del lema (en inglés, de STEPBible). */
  meaning: string;
  translit: string;
  /** Otras acepciones del mismo número (H2617A y H2617B). */
  related: string[];
  uses: Use[];
};

/** Una fila de la lista: un versículo, con las formas que tiene si la palabra sale más de una vez. */
export type Occurrence = { ref: string; book: string; chapter: number; verse: number; forms: string[]; glosses: string[] };

/** «g26», «G26», «h2617a» → «G0026», «H2617A», como en los archivos. Devuelve null si no es un Strong. */
export function normalizeStrong(param: string): string | null {
  const m = /^([GH])0*(\d{1,4})([A-Za-z]?)$/i.exec(decodeURIComponent(param).trim());
  if (!m) return null;
  return `${m[1].toUpperCase()}${m[2].padStart(4, '0')}${m[3].toUpperCase()}`;
}

/** «G0026» → «G26»: así se escribe el número de Strong en los libros. */
export const displayStrong = (strong: string) => strong.replace(/^([GH])0+(?=\d)/, '$1');

export const isHebrew = (strong: string) => strong.startsWith('H');

/** /concordancia/G0026?desde=jhn.3.16: «desde» marca el versículo del que se vino. */
export const concordanceHref = (strong: string, from?: string) =>
  `/concordancia/${strong}${from ? `?desde=${from}` : ''}` as const;

/** Acepta el formato antiguo (solo la lista de apariciones). */
export function parseConcordance(data: unknown): Concordance {
  if (Array.isArray(data)) return { lemma: '', meaning: '', translit: '', related: [], uses: data as Use[] };
  const d = (data ?? {}) as Partial<Concordance>;
  return { lemma: d.lemma ?? '', meaning: d.meaning ?? '', translit: d.translit ?? '', related: d.related ?? [], uses: d.uses ?? [] };
}

// Palabras que la glosa lleva delante por los prefijos y sufijos del original («y», «tu», «conforme a la»…):
// se quitan para contar juntas «misericordia», «su misericordia» y «y misericordia».
const LEADING = new Set(
  'y e o ni el la los las lo un una unos unas de del a al en con por para sin sobre desde hasta entre contra como conforme según mi mis tu tus su sus nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras este esta estos estas ese esa esos esas aquel aquella que'.split(
    ' ',
  ),
);

/** La palabra principal de una glosa, en minúsculas: «Y su misericordia» → «misericordia». */
export function glossKey(gloss: string): string {
  const words = gloss
    .toLowerCase()
    .replace(/[[\]<>().,;:¡!¿?«»"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let i = 0;
  while (i < words.length - 1 && LEADING.has(words[i])) i++;
  return words.slice(i).join(' ') || gloss.trim().toLowerCase();
}

export type Summary = {
  /** Veces que aparece la palabra. */
  total: number;
  /** Versículos distintos. */
  verses: number;
  books: { id: string; count: number }[];
  /** Cómo se traduce, de la más usada a la menos. */
  glosses: { key: string; count: number }[];
  ot: number;
  nt: number;
};

type OrderedBook = { id: string; testament: 'AT' | 'NT' };

export function summarize(uses: Use[], books: OrderedBook[]): Summary {
  const order = new Map(books.map((b, i) => [b.id, i]));
  const testament = new Map(books.map((b) => [b.id, b.testament]));
  const byBook = new Map<string, number>();
  const glosses = new Map<string, number>();
  const refs = new Set<string>();
  let ot = 0;
  for (const [ref, , gloss] of uses) {
    const book = ref.split('.')[0];
    refs.add(ref);
    byBook.set(book, (byBook.get(book) ?? 0) + 1);
    const key = glossKey(gloss);
    if (key) glosses.set(key, (glosses.get(key) ?? 0) + 1);
    if (testament.get(book) === 'AT') ot++;
  }
  return {
    total: uses.length,
    verses: refs.size,
    books: [...byBook]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)),
    glosses: [...glosses].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    ot,
    nt: uses.length - ot,
  };
}

/** Las apariciones filtradas por libro y por traducción, unidas por versículo y en el orden de la Biblia. */
export function occurrences(uses: Use[], books: OrderedBook[], filter: { book?: string | null; gloss?: string | null } = {}): Occurrence[] {
  const order = new Map(books.map((b, i) => [b.id, i]));
  const byRef = new Map<string, Occurrence>();
  for (const [ref, form, gloss] of uses) {
    const [book, chapter, verse] = ref.split('.');
    if (filter.book && book !== filter.book) continue;
    if (filter.gloss && glossKey(gloss) !== filter.gloss) continue;
    let o = byRef.get(ref);
    if (!o) byRef.set(ref, (o = { ref, book, chapter: Number(chapter), verse: Number(verse), forms: [], glosses: [] }));
    o.forms.push(form);
    o.glosses.push(gloss);
  }
  return [...byRef.values()].sort(
    (a, b) => (order.get(a.book) ?? 99) - (order.get(b.book) ?? 99) || a.chapter - b.chapter || a.verse - b.verse,
  );
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Parte el texto del versículo para resaltar la palabra que traduce el original: primero la glosa entera,
 * después una palabra que empiece igual («amó» en la glosa, «amó» o «amaba» en el texto). Sin parecido, nada.
 */
export function markGloss(text: string, glosses: string[]): { text: string; mark: boolean }[] {
  const folded = fold(text);
  const spans: [number, number][] = [];
  const isLetter = (c: string | undefined) => !!c && /[a-zñ]/.test(c);
  const taken = (s: number, e: number) => spans.some(([a, b]) => s < b && e > a);
  for (const g of new Set(glosses.map(glossKey))) {
    const key = fold(g);
    if (!key) continue;
    let found = false;
    for (let from = 0; ; ) {
      const i = folded.indexOf(key, from);
      if (i < 0) break;
      const end = i + key.length;
      if (!isLetter(folded[i - 1]) && !isLetter(folded[end]) && !taken(i, end)) {
        spans.push([i, end]);
        found = true;
        break;
      }
      from = i + 1;
    }
    if (found) continue;
    const longest = key.split(' ').sort((a, b) => b.length - a.length)[0];
    if (longest.length < 4) continue;
    const stem = longest.slice(0, Math.max(4, longest.length - 2));
    const re = /[a-zñ]+/g;
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      if (m[0].startsWith(stem) && !taken(m.index, m.index + m[0].length)) {
        spans.push([m.index, m.index + m[0].length]);
        break;
      }
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: { text: string; mark: boolean }[] = [];
  let at = 0;
  for (const [s, e] of spans) {
    if (s > at) out.push({ text: text.slice(at, s), mark: false });
    out.push({ text: text.slice(s, e), mark: true });
    at = e;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: false });
  return out;
}
