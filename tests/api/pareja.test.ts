// «En pareja» (api/_pareja.ts, por /api/comunidades) contra un Postgres de verdad (DATABASE_URL). Ver tests/api/helpers.ts.
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, Post, prepareEnv, unique } from './helpers';

const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = local(new Date());
const MANANA = local(new Date(Date.now() + 86_400_000));

let POST: Post;
let call: ReturnType<typeof client>;
let callManana: ReturnType<typeof client>;
let sql: ReturnType<typeof postgres>;

beforeAll(async () => {
  await prepareEnv();
  ({ POST } = await import('../../api/comunidades'));
  call = client(POST, HOY);
  callManana = client(POST, MANANA);
  if (DB_URL) {
    await ensureSchema(POST);
    sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
  }
});

afterAll(async () => {
  await sql?.end();
});

async function persona(name: string) {
  const { nombre } = unique(name);
  const r = await call<{ llave: string; usuario: { id: string } }>('registrarse', { nombre });
  expect(r.status).toBe(200);
  return { llave: r.json.llave, id: r.json.usuario.id, nombre };
}

/** Dos cuentas ya unidas como pareja. */
async function pareja(etapa = 'casados') {
  const a = await persona('Ana');
  const b = await persona('Beto');
  const inv = await call('parejaInvitar', { etapa }, a.llave);
  expect(inv.status).toBe(200);
  const codigo = inv.json.pareja.codigo as string;
  expect(codigo).toMatch(/^[A-Z0-9]{6}$/);
  const r = await call('parejaUnirse', { codigo }, b.llave);
  expect(r.status).toBe(200);
  return { a, b, codigo };
}

