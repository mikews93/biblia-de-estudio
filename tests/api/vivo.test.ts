// /api/vivo: los eventos de iglesia. Quien predica publica y avanza; la congregación lo lee sin cuenta, con los
// puntos que vienen ocultos si así se eligió. Ver tests/api/helpers.ts.
import { beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, Post, prepareEnv, request, unique } from './helpers';

const HOY = new Date().toISOString().slice(0, 10);

let comunidades: Post;
let POST: Post;
let GET: Post;
let call: ReturnType<typeof client>;

beforeAll(async () => {
  await prepareEnv();
  ({ POST: comunidades } = await import('../../api/comunidades'));
  ({ POST, GET } = await import('../../api/vivo'));
  call = client(comunidades, HOY);
  if (DB_URL) await ensureSchema(comunidades);
});

async function persona(name: string) {
  const u = unique(name);
  const r = await call<{ llave: string }>('registrarse', { nombre: u.nombre });
  return r.json.llave;
}

async function vivo(accion: string, body: Record<string, unknown>, llave?: string) {
  const res = await POST(request('/api/vivo', { accion, ...body }, llave));
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

async function ver(codigo: string) {
  const res = await GET(new Request(`http://localhost/api/vivo?codigo=${encodeURIComponent(codigo)}`));
  return { status: res.status, headers: res.headers, json: (await res.json()) as Record<string, any> };
}

const BOSQUEJO = {
  titulo: 'El hijo que vuelve',
  idea: 'Dios corre hacia nosotros',
  pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
  puntos: [
    { titulo: 'Se fue', texto: 'Pidió su parte', citas: ['Lucas 15:12'] },
    { titulo: 'Volvió en sí', texto: '', citas: [] },
    { titulo: 'El padre corrió', texto: 'Lo vio de lejos', citas: ['Lucas 15:20', 'Romanos 5:8'] },
  ],
};

describe.skipIf(!DB_URL)('/api/vivo', () => {
  it('pide una cuenta para publicar y valida el bosquejo', async () => {
    expect((await vivo('publicar', { mensaje: 'm1', ...BOSQUEJO })).status).toBe(401);
    const llave = await persona('Valida');
    expect((await vivo('publicar', { mensaje: 'm1', ...BOSQUEJO, puntos: [] }, llave)).status).toBe(400);
    expect((await vivo('publicar', { mensaje: 'm1', ...BOSQUEJO, pasaje: { book: '../x', chapter: 1 } }, llave)).status).toBe(400);
    expect((await vivo('publicar', { mensaje: 'm1', ...BOSQUEJO, titulo: 'x'.repeat(200) }, llave)).status).toBe(400);
    expect((await vivo('otraCosa', {}, llave)).status).toBe(400);
    expect((await ver('nada')).status).toBe(400);
    expect((await ver('ZZZZZZ')).status).toBe(404);
  });

  it('publica con un código, oculta los puntos que vienen y avanza en vivo', async () => {
    const llave = await persona('Pastora');
    const pub = await vivo('publicar', { mensaje: 'sermon-1', gradual: true, ...BOSQUEJO }, llave);
    expect(pub.status).toBe(200);
    const codigo = pub.json.evento.codigo as string;
    expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(pub.json.evento.puntos).toHaveLength(3); // quien publica lo ve todo

    // La congregación, sin cuenta: aún no empieza y no ve ningún punto, pero sabe cuántos son.
    let r = await ver(codigo.toLowerCase().replace(/(...)/, '$1 '));
    expect(r.status).toBe(200);
    expect(r.headers.get('cdn-cache-control')).toContain('s-maxage');
    expect(r.json.evento).toMatchObject({ estado: 'pronto', punto: -1, total: 3, titulo: 'El hijo que vuelve' });
    expect(r.json.evento.puntos).toEqual([]);
    expect(r.json.evento.mensaje).toBeUndefined();
    expect(r.json.evento.autor).toContain('Pastora');

    // Empieza y avanza al segundo punto: llegan los dos primeros.
    expect((await vivo('mover', { codigo, estado: 'en-vivo', punto: 1 }, llave)).status).toBe(200);
    r = await ver(codigo);
    expect(r.json.evento).toMatchObject({ estado: 'en-vivo', punto: 1 });
    expect(r.json.evento.puntos.map((p: { titulo: string }) => p.titulo)).toEqual(['Se fue', 'Volvió en sí']);

    // Al terminar se ven todos.
    await vivo('mover', { codigo, estado: 'terminado' }, llave);
    r = await ver(codigo);
    expect(r.json.evento.puntos).toHaveLength(3);
    expect(r.json.evento.puntos[2].citas).toEqual(['Lucas 15:20', 'Romanos 5:8']);

    // Nadie más puede moverlo, y fuera de rango no vale.
    const otra = await persona('Otra');
    expect((await vivo('mover', { codigo, punto: 0 }, otra)).status).toBe(403);
    expect((await vivo('mover', { codigo, punto: 3 }, llave)).status).toBe(400);
    expect((await vivo('mover', { codigo, estado: 'cualquiera' }, llave)).status).toBe(400);
  });

  it('volver a publicar el mismo mensaje lo actualiza con el mismo código', async () => {
    const llave = await persona('Actualiza');
    const a = await vivo('publicar', { mensaje: 'sermon-2', gradual: false, ...BOSQUEJO }, llave);
    const codigo = a.json.evento.codigo;
    await vivo('mover', { codigo, estado: 'en-vivo', punto: 2 }, llave);
    const b = await vivo('publicar', { mensaje: 'sermon-2', gradual: false, ...BOSQUEJO, puntos: BOSQUEJO.puntos.slice(0, 2), titulo: 'Nuevo título' }, llave);
    expect(b.json.evento.codigo).toBe(codigo);
    // El punto se ajusta a los que quedan; sin «gradual» la congregación los ve todos.
    const r = await ver(codigo);
    expect(r.json.evento).toMatchObject({ titulo: 'Nuevo título', punto: 1, estado: 'en-vivo', total: 2 });
    expect(r.json.evento.puntos).toHaveLength(2);

    const mios = await vivo('mios', {}, llave);
    expect(mios.json.eventos.map((e: { codigo: string }) => e.codigo)).toEqual([codigo]);
    expect((await vivo('borrar', { codigo }, llave)).status).toBe(200);
    expect((await ver(codigo)).status).toBe(404);
  });

  it('guarda la versión y los minutos, y lleva el reloj de quien predica', async () => {
    const llave = await persona('Reloj');
    const puntos = BOSQUEJO.puntos.map((p, i) => ({ ...p, minutos: [5, 0, 7][i], ...(i === 1 && { dinamica: 'termometro' }) }));
    expect((await vivo('publicar', { mensaje: 'v1', ...BOSQUEJO, version: '../x' }, llave)).status).toBe(400);
    const a = await vivo('publicar', { mensaje: 'v1', gradual: false, ...BOSQUEJO, puntos, version: 'nbla' }, llave);
    const codigo = a.json.evento.codigo;
    expect(a.json.evento).toMatchObject({ version: 'nbla', inicio: null, puntoDesde: null });
    expect(a.json.evento.puntos[0].minutos).toBe(5);
    expect(a.json.evento.puntos[1]).not.toHaveProperty('minutos');
    expect(a.json.evento.puntos[1].dinamica).toBe('termometro');

    let r = await vivo('mover', { codigo, estado: 'en-vivo', punto: 0 }, llave);
    const { inicio, puntoDesde } = r.json.evento;
    expect(inicio).toBeTruthy();
    expect(puntoDesde).toBeTruthy();
    // Moverse al mismo punto no reinicia su reloj; ir a otro sí. El inicio del mensaje queda.
    r = await vivo('mover', { codigo, punto: 0 }, llave);
    expect(r.json.evento.puntoDesde).toBe(puntoDesde);
    await new Promise((ok) => setTimeout(ok, 20));
    r = await vivo('mover', { codigo, punto: 1 }, llave);
    expect(Date.parse(r.json.evento.puntoDesde)).toBeGreaterThan(Date.parse(puntoDesde));
    expect(r.json.evento.inicio).toBe(inicio);
    // Lo ve también la congregación.
    expect((await ver(codigo)).json.evento.version).toBe('nbla');
  });

  it('manda una dinámica del catálogo a los teléfonos, con sus pasos y el reloj', async () => {
    const llave = await persona('Dinámica');
    const a = await vivo('publicar', { mensaje: 'd1', ...BOSQUEJO }, llave);
    const codigo = a.json.evento.codigo;
    await vivo('mover', { codigo, estado: 'en-vivo', punto: 0 }, llave);
    expect((await vivo('interactuar', { codigo, nueva: { tipo: 'dinamica', dinamica: 'inventada' } }, llave)).status).toBe(400);
    let r = await vivo('interactuar', { codigo, nueva: { tipo: 'dinamica', dinamica: 'termometro', titulo: 'Otro nombre' } }, llave);
    expect(r.status).toBe(200);
    const i = r.json.evento.interaccion;
    // El nombre y los pasos salen del catálogo, no de lo que manda el teléfono.
    expect(i).toMatchObject({ tipo: 'dinamica', dinamica: 'termometro', titulo: 'Termómetro con la mano', paso: 0, minutos: 5, fin: null });
    expect(i.pasos).toHaveLength(3);
    expect(r.json.evento.resultados).toBeNull();

    r = await vivo('interactuar', { codigo, paso: 2, reloj: 'iniciar' }, llave);
    expect(r.json.evento.interaccion.paso).toBe(2);
    expect(Date.parse(r.json.evento.interaccion.fin) - Date.now()).toBeGreaterThan(4.5 * 60_000);
    expect((await vivo('interactuar', { codigo, paso: 3 }, llave)).status).toBe(400);
    r = await vivo('interactuar', { codigo, reloj: 'parar' }, llave);
    expect(r.json.evento.interaccion.fin).toBeNull();

    // La congregación la ve, pero no se responde en la app.
    expect((await ver(codigo)).json.evento.interaccion.titulo).toBe('Termómetro con la mano');
    const res = await POST(
      request('/api/vivo', { accion: 'responderEvento', codigo, interaccion: i.id, participante: 'telefono-de-prueba-123', texto: 'hola' }),
    );
    expect(res.status).toBe(409);
  });
});
