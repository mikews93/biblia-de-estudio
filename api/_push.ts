// Notificaciones push de la web (Web Push), sin dependencias: firma VAPID (RFC 8292) y cifrado aes128gcm
// (RFC 8291) con node:crypto. Lo usan api/notificaciones.ts (recordatorios) y api/comunidades.ts (avisos).
//
// Las claves VAPID se crean solas la primera vez y se guardan en la base de datos (tabla ajustes), así no
// hay que configurar nada en Vercel. Si se prefieren fijas: VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (base64url).
//
// Cada suscripción es una dirección del servicio push del navegador (Google, Mozilla, Apple, Microsoft).
// Solo se envía a esos servicios: la dirección la manda el teléfono y no debe servir para llamar a otro sitio.

import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';
import type postgres from 'postgres';

import type { Aviso } from '../src/lib/avisosTexto';

type Sql = ReturnType<typeof postgres>;

export type { Aviso };
export type Suscripcion = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { publicKey: string; privateKey: string; subject: string };

const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'];
const SUBJECT = process.env.VAPID_SUBJECT ?? 'https://biblia.migueblanco.com';

// usuario_id sin clave foránea: /api/notificaciones crea esta tabla aunque aún no existan las de la comunidad.
// Al borrar una cuenta, /api/comunidades suelta sus suscripciones.
export const PUSH_SCHEMA = `
create table if not exists ajustes (
  clave text primary key,
  valor text not null
);
create table if not exists suscripciones (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  usuario_id uuid,
  zona text not null default 'America/Mexico_City',
  hora int not null default 480,
  lectura boolean not null default true,
  tarjetas boolean not null default true,
  reto boolean not null default true,
  comunidad boolean not null default true,
  estado jsonb not null default '{}',
  enviado date,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists suscripciones_usuario on suscripciones (usuario_id);
alter table suscripciones add column if not exists despertar int;
alter table suscripciones add column if not exists despertar_dias int not null default 127;
alter table suscripciones add column if not exists despertar_enviado date;
alter table suscripciones add column if not exists pospuesto timestamptz;
alter table suscripciones add column if not exists racha boolean not null default true;
alter table suscripciones add column if not exists racha_enviado date;`;

const b64 = (buf: Buffer) => buf.toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url');

/** ¿Es la dirección de un servicio push conocido? PUSH_HOSTS (separados por comas) añade otros, para las pruebas. */
export function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const extra = (process.env.PUSH_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  if (extra.includes(url.hostname)) return url.protocol === 'https:' || url.protocol === 'http:';
  return url.protocol === 'https:' && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

/** Un par de claves VAPID nuevo: la pública (punto sin comprimir, 65 bytes) y la privada (32 bytes). */
export function newVapidKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64(ecdh.getPublicKey()), privateKey: b64(ecdh.getPrivateKey()) };
}

let vapidCache: Promise<Vapid> | null = null;

/** Las claves VAPID: las de las variables de entorno o, si no hay, las guardadas en la base (se crean una vez). */
export function vapid(sql: Sql): Promise<Vapid> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return Promise.resolve({ publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject: SUBJECT });
  }
  vapidCache ??= (async () => {
    const fresh = newVapidKeys();
    // Si dos funciones arrancan a la vez, gana la primera y las dos leen la misma.
    await sql`insert into ajustes (clave, valor) values ('vapid', ${JSON.stringify(fresh)}) on conflict do nothing`;
    const [row] = await sql<{ valor: string }[]>`select valor from ajustes where clave = 'vapid'`;
    return { ...(JSON.parse(row.valor) as { publicKey: string; privateKey: string }), subject: SUBJECT };
  })().catch((err) => {
    vapidCache = null;
    throw err;
  });
  return vapidCache;
}

/** Cabecera Authorization de VAPID: un JWT ES256 para el origen del servicio push, válido 12 horas. */
export function vapidAuth(endpoint: string, keys: Vapid, now = Date.now()) {
  const pub = unb64(keys.publicKey);
  const key = createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: keys.privateKey, x: b64(pub.subarray(1, 33)), y: b64(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  const header = b64(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64(
    Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })),
  );
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64(signature)}, k=${keys.publicKey}`;
}

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();

/**
 * Cifra el mensaje para una suscripción (RFC 8291, un solo registro aes128gcm). La sal y la clave efímera solo se
 * pasan en las pruebas (el ejemplo de la sección 5 del RFC); normalmente son nuevas en cada mensaje.
 */
export function encrypt(payload: Buffer, sub: Pick<Suscripcion, 'p256dh' | 'auth'>, salt = randomBytes(16), asPrivate?: string) {
  const uaPublic = unb64(sub.p256dh);
  const authSecret = unb64(sub.auth);
  const ecdh = createECDH('prime256v1');
  if (asPrivate) ecdh.setPrivateKey(unb64(asPrivate));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  // 0x02 marca el último (y único) registro.
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/**
 * Envía un aviso. Devuelve 'ok', 'caducada' (el navegador la dio de baja: hay que borrarla) o 'error'.
 * Nunca lanza: un aviso que no sale no debe romper lo que la persona estaba haciendo.
 */
export async function sendPush(sub: Suscripcion, aviso: Aviso, keys: Vapid, ttl = 12 * 3600, urgency: 'normal' | 'high' = 'normal') {
  try {
    if (!validEndpoint(sub.endpoint)) return 'caducada';
    const headers: Record<string, string> = {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
      Authorization: vapidAuth(sub.endpoint, keys),
    };
    // Topic: el servicio reemplaza un aviso pendiente con el mismo tema (32 caracteres base64url como mucho).
    if (aviso.tag) headers.Topic = aviso.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers,
      body: new Uint8Array(encrypt(Buffer.from(JSON.stringify(aviso)), sub)),
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404 || res.status === 410) return 'caducada';
    if (!res.ok) console.error('push', res.status, await res.text().catch(() => ''));
    return res.ok ? 'ok' : 'error';
  } catch (err) {
    console.error('push', err);
    return 'error';
  }
}

/** Envía a varias suscripciones a la vez y borra las que el navegador ya dio de baja. */
export async function sendMany(sql: Sql, subs: Suscripcion[], aviso: Aviso) {
  if (!subs.length) return [];
  const keys = await vapid(sql);
  const results = await Promise.all(subs.map((s) => sendPush(s, aviso, keys)));
  const gone = subs.filter((_, i) => results[i] === 'caducada').map((s) => s.endpoint);
  if (gone.length) await sql`delete from suscripciones where endpoint = any(${gone})`;
  return results;
}

/** Aviso de la comunidad para una persona, en todos sus dispositivos que los aceptan. Nunca lanza. */
export async function notifyUser(sql: Sql, userId: string, aviso: Aviso) {
  try {
    const subs = await sql<Suscripcion[]>`
      select endpoint, p256dh, auth from suscripciones where usuario_id = ${userId} and comunidad`;
    await sendMany(sql, subs, aviso);
  } catch (err) {
    console.error('aviso', err);
  }
}
