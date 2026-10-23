// Cliente de /api/buscar: búsqueda de pasajes por idea, comprobada contra el texto de la versión que lee la persona.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { aiDenied, aiHeaders } from './comunidad';
import { parseRef } from './refs';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

/** «version»: la versión de «text». Con una versión con derechos llega en RV1909 y la pantalla la cambia (ver withVersion). */
export type IdeaResult = { ref: string; label: string; text: string; reason: string; version: string };

export async function searchByIdea(
  query: string,
  version: string,
  signal?: AbortSignal,
): Promise<{ results: IdeaResult[]; note?: string }> {
  const res = await fetch(`${API}/api/buscar`, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify({ query, version }),
    signal,
  });
  if (res.status === 401) aiDenied();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `No se pudo hacer la búsqueda (${res.status})`);
  return body;
}

// Búsquedas recientes, guardadas solo en este dispositivo
const RECENT_KEY = 'busquedas';
const MAX_RECENT = 6;

export async function getRecent(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(RECENT_KEY).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function addRecent(text: string): Promise<string[]> {
  const t = text.trim();
  const list = (await getRecent()).filter((r) => r.toLowerCase() !== t.toLowerCase());
  const next = [t, ...list].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

export async function clearRecent() {
  await AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
}

/**
 * Los resultados con el texto de una versión con derechos, pedido en el momento (su texto nunca pasa por la IA).
 * Bíblica pide no mostrar más de 25 versículos a la vez: los que no caben se quedan en la versión que llegó.
 */
export async function withVersion(
  results: IdeaResult[],
  version: string,
  getVerses: (book: string, chapter: number) => Promise<[number, string, ...unknown[]][]>,
  max = 25,
): Promise<IdeaResult[]> {
  let room = max;
  const plan = results.map((r) => {
    const { start, end } = parseRef(r.ref);
    const count = end.verse - start.verse + 1;
    if (r.version === version || count > room) return null;
    room -= count;
    return { start, last: end.verse };
  });
  return Promise.all(
    results.map(async (r, i) => {
      const p = plan[i];
      if (!p) return r;
      const verses = await getVerses(p.start.book, p.start.chapter).catch(() => null);
      const picked = verses?.filter(([n]) => n >= p.start.verse && n <= p.last) ?? [];
      if (!picked.length) return r;
      return { ...r, text: picked.map(([, t]) => t).join(' '), version };
    }),
  );
}
