// api/_push.ts: cifrado y firma de Web Push. El cifrado se comprueba con el ejemplo de la sección 5 del RFC 8291,
// que tiene la salida exacta, y la firma VAPID verificando el JWT con la clave pública.
import { createPublicKey, verify } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { encrypt, newVapidKeys, validEndpoint, vapidAuth } from '../../api/_push';

describe('cifrado aes128gcm (RFC 8291)', () => {
  it('da exactamente la salida del ejemplo del RFC', () => {
    const out = encrypt(
      Buffer.from('When I grow up, I want to be a watermelon'),
      {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'),
      'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    );
    expect(out.toString('base64url')).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });
});

describe('firma VAPID', () => {
  it('es un JWT ES256 para el origen del servicio, que valida con la clave pública', () => {
    const keys = { ...newVapidKeys(), subject: 'https://biblia.example' };
    const now = Date.UTC(2026, 9, 18, 12);
    const header = vapidAuth('https://fcm.googleapis.com/fcm/send/abc', keys, now);
    const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(keys.publicKey);
    const [h, c, sig] = token.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: now / 1000 + 12 * 3600,
      sub: 'https://biblia.example',
    });
    const pub = Buffer.from(keys.publicKey, 'base64url');
    const key = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') },
      format: 'jwk',
    });
    expect(verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))).toBe(true);
  });
});

describe('direcciones de suscripción', () => {
  afterEach(() => {
    delete process.env.PUSH_HOSTS;
  });

  it('solo acepta los servicios push de los navegadores', () => {
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QGx',
      'https://wns2-db5p.notify.windows.com/w/?token=abc',
    ]) {
      expect(validEndpoint(ok), ok).toBe(true);
    }
    for (const bad of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com.evil.test/x',
      'https://evilpush.apple.com.test/x',
      'https://169.254.169.254/latest/meta-data',
      'http://127.0.0.1:5432/',
      'no es una url',
      42,
      null,
    ]) {
      expect(validEndpoint(bad), String(bad)).toBe(false);
    }
  });

  it('PUSH_HOSTS añade servidores (para las pruebas)', () => {
    process.env.PUSH_HOSTS = '127.0.0.1';
    expect(validEndpoint('http://127.0.0.1:9999/push/x')).toBe(true);
    expect(validEndpoint('http://localhost:9999/push/x')).toBe(false);
  });
});
