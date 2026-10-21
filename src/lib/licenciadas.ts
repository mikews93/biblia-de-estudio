// Versiones con derechos de autor que se leen a través de API.Bible (American Bible Society), con la clave
// API_BIBLE_KEY de Vercel. El plan gratuito (Starter, no comercial) da hasta tres Biblias con derechos: solo se
// muestran las que la clave tiene de verdad (api/biblia.ts las comprueba).
// Condiciones de la licencia: se muestra siempre el aviso de derechos, cada lectura se informa a FUMS, no se guardan
// libros enteros (ni descargas sin conexión), y su texto no se pasa a la IA ni se convierte en audio. Por eso la IA,
// el buscador, las comunidades y el audio siguen usando las versiones libres.

export type Licensed = {
  id: string;
  abbr: string;
  name: string;
  /** Id de la Biblia en API.Bible. */
  bibleId: string;
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
    credit:
      'Nueva Biblia de las Américas · Copyright © 2005 by The Lockman Foundation · Usada con permiso · NuevaBiblia.com',
    link: 'https://www.nuevabiblia.com',
  },
  {
    id: 'lbla',
    abbr: 'LBLA',
    name: 'La Biblia de las Américas',
    bibleId: 'e3f420b9665abaeb-01',
    credit:
      'La Biblia de las Américas · Copyright © 1986, 1995, 1997 by The Lockman Foundation · Usada con permiso · LBLA.com',
    link: 'https://www.lbla.com',
  },
  {
    id: 'ntv',
    abbr: 'NTV',
    name: 'Nueva Traducción Viviente',
    bibleId: '826f63861180e056-01',
    credit:
      'Nueva Traducción Viviente · © Tyndale House Foundation, 2010 · Usada con permiso de Tyndale House Publishers',
    link: 'https://www.nuevatraduccionviviente.com',
  },
  {
    id: 'niv',
    abbr: 'NIV',
    name: 'New International Version (inglés)',
    bibleId: '78a9f6124f344018-01',
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
