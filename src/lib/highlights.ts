import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { cambio, registrar } from './sincronia';

// Versículos resaltados, guardados en el dispositivo (y en la cuenta, si hay una). Clave «libro.capítulo.versículo» (numeración RV1909).

export type HighlightColor = 'amarillo' | 'verde' | 'azul' | 'rosa';

/** Tonos translúcidos: se leen bien sobre el fondo claro, sepia y oscuro. */
export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  amarillo: 'rgba(250, 204, 21, 0.38)',
  verde: 'rgba(74, 222, 128, 0.32)',
  azul: 'rgba(96, 165, 250, 0.32)',
  rosa: 'rgba(244, 114, 182, 0.32)',
};

const KEY = 'resaltados';

type Store = Record<string, { color: HighlightColor; at: number }>;

let state: Store = {};
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw);
    })
    .catch(() => {})
    .then(() => listeners.forEach((l) => l()));
  return loaded;
}

const key = (book: string, chapter: number, verse: number) => `${book}.${chapter}.${verse}`;

/** Pone o quita (color null) el resaltado de un versículo. */
export async function setHighlight(book: string, chapter: number, verse: number, color: HighlightColor | null) {
  await load();
  const next = { ...state };
  if (color) next[key(book, chapter, verse)] = { color, at: Date.now() };
  else delete next[key(book, chapter, verse)];
  write(next);
  cambio();
}

function write(next: Store) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

registrar<Store>({
  nombre: 'resaltados',
  leer: () => load().then(() => state),
  escribir: write,
  partir: (s) => s,
  unir: (entradas) => entradas as Store,
  hora: (v) => (v as Store[string]).at,
});

/** Colores de los versículos resaltados del capítulo, por número de versículo. */
export function useChapterHighlights(book: string, chapter: number): Record<number, HighlightColor> {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  const prefix = `${book}.${chapter}.`;
  const out: Record<number, HighlightColor> = {};
  for (const [k, v] of Object.entries(state)) if (k.startsWith(prefix)) out[Number(k.slice(prefix.length))] = v.color;
  return out;
}

/** El color con que está resaltado un versículo, si lo está. */
export function highlightOf(book: string, chapter: number, verse: number): HighlightColor | null {
  return state[key(book, chapter, verse)]?.color ?? null;
}

/** Todos los resaltados, para la lista «Mis resaltados y notas». */
export function useAllHighlights(): Store {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
