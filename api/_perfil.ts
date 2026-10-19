// Ayudas del perfil para /api/comunidades: guardar la foto en Vercel Blob y hablar con Facebook.
// El guion bajo hace que Vercel no la publique como función.
//
// Facebook (opcional): con FACEBOOK_APP_ID y FACEBOOK_APP_SECRET se puede entrar con Facebook o conectar la
// cuenta desde el perfil. La app de Facebook debe tener como «URI de redirección de OAuth válido»
// https://<dominio>/api/facebook. Solo se piden public_profile y email, que no necesitan revisión de Meta.

import { del, put } from '@vercel/blob';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Vercel nombra el token del almacén Blob según el prefijo que se elija al conectarlo: se acepta cualquiera.
const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN ??
  Object.entries(process.env).find(([k, v]) => /^BLOB.*READ_WRITE_TOKEN$/.test(k) && v)?.[1];
// Para las pruebas: guarda las fotos en una carpeta (servida en FOTOS_URL) en vez de Vercel Blob.
const STORE_DIR = process.env.FOTOS_STORE_DIR;
const STORE_URL = process.env.FOTOS_URL ?? '/fotos';

export const MAX_PHOTO_BYTES = 1_500_000;

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_SECRET = process.env.FACEBOOK_APP_SECRET;
const FB_VERSION = process.env.FACEBOOK_API_VERSION ?? 'v26.0';
// Para las pruebas: un Facebook simulado.
const FB_DIALOG = process.env.FACEBOOK_DIALOG_URL ?? `https://www.facebook.com/${FB_VERSION}/dialog/oauth`;
const FB_GRAPH = process.env.FACEBOOK_GRAPH_URL ?? `https://graph.facebook.com/${FB_VERSION}`;

/** El tipo de una imagen por sus primeros bytes (nunca por lo que diga el teléfono), o null si no lo es. */
export function imageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/** Guarda la foto de perfil y devuelve su dirección pública. Cada foto lleva un nombre nuevo, así no queda en caché la vieja. */
export async function storePhoto(userId: string, bytes: Uint8Array, type: keyof typeof EXT) {
  const name = `${userId}-${randomBytes(6).toString('hex')}.${EXT[type]}`;
  if (STORE_DIR) {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(path.join(STORE_DIR, name), bytes);
    return `${STORE_URL}/${name}`;
  }
  if (!BLOB_TOKEN) throw new Error('Falta conectar el almacén de fotos (Vercel Blob)');
  const blob = await put(`fotos/${name}`, Buffer.from(bytes), {
    access: 'public',
    contentType: type,
    addRandomSuffix: false,
    cacheControlMaxAge: 31536000,
    token: BLOB_TOKEN,
  });
  return blob.url;
}

/** Borra una foto que ya no se usa. Si falla no pasa nada: solo queda un archivo suelto. */
export async function removePhoto(url: string | null) {
  if (!url) return;
  try {
    if (STORE_DIR && url.startsWith(`${STORE_URL}/`)) await unlink(path.join(STORE_DIR, path.basename(url)));
    else if (BLOB_TOKEN && /\.blob\.vercel-storage\.com\//.test(url)) await del(url, { token: BLOB_TOKEN });
  } catch (err) {
    console.error('perfil: no se pudo borrar la foto', err);
  }
}

export const facebookReady = () => Boolean(FB_APP_ID && FB_SECRET);

/** La página de Facebook donde la persona acepta; vuelve a redirectUri con ?code y ?state. */
export function facebookDialog(state: string, redirectUri: string) {
  const q = new URLSearchParams({
    client_id: FB_APP_ID!,
    redirect_uri: redirectUri,
    state,
    scope: 'public_profile,email',
    response_type: 'code',
  });
  return `${FB_DIALOG}?${q}`;
}

export type FacebookProfile = { id: string; nombre: string; correo: string | null; foto: string | null };

async function graph<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(`Facebook: ${json.error?.message ?? res.status}`);
  return json;
}

/** Cambia el código de la vuelta por los datos de la persona en Facebook. */
export async function facebookProfile(code: string, redirectUri: string): Promise<FacebookProfile> {
  const token = await graph<{ access_token: string }>(
    `${FB_GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: FB_APP_ID!, client_secret: FB_SECRET!, redirect_uri: redirectUri, code })}`,
  );
  const proof = createHmac('sha256', FB_SECRET!).update(token.access_token).digest('hex');
  const me = await graph<{
    id: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string; is_silhouette?: boolean } };
  }>(
    `${FB_GRAPH}/me?${new URLSearchParams({
      fields: 'id,name,email,picture.width(512).height(512)',
      access_token: token.access_token,
      appsecret_proof: proof,
    })}`,
  );
  const pic = me.picture?.data;
  return {
    id: String(me.id),
    nombre: (me.name ?? '').trim().slice(0, 40) || 'Amigo',
    correo: me.email?.trim().toLowerCase() || null,
    foto: pic?.url && !pic.is_silhouette ? pic.url : null,
  };
}

/** Descarga la foto de Facebook (sus direcciones caducan) para guardarla como la del perfil. */
export async function downloadPhoto(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = imageType(bytes);
    return type && bytes.length <= MAX_PHOTO_BYTES ? { bytes, type } : null;
  } catch {
    return null;
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * La página que ve la persona al volver de Facebook. Si se abrió en una ventana aparte, se cierra sola (la app
 * ya está esperando el resultado); si se abrió en la misma pestaña, vuelve a la pantalla de la app.
 */
export function facebookPage(title: string, body: string, back: string) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><style>

:root{color-scheme:light dark;--bg:#FBF8F3;--fg:#1F1B16;--muted:#6B6358;--accent:#8A4B2A;--on:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#151311;--fg:#EDE7DE;--muted:#A39A8E;--accent:#E0A07A;--on:#151311}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font-family:system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
h1{font-family:Georgia,serif;font-size:24px;margin:0 0 8px}p{color:var(--muted);line-height:1.5;margin:0 0 20px;max-width:340px}
a{display:inline-block;background:var(--accent);color:var(--on);text-decoration:none;font-weight:700;padding:12px 22px;border-radius:24px}
</style></head><body><main><h1>${escape(title)}</h1><p>${escape(body)}</p><a href="${escape(back)}">Volver a la app</a></main>
<script>try{if(window.opener){window.close()}else if(sessionStorage.getItem('facebook-misma-pestana')){location.replace(${JSON.stringify(back)})}}catch(e){}</script>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
