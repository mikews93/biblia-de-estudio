// Comparar versiones: qué versiones se ponen lado a lado y qué palabras cambian de una a otra.

import type { Verse, Version } from './data';

/** Versiones que se comparan si no se ha elegido ninguna: una clásica, una moderna y una sencilla. */
export const DEFAULT_COMPARE = ['rv1909', 'rvg', 'pdt', 'bes'];
export const MAX_COMPARE = 6;

/**
 * Versiones que se comparan, en el orden de la lista de versiones y solo las que existen. La que se está
 * leyendo va siempre primero: es la base contra la que se marcan las diferencias.
 */
export function compareList(chosen: string[] | undefined, reading: string, versions: Version[]): Version[] {
  const ids = new Set(chosen?.length ? chosen : DEFAULT_COMPARE);
  const base = versions.find((v) => v.id === reading);
  const rest = versions.filter((v) => v.id !== reading && ids.has(v.id));
  return (base ? [base, ...rest] : rest).slice(0, MAX_COMPARE);
}

/** Pone o quita una versión de la comparación (nunca deja menos de una, ni más de MAX_COMPARE). */
export function toggleCompare(chosen: string[] | undefined, id: string): string[] {
  const list = chosen?.length ? chosen : DEFAULT_COMPARE;
  if (list.includes(id)) return list.length > 1 ? list.filter((x) => x !== id) : list;
  return list.length >= MAX_COMPARE ? list : [...list, id];
}

/** El versículo n de un capítulo; si la versión une versículos («9-20»), el tramo que lo contiene. */
export function findVerse(verses: Verse[], n: number): Verse | undefined {
  return (
    verses.find(([v]) => v === n) ??
    verses.find(([v, , label]) => {
      const end = Number(label?.split('-')[1]);
      return label && v <= n && n <= end;
    })
  );
}

export type Piece = { text: string; changed: boolean };

/** Palabra sin tildes, mayúsculas ni signos: «Él,» y «él» cuentan como la misma. */
const norm = (w: string) =>
  w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Divide `text` en tramos y marca las palabras que no están en `base`, en el mismo orden (subsecuencia común más
 * larga). Los espacios van pegados a la palabra anterior para que el texto se pinte igual que el original.
 */
export function diffWords(base: string, text: string): Piece[] {
  const a = base.split(/\s+/).filter(Boolean).map(norm);
  const words = text.match(/\S+\s*/g) ?? [];
  const b = words.map(norm);
  // Tabla de la subsecuencia común más larga, de atrás hacia delante
  const dp = Array.from({ length: b.length + 1 }, () => new Uint16Array(a.length + 1));
  for (let i = b.length - 1; i >= 0; i--)
    for (let j = a.length - 1; j >= 0; j--)
      dp[i][j] = b[i] && b[i] === a[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const pieces: Piece[] = [];
  const push = (word: string, changed: boolean) => {
    const last = pieces[pieces.length - 1];
    if (last && last.changed === changed) last.text += word;
    else pieces.push({ text: word, changed });
  };
  let i = 0;
  let j = 0;
  while (i < b.length) {
    if (!b[i]) push(words[i++], false); // un signo suelto («—»)
    else if (j < a.length && b[i] === a[j]) {
      push(words[i++], false);
      j++;
    } else if (j < a.length && dp[i][j + 1] >= dp[i + 1][j]) j++;
    else push(words[i++], true);
  }
  return pieces;
}

/** Cuántas palabras de `text` no están en `base` (para decir «casi igual» o «otras palabras»). */
export const changedShare = (pieces: Piece[]) => {
  const count = (p: Piece[]) => p.reduce((s, x) => s + (x.text.match(/\S+/g)?.length ?? 0), 0);
  const total = count(pieces);
  return total ? count(pieces.filter((p) => p.changed)) / total : 0;
};
