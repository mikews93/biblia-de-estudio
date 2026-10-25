// El perfil en /api/comunidades: guardar los datos, la foto (en una carpeta en vez de Vercel Blob) y entrar o
// conectar la cuenta con un Facebook simulado a través de Auth.js (/api/auth). Ver tests/api/helpers.ts.
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request, unique } from './helpers';

const HOY = new Date().toISOString().slice(0, 10);
const FOTOS = mkdtempSync(path.join(tmpdir(), 'fotos-'));
// Una «foto» mínima: basta con que empiece como un JPEG.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

// Facebook simulado: cada código de la vuelta corresponde a una persona de Facebook.
const fbPeople: Record<string, { id: string; name: string; email?: string; foto?: boolean }> = {};
let fbBase = '';

let POST: Post;
let AUTH: (r: Request) => Promise<Response>;
let call: ReturnType<typeof client>;

beforeAll(async () => {
  await prepareEnv();
  const fb = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/oauth/access_token') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const form = new URLSearchParams(raw);
        const code = form.get('code')!;
        const basic = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString();
        const secreto = form.get('client_secret') ?? decodeURIComponent(basic.split(':')[1] ?? '');
        if (req.method !== 'POST' || !fbPeople[code] || secreto !== 'secreto') {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'invalid_grant' }));
        }
        res.end(JSON.stringify({ access_token: `tok-${code}`, token_type: 'bearer' }));
      });
      return;
    }
    if (url.pathname === '/me') {
      const p = fbPeople[(req.headers.authorization ?? '').replace(/^Bearer tok-/, '')];
      if (!url.searchParams.get('appsecret_proof')) return res.end(JSON.stringify({ error: { message: 'sin prueba' } }));
      return res.end(
        JSON.stringify({
          id: p.id,
          name: p.name,
          email: p.email,
          picture: { data: { url: `${fbBase}/foto.jpg`, is_silhouette: !p.foto } },
        }),
      );
    }
    if (url.pathname === '/foto.jpg') {
      res.setHeader('Content-Type', 'image/jpeg');
      return res.end(JPEG);
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise<void>((ok) => fb.listen(0, '127.0.0.1', ok));
  fbBase = `http://127.0.0.1:${(fb.address() as AddressInfo).port}`;
  Object.assign(process.env, {
    FOTOS_STORE_DIR: FOTOS,
    FOTOS_URL: '/fotos',
    FACEBOOK_APP_ID: 'app-1',
    FACEBOOK_APP_SECRET: 'secreto',
    FACEBOOK_GRAPH_URL: fbBase,
    FACEBOOK_DIALOG_URL: 'https://facebook.test/dialog',
    AUTH_SECRET: 'secreto-de-prueba-para-auth-js',
  });
  ({ POST } = await import('../../api/comunidades'));
  ({ GET: AUTH } = await import('../../api/auth'));
  call = client(POST, HOY);
  if (DB_URL) await ensureSchema(POST);
});

async function persona(name: string, conClave = false) {
  const u = unique(name);
  const r = await call<{ llave: string; usuario: { id: string } }>(
    'registrarse',
    conClave ? { nombre: u.nombre, correo: u.correo, clave: 'clave-segura' } : { nombre: u.nombre },
  );
  return { llave: r.json.llave, id: r.json.usuario.id, ...u };
}

/** Un navegador: guarda las cookies que pone /api/auth y sigue a mano sus redirecciones. */
class Navegador {
  jar = new Map<string, string>();
  async get(url: string) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await AUTH(new Request(url, { headers: cookie ? { cookie } : {} }));
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      if (!kv.slice(i + 1) || /Max-Age=0|1970/i.test(c)) this.jar.delete(kv.slice(0, i));
      else this.jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return res;
  }
}

/** Empieza el viaje a Facebook desde la app: la dirección con el pase y el estado que solo conoce la app. */
async function inicio(modo: 'entrar' | 'conectar', llave?: string) {
  const r = await call<{ url: string; estado: string }>('proveedorInicio', { proveedor: 'facebook', modo }, llave);
  return r.json;
}

