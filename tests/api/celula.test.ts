// /api/vivo, la lectura en vivo de la célula, contra un Postgres de verdad (DATABASE_URL). Ver tests/api/helpers.ts.
import postgres from 'postgres';
import { beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request, unique } from './helpers';

let comunidades: Post;
let vivo: { GET: Post; POST: Post };
let call: ReturnType<typeof client>;

beforeAll(async () => {
  await prepareEnv();
  ({ POST: comunidades } = await import('../../api/comunidades'));
  vivo = await import('../../api/vivo');
  call = client(comunidades, new Date().toISOString().slice(0, 10));
  if (DB_URL && HAS_DATA) {
    await ensureSchema(comunidades);
    // Las tablas de la sala se crean con la primera acción; una sola vez, con el mismo candado.
    const sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
    await sql`select pg_advisory_lock(424243)`;
    await vivo.POST(request('/api/vivo', { accion: 'salirSala', sala: 'AAAAAA' }, 'nadie'));
    await sql`select pg_advisory_unlock(424243)`;
    await sql.end();
  }
});

async function persona(name: string) {
  const r = await call<{ llave: string; usuario: { id: string } }>('registrarse', { nombre: unique(name).nombre });
  return { llave: r.json.llave, id: r.json.usuario.id };
}

async function act<T = Record<string, any>>(accion: string, body: Record<string, unknown>, llave?: string) {
  const res = await vivo.POST(request('/api/vivo', { accion, ...body }, llave));
  return { status: res.status, json: (await res.json()) as T };
}

async function ver(codigo: string) {
  const res = await vivo.GET(new Request(`http://localhost/api/vivo?sala=${codigo}`));
  return { status: res.status, headers: res.headers, json: (await res.json()) as Record<string, any> };
}

