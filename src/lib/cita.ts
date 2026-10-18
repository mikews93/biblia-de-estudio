// Entiende citas escritas o dictadas: «1 reyes 2:5 nbla», «Jn 3,16-18», «primera de Reyes capítulo dos versículo cinco».
// Sin dependencias de React Native.

type CitaBook = { id: string; name: string; abbr: string; chapters: number };

/** Versión que la persona nombró. `id` es null si todavía no está en la app. */
export type AskedVersion = { abbr: string; name: string; id: string | null };

export type Cita = {
  book: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
  version?: AskedVersion;
  /** Hay libro, pero el capítulo o el versículo no existen («Juan 30»). */
  problem?: string;
};

const norm = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Versiones que la gente suele nombrar. `id` solo para las que hay en la app (pipeline/build_data.py VERSIONS).
const VERSIONS: { re: RegExp; abbr: string; name: string; id?: string }[] = [
  { re: /\bnbla\b|\bnueva biblia de las americas\b/, abbr: 'NBLA', name: 'Nueva Biblia de las Américas' },
  { re: /\blbla\b|\b(la )?biblia de las americas\b/, abbr: 'LBLA', name: 'La Biblia de las Américas' },
  { re: /\brva ?2015\b|\breina valera actualizada\b/, abbr: 'RVA-2015', name: 'Reina Valera Actualizada' },
  { re: /\brvc\b|\breina valera contemporanea\b/, abbr: 'RVC', name: 'Reina Valera Contemporánea' },
  { re: /\brv ?r? ?(19)?60\b|\breina ?valera (19)?60\b|\breina ?valera mil novecientos sesenta\b/, abbr: 'RVR1960', name: 'Reina-Valera 1960' },
  { re: /\brv ?r? ?(19)?09\b|\breina ?valera (19)?09\b|\breina ?valera mil novecientos nueve\b|\breina ?valera antigua\b/, abbr: 'RV1909', name: 'Reina-Valera 1909', id: 'rv1909' },
  { re: /\bnvi\b|\bnueva version internacional\b/, abbr: 'NVI', name: 'Nueva Versión Internacional' },
  { re: /\bntv\b|\bnueva traduccion viviente\b/, abbr: 'NTV', name: 'Nueva Traducción Viviente' },
  { re: /\bdhh\b|\bdios habla hoy\b/, abbr: 'DHH', name: 'Dios Habla Hoy' },
  { re: /\btla\b|\btraduccion en lenguaje actual\b/, abbr: 'TLA', name: 'Traducción en Lenguaje Actual' },
  { re: /\bnbv\b|\bnueva biblia viva\b/, abbr: 'NBV', name: 'Nueva Biblia Viva' },
  { re: /\bkjv\b|\bking james\b/, abbr: 'KJV', name: 'King James' },
  { re: /\bbes\b|\b(la )?biblia en espanol sencillo\b|\bespanol sencillo\b/, abbr: 'BES', name: 'La Biblia en Español Sencillo', id: 'bes' },
  { re: /\bpdt\b|\bpalabra de dios para ti\b/, abbr: 'PDT', name: 'Palabra de Dios para ti', id: 'pdt' },
  // «Reina Valera» a secas: la que hay en la app
  { re: /\breina ?valera\b|\brv\b/, abbr: 'RV1909', name: 'Reina-Valera 1909', id: 'rv1909' },
];

