// El perfil en /api/comunidades: guardar los datos, la foto (en una carpeta en vez de Vercel Blob) y entrar o
// conectar la cuenta con un Facebook simulado. Ver tests/api/helpers.ts.
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
let GET: (r: Request) => Promise<Response>;
let call: ReturnType<typeof client>;

beforeAll(async () => {
  await prepareEnv();
  const fb = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/oauth/access_token') {
      const code = url.searchParams.get('code')!;
      if (!fbPeople[code] || url.searchParams.get('client_secret') !== 'secreto') {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: { message: 'código no válido' } }));
      }
      return res.end(JSON.stringify({ access_token: `tok-${code}` }));
    }
    if (url.pathname === '/me') {
      const p = fbPeople[url.searchParams.get('access_token')!.slice(4)];
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
  });
  ({ POST, facebookCallback: GET } = await import('../../api/comunidades'));
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

/** Empieza el viaje a Facebook y devuelve el estado y la cookie que dejó el servidor. */
async function inicio(modo: 'entrar' | 'conectar', llave?: string) {
  const res = await POST(request('/api/comunidades', { accion: 'facebookInicio', modo, hoy: HOY }, llave));
  const json = (await res.json()) as { url: string; estado: string };
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  return { ...json, cookie };
}

const vuelta = (q: Record<string, string>, cookie?: string) =>
  GET(new Request(`http://localhost/api/facebook?${new URLSearchParams(q)}`, { headers: cookie ? { cookie } : {} }));

async function resultado(estado: string, cookie?: string) {
  const res = await POST(
    new Request('http://localhost/api/comunidades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ accion: 'facebookResultado', estado, hoy: HOY }),
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, any> };
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

  it('el apodo con que Hoy saluda se guarda, y una app que no lo manda no lo borra', async () => {
    const ana = await persona('Ana');
    expect((await call('guardarPerfil', { nombre: 'Ana María', apodo: ' Anita ' }, ana.llave)).json.usuario.apodo).toBe('Anita');
    expect((await call('guardarPerfil', { nombre: 'Ana María', bio: 'Hola' }, ana.llave)).json.usuario.apodo).toBe('Anita');
    expect((await call('yo', {}, ana.llave)).json.usuario.apodo).toBe('Anita');
    expect((await call('guardarPerfil', { nombre: 'Ana María', apodo: '' }, ana.llave)).json.usuario.apodo).toBeNull();
    expect((await call('guardarPerfil', { nombre: 'Ana', apodo: 'x'.repeat(25) }, ana.llave)).json.error).toBe(
      'Es demasiado largo (máximo 24 caracteres)',
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

describe.skipIf(!DB_URL || !HAS_DATA)('Facebook', () => {
  it('entrar con Facebook crea la cuenta con su nombre, su correo y su foto; la segunda vez entra en la misma', async () => {
    expect((await call('facebookDisponible')).json).toEqual({ disponible: true });
    const correo = unique('lidia').correo;
    const code = fbPersona('Lidia de Tiatira', { email: correo, foto: true });

    const { url, estado, cookie } = await inicio('entrar');
    const dialog = new URL(url);
    expect(dialog.origin + dialog.pathname).toBe('https://facebook.test/dialog');
    expect(Object.fromEntries(dialog.searchParams)).toMatchObject({
      client_id: 'app-1',
      state: estado,
      scope: 'public_profile,email',
      redirect_uri: 'http://localhost/api/facebook',
    });
    expect((await resultado(estado, cookie)).json).toEqual({ pendiente: true });

    const page = await vuelta({ code, state: estado }, cookie);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('Tu cuenta quedó creada');

    const r = await resultado(estado, cookie);
    expect(r.json.usuario).toMatchObject({ nombre: 'Lidia de Tiatira', correo, facebook: 'Lidia de Tiatira', conClave: false });
    expect(r.json.usuario.foto).toMatch(/^\/fotos\//);
    expect((await call('yo', {}, r.json.llave)).json.usuario.id).toBe(r.json.usuario.id);
    // El resultado se recoge una sola vez.
    expect((await resultado(estado, cookie)).status).toBe(410);

    const otra = await inicio('entrar');
    await vuelta({ code, state: otra.estado }, otra.cookie);
    expect((await resultado(otra.estado, otra.cookie)).json.usuario.id).toBe(r.json.usuario.id);

    // Sin contraseña: entrar con el correo le dice que use Facebook, y no puede desconectarlo.
    expect((await call('entrar', { correo, clave: 'cualquier-cosa' })).json.error).toBe('Esta cuenta se creó con Facebook: entra con Facebook.');
    expect((await call('desconectarFacebook', {}, r.json.llave)).status).toBe(409);
  });

  it('el viaje queda atado al navegador que lo empezó', async () => {
    const code = fbPersona('Simón el mago');
    const { estado, cookie } = await inicio('entrar');
    // Alguien que solo conoce el estado (por ejemplo, porque mandó el enlace) no puede recoger la sesión.
    expect((await resultado(estado)).status).toBe(403);
    expect((await resultado(estado, 'facebook_viaje=otro')).status).toBe(403);
    // Ni completar la vuelta en otro navegador.
    expect(await (await vuelta({ code, state: estado })).text()).toContain('No se pudo conectar');
    expect((await resultado(estado, cookie)).json).toEqual({ pendiente: true });
  });

  it('conectar desde el perfil; la misma cuenta de Facebook no se conecta a dos cuentas', async () => {
    const ana = await persona('Ana', true);
    const code = fbPersona('Ana en Facebook', { foto: true });
    const t = await inicio('conectar', ana.llave);
    expect(await (await vuelta({ code, state: t.estado }, t.cookie)).text()).toContain('quedó conectada');
    const r = await resultado(t.estado, t.cookie);
    expect(r.json.llave).toBeUndefined();
    expect(r.json.usuario).toMatchObject({ id: ana.id, nombre: ana.nombre, facebook: 'Ana en Facebook' });
    expect(r.json.usuario.foto).toMatch(/^\/fotos\//);

    // Entrar con ese Facebook abre la cuenta de Ana.
    const e = await inicio('entrar');
    await vuelta({ code, state: e.estado }, e.cookie);
    expect((await resultado(e.estado, e.cookie)).json.usuario.id).toBe(ana.id);

    const beto = await persona('Beto', true);
    const b = await inicio('conectar', beto.llave);
    await vuelta({ code, state: b.estado }, b.cookie);
    expect((await resultado(b.estado, b.cookie)).json.error).toBe('Esa cuenta de Facebook ya está conectada a otra cuenta de la app.');

    // Con contraseña sí puede desconectarlo; la foto se queda.
    const d = await call('desconectarFacebook', {}, ana.llave);
    expect(d.json.usuario).toMatchObject({ facebook: null, foto: r.json.usuario.foto });
    expect((await call('facebookInicio', { modo: 'conectar' })).status).toBe(401);
  });

  it('no se une a una cuenta existente solo por el correo, y cancelar en Facebook avisa', async () => {
    const ana = await persona('Ana', true);
    const code = fbPersona('Ana', { email: ana.correo });
    const t = await inicio('entrar');
    await vuelta({ code, state: t.estado }, t.cookie);
    expect((await resultado(t.estado, t.cookie)).json.error).toMatch(/^Ya tienes una cuenta con el correo de tu Facebook/);

    const c = await inicio('entrar');
    await vuelta({ error: 'access_denied', state: c.estado }, c.cookie);
    expect((await resultado(c.estado, c.cookie)).json.error).toBe('No se conectó con Facebook.');
  });
});
