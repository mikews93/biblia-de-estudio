// Búsqueda rápida por idea, sin Claude y sin cuenta: semántica (vectores) mezclada con búsqueda por palabras (BM25).
// - Los vectores de todos los versículos se calculan de antemano con pipeline/semantica/vectores.mjs (acción
//   «Vectores semánticos») y llegan a dist/data/semantica/ con `npm run semantica`.
// - La frase de la persona se convierte en vector aquí, con el mismo modelo pequeño (multilingual-e5-small, MIT) en
//   Transformers.js. El modelo se descarga una vez por instancia a /tmp; si no se puede, queda solo la búsqueda por
//   palabras, que es la misma que usa el teléfono sin conexión (src/lib/buscarPalabras.ts).
// - Las palabras se buscan en todas las versiones libres de la app (la que lee la persona pesa más), porque cada quien
//   recuerda el versículo con las palabras de su versión.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { type Book, load } from './_investigar';
import { type Hit, WordIndex, fuse, pinRecalled } from '../src/lib/buscarPalabras';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');

export type Meta = { model: string; dtype: string; query: string; dim: number; refs: string[] };
type Vectors = Meta & { values: Int8Array; scales: Float32Array };
export type Embed = (text: string) => Promise<Float32Array>;

let vectors: Promise<Vectors | null> | null = null;
const words = new Map<string, Promise<WordIndex>>();
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

/** El índice de palabras de una versión libre, armado una vez por instancia. */
function loadWords(version: string, books: Book[]): Promise<WordIndex> {
  let index = words.get(version);
  if (!index) {
    // Un archivo por versión (pipeline/semantica/textos.mjs); sin él, sus capítulos uno a uno.
    index = load<[string, string][]>(`semantica/textos/${version}.json`)
      .then((rows) => rows.map(([ref, text]) => ({ ref, text })))
      .catch(() =>
        Promise.all(
          books.flatMap((b) =>
            Array.from({ length: b.chapters }, (_, i) =>
              load<[number, string][]>(`text/${version}/${b.id}/${i + 1}.json`, []).then((vs) =>
                vs.map(([n, t]) => ({ ref: `${b.id}.${i + 1}.${n}`, text: t })),
              ),
            ),
          ),
        ).then((chapters) => chapters.flat()),
      )
      .then((docs) => new WordIndex(docs));
    index.catch(() => words.delete(version));
    words.set(version, index);
  }
  return index;
}

/** Las versiones libres que están en esta instalación. */
const freeVersions = () => load<{ id: string }[]>('versions.json', [{ id: 'rv1909' }]).then((vs) => vs.map((v) => v.id));

/** La búsqueda por palabras en cada versión libre, por separado. */
export async function searchWords(query: string, books: Book[]) {
  const ids = await freeVersions();
  return Promise.all(ids.map(async (id) => ({ id, hits: (await loadWords(id, books)).search(query, 40) })));
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

export type Quick = { refs: string[]; semantica: boolean };

/**
 * Las referencias que mejor responden a la búsqueda. Con vectores y modelo, semántica y palabras mezcladas (la
 * semántica pesa más: entiende «cuando tengo miedo» aunque el versículo diga «temor»); si no, solo palabras.
 * `embed` sustituye al modelo en las pruebas.
 */
export async function quickSearch(query: string, books: Book[], limit = 20, embed?: Embed, reading?: string): Promise<Quick> {
  const [vs, lists] = await Promise.all([loadVectors(), searchWords(query, books)]);
  const byWords = { refs: fuse(lists.map(({ id, hits }) => ({ refs: hits.map((h) => h.ref), weight: id === reading ? 1.5 : 1 }))) };
  const model = vs ? (embed ?? (await loadEmbedder(vs))) : null;
  const mixed = vs && model ? fuse([{ refs: nearest(await model(query), vs, 40).map((h) => h.ref), weight: 1.5 }, byWords]) : byWords.refs;
  // Un fragmento recordado casi palabra por palabra («no te dejaré ni te desampararé») va primero.
  return { refs: pinRecalled(mixed, query, lists, reading).slice(0, limit), semantica: !!(vs && model) };
}

/** Solo para las pruebas: vuelve a leer los archivos y el modelo. */
export function resetForTests() {
  vectors = embedder = null;
  words.clear();
  failedAt = 0;
}
