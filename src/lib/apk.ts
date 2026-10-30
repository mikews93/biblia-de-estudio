import { Platform } from 'react-native';

/**
 * El APK de Android que se descarga desde la web (/instalar). Lo publica .github/workflows/apk-web.yml en la release
 * «apk» del repo, siempre con el nombre zarza.apk, así que el enlace no cambia nunca. zarzabiblia.com/zarza.apk
 * redirige ahí (vercel.json). El nombre, el tamaño y la fecha se leen de la API pública de GitHub, que permite CORS.
 */
const REPO = 'mikews93/biblia-de-estudio';
export const ENLACE_APK = `https://github.com/${REPO}/releases/download/apk/zarza.apk`;
export const PAGINA_INSTALAR = 'https://zarzabiblia.com/instalar';
const API_RELEASE = `https://api.github.com/repos/${REPO}/releases/tags/apk`;

export type Apk = { version: string; build: string | null; bytes: number; fecha: string; url: string };

type Release = { name?: string; assets?: { name: string; size: number; updated_at: string; browser_download_url: string }[] };

/** «Zarza 1.0.0 (7) para Android» → versión y compilación; el APK que trae la release, o null si todavía no hay. */
export function leerRelease(r: Release): Apk | null {
  const a = r.assets?.find((x) => x.name === 'zarza.apk');
  if (!a) return null;
  const m = /(\d+\.\d+\.\d+)(?:\s*\((\d+)\))?/.exec(r.name ?? '');
  return { version: m?.[1] ?? '', build: m?.[2] ?? null, bytes: a.size, fecha: a.updated_at, url: a.browser_download_url };
}

/** El último APK publicado. null si aún no hay; undefined si no se pudo preguntar (sin internet o límite de GitHub). */
export async function ultimoApk(): Promise<Apk | null | undefined> {
  try {
    const res = await fetch(API_RELEASE, { headers: { Accept: 'application/vnd.github+json' } });
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    return leerRelease(await res.json());
  } catch {
    return undefined;
  }
}

export type Dispositivo = 'android' | 'iphone' | 'computador';

/** Dónde se abrió la página: en Android se descarga directo, en iPhone no hay APK, en el computador se ofrece un QR. */
export function dispositivo(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '', toques = maxToques()): Dispositivo {
  if (/android/i.test(ua)) return 'android';
  // El iPad con iPadOS se presenta como Mac, pero tiene pantalla táctil.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && toques > 1)) return 'iphone';
  return 'computador';
}

const maxToques = () => (typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0);

/** La descarga solo se ofrece en la web: dentro de la app nativa ya la tienes, y Google Play no permite ofrecer otra. */
export const OFRECER_APK = Platform.OS === 'web';

/** «31,4 MB». */
export const megas = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} MB`;

/** «30 de octubre». Con año solo si no es el actual. */
export function fechaCorta(iso: string, hoy = new Date()): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long', ...(d.getFullYear() !== hoy.getFullYear() && { year: 'numeric' }) });
}
