// Búsqueda rápida por idea, sin Claude y sin cuenta: semántica (vectores) mezclada con búsqueda por palabras (BM25).
// - Los vectores de todos los versículos se calculan de antemano con pipeline/semantica/vectores.mjs (acción
//   «Vectores semánticos») y llegan a dist/data/semantica/ con `npm run semantica`.
// - La frase de la persona se convierte en vector aquí, con el mismo modelo pequeño (multilingual-e5-small, MIT) en
//   Transformers.js. El modelo se descarga una vez por instancia a /tmp; si no se puede, queda solo la búsqueda por
//   palabras, que es la misma que usa el teléfono sin conexión (src/lib/buscarPalabras.ts).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { type Book, rv1909Index } from './_investigar';
import { type Hit, WordIndex, fuse } from '../src/lib/buscarPalabras';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');

export type Meta = { model: string; dtype: string; query: string; dim: number; refs: string[] };
type Vectors = Meta & { values: Int8Array; scales: Float32Array };
export type Embed = (text: string) => Promise<Float32Array>;

let vectors: Promise<Vectors | null> | null = null;
let words: Promise<WordIndex> | null = null;
let embedder: Promise<Embed | null> | null = null;
let failedAt = 0;
/** Tras no poder cargar el modelo, cuánto esperar antes de volver a intentarlo (mientras tanto, solo palabras). */
const RETRY_MS = 5 * 60_000;

/** Los vectores de los versículos (int8, uno por versículo, con su escala), o null si no están en esta instalación. */
function loadVectors(): Promise<Vectors | null> {
  vectors ??= (async () => {
    const dir = path.join(DATA_DIR, 'semantica');
    const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8')) as Meta;
    const [v, s] = await Promise.all([readFile(path.join(dir, 'vectores.i8')), readFile(path.join(dir, 'escalas.f32'))]);
    const values = new Int8Array(v.buffer, v.byteOffset, v.byteLength);
    const scales = new Float32Array(s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength));
    if (values.length !== meta.refs.length * meta.dim || scales.length !== meta.refs.length) return null;
    return { ...meta, values, scales };
  })().catch(() => null);
  return vectors;
}

function loadWords(books: Book[]): Promise<WordIndex> {
  words ??= rv1909Index(books).then((vs) => new WordIndex(vs));
  words.catch(() => (words = null));
  return words;
}

/** Convierte la frase en vector con Transformers.js (el modelo de los vectores), o null si no se puede cargar. */
function loadEmbedder(meta: Meta): Promise<Embed | null> {
  if (!embedder && Date.now() - failedAt < RETRY_MS) return Promise.resolve(null);
  embedder ??= (async () => {
    const { env, pipeline } = await import('@huggingface/transformers');
    env.cacheDir = process.env.SEMANTICA_CACHE ?? '/tmp/modelos';
    if (process.env.SEMANTICA_MODELOS) {
      env.localModelPath = process.env.SEMANTICA_MODELOS;
      env.allowRemoteModels = false;
    }
    const extract = await pipeline('feature-extraction', meta.model, { dtype: meta.dtype as 'q8' });
    return async (text: string) =>
      (await extract([meta.query + text], { pooling: 'mean', normalize: true })).data as Float32Array;
  })().catch((err) => {
    console.error('semantica: no se pudo cargar el modelo', err);
    embedder = null;
    failedAt = Date.now();
    return null;
  });
  return embedder;
}

/** Los versículos más cercanos a un vector, del más al menos parecido. */
export function nearest(v: Float32Array, vs: Vectors, limit: number, keep?: (ref: string) => boolean): Hit[] {
  const { dim, values, scales, refs } = vs;
  const top: Hit[] = [];
  let floor = -Infinity;
  for (let i = 0; i < refs.length; i++) {
    let d = 0;
    const o = i * dim;
    for (let k = 0; k < dim; k++) d += v[k] * values[o + k];
    const score = d * scales[i];
    if (score <= floor || (keep && !keep(refs[i]))) continue;
    top.push({ ref: refs[i], score });
    if (top.length > limit * 2) {
      top.sort((a, b) => b.score - a.score).length = limit;
      floor = top[limit - 1].score;
    }
  }
  return top.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Parte de las palabras seguidas que tiene que coincidir para tomar la búsqueda como un fragmento recordado. */
const PHRASE = 0.6;

export type Quick = { refs: string[]; semantica: boolean };

/**
 * Las referencias que mejor responden a la búsqueda. Con vectores y modelo, semántica y palabras mezcladas (la
 * semántica pesa más: entiende «cuando tengo miedo» aunque el versículo diga «temor»); si no, solo palabras.
 * `embed` sustituye al modelo en las pruebas.
 */
export async function quickSearch(query: string, books: Book[], limit = 20, embed?: Embed): Promise<Quick> {
  const [vs, index] = await Promise.all([loadVectors(), loadWords(books)]);
  const hits = index.search(query, 40);
  const byWords = hits.map((h) => h.ref);
  const model = vs ? (embed ?? (await loadEmbedder(vs))) : null;
  if (!vs || !model) return { refs: byWords.slice(0, limit), semantica: false };
  const bySense = nearest(await model(query), vs, 40).map((h) => h.ref);
  const mixed = fuse([{ refs: bySense, weight: 1.5 }, { refs: byWords }]);
  // Un fragmento recordado casi palabra por palabra («no te dejaré ni te desampararé») va primero.
  const recalled = query.trim().split(/\s+/).length >= 4 ? hits.find((h) => (h.phrase ?? 0) >= PHRASE)?.ref : undefined;
  const refs = recalled ? [recalled, ...mixed.filter((r) => r !== recalled)] : mixed;
  return { refs: refs.slice(0, limit), semantica: true };
}

/** Solo para las pruebas: vuelve a leer los archivos y el modelo. */
export function resetForTests() {
  vectors = words = embedder = null;
  failedAt = 0;
}
