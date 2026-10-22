// Lo que la IA del estudio puede leer además del pasaje abierto: la versión que lee la persona y las herramientas
// con las que investiga otros pasajes y fuentes cuando responde una pregunta («¿cómo se definió el canon?»).
// El guion bajo hace que Vercel no la publique como función.
//
// Versiones: la IA solo recibe texto de versiones libres (pipeline/build_data.py VERSIONS). Si la persona lee una
// versión con derechos (src/lib/licenciadas.ts), sus licencias no permiten pasar el texto a la IA: la IA trabaja con
// la Reina-Valera 1909 y la app muestra cada cita en la versión de la persona al tocarla.
//
// Herramientas: cada resultado vuelve como bloques «search_result» con citas activadas, así que lo que la IA saca de
// ellos llega con sus números ⟦n⟧ igual que lo que saca de los documentos del pasaje.

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Section, sections } from './_comentarios';
import { Area, buscarTeologia } from './_teologia';
import { parseCita } from '../src/lib/cita';
import { ACTIVAS, Fuente, comenta } from '../src/lib/comentarioFuentes';
import { LICENSED } from '../src/lib/licenciadas';
import { describeMorph } from '../src/lib/morph';
import { original } from '../src/lib/original';
import { formatRef, parseRef } from '../src/lib/refs';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');

export type Book = { id: string; name: string; abbr: string; chapters: number; testament: 'AT' | 'NT'; interlinear: boolean };
export type Verse = [number, string];
export type Word = [string, string, string, string, string, string, string, string];
// [referencia, forma original, glosa]: concordancia por número de Strong generada por el pipeline
export type Use = [string, string, string];
/** Cada bloque de un documento o resultado lleva su etiqueta y, si se puede abrir en la app, su referencia. */
export type BlockMeta = { label: string; ref?: string; url?: string; nota?: string };
export type Block = { text: string; meta: BlockMeta };

export async function load<T>(rel: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, rel), 'utf8')) as T;
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

// ---------------------------------------------------------------- La versión que lee la persona

/** La versión con la que trabaja la IA. `licensed`: la que lee la persona, si es una con derechos que la IA no recibe. */
export type Lectura = { id: string; abbr: string; name: string; licensed?: { id: string; abbr: string; name: string } };

const RV1909: Lectura = { id: 'rv1909', abbr: 'RV1909', name: 'Reina-Valera 1909' };

/** La versión pedida, o null si no existe. Sin versión, la RV1909. */
export async function lectura(version: unknown): Promise<Lectura | null> {
  if (version === undefined || version === 'rv1909') return RV1909;
  if (typeof version !== 'string') return null;
  const free = (await load<{ id: string; abbr: string; name: string }[]>('versions.json', [])).find((v) => v.id === version);
  if (free) return { id: free.id, abbr: free.abbr, name: free.name };
  const licensed = LICENSED.find((v) => v.id === version);
  if (licensed) return { ...RV1909, licensed: { id: licensed.id, abbr: licensed.abbr, name: licensed.name } };
  return null;
}

/** Instrucciones sobre la versión: se añaden al sistema cuando no es la RV1909. */
export function versionSystem(l: Lectura): string {
  if (l.licensed) {
    const { abbr, name } = l.licensed;
    return `

Versión: la persona lee la Biblia en la versión «${name}» (${abbr}), que tiene derechos de autor: su texto no lo recibes porque su licencia no permite pasarlo a la IA. Trabajas con la Reina-Valera 1909: cuando copies palabras de un versículo, di que son de la RV1909 («en la RV1909: …»). No reproduzcas de memoria el texto de la ${abbr} ni digas cómo lo traduce. Al tocar una cita, la app le muestra ese versículo en su ${abbr}.`;
  }
  if (l.id === 'rv1909') return '';
  return `

Versión: la persona lee la Biblia en la versión «${l.name}» (${l.abbr}). El texto de los pasajes viene en esa versión: cuando copies palabras de un versículo, cópialas tal cual están en la ${l.abbr} y llámala por su sigla. Las glosas del texto original son literales y no siempre coinciden con sus palabras.`;
}

