import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Turn } from './estudio';
import { cambio, registrar } from './sincronia';

// Las preguntas que cada persona le hace a la IA en el estudio, con sus respuestas: nadie más las ve. Se guardan
// en el dispositivo y, si hay cuenta, en ella (privadas, como las notas). El estudio del pasaje es el mismo para todos (se guarda en el servidor);
// aquí va la conversación entera para volver a verla al abrir el estudio otra vez.

const KEY = 'mis-preguntas';
/** Conversaciones que se guardan como mucho; al pasarse se olvidan las más antiguas. */
export const LIMIT = 120;

type Entry = { turns: Turn[]; updated: number };

let state: Record<string, Entry> = {};
let loaded: Promise<void> | null = null;
let stamp = 0;

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') state = parsed;
    })
    .catch(() => {});
  return loaded;
}

/** Clave de una conversación: modo, pasaje y, en «¿Por qué esta palabra?», la palabra. */
export const conversationKey = (enfoque: string, book: string, chapter: number, verse?: number, word?: number) =>
  [enfoque, book, chapter, verse ?? '', word ?? ''].join(':');

const asked = (turns: Turn[]) => turns.some((t) => t.role === 'user');

/** La conversación guardada (el estudio y lo que la persona preguntó), o null si no preguntó nada aquí. */
export async function savedConversation(key: string): Promise<Turn[] | null> {
  await load();
  const turns = state[key]?.turns;
  return turns && asked(turns) ? turns : null;
}

/** Guarda la conversación si tiene alguna pregunta; sin preguntas no hay nada propio que guardar. */
export async function saveConversation(key: string, turns: Turn[]) {
  await load();
  const next = { ...state };
  if (asked(turns)) {
    next[key] = { turns: turns.map(({ role, text, sources, pasos }) => ({ role, text, ...(sources?.length ? { sources } : {}), ...(pasos?.length ? { pasos } : {}) })), updated: (stamp = Math.max(Date.now(), stamp + 1)) };
  } else delete next[key];
  const keys = Object.keys(next);
  if (keys.length > LIMIT) {
    keys
      .sort((a, b) => next[a].updated - next[b].updated)
      .slice(0, keys.length - LIMIT)
      .forEach((k) => delete next[k]);
  }
  state = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  cambio();
}

registrar<Record<string, Entry>>({
  nombre: 'preguntas',
  leer: () => load().then(() => state),
  escribir: (next) => {
    state = next;
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  },
  partir: (s) => s,
  unir: (entradas) => entradas as Record<string, Entry>,
  hora: (v) => (v as Entry).updated,
});

/** Borra las preguntas de un pasaje; el estudio general sigue ahí. */
export const forgetConversation = (key: string) => saveConversation(key, []);
