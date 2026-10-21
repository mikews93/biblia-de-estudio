import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { cambio, registrar } from './sincronia';

// Notas personales en los versículos: nadie más las ve. Se guardan en el dispositivo y, si hay cuenta, en ella.
// (Las notas que se comparten con un grupo viven en Comunidades.) Clave «libro.capítulo.versículo».

export type MyNote = { text: string; created: number; updated: number };

const KEY = 'notas';

let state: Record<string, MyNote> = {};
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

export const noteKey = (book: string, chapter: number, verse: number) => `${book}.${chapter}.${verse}`;

export function parseNoteKey(key: string) {
  const [book, chapter, verse] = key.split('.');
  return { book, chapter: Number(chapter), verse: Number(verse) };
}

/** Guarda la nota del versículo; un texto vacío la borra. */
export async function setNote(book: string, chapter: number, verse: number, text: string) {
  await load();
  const k = noteKey(book, chapter, verse);
  const next = { ...state };
  const clean = text.trim();
  if (clean) next[k] = { text: clean, created: state[k]?.created ?? Date.now(), updated: Date.now() };
  else delete next[k];
  write(next);
  cambio();
}

function write(next: Record<string, MyNote>) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

registrar<Record<string, MyNote>>({
  nombre: 'notas',
  leer: () => load().then(() => state),
  escribir: write,
  partir: (s) => s,
  unir: (entradas) => entradas as Record<string, MyNote>,
  hora: (v) => (v as MyNote).updated,
});

export function useNotes(): Record<string, MyNote> {
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

/** Notas del capítulo, por número de versículo. */
export function useChapterNotes(book: string, chapter: number): Record<number, MyNote> {
  const all = useNotes();
  const prefix = `${book}.${chapter}.`;
  const out: Record<number, MyNote> = {};
  for (const [k, v] of Object.entries(all)) if (k.startsWith(prefix)) out[Number(k.slice(prefix.length))] = v;
  return out;
}