describe('/api/vivo (célula)', () => {
  it('rechaza acciones desconocidas y JSON roto', async () => {
    expect((await vivo.POST(request('/api/vivo', '{roto'))).status).toBe(400);
    expect((await act('borrarTodo', {})).status).toBe(400);
  });

  describe.skipIf(!DB_URL || !HAS_DATA)('con base de datos', () => {
    it('sin cuenta no se puede empezar', async () => {
      const r = await act('crearSala', { libro: 'jhn', capitulo: 3 });
      expect(r.status).toBe(401);
    });

    it('la guía pasa la hoja, ilumina y pone una dinámica; quien sigue lo ve todo y no puede mover', async () => {
      const ana = await persona('Ana Guía');
      const beto = await persona('Beto');
      const creada = await act('crearSala', { libro: 'jhn', capitulo: 3 }, ana.llave);
      expect(creada.status).toBe(200);
      const codigo = creada.json.sala.codigo as string;
      expect(codigo).toMatch(/^[A-Z2-9]{6}$/);
      expect(creada.json.sala.titulo).toBe('Lectura en vivo');
      expect(creada.json.estado).toMatchObject({ libro: 'jhn', capitulo: 3, foco: null, tarjeta: null, recorrido: ['jhn.3'] });

      // Beto entra con el código escrito a su manera.
      const unido = await act('unirseSala', { sala: `${codigo.slice(0, 3).toLowerCase()} ${codigo.slice(3)}` }, beto.llave);
      expect(unido.status).toBe(200);
      expect(unido.json.presentes.map((p: { id: string }) => p.id).sort()).toEqual([ana.id, beto.id].sort());
      expect(unido.json.version).toBeGreaterThan(creada.json.version);

      // Beto no guía.
      expect((await act('moverSala', { sala: codigo, capitulo: 4 }, beto.llave)).status).toBe(403);

      // Beto ilumina el 16; Ana el 17. Tocar otra vez el mismo lo apaga.
      await act('tocar', { sala: codigo, versiculo: 16 }, beto.llave);
      let r = await act('tocar', { sala: codigo, versiculo: 17 }, ana.llave);
      expect(r.json.toques.map((t: { versiculo: number }) => t.versiculo).sort()).toEqual([16, 17]);
      r = await act('tocar', { sala: codigo, versiculo: 17 }, ana.llave);
      expect(r.json.toques).toEqual([expect.objectContaining({ usuario: beto.id, versiculo: 16 })]);

      // Ana pasa la hoja: los versículos iluminados eran de la anterior.
      r = await act('moverSala', { sala: codigo, capitulo: 4, foco: 14 }, ana.llave);
      expect(r.json.estado).toMatchObject({ libro: 'jhn', capitulo: 4, foco: 14, recorrido: ['jhn.3', 'jhn.4'] });
      expect(r.json.toques).toEqual([]);
      expect((await act('moverSala', { sala: codigo, capitulo: 99 }, ana.llave)).status).toBe(400);

      // Una dinámica del catálogo: el servidor toma sus pasos y pone el reloj.
      r = await act('moverSala', { sala: codigo, tarjeta: { tipo: 'dinamica', dinamica: 'termometro', titulo: 'Inventado', pasos: ['x'] } }, ana.llave);
      const t = r.json.estado.tarjeta;
      expect(t.titulo).toBe('Termómetro con la mano');
      expect(t.pasos).toHaveLength(3);
      expect(t.minutos).toBe(5);
      expect(Date.parse(t.fin) - Date.parse(r.json.ahora)).toBeGreaterThan(4.9 * 60_000);
      r = await act('moverSala', { sala: codigo, paso: 2, reloj: 'parar' }, ana.llave);
      expect(r.json.estado.tarjeta).toMatchObject({ paso: 2, fin: null });
      expect((await act('moverSala', { sala: codigo, paso: 3 }, ana.llave)).status).toBe(400);
      r = await act('moverSala', { sala: codigo, tarjeta: { tipo: 'pregunta', titulo: '¿Qué te sorprende del pozo?' } }, ana.llave);
      expect(r.json.estado.tarjeta).toMatchObject({ tipo: 'pregunta', titulo: '¿Qué te sorprende del pozo?', minutos: null, fin: null });

      // Lo que ve cualquiera con el código, guardado un segundo en el CDN.
      const visto = await ver(codigo);
      expect(visto.status).toBe(200);
      expect(visto.headers.get('CDN-Cache-Control')).toContain('s-maxage=1');
      expect(visto.json.version).toBe(r.json.version);
      expect(visto.json.estado.capitulo).toBe(4);

      // Ana le pasa la guía a Beto, que ahora puede pasar la hoja; ella la recupera.
      r = await act('cederGuia', { sala: codigo, usuario: beto.id }, ana.llave);
      expect(r.json.sala.guia.id).toBe(beto.id);
      expect((await act('moverSala', { sala: codigo, capitulo: 5 }, beto.llave)).status).toBe(200);
      expect((await act('cerrarSala', { sala: codigo }, beto.llave)).status).toBe(403);
      r = await act('cederGuia', { sala: codigo, usuario: ana.id }, beto.llave);
      expect(r.json.sala.guia.id).toBe(ana.id);

      // Termina para todos.
      r = await act('cerrarSala', { sala: codigo }, ana.llave);
      expect(r.json.sala.enVivo).toBe(false);
      expect((await act('tocar', { sala: codigo, versiculo: 1 }, beto.llave)).status).toBe(410);
      expect((await ver(codigo)).json.sala.enVivo).toBe(false);
    });

    it('la sala de un grupo: solo sus miembros la empiezan, y si ya hay una abierta se entra en ella', async () => {
      const ana = await persona('Ana Célula');
      const beto = await persona('Beto Célula');
      const extra = await persona('Extraño');
      const g = await call<{ id: string }>('crearGrupo', { nombre: 'Célula de los jueves', tipo: 'celula' }, ana.llave);
      const { json } = await call<{ grupo: { codigo: string } }>('grupo', { grupo: g.json.id }, ana.llave);
      await call('unirse', { codigo: json.grupo.codigo }, beto.llave);

      expect((await act('crearSala', { grupo: g.json.id, libro: 'psa', capitulo: 23 }, extra.llave)).status).toBe(403);
      expect((await act('salaDelGrupo', { grupo: g.json.id }, beto.llave)).json.sala).toBeNull();

      const a = await act('crearSala', { grupo: g.json.id, libro: 'psa', capitulo: 23 }, ana.llave);
      expect(a.json.sala.titulo).toBe('Célula de los jueves');
      expect(a.json.sala.grupo).toEqual({ id: g.json.id, nombre: 'Célula de los jueves' });

      const abierta = await act('salaDelGrupo', { grupo: g.json.id }, beto.llave);
      expect(abierta.json.sala).toMatchObject({ codigo: a.json.sala.codigo, presentes: 1 });
      expect(abierta.json.sala.estado.capitulo).toBe(23);

      const b = await act('crearSala', { grupo: g.json.id, libro: 'jhn', capitulo: 1 }, beto.llave);
      expect(b.json.sala.codigo).toBe(a.json.sala.codigo);
      expect(b.json.existente).toBe(true);
      expect(b.json.estado.libro).toBe('psa');

      await act('cerrarSala', { sala: a.json.sala.codigo }, ana.llave);
      expect((await act('salaDelGrupo', { grupo: g.json.id }, beto.llave)).json.sala).toBeNull();
    });

    it('códigos que no existen o mal escritos', async () => {
      expect((await ver('ZZZZZZ')).status).toBe(404);
      expect((await ver('abc')).status).toBe(400);
      const ana = await persona('Ana Código');
      expect((await act('unirseSala', { sala: 'IIIIII' }, ana.llave)).status).toBe(400);
    });
  });
});