/** Abre la dirección de la app en el navegador: debe mandarlo a la página de Facebook. */
async function aFacebook(nav: Navegador, url: string) {
  const res = await nav.get(url);
  expect(res.status).toBe(302);
  return new URL(res.headers.get('location')!);
}

/** Facebook vuelve con estos datos; sigue la redirección hasta la página final y devuelve su texto. */
async function vuelta(nav: Navegador, dialog: URL, q: Record<string, string>) {
  const res = await nav.get(`${dialog.searchParams.get('redirect_uri')}?${new URLSearchParams({ state: dialog.searchParams.get('state')!, ...q })}`);
  expect(res.status).toBe(302);
  const fin = await nav.get(res.headers.get('location')!);
  expect(fin.headers.get('content-type')).toContain('text/html');
  return fin.text();
}

/** Todo el viaje en un navegador nuevo. */
async function viaje(modo: 'entrar' | 'conectar', q: Record<string, string>, llave?: string) {
  const t = await inicio(modo, llave);
  const nav = new Navegador();
  const html = await vuelta(nav, await aFacebook(nav, t.url), q);
  return { ...t, html };
}

async function resultado(estado: string) {
  const r = await call<Record<string, any>>('proveedorResultado', { estado });
  return { status: r.status, json: r.json as Record<string, any> };
}

const fbPersona = (name: string, extra: Partial<(typeof fbPeople)[string]> = {}) => {
  const code = `c-${unique(name).correo}`;
  fbPeople[code] = { id: `fb-${code}`, name, ...extra };
  return code;
};

describe.skipIf(!DB_URL || !HAS_DATA)('perfil', () => {
  it('guardarPerfil guarda nombre, unas líneas, iglesia y ciudad, y los demás los ven', async () => {
    const ana = await persona('Ana');
    const r = await call('guardarPerfil', { nombre: ' Ana ', bio: ' Leo con mi familia ', iglesia: 'Bautista Central', ciudad: '' }, ana.llave);
    expect(r.json.usuario).toMatchObject({ nombre: 'Ana', bio: 'Leo con mi familia', iglesia: 'Bautista Central', ciudad: null });
    expect((await call('yo', {}, ana.llave)).json.usuario).toMatchObject({ bio: 'Leo con mi familia', ciudad: null });

    const beto = await persona('Beto');
    const visto = (await call('persona', { usuario: ana.id }, beto.llave)).json.persona;
    expect(visto).toMatchObject({ nombre: 'Ana', bio: 'Leo con mi familia', iglesia: 'Bautista Central', ciudad: null, foto: null });

    expect((await call('guardarPerfil', { nombre: '' }, ana.llave)).json.error).toBe('Escribe tu nombre');
    expect((await call('guardarPerfil', { nombre: 'Ana', bio: 'x'.repeat(161) }, ana.llave)).json.error).toBe(
      'Es demasiado largo (máximo 160 caracteres)',
    );
  });

  it('la foto: se sube, reemplaza a la anterior, sale en las publicaciones y se puede quitar', async () => {
    const ana = await persona('Ana');
    const primera = (await call('subirFoto', { imagen: JPEG.toString('base64') }, ana.llave)).json.usuario.foto as string;
    expect(primera).toMatch(new RegExp(`^/fotos/${ana.id}-[0-9a-f]+\\.jpg$`));
    expect(existsSync(path.join(FOTOS, path.basename(primera)))).toBe(true);

    const segunda = (await call('subirFoto', { imagen: `data:image/jpeg;base64,${JPEG.toString('base64')}` }, ana.llave)).json.usuario
      .foto as string;
    expect(segunda).not.toBe(primera);
    expect(existsSync(path.join(FOTOS, path.basename(primera)))).toBe(false);

    await call('publicar', { tipo: 'pregunta', audiencia: 'amigos', texto: '¿Qué leen hoy?' }, ana.llave);
    const [post] = (await call('muro', { filtro: 'amigos' }, ana.llave)).json.publicaciones;
    expect(post.autorFoto).toBe(segunda);

    expect((await call('quitarFoto', {}, ana.llave)).json.usuario.foto).toBeNull();
    expect(existsSync(path.join(FOTOS, path.basename(segunda)))).toBe(false);
  });

  it('la foto tiene que ser una imagen y no muy grande', async () => {
    const ana = await persona('Ana');
    expect(await call('subirFoto', { imagen: Buffer.from('<svg>hola</svg>').toString('base64') }, ana.llave)).toEqual({
      status: 400,
      json: { error: 'Elige una foto (JPG, PNG o WebP)' },
    });
    expect((await call('subirFoto', {}, ana.llave)).status).toBe(400);
    const grande = Buffer.concat([JPEG, Buffer.alloc(1_600_000)]).toString('base64');
    expect((await call('subirFoto', { imagen: grande }, ana.llave)).json.error).toBe('La foto es demasiado grande');
  });
});

