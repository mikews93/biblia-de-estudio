// Servicio push simulado para las pruebas: recibe los avisos que mandan las funciones de /api (que en
// producción van a Google, Mozilla, Apple o Microsoft) y los guarda, ya descifrados, para comprobarlos.
// Las funciones solo aceptan estos servidores con PUSH_HOSTS (api/_push.ts).
//
// Una suscripción de prueba es un par de claves P-256 propio: con la privada se descifra lo recibido.

import { createDecipheriv, createECDH, createHmac, randomBytes, type ECDH } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type Entrega = { id: string; headers: Record<string, string>; aviso: Record<string, unknown> | null };

const subs = new Map<string, { ecdh: ECDH; auth: Buffer }>();
export const entregas: Entrega[] = [];

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();

/** Una suscripción como la que da el navegador, que entrega en este servicio simulado. */
export function nuevaSuscripcion(base: string, id = randomBytes(6).toString('hex')) {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  subs.set(id, { ecdh, auth });
  return {
    id,
    endpoint: `${base}/__push/${id}`,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
  };
}

/** Descifra un mensaje aes128gcm (RFC 8291) con las claves de la suscripción. */
export function descifrar(body: Buffer, ecdh: ECDH, auth: Buffer) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const data = body.subarray(21 + idlen);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPublic]);
  const ikm = hmac(hmac(auth, ecdh.computeSecret(asPublic)), Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(data.subarray(-16));
  const plain = Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]);
  // Quita el delimitador 0x02 (y el relleno de ceros, si lo hubiera).
  let end = plain.length - 1;
  while (end > 0 && plain[end] === 0) end--;
  return plain.subarray(0, end);
}

/**
 * Atiende /__push/<id>: GET /__push/nueva da una suscripción, POST guarda la entrega (responde 410 si el id empieza por «caducada», como un navegador
 * que dio de baja la suscripción) y GET /__push devuelve todas. Devuelve false si la ruta no es suya.
 */
export async function handlePush(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // Para el navegador de las pruebas: una suscripción nueva cuyas entregas este servicio sabe descifrar.
  if (url.pathname === '/__push/nueva' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(nuevaSuscripcion(`http://${req.headers.host}`)));
    return true;
  }
  if (url.pathname === '/__push' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(entregas));
    return true;
  }
  const m = url.pathname.match(/^\/__push\/([\w-]+)$/);
  if (!m || req.method !== 'POST') return false;
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const id = m[1];
  if (id.startsWith('caducada')) {
    res.writeHead(410);
    res.end();
    return true;
  }
  const sub = subs.get(id);
  let aviso: Record<string, unknown> | null = null;
  try {
    if (sub) aviso = JSON.parse(descifrar(Buffer.concat(chunks), sub.ecdh, sub.auth).toString());
  } catch {
    aviso = null;
  }
  entregas.push({ id, headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])), aviso });
  res.writeHead(201);
  res.end();
  return true;
}
