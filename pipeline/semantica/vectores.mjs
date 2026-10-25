// Vectores semánticos de todos los versículos para la búsqueda rápida por idea (api/_semantica.ts).
// node pipeline/semantica/vectores.mjs <carpeta de datos> <salida>
//   <carpeta de datos>: la de `npm run data` (public/data), con books.json y text/<versión>/.
//   <salida>: meta.json (modelo, prefijo de la consulta, referencias), vectores.i8 (int8, un vector por versículo)
//   y escalas.f32 (la escala de cada vector, para volver a su tamaño real).
// El modelo se baja de Hugging Face; con SEMANTICA_MODELOS=<carpeta> se lee de ahí (las copias de la versión
// «semantica-modelos-v1»). Lo corre la acción «Vectores semánticos», que publica el resultado en «semantica-vectores-v1».
import { env, pipeline } from '@huggingface/transformers';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MODEL = 'Xenova/multilingual-e5-small';
const DTYPE = 'q8';
const QUERY = 'query: ';
const PASSAGE = 'passage: ';
const VERSIONS = ['rv1909', 'blm', 'bes', 'pdt']; // el vector de cada versículo es la media de estas versiones (antigua y actuales)
const BATCH = 64;

const [dataDir, outDir] = process.argv.slice(2);
if (!dataDir || !outDir) throw new Error('uso: node pipeline/semantica/vectores.mjs <datos> <salida>');
if (process.env.SEMANTICA_MODELOS) {
  env.localModelPath = process.env.SEMANTICA_MODELOS;
  env.allowRemoteModels = false;
}

const books = JSON.parse(readFileSync(path.join(dataDir, 'books.json'), 'utf8'));
const chapter = (version, book, n) => {
  try {
    return JSON.parse(readFileSync(path.join(dataDir, 'text', version, book, `${n}.json`), 'utf8'));
  } catch {
    return [];
  }
};

// Las referencias son las de la RV1909, la versión que usan el buscador y la IA.
const refs = [];
const texts = VERSIONS.map(() => []);
for (const b of books)
  for (let c = 1; c <= b.chapters; c++) {
    const others = VERSIONS.map((v) => new Map(chapter(v, b.id, c).map(([n, t]) => [n, t])));
    for (const [n, t] of chapter('rv1909', b.id, c)) {
      refs.push(`${b.id}.${c}.${n}`);
      VERSIONS.forEach((_, i) => texts[i].push(PASSAGE + (others[i].get(n) ?? t)));
    }
  }

const extract = await pipeline('feature-extraction', MODEL, { dtype: DTYPE });
const dim = (await extract(['x'], { pooling: 'mean', normalize: true })).dims.at(-1);
const sum = new Float32Array(refs.length * dim);
const t0 = Date.now();
for (const list of texts)
  for (let i = 0; i < list.length; i += BATCH) {
    const out = await extract(list.slice(i, i + BATCH), { pooling: 'mean', normalize: true });
    for (let k = 0; k < out.data.length; k++) sum[i * dim + k] += out.data[k];
    if (i % (BATCH * 50) === 0) console.log(`${i}/${list.length} · ${Math.round((Date.now() - t0) / 1000)} s`);
  }

// Cada vector se vuelve a normalizar y se guarda en int8 con su escala (31 000 versículos × 384 ≈ 12 MB).
const values = new Int8Array(refs.length * dim);
const scales = new Float32Array(refs.length);
for (let i = 0; i < refs.length; i++) {
  const o = i * dim;
  let norm = 0;
  for (let k = 0; k < dim; k++) norm += sum[o + k] ** 2;
  norm = Math.sqrt(norm) || 1;
  let max = 0;
  for (let k = 0; k < dim; k++) max = Math.max(max, Math.abs(sum[o + k] / norm));
  const scale = max / 127 || 1;
  for (let k = 0; k < dim; k++) values[o + k] = Math.round(sum[o + k] / norm / scale);
  scales[i] = scale;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ model: MODEL, dtype: DTYPE, query: QUERY, dim, versions: VERSIONS, refs }));
writeFileSync(path.join(outDir, 'vectores.i8'), Buffer.from(values.buffer));
writeFileSync(path.join(outDir, 'escalas.f32'), Buffer.from(scales.buffer));
console.log(`Listo: ${refs.length} versículos, ${dim} dimensiones, ${Math.round((Date.now() - t0) / 1000)} s`);