// Otras formas de nombrar cada libro, además del nombre y la abreviatura de books.json.
// Para los libros con número se escriben sin él: el número se antepone solo.
const ALIASES: Record<string, string[]> = {
  gen: ['gen', 'ge'],
  exo: ['ex', 'exo', 'exod'],
  lev: ['lev', 'lv'],
  num: ['num', 'nu'],
  deu: ['deut', 'deu', 'dt'],
  jos: ['jos', 'josue'],
  jdg: ['jue', 'jc', 'juec'],
  rut: ['rt', 'ru'],
  '1sa': ['samuel', 'sam', 'sm', 's'],
  '2sa': ['samuel', 'sam', 'sm', 's'],
  '1ki': ['reyes', 'rey', 're', 'r', 'rs'],
  '2ki': ['reyes', 'rey', 're', 'r', 'rs'],
  '1ch': ['cronicas', 'cron', 'cro', 'cr'],
  '2ch': ['cronicas', 'cron', 'cro', 'cr'],
  ezr: ['esd'],
  neh: ['ne'],
  est: ['es'],
  job: ['jb'],
  psa: ['salmo', 'sal', 'sl', 'ps', 'salterio'],
  pro: ['prov', 'pro', 'pr', 'pv'],
  ecc: ['ecl', 'ec', 'ecle', 'qohelet', 'cohelet'],
  sng: ['cantar', 'cantares', 'cantar cantares', 'cantico', 'cantico canticos', 'cant', 'cnt', 'ct'],
  isa: ['isa', 'is'],
  jer: ['jer', 'jr'],
  lam: ['lam', 'lm'],
  ezk: ['eze', 'ez'],
  dan: ['dan', 'dn'],
  hos: ['os'],
  jol: ['jl'],
  amo: ['am'],
  oba: ['abd', 'ab'],
  jon: ['jon'],
  mic: ['miq', 'mi'],
  nam: ['nah', 'na'],
  hab: ['hab'],
  zep: ['sof'],
  hag: ['hag'],
  zec: ['zac'],
  mal: ['mal'],
  mat: ['mat', 'mt'],
  mrk: ['mar', 'mr', 'mc'],
  luk: ['luc', 'lc'],
  jhn: ['jn', 'jua'],
  act: ['hch', 'hech', 'hechos apostoles'],
  rom: ['rom', 'ro', 'rm'],
  '1co': ['corintios', 'cor', 'co'],
  '2co': ['corintios', 'cor', 'co'],
  gal: ['gal', 'ga'],
  eph: ['ef', 'efe'],
  php: ['fil', 'flp', 'filip'],
  col: ['col'],
  '1th': ['tesalonicenses', 'tes', 'ts', 'tesal'],
  '2th': ['tesalonicenses', 'tes', 'ts', 'tesal'],
  '1ti': ['timoteo', 'tim', 'ti', 'tm'],
  '2ti': ['timoteo', 'tim', 'ti', 'tm'],
  tit: ['tit'],
  phm: ['flm', 'filem'],
  heb: ['heb', 'he'],
  jas: ['stg', 'sant', 'st'],
  '1pe': ['pedro', 'ped', 'pe', 'p', 'pd'],
  '2pe': ['pedro', 'ped', 'pe', 'p', 'pd'],
  '1jn': ['juan', 'jn'],
  '2jn': ['juan', 'jn'],
  '3jn': ['juan', 'jn'],
  jud: ['jud', 'jds'],
  rev: ['ap', 'apoc', 'apocalipsis', 'revelacion', 'rev'],
};

// Palabras que se dicen alrededor del nombre del libro y no cambian cuál es.
const FILLER = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'a', 'al', 'libro', 'evangelio', 'segun', 'san', 'santo', 'carta', 'epistola',
  'primera', 'profeta', 'apostol', 'cita', 'leer', 'abrir', 'busca', 'buscar', 'abre', 'lee', 'en', 'version', 'traduccion',
]);

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const HUNDREDS: Record<string, number> = { cien: 100, ciento: 100 };

// Ordinal al comienzo: «1ra de», «segunda», «II»
const ORDINAL = /^(?:([1-3])\s*(?:ra|era|da|a|o)|(primer[ao]?|segund[ao]|tercer[ao]?|iii|ii|i))\b/;
const ORDINAL_WORDS: Record<string, string> = {
  primer: '1', primera: '1', primero: '1', i: '1', segunda: '2', segundo: '2', ii: '2', tercer: '3', tercera: '3', tercero: '3', iii: '3',
};

