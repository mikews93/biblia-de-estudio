// «Círculo de solteros» (api/_circulo.ts, por /api/comunidades) contra un Postgres de verdad (DATABASE_URL).
// Ver tests/api/helpers.ts.
import { beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, Post, prepareEnv, unique } from './helpers';

let POST: Post;
const cuidadora = unique('Cuidadora');
// Tres semanas seguidas, para responder la pregunta de cada una.
const S1 = '2026-10-19';
const S2 = '2026-10-26';
const S3 = '2026-11-02';
const call = (hoy = S3) => client(POST, hoy);

beforeAll(async () => {
  process.env.CUIDADORES = cuidadora.correo;
  await prepareEnv();
  ({ POST } = await import('../../api/comunidades'));
  if (DB_URL) {
    await ensureSchema(POST);
    await call()('registrarse', { nombre: cuidadora.nombre, correo: cuidadora.correo, clave: 'una clave larga' });
  }
});

async function persona(name: string, extra: Record<string, unknown> = {}) {
  const u = unique(name);
  const r = await call()('registrarse', { nombre: u.nombre, correo: u.correo, clave: 'una clave larga', ...extra });
  expect(r.status).toBe(200);
  return { llave: r.json.llave as string, id: r.json.usuario.id as string, ...u };
}

/** Una iglesia con un círculo de 18 a 35 y una líder. */
async function iglesia() {
  const cuida = (await call()('entrar', { correo: cuidadora.correo, clave: 'una clave larga' })).json.llave as string;
  const ig = await call()('cuidarNuevaIglesia', { nombre: 'Vida Nueva' }, cuida);
  expect(ig.status).toBe(200);
  const nuevo = await call()('cuidarNuevoCirculo', { iglesia: ig.json.iglesia.id, nombre: 'Jóvenes adultos', edadMin: 18, edadMax: 35 }, cuida);
  expect(nuevo.status).toBe(200);
  const lider = await persona('Lidia');
  expect((await call()('cuidarLiderCirculo', { circulo: nuevo.json.id, correo: lider.correo.toUpperCase() }, cuida)).status).toBe(200);
  return { codigo: ig.json.iglesia.codigo as string, iglesiaId: ig.json.iglesia.id as string, circulo: nuevo.json.id as string, lider, cuida };
}

/** Alguien de la iglesia que entra al círculo y la líder aprueba. */
async function miembro(name: string, ig: Awaited<ReturnType<typeof iglesia>>, etapa = 'abierto') {
  const p = await persona(name);
  await call()('iglesiaUnirme', { codigo: ig.codigo }, p.llave);
  const r = await call()('circuloPedir', { circulo: ig.circulo, nacimiento: '2000-05-10', acepto: true, etapa }, p.llave);
  expect(r.status).toBe(200);
  expect((await call()('circuloAprobar', { usuario: p.id, si: true }, ig.lider.llave)).status).toBe(200);
  return p;
}

const responder = (llave: string, hoy: string) => call(hoy)('circuloResponder', { texto: `Lo que pienso en ${hoy}` }, llave);

