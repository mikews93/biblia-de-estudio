// Rutas públicas en español: /juan/3 y /juan/3/16. Se aceptan también los códigos antiguos (/jhn/3).

/** Código interno del libro → parte de la URL. */
export const BOOK_SLUGS: Record<string, string> = {
  gen: 'genesis',
  exo: 'exodo',
  lev: 'levitico',
  num: 'numeros',
  deu: 'deuteronomio',
  jos: 'josue',
  jdg: 'jueces',
  rut: 'rut',
  '1sa': '1-samuel',
  '2sa': '2-samuel',
  '1ki': '1-reyes',
  '2ki': '2-reyes',
  '1ch': '1-cronicas',
  '2ch': '2-cronicas',
  ezr: 'esdras',
  neh: 'nehemias',
  est: 'ester',
  job: 'job',
  psa: 'salmos',
  pro: 'proverbios',
  ecc: 'eclesiastes',
  sng: 'cantares',
  isa: 'isaias',
  jer: 'jeremias',
  lam: 'lamentaciones',
  ezk: 'ezequiel',
  dan: 'daniel',
  hos: 'oseas',
  jol: 'joel',
  amo: 'amos',
  oba: 'abdias',
  jon: 'jonas',
  mic: 'miqueas',
  nam: 'nahum',
  hab: 'habacuc',
  zep: 'sofonias',
  hag: 'hageo',
  zec: 'zacarias',
  mal: 'malaquias',
  mat: 'mateo',
  mrk: 'marcos',
  luk: 'lucas',
  jhn: 'juan',
  act: 'hechos',
  rom: 'romanos',
  '1co': '1-corintios',
  '2co': '2-corintios',
  gal: 'galatas',
  eph: 'efesios',
  php: 'filipenses',
  col: 'colosenses',
  '1th': '1-tesalonicenses',
  '2th': '2-tesalonicenses',
  '1ti': '1-timoteo',
  '2ti': '2-timoteo',
  tit: 'tito',
  phm: 'filemon',
  heb: 'hebreos',
  jas: 'santiago',
  '1pe': '1-pedro',
  '2pe': '2-pedro',
  '1jn': '1-juan',
  '2jn': '2-juan',
  '3jn': '3-juan',
  jud: 'judas',
  rev: 'apocalipsis',
};

const SLUG_TO_ID = Object.fromEntries(Object.entries(BOOK_SLUGS).map(([id, slug]) => [slug, id]));

/** Acepta el nombre en la URL («juan», «1-corintios») o el código («jhn»). */
export function bookIdFromParam(param: string): string {
  const p = decodeURIComponent(param).toLowerCase();
  return SLUG_TO_ID[p] ?? p;
}

export const chapterHref = (book: string, chapter: number) => `/${BOOK_SLUGS[book] ?? book}/${chapter}` as const;

export const verseHref = (book: string, chapter: number, verse: number) =>
  `/${BOOK_SLUGS[book] ?? book}/${chapter}/${verse}` as const;
