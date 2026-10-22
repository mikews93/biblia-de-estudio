// /api/podcast-grabado: graba el pódcast con una ElevenLabs simulada y lo deja listo para todos.
// Necesita DATABASE_URL (ver tests/api/helpers.ts); los MP3 se guardan en una carpeta temporal.
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, Post, prepareEnv, request } from './helpers';

type Handler = { GET: (r: Request) => Promise<Response>; POST: Post; scriptLines: (t: string) => { voice: string; text: string }[] };

const calls: { inputs: { text: string; voice_id: string }[]; model_id: string }[] = [];
let failNext = false;
const eleven = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    if (failNext) {
      failNext = false;
      res.writeHead(500).end('falló');
      return;
    }
    const body = JSON.parse(raw);
    calls.push(body);
    // Un «MP3» de 8000 bytes por tramo: un segundo a 64 kbps.
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' }).end(Buffer.alloc(8000, calls.length));
  });
});

let api: Handler;
let comunidades: Post;
let sql: ReturnType<typeof postgres>;
const llaves: string[] = [];

const SCRIPT = Array.from({ length: 10 }, (_, i) => (i % 2 ? `TOMÁS: Respuesta ${i} ⟦${i}⟧.` : `ANA: Pregunta ${i}?`)).join('\n');

beforeAll(async () => {
  await new Promise<void>((r) => eleven.listen(0, '127.0.0.1', r));
  process.env.ELEVENLABS_BASE_URL = `http://127.0.0.1:${(eleven.address() as AddressInfo).port}`;
  process.env.ELEVENLABS_API_KEY = 'clave-de-prueba';
  process.env.PODCAST_STORE_DIR = await mkdtemp(path.join(tmpdir(), 'podcast-'));
  process.env.PODCAST_LIMITE_CUENTA = '2';
  process.env.PODCAST_LIMITE_DIA = '1000';
  await prepareEnv();
  api = (await import('../../api/podcast-grabado')) as unknown as Handler;
  if (!DB_URL) return;
  ({ POST: comunidades } = await import('../../api/comunidades'));
  await ensureSchema(comunidades);
  const call = client(comunidades, '2026-10-18');
  for (const nombre of ['Ana', 'Tomás', 'Rut']) llaves.push((await call('registrarse', { nombre })).json.llave);
  sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
  await sql`create table if not exists herramientas_ia (
    herramienta text not null, libro text not null, capitulo int not null, texto text not null,
    fuentes jsonb not null, modelo text, creado timestamptz not null default now(),
    primary key (herramienta, libro, capitulo))`;
  await api.GET(new Request('http://localhost/api/podcast-grabado?book=oba&chapter=1')); // crea la tabla
  await sql`delete from podcast_grabado where libro in ('oba', 'phm', 'jud', '2jn', '3jn', 'palabra:jesed')`;
  await sql`insert into herramientas_ia (herramienta, libro, capitulo, texto, fuentes)
    values ('palabra-podcast', 'jesed', 0, ${SCRIPT}, '[]') on conflict (herramienta, libro, capitulo) do update set texto = excluded.texto`;
  await sql`delete from herramientas_ia where herramienta = 'palabra-podcast' and libro = 'agape'`;
  for (const libro of ['oba', 'phm', 'jud', '2jn']) {
    await sql`insert into herramientas_ia (herramienta, libro, capitulo, texto, fuentes)
      values ('podcast', ${libro}, 1, ${SCRIPT}, '[]') on conflict do nothing`;
  }
});

afterAll(async () => {
  eleven.close();
  // Las e2e usan la misma base de datos en CI: no dejar grabado ni guardado lo que estas pruebas prepararon.
  if (sql) {
    await sql`delete from podcast_grabado where libro in ('oba', 'phm', 'jud', '2jn', '3jn', 'palabra:jesed')`;
    await sql`delete from herramientas_ia where (herramienta = 'palabra-podcast' and libro in ('jesed', 'agape'))
      or (herramienta = 'podcast' and libro in ('oba', 'phm', 'jud', '2jn', '3jn'))`;
  }
  await sql?.end();
});

const get = (book: string, chapter: number) =>
  api.GET(new Request(`http://localhost/api/podcast-grabado?book=${book}&chapter=${chapter}`)).then((r) => r.json());
const post = (body: unknown, llave?: string) => api.POST(request('/api/podcast-grabado', body, llave));

