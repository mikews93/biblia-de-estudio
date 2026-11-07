// Sacar la transcripción de un video de YouTube desde el servidor (api/_videos.ts, con Gemini), para usarlo como
// fuente al preparar un mensaje. Sin la clave de Gemini en el servidor, la persona la pega desde YouTube.

import { aiDenied, aiHeaders } from './comunidad';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

let activo: Promise<boolean> | null = null;

/** Si el servidor puede sacar la transcripción solo (se pregunta una vez; sin red, no). */
export function transcribeSolo(): Promise<boolean> {
  activo ??= fetch(`${API}/api/estudiar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videosSolos: true }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j?.activo === true)
    .catch(() => {
      activo = null;
      return false;
    });
  return activo;
}

export type Transcrito = { titulo?: string; canal?: string; transcripcion: string };

/** La transcripción del video; si el servidor no puede, un error con el mensaje para la persona. */
export async function transcribirVideo(url: string, signal?: AbortSignal): Promise<Transcrito> {
  const res = await fetch(`${API}/api/estudiar`, { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ video: url }), signal });
  if (res.status === 401) aiDenied();
  const body = await res.json().catch(() => null);
  if (res.status === 501) activo = Promise.resolve(false);
  if (!res.ok || typeof body?.transcripcion !== 'string') throw new Error(body?.error ?? `No pude ver el video (${res.status})`);
  return body as Transcrito;
}

const datos = new Map<string, Promise<{ titulo?: string; canal?: string }>>();

/** Título y canal del video (del oEmbed de YouTube, por el servidor); sin red, nada. */
export function datosDeVideo(url: string): Promise<{ titulo?: string; canal?: string }> {
  let p = datos.get(url);
  if (!p) {
    p = fetch(`${API}/api/estudiar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoDatos: url }) })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => {
        datos.delete(url);
        return {};
      });
    datos.set(url, p);
  }
  return p;
}
