// /api/sincronizar: lo que cada persona guarda en el dispositivo, copiado a su cuenta. Y el cliente
// (src/lib/sincronia.ts) contra la función real, con otro «dispositivo» que llama a la función directamente.
// Ver tests/api/helpers.ts.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { client, DB_URL, ensureSchema, Post, prepareEnv, request, unique } from './helpers';

const HOY = new Date().toISOString().slice(0, 10);

let comunidades: Post;
let POST: Post;
let call: ReturnType<typeof client>;

beforeAll(async () => {
  await prepareEnv();
  ({ POST: comunidades } = await import('../../api/comunidades'));
  ({ POST } = await import('../../api/sincronizar'));
  call = client(comunidades, HOY);
  if (DB_URL) await ensureSchema(comunidades);
});

async function persona(name: string) {
  const u = unique(name);
  const r = await call<{ llave: string; usuario: { id: string } }>('registrarse', { nombre: u.nombre });
  return { llave: r.json.llave, id: r.json.usuario.id };
}

type Fila = { a: string; k: string; v: unknown; t: number };
type Respuesta = { filas: Fila[]; cursor: number; mas: boolean };

async function sync(llave: string | undefined, desde: number, cambios: Fila[] = []) {
  const res = await POST(request('/api/sincronizar', { desde, cambios }, llave));
  return { status: res.status, json: (await res.json()) as Respuesta & { error?: string } };
}

describe.skipIf(!DB_URL)('/api/sincronizar', () => {
  it('pide una cuenta y valida lo que llega', async () => {
    expect((await sync(undefined, 0)).status).toBe(401);
    const { llave } = await persona('Valida');
    expect((await sync(llave, 0, [{ a: 'otra-cosa', k: 'x', v: 1, t: 1 }])).status).toBe(400);
    expect((await sync(llave, 0, [{ a: 'notas', k: '', v: 1, t: 1 }])).status).toBe(400);
    expect((await sync(llave, 0, [{ a: 'notas', k: 'x', v: 'a'.repeat(250_000), t: 1 }])).status).toBe(413);
    const muchos = Array.from({ length: 401 }, (_, i) => ({ a: 'notas', k: `k${i}`, v: 1, t: 1 }));
    expect((await sync(llave, 0, muchos)).status).toBe(400);
  });

  it('guarda, devuelve lo nuevo desde el cursor y se queda con lo más reciente', async () => {
    const { llave } = await persona('Lectora');
    const a = await sync(llave, 0, [
      { a: 'notas', k: 'jhn.3.16', v: { text: 'De tal manera', created: 1, updated: 100 }, t: 100 },
      { a: 'progreso', k: 'c.jhn.3', v: 1, t: 100 },
    ]);
    expect(a.status).toBe(200);
    expect(a.json.filas.map((f) => f.k).sort()).toEqual(['c.jhn.3', 'jhn.3.16']);

    // Otro dispositivo cambia la nota más tarde y borra el capítulo.
    const b = await sync(llave, a.json.cursor, [
      { a: 'notas', k: 'jhn.3.16', v: { text: 'Amó al mundo', created: 1, updated: 200 }, t: 200 },
      { a: 'progreso', k: 'c.jhn.3', v: null, t: 200 },
    ]);
    expect(b.json.filas).toHaveLength(2);

    // Un cambio más viejo no pisa el nuevo, y vuelve el que quedó para que el dispositivo lo vea.
    const c = await sync(llave, b.json.cursor, [{ a: 'notas', k: 'jhn.3.16', v: { text: 'viejo' }, t: 150 }]);
    expect(c.json.filas).toEqual([{ a: 'notas', k: 'jhn.3.16', v: { text: 'Amó al mundo', created: 1, updated: 200 }, t: 200 }]);

    // Desde el cursor de antes llega lo que cambió el otro dispositivo, con el borrado como null.
    const desdeA = await sync(llave, a.json.cursor);
    expect(desdeA.json.filas).toContainEqual({ a: 'progreso', k: 'c.jhn.3', v: null, t: 200 });
    expect((await sync(llave, desdeA.json.cursor)).json.filas).toEqual([]);
  });

  it('cada cuenta ve solo lo suyo', async () => {
    const ana = await persona('Ana');
    const beto = await persona('Beto');
    await sync(ana.llave, 0, [{ a: 'diario', k: 'e1', v: { oracion: 'privada' }, t: 5 }]);
    expect((await sync(beto.llave, 0)).json.filas).toEqual([]);
  });

  it('pagina cuando hay mucho', async () => {
    const { llave } = await persona('Mucho');
    for (let lote = 0; lote < 3; lote++) {
      const cambios = Array.from({ length: 400 }, (_, i) => ({ a: 'progreso', k: `c.gen.${lote * 400 + i}`, v: 1, t: 1 }));
      expect((await sync(llave, 999_999_999_999, cambios)).status).toBe(200);
    }
    const p1 = await sync(llave, 0);
    expect(p1.json.filas).toHaveLength(1000);
    expect(p1.json.mas).toBe(true);
    const p2 = await sync(llave, p1.json.cursor);
    expect(p2.json.filas).toHaveLength(200);
    expect(p2.json.mas).toBe(false);
  });

  it('al borrar la cuenta se borra lo guardado', async () => {
    const { llave, id } = await persona('Se va');
    await sync(llave, 0, [{ a: 'notas', k: 'x', v: { text: 'hola' }, t: 1 }]);
    await call('borrarCuenta', {}, llave);
    const postgres = (await import('postgres')).default;
    const sql = postgres(DB_URL!, { max: 1, onnotice: () => {} });
    const rows = await sql`select 1 from datos where usuario_id = ${id}`;
    await sql.end();
    expect(rows).toHaveLength(0);
  });
});

