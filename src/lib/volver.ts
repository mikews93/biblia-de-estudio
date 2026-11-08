// Volver a donde se pidió la cuenta. Al entrar con Google o Facebook en la misma pestaña se pierde el historial, así
// que la pantalla que mandó a entrar (por ejemplo la lectura en vivo) se recuerda unos minutos.
import { router } from 'expo-router';

const CLAVE = 'volver-tras-entrar';
const VALE_MS = 30 * 60 * 1000;

/** Manda a crear la cuenta o entrar, recordando a qué pantalla volver. */
export function pedirCuenta(modo: 'entrar' | 'registro' = 'registro', desde?: string) {
  const loc = (globalThis as { location?: { pathname: string; search: string } }).location;
  const a = desde ?? (loc ? `${loc.pathname}${loc.search}` : null);
  try {
    if (a) globalThis.localStorage?.setItem(CLAVE, JSON.stringify({ a, en: Date.now() }));
  } catch {
    // Sin almacenamiento: se vuelve con el historial.
  }
  router.push(`/${modo}`);
}

/** La pantalla a la que hay que volver después de entrar, si se pidió hace poco (y se olvida). */
export function volverTrasEntrar(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(CLAVE);
    if (!raw) return null;
    globalThis.localStorage?.removeItem(CLAVE);
    const { a, en } = JSON.parse(raw) as { a?: string; en?: number };
    return typeof a === 'string' && a.startsWith('/') && !a.startsWith('//') && typeof en === 'number' && Date.now() - en < VALE_MS ? a : null;
  } catch {
    return null;
  }
}
