// Notificaciones push en la web instalada (PWA): recordatorio diario de lectura, tarjetas pendientes, el día
// del desafío de temporada y avisos de la comunidad. El servidor es /api/notificaciones; el service worker
// (public/sw.js) muestra cada aviso y abre la pantalla que corresponde al tocarlo.
//
// Lo que la persona lee, sus tarjetas y sus planes viven en el dispositivo. Para que el recordatorio diga algo
// útil («Juan 4 te espera», «5 tarjetas para repasar»), la app manda un resumen (buildEstado) cada vez que cambia.
//
// En iPhone y iPad solo funcionan con la app agregada a la pantalla de inicio (iOS 16.4 o posterior).
//
// En la app nativa la suscripción es un token de Expo (src/lib/pushNativo.native.ts) y el resto es igual. El
// despertador no va al servidor: lo hace sonar el propio teléfono (src/lib/alarma.native.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { EstadoAvisos, HORA_POR_DEFECTO } from './avisosTexto';
import { DESPERTADOR_POR_DEFECTO, Despertador } from './despertarTexto';
import { sessionKey } from './comunidad';
import { Book } from './data';
import { MyPlan, planDays, planDef } from './planes';
import { PUSH_NATIVO, tokenNativo } from './pushNativo';
import { chapterHref } from './routes';
import { Card } from './tarjetas';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const KEY = 'avisos';

export type Tipo = 'lectura' | 'tarjetas' | 'reto' | 'comunidad';

export type Ajustes = {
  /** La dirección de la suscripción de este dispositivo, o null si están apagadas. */
  endpoint: string | null;
  /** Minutos desde la medianoche (7:30 → 450). */
  hora: number;
  avisos: Record<Tipo, boolean>;
  /** El despertador (src/lib/despertar.ts). En la web lo manda el servidor; en la app nativa, el teléfono. */
  despertar: Despertador;
  /** La persona cerró la invitación de la pantalla Hoy. */
  invitacionVista?: boolean;
};

const DEFAULTS: Ajustes = {
  endpoint: null,
  hora: HORA_POR_DEFECTO,
  avisos: { lectura: true, tarjetas: true, reto: true, comunidad: true },
  despertar: DESPERTADOR_POR_DEFECTO,
};

let state: Ajustes = DEFAULTS;
let loaded: Promise<void> | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Ajustes>;
        state = {
          ...DEFAULTS,
          ...saved,
          avisos: { ...DEFAULTS.avisos, ...saved.avisos },
          despertar: { ...DEFAULTS.despertar, ...saved.despertar },
        };
      }
    })
    .catch(() => {})
    .then(() => {
      isLoaded = true;
      listeners.forEach((l) => l());
    });
  return loaded;
}

