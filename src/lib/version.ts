import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Qué copia de Zarza está corriendo: la versión, el número de compilación de la app de tienda, el commit y la fecha en
 * que se compiló (app.config.ts). Sirve para reportar un fallo diciendo exactamente qué versión lo tiene, y para saber si
 * el teléfono solo necesita actualizarse: la web publica su commit en /version.json (pipeline/version_web.mjs).
 */
export type Compilacion = {
  version: string;
  /** El versionCode de Android o el build de iOS; en la web no hay. */
  build: string | null;
  commit: string;
  fecha: string;
  rama: string;
  plataforma: 'web' | 'android' | 'ios';
  /** En la web: abierta como app instalada (desde Chrome o «Añadir a inicio»), no en una pestaña. */
  instalada: boolean;
};

export type Publicada = { commit: string; fecha: string };

type Extra = { compilacion?: { commit?: string; fecha?: string; rama?: string } };

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export function compilacion(): Compilacion {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const web = Platform.OS === 'web';
  return {
    version: (!web && Application.nativeApplicationVersion) || Constants.expoConfig?.version || '1.0.0',
    build: web ? null : Application.nativeBuildVersion,
    commit: extra.compilacion?.commit ?? '',
    fecha: extra.compilacion?.fecha ?? '',
    rama: extra.compilacion?.rama ?? '',
    plataforma: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web',
    instalada: web && enModoApp(),
  };
}

function enModoApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (navigator as { standalone?: boolean }).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
}

export const commitCorto = (commit: string) => commit.slice(0, 7);

/** «1.0.0 · a1b2c3d», o con la compilación de la tienda: «1.0.0 (3) · a1b2c3d». */
export function etiqueta(c: Compilacion): string {
  const v = c.build ? `${c.version} (${c.build})` : c.version;
  return c.commit ? `${v} · ${commitCorto(c.commit)}` : v;
}

/** «27 de octubre de 2026, 14:36», en la hora del teléfono. */
export function fechaLegible(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const dia = d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  const hora = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return `${dia}, ${hora}`;
}

export function nombrePlataforma(c: Compilacion): string {
  if (c.plataforma === 'android') return 'App de Android';
  if (c.plataforma === 'ios') return 'App de iPhone';
  return c.instalada ? 'App web instalada' : 'Web en el navegador';
}

/** Lo que se copia para pegar en un mensaje al reportar un fallo. */
export function textoParaReportar(c: Compilacion, ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  return [
    `Zarza ${etiqueta(c)}`,
    `${nombrePlataforma(c)}${c.plataforma === 'web' ? '' : ` · ${Platform.OS} ${Platform.Version}`}`,
    c.fecha && `Compilada: ${fechaLegible(c.fecha)}`,
    c.commit && `Commit: ${c.commit}`,
    c.rama && c.rama !== 'main' && `Rama: ${c.rama}`,
    c.plataforma === 'web' && ua && `Navegador: ${ua}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** La última versión publicada de la web, sin caché (el service worker no guarda lo pedido con no-store). */
export async function ultimaPublicada(): Promise<Publicada | null> {
  try {
    const res = await fetch(`${API}/version.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const v = (await res.json()) as Partial<Publicada>;
    return v.commit ? { commit: v.commit, fecha: v.fecha ?? '' } : null;
  } catch {
    return null;
  }
}

export type Estado = 'al-dia' | 'nueva' | 'desconocido';

/**
 * Compara lo que corre con lo publicado. Si los commits son distintos y lo publicado es más reciente, hay una nueva;
 * si lo que corre es más reciente (una vista previa), se da por al día.
 */
export function estado(c: Compilacion, p: Publicada | null): Estado {
  if (!p || !c.commit) return 'desconocido';
  if (p.commit === c.commit) return 'al-dia';
  const corre = Date.parse(c.fecha);
  const publicada = Date.parse(p.fecha);
  if (!Number.isNaN(corre) && !Number.isNaN(publicada) && publicada <= corre) return 'al-dia';
  return 'nueva';
}