/** Capítulos ya leídos en esta petición. Las versiones que no van dentro de la función se piden a la web. */
export class Biblia {
  private chapters = new Map<string, Promise<Verse[]>>();

  constructor(
    readonly request: Request,
    readonly version: Lectura,
    readonly books: Book[],
  ) {}

  chapter(book: string, chapter: number): Promise<Verse[]> {
    const id = this.version.id;
    const key = `${id}/${book}/${chapter}`;
    let found = this.chapters.get(key);
    if (!found) {
      found = load<Verse[] | null>(`text/${key}.json`, null).then((local) => local ?? this.fetchChapter(key));
      this.chapters.set(key, found);
    }
    return found;
  }

  // Solo la RV1909 va dentro de la función (vercel.json); las demás versiones libres son archivos de la web.
  private async fetchChapter(key: string): Promise<Verse[]> {
    const cookie = this.request.headers.get('cookie');
    const res = await fetch(new URL(`/data/text/${key}.json`, this.request.url), {
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res?.ok) throw new Error(`No se pudo leer ${key}`);
    return (await res.json()) as Verse[];
  }

  /** Texto de una referencia (solo el tramo dentro del primer capítulo, para no cargar de más). */
  async refText(ref: string): Promise<string> {
    const { start, end } = parseRef(ref);
    const verses = await this.chapter(start.book, start.chapter).catch(() => [] as Verse[]);
    const last = end.book === start.book && end.chapter === start.chapter ? end.verse : start.verse;
    return verses
      .filter(([n]) => n >= start.verse && n <= last)
      .map(([, t]) => t)
      .join(' ');
  }

  label(ref: string) {
    return formatRef(ref, this.books);
  }

  /** Lee «Hechos 15:1-21», «Salmos 119» o «jhn.3.16». */
  cita(input: string): { book: Book; chapter: number; verse?: number; verseEnd?: number } | null {
    const text = input.trim();
    if (/^[0-9a-z]{3}\.\d+(\.\d+)?$/.test(text)) {
      const [b, c, v] = text.split('.');
      const book = this.books.find((x) => x.id === b);
      const chapter = Number(c);
      return book && chapter >= 1 && chapter <= book.chapters ? { book, chapter, verse: v ? Number(v) : undefined } : null;
    }
    const c = parseCita(text, this.books);
    const book = c && !c.problem ? this.books.find((b) => b.id === c.book) : undefined;
    return c && book ? { book, chapter: c.chapter, verse: c.verse, verseEnd: c.verseEnd } : null;
  }
}

// ---------------------------------------------------------------- Comentarios

/** Los primeros párrafos de un texto hasta unas palabras; el último se corta en una frase si hace falta. */
export function firstWords(paras: string[], max: number) {
  const out: string[] = [];
  let left = max;
  for (const p of paras) {
    const words = p.split(/\s+/);
    if (words.length <= left) {
      out.push(p);
      left -= words.length;
      continue;
    }
    if (left >= 40 || out.length === 0) out.push(words.slice(0, Math.max(left, 40)).join(' ') + '…');
    break;
  }
  return out;
}

/** Lo que dicen de un pasaje los comentarios que la IA puede leer: un grupo de bloques por comentario. */
export async function commentaryBlocks(
  request: Request,
  book: Book,
  chapter: number,
  verse: number | undefined,
  books: Book[],
  budget: number,
): Promise<{ title: string; fuente: Fuente; blocks: Block[] }[]> {
  const fuentes = ACTIVAS.filter((f) => f.tipo !== 'enlace' && f.ia !== false && comenta(f, book));
  const found = await Promise.all(
    fuentes.map(async (f: Fuente) => {
      const all = await sections(request, f, book.id, chapter);
      // Un versículo: la sección que lo comenta (o la anterior más cercana, que suele cubrir un tramo).
      const picked = verse
        ? [all.find((s) => s.desde <= verse && verse <= s.hasta) ?? all.filter((s) => s.desde > 0 && s.desde <= verse).at(-1)].filter(
            (s): s is Section => !!s,
          )
        : all;
      if (!picked.length) return null;
      const each = Math.max(60, Math.floor(budget / picked.length));
      const blocks = picked.flatMap((s) => {
        const where =
          s.desde === 0 ? `${book.name} ${chapter}` : `${book.name} ${chapter}:${s.desde}${s.hasta > s.desde ? `-${s.hasta}` : ''}`;
        const paras = s.partes.join('\n\n').split(/\n{2,}/);
        const text = firstWords(paras, each).map((p) =>
          // Las referencias ⟦jhn.3.16⟧ se leen como «Juan 3:16»: ⟦…⟧ marca las citas en la respuesta.
          p.replace(/⟦([^⟧]+)⟧/g, (_, r: string) => {
            try {
              return formatRef(r, books);
            } catch {
              return '';
            }
          }),
        );
        const meta = { label: `${f.nombre}, ${where}`, ref: `${book.id}.${chapter}.${Math.max(1, s.desde)}` };
        return text.map((t, i) => ({ text: i === 0 && s.titulo ? `${s.titulo}\n${t}` : t, meta }));
      });
      const title = `${f.obra}, ${f.autor}${f.año ? ` (${f.año})` : ''} · comentario sobre ${verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`}`;
      return { title, fuente: f, blocks };
    }),
  );
  return found.filter((d) => d !== null);
}

// ---------------------------------------------------------------- Búsqueda en toda la Biblia

const norm = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

type Indexed = { ref: string; book: string; text: string; plain: string };
let indexed: Promise<Indexed[]> | null = null;

/** Todos los versículos de la RV1909 (la única versión que va dentro de la función), leídos una vez por instancia. */
function rv1909Index(books: Book[]): Promise<Indexed[]> {
  indexed ??= Promise.all(
    books.flatMap((b) =>
      Array.from({ length: b.chapters }, (_, i) =>
        load<Verse[]>(`text/rv1909/${b.id}/${i + 1}.json`, []).then((vs) =>
          vs.map(([n, t]) => ({ ref: `${b.id}.${i + 1}.${n}`, book: b.id, text: t, plain: norm(t) })),
        ),
      ),
    ),
  )
    .then((chapters) => chapters.flat())
    .catch((err) => {
      indexed = null;
      throw err;
    });
  return indexed;
}

/** Versículos con todas las palabras (por su comienzo, sin tildes) o con la frase exacta si va entre comillas. */
export async function searchVerses(query: string, books: Book[], testamento?: 'AT' | 'NT') {
  const q = norm(query).trim();
  const phrase = q.match(/^["«“](.+)["»”]$/)?.[1];
  const terms = phrase ? [] : q.split(/[^a-zñ0-9]+/).filter((w) => w.length >= 2);
  if (!phrase && !terms.length) return { total: 0, hits: [] as Indexed[], byBook: [] as [string, number][] };
  const res = terms.map((t) => new RegExp(`(^|[^a-zñ])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  const testament = new Map(books.map((b) => [b.id, b.testament]));
  const all = (await rv1909Index(books)).filter(
    (v) =>
      (!testamento || testament.get(v.book) === testamento) &&
      (phrase ? v.plain.includes(phrase.replace(/\s+/g, ' ')) : res.every((re) => re.test(v.plain))),
  );
  const byBook = new Map<string, number>();
  for (const v of all) byBook.set(v.book, (byBook.get(v.book) ?? 0) + 1);
  // Una muestra repartida por toda la Biblia: no solo los primeros libros donde aparece.
  const max = 30;
  const step = Math.max(1, all.length / max);
  const hits = Array.from({ length: Math.min(max, all.length) }, (_, i) => all[Math.floor(i * step)]);
  return { total: all.length, hits, byBook: [...byBook].sort((a, b) => b[1] - a[1]) };
}

// ---------------------------------------------------------------- Las herramientas

export type Paso = { tipo: 'leer' | 'buscar' | 'referencias' | 'comentarios' | 'original' | 'concordancia' | 'teologia'; texto: string };

const cita = (description: string) => ({
  type: 'object' as const,
  properties: { cita: { type: 'string', description } },
  required: ['cita'],
  additionalProperties: false,
});

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'leer_pasaje',
    description:
      'Lee un pasaje de cualquier parte de la Biblia, en la versión con la que trabajas. Úsalo para ver el contexto de otro pasaje antes de hablar de él o citarlo. Un capítulo cada vez, hasta 60 versículos.',
    input_schema: cita('La cita en español, como «Hechos 15:1-21», «Salmos 119:1-16» o «1 Corintios 13».'),
    strict: true,
  },
  {
    name: 'buscar_en_la_biblia',
    description:
      'Busca en toda la Reina-Valera 1909 los versículos que contienen unas palabras y dice cuántos hay y en qué libros. Sirve para seguir un tema o una palabra por toda la Biblia. La RV1909 tiene ortografía antigua («Jehová», «á» como preposición, «mugeres»): busca por el comienzo de las palabras («escritur», «profet») y prueba sinónimos si no encuentras nada. Pon la frase entre comillas para buscarla exacta.',
    input_schema: {
      type: 'object',
      properties: {
        palabras: { type: 'string', description: 'Palabras o comienzos de palabras, todos deben estar en el versículo.' },
        testamento: { type: 'string', enum: ['AT', 'NT', 'todo'], description: 'Dónde buscar.' },
      },
      required: ['palabras', 'testamento'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'referencias_cruzadas',
    description: 'Los pasajes relacionados con un versículo, votados por lectores (OpenBible.info), con su texto.',
    input_schema: cita('Un versículo, como «Romanos 3:23».'),
    strict: true,
  },
  {
    name: 'comentarios',
    description:
      'Lo que dicen de un pasaje los comentarios bíblicos de la app, en su inglés original (las notas de estudio de Tyndale y comentaristas clásicos como Matthew Henry, Calvino, Keil y Delitzsch o Spurgeon). Para un versículo o un capítulo entero.',
    input_schema: cita('Un capítulo o un versículo, como «Romanos 9» o «2 Timoteo 3:16».'),
    strict: true,
  },
  {
    name: 'texto_original',
    description:
      'El hebreo, arameo o griego de un versículo palabra por palabra, con su glosa, su lema, su número de Strong y su gramática (STEPBible, Tyndale House).',
    input_schema: cita('Un versículo, como «Juan 1:1».'),
    strict: true,
  },
  {
    name: 'concordancia',
    description:
      'Dónde más aparece una palabra hebrea o griega en la Biblia, por su número de Strong (lo da texto_original), con una muestra de pasajes repartida por toda la Biblia.',
    input_schema: {
      type: 'object',
      properties: { strong: { type: 'string', description: 'El número de Strong, como «G0026» o «H2617».' } },
      required: ['strong'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'teologia',
    description:
      'Busca en obras clásicas de teología y de historia de la Iglesia, de dominio público y en su inglés original: las teologías sistemáticas de Charles Hodge (presbiteriano, 1872), A. H. Strong (bautista, 1907), W. G. T. Shedd (presbiteriano, 1888) y John Miley (metodista arminiano, 1892), la Institución de Calvino, los credos y confesiones (Apostólico, Calcedonia, Westminster, Heidelberg, Belga, Treinta y Nueve Artículos, Dort, confesiones bautistas y metodistas), y para la historia del canon la Historia eclesiástica de Eusebio, la Carta festal 39 de Atanasio, el fragmento de Muratori y la historia del canon del NT de Westcott. Úsala para preguntas de doctrina o de historia (cómo se definió el canon, qué es la justificación, cómo se entiende la Trinidad). Devuelve hasta tres secciones, como mucho una por obra.',
    input_schema: {
      type: 'object',
      properties: {
        tema: { type: 'string', description: 'El tema en español, corto, para enseñárselo a la persona: «el canon del Nuevo Testamento».' },
        busqueda: {
          type: 'string',
          description: 'Palabras clave en inglés, como las escribirían esos autores: «canon New Testament disputed books», «justification imputation righteousness», «Trinity eternal generation Son».',
        },
        area: {
          type: 'string',
          enum: ['sistematicas', 'canon', 'credos', 'todo'],
          description: 'sistematicas: las teologías y Calvino; canon: Eusebio, Atanasio, Muratori y Westcott; credos: credos y confesiones; todo: todas.',
        },
      },
      required: ['tema', 'busqueda', 'area'],
      additionalProperties: false,
    },
    strict: true,
  },
];

export type Resultado = {
  content: Anthropic.Beta.BetaToolResultBlockParam['content'];
  /** Las etiquetas de los bloques de cada search_result, en orden. */
  results: BlockMeta[][];
  paso: Paso;
  error?: boolean;
};

const MAX_READ = 60;
const COMMENT_TOOL_WORDS = 600;

function result(title: string, source: string, blocks: Block[]): { param: Anthropic.Beta.BetaSearchResultBlockParam; metas: BlockMeta[] } {
  return {
    param: {
      type: 'search_result',
      source,
      title,
      content: blocks.map((b) => ({ type: 'text' as const, text: b.text })),
      citations: { enabled: true },
    },
    metas: blocks.map((b) => b.meta),
  };
}

/** «Vol. I › Part I › Chapter VI. The Trinity › 1. Preliminary Remarks (2/3)» → «I, Chapter VI. The Trinity, 1. Preliminary Remarks». */
function lugar(titulo: string): string {
  const parts = titulo.replace(/\s*\(\d+\/\d+\)$/, '').split(' › ');
  const vol = parts[0].match(/^Vol\. (\w+)$/)?.[1];
  const rest = parts.slice(vol ? 1 : 0).slice(-2).map((p) => (p.length > 60 ? `${p.slice(0, 57).replace(/\s+\S*$/, '')}…` : p));
  return [vol, ...rest].filter(Boolean).join(', ');
}

const fail = (paso: Paso, message: string): Resultado => ({ content: message, results: [], paso, error: true });

/** Qué va a hacer la herramienta, para enseñarlo mientras busca. */
export function pasoDe(name: string, input: Record<string, unknown>, biblia: Biblia): Paso {
  const raw = String(input.cita ?? input.palabras ?? input.strong ?? input.tema ?? '').slice(0, 80);
  const c = typeof input.cita === 'string' ? biblia.cita(input.cita) : null;
  const where = c ? `${c.book.name} ${c.chapter}${c.verse ? `:${c.verse}${c.verseEnd ? `-${c.verseEnd}` : ''}` : ''}` : raw;
  switch (name) {
    case 'leer_pasaje':
      return { tipo: 'leer', texto: where };
    case 'buscar_en_la_biblia':
      return { tipo: 'buscar', texto: `«${raw.replace(/[«»"“”]/g, '')}»` };
    case 'referencias_cruzadas':
      return { tipo: 'referencias', texto: where };
    case 'comentarios':
      return { tipo: 'comentarios', texto: where };
    case 'texto_original':
      return { tipo: 'original', texto: where };
    case 'teologia':
      return { tipo: 'teologia', texto: raw };
    default:
      return { tipo: 'concordancia', texto: raw.toUpperCase() };
  }
}

/** Ejecuta una herramienta. Los errores vuelven a la IA como texto para que pruebe otra cosa. */
export async function investigar(name: string, input: Record<string, unknown>, biblia: Biblia): Promise<Resultado> {
  const paso = pasoDe(name, input, biblia);
  const books = biblia.books;
  const v = biblia.version;
  try {
    if (name === 'buscar_en_la_biblia') {
      const palabras = String(input.palabras ?? '').slice(0, 120);
      const t = input.testamento === 'AT' || input.testamento === 'NT' ? input.testamento : undefined;
      const { total, hits, byBook } = await searchVerses(palabras, books, t);
      const shown = palabras.replace(/[«»"“”]/g, '');
      if (!total) return { content: `Ningún versículo de la RV1909 tiene «${shown}». Prueba con el comienzo de la palabra o con sinónimos.`, results: [], paso };
      const name = new Map(books.map((b) => [b.id, b.name]));
      const summary = `«${shown}» aparece en ${total} ${total === 1 ? 'versículo' : 'versículos'} de la RV1909${t ? ` (${t === 'AT' ? 'Antiguo' : 'Nuevo'} Testamento)` : ''}. Por libros: ${byBook
        .slice(0, 12)
        .map(([b, n]) => `${name.get(b)} ${n}`)
        .join(', ')}${byBook.length > 12 ? '…' : ''}.${total > hits.length ? ` Muestra de ${hits.length}, repartida por toda la Biblia:` : ''}`;
      const r = result(
        `Búsqueda de «${shown}» en la Reina-Valera 1909`,
        `buscar:${palabras}`,
        hits.map((h) => ({ text: `${biblia.label(h.ref)}: ${h.text}`, meta: { label: biblia.label(h.ref), ref: h.ref } })),
      );
      return { content: [{ type: 'text', text: summary }, r.param], results: [r.metas], paso };
    }

    if (name === 'teologia') {
      const busqueda = String(input.busqueda ?? '').slice(0, 200);
      const area = (['sistematicas', 'canon', 'credos'].includes(String(input.area)) ? input.area : 'todo') as Area | 'todo';
      const found = await buscarTeologia(biblia.request, busqueda, area);
      if (!found) return fail(paso, 'Las obras de teología no están disponibles ahora. Sigue con lo que tienes.');
      if (!found.length) return { content: `Nada en esas obras sobre «${busqueda}». Prueba con otras palabras en inglés o con otra área.`, results: [], paso };
      const rs = found.map((h) => {
        const where = lugar(h.titulo);
        const label = `${h.obra.corto}${where ? `, ${where}` : ''}`;
        const nota = `${h.obra.autor} · ${h.obra.año < 1000 ? `hacia el año ${h.obra.año}` : h.obra.año} · ${h.obra.tradicion} · dominio público`;
        return result(
          `${h.obra.autor}, ${h.obra.titulo} (${h.obra.año}, ${h.obra.tradicion}) · ${h.titulo}`,
          h.url,
          h.parrafos.map((p) => ({ text: p, meta: { label, url: h.url, nota } })),
        );
      });
      const aviso =
        'Obras humanas de dominio público, en inglés: explícalas en español con tus palabras, sin traducir párrafos enteros, di de quién es cada idea y su tradición, y no las pongas al nivel de la Escritura.';
      return { content: [{ type: 'text', text: aviso }, ...rs.map((r) => r.param)], results: rs.map((r) => r.metas), paso };
    }

    if (name === 'concordancia') {
      const strong = String(input.strong ?? '')
        .toUpperCase()
        .replace(/^([GH])(\d{1,4})([A-Z]?)$/, (_, l: string, n: string, s: string) => `${l}${n.padStart(4, '0')}${s}`);
      if (!/^[GH]\d{4}[A-Z]?$/.test(strong)) return fail(paso, 'Número de Strong no válido. Usa la forma «G0026» o «H2617».');
      const entry = await load<{ lemma?: string; meaning?: string; uses: Use[] } | Use[] | null>(`concordance/${strong}.json`, null);
      if (!entry) return fail(paso, `La concordancia de la app no tiene ${strong}.`);
      const uses = Array.isArray(entry) ? entry : entry.uses;
      const head = Array.isArray(entry) ? strong : `${entry.lemma} (${strong}) «${entry.meaning}»`;
      const step = Math.max(1, uses.length / 24);
      const picked = Array.from({ length: Math.min(24, uses.length) }, (_, i) => uses[Math.floor(i * step)]);
      const blocks = await Promise.all(
        picked.map(async ([ref, form, gloss]) => ({
          text: `${biblia.label(ref)}: ${form} «${gloss}». ${v.abbr}: ${await biblia.refText(ref)}`,
          meta: { label: biblia.label(ref), ref },
        })),
      );
      const r = result(`Concordancia de ${head}: ${uses.length} apariciones`, `concordancia:${strong}`, blocks);
      return { content: [{ type: 'text', text: `${head} aparece ${uses.length} veces. Muestra repartida:` }, r.param], results: [r.metas], paso };
    }

    const c = biblia.cita(String(input.cita ?? ''));
    if (!c) return fail(paso, `No entendí la cita «${String(input.cita ?? '')}». Escríbela como «Hechos 15:1-21».`);
    const { book, chapter } = c;

    if (name === 'leer_pasaje') {
      const verses = await biblia.chapter(book.id, chapter);
      const from = c.verse ?? 1;
      const wanted = c.verseEnd ?? (c.verse ?? verses.length);
      const to = Math.min(wanted, from + MAX_READ - 1);
      const picked = verses.filter(([n]) => n >= from && n <= to);
      if (!picked.length) return fail(paso, `${book.name} ${chapter} no tiene el versículo ${from}.`);
      const cut = wanted > to;
      const r = result(
        `${book.name} ${chapter}:${from}${to > from ? `-${to}` : ''} · ${v.name}`,
        `${book.id}.${chapter}.${from}-${book.id}.${chapter}.${to}`,
        picked.map(([n, t]) => ({ text: `${chapter}:${n} ${t}`, meta: { label: `${book.name} ${chapter}:${n}`, ref: `${book.id}.${chapter}.${n}` } })),
      );
      const content: Resultado['content'] = [r.param];
      if (cut) content.push({ type: 'text', text: `Recortado en el versículo ${to}: pide el resto aparte si lo necesitas.` });
      return { content, results: [r.metas], paso };
    }

    if (name === 'referencias_cruzadas') {
      if (!c.verse) return fail(paso, 'Las referencias cruzadas son de un versículo: indica cuál.');
      const xrefs = await load<Record<string, [string, number][]>>(`xrefs/${book.id}/${chapter}.json`, {});
      const refs = (xrefs[c.verse] ?? []).slice(0, 12).map(([r]) => r);
      if (!refs.length) return { content: `No hay referencias cruzadas para ${book.name} ${chapter}:${c.verse}.`, results: [], paso };
      const blocks = await Promise.all(refs.map(async (r) => ({ text: `${biblia.label(r)}: ${await biblia.refText(r)}`, meta: { label: biblia.label(r), ref: r } })));
      const r = result(`Referencias cruzadas de ${book.name} ${chapter}:${c.verse} (OpenBible.info)`, `xrefs:${book.id}.${chapter}.${c.verse}`, blocks);
      return { content: [r.param], results: [r.metas], paso };
    }

    if (name === 'comentarios') {
      const found = await commentaryBlocks(biblia.request, book, chapter, c.verse, books, COMMENT_TOOL_WORDS);
      if (!found.length) return { content: `Los comentarios de la app no tienen nada sobre ${book.name} ${chapter}${c.verse ? `:${c.verse}` : ''}.`, results: [], paso };
      const rs = found.map((f) => result(f.title, `comentario:${f.fuente.id}:${book.id}.${chapter}`, f.blocks));
      return { content: rs.map((r) => r.param), results: rs.map((r) => r.metas), paso };
    }

    if (name === 'texto_original') {
      if (!c.verse) return fail(paso, 'El texto original se pide por versículo: indica cuál.');
      const interlinear = await load<Record<string, Word[]>>(`interlinear/${book.id}/${chapter}.json`, {});
      const words = interlinear[c.verse];
      if (!words?.length) return fail(paso, `La app no tiene el texto original de ${book.name} ${chapter}:${c.verse}.`);
      const lang = original(book);
      const r = result(`${book.name} ${chapter}:${c.verse} en ${lang.name} (STEPBible ${lang.source})`, `original:${book.id}.${chapter}.${c.verse}`, [
        {
          text: words
            .map(([g, tr, es, , lemma, lemmaGloss, strong, morph]) => `${g} (${tr}) «${es}»: lema ${lemma} «${lemmaGloss}», ${strong}, ${describeMorph(morph)}`)
            .join('; '),
          meta: { label: `${lang.name[0].toUpperCase()}${lang.name.slice(1)} de ${book.name} ${chapter}:${c.verse}`, ref: `${book.id}.${chapter}.${c.verse}` },
        },
      ]);
      return { content: [r.param], results: [r.metas], paso };
    }
    return fail(paso, `No conozco la herramienta ${name}.`);
  } catch (err) {
    console.error('estudiar: herramienta', name, err);
    return fail(paso, 'No se pudo consultar esa fuente ahora. Sigue con lo que tienes.');
  }
}