describe.skipIf(!DB_URL)('/api/comunidades: en pareja', () => {
  it('sin cuenta no hay nada', async () => {
    expect((await call('parejaEstado')).status).toBe(401);
  });

  it('invitar, ver la invitación y unirse', async () => {
    const a = await persona('Ana');
    const b = await persona('Beto');
    expect((await call('parejaEstado', {}, a.llave)).json.pareja).toBeNull();
    expect((await call('parejaInvitar', { etapa: 'amigos' }, a.llave)).status).toBe(400);

    const inv = await call('parejaInvitar', { etapa: 'novios' }, a.llave);
    expect(inv.json.pareja).toMatchObject({ etapa: 'novios', plan: 'cordon', otro: null, soyQuienInvito: true });
    // Pedirla otra vez devuelve la misma
    const otra = await call('parejaInvitar', { etapa: 'novios' }, a.llave);
    expect(otra.json.pareja.codigo).toBe(inv.json.pareja.codigo);

    const ver = await call('parejaVerCodigo', { codigo: inv.json.pareja.codigo.toLowerCase() }, b.llave);
    expect(ver.json).toMatchObject({ nombre: a.nombre, etapa: 'novios', esMio: false });
    expect((await call('parejaUnirse', { codigo: inv.json.pareja.codigo }, a.llave)).status).toBe(400);

    const r = await call('parejaUnirse', { codigo: inv.json.pareja.codigo }, b.llave);
    expect(r.json.pareja.otro.nombre).toBe(a.nombre);
    expect(r.json.pareja.progreso).toEqual({ dia: 1, abierto: true, terminado: false });
    // El código ya no sirve para nadie más
    const c = await persona('Carla');
    expect((await call('parejaUnirse', { codigo: inv.json.pareja.codigo }, c.llave)).status).toBe(404);
    expect((await call('parejaInvitar', { etapa: 'casados' }, b.llave)).status).toBe(409);
  });

  it('la respuesta del otro se ve solo después de responder', async () => {
    const { a, b } = await pareja();
    expect((await call('parejaResponder', { plan: 'cordon', dia: 2, texto: 'antes de tiempo' }, a.llave)).status).toBe(409);
    expect((await call('parejaResponder', { plan: 'honra-no-existe', dia: 1, texto: 'x' }, a.llave)).status).toBe(400);

    expect((await call('parejaResponder', { plan: 'cordon', dia: 1, texto: '  Cuando me ayudó con mi mamá.  ' }, a.llave)).status).toBe(200);
    const deB = await call('parejaDia', { plan: 'cordon', dia: 1 }, b.llave);
    expect(deB.json).toEqual({ abierto: true, mia: null, suya: null, suyaEspera: true });
    const deA = await call('parejaDia', { plan: 'cordon', dia: 1 }, a.llave);
    expect(deA.json.mia.texto).toBe('Cuando me ayudó con mi mamá.');
    expect(deA.json.suya).toBeNull();
    expect(deA.json.suyaEspera).toBe(false);

    await call('parejaResponder', { plan: 'cordon', dia: 1, texto: 'Cuando oró por mi trabajo.' }, b.llave);
    expect((await call('parejaDia', { plan: 'cordon', dia: 1 }, a.llave)).json.suya.texto).toBe('Cuando oró por mi trabajo.');
    expect((await call('parejaDia', { plan: 'cordon', dia: 1 }, b.llave)).json.suya.texto).toBe('Cuando me ayudó con mi mamá.');

    // Hecho por los dos: el día 2 se abre mañana, no hoy
    const hoy = await call('parejaEstado', {}, a.llave);
    expect(hoy.json.pareja.hechos).toEqual({ 1: HOY });
    expect(hoy.json.pareja.progreso).toEqual({ dia: 2, abierto: false, terminado: false });
    expect(hoy.json.pareja.cordon.nudos).toBe(1);
    expect((await call('parejaResponder', { plan: 'cordon', dia: 2, texto: 'todavía no' }, a.llave)).status).toBe(409);
    expect((await callManana('parejaEstado', {}, a.llave)).json.pareja.progreso).toEqual({ dia: 2, abierto: true, terminado: false });
    expect((await callManana('parejaResponder', { plan: 'cordon', dia: 2, texto: 'ahora sí' }, a.llave)).status).toBe(200);

    // Borrar la propia respuesta
    await call('parejaBorrarRespuesta', { plan: 'cordon', dia: 1 }, b.llave);
    expect((await call('parejaDia', { plan: 'cordon', dia: 1 }, a.llave)).json.suya).toBeNull();
  });

  it('nadie de afuera ve lo de la pareja', async () => {
    const { a } = await pareja();
    await call('parejaResponder', { plan: 'cordon', dia: 1, texto: 'privado' }, a.llave);
    const c = await persona('Carla');
    expect((await call('parejaDia', { plan: 'cordon', dia: 1 }, c.llave)).status).toBe(404);
    expect((await call('parejaEstado', {}, c.llave)).json.pareja).toBeNull();
  });

  it('pedidos de oración y «oré por ti» una vez al día', async () => {
    const { a, b } = await pareja();
    const p = await call('parejaPedido', { texto: 'Por mi entrevista del jueves' }, a.llave);
    expect(p.json.pareja.pedidos).toEqual({ mio: 'Por mi entrevista del jueves', suyo: null });
    expect((await call('parejaEstado', {}, b.llave)).json.pareja.pedidos.suyo).toBe('Por mi entrevista del jueves');

    const o = await call('parejaOre', {}, b.llave);
    expect(o.json.pareja.oreHoy).toBe(true);
    expect((await call('parejaOre', {}, b.llave)).status).toBe(200);
    const deA = await call('parejaEstado', {}, a.llave);
    expect(deA.json.pareja).toMatchObject({ oroHoy: true, oreHoy: false });

    await call('parejaPedido', { texto: '' }, a.llave);
    expect((await call('parejaEstado', {}, a.llave)).json.pareja.pedidos.mio).toBeNull();
  });

  it('planes según la etapa y cambio de plan', async () => {
    const { a, b } = await pareja('novios');
    expect((await call('parejaPlan', { plan: 'honra' }, a.llave)).status).toBe(400);
    expect((await call('parejaPlan', { plan: 'antes-del-si' }, a.llave)).json.pareja.plan).toBe('antes-del-si');
    // Al casarse, un plan solo para novios cambia al primero de casados
    expect((await call('parejaEtapa', { etapa: 'casados' }, b.llave)).json.pareja).toMatchObject({ etapa: 'casados', plan: 'cordon' });
    expect((await call('parejaPlan', { plan: 'honra' }, a.llave)).json.pareja.plan).toBe('honra');
  });

  it('desvincularse borra lo compartido', async () => {
    const { a, b } = await pareja();
    await call('parejaResponder', { plan: 'cordon', dia: 1, texto: 'se borra' }, a.llave);
    const [{ id }] = await sql<{ id: string }[]>`select id from parejas where a = ${a.id}`;
    expect((await call('parejaSalir', {}, b.llave)).json.pareja).toBeNull();
    expect((await call('parejaEstado', {}, a.llave)).json.pareja).toBeNull();
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from pareja_respuestas where pareja_id = ${id}`;
    expect(n).toBe(0);
    // Y se puede volver a invitar
    expect((await call('parejaInvitar', { etapa: 'casados' }, a.llave)).status).toBe(200);
  });

  it('quien tenía una invitación esperando y acepta otra queda solo con la nueva', async () => {
    const a = await persona('Ana');
    const b = await persona('Beto');
    await call('parejaInvitar', { etapa: 'casados' }, b.llave);
    const inv = await call('parejaInvitar', { etapa: 'casados' }, a.llave);
    const r = await call('parejaUnirse', { codigo: inv.json.pareja.codigo }, b.llave);
    expect(r.json.pareja.otro.nombre).toBe(a.nombre);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from parejas where a = ${b.id} or b = ${b.id}`;
    expect(n).toBe(1);
  });
});