describe.skipIf(!DB_URL)('src/lib/sincronia.ts', () => {
  // El cliente llama a la función real en vez de ir a la red.
  beforeEach(() => {
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => POST(new Request(`http://localhost${url}`, init as RequestInit)));
  });

  async function cargar() {
    vi.resetModules();
    const sincronia = await import('../../src/lib/sincronia');
    const notas = await import('../../src/lib/notas');
    const progress = await import('../../src/lib/progress');
    await import('../../src/lib/planes');
    return { sincronia, notas, progress };
  }

  it('al entrar une lo del dispositivo con lo de la cuenta, y luego manda cada cambio', async () => {
    const yo = await persona('Dispositivo');
    // Otro dispositivo ya guardó en la cuenta un capítulo y una nota.
    const otro = await sync(yo.llave, 0, [
      { a: 'progreso', k: 'c.rom.8', v: 1, t: Date.now() - 5000 },
      { a: 'notas', k: 'rom.8.28', v: { text: 'Todo ayuda a bien', created: 1, updated: 2 }, t: Date.now() - 5000 },
    ]);

    const { sincronia, notas, progress } = await cargar();
    // En este dispositivo, sin cuenta, se leyó Juan 3 y se escribió una nota.
    await progress.markChapterRead('jhn', 3);
    await notas.setNote('jhn', 3, 16, 'De tal manera amó Dios');

    const avisos: number[] = [];
    sincronia.alUnirseALaCuenta((n) => avisos.push(n));
    await sincronia.conectar(yo.llave, yo.id);
    expect(avisos).toEqual([2]);

    // Y lo de la cuenta llegó a este dispositivo.
    const leido = (await sincronia.leerAlmacen('progreso')) as { chapters: Record<string, number[]> };
    expect(leido.chapters).toEqual({ jhn: [3], rom: [8] });
    expect(Object.keys((await sincronia.leerAlmacen('notas')) as object).sort()).toEqual(['jhn.3.16', 'rom.8.28']);

    // La cuenta tiene ahora lo de los dos dispositivos.
    const todo = await sync(yo.llave, 0);
    const claves = todo.json.filas.filter((f) => f.v !== null).map((f) => `${f.a}:${f.k}`);
    expect(claves).toEqual(expect.arrayContaining(['progreso:c.rom.8', 'progreso:c.jhn.3', 'notas:rom.8.28', 'notas:jhn.3.16']));

    // Borrar la nota en este dispositivo la borra en la cuenta.
    await notas.setNote('jhn', 3, 16, '');
    await sincronia.sincronizar();
    const despues = await sync(yo.llave, otro.json.cursor);
    expect(despues.json.filas).toContainEqual(expect.objectContaining({ a: 'notas', k: 'jhn.3.16', v: null }));
  });

  it('lo que llega de otro dispositivo aparece en los almacenes', async () => {
    const yo = await persona('Recibe');
    const { sincronia } = await cargar();
    await sincronia.conectar(yo.llave, yo.id);
    const t = Date.now() + 1000;
    const plan = { id: 'libro-jhn', def: 'libro-jhn', title: 'Juan', readings: [['jhn', 1], ['jhn', 2]], minutes: 10, daysPerWeek: 5, started: HOY };
    await sync(yo.llave, 0, [
      { a: 'planes', k: 'libro-jhn', v: plan, t },
      { a: 'planes', k: 'libro-jhn/d/0', v: HOY, t },
      { a: 'planes', k: 'libro-jhn/d/1', v: HOY, t },
    ]);
    await sincronia.sincronizar();
    const [mio] = (await sincronia.leerAlmacen('planes')) as { id: string; done: Record<number, string>; finished?: string }[];
    expect(mio).toMatchObject({ id: 'libro-jhn', done: { 0: HOY, 1: HOY }, finished: HOY });
  });

  it('un cambio local que no llegó a la cuenta no se pierde con lo que trae otro dispositivo', async () => {
    const yo = await persona('Gana');
    const { sincronia, notas } = await cargar();
    await sincronia.conectar(yo.llave, yo.id);
    await notas.setNote('psa', 23, 1, 'Mi pastor');
    // El otro dispositivo escribió antes (hora más vieja) la misma nota.
    await sync(yo.llave, 0, [{ a: 'notas', k: 'psa.23.1', v: { text: 'otra', created: 1, updated: 1 }, t: 1000 }]);
    await sincronia.sincronizar();
    const n = (await sincronia.leerAlmacen('notas')) as Record<string, { text: string }>;
    expect(n['psa.23.1'].text).toBe('Mi pastor');
    const enCuenta = (await sync(yo.llave, 0)).json.filas.find((f) => f.k === 'psa.23.1');
    expect(enCuenta?.v).toMatchObject({ text: 'Mi pastor' });
  });
});
