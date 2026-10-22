// Fichas de personas y lugares a partir de STEPBible TIPNR (CC BY 4.0); ver pipeline/fichas.py.
// La descripción viene en inglés y /api/comentario la traduce la primera vez que alguien abre la ficha.
import { traducir, type Estado } from './comentarios';
import { load } from './data';
import { Periodo, periodoDe } from './historia';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

/** m: varón · f: mujer · g: pueblo o grupo · l: lugar */
export type Tipo = 'm' | 'f' | 'g' | 'l';

export type FichaRef = { id: string; nombre: string; tipo: Tipo };
/** Lugar con su ubicación más probable; n: versículos en común. */
export type LugarRef = { id: string; nombre: string; lon: number; lat: number; conf: number; n: number };
type Spot = { lon: number; lat: number; conf: number };

export type Ficha = {
  id: string;
  nombre: string;
  tipo: Tipo;
  breve: string;
  /** Otras formas del nombre en la RV1909 (Abram, Efrata). */
  otros: string[];
  /** [forma hebrea o griega, nombre inglés] */
  original: [string, string][];
  /** [libro, [[capítulo, versículos]]] en orden bíblico */
  citas: [string, [number, number[]][]][];
  menciones: number;
  /** [referencia, texto del primer versículo en la RV1909] */
  claves: [string, string][];
  /** Descripción en inglés (solo para traducirla; la app no la muestra). */
  en: string;
  // Personas
  epoca?: string | null;
  rol?: string | null;
  tribu?: string | null;
  familia?: { padres: FichaRef[]; hermanos: FichaRef[]; conyuges: FichaRef[]; hijos: FichaRef[] };
  /** Id de la persona en las genealogías (Theographic), para abrir su árbol. */
  genealogia?: number;
  lugares?: LugarRef[];
  junto?: (FichaRef & { n: number })[];
  // Lugares
  clase?: string;
  mapa?: Spot & { alt: Spot[]; cercaDe?: string };
  foto?: { img: string; w: number; h: number; page: string; author: string | null; license: string };
  fundador?: FichaRef[];
  habitantes?: FichaRef[];
  personas?: (FichaRef & { n: number })[];
  cerca?: LugarRef[];
};

/** [id, nombre, tipo, breve, menciones, otros nombres] */
export type IndiceRow = [string, string, Tipo, string, number, string[]];
/** [id, nombre, tipo, versículos, formas del nombre en el texto de la RV1909] */
export type CapituloRow = [string, string, Tipo, number[], string[]];

export const getFicha = (id: string) => load<Ficha>(`fichas/f/${id}.json`);
export const getIndice = () => load<IndiceRow[]>('fichas/indice.json');
export const getFichasCapitulo = (book: string, chapter: number) =>
  load<CapituloRow[]>(`fichas/cap/${book}/${chapter}.json`, true).then((r) => (Array.isArray(r) ? r : []));
/** {id de Theographic: id de la ficha}: para ir de la genealogía a la ficha. */
export const getFichaDeGenealogia = () => load<Record<string, string>>('fichas/genealogia.json', true);
/** {id de OpenBible: id de la ficha}: para ir del mapa del versículo a la ficha. */
export const getFichaDeLugar = () => load<Record<string, string>>('fichas/openbible.json', true);

const sinAcentos = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** /ficha/h1732-david */
export function fichaHref(f: { id: string; nombre: string }) {
  const slug = sinAcentos(f.nombre.split(' (')[0])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `/ficha/${f.id}-${slug}`;
}

/** «h1732-david» -> «h1732» */
export const fichaId = (param: string) => param.split('-')[0].toLowerCase();

