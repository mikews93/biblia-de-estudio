// Cliente de /api/buscar: búsqueda de pasajes por idea, comprobada contra el texto de la versión que lee la persona.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { WordIndex } from './buscarPalabras';
import { aiDenied, aiHeaders } from './comunidad';
import { isOnline } from './conexion';
import { type Book, getChapter } from './data';
import { downloadsState, init as initDownloads, textPack } from './descargas';
import { licensedById } from './licenciadas';
import { formatRef, parseRef } from './refs';

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

/**
 * Cómo salió una búsqueda rápida: «semantica» (con internet, por el sentido y las palabras), «palabras» (con internet,
 * pero el servidor no pudo usar el modelo) o «sin-conexion» (en el dispositivo, por palabras, en una versión descargada).
 */
export type QuickMode = 'semantica' | 'palabras' | 'sin-conexion';

/** Sin conexión y sin ninguna versión descargada: no hay dónde buscar. */
export const NOTHING_DOWNLOADED = 'Sin conexión y sin versiones descargadas.';

/**
 * Búsqueda rápida por idea o por palabras recordadas, sin IA ni cuenta. Con internet la hace el servidor (semántica +
 * palabras); sin conexión, o si el servidor no responde, el dispositivo busca por palabras en una versión descargada.
 */
export async function quickSearch(
  query: string,
  version: string,
  books: Book[],
  signal?: AbortSignal,
): Promise<{ results: IdeaResult[]; mode: QuickMode }> {
  const online = isOnline();
  if (online) {
    try {
      const res = await fetch(`${API}/api/buscar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, version, modo: 'rapido' }),
        signal,
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body) return { results: body.results, mode: body.semantica ? 'semantica' : 'palabras' };
      if (res.status === 400 && body?.error) throw new Error(body.error);
    } catch (e) {
      if (signal?.aborted || (e instanceof Error && !(e instanceof TypeError))) throw e;
    }
  }
  try {
    return { results: await searchOffline(query, version, books), mode: 'sin-conexion' };
  } catch (e) {
    // Con internet pero sin respuesta del servidor, y nada descargado: no es un problema de conexión
    if (online && e instanceof Error && e.message === NOTHING_DOWNLOADED) throw new Error('No se pudo hacer la búsqueda. Inténtalo de nuevo.');
    throw e;
  }
}

const indexes = new Map<string, Promise<WordIndex>>();

/** La versión descargada en la que buscar sin conexión: la que se lee si está entera; si no, otra libre descargada. */
export function offlineVersion(version: string, books: Book[]): string | null {
  const { index } = downloadsState();
  const whole = (v: string) => !licensedById(v) && books.length > 0 && books.every((b) => index[textPack(v)]?.includes(b.id));
  if (whole(version)) return version;
  const others = Object.keys(index)
    .filter((p) => p.startsWith('texto:'))
    .map((p) => p.slice('texto:'.length));
  return ['rv1909', ...others].find(whole) ?? null;
}

/** Búsqueda por palabras en el dispositivo. El índice de cada versión se arma una vez (un par de segundos). */
export async function searchOffline(query: string, version: string, books: Book[], limit = 20): Promise<IdeaResult[]> {
  await initDownloads();
  const v = offlineVersion(version, books);
  if (!v) throw new Error(NOTHING_DOWNLOADED);
  let index = indexes.get(v);
  if (!index) {
    index = Promise.all(
      books.flatMap((b) =>
        Array.from({ length: b.chapters }, (_, i) =>
          getChapter(b.id, i + 1, v).then((vs) => vs.map(([n, t]) => ({ ref: `${b.id}.${i + 1}.${n}`, text: t }))),
        ),
      ),
    ).then((chapters) => new WordIndex(chapters.flat()));
    index.catch(() => indexes.delete(v));
    indexes.set(v, index);
  }
  const words = await index;
  return words
    .search(query, limit)
    .map((h) => ({ ref: h.ref, label: formatRef(h.ref, books), text: words.text(h.ref), reason: '', version: v }));
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
