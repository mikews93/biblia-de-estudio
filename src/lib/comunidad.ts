// Cliente de /api/comunidades: la cuenta de la persona, sus grupos y lo que comparte en ellos.
// La llave de sesión se guarda en el dispositivo. La app se lee sin cuenta; la cuenta solo hace falta
// para la comunidad y para las funciones con IA (que mandan la misma llave, ver aiHeaders).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { requireConnection } from './conexion';
import { pedirPermisoIa } from './permisoIa';
import { chapterHref as routeToChapter, verseHref } from './routes';

// En web la función vive en el mismo dominio; en el teléfono, en la web publicada.
const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const KEY = 'cuenta';

export type Usuario = {
  id: string;
  nombre: string;
  correo: string | null;
  foto?: string | null;
  bio?: string | null;
  iglesia?: string | null;
  ciudad?: string | null;
  /** Si tiene contraseña: una cuenta creada con Facebook puede tener correo y no contraseña. */
  conClave?: boolean;
  /** El nombre de la cuenta de Facebook conectada, o null. */
  facebook?: string | null;
};
export type TipoGrupo = 'iglesia' | 'celula' | 'familia' | 'amigos';
export type Lectura = {
  libro: string;
  nombre: string;
  capitulos: number[];
  /** «descanso»: un día sin lectura dentro de un reto (los domingos de Cuaresma). */
  estado: 'pronto' | 'activo' | 'descanso' | 'terminado';
  dia: number;
  total: number;
  /** Si el grupo sigue un reto de temporada, su id con el año («adviento-2026»). */
  reto?: string | null;
  /** En un reto que aún no empieza o en un día de descanso: el capítulo que sigue. */
  siguiente?: number;
};
export type ResumenGrupo = {
  id: string;
  nombre: string;
  tipo: TipoGrupo;
  miembros: number;
  leyeronHoy: number;
  lectura: Lectura | null;
};
export type Plan = { libro: string | null; inicio: string | null; porDia: number; reto?: string | null };
export type Miembro = { id: string; nombre: string; foto: string | null; racha?: number; servicio?: number; rol: 'admin' | 'miembro'; leyoHoy: boolean; soyYo: boolean };
export type Grupo = {
  id: string;
  nombre: string;
  tipo: TipoGrupo;
  codigo: string;
  plan: Plan;
  lectura: Lectura | null;
  soyAdmin: boolean;
  semana: { dias: number; meta: number };
  miembros: Miembro[];
};
export type Nota = {
  id: string;
  grupo: string;
  grupoNombre: string;
  libro: string;
  capitulo: number;
  versiculo: number;
  texto: string;
  creado: string;
  autor: string;
  mia: boolean;
};
export type Peticion = {
  id: string;
  texto: string;
  respondida: boolean;
  creado: string;
  autor: string;
  mia: boolean;
  orando: number;
  yoOrando: boolean;
};

export type Guia = {
  id: string;
  titulo: string;
  pasaje: string | null;
  texto: string;
  creado: string;
  autor: string;
  mia: boolean;
};

export const TIPOS: { tipo: TipoGrupo; label: string }[] = [
  { tipo: 'iglesia', label: 'Iglesia' },
  { tipo: 'celula', label: 'Célula' },
  { tipo: 'familia', label: 'Familia' },
  { tipo: 'amigos', label: 'Amigos' },
];

export const tipoLabel = (t: TipoGrupo) => TIPOS.find((x) => x.tipo === t)?.label ?? 'Grupo';

/** Enlace a un capítulo o versículo del lector, con las rutas en español. */
export const chapterHref = (book: string, chapter: number, verse?: number) =>
  verse ? verseHref(book, chapter, verse) : routeToChapter(book, chapter);

