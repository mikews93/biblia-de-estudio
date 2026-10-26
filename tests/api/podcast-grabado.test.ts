// /api/podcast-grabado: graba el pódcast con una ElevenLabs simulada y lo deja listo para todos.
// Necesita DATABASE_URL (ver tests/api/helpers.ts); los MP3 se guardan en una carpeta temporal.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { codificarMp3, decodificarMp3 } from '../../api/_mp3';
import { muestrasA16, volumenHabla } from '../../src/lib/nivelarVoces';
import { client, DB_URL, ensureSchema, Post, prepareEnv, request } from './helpers';

type Handler = {
  GET: (r: Request) => Promise<Response>;
  POST: Post;
  scriptLines: (t: string) => { voice: string; text: string }[];
  renivelar: (s: ReturnType<typeof postgres>, where: { book: string; chapter: number }, url: string) => Promise<void>;
};

const RATE = 24000;
const ANA = 'CaJslL1xziwefCeTNzHv';
/** Un tono que suena `seg` segundos a cierto volumen y al final calla `pausa`, como una intervención. */
function voz(amplitud: number, seg: number, pausa = seg / 5, hz = 220): Float32Array {
  const m = new Float32Array(Math.round(seg * RATE));
  const habla = m.length - Math.round(pausa * RATE);
  for (let i = 0; i < habla; i++) m[i] = amplitud * Math.sin((2 * Math.PI * hz * i) / RATE);
  return m;
}
/** Ana muy baja y Tomás fuerte, como las entrega ElevenLabs. */
const amplitud = (voice: string) => (voice === ANA ? 0.08 : 0.4);

const calls: { inputs: { text: string; voice_id: string }[]; model_id: string }[] = [];
const paths: string[] = [];
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
    paths.push(req.url ?? '');
    // Un segundo por tramo, repartido entre las intervenciones, en PCM de 16 bits con dónde suena cada una.
    const n = body.inputs.length;
    const partes = body.inputs.map((x: { voice_id: string }) => voz(amplitud(x.voice_id), 1 / n));
    const pcm = muestrasA16(Float32Array.from(partes.flatMap((p: Float32Array) => [...p])));
    let at = 0;
    const voice_segments = partes.map((p: Float32Array, i: number) => {
      const seg = { voice_id: body.inputs[i].voice_id, start_time_seconds: at / RATE, end_time_seconds: (at + p.length) / RATE, dialogue_input_index: i };
      at += p.length;
      return seg;
    });
    const audio_base64 = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString('base64');
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ audio_base64, voice_segments }));
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
    expect(paths.at(-1)).toBe('/v1/text-to-dialogue/with-timestamps?output_format=pcm_24000');
    // Dónde empieza cada intervención, como lo dice ElevenLabs: 8 en el primer segundo y 2 en el segundo.
    expect(listo.tiempos).toEqual([0, 0.1, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 1, 1.5]);
    // Ana llega 14 dB más baja; en el MP3 las dos voces suenan igual.
    const { muestras, rate } = await decodificarMp3(new Uint8Array(await readFile(new URL(listo.url))));
    expect(rate).toBe(RATE);
    // El MP3 añade unos milisegundos de relleno.
    expect(muestras.length / rate).toBeGreaterThanOrEqual(2);
    expect(muestras.length / rate).toBeLessThan(2.1);
    const ana = volumenHabla(muestras, rate, { desde: Math.round(1.05 * rate), hasta: Math.round(1.4 * rate) })!;
    const tomas = volumenHabla(muestras, rate, { desde: Math.round(1.55 * rate), hasta: Math.round(1.9 * rate) })!;
    expect(Math.abs(ana - tomas)).toBeLessThan(1.5);

    expect(await get('oba', 1)).toEqual(listo);
    expect(await (await post({ book: 'oba', chapter: 1 }, llaves[1])).json()).toEqual(listo);
    expect(calls.length).toBe(antes + 2);
  });

  it('una grabación de antes se nivela una vez y desde ahí se sirve la nivelada', async () => {
    // Un MP3 viejo con Ana baja y Tomás fuerte, que ya estaba listo.
    const viejo = Float32Array.from([...voz(0.08, 1, 0.4), ...voz(0.4, 1, 0.4), ...voz(0.08, 1, 0.4)]);
    const archivo = path.join(process.env.PODCAST_STORE_DIR!, '3jn-1-viejo.mp3');
    await writeFile(archivo, await codificarMp3(muestrasA16(viejo), RATE, 64));
    const url = `file://${archivo}`;
    await sql`insert into podcast_grabado (libro, capitulo, estado, url, duracion, credito)
      values ('3jn', 1, 'listo', ${url}, 3, 'Voces')`;
    // La primera visita todavía recibe la de antes y deja la nivelación andando.
    expect((await get('3jn', 1)).url).toBe(url);
    let listo = await get('3jn', 1);
    for (let i = 0; i < 100 && listo.url === url; i++) {
      await new Promise((r) => setTimeout(r, 100));
      listo = await get('3jn', 1);
    }
    expect(listo.url).toBe(`file://${path.join(process.env.PODCAST_STORE_DIR!, '3jn-1-viejo-n.mp3')}`);
    const { muestras, rate } = await decodificarMp3(new Uint8Array(await readFile(new URL(listo.url))));
    const tramo = (s: number) => volumenHabla(muestras, rate, { desde: Math.round((s + 0.1) * rate), hasta: Math.round((s + 0.5) * rate) })!;
    expect(Math.abs(tramo(0) - tramo(1))).toBeLessThan(1.5);
    expect(Math.abs(tramo(2) - tramo(1))).toBeLessThan(1.5);
    // Ya nivelada no se vuelve a tocar.
    await api.renivelar(sql, { book: '3jn', chapter: 1 }, listo.url);
    expect((await get('3jn', 1)).url).toBe(listo.url);
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
