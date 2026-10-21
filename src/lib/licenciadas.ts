// Versiones con derechos de autor que se leen en línea con permiso de sus editores, por dos vías:
// - API.Bible (American Bible Society), con API_BIBLE_KEY. El plan gratuito (Starter) da hasta tres Biblias.
// - YouVersion Platform, con YVP_APP_KEY, para las licencias que se aceptan en su portal.
// api/biblia.ts usa la primera vía en la que la clave tiene la versión, y solo se muestran las que alguna tiene.
// Condiciones de las licencias: se muestra siempre el aviso de derechos con los enlaces del editor, las notas al pie
// de YouVersion se pueden leer al final del capítulo, el texto no se cambia, las lecturas de API.Bible se informan a
// FUMS, no se guardan libros enteros (ni descargas sin conexión), y su texto no se pasa a la IA ni se convierte en
// audio. Por eso la IA, el buscador, las comunidades y el audio siguen usando las versiones libres.

export type Licensed = {
  id: string;
  abbr: string;
  name: string;
  /** Id de la Biblia en API.Bible. */
  bibleId?: string;
  /** Ids de la Biblia en YouVersion, por orden de preferencia. */
  yvIds?: number[];
  /** Aviso de derechos que piden los editores; el primer tramo antes de « · » es el nombre. */
  credit: string;
  /** Enlaces que van con el aviso: los editores piden que se vean junto al texto (Lockman y Bíblica, su página). */
  links: { label: string; url: string }[];
};

const LOCKMAN_LINKS = [
  { label: 'NuevaBiblia.com (Español)', url: 'https://www.nuevabiblia.com' },
  { label: 'Lockman.org (English)', url: 'https://www.lockman.org' },
];

export const LICENSED: Licensed[] = [
  {
    id: 'nbla',
    abbr: 'NBLA',
    name: 'Nueva Biblia de las Américas',
    bibleId: 'ce11b813f9a27e20-01',
    yvIds: [103],
    credit:
      'Nueva Biblia de las Américas · Copyright © 2005 by The Lockman Foundation · Used by permission. Derechos Reservados - All Rights Reserved',
    links: LOCKMAN_LINKS,
  },
  {
    id: 'lbla',
    abbr: 'LBLA',
    name: 'La Biblia de las Américas',
    bibleId: 'e3f420b9665abaeb-01',
    yvIds: [89],
    credit:
      'La Biblia de las Américas · Copyright © 1986, 1995, 1997 by The Lockman Foundation · Used by permission. Derechos Reservados - All Rights Reserved',
    links: LOCKMAN_LINKS,
  },
  {
    id: 'nvi',
    abbr: 'NVI',
    name: 'Nueva Versión Internacional',
    yvIds: [128, 2664],
    credit:
      'Nueva Versión Internacional · NVI® © 1999, 2015, 2022 por Biblica, Inc.® · Usado con permiso de Biblica, Inc.®',
    links: [{ label: 'Biblica.com', url: 'https://www.biblica.com' }],
  },
  {
    id: 'ntv',
    abbr: 'NTV',
    name: 'Nueva Traducción Viviente',
    bibleId: '826f63861180e056-01',
    yvIds: [127],
    credit:
      'Nueva Traducción Viviente · © Tyndale House Foundation, 2010 · Usada con permiso de Tyndale House Publishers',
    links: [{ label: 'NuevaTraduccionViviente.com', url: 'https://www.nuevatraduccionviviente.com' }],
  },
  {
    id: 'niv',
    abbr: 'NIV',
    name: 'New International Version (inglés)',
    bibleId: '78a9f6124f344018-01',
    yvIds: [111],
    credit: 'New International Version · Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® · Used by permission',
    links: [{ label: 'Biblica.com', url: 'https://www.biblica.com' }],
  },
];

export const licensedById = (id: string) => LICENSED.find((v) => v.id === id);

/** Nodo del contenido de un capítulo pedido con content-type=json. */
export type ApiNode = {
  name?: string;
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  items?: ApiNode[];
};

// Marcas que no son texto bíblico: notas, referencias cruzadas y títulos de sección.
const SKIP = new Set(['note', 'ref']);
const SKIP_STYLES = /^(s\d?|ms\d?|mr|r|sr|d|sp|qa|cl|f|x|fr|ft|xo|xt)$/;

/**
 * Convierte el contenido JSON de API.Bible en [número, texto, etiqueta] como los capítulos de la app.
 * El texto de cada versículo lleva verseId («JHN.3.16»; «ROM.16.25-ROM.16.27» si la versión une versículos).
 */