/** Enlace de invitación que se comparte fuera de la app. */
export function inviteUrl(codigo: string) {
  const origin = typeof location !== 'undefined' ? location.origin : (API || 'https://biblia.migueblanco.com');
  return `${origin}/unirse/${codigo}`;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** La iglesia anfitriona de la persona («Zarza para Iglesias», api/_iglesias.ts). */
export type IglesiaAnfitriona = { nombre: string; codigo: string; lampara: number };

// Estado de la cuenta compartido por todas las pantallas, como el progreso de lectura.
type Account = {
  llave: string | null;
  usuario: Usuario | null;
  grupos: ResumenGrupo[] | null;
  iglesia?: IglesiaAnfitriona | null;
  /** Si la persona cuida Zarza (/cuidar): lo decide el servidor con CUIDADORES. */
  cuidador?: boolean;
};
let account: Account = { llave: null, usuario: null, grupos: null };
let loaded: Promise<void> | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();

function set(patch: Partial<Account>) {
  account = { ...account, ...patch };
  listeners.forEach((l) => l());
}

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw) as Pick<Account, 'llave' | 'usuario'>;
        set({ llave: saved.llave, usuario: saved.usuario });
      }
    })
    .catch(() => {})
    .then(() => {
      isLoaded = true;
      listeners.forEach((l) => l());
    });
  return loaded;
}

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify({ llave: account.llave, usuario: account.usuario })).catch(() => {});
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T = Record<string, unknown>>(accion: string, body: Record<string, unknown> = {}): Promise<T> {
  await load();
  let res: Response;
  try {
    res = await fetch(`${API}/api/comunidades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(account.llave ? { Authorization: `Bearer ${account.llave}` } : {}),
      },
      body: JSON.stringify({ accion, hoy: today(), ...body }),
    });
  } catch {
    throw new ApiError('No hay conexión. Las comunidades necesitan internet.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // La sesión ya no vale (se cerró o se borró la cuenta): se olvida en este dispositivo.
    if (res.status === 401 && account.llave) {
      set({ llave: null, usuario: null, grupos: null, iglesia: null, cuidador: false });
      save();
    }
    throw new ApiError(json.error ?? `Algo falló (${res.status})`, res.status);
  }
  return json as T;
}

/** Guarda en el dispositivo la cuenta que devolvió el servidor tras un cambio del perfil. */
export function updateUser(usuario: Usuario) {
  set({ usuario });
  save();
}

export async function startSession(r: { usuario: Usuario; llave: string }) {
  set({ llave: r.llave, usuario: r.usuario, grupos: null, iglesia: null, cuidador: false });
  save();
  await refreshGroups();
}

export const signUp = async (nombre: string, correo?: string, clave?: string) =>
  startSession(await api('registrarse', { nombre, correo: correo?.trim() || undefined, clave }));
export const signIn = async (correo: string, clave: string) => startSession(await api('entrar', { correo, clave }));

export async function signOut() {
  await api('salirCuenta').catch(() => {});
  set({ llave: null, usuario: null, grupos: null, iglesia: null, cuidador: false });
  save();
}

export async function deleteAccount() {
  await api('borrarCuenta');
  set({ llave: null, usuario: null, grupos: null, iglesia: null, cuidador: false });
  save();
}

export async function protectAccount(correo: string, clave: string) {
  const r = await api<{ usuario: Usuario }>('protegerCuenta', { correo, clave });
  set({ usuario: r.usuario });
  save();
}

export async function rename(nombre: string) {
  const r = await api<{ usuario: Usuario }>('renombrarme', { nombre });
  set({ usuario: r.usuario });
  save();
}

export async function refreshGroups() {
  await load();
  if (!account.llave) return;
  const r = await api<{ usuario: Usuario; grupos: ResumenGrupo[]; iglesia?: IglesiaAnfitriona | null; cuidador?: boolean }>('yo');
  set({ usuario: r.usuario, grupos: r.grupos, iglesia: r.iglesia ?? null, cuidador: !!r.cuidador });
  save();
}

/** Error que muestran las funciones con IA cuando hace falta entrar; las pantallas lo cambian por <Welcome>. */
export const NEEDS_ACCOUNT = 'Para usar la IA necesitas una cuenta gratuita.';

/**
 * Cabeceras para /api/estudiar y /api/buscar. Sin conexión lanza NEEDS_CONNECTION y sin cuenta NEEDS_ACCOUNT,
 * sin llamar al servidor.
 */
export async function aiHeaders(): Promise<Record<string, string>> {
  requireConnection();
  await load();
  if (!account.llave) throw new Error(NEEDS_ACCOUNT);
  await pedirPermisoIa();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${account.llave}` };
}

/** La llave de sesión, o null sin cuenta (para /api/notificaciones, que también funciona sin cuenta). */
export async function sessionKey() {
  await load();
  return account.llave;
}

/** Respuesta 401 de una función con IA: la sesión ya no vale y se olvida en este dispositivo. */
export function aiDenied(): never {
  set({ llave: null, usuario: null, grupos: null, iglesia: null, cuidador: false });
  save();
  throw new Error(NEEDS_ACCOUNT);
}

/** Avisa a los grupos que se leyó un capítulo. Sin cuenta o sin red no hace nada. */
export async function reportReading(book: string, chapter: number) {
  await load();
  if (!account.llave) return;
  await api('leido', { libro: book, capitulo: chapter }).catch(() => {});
  refreshGroups().catch(() => {});
}

let rachaEnviada = '';

/** Pone al día la racha devocional en la cuenta (el aro de luz de la foto en la comunidad). Solo si cambió. */
export async function reportarRacha(dias: number, vence: string | null) {
  const clave = `${dias}|${vence}`;
  if (clave === rachaEnviada || !(await sessionKey())) return;
  rachaEnviada = clave;
  await api('racha', { dias, vence }).catch(() => {
    rachaEnviada = '';
  });
}

let servicioEnviado = -1;
/** Pone al día en la cuenta cuántas veces se ha servido, para la corona de estrellas de la foto (src/lib/servicio.ts). */
export async function reportarServicio(total: number) {
  if (total === servicioEnviado || !(await sessionKey())) return;
  servicioEnviado = total;
  await api('servicio', { total }).catch(() => {
    servicioEnviado = -1;
  });
}

export function useAccount() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load().then(() => {
      if (account.llave && !account.grupos) refreshGroups().catch(() => {});
    });
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { ...account, ready: isLoaded };
}

/** Texto corto de cuánto hace que se escribió algo. */
export function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'ayer' : `hace ${days} días`;
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