describe.skipIf(!DB_URL)('/api/comunidades: círculo de solteros', () => {
  it('entrar pide iglesia, 18 años, el acuerdo y la aprobación de un líder', async () => {
    const ig = await iglesia();
    const ana = await persona('Ana');
    let r = await call()('circuloEstado', {}, ana.llave);
    expect(r.json).toMatchObject({ iglesia: null, miembro: null, circulos: [] });

    await call()('iglesiaUnirme', { codigo: ig.codigo }, ana.llave);
    r = await call()('circuloEstado', {}, ana.llave);
    expect(r.json.circulos).toEqual([expect.objectContaining({ id: ig.circulo, nombre: 'Jóvenes adultos', edadMin: 18, edadMax: 35, lleno: false })]);

    const pedir = (extra: Record<string, unknown>) =>
      call()('circuloPedir', { circulo: ig.circulo, nacimiento: '2000-05-10', acepto: true, etapa: 'abierto', ...extra }, ana.llave);
    expect((await pedir({ nacimiento: '2010-01-01' })).status).toBe(403);
    expect((await pedir({ nacimiento: '1980-01-01' })).json.error).toMatch(/otra edad/);
    expect((await pedir({ acepto: false })).status).toBe(400);
    expect((await pedir({ etapa: 'casado' })).status).toBe(400);
    expect((await pedir({})).status).toBe(200);
    expect((await pedir({})).status).toBe(409);

    r = await call()('circuloEstado', {}, ana.llave);
    expect(r.json.miembro).toMatchObject({ estado: 'pendiente', edad: 26 });
    expect((await call()('circuloResponder', { texto: 'hola' }, ana.llave)).status).toBe(403);

    // La líder ve el pedido; alguien que no es líder, no
    expect((await call()('circuloLider', { circulo: ig.circulo }, ana.llave)).status).toBe(403);
    const lider = await call()('circuloLider', { circulo: ig.circulo }, ig.lider.llave);
    expect(lider.json.pendientes).toEqual([expect.objectContaining({ id: ana.id, edad: 26, etapa: 'abierto' })]);
    expect((await call()('circuloEstado', {}, ig.lider.llave)).json.lidero).toEqual([
      expect.objectContaining({ id: ig.circulo, pendientes: 1, iglesia: 'Vida Nueva' }),
    ]);
    expect((await call()('circuloAprobar', { usuario: ana.id, si: true }, ig.lider.llave)).status).toBe(200);
    r = await call()('circuloEstado', {}, ana.llave);
    expect(r.json.miembro.estado).toBe('aprobado');
    expect(r.json.lideres).toEqual([expect.objectContaining({ id: ig.lider.id })]);
    expect(r.json.semana).toMatchObject({ clave: S3, respondi: false, respuestas: [] });
  });

  it('marcarse en secreto: hace falta haber compartido semanas, es mutuo o nadie se entera, y tiene tope', async () => {
    const ig = await iglesia();
    const ana = await miembro('Ana', ig);
    const beto = await miembro('Beto', ig);
    const caro = await miembro('Caro', ig, 'soltero');

    // Sin semanas en común todavía no se puede
    let r = await call()('circuloMarcar', { usuario: beto.id }, ana.llave);
    expect(r.json.error).toMatch(/respondan los dos/);
    for (const hoy of [S1, S2]) {
      expect((await responder(ana.llave, hoy)).status).toBe(200);
      expect((await responder(beto.llave, hoy)).status).toBe(200);
      expect((await responder(caro.llave, hoy)).status).toBe(200);
    }
    let estado = await call()('circuloEstado', {}, ana.llave);
    const fila = (id: string) => estado.json.personas.find((p: { id: string }) => p.id === id);
    expect(fila(beto.id)).toMatchObject({ enComun: 2, puedoMarcar: true, marcada: false, etapa: 'abierto' });
    // Caro no está abierta a conocer a alguien: no se la puede marcar
    expect(fila(caro.id)).toMatchObject({ puedoMarcar: false });
    expect((await call()('circuloMarcar', { usuario: caro.id }, ana.llave)).status).toBe(400);

    r = await call()('circuloMarcar', { usuario: beto.id }, ana.llave);
    expect(r.json).toEqual({ mutuo: null });
    // Beto no ve nada de la marca de Ana
    const deBeto = await call()('circuloEstado', {}, beto.llave);
    expect(deBeto.json.personas.find((p: { id: string }) => p.id === ana.id)).toMatchObject({ marcada: false });
    estado = await call()('circuloEstado', {}, ana.llave);
    expect(fila(beto.id).marcada).toBe(true);
    expect(estado.json.marcas).toMatchObject({ abiertas: 1, mes: 1 });

    // Beto también marca: se abre «Conocernos» para los dos
    r = await call()('circuloMarcar', { usuario: ana.id }, beto.llave);
    expect(r.json.mutuo).toMatch(/^[0-9a-f-]{36}$/);
    const id = r.json.mutuo as string;
    estado = await call()('circuloEstado', {}, ana.llave);
    expect(estado.json.conocer).toMatchObject({ id, otro: { id: beto.id }, progreso: { dia: 1, abierto: true } });
    expect(estado.json.marcas.abiertas).toBe(0);
    // Mientras se conocen, nadie más puede marcarlos
    expect((await call()('circuloMarcar', { usuario: caro.id }, ana.llave)).json.error).toMatch(/Conocernos/);
  });

  it('«Conocernos»: respuestas ocultas hasta que respondan los dos, un día por día, mensajes con aviso y cerrar', async () => {
    const ig = await iglesia();
    const ana = await miembro('Ana', ig);
    const beto = await miembro('Beto', ig);
    for (const hoy of [S1, S2]) {
      await responder(ana.llave, hoy);
      await responder(beto.llave, hoy);
    }
    await call()('circuloMarcar', { usuario: beto.id }, ana.llave);
    const id = (await call()('circuloMarcar', { usuario: ana.id }, beto.llave)).json.mutuo as string;

    expect((await call()('circuloConocerResponder', { id, dia: 2, texto: 'adelantado' }, ana.llave)).status).toBe(400);
    expect((await call()('circuloConocerResponder', { id, dia: 1, texto: 'Conocí a Jesús a los 15' }, ana.llave)).status).toBe(200);
    let r = await call()('circuloConocer', { id }, beto.llave);
    expect(r.json.conocer.dias[0]).toMatchObject({ mia: null, suya: null, suyaEspera: true });
    await call()('circuloConocerResponder', { id, dia: 1, texto: 'En un campamento' }, beto.llave);
    r = await call()('circuloConocer', { id }, beto.llave);
    expect(r.json.conocer.dias[0]).toMatchObject({ mia: 'En un campamento', suya: 'Conocí a Jesús a los 15' });
    // El día 2 se abre mañana
    expect(r.json.conocer.progreso).toMatchObject({ dia: 2, abierto: false });
    expect((await call('2026-11-03')('circuloConocer', { id }, ana.llave)).json.conocer.progreso).toMatchObject({ dia: 2, abierto: true });

    // Mensajes: quien recibe uno que pide dinero ve el aviso; quien lo escribe, no
    await call()('circuloMensaje', { id, texto: '¡Hola! Me gustó tu respuesta' }, ana.llave);
    await call()('circuloMensaje', { id, texto: '¿Me haces una transferencia? Escríbeme al WhatsApp' }, beto.llave);
    r = await call()('circuloConocer', { id }, ana.llave);
    expect(r.json.conocer.mensajes).toEqual([
      expect.objectContaining({ mio: true, alerta: null }),
      expect.objectContaining({ mio: false, alerta: 'Habla de dinero' }),
    ]);
    expect((await call()('circuloConocer', { id }, beto.llave)).json.conocer.mensajes[1].alerta).toBeNull();
    // Nadie de afuera puede leerla, tampoco la líder
    expect((await call()('circuloConocer', { id }, ig.lider.llave)).status).toBe(404);

    expect((await call()('circuloAcompanar', { id }, ana.llave)).status).toBe(200);
    expect((await call()('circuloCerrar', { id }, ana.llave)).status).toBe(200);
    expect((await call()('circuloMensaje', { id, texto: 'hola' }, beto.llave)).status).toBe(400);
    expect((await call()('circuloEstado', {}, beto.llave)).json.conocer).toBeNull();
    // No pueden volver a marcarse enseguida
    expect((await call()('circuloMarcar', { usuario: ana.id }, beto.llave)).json.error).toMatch(/Hace poco/);
  });

  it('dos reportes ponen en pausa; la líder revisa; bloquear oculta; salir borra las marcas', async () => {
    const ig = await iglesia();
    const ana = await miembro('Ana', ig);
    const beto = await miembro('Beto', ig);
    const caro = await miembro('Caro', ig);
    expect((await call()('circuloReportar', { usuario: beto.id, motivo: 'inventado' }, ana.llave)).status).toBe(400);
    expect((await call()('circuloReportar', { usuario: beto.id, motivo: 'Me presionó o me incomodó' }, ana.llave)).status).toBe(200);
    let lider = await call()('circuloLider', { circulo: ig.circulo }, ig.lider.llave);
    expect(lider.json.reportes).toHaveLength(1);
    expect(lider.json.miembros.find((m: { id: string }) => m.id === beto.id).pausado).toBe(false);

    await call()('circuloReportar', { usuario: beto.id, motivo: 'Pidió dinero, fotos o datos', bloquear: true }, caro.llave);
    lider = await call()('circuloLider', { circulo: ig.circulo }, ig.lider.llave);
    expect(lider.json.miembros.find((m: { id: string }) => m.id === beto.id).pausado).toBe(true);
    expect((await call()('circuloEstado', {}, beto.llave)).json.miembro.estado).toBe('pausado');
    expect((await call()('circuloResponder', { texto: 'x' }, beto.llave)).status).toBe(403);

    expect((await call()('circuloRevisar', { usuario: beto.id, que: 'reactivar' }, ig.lider.llave)).json).toEqual({});
    lider = await call()('circuloLider', { circulo: ig.circulo }, ig.lider.llave);
    expect(lider.json.reportes).toHaveLength(0);
    // Caro lo bloqueó: no lo ve en el círculo
    const deCaro = await call()('circuloEstado', {}, caro.llave);
    expect(deCaro.json.personas.map((p: { id: string }) => p.id)).not.toContain(beto.id);

    for (const hoy of [S1, S2]) {
      await responder(ana.llave, hoy);
      await responder(caro.llave, hoy);
    }
    await call()('circuloMarcar', { usuario: caro.id }, ana.llave);
    expect((await call()('circuloSalir', {}, ana.llave)).status).toBe(200);
    expect((await call()('circuloEstado', {}, ana.llave)).json.miembro).toBeNull();
    // La marca de Ana se borró: si Caro marca a alguien no se abre nada con Ana
    expect((await call()('circuloEstado', {}, caro.llave)).json.personas.map((p: { id: string }) => p.id)).not.toContain(ana.id);
  });

  it('solo quien cuida Zarza crea círculos y nombra líderes', async () => {
    const ig = await iglesia();
    const ana = await persona('Ana');
    expect((await call()('cuidarNuevoCirculo', { iglesia: ig.iglesiaId, nombre: 'Otro' }, ana.llave)).status).toBe(403);
    expect((await call()('cuidarLiderCirculo', { circulo: ig.circulo, correo: ana.correo }, ana.llave)).status).toBe(403);
    expect((await call()('cuidarLiderCirculo', { circulo: ig.circulo, correo: 'nadie@prueba.test' }, ig.cuida)).status).toBe(404);
    const r = await call()('cuidarCirculos', { iglesia: ig.iglesiaId }, ig.cuida);
    expect(r.json.circulos).toEqual([
      expect.objectContaining({ nombre: 'Jóvenes adultos', max: 30, lideres: [expect.objectContaining({ id: ig.lider.id })] }),
    ]);
  });
});
