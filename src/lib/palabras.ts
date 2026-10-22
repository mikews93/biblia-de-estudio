// La historia de una palabra: palabras clave del hebreo y del griego (jésed, ágape, shalóm…) seguidas por toda la
// Biblia. El catálogo está en palabras.json (lo lee también pipeline/build_data.py) y agrupa cada palabra hebrea con
// la griega del mismo tema. Las apariciones salen de la concordancia (concordance/<Strong>.json); el relato y el
// pódcast los prepara la IA en /api/estudiar con «palabra». Sin dependencias de React Native.

import catalogo from './palabras.json';
import type { Use } from './concordancia';

export type Palabra = {
  id: string;
  /** Transliteración en español, con su acento: «jésed». */
  nombre: string;
  original: string;
  /** Números de Strong (con la acepción de STEPBible) que se cuentan como esta palabra. */
  strongs: string[];
  resumen: string;
};
export type Tema = { tema: string; palabras: Palabra[] };
export type PalabraEnTema = Palabra & { tema: string; hebreo: boolean; pareja: Palabra | null };

export const TEMAS = catalogo as Tema[];

export const PALABRAS: PalabraEnTema[] = TEMAS.flatMap(({ tema, palabras }) =>
  palabras.map((p) => ({
    ...p,
    tema,
    hebreo: p.strongs[0].startsWith('H'),
    pareja: palabras.find((o) => o.id !== p.id) ?? null,
  })),
);

const BY_ID = new Map(PALABRAS.map((p) => [p.id, p]));
const BY_STRONG = new Map(PALABRAS.flatMap((p) => p.strongs.map((s) => [s, p] as const)));

export const palabraPorId = (id: string | undefined | null) => (id ? (BY_ID.get(id.toLowerCase()) ?? null) : null);

/** La palabra del catálogo a la que pertenece un número de Strong («G0026»), si la hay. */
export const palabraDeStrong = (strong: string | null | undefined) => (strong ? (BY_STRONG.get(strong) ?? null) : null);

export const palabrasHref = () => '/palabras' as const;
export const palabraHref = (id: string) => `/palabras/${id}` as const;
export const palabraPodcastHref = (id: string) => `/palabras/${id}/podcast` as const;

/** Clave del pódcast grabado de una palabra en el reproductor y en /api/podcast-grabado. */
export const palabraAudioId = (id: string) => `palabra:${id}`;

/** Una palabra distinta cada semana (de lunes a domingo), la misma para todos. */
export function palabraDeLaSemana(date = new Date()): PalabraEnTema {
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000 + 3) / 7);
  return PALABRAS[((day % PALABRAS.length) + PALABRAS.length) % PALABRAS.length];
}

/** Junta las apariciones de los números de Strong de una palabra (cada aparición está en uno solo), en el orden de la Biblia. */
export function unirApariciones(lists: Use[][], order: Map<string, number>): Use[] {
  const pos = (ref: string) => {
    const [b, c, v] = ref.split('.');
    return (order.get(b) ?? 99) * 1e6 + Number(c) * 1e3 + Number(v);
  };
  // sort es estable: dentro de un versículo se mantiene el orden de las palabras
  return lists.flat().sort((a, b) => pos(a[0]) - pos(b[0]));
}

/** Una de las 66 columnas del recorrido por la Biblia: cuántas veces aparece la palabra en cada libro. */
export type Columna = { id: string; count: number; at: boolean };

export function recorrido(uses: Use[], books: { id: string; testament: 'AT' | 'NT' }[]): Columna[] {
  const counts = new Map<string, number>();
  for (const [ref] of uses) {
    const b = ref.split('.')[0];
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return books.map((b) => ({ id: b.id, count: counts.get(b.id) ?? 0, at: b.testament === 'AT' }));
}

// ---------------------------------------------------------------- el relato

/** Partes del relato que escribe la IA: qué significa, los momentos del recorrido, el hilo y las preguntas. */
export type Relato = {
  significado: string | null;
  momentos: { titulo: string; texto: string }[];
  hilo: string | null;
  preguntas: string[];
};

const SIGNIFICADO = /^(qu[eé] significa|en pocas palabras)/i;
const HILO = /^(el hilo|hilo)/i;
const PREGUNTAS = /^para pensar/i;

/** Divide el markdown del relato por sus títulos «## ». Lo que llega antes del primer título se ignora. */
export function partirRelato(text: string): Relato {
  const relato: Relato = { significado: null, momentos: [], hilo: null, preguntas: [] };
  const parts = text.split(/^#{2,3} +/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const titulo = (nl < 0 ? part : part.slice(0, nl)).trim();
    const body = nl < 0 ? '' : part.slice(nl + 1).trim();
    if (SIGNIFICADO.test(titulo)) relato.significado = body;
    else if (HILO.test(titulo)) relato.hilo = body;
    else if (PREGUNTAS.test(titulo))
      relato.preguntas = body
        .split('\n')
        .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
        .filter(Boolean);
    else relato.momentos.push({ titulo, texto: body });
  }
  return relato;
}

/** La primera cita de un texto que lleva a un versículo: el pasaje del momento. */
export function primeraReferencia(text: string, sources: { n: number; ref?: string; label: string }[]) {
  for (const m of text.matchAll(/⟦(\d+)⟧/g)) {
    const s = sources.find((x) => x.n === Number(m[1]));
    if (s?.ref && !/^(Léxico|Concordancia)/.test(s.label)) return s;
  }
  return null;
}
