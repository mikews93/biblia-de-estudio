// Cliente de /api/buscar: búsqueda de pasajes por idea, comprobada contra el texto de la RV1909.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { aiDenied, aiHeaders } from './comunidad';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type IdeaResult = { ref: string; label: string; text: string; reason: string };

export async function searchByIdea(query: string, signal?: AbortSignal): Promise<{ results: IdeaResult[]; note?: string }> {
  const res = await fetch(`${API}/api/buscar`, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify({ query }),
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
