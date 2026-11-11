// Trazas de /api/estudiar hacia Lupa (api/_lupa.ts): cada respuesta de la IA sale como una traza con sus vueltas y
// las herramientas que usó. Lupa se simula con un servidor local que guarda lo que recibe.
// Necesita DATABASE_URL (ver tests/api/helpers.ts) y public/data.
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request } from './helpers';

type Paso = {
  id: string; traceId: string; parentId: string | null; kind: string; name: string; model: string | null; fn: string | null;
  input: unknown; output: unknown; inputTokens: number; outputTokens: number; error: string | null; environment: string | null;
};

let estudiar: Post;
let llave: string;
let servidor: Server;
/** Lo que responde el Lupa simulado: 202 lo acepta, 503 es Lupa caído. */
let estado = 202;
const recibidos: Paso[] = [];
const llaves: string[] = [];

beforeAll(async () => {
  servidor = createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (parte) => (cuerpo += parte));
    req.on('end', () => {
      if (estado === 202 && req.url === '/v1/ingest') {
        llaves.push(req.headers.authorization ?? '');
        recibidos.push(...(JSON.parse(cuerpo) as { spans: Paso[] }).spans);
      }
      res.writeHead(estado).end();
    });
  });
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  process.env.LUPA_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  process.env.LUPA_KEY = 'lupa_sk_prueba';
  process.env.VERCEL_ENV = 'preview';
  await prepareEnv({ ai: true });
  process.env.COMENTARIOS_DIR = path.resolve(import.meta.dirname, '../fixtures/comentarios');
  process.env.TEOLOGIA_DIR = path.resolve(import.meta.dirname, '../../pipeline/teologia');
  ({ POST: estudiar } = await import('../../api/estudiar'));
  const { POST: comunidades } = await import('../../api/comunidades');
  if (DB_URL && HAS_DATA) {
    await ensureSchema(comunidades);
    llave = (await client(comunidades, '2026-11-11')('registrarse', { nombre: 'Trazas' })).json.llave;
  }
});

afterAll(() => {
  servidor.close();
  for (const variable of ['LUPA_URL', 'LUPA_KEY', 'VERCEL_ENV']) delete process.env[variable];
});

const canon = { book: 'jhn', chapter: 3, verse: 16, messages: [{ role: 'assistant', text: 'Estudio anterior' }, { role: 'user', text: '¿Cómo se definió el canon?' }] };
const preguntar = async (body: unknown) => {
  const res = await estudiar(request('/api/estudiar', body, llave));
  expect(res.status).toBe(200);
  return (await res.text()).split('\n').filter(Boolean).map((linea) => JSON.parse(linea) as { type: string; text?: string });
};
/** Lupa recibe después de que la persona tiene su respuesta: se espera a que llegue la traza completa. */
async function traza(desde: number) {
  for (let espera = 0; espera < 200; espera++) {
    const nuevos = recibidos.slice(desde);
    if (nuevos.some((paso) => paso.parentId === null)) return nuevos;
    await new Promise((sigue) => setTimeout(sigue, 25));
  }
  throw new Error('La traza no llegó a Lupa');
}

describe.skipIf(!DB_URL || !HAS_DATA)('/api/estudiar deja su traza en Lupa', () => {
  it('una pregunta que investiga llega como una traza: la pregunta, cada vuelta con su modelo y tokens, y cada herramienta', async () => {
    const eventos = await preguntar(canon);
    const respuesta = eventos.filter((evento) => evento.type === 'text').map((evento) => evento.text).join('');
    const pasos = await traza(0);

    const raiz = pasos.find((paso) => paso.parentId === null)!;
    expect(raiz).toMatchObject({ kind: 'chain', name: 'Pregunta sobre Juan 3:16', fn: 'seguimiento', input: '¿Cómo se definió el canon?', output: respuesta, error: null, environment: 'preview' });
    expect(new Set(pasos.map((paso) => paso.traceId))).toEqual(new Set([raiz.traceId]));
    expect(llaves[0]).toBe('Bearer lupa_sk_prueba');

    // Dos vueltas con la IA: la que pide las herramientas y la que responde con lo que encontró
    const vueltas = pasos.filter((paso) => paso.kind === 'model');
    expect(vueltas.map((paso) => paso.name)).toEqual(['Vuelta 1', 'Vuelta 2']);
    for (const vuelta of vueltas) expect(vuelta).toMatchObject({ parentId: raiz.id, model: 'claude-sonnet-5-5', inputTokens: 10, outputTokens: 10, fn: 'seguimiento' });
    expect(vueltas[0].output).toEqual({ texto: '', herramientas: ['leer_pasaje', 'buscar_en_la_biblia', 'teologia'] });
    expect(vueltas[1].output).toEqual({ texto: respuesta.replace(/⟦\d+⟧/g, ''), herramientas: [] });

    const herramientas = pasos.filter((paso) => paso.kind === 'tool');
    expect(herramientas.map((paso) => paso.name).sort()).toEqual(['buscar_en_la_biblia', 'leer_pasaje', 'teologia']);
    const leer = herramientas.find((paso) => paso.name === 'leer_pasaje')!;
    expect(leer).toMatchObject({ parentId: raiz.id, input: { cita: '2 Timoteo 3:14-17' }, error: null });
    expect((leer.output as { resultados: number }).resultados).toBeGreaterThan(0);
  });

  it('los documentos del pasaje no viajan a Lupa: del estudio solo va el encargo', async () => {
    const desde = recibidos.length;
    // Un estudio guardado de otra pasada se devolvería sin llamar a la IA, y entonces no hay traza
    const sql = postgres(DB_URL!, { max: 1, onnotice: () => {} });
    await sql`delete from estudios_ia`.catch(() => {});
    await sql.end();
    await preguntar({ book: 'jhn', chapter: 3 });
    const pasos = await traza(desde);
    const raiz = pasos.find((paso) => paso.parentId === null)!;
    expect(raiz).toMatchObject({ name: 'Estudio de Juan 3', fn: 'estudio' });
    expect(typeof raiz.input).toBe('string');
    expect(JSON.stringify(pasos).length).toBeLessThan(20_000);
    expect(JSON.stringify(pasos)).not.toContain('"type":"document"');
  });

  it('con Lupa caído la persona recibe su respuesta igual', async () => {
    estado = 503;
    const desde = recibidos.length;
    const eventos = await preguntar(canon);
    estado = 202;
    expect(eventos.at(-1)).toEqual({ type: 'done' });
    expect(eventos.some((evento) => evento.type === 'error')).toBe(false);
    expect(recibidos.length).toBe(desde);
  });
});
