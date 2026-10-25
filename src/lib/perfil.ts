// Cliente del perfil: nombre y unas líneas sobre la persona, la foto y la conexión con Facebook.
// Usa la misma cuenta y la misma función que la comunidad (src/lib/comunidad.ts).

import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { api, startSession, updateUser, Usuario } from './comunidad';

export const MAX_BIO = 160;
export const MAX_PLACE = 60;
export const MAX_APODO = 24;
// La foto se guarda cuadrada y pequeña: se ve nítida en el perfil y pesa unos 50 KB.
const PHOTO_SIZE = 480;

export type Perfil = { nombre: string; bio: string; iglesia: string; ciudad: string; apodo: string };

export async function saveProfile(p: Perfil) {
  updateUser((await api<{ usuario: Usuario }>('guardarPerfil', p)).usuario);
}

/**
 * Abre la galería, recorta la foto al centro en un cuadrado, la achica y la sube.
 * Devuelve false si la persona no eligió ninguna.
 */
export async function pickPhoto() {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: Platform.OS !== 'web',
    aspect: [1, 1],
    quality: 1,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return false;
  const ctx = ImageManipulator.manipulate(asset.uri);
  const rendered = await ctx.renderAsync();
  const side = Math.min(rendered.width, rendered.height);
  const square = ImageManipulator.manipulate(asset.uri)
    .crop({ originX: (rendered.width - side) / 2, originY: (rendered.height - side) / 2, width: side, height: side })
    .resize({ width: Math.min(PHOTO_SIZE, side), height: Math.min(PHOTO_SIZE, side) });
  const saved = await (await square.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!saved.base64) throw new Error('No se pudo leer la foto');
  updateUser((await api<{ usuario: Usuario }>('subirFoto', { imagen: saved.base64 })).usuario);
  return true;
}

export async function removePhoto() {
  updateUser((await api<{ usuario: Usuario }>('quitarFoto')).usuario);
}

// --- Facebook ---
// La app abre Facebook en una ventana aparte (o en la misma pestaña si el navegador la bloquea) y pregunta al
// servidor cada poco hasta que la persona termina. Solo en la web: la cookie que ata el viaje a este navegador
// no viaja desde la app nativa.

const PENDING = 'facebook-estado';
const SAME_TAB = 'facebook-misma-pestana';

export const facebookSupported = Platform.OS === 'web';

let available: Promise<boolean> | null = null;
/** Si el servidor tiene configurada la app de Facebook. */
export function facebookAvailable() {
  if (!facebookSupported) return Promise.resolve(false);
  available ??= api<{ disponible: boolean }>('facebookDisponible')
    .then((r) => r.disponible)
    .catch(() => {
      available = null;
      return false;
    });
  return available;
}

const session = {
  get: (k: string) => {
    try {
      return globalThis.sessionStorage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) globalThis.sessionStorage?.removeItem(k);
      else globalThis.sessionStorage?.setItem(k, v);
    } catch {}
  },
};

type Result = { usuario: Usuario; llave?: string };

let attempt = 0;

async function waitFor(estado: string, popup: Window | null): Promise<Result | null> {
  const mine = ++attempt;
  // Algunas páginas de Facebook cortan el vínculo con la ventana y la dan por cerrada aunque siga abierta:
  // al verla cerrada se sigue preguntando un rato antes de rendirse.
  let closedAt: number | null = null;
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline && mine === attempt) {
    const r = await api<Result & { pendiente?: boolean }>('facebookResultado', { estado });
    if (!r.pendiente) return r;
    if (popup?.closed) closedAt ??= Date.now();
    if (closedAt && Date.now() - closedAt > 45_000) return null;
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return null;
}

async function apply(r: Result | null) {
  if (!r) return false;
  if (r.llave) await startSession({ usuario: r.usuario, llave: r.llave });
  else updateUser(r.usuario);
  return true;
}

/**
 * Entra con Facebook (modo «entrar», también crea la cuenta) o conecta Facebook a la cuenta abierta (modo
 * «conectar»). Resuelve true al terminar, false si la persona cerró la ventana; los fallos llegan como error.
 */
export async function facebook(modo: 'entrar' | 'conectar') {
  // La ventana se abre antes de esperar al servidor: los navegadores solo dejan abrirla al tocar.
  const popup = window.open('', 'facebook', 'popup,width=520,height=680');
  try {
    const { url, estado } = await api<{ url: string; estado: string }>('facebookInicio', { modo });
    if (!popup || popup.closed) {
      session.set(PENDING, estado);
      session.set(SAME_TAB, '1');
      location.assign(url);
      return new Promise<boolean>(() => {});
    }
    popup.location.href = url;
    return apply(await waitFor(estado, popup));
  } catch (e) {
    popup?.close();
    throw e;
  }
}

/** Al volver de Facebook en la misma pestaña: termina el viaje que quedó pendiente, si lo hay. */
export async function resumeFacebook() {
  const estado = session.get(PENDING);
  if (!estado) return false;
  session.set(PENDING, null);
  session.set(SAME_TAB, null);
  return apply(await waitFor(estado, null));
}

export async function disconnectFacebook() {
  updateUser((await api<{ usuario: Usuario }>('desconectarFacebook')).usuario);
}
