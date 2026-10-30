import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { compilacion, etiqueta } from './version';

/**
 * Avisos de fallos (api/_errores.ts): cuando algo se rompe, la app manda el mensaje, el comienzo de la pila, la pantalla
 * y la versión, sin cuenta ni nada de la persona. Quienes cuidan Zarza los ven en /cuidar.
 *
 * - Una pantalla que se rompe la atrapa el ErrorBoundary de src/app/_layout.tsx.
 * - Lo que se rompe fuera de React: en la web, los eventos «error» y «unhandledrejection»; en el teléfono, el manejador
 *   global de React Native. Si el fallo cierra la app, el aviso queda guardado y se manda al abrirla otra vez.
 * - Como mucho MAX_SESION avisos por sesión, y cada fallo una sola vez.
 */

export type Origen = 'pantalla' | 'global' | 'promesa';
export type Aviso = { plataforma: 'web' | 'android' | 'ios'; origen: Origen; mensaje: string; pila: string; ruta: string; version: string; fatal: boolean };

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const PENDIENTES = 'errores-pendientes';
const MAX_SESION = 8;
const MAX_PILA_LINEAS = 12;

let ruta = '/';
let instalado = false;
const enviados = new Set<string>();

/** La pantalla abierta, para decir dónde pasó un fallo que llega fuera de React (lo pone src/app/_layout.tsx). */
export function seguirRuta(r: string) {
  ruta = r;
}

/** Fallos que no dicen nada útil o que no son de Zarza (extensiones del navegador, scripts de terceros). */
export function ignorar(mensaje: string, pila: string) {
  if (!mensaje) return true;
  if (/^Script error\.?$/i.test(mensaje)) return true;
  if (/ResizeObserver loop/i.test(mensaje)) return true;
  if (/AbortError|The user aborted a request|cancelled|canceled/i.test(mensaje)) return true;
  return /chrome-extension:|moz-extension:|safari-extension:/.test(pila);
}

export function armarAviso(error: unknown, origen: Origen, fatal = false): Aviso | null {
  const e = error instanceof Error ? error : null;
  const mensaje = (e ? `${e.name && e.name !== 'Error' ? `${e.name}: ` : ''}${e.message}` : String(error ?? '')).trim();
  const pila = (e?.stack ?? '').split('\n').slice(0, MAX_PILA_LINEAS).join('\n');
  if (ignorar(mensaje, pila)) return null;
  const c = compilacion();
  return { plataforma: c.plataforma, origen, mensaje: mensaje.slice(0, 300), pila, ruta, version: etiqueta(c), fatal };
}

async function enviar(aviso: Aviso) {
  const res = await fetch(`${API}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'errorApp', ...aviso }),
    keepalive: true,
  });
  // Un 4xx no se reintenta: el servidor no lo quiso. Sin conexión o con el servidor caído, sí.
  if (!res.ok && res.status >= 500) throw new Error(String(res.status));
}

async function guardarPendiente(aviso: Aviso) {
  try {
    const antes = JSON.parse((await AsyncStorage.getItem(PENDIENTES)) ?? '[]') as Aviso[];
    await AsyncStorage.setItem(PENDIENTES, JSON.stringify([...antes, aviso].slice(-MAX_SESION)));
  } catch {}
}

/** Manda el aviso de un fallo. Nunca lanza: avisar de un fallo no puede romper otra cosa. */
export async function reportarError(error: unknown, origen: Origen, fatal = false) {
  try {
    if (__DEV__) return;
    const aviso = armarAviso(error, origen, fatal);
    if (!aviso) return;
    const clave = `${aviso.mensaje}|${aviso.pila.split('\n')[1] ?? ''}`;
    if (enviados.has(clave) || enviados.size >= MAX_SESION) return;
    enviados.add(clave);
    // Si la app se va a cerrar, primero queda guardado por si el envío no alcanza a salir.
    if (fatal && Platform.OS !== 'web') await guardarPendiente(aviso);
    try {
      await enviar(aviso);
      if (fatal && Platform.OS !== 'web') await AsyncStorage.removeItem(PENDIENTES);
    } catch {
      if (!fatal || Platform.OS === 'web') await guardarPendiente(aviso);
    }
  } catch {}
}

/** Manda los avisos que quedaron guardados (la app se cerró o no había conexión). */
async function mandarPendientes() {
  try {
    const pendientes = JSON.parse((await AsyncStorage.getItem(PENDIENTES)) ?? '[]') as Aviso[];
    if (!pendientes.length) return;
    await AsyncStorage.removeItem(PENDIENTES);
    for (const a of pendientes) await enviar(a).catch(() => {});
  } catch {}
}

type ManejadorGlobal = (error: unknown, fatal?: boolean) => void;
type ErrorUtilsRN = { getGlobalHandler: () => ManejadorGlobal; setGlobalHandler: (h: ManejadorGlobal) => void };

/** Empieza a escuchar los fallos. Se llama una vez al abrir la app. */
export function instalarAvisosDeErrores() {
  if (instalado || __DEV__) return;
  instalado = true;
  setTimeout(mandarPendientes, 5000);

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (e) => reportarError(e.error ?? e.message, 'global'));
    window.addEventListener('unhandledrejection', (e) => reportarError(e.reason, 'promesa'));
    return;
  }

  const utils = (globalThis as { ErrorUtils?: ErrorUtilsRN }).ErrorUtils;
  if (!utils) return;
  const anterior = utils.getGlobalHandler();
  utils.setGlobalHandler((error, fatal) => {
    if (!fatal) {
      reportarError(error, 'global');
      anterior(error, fatal);
      return;
    }
    // Un fallo que cierra la app: se espera un momento a que el aviso quede guardado (o salga) y luego sigue el cierre.
    let hecho = false;
    const seguir = () => {
      if (hecho) return;
      hecho = true;
      anterior(error, fatal);
    };
    const espera = setTimeout(seguir, 1500);
    reportarError(error, 'global', true).finally(() => {
      clearTimeout(espera);
      seguir();
    });
  });
}