describe.skipIf(!DB_URL || !HAS_DATA)('Entrar con Facebook (Auth.js)', () => {
  it('dice qué proveedores tienen sus claves', async () => {
    expect((await call('proveedores')).json).toEqual({ google: false, apple: false, facebook: true });
    expect((await call('proveedorInicio', { proveedor: 'google', modo: 'entrar' })).status).toBe(503);
  });

  it('entrar con Facebook crea la cuenta con su nombre, su correo y su foto; la segunda vez entra en la misma', async () => {
    const correo = unique('lidia').correo;
    const code = fbPersona('Lidia de Tiatira', { email: correo, foto: true });

    const { url, estado } = await inicio('entrar');
    expect(url).toMatch(/^http:\/\/localhost\/api\/auth\/ir\?pase=/);
    const nav = new Navegador();
    const dialog = await aFacebook(nav, url);
    expect(dialog.origin + dialog.pathname).toBe('https://facebook.test/dialog');
    expect(Object.fromEntries(dialog.searchParams)).toMatchObject({
      client_id: 'app-1',
      scope: 'public_profile email',
      redirect_uri: 'http://localhost/api/auth/callback/facebook',
    });
    expect((await resultado(estado)).json).toEqual({ pendiente: true });
    // El pase se gasta: la misma dirección no sirve otra vez.
    expect(await (await new Navegador().get(url)).text()).toContain('Este enlace ya se usó');

    expect(await vuelta(nav, dialog, { code })).toContain('Tu cuenta quedó creada');

    const r = await resultado(estado);
    expect(r.json.usuario).toMatchObject({
      nombre: 'Lidia de Tiatira',
      correo,
      cuentas: [{ proveedor: 'facebook', nombre: 'Lidia de Tiatira' }],
      conClave: false,
    });
    expect(r.json.usuario.foto).toMatch(/^\/fotos\//);
    expect((await call('yo', {}, r.json.llave)).json.usuario.id).toBe(r.json.usuario.id);
    // El resultado se recoge una sola vez.
    expect((await resultado(estado)).status).toBe(410);

    const otra = await viaje('entrar', { code });
    expect(otra.html).toContain('Qué bueno verte');
    expect((await resultado(otra.estado)).json.usuario.id).toBe(r.json.usuario.id);

    // Sin contraseña: entrar con el correo le dice que use Facebook, y no puede desconectarlo.
    expect((await call('entrar', { correo, clave: 'cualquier-cosa' })).json.error).toBe(
      'Esta cuenta entra con Facebook: toca «Continuar con Facebook».',
    );
    expect((await call('desconectarProveedor', { proveedor: 'facebook' }, r.json.llave)).status).toBe(409);
  });

  it('la vuelta solo cuenta en el navegador que abrió el enlace', async () => {
    const code = fbPersona('Simón el mago');
    const { url, estado } = await inicio('entrar');
    const nav = new Navegador();
    const dialog = await aFacebook(nav, url);
    // Otro navegador con la misma vuelta (sin las cookies del viaje) no termina nada.
    const ajeno = new Navegador();
    const res = await ajeno.get(`${dialog.searchParams.get('redirect_uri')}?${new URLSearchParams({ state: dialog.searchParams.get('state')!, code })}`);
    expect(res.status).toBe(302);
    expect(await (await ajeno.get(res.headers.get('location')!)).text()).toContain('No se pudo entrar');
    expect((await resultado(estado)).json).toEqual({ pendiente: true });
    // Sin el estado, que solo tiene la app, no se recoge la sesión.
    expect((await resultado('otro')).status).toBe(410);
  });

  it('también funciona con la ruta reescrita por vercel.json (/api/auth?ruta=…)', async () => {
    const code = fbPersona('Juan Marcos');
    const { url, estado } = await inicio('entrar');
    const nav = new Navegador();
    const dialog = await aFacebook(nav, url.replace('/api/auth/ir?', '/api/auth?ruta=ir&'));
    const q = new URLSearchParams({ ruta: 'callback/facebook', state: dialog.searchParams.get('state')!, code });
    const res = await nav.get(`http://localhost/api/auth?${q}`);
    expect(await (await nav.get(res.headers.get('location')!)).text()).toContain('Tu cuenta quedó creada');
    expect((await resultado(estado)).json.usuario).toMatchObject({ nombre: 'Juan Marcos' });
  });

  it('conectar desde el perfil; la misma cuenta de Facebook no se conecta a dos cuentas', async () => {
    const ana = await persona('Ana', true);
    const code = fbPersona('Ana en Facebook', { foto: true });
    const t = await viaje('conectar', { code }, ana.llave);
    expect(t.html).toContain('Facebook quedó conectado');
    const r = await resultado(t.estado);
    expect(r.json.llave).toBeUndefined();
    expect(r.json.usuario).toMatchObject({ id: ana.id, nombre: ana.nombre, cuentas: [{ proveedor: 'facebook', nombre: 'Ana en Facebook' }] });
    expect(r.json.usuario.foto).toMatch(/^\/fotos\//);

    // Entrar con ese Facebook abre la cuenta de Ana.
    const e = await viaje('entrar', { code });
    expect((await resultado(e.estado)).json.usuario.id).toBe(ana.id);

    const beto = await persona('Beto', true);
    const b = await viaje('conectar', { code }, beto.llave);
    expect(b.html).toContain('ya está conectada a otra cuenta');
    expect((await resultado(b.estado)).json.error).toBe('Esa cuenta de Facebook ya está conectada a otra cuenta de Zarza.');

    // Con contraseña sí puede desconectarlo; la foto se queda.
    const d = await call('desconectarProveedor', { proveedor: 'facebook' }, ana.llave);
    expect(d.json.usuario).toMatchObject({ cuentas: [], foto: r.json.usuario.foto });
    expect((await call('yo', {}, ana.llave)).json.usuario.cuentas).toEqual([]);
    expect((await call('proveedorInicio', { proveedor: 'facebook', modo: 'conectar' })).status).toBe(401);
  });

  it('no se une a una cuenta existente solo por el correo, y cancelar en Facebook avisa', async () => {
    const ana = await persona('Ana', true);
    const code = fbPersona('Ana', { email: ana.correo });
    const t = await viaje('entrar', { code });
    expect((await resultado(t.estado)).json.error).toMatch(/^Ya tienes una cuenta con el correo de tu Facebook/);

    const c = await viaje('entrar', { error: 'access_denied' });
    expect(c.html).toContain('No se conectó con Facebook.');
    expect((await resultado(c.estado)).json.error).toBe('No se conectó con Facebook.');
  });

  it('las rutas de Auth.js que la app no usa no se abren', async () => {
    for (const ruta of ['signin/facebook', 'session', 'csrf', 'providers', 'signout']) {
      expect((await AUTH(new Request(`http://localhost/api/auth/${ruta}`))).status).toBe(404);
    }
  });
});
