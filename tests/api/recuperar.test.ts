// «¿Olvidaste tu contraseña?» (api/_recuperar.ts) contra un Postgres de verdad. El correo no sale: se atrapa la
// llamada a Resend y se lee de ahí el enlace.
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { correoRecuperar } from '../../api/_recuperar';
import { client, DB_URL, ensureSchema, Post, prepareEnv, unique } from './helpers';

let POST: Post;
let call: ReturnType<typeof client>;
let enviados: { to: string[]; from: string; subject: string; text: string; html: string }[] = [];
let resendOk = true;

const fetchReal = globalThis.fetch;

beforeAll(async () => {
  await prepareEnv();
  process.env.RESEND_API_KEY = 're_prueba';
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).startsWith('https://api.resend.com/')) {
      if (!resendOk) return new Response('{"message":"dominio sin verificar"}', { status: 403 });
      enviados.push(JSON.parse(String(init?.body)));
      return Response.json({ id: 'correo-1' });
    }
    return fetchReal(url, init);
  });
  ({ POST } = await import('../../api/comunidades'));
  call = client(POST, '2026-10-30');
  if (DB_URL) await ensureSchema(POST);
});

afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  enviados = [];
  resendOk = true;
});

const enlaceDe = (text: string) => text.match(/https:\/\/zarzabiblia\.com\/recuperar\/([\w-]+)/)![1];

describe('el correo para recuperar la contraseña', () => {
  it('lleva el enlace en el texto y en el botón, y escapa el nombre', () => {
    const c = correoRecuperar('Ana <b>', 'https://zarzabiblia.com/recuperar/abc');
    expect(c.text).toContain('https://zarzabiblia.com/recuperar/abc');
    expect(c.html).toContain('href="https://zarzabiblia.com/recuperar/abc"');
    expect(c.html).toContain('Ana &lt;b&gt;');
    expect(c.html).not.toContain('<b>');
  });
});

describe.skipIf(!DB_URL)('/api/comunidades: recuperar la contraseña', () => {
  async function cuenta() {
    const { nombre, correo } = unique('Rut');
    const r = await call<{ llave: string }>('registrarse', { nombre, correo, clave: 'vieja-clave-1' });
    expect(r.status).toBe(200);
    return { nombre, correo, llave: r.json.llave };
  }

  it('envía el enlace, sirve una vez, cambia la contraseña y cierra las otras sesiones', async () => {
    const rut = await cuenta();
    const r = await call('olvideClave', { correo: rut.correo.toUpperCase() });
    expect(r.status).toBe(200);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].to).toEqual([rut.correo]);
    expect(enviados[0].from).toBe('Zarza <hola@zarzabiblia.com>');
    const enlace = enlaceDe(enviados[0].text);

    expect((await call('enlaceClave', { enlace })).json).toEqual({ correo: rut.correo });
    expect((await call('cambiarClave', { enlace, clave: 'corta' })).status).toBe(400);

    const cambio = await call<{ llave: string; usuario: { correo: string } }>('cambiarClave', { enlace, clave: 'nueva-clave-2' });
    expect(cambio.status).toBe(200);
    expect(cambio.json.usuario.correo).toBe(rut.correo);
    expect((await call('yo', {}, cambio.json.llave)).status).toBe(200);
    // La sesión de antes ya no sirve, y el enlace tampoco.
    expect((await call('yo', {}, rut.llave)).status).toBe(401);
    expect((await call('cambiarClave', { enlace, clave: 'otra-clave-3' })).status).toBe(410);
    expect((await call('enlaceClave', { enlace })).status).toBe(410);

    expect((await call('entrar', { correo: rut.correo, clave: 'vieja-clave-1' })).status).toBe(401);
    expect((await call('entrar', { correo: rut.correo, clave: 'nueva-clave-2' })).status).toBe(200);
  });

  it('responde igual si el correo no tiene cuenta, sin enviar nada', async () => {
    const r = await call('olvideClave', { correo: unique('Nadie').correo });
    expect(r).toEqual({ status: 200, json: { enviado: true } });
    expect(enviados).toHaveLength(0);
  });

  it('como mucho tres correos por hora a la misma cuenta', async () => {
    const rut = await cuenta();
    for (let i = 0; i < 5; i++) expect((await call('olvideClave', { correo: rut.correo })).status).toBe(200);
    expect(enviados).toHaveLength(3);
  });

  it('un enlace vencido no sirve', async () => {
    const rut = await cuenta();
    await call('olvideClave', { correo: rut.correo });
    const enlace = enlaceDe(enviados[0].text);
    const sql = postgres(DB_URL!, { max: 1, onnotice: () => {} });
    try {
      await sql`update recuperar_clave set creado = now() - interval '61 minutes'
        where usuario_id = (select id from usuarios where correo = ${rut.correo})`;
    } finally {
      await sql.end();
    }
    expect((await call('cambiarClave', { enlace, clave: 'nueva-clave-2' })).status).toBe(410);
  });

  it('si Resend falla, avisa y el enlace no queda guardado', async () => {
    const rut = await cuenta();
    resendOk = false;
    const r = await call('olvideClave', { correo: rut.correo });
    expect(r.status).toBe(502);
    resendOk = true;
    // No cuenta para el límite: los tres siguientes sí salen.
    for (let i = 0; i < 3; i++) await call('olvideClave', { correo: rut.correo });
    expect(enviados).toHaveLength(3);
  });

  it('sin RESEND_API_KEY lo dice claro', async () => {
    delete process.env.RESEND_API_KEY;
    try {
      const r = await call('olvideClave', { correo: (await cuenta()).correo });
      expect(r.status).toBe(503);
    } finally {
      process.env.RESEND_API_KEY = 're_prueba';
    }
  });
});