function set(patch: Partial<Ajustes>) {
  state = { ...state, ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

// ——— Qué puede hacer este dispositivo ———

export type Soporte =
  /** Puede recibirlas. */
  | 'si'
  /** iPhone o iPad en Safari: hay que agregar la app a la pantalla de inicio. */
  | 'ios-instalar'
  /** iPhone o iPad instalada, pero con un iOS anterior a 16.4. */
  | 'ios-viejo'
  /** El navegador no las admite. */
  | 'no'
  /** App nativa sin el projectId de EAS: aún no puede pedir su dirección. */
  | 'nativo';

type Nav = { userAgent: string; maxTouchPoints?: number; standalone?: boolean };

/** iPhone, iPad o iPod (los iPad nuevos se presentan como Mac con pantalla táctil). */
export const isIOS = (nav: Nav) => /iPad|iPhone|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1);

export function soporte(): Soporte {
  if (Platform.OS !== 'web') return PUSH_NATIVO ? 'si' : 'nativo';
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'no';
  const ios = isIOS(navigator as Nav);
  const standalone = (navigator as Nav).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  const push = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (ios && !standalone) return 'ios-instalar';
  if (!push) return ios ? 'ios-viejo' : 'no';
  return 'si';
}

export const permiso = (): NotificationPermission =>
  typeof Notification === 'undefined' ? 'default' : Notification.permission;

// ——— Servidor ———

async function api<T = Record<string, unknown>>(accion: string, body: Record<string, unknown> = {}): Promise<T> {
  const llave = await sessionKey();
  let res: Response;
  try {
    res = await fetch(`${API}/api/notificaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
      body: JSON.stringify({ accion, ...body }),
    });
  } catch {
    throw new Error('No hay conexión. Para cambiar las notificaciones hace falta internet.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? `Algo falló (${res.status})`), { status: res.status });
  return json as T;
}

const zona = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

function keyBytes(base64url: string) {
  const raw = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
};

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

let lastEstado: EstadoAvisos = {};

type Suscripcion = { endpoint?: string; keys?: Record<string, string> };

async function save(sub: Suscripcion, next: Ajustes) {
  await api('guardar', {
    suscripcion: sub,
    zona: zona(),
    hora: next.hora,
    avisos: next.avisos,
    // En la app nativa el despertador suena desde el teléfono: el servidor no debe mandarlo otra vez.
    despertar: Platform.OS === 'web' ? next.despertar : { ...next.despertar, activo: false },
    estado: lastEstado,
  });
}

/** Pide permiso, suscribe este dispositivo y guarda las preferencias. */
export async function activar() {
  await load();
  if (soporte() !== 'si') throw new Error('Este dispositivo no puede recibir notificaciones de la web.');
  if (Platform.OS !== 'web') {
    const token = await tokenNativo(true);
    if (!token) throw new Error('Este teléfono no dio una dirección para las notificaciones.');
    await save({ endpoint: token }, state);
    set({ endpoint: token });
    return;
  }
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    throw new Error(
      result === 'denied'
        ? 'Las notificaciones están bloqueadas para esta página. Permítelas en los ajustes del navegador.'
        : 'No diste permiso para las notificaciones.',
    );
  }
  const json = (await suscribir()).toJSON();
  await save(json, state);
  set({ endpoint: json.endpoint ?? null });
}

/** La suscripción push de este navegador con la clave del servidor (la rehace si era de otra clave). */
async function suscribir() {
  const { clave } = await api<{ clave: string }>('clave');
  const key = keyBytes(clave);
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  // Una suscripción hecha con otra clave del servidor ya no sirve: se rehace.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  return sub ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/**
 * Al abrir la app: comprueba que las notificaciones sigan funcionando en este dispositivo. Reinstalar la app o
 * borrar sus datos puede quitar la suscripción del navegador o los ajustes guardados aquí; con el permiso aún
 * concedido, se arregla sola. Si el permiso se perdió, se apagan y Hoy vuelve a invitar a activarlas.
 */
export async function revisar() {
  await load();
  if (soporte() !== 'si') return;
  if (Platform.OS !== 'web') return revisarNativo();
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = (await reg?.pushManager.getSubscription()) ?? null;
  const granted = permiso() === 'granted';
  if (!state.endpoint) {
    // Se borraron los ajustes de la app, pero el navegador conserva la suscripción: se recuperan del servidor.
    if (!sub || !granted) return;
    const r = await api<{
      existe: boolean;
      hora?: number;
      avisos?: Record<Tipo, boolean>;
      despertar?: { hora: number; dias: number } | null;
    }>('leer', { endpoint: sub.endpoint });
    if (r.existe) {
      set({
        endpoint: sub.endpoint,
        hora: r.hora ?? state.hora,
        avisos: { ...state.avisos, ...r.avisos },
        despertar: r.despertar ? { ...state.despertar, ...r.despertar, activo: true } : state.despertar,
      });
    }
    return;
  }
  if (sub?.endpoint === state.endpoint) return;
  const old = state.endpoint;
  if (!granted) {
    set({ endpoint: null, invitacionVista: false });
  } else {
    const json = (await suscribir()).toJSON();
    await save(json, state);
    set({ endpoint: json.endpoint ?? null });
  }
  if (old !== state.endpoint) await api('quitar', { endpoint: old }).catch(() => {});
}

/** Lo mismo en la app nativa: si el permiso se quitó se apagan, y si cambió el token se guarda el nuevo. */
async function revisarNativo() {
  if (!state.endpoint) return;
  const old = state.endpoint;
  const token = await tokenNativo(false);
  if (token === old) return;
  if (!token) {
    set({ endpoint: null, invitacionVista: false });
  } else {
    await save({ endpoint: token }, state);
    set({ endpoint: token });
  }
  await api('quitar', { endpoint: old }).catch(() => {});
}

export async function desactivar() {
  await load();
  const endpoint = state.endpoint;
  set({ endpoint: null });
  if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe().catch(() => {});
  }
  if (endpoint) await api('quitar', { endpoint }).catch(() => {});
}

/** Cambia la hora, qué avisos llegan o el despertador. Con las notificaciones activas, lo guarda también en el servidor. */
export async function cambiar(patch: { hora?: number; avisos?: Partial<Record<Tipo, boolean>>; despertar?: Partial<Despertador> }) {
  await load();
  const prev = state;
  const next = { ...state, ...patch, avisos: { ...state.avisos, ...patch.avisos }, despertar: { ...state.despertar, ...patch.despertar } };
  set(next);
  if (!next.endpoint) return;
  try {
    await resave(next);
  } catch (e) {
    set({ hora: prev.hora, avisos: prev.avisos, despertar: prev.despertar });
    throw e;
  }
}

/** Vuelve a mandar la suscripción (al cambiar preferencias, o al entrar o salir de la cuenta). */
async function resave(next = state) {
  if (Platform.OS !== 'web') {
    const token = await tokenNativo(false);
    if (!token) {
      set({ endpoint: null });
      throw new Error('Las notificaciones están apagadas para Zarza. Permítelas en los ajustes del teléfono.');
    }
    if (token !== next.endpoint) set({ endpoint: token });
    return save({ endpoint: token }, next);
  }
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) {
    set({ endpoint: null });
    throw new Error('Este navegador dio de baja las notificaciones. Vuelve a activarlas.');
  }
  await save(sub.toJSON(), next);
}

export async function probar() {
  await load();
  if (!state.endpoint) throw new Error('Primero activa las notificaciones');
  try {
    await api('probar', { endpoint: state.endpoint });
  } catch (e) {
    if ((e as { status?: number }).status === 410 || (e as { status?: number }).status === 404) set({ endpoint: null });
    throw e;
  }
}

export const cerrarInvitacion = () => load().then(() => set({ invitacionVista: true }));

/** Al entrar o salir de la cuenta: la suscripción se une o se separa de ella (los avisos de comunidad). */
export async function cuentaCambio() {
  await load();
  if (state.endpoint && soporte() === 'si') await resave().catch(() => {});
}

let pending: ReturnType<typeof setTimeout> | null = null;
let sentJson = '';

/** Pone al día el resumen que usa el recordatorio. Espera un momento para juntar varios cambios seguidos. */
export function sincronizar(estado: EstadoAvisos) {
  lastEstado = estado;
  const json = JSON.stringify(estado);
  if (json === sentJson) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(async () => {
    pending = null;
    await load();
    if (!state.endpoint) return;
    try {
      const r = await api<{ existe: boolean }>('estado', { endpoint: state.endpoint, estado });
      sentJson = json;
      // El servidor la borró (el navegador la dio de baja): se vuelve a guardar si aún existe aquí.
      if (!r.existe) await resave().catch(() => set({ endpoint: null }));
    } catch {
      // Sin conexión: se intenta con el próximo cambio.
    }
  }, 1500);
}

export function useAvisos() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { ...state, ready: isLoaded };
}

// ——— El resumen para el recordatorio ———

/** Lo que toca leer: la primera lectura pendiente de un plan a tu ritmo que ya empezó, o donde se quedó. */
export function lecturaPendiente(plans: MyPlan[], books: Book[], last: { book: string; chapter: number } | null, today: string) {
  const plan = plans.find((p) => !p.finished && p.started <= today && !planDef(p.def, books)?.season);
  const nextIdx = plan ? plan.readings.findIndex((_, i) => !plan.done[i]) : -1;
  return plan && nextIdx >= 0 ? (plan.readings[nextIdx] as readonly [string, number]) : last ? ([last.book, last.chapter] as const) : null;
}

/**
 * Lo que el servidor necesita saber: qué toca leer (la siguiente lectura de un plan, o donde se quedó), el último
 * día con lectura, las fechas de repaso de las tarjetas y los días pendientes del desafío de temporada.
 */
export function buildEstado(input: {
  plans: MyPlan[];
  cards: Record<string, Card>;
  days: string[];
  books: Book[];
  last: { book: string; chapter: number } | null;
  today: string;
}): EstadoAvisos {
  const { plans, cards, days, books, last, today } = input;
  const name = (id: string) => books.find((b) => b.id === id)?.name ?? id;
  const estado: EstadoAvisos = {};

  const read = days.filter((d) => d <= today).sort().at(-1);
  if (read) estado.leido = read;

  const active = plans.filter((p) => !p.finished);
  for (const p of active) {
    const def = planDef(p.def, books);
    if (!def?.season) continue;
    const pending = planDays(p, def, null)
      .map((d, i) => ({ ...d, dia: i + 1 }))
      .filter((d) => d.date && d.date >= today && !d.readings.every((i) => p.done[i]))
      .slice(0, 21);
    if (!pending.length) continue;
    estado.reto = {
      titulo: def.title,
      icono: def.icon,
      url: `/planes/${def.id}`,
      dias: pending.map((d) => {
        const [b, c] = p.readings[d.readings[0]];
        return { fecha: d.date!, dia: d.dia, titulo: d.title, lectura: `${name(b)} ${c}` };
      }),
    };
    break;
  }

  const target = lecturaPendiente(plans, books, last, today);
  if (target && books.length) estado.lectura = { titulo: `${name(target[0])} ${target[1]}`, url: chapterHref(target[0], target[1]) };

  const due = Object.values(cards).map((c) => c.due).sort();
  if (due.length) estado.tarjetas = due.slice(0, 500);
  return estado;
}