export function chapterVerses(content: ApiNode[]): [number, string, string?][] {
  const verses = new Map<number, { text: string[]; label?: string; para?: number }>();
  let para = 0; // párrafo o verso poético actual: entre dos de ellos el versículo necesita un espacio
  const walk = (nodes: ApiNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.name === 'para') para++;
      const style = typeof node.attrs?.style === 'string' ? node.attrs.style : '';
      if (node.type === 'tag' && (SKIP.has(node.name ?? '') || SKIP_STYLES.test(style))) continue;
      if (node.name === 'verse') continue; // el número del versículo
      if (node.type === 'text' && node.text) {
        const id = typeof node.attrs?.verseId === 'string' ? node.attrs.verseId : '';
        const m = id.match(/^[0-9A-Z]{3}\.\d+\.(\d+)(?:-[0-9A-Z]{3}\.\d+\.(\d+))?$/);
        if (!m) continue;
        const n = Number(m[1]);
        const v = verses.get(n) ?? { text: [] };
        if (m[2] && m[2] !== m[1]) v.label = `${m[1]}-${m[2]}`;
        if (v.para !== undefined && v.para !== para) v.text.push(' ');
        v.para = para;
        v.text.push(node.text);
        verses.set(n, v);
      }
      walk(node.items);
    }
  };
  walk(content);
  return [...verses.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, v]) => {
      const text = v.text.join('').replace(/\s+/g, ' ').replace(/\s+([,.;:!?»)])/g, '$1').trim();
      return v.label ? [n, text, v.label] : [n, text];
    });
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : (ENTITIES[e.toLowerCase()] ?? m),
  );

/** Notas al pie de un capítulo: por versículo, en el orden en que aparecen. */
export type Footnotes = Record<number, string[]>;

// Elementos que son notas (al pie o referencias): su texto va a las notas y no al versículo.
const NOTE_CLASS = /(^|\s)(yv-n|note|f|fe|x|footnote)(\s|$)/;
// Dentro de una nota: la marca que se ve en el texto y la referencia «3:16» que repite el versículo.
const NOTE_SKIP_CLASS = /(^|\s)(yv-n-label|label|fr|xo|fq-label)(\s|$)/;
// Fuera de las notas: el número visible del versículo y los títulos de sección.
const TEXT_SKIP_CLASS = /(^|\s)(yv-vlbl|vlbl|yv-h|heading|s\d?|ms\d?|mr|r|d)(\s|$)/;

/**
 * Convierte el HTML de un capítulo de YouVersion en versículos [número, texto, etiqueta] y sus notas al pie.
 * Cada versículo empieza en un elemento con clase yv-v y atributo v="16" (o v="2-3" si van unidos).
 */
export function chapterHtml(html: string): { verses: [number, string, string?][]; notes: Footnotes } {
  const verses = new Map<number, { text: string; label?: string }>();
  const notes: Footnotes = {};
  let current: number | null = null;
  // Pila de elementos abiertos: qué hace cada uno con el texto que contiene
  const stack: ('text' | 'skip' | 'note' | 'noteSkip')[] = [];
  let note: string | null = null;
  const mode = () => stack[stack.length - 1] ?? 'text';

  const add = (raw: string) => {
    const t = decode(raw);
    const m = mode();
    if (m === 'note') note = (note ?? '') + t;
    else if (m === 'text' && current !== null) verses.get(current)!.text += t;
  };

  const re = /<(\/?)(\w+)([^>]*?)(\/?)>|([^<]+)/g;
  let tok: RegExpExecArray | null;
  while ((tok = re.exec(html))) {
    const [, closing, tag, attrs, selfClosing, text] = tok;
    if (text !== undefined) {
      add(text);
      continue;
    }
    const name = tag.toLowerCase();
    if (closing) {
      const was = stack.pop();
      if (was === 'note' && mode() !== 'note') {
        const t = (note ?? '').replace(/\s+/g, ' ').trim();
        if (t && current !== null) (notes[current] ??= []).push(t);
        note = null;
      }
      if (/^(div|p)$/.test(name)) add(' ');
      continue;
    }
    if (name === 'br') {
      add(' ');
      continue;
    }
    const cls = attrs.match(/\bclass="([^"]*)"/)?.[1] ?? '';
    const v = /(^|\s)yv-v(\s|$)/.test(cls) ? attrs.match(/\bv="([\d,-]+)"/)?.[1] : undefined;
    if (v) {
      const nums = v.split(/[,-]/).map(Number).filter(Number.isFinite);
      if (nums.length) {
        current = nums[0];
        const entry = verses.get(current) ?? { text: '' };
        if (nums[nums.length - 1] !== current) entry.label = `${current}-${nums[nums.length - 1]}`;
        entry.text += ' ';
        verses.set(current, entry);
      }
    }
    const inNote = mode() === 'note' || mode() === 'noteSkip';
    const next = inNote
      ? NOTE_SKIP_CLASS.test(cls) || mode() === 'noteSkip' ? 'noteSkip' : 'note'
      : NOTE_CLASS.test(cls)
        ? 'note'
        : TEXT_SKIP_CLASS.test(cls) || mode() === 'skip'
          ? 'skip'
          : 'text';
    if (/^(div|p)$/.test(name)) add(' ');
    if (!selfClosing) stack.push(next);
  }

  const clean = (t: string) => t.replace(/\s+/g, ' ').replace(/\s+([,.;:!?»)])/g, '$1').trim();
  return {
    verses: [...verses.entries()]
      .sort(([a], [b]) => a - b)
      .map(([n, v]): [number, string, string?] => (v.label ? [n, clean(v.text), v.label] : [n, clean(v.text)]))
      .filter(([, text]) => text),
    notes,
  };
}

export const chapterVersesHtml = (html: string) => chapterHtml(html).verses;