describe('guion', () => {
  it('separa a Ana y Tomás y quita las marcas de cita', () => {
    const lines = api.scriptLines('ANA: ¿Por qué de noche? ⟦1⟧\nTOMÁS: Juan no lo dice ⟦2⟧⟦3⟧.\nsigue aquí');
    expect(lines.map((l) => l.text)).toEqual(['¿Por qué de noche?', 'Juan no lo dice. sigue aquí']);
    expect(lines[0].voice).not.toBe(lines[1].voice);
  });
});

describe.skipIf(!DB_URL)('/api/podcast-grabado', () => {
  it('sin cuenta no graba, y un pedido raro no vale', async () => {
    expect((await post({ book: 'oba', chapter: 1 })).status).toBe(401);
    expect((await post({ book: '../x', chapter: 1 }, llaves[0])).status).toBe(400);
    expect((await post({ book: 'oba', chapter: 0 }, llaves[0])).status).toBe(400);
  });

  it('sin guion guardado pide prepararlo primero', async () => {
    const res = await post({ book: '3jn', chapter: 1 }, llaves[0]);
    expect(res.status).toBe(409);
  });

  it('la primera persona lo graba y luego está listo para todos sin volver a grabar', async () => {
    expect(await get('oba', 1)).toEqual({ estado: 'ninguno' });
    const antes = calls.length;
    const res = await post({ book: 'oba', chapter: 1 }, llaves[0]);
    expect(res.status).toBe(200);
    const listo = await res.json();
    expect(listo).toMatchObject({ estado: 'listo', duracion: 2 });
    // 10 intervenciones en tramos de 8: dos peticiones, con las voces alternadas y sin las marcas de cita.
    const nuevas = calls.slice(antes);
    expect(nuevas.length).toBe(2);
    expect(nuevas[0].model_id).toBe('eleven_v4');
    expect(nuevas[0].inputs[1].text).toBe('Respuesta 1.');
    expect(nuevas[0].inputs[0].voice_id).not.toBe(nuevas[0].inputs[1].voice_id);
    // Dónde empieza cada intervención: el segundo tramo empieza justo en el segundo 1.
    expect(listo.tiempos).toHaveLength(10);
    expect(listo.tiempos[0]).toBe(0);
    expect(listo.tiempos[8]).toBe(1);
    expect(listo.tiempos[7]).toBeLessThan(1);
    const mp3 = await readFile(new URL(listo.url));
    expect(mp3.length).toBe(16000);

    expect(await get('oba', 1)).toEqual(listo);
    expect(await (await post({ book: 'oba', chapter: 1 }, llaves[1])).json()).toEqual(listo);
    expect(calls.length).toBe(antes + 2);
  });

  it('si ElevenLabs falla se puede volver a intentar', async () => {
    failNext = true;
    expect((await post({ book: 'phm', chapter: 1 }, llaves[1])).status).toBe(502);
    expect(await get('phm', 1)).toEqual({ estado: 'ninguno' });
    expect((await (await post({ book: 'phm', chapter: 1 }, llaves[1])).json()).estado).toBe('listo');
  });

  it('cada cuenta tiene un límite diario', async () => {
    // La segunda cuenta ya grabó Filemón: con Judas llega al límite de dos.
    expect((await post({ book: 'jud', chapter: 1 }, llaves[1])).status).toBe(200);
    const res = await post({ book: '2jn', chapter: 1 }, llaves[1]);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain('2 pódcasts al día');
  });

  it('el pódcast de una palabra se graba con su guion y queda listo para todos', async () => {
    const palabra = (q: string) => api.GET(new Request(`http://localhost/api/podcast-grabado?${q}`));
    expect(await (await palabra('palabra=jesed')).json()).toEqual({ estado: 'ninguno' });
    expect((await palabra('palabra=inventada')).status).toBe(400);
    expect((await post({ palabra: 'jesed', book: 'oba', chapter: 1 }, llaves[2])).status).toBe(400);
    expect((await post({ palabra: 'agape' }, llaves[2])).status).toBe(409); // sin guion todavía

    const res = await post({ palabra: 'jesed' }, llaves[2]);
    expect(res.status).toBe(200);
    const listo = await res.json();
    expect(listo).toMatchObject({ estado: 'listo', duracion: 2 });
    expect(path.basename(new URL(listo.url).pathname)).toMatch(/^palabra-jesed-[0-9a-f]{10}\.mp3$/);
    expect(await (await palabra('palabra=jesed')).json()).toEqual(listo);
  });
});
