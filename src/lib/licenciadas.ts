// Versiones con derechos de autor que se leen en línea con permiso de sus editores, por dos vías:
// - API.Bible (American Bible Society), con API_BIBLE_KEY. El plan gratuito (Starter) da hasta tres Biblias.
// - YouVersion Platform, con YVP_APP_KEY, para las licencias que se aceptan en su portal.
// api/biblia.ts usa la primera vía en la que la clave tiene la versión, y solo se muestran las que alguna tiene.
// Condiciones de las licencias: se muestra siempre el aviso de derechos, las lecturas de API.Bible se informan a
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
  /** Página de la versión, que el aviso enlaza (Lockman lo pide en apps y webs). */
  link: string;
};

export const LICENSED: Licensed[] = [
  {
    id: 'nbla',
    abbr: 'NBLA',
    name: 'Nueva Biblia de las Américas',
    bibleId: 'ce11b813f9a27e20-01',
    yvIds: [103],
    credit:
      'Nueva Biblia de las Américas · Copyright © 2005 by The Lockman Foundation · Usada con permiso · NuevaBiblia.com',
    link: 'https://www.nuevabiblia.com',
  },
  {
    id: 'lbla',
    abbr: 'LBLA',
    name: 'La Biblia de las Américas',
    bibleId: 'e3f420b9665abaeb-01',
    yvIds: [89],
    credit:
      'La Biblia de las Américas · Copyright © 1986, 1995, 1997 by The Lockman Foundation · Usada con permiso · LBLA.com',
    link: 'https://www.lbla.com',
  },
  {
    id: 'nvi',
    abbr: 'NVI',
    name: 'Nueva Versión Internacional',
    yvIds: [128, 2664],
    credit:
      'Nueva Versión Internacional · NVI® © 1999, 2015, 2022 por Biblica, Inc.® · Usado con permiso de Biblica, Inc.®',
    link: 'https://www.biblica.com',
  },
  {
    id: 'ntv',
    abbr: 'NTV',
    name: 'Nueva Traducción Viviente',
    bibleId: '826f63861180e056-01',
    yvIds: [127],
    credit:
      'Nueva Traducción Viviente · © Tyndale House Foundation, 2010 · Usada con permiso de Tyndale House Publishers',
    link: 'https://www.nuevatraduccionviviente.com',
  },
  {
    id: 'niv',
    abbr: 'NIV',
    name: 'New International Version (inglés)',
    bibleId: '78a9f6124f344018-01',
    yvIds: [111],
    credit: 'New International Version · Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® · Used by permission',
    link: 'https://www.biblica.com',
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

/**
 * Convierte el HTML de un capítulo de YouVersion (format=html, sin títulos ni notas) en [número, texto, etiqueta].
 * Cada versículo empieza en un elemento con clase yv-v y atributo v="16"; su número visible va en yv-vlbl.
 */
export function chapterVersesHtml(html: string): [number, string, string?][] {
  const MARK = '\u0001';
  const marked = html
    // Números visibles, notas y títulos que se hayan colado: fuera, con su contenido
    .replace(/<(\w+)[^>]*class="[^"]*\b(yv-vlbl|yv-n|yv-h|note|heading|s\d?)\b[^"]*"[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<\w+[^>]*>/g, (tag) => {
      if (!/class="[^"]*\byv-v\b/.test(tag)) return /^<(div|p|br)\b/i.test(tag) ? ' ' : '';
      const v = tag.match(/\bv="([\d,-]+)"/)?.[1];
      return v ? `${MARK}${v}${MARK}` : '';
    })
    .replace(/<\/\w+>/g, '');
  const parts = decode(marked).split(MARK);
  const verses = new Map<number, { text: string; label?: string }>();
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const nums = parts[i].split(/[,-]/).map(Number).filter(Number.isFinite);
    if (!nums.length) continue;
    const n = nums[0];
    const last = nums[nums.length - 1];
    const v = verses.get(n) ?? { text: '' };
    if (last !== n) v.label = `${n}-${last}`;
    v.text += ` ${parts[i + 1]}`;
    verses.set(n, v);
  }
  return [...verses.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, v]) => {
      const text = v.text.replace(/\s+/g, ' ').replace(/\s+([,.;:!?»)])/g, '$1').trim();
      return v.label ? [n, text, v.label] : [n, text];
    })
    .filter(([, text]) => text) as [number, string, string?][];
}
