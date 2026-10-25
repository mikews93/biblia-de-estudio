// /api/notificaciones y los avisos de /api/comunidades contra Postgres (DATABASE_URL) y un servicio push simulado
// (e2e/support/mock-push.ts) que descifra lo que recibe. Ver tests/api/helpers.ts.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { localNow } from '../../src/lib/avisosTexto';
import { entregas, handlePush, nuevaSuscripcion } from '../../e2e/support/mock-push';
import { client, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request, unique } from './helpers';

let POST: Post;
let GET: Post;
let comunidades: Post;
let server: Server;
let base: string;
let sql: ReturnType<typeof postgres>;

beforeAll(async () => {
  await prepareEnv();
  process.env.PUSH_HOSTS = '127.0.0.1';
  ({ POST, GET } = await import('../../api/notificaciones'));
  ({ POST: comunidades } = await import('../../api/comunidades'));
  server = createServer((req, res) => {
    void handlePush(req, res).then((handled) => {
      if (!handled) res.writeHead(404).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (DB_URL) {
    await ensureSchema(comunidades);
    sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
  }
});

afterAll(async () => {
  server?.close();
  await sql?.end();
});

const call = async (accion: string, body: Record<string, unknown> = {}, llave?: string) => {
  const res = await POST(request('/api/notificaciones', { accion, ...body }, llave));
  return { status: res.status, json: (await res.json()) as Record<string, any> };
};
const deliveredTo = (id: string) => entregas.filter((e) => e.id === id);
/** El programador puede volver a llamar ya (la ronda anterior deja una pausa de 50 s). */
const enviar = async () => {
  await sql`delete from ajustes where clave = 'ultimo_envio'`;
  return call('enviar');
};

describe('/api/notificaciones: peticiones mal formadas', () => {
  it('JSON roto, acciones que no existen y GET sin enviar', async () => {
    expect((await POST(request('/api/notificaciones', '{roto'))).status).toBe(400);
    for (const accion of ['noExiste', 'constructor', '__proto__']) expect((await call(accion)).status).toBe(400);
    expect((await GET(new Request('http://localhost/api/notificaciones?accion=guardar'))).status).toBe(400);
  });
});

describe.skipIf(!DB_URL)('/api/notificaciones con Postgres', () => {
  it('la clave pública VAPID se crea una vez y no cambia', async () => {
    const a = (await call('clave')).json.clave;
    const b = (await call('clave')).json.clave;
    expect(a).toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(65);
  });

  it('rechaza direcciones que no son de un servicio push y claves mal formadas', async () => {
    const sub = nuevaSuscripcion(base);
    const bad = async (suscripcion: unknown) => {
      const r = await call('guardar', { suscripcion });
      expect(r.status).toBe(400);
      expect(r.json.error).toBe('Este navegador no dio una suscripción válida');
    };
    await bad({ ...sub, endpoint: 'https://evil.test/push' });
    await bad({ ...sub, endpoint: 'http://169.254.169.254/latest' });
    await bad({ ...sub, keys: { p256dh: 'corta', auth: sub.keys.auth } });
    await bad({ ...sub, keys: { p256dh: sub.keys.p256dh } });
    expect((await call('probar', { endpoint: 'https://evil.test/push' })).status).toBe(400);
  });

  it('la prueba llega cifrada, firmada y dice la hora elegida', async () => {
    const sub = nuevaSuscripcion(base);
    expect((await call('guardar', { suscripcion: sub, zona: 'America/Bogota', hora: 450 })).json).toEqual({ cuenta: false });
    expect((await call('probar', { endpoint: sub.endpoint })).json).toEqual({ enviado: true });
    const [e] = deliveredTo(sub.id);
    expect(e.aviso).toEqual({
      title: '¡Listo! Las notificaciones funcionan',
      body: 'Te recordaremos tu lectura cada día a las 7:30 de la mañana.',
      url: '/notificaciones',
      tag: 'prueba',
    });
    expect(e.headers['content-encoding']).toBe('aes128gcm');
    expect(e.headers.ttl).toBe(String(12 * 3600));
    expect(e.headers.topic).toBe('prueba');
    expect(e.headers.authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  });

  it('el recordatorio diario llega a su hora, con lo que toca leer, y solo una vez al día', async () => {
    const sub = nuevaSuscripcion(base);
    const estado = { leido: '2000-01-01', lectura: { titulo: 'Juan 4', url: '/juan/4' }, tarjetas: ['2000-01-01', '2999-01-01'] };
    await call('guardar', { suscripcion: sub, zona: 'UTC', hora: 0, estado });
    // Pasaron 5 minutos de la hora elegida y aún no se le mandó hoy.
    const now = localNow('UTC');
    await sql`update suscripciones set hora = ${Math.max(0, now.minutos - 5)}, enviado = null where endpoint = ${sub.endpoint}`;

    const r = await enviar();
    expect(r.status).toBe(200);
    expect(deliveredTo(sub.id).map((e) => e.aviso)).toEqual([
      { title: 'Tu lectura de hoy', body: 'Juan 4 te espera. También tienes 1 tarjeta para repasar.', url: '/juan/4', tag: 'diario' },
    ]);
    const [{ enviado }] = await sql`select enviado::text from suscripciones where endpoint = ${sub.endpoint}`;
    expect(enviado).toBe(now.fecha);

    await enviar();
    expect(deliveredTo(sub.id)).toHaveLength(1);
  });

  it('dos llamadas seguidas del programador hacen una sola ronda', async () => {
    await enviar();
    expect((await call('enviar')).json).toEqual({ enviados: 0, pausa: true });
    const res = await GET(new Request('http://localhost/api/notificaciones?accion=enviar'));
    expect(await res.json()).toEqual({ enviados: 0, pausa: true });
  });

  it('al activarlas después de su hora, el primero llega mañana; si ya leyó, no escribe', async () => {
    const late = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: late, zona: 'UTC', hora: 0 });
    const read = nuevaSuscripcion(base);
    const today = localNow('UTC').fecha;
    await call('guardar', { suscripcion: read, zona: 'UTC', hora: 0, avisos: { tarjetas: false }, estado: { leido: today, tarjetas: [today] } });
    await sql`update suscripciones set hora = ${Math.max(0, localNow('UTC').minutos - 5)}, enviado = null where endpoint = ${read.endpoint}`;
    await enviar();
    expect(deliveredTo(late.id)).toHaveLength(0);
    expect(deliveredTo(read.id)).toHaveLength(0);
    const [{ enviado }] = await sql`select enviado::text from suscripciones where endpoint = ${read.endpoint}`;
    expect(enviado).toBe(today);
  });

  it('el dispositivo pone al día su resumen; datos raros se limpian', async () => {
    const sub = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: sub });
    const r = await call('estado', {
      endpoint: sub.endpoint,
      estado: { leido: 'ayer', lectura: { titulo: 'Juan 5', url: 'https://otro.sitio/' }, tarjetas: ['2026-10-20', 'x'], extra: 1 },
    });
    expect(r.json).toEqual({ existe: true });
    const [row] = await sql`select estado from suscripciones where endpoint = ${sub.endpoint}`;
    expect(row.estado).toEqual({ tarjetas: ['2026-10-20'] });
    expect((await call('estado', { endpoint: `${base}/__push/no-existe`, estado: {} })).json).toEqual({ existe: false });
  });

  it('devuelve las preferencias guardadas para recuperarlas si la app perdió sus datos', async () => {
    const sub = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: sub, hora: 21 * 60, avisos: { tarjetas: false } });
    expect((await call('leer', { endpoint: sub.endpoint })).json).toEqual({
      existe: true,
      hora: 21 * 60,
      avisos: { lectura: true, tarjetas: false, reto: true, racha: true, comunidad: true },
      despertar: null,
    });
    await call('guardar', { suscripcion: sub, hora: 21 * 60, despertar: { activo: true, hora: 330, dias: 0b0111110 } });
    expect((await call('leer', { endpoint: sub.endpoint })).json.despertar).toEqual({ hora: 330, dias: 0b0111110 });
    expect((await call('leer', { endpoint: `${base}/__push/no-existe` })).json).toEqual({ existe: false });
  });

  it('el despertador suena a su hora, en sus días, con prioridad alta y una sola vez', async () => {
    const sub = nuevaSuscripcion(base);
    const now = localNow('UTC');
    const today = 1 << new Date(`${now.fecha}T12:00:00Z`).getUTCDay();
    const estado = { leido: now.fecha, lectura: { titulo: 'Juan 4', url: '/juan/4' } };
    // Todo apagado salvo el despertador: suena igual.
    await call('guardar', {
      suscripcion: sub,
      zona: 'UTC',
      avisos: { lectura: false, tarjetas: false, reto: false },
      despertar: { activo: true, hora: 0, dias: 127 },
      estado,
    });
    await sql`update suscripciones set despertar = ${Math.max(0, now.minutos - 2)}, despertar_enviado = null where endpoint = ${sub.endpoint}`;

    const r = await enviar();
    expect(r.json.despertados).toBeGreaterThanOrEqual(1);
    const [e] = deliveredTo(sub.id);
    expect(e.aviso).toEqual({
      title: 'Buenos días ☀',
      body: 'Música suave, el versículo del día y Juan 4 te esperan. Toca para empezar el día con la Palabra.',
      url: '/despertar?alarma=1',
      tag: 'despertar',
      alarma: true,
    });
    expect(e.headers.urgency).toBe('high');
    expect(e.headers.ttl).toBe(String(30 * 60));

    await enviar();
    expect(deliveredTo(sub.id)).toHaveLength(1);

    // Otro dispositivo con la misma hora pero hoy fuera de sus días: no suena.
    const libre = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: libre, zona: 'UTC', avisos: { lectura: false, tarjetas: false, reto: false }, despertar: { hora: 0, dias: 127 ^ today } });
    await sql`update suscripciones set despertar = ${Math.max(0, now.minutos - 2)}, despertar_enviado = null where endpoint = ${libre.endpoint}`;
    await enviar();
    expect(deliveredTo(libre.id)).toHaveLength(0);
  });

  it('la noche del último día de la racha devocional avisa una sola vez; sin racha o con el aviso apagado, no', async () => {
    // Una zona donde ahora son entre las 8 y las 11 de la noche.
    const zona = Array.from({ length: 27 }, (_, i) => i - 12)
      .map((n) => (n === 0 ? 'UTC' : `Etc/GMT${n > 0 ? '+' : '-'}${Math.abs(n)}`))
      .find((z) => {
        const m = localNow(z).minutos;
        return m >= 20 * 60 && m < 23 * 60;
      })!;
    const hoy = localNow(zona).fecha;
    const apagado = { lectura: false, tarjetas: false, reto: false };
    const sub = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: sub, zona, avisos: apagado, estado: { racha: { dias: 6, vence: hoy } } });
    const otro = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: otro, zona, avisos: { ...apagado, racha: false }, estado: { racha: { dias: 6, vence: hoy } } });
    const aSalvo = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: aSalvo, zona, avisos: apagado, estado: { racha: { dias: 6, vence: '2999-01-01' } } });

    const r = await enviar();
    expect(r.json.rachas).toBeGreaterThanOrEqual(1);
    expect(deliveredTo(sub.id).map((e) => e.aviso)).toEqual([
      {
        title: 'Tu racha de 6 días te espera',
        body: 'Hoy es el último día para no perderla. Diez minutos con la Palabra bastan. Te falta un día para los 7.',
        url: '/diario?hoy=1',
        tag: 'racha',
      },
    ]);
    await enviar();
    expect(deliveredTo(sub.id)).toHaveLength(1);
    expect(deliveredTo(otro.id)).toHaveLength(0);
    expect(deliveredTo(aSalvo.id)).toHaveLength(0);
    // Datos raros de la racha se limpian.
    await call('estado', { endpoint: sub.endpoint, estado: { racha: { dias: -1, vence: 'mañana' } } });
    const [row] = await sql`select estado from suscripciones where endpoint = ${sub.endpoint}`;
    expect(row.estado).toEqual({});
  });

  it('«10 minutos más» lo vuelve a mandar; apagar el despertador lo quita', async () => {
    const sub = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: sub, zona: 'UTC', avisos: { lectura: false, tarjetas: false, reto: false }, despertar: { hora: 0, dias: 127 } });
    // Activado después de su hora: hoy ya no suena.
    const [row] = await sql`select despertar_enviado::text as d from suscripciones where endpoint = ${sub.endpoint}`;
    expect(row.d).toBe(localNow('UTC').fecha);

    expect((await call('posponer', { endpoint: sub.endpoint })).json).toEqual({ minutos: 10 });
    await enviar();
    expect(deliveredTo(sub.id)).toHaveLength(0);
    await sql`update suscripciones set pospuesto = now() - interval '1 second' where endpoint = ${sub.endpoint}`;
    await enviar();
    expect(deliveredTo(sub.id).map((e) => e.aviso?.body)).toEqual(['Ya pasaron tus diez minutos. La música suave y la Palabra te esperan.']);

    await call('guardar', { suscripcion: sub, zona: 'UTC', despertar: { activo: false, hora: 0, dias: 127 } });
    expect((await call('posponer', { endpoint: sub.endpoint })).status).toBe(404);
  });

  it('si el navegador dio de baja la suscripción, se borra', async () => {
    const sub = nuevaSuscripcion(base, `caducada-${Date.now()}`);
    await call('guardar', { suscripcion: sub });
    const r = await call('probar', { endpoint: sub.endpoint });
    expect(r.status).toBe(410);
    expect(await sql`select 1 from suscripciones where endpoint = ${sub.endpoint}`).toHaveLength(0);
  });

  it('quitar la borra', async () => {
    const sub = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: sub });
    await call('quitar', { endpoint: sub.endpoint });
    expect((await call('probar', { endpoint: sub.endpoint })).status).toBe(404);
  });
});