/** Personas y lugares cuyo nombre (o uno de sus otros nombres) empieza o contiene lo buscado; los más nombrados primero. */
export function buscarFichas(indice: IndiceRow[], q: string, max = 8): IndiceRow[] {
  const query = sinAcentos(q.trim());
  if (query.length < 2) return [];
  const scored: [number, IndiceRow][] = [];
  for (const row of indice) {
    const names = [row[1], row[1].split(' (')[0], ...row[5]].map(sinAcentos);
    let score = 0;
    if (names.some((n) => n === query)) score = 3;
    else if (names.some((n) => n.startsWith(query) || n.split(/[\s(-]+/).some((w) => w.startsWith(query)))) score = 2;
    else if (query.length >= 4 && names.some((n) => n.includes(query))) score = 1;
    if (score) scored.push([score, row]);
  }
  return scored
    .sort((a, b) => b[0] - a[0] || b[1][4] - a[1][4])
    .slice(0, max)
    .map(([, r]) => r);
}

// Listas de nombres de 1 Crónicas 1–9: nombran a muchos fuera de su época.
const esGenealogia = (book: string, chapter: number) => book === '1ch' && chapter <= 9;
const NT = new Set(['mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co', 'gal', 'eph', 'php', 'col', '1th', '2th', '1ti', '2ti', 'tit', 'phm', 'heb', 'jas', '1pe', '2pe', '1jn', '2jn', '3jn', 'jud', 'rev']);

/** Cuándo vivió una persona: los periodos de la línea de tiempo donde más se habla de ella, y el capítulo donde más aparece. */
export function epocaDe(f: Pick<Ficha, 'citas' | 'epoca'>): { periodos: Periodo[]; libro: string; capitulo: number } | null {
  // Los del AT que el NT recuerda (Abraham en Romanos) no vivieron en el NT, y al revés
  const nuevo = f.epoca === 'El Nuevo Testamento';
  const peso = new Map<string, number>();
  const periodos = new Map<string, Periodo>();
  let mejor: { libro: string; capitulo: number; n: number } | null = null;
  for (const [libro, caps] of f.citas) {
    if (NT.has(libro) !== nuevo) continue;
    for (const [capitulo, vs] of caps) {
      if (esGenealogia(libro, capitulo)) continue;
      const p = periodoDe(libro, capitulo);
      if (!p || p.sinFecha) continue;
      periodos.set(p.id, p);
      peso.set(p.id, (peso.get(p.id) ?? 0) + vs.length);
      if (!mejor || vs.length > mejor.n) mejor = { libro, capitulo, n: vs.length };
    }
  }
  if (!mejor) return null;
  const max = Math.max(...peso.values());
  const elegidos = [...peso.entries()]
    .filter(([, n]) => n >= max * 0.25)
    .map(([id]) => periodos.get(id)!)
    .sort((a, b) => a.desde - b.desde)
    .slice(0, 4);
  return { periodos: elegidos, libro: mejor.libro, capitulo: mejor.capitulo };
}

/** La descripción ya traducida, si alguien la abrió antes. */
export async function getDescripcion(id: string): Promise<{ texto: string | null; estado?: Estado }> {
  const res = await fetch(`${API}/api/comentario?ficha=${encodeURIComponent(id)}`).catch(() => {
    throw new Error('Sin conexión. La descripción se lee con internet.');
  });
  if (!res.ok) throw new Error('No se pudo cargar la descripción.');
  return res.json();
}

/** Traduce la descripción (o la trae) y llama a onUpdate con el texto que va llegando. */
export const traducirFicha = (id: string, onUpdate: (text: string) => void, signal?: AbortSignal) =>
  traducir({ ficha: id }, onUpdate, 'No se pudo traducir la descripción', signal);

export const FUENTE_FICHAS =
  'Personas, lugares, familia y versículos: STEPBible TIPNR (Tyndale House, Cambridge; CC BY 4.0), con cambios: ' +
  'nombres según la Reina-Valera 1909 y descripción traducida al español con IA.';

/** Personas y lugares que nombra un versículo. */
export const fichasDelVersiculo = (rows: CapituloRow[], verse: number) => rows.filter((r) => r[3].includes(verse));

export type Tramo = { texto: string; ficha?: CapituloRow };

/**
 * Parte el texto de un versículo de la RV1909 en tramos, marcando los nombres que tienen ficha («David», «Beth-lehem»).
 * Cada nombre se marca solo donde aparece como palabra entera; si dos fichas comparten forma, gana la primera.
 */
export function marcarNombres(texto: string, rows: CapituloRow[]): Tramo[] {
  const formas = rows
    .flatMap((r) => r[4].map((f) => [f, r] as const))
    .sort((a, b) => b[0].length - a[0].length);
  if (!formas.length) return [{ texto }];
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const letra = 'A-Za-zÁÉÍÓÚÑÜáéíóúñüâêîôûÂÊÎÔÛ';
  const re = new RegExp(`(?<![${letra}-])(${formas.map(([f]) => escape(f)).join('|')})(?![${letra}])`, 'g');
  const out: Tramo[] = [];
  let last = 0;
  for (const m of texto.matchAll(re)) {
    const ficha = formas.find(([f]) => f === m[0])![1];
    if (m.index > last) out.push({ texto: texto.slice(last, m.index) });
    out.push({ texto: m[0], ficha });
    last = m.index + m[0].length;
  }
  if (last < texto.length) out.push({ texto: texto.slice(last) });
  return out;
}
