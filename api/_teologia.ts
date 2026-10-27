// Obras clásicas de teología e historia de la Iglesia, de dominio público, para la herramienta «teologia» de la IA
// del estudio (api/_investigar.ts). pipeline/build_teologia.py las divide en secciones y deja en /teologia/ un
// índice con las palabras de cada sección y los textos en archivos de 40 secciones (textos/<k>.json.gz). Igual que los comentarios, no van dentro de la
// función: se piden a la misma web. El guion bajo hace que Vercel no la publique como función.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const DIR = process.env.TEOLOGIA_DIR ?? path.join(process.cwd(), 'dist', 'teologia');
// Secciones por archivo de texto (SHARD en pipeline/build_teologia.py)
const SHARD = 40;

export type Area = 'sistematicas' | 'canon' | 'credos';
export type Obra = {
  id: string;
  autor: string;
  titulo: string;
  /** Cómo se cita en las fuentes: «Hodge, Teología sistemática». */
  corto: string;
  año: number;
  tradicion: string;
  area: Area;
  url: string;
};
/** [obra, título de la sección (con los de sus capítulos), dirección en la web de la obra, palabras con su peso] */
export type Seccion = [number, string, string, Record<string, number>];
export type Indice = { obras: Obra[]; secciones: Seccion[] };
export type Hallazgo = { obra: Obra; titulo: string; url: string; parrafos: string[] };

/**
 * Un archivo de datos estáticos de la web (/teologia/…, /diccionario/…): del despliegue si está en la función, o
 * pedido a la misma web. Los .gz llegan comprimidos o ya descomprimidos según el servidor.
 */
export async function leerJson<T>(request: Request, carpeta: string, rel: string, dir = path.join(process.cwd(), 'dist', carpeta)): Promise<T | null> {
  let raw = await readFile(path.join(dir, rel)).catch(() => null);
  if (!raw) {
    // En las vistas previas protegidas de Vercel la cookie de quien pregunta abre también los archivos.
    const cookie = request.headers.get('cookie');
    const res = await fetch(new URL(`/${carpeta}/${rel}`, request.url), {
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    raw = res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  if (!raw) return null;
  try {
    return JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString('utf8')) as T;
  } catch {
    return null;
  }
}

const json = <T>(request: Request, rel: string) => leerJson<T>(request, 'teologia', rel, DIR);

let indice: Promise<Indice | null> | null = null;
function getIndice(request: Request) {
  indice ??= json<Indice>(request, 'indice.json.gz').then((i) => {
    if (!i) indice = null;
    return i;
  });
  return indice;
}

// Las mismas reglas que pipeline/build_teologia.py: minúsculas, sin acentos, singular sencillo.
const STOP = new Set(
  'the of and to in a is that it be as for by with this which or are not from his he but on was they all we an at so have their them its there what our these were has who been one may if no can will also those any such than more into only would must upon do should then when how why does did'.split(
    ' ',
  ),
);
export function terms(text: string): string[] {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .match(/[a-z]{3,}/g) ?? []
  )
    .filter((w) => !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

/**
 * Las secciones que mejor responden a una búsqueda en inglés, como mucho una por obra para oír varias voces, con los
 * párrafos de cada una que más hablan de lo buscado, en su orden y hasta «palabras» en total por sección.
 */
export async function buscarTeologia(request: Request, busqueda: string, area: Area | 'todo', max = 3, palabras = 650): Promise<Hallazgo[] | null> {
  const ix = await getIndice(request);
  if (!ix) return null;
  const q = [...new Set(terms(busqueda))];
  if (!q.length) return [];
  const scored: [number, number][] = [];
  ix.secciones.forEach(([o, titulo, , pesos], i) => {
    if (area !== 'todo' && ix.obras[o].area !== area) return;
    const t = new Set(terms(titulo));
    let score = 0;
    let hits = 0;
    for (const w of q) {
      const p = pesos[w] ?? 0;
      if (p || t.has(w)) hits++;
      score += p + (t.has(w) ? 2 : 0);
    }
    // Las que tienen todas las palabras van primero.
    if (score > 0) scored.push([i, score * (hits / q.length) ** 2]);
  });
  scored.sort((a, b) => b[1] - a[1]);
  const elegidas: number[] = [];
  const usadas = new Set<number>();
  for (const [i] of scored) {
    const o = ix.secciones[i][0];
    if (usadas.has(o)) continue;
    usadas.add(o);
    elegidas.push(i);
    if (elegidas.length >= max) break;
  }
  const hallazgos = await Promise.all(
    elegidas.map(async (i) => {
      const [o, titulo, url] = ix.secciones[i];
      const obra = ix.obras[o];
      const texto = await json<Record<string, string[]>>(request, `textos/${Math.floor(i / SHARD)}.json.gz`);
      const parrafos = texto?.[String(i)] ?? [];
      return parrafos.length ? { obra, titulo, url, parrafos: mejores(parrafos, q, palabras) } : null;
    }),
  );
  return hallazgos.filter((h): h is Hallazgo => !!h);
}

/** Los párrafos con más palabras buscadas, sin pasar de «max» palabras, en el orden de la obra. */
function mejores(parrafos: string[], q: string[], max: number): string[] {
  const words = parrafos.map((p) => p.split(/\s+/).length);
  const total = words.reduce((a, b) => a + b, 0);
  if (total <= max) return parrafos;
  const qs = new Set(q);
  const score = parrafos.map((p, i) => terms(p).filter((w) => qs.has(w)).length / Math.sqrt(words[i] + 20) + (i === 0 ? 0.3 : 0));
  const order = parrafos.map((_, i) => i).sort((a, b) => score[b] - score[a]);
  const picked = new Set<number>();
  let used = 0;
  for (const i of order) {
    if (used + words[i] > max) {
      if (!picked.size) {
        // Un solo párrafo larguísimo: su comienzo.
        picked.add(i);
        parrafos = parrafos.map((p, j) => (j === i ? `${p.split(/\s+/).slice(0, max).join(' ')}…` : p));
        break;
      }
      continue;
    }
    picked.add(i);
    used += words[i];
  }
  return [...picked].sort((a, b) => a - b).map((i) => parrafos[i]);
}
