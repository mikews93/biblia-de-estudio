import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

import type { Turn } from './estudio';
import { cambio, registrar } from './sincronia';

// Lo que se estaba haciendo en el Taller, para volver al mismo sitio si la app se cierra: el paso en que iba cada
// mensaje, si el Acompañante estaba abierto y sus conversaciones (Pregúntame, Sugiéreme, Revisa), y en «Desde un
// tema» lo contado, la búsqueda y la maqueta. Se guarda en el dispositivo y, con cuenta, en ella (privado, como el
// resto del Taller). Una entrada por mensaje (su id) y otra para el tema («tema»).

const KEY = 'taller-ia';
/** Turnos que se guardan como mucho por conversación (las más largas pierden los primeros). */
const MAX_TURNOS = 40;
/** El servidor acepta entradas de hasta 200 000 bytes; se deja margen. */
const MAX_BYTES = 180_000;

export type Entrada = {
  /** Conversaciones por pestaña (preguntar, sugerir, revisar; explorar, maqueta). */
  convs?: Record<string, Turn[]>;
  /** Lo demás que la pantalla quiera recordar (el paso, el Acompañante abierto, lo elegido en el tema…). */
  vista?: Record<string, unknown>;
  updated: number;
};

let state: Record<string, Entrada> = {};
let loaded: Promise<void> | null = null;
let stamp = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') state = parsed;
    })
    .catch(() => {});
  return loaded;
}

const escribir = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  return AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
};

/** Guarda ya lo pendiente (al irse la app a segundo plano o cerrarse la pestaña). */
export function guardarYa() {
  if (saveTimer) escribir();
}

/** Solo lo que hace falta de cada turno, y nunca una respuesta vacía a medias. */
export function limpiarTurnos(turns: Turn[]): Turn[] {
  const out = turns
    .filter((t) => t.role === 'user' || t.text || t.pasos?.length)
    .map(({ role, text, sources, pasos, cortada }) => ({
      role,
      text,
      ...(sources?.length ? { sources } : {}),
      ...(pasos?.length ? { pasos } : {}),
      ...(cortada ? { cortada } : {}),
    }));
  return out.slice(-MAX_TURNOS);
}

function recortar(e: Entrada): Entrada {
  let next = e;
  // Si no cabe, se van quitando los turnos más antiguos de la conversación más larga.
  while (JSON.stringify(next).length > MAX_BYTES && next.convs) {
    const [k, turns] = Object.entries(next.convs).sort((a, b) => JSON.stringify(b[1]).length - JSON.stringify(a[1]).length)[0] ?? [];
    if (!k || !turns.length) break;
    next = { ...next, convs: { ...next.convs, [k]: turns.slice(Math.max(1, Math.ceil(turns.length / 4))) } };
  }
  return next;
}

export async function leerTallerIa(clave: string): Promise<Entrada | null> {
  await load();
  return state[clave] ?? null;
}

/** Junta el cambio con lo guardado; las conversaciones y la vista se mezclan por clave. */
export async function guardarTallerIa(clave: string, cambioDe: { convs?: Record<string, Turn[]>; vista?: Record<string, unknown> }) {
  await load();
  const antes = state[clave];
  const convs = cambioDe.convs
    ? Object.fromEntries(Object.entries({ ...antes?.convs, ...cambioDe.convs }).map(([k, t]) => [k, limpiarTurnos(t)]).filter(([, t]) => t.length))
    : antes?.convs;
  const entrada = recortar({
    ...(convs && Object.keys(convs).length ? { convs } : {}),
    ...(cambioDe.vista || antes?.vista ? { vista: { ...antes?.vista, ...cambioDe.vista } } : {}),
    updated: (stamp = Math.max(Date.now(), stamp + 1)),
  });
  if (JSON.stringify({ ...entrada, updated: 0 }) === JSON.stringify({ ...antes, updated: 0 })) return;
  state = { ...state, [clave]: entrada };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(escribir, 500);
  cambio();
}

export async function borrarTallerIa(clave: string) {
  await load();
  if (!state[clave]) return;
  const next = { ...state };
  delete next[clave];
  state = next;
  await escribir();
  cambio();
}

registrar<Record<string, Entrada>>({
  nombre: 'taller-ia',
  leer: () => load().then(() => state),
  escribir: (next) => {
    state = next;
    escribir();
  },
  partir: (s) => s,
  unir: (entradas) => entradas as Record<string, Entrada>,
  hora: (v) => (v as Entrada).updated,
});

// Al cerrar la app (o la pestaña) no se espera al temporizador.
const alSalir = new Set<() => void>([guardarYa]);
export const alCerrarLaApp = (fn: () => void) => alSalir.add(fn);
const salir = () => alSalir.forEach((fn) => fn());
AppState.addEventListener?.('change', (s) => s !== 'active' && salir());
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('pagehide', salir);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && salir());
}
