// Entrar (o crear la cuenta) con Google, Apple o Facebook, y conectarlos desde el perfil. El servidor usa Auth.js
// (api/_entrar.ts); la cuenta sigue siendo la de /api/comunidades.
//
// El viaje: la app pide a proveedorInicio una dirección con un pase de un solo uso y un estado que solo ella conoce;
// abre la dirección (en la web, en una ventana aparte o en la misma pestaña si el navegador la bloquea; en el
// teléfono, en el navegador seguro del sistema) y pregunta cada poco con el estado hasta que la persona termina.

import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { api, startSession, updateUser, Usuario } from './comunidad';

export type Proveedor = 'google' | 'apple' | 'facebook';
export const NOMBRE: Record<Proveedor, string> = { google: 'Google', apple: 'Apple', facebook: 'Facebook' };
type Modo = 'entrar' | 'conectar';

const PENDING = 'entrar-viaje';
// La página de vuelta (api/_entrar.ts) lee esta marca para regresar a la app en la misma pestaña.
const SAME_TAB = 'entrar-misma-pestana';
const NATIVO = Platform.OS !== 'web';

let available: Promise<Record<Proveedor, boolean>> | null = null;

/**
 * Los proveedores que se pueden usar aquí, en el orden en que se muestran. En iPhone, Apple pide ofrecer «Iniciar
 * sesión con Apple» junto a cualquier otro inicio con terceros (regla 4.8): sin Apple, allí se entra solo con correo.
 */
export async function proveedoresDisponibles(): Promise<Proveedor[]> {
  available ??= api<Record<Proveedor, boolean>>('proveedores').catch(() => {
    available = null;
    return { google: false, apple: false, facebook: false };
  });
  const listos = await available;
  if (Platform.OS === 'ios' && !listos.apple) return [];
  const orden: Proveedor[] = Platform.OS === 'ios' ? ['apple', 'google', 'facebook'] : ['google', 'apple', 'facebook'];
  return orden.filter((p) => listos[p]);
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

async function waitFor(estado: string, closed: () => boolean): Promise<Result | null> {
  const mine = ++attempt;
  // Algunas páginas cortan el vínculo con la ventana y la dan por cerrada aunque siga abierta, y en el teléfono el
  // navegador se cierra justo al terminar: al verla cerrada se sigue preguntando un rato antes de rendirse.
  let closedAt: number | null = null;
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline && mine === attempt) {
    const r = await api<Result & { pendiente?: boolean }>('proveedorResultado', { estado });
    if (!r.pendiente) return r;
    if (closed()) closedAt ??= Date.now();
    if (closedAt && Date.now() - closedAt > (NATIVO ? 15_000 : 45_000)) return null;
    await new Promise((ok) => setTimeout(ok, 1200));
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
 * Entra con el proveedor (modo «entrar», que también crea la cuenta) o lo conecta a la cuenta abierta (modo
 * «conectar»). Resuelve true al terminar, false si la persona cerró la ventana; los fallos llegan como error.
 */
export async function entrarCon(proveedor: Proveedor, modo: Modo): Promise<boolean> {
  if (NATIVO) {
    const { url, estado } = await api<{ url: string; estado: string }>('proveedorInicio', { proveedor, modo, nativo: true });
    let closed = false;
    const result = waitFor(estado, () => closed);
    WebBrowser.openAuthSessionAsync(url, 'bibliadeestudio://vuelta')
      .catch(() => {})
      .finally(() => (closed = true));
    const r = await result;
    WebBrowser.dismissAuthSession();
    return apply(r);
  }
  // La ventana se abre antes de esperar al servidor: los navegadores solo dejan abrirla al tocar.
  const popup = window.open('', 'entrar', 'popup,width=520,height=680');
  try {
    const { url, estado } = await api<{ url: string; estado: string }>('proveedorInicio', { proveedor, modo });
    if (!popup || popup.closed) {
      session.set(PENDING, estado);
      session.set(SAME_TAB, '1');
      location.assign(url);
      return new Promise<boolean>(() => {});
    }
    popup.location.href = url;
    return apply(await waitFor(estado, () => popup.closed));
  } catch (e) {
    popup?.close();
    throw e;
  }
}

/** Al volver del proveedor en la misma pestaña (web): termina el viaje que quedó pendiente, si lo hay. */
export async function retomarViaje() {
  const estado = session.get(PENDING);
  if (!estado) return false;
  session.set(PENDING, null);
  session.set(SAME_TAB, null);
  return apply(await waitFor(estado, () => true));
}

export async function desconectar(proveedor: Proveedor) {
  updateUser((await api<{ usuario: Usuario }>('desconectarProveedor', { proveedor })).usuario);
}
