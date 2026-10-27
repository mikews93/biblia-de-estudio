// Diccionarios bíblicos (Easton, 1897; Smith, 1863) e índice por temas (Nave, 1896), de dominio público y en su inglés
// original, para las herramientas «diccionario» y «temas_biblicos» de la IA (api/_investigar.ts) y la tarjeta «Del
// diccionario bíblico» del buscador (api/comentario.ts). pipeline/build_diccionario.py los deja en /diccionario/ por
// letras. Igual que la teología, no van dentro de la función: se piden a la misma web. El guion bajo hace que Vercel no
// la publique como función.

import path from 'node:path';

import { leerJson } from './_teologia';
import { formatRef } from '../src/lib/refs';

const DIR = process.env.DICCIONARIO_DIR ?? path.join(process.cwd(), 'dist', 'diccionario');

/** Cómo se citan las obras: en la nota de cada cita y en el crédito de la tarjeta. */
export const OBRAS = {
  easton: {
    corto: 'Diccionario bíblico de Easton',
    nota: "Easton's Bible Dictionary · M. G. Easton · 1897 · dominio público",
    url: 'https://ccel.org/ccel/easton/ebd2',
  },
  smith: {
    corto: 'Diccionario bíblico de Smith',
    nota: "Smith's Bible Dictionary · William Smith · 1863 · dominio público",
    url: 'https://ccel.org/ccel/smith_w/bibledict',
  },
  nave: {
    corto: 'Temas de la Biblia de Nave',
    nota: "Nave's Topical Bible · Orville J. Nave · 1896 · dominio público",
    url: 'https://github.com/BradyStephenson/bible-data',
  },
} as const;

/** [Easton, Smith, citas] */
type Fila = [string | null, string | null, string[]];
/** [nivel, subtema, citas] */
export type LineaTema = [number, string, string[]];
type Indice = { d: string[]; n: string[] };
export type Entrada = { clave: string; easton: string | null; smith: string | null; refs: string[] };
export type Tema = { clave: string; lineas: LineaTema[] };

const json = <T>(request: Request, rel: string) => leerJson<T>(request, 'diccionario', rel, DIR);

let indice: Promise<Indice | null> | null = null;
function getIndice(request: Request) {
  indice ??= json<Indice>(request, 'indice.json.gz').then((i) => {
    if (!i) indice = null;
    return i;
  });
  return indice;
}

const letra = (clave: string) => (/^[A-Z]/.test(clave) ? clave[0].toLowerCase() : 'otros');

/** Como las claves de los diccionarios: mayúsculas, sin tildes, apóstrofos ni signos («LORDS SUPPER»). */
export const clave = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/[^A-Z0-9 ,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Las claves que mejor responden a una palabra: la misma, en singular o plural, «the …», y las que empiezan por ella. */
function candidatas(q: string, todas: string[], max: number): string[] {
  if (!q) return [];
  const set = new Set(todas);
  const variantes = [q, `${q}S`, q.replace(/S$/, ''), q.replace(/IES$/, 'Y'), q.replace(/ES$/, ''), `THE ${q}`, q.replace(/^THE /, '')];
  const out: string[] = [];
  const add = (k: string) => {
    if (set.has(k) && !out.includes(k)) out.push(k);
  };
  variantes.forEach(add);
  // «SEA, THE SALT», «LORD'S SUPPER», «SUPPER, THE LORD'S»: las que empiezan por la palabra, de más corta a más larga.
  if (out.length < max) {
    todas
      .filter((k) => k.startsWith(`${q},`) || k.startsWith(`${q} `))
      .sort((a, b) => a.length - b.length)
      .slice(0, max)
      .forEach(add);
  }
  if (!out.length) {
    // Y si no, las que la tienen como palabra.
    const re = new RegExp(`(^|[ ,])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[ ,])`);
    todas
      .filter((k) => re.test(k))
      .sort((a, b) => a.length - b.length)
      .slice(0, max)
      .forEach(add);
  }
  return out.slice(0, max);
}

/** Las entradas de Easton y Smith de una palabra en inglés («Gethsemane», «grace»), como mucho «max». Null si no se pudo leer. */
export async function buscarEntradas(request: Request, termino: string, max = 2): Promise<Entrada[] | null> {
  const ix = await getIndice(request);
  if (!ix) return null;
  const claves = candidatas(clave(termino), ix.d, max);
  const out: Entrada[] = [];
  for (const k of claves) {
    const shard = await json<Record<string, Fila>>(request, `d/${letra(k)}.json.gz`);
    const fila = shard?.[k];
    if (fila) out.push({ clave: k, easton: fila[0], smith: fila[1], refs: fila[2] });
  }
  return out;
}

/** El tema de Nave de una palabra en inglés («prayer»). Si solo remite a otro («See CARE»), el otro. */
export async function buscarTema(request: Request, termino: string): Promise<Tema | null | undefined> {
  const ix = await getIndice(request);
  if (!ix) return null;
  let k = candidatas(clave(termino), ix.n, 1)[0];
  for (let saltos = 0; k && saltos < 2; saltos++) {
    const shard = await json<Record<string, LineaTema[]>>(request, `n/${letra(k)}.json.gz`);
    const lineas = shard?.[k];
    if (!lineas) return undefined;
    const conCitas = lineas.some(([, , refs]) => refs.length);
    const ver = lineas.map(([, t]) => t.match(/^See (?:also )?([A-Z][A-Z ,'-]+)/)?.[1]?.split(',')[0].trim()).find(Boolean);
    if (conCitas || !ver || !ix.n.includes(ver)) return { clave: k, lineas };
    k = ver;
  }
  return undefined;
}

type NamedBook = { id: string; name: string };

/** «luk.22.39» → «Lucas 22:39»; «num.17» (capítulo entero) → «Números 17». */
export function etiqueta(ref: string, books: NamedBook[]): string {
  const [b, c, v] = ref.split('.');
  if (v === undefined) return `${books.find((x) => x.id === b)?.name ?? b} ${c}`;
  return formatRef(ref, books);
}

/** Los párrafos de una entrada. Sus citas («Prov. 1:9») van en inglés: la IA las explica en español. */
export function partes(texto: string): string[] {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** La entrada de los diccionarios con esa clave exacta, o undefined. Null si no se pudo leer. */
export async function entrada(request: Request, k: string): Promise<Entrada | null | undefined> {
  const shard = await json<Record<string, Fila>>(request, `d/${letra(k)}.json.gz`);
  if (!shard) return null;
  const fila = shard[k];
  return fila ? { clave: k, easton: fila[0], smith: fila[1], refs: fila[2] } : undefined;
}

/** El tema de Nave con esa clave exacta, o undefined. Null si no se pudo leer. */
export async function tema(request: Request, k: string): Promise<Tema | null | undefined> {
  const shard = await json<Record<string, LineaTema[]>>(request, `n/${letra(k)}.json.gz`);
  if (!shard) return null;
  return shard[k] ? { clave: k, lineas: shard[k] } : undefined;
}