/** «juan tres dieciseis» → «juan 3 16»; «salmo ciento diecinueve» → «salmo 119»; «treinta y uno» → 31. */
function spokenNumbers(words: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (w in HUNDREDS) {
      let n = 100;
      i++;
      const next = words[i];
      if (next && next in TENS) {
        n += TENS[next];
        i++;
        if (words[i] === 'y' && words[i + 1] in UNITS && UNITS[words[i + 1]] < 10) {
          n += UNITS[words[i + 1]];
          i += 2;
        }
      } else if (next && next in UNITS && UNITS[next] > 0) {
        n += UNITS[next];
        i++;
      }
      out.push(String(n));
    } else if (w in TENS) {
      let n = TENS[w];
      i++;
      if (words[i] === 'y' && words[i + 1] in UNITS && UNITS[words[i + 1]] < 10) {
        n += UNITS[words[i + 1]];
        i += 2;
      }
      out.push(String(n));
    } else if (w in UNITS) {
      out.push(String(UNITS[w]));
      i++;
    } else {
      out.push(w);
      i++;
    }
  }
  return out;
}

type Alias = { key: string; book: CitaBook };

const aliasCache = new WeakMap<CitaBook[], Alias[]>();

function aliases(books: CitaBook[]): Alias[] {
  const cached = aliasCache.get(books);
  if (cached) return cached;
  const list: Alias[] = [];
  for (const book of books) {
    const num = /^\d/.test(book.id) ? book.id[0] : '';
    const keys = new Set([norm(book.name), norm(book.abbr), ...(ALIASES[book.id] ?? []).map((a) => (num ? `${num} ${a}` : a))]);
    for (const key of keys) list.push({ key: key.replace(/\s+/g, ' ').trim(), book });
  }
  aliasCache.set(books, list);
  return list;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function findBook(key: string, books: CitaBook[]): CitaBook | null {
  if (!key) return null;
  const list = aliases(books);
  const compact = (s: string) => s.replace(/ /g, '');
  const exact = list.find((a) => a.key === key || compact(a.key) === compact(key));
  if (exact) return exact.book;
  const unique = (found: Alias[]) => {
    const ids = new Set(found.map((a) => a.book.id));
    return ids.size === 1 ? found[0].book : null;
  };
  // Comienzo del nombre: «1 re» → 1 Reyes, «filip» → Filipenses
  const letters = key.replace(/^\d /, '');
  if (letters.length >= 2) {
    const byPrefix = unique(list.filter((a) => a.key.startsWith(key) && a.key.length > key.length));
    if (byPrefix) return byPrefix;
  }
  // Una letra de más o de menos: «genisis», «apocalisis»
  if (letters.length >= 5) {
    const near = unique(list.filter((a) => a.key.length >= 5 && Math.abs(a.key.length - key.length) <= 1 && distance(a.key, key) <= 1));
    if (near) return near;
  }
  return null;
}

/** Separa la versión nombrada del resto del texto. */
function takeVersion(text: string): { rest: string; version?: AskedVersion } {
  for (const v of VERSIONS) {
    const m = text.match(v.re);
    if (m) {
      const rest = (text.slice(0, m.index) + ' ' + text.slice((m.index ?? 0) + m[0].length)).replace(/\b(en )?(la )?(version|traduccion)\s*$/, '');
      return { rest, version: { abbr: v.abbr, name: v.name, id: v.id ?? null } };
    }
  }
  return { rest: text };
}

/**
 * Lee una cita bíblica. Devuelve null si el texto no es una cita (entonces se busca como palabras o idea).
 * `available` son los ids de versión que hay en la app.
 */
export function parseCita(input: string, books: CitaBook[], available: string[] = []): Cita | null {
  let text = norm(input).replace(/[«»"“”¿?¡!;]/g, ' ').replace(/[º°]/g, 'o').replace(/ª/g, 'a');
  if (!/[a-z]/.test(text)) return null;

  const { rest, version: asked } = takeVersion(text);
  text = rest;
  const version = asked && asked.id && !available.includes(asked.id) ? { ...asked, id: null } : asked;

  text = text.trim().replace(ORDINAL, (_, digit: string | undefined, word: string | undefined) => `${digit ?? ORDINAL_WORDS[word!]} `);
  text = text
    .replace(/\b([1-3])([a-z]+)/g, '$1 $2') // «1reyes», «1r»
    .replace(/([a-z])(\d)/g, '$1 $2') // «jn3:16»
    .replace(/(\d)\s*[:.,]\s*(\d)/g, '$1 $2')
    .replace(/[:.,]/g, ' ')
    .replace(/[–—]/g, '-');

  let words = text.split(/\s+/).filter(Boolean);
  words = spokenNumbers(words);
  // «versículos 5 al 8», «5 a 8», «5 hasta 8», «5 y 6» → 5-8
  const joined = words
    .join(' ')
    .replace(/\b(capitulos?|cap|caps|versiculos?|vers|vv?|vs)\b/g, ' ')
    .replace(/(\d+)\s*(?:-|\bal\b|\ba\b|\bhasta\b|\by\b)\s*(\d+)/g, '$1-$2');
  words = joined.split(/\s+/).filter(Boolean);

  // Libro: número inicial opcional + palabras hasta el primer número
  let i = 0;
  let prefix = '';
  if (/^[1-3]$/.test(words[0] ?? '')) {
    prefix = words[0];
    i = 1;
  }
  const name: string[] = [];
  while (i < words.length && !/^\d/.test(words[i])) {
    if (!FILLER.has(words[i])) name.push(words[i]);
    i++;
  }
  if (!name.length) return null;
  const book = findBook([prefix, ...name].filter(Boolean).join(' '), books);
  if (!book) return null;

  const numbers = words
    .slice(i)
    .filter((w) => !FILLER.has(w))
    .join(' ');
  if (!/^[\d\s-]*$/.test(numbers)) return null; // «juan 3 amor»: no es una cita

  const m = numbers.trim().match(/^(\d+)(?:\s*-\s*(\d+))?(?:\s+(\d+)(?:\s*-\s*(\d+))?)?$/);
  const label = book.name;
  if (!numbers.trim()) {
    // Solo el libro: se abre el capítulo 1 si se escribió el nombre entero («Job», «Salmos»), no con «mal» o «am».
    const key = [prefix, ...name].filter(Boolean).join(' ');
    const whole = norm(book.name) === key || (key.length >= 4 && aliases(books).some((a) => a.book === book && a.key === key));
    return whole ? { book: book.id, chapter: 1, version } : null;
  }
  if (!m) return null;

  let chapter = Number(m[1]);
  let verse = m[3] ? Number(m[3]) : undefined;
  let verseEnd = m[4] ? Number(m[4]) : undefined;
  // «Juan 3-5»: tramo de capítulos, se abre el primero. En libros de un capítulo es un tramo de versículos.
  if (!m[3] && m[2] && book.chapters === 1) {
    verse = chapter;
    verseEnd = Number(m[2]);
    chapter = 1;
  } else if (!m[3] && book.chapters === 1 && chapter > 1) {
    // «Judas 5» es el versículo 5
    verse = chapter;
    chapter = 1;
  } else if (!m[3] && !m[2] && chapter > book.chapters && m[1].length >= 3) {
    // Dictado sin pausa: «Juan 316» → 3:16 si solo hay una forma posible
    const splits = Array.from({ length: m[1].length - 1 }, (_, k) => [Number(m[1].slice(0, k + 1)), Number(m[1].slice(k + 1))])
      .filter(([c, v]) => c >= 1 && c <= book.chapters && v >= 1 && !m[1].slice(String(c).length).startsWith('0'));
    if (splits.length === 1) [chapter, verse] = splits[0];
  }
  if (verseEnd !== undefined && verse !== undefined && verseEnd <= verse) verseEnd = undefined;

  const cita: Cita = { book: book.id, chapter, verse, verseEnd, version };
  if (chapter < 1 || chapter > book.chapters) {
    cita.problem =
      book.chapters === 1 ? `${label} tiene un solo capítulo.` : `${label} tiene ${book.chapters} capítulos.`;
  }
  return cita;
}

export function citaLabel(cita: Cita, books: { id: string; name: string }[]): string {
  const name = books.find((b) => b.id === cita.book)?.name ?? cita.book;
  if (cita.verse === undefined) return `${name} ${cita.chapter}`;
  return `${name} ${cita.chapter}:${cita.verse}${cita.verseEnd ? `-${cita.verseEnd}` : ''}`;
}