describe.skipIf(!DB_URL || !HAS_DATA)('avisos de la comunidad', () => {
  const hoy = localNow(Intl.DateTimeFormat().resolvedOptions().timeZone).fecha;
  const com = () => client(comunidades, hoy);

  async function persona(name: string) {
    const r = await com()<{ llave: string; usuario: { id: string; nombre: string } }>('registrarse', { nombre: unique(name).nombre });
    return { llave: r.json.llave, id: r.json.usuario.id, nombre: r.json.usuario.nombre };
  }

  it('me gusta, comentarios e invitaciones de amistad llegan a quien los activó con su cuenta', async () => {
    const ana = await persona('Ana');
    const beto = await persona('Beto');
    const sub = nuevaSuscripcion(base);
    expect((await call('guardar', { suscripcion: sub }, ana.llave)).json).toEqual({ cuenta: true });

    const post = (await com()('publicar', { tipo: 'pregunta', audiencia: 'todos', texto: '¿Qué es la gracia?' }, ana.llave)).json.id;
    // Su propio «me gusta» no le avisa.
    await com()('meGusta', { id: post }, ana.llave);
    expect(deliveredTo(sub.id)).toHaveLength(0);

    await com()('meGusta', { id: post }, beto.llave);
    await com()('meGusta', { id: post }, beto.llave);
    await com()('comentar', { id: post, texto: 'Un regalo que no merecemos.' }, beto.llave);
    await com()('pedirAmistad', { usuario: ana.id }, beto.llave);

    expect(deliveredTo(sub.id).map((e) => e.aviso)).toEqual([
      {
        title: `A ${beto.nombre} y otra persona les gusta tu pregunta`,
        body: '¿Qué es la gracia?',
        url: `/comunidades/publicacion/${post}`,
        tag: `megusta-${post}`,
      },
      {
        title: `${beto.nombre} comentó tu publicación`,
        body: 'Un regalo que no merecemos.',
        url: `/comunidades/publicacion/${post}`,
        tag: `comentario-${post}`,
      },
      {
        title: `${beto.nombre} quiere ser tu amigo`,
        body: 'Acepta su invitación para ver lo que lee y comparte en la comunidad.',
        url: '/comunidades/amigos',
        tag: `amistad-${beto.id}`,
      },
    ]);
  });

  it('sin el aviso de comunidad, o tras borrar la cuenta, no llegan', async () => {
    const ana = await persona('Ana');
    const beto = await persona('Beto');
    const sub = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: sub, avisos: { comunidad: false } }, ana.llave);
    await com()('pedirAmistad', { usuario: ana.id }, beto.llave);
    expect(deliveredTo(sub.id)).toHaveLength(0);

    await call('guardar', { suscripcion: sub }, ana.llave);
    await com()('borrarCuenta', {}, ana.llave);
    const [row] = await sql`select usuario_id from suscripciones where endpoint = ${sub.endpoint}`;
    expect(row.usuario_id).toBeNull();
  });

  it('quien administra un grupo sabe cuándo alguien se une', async () => {
    const ana = await persona('Ana');
    const beto = await persona('Beto');
    const sub = nuevaSuscripcion(base);
    await call('guardar', { suscripcion: sub }, ana.llave);
    const { id } = (await com()('crearGrupo', { nombre: 'Célula del martes', tipo: 'celula' }, ana.llave)).json;
    const { grupo } = (await com()('grupo', { grupo: id }, ana.llave)).json;
    await com()('unirse', { codigo: grupo.codigo }, beto.llave);
    await com()('unirse', { codigo: grupo.codigo }, beto.llave);
    expect(deliveredTo(sub.id).map((e) => e.aviso)).toEqual([
      {
        title: `${beto.nombre} se unió a Célula del martes`,
        body: 'Aceptó tu invitación. Ya puede leer el plan con el grupo.',
        url: `/grupos/${id}`,
        tag: `grupo-${id}`,
      },
    ]);
  });
});
