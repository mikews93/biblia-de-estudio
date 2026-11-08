// /api/dramatizado: la IA simulada escribe el guion, ElevenLabs simulada graba voces y sonidos, y el capítulo queda
// listo para todos. Necesita DATABASE_URL (ver tests/api/helpers.ts); los MP3 se guardan en una carpeta temporal.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { codificarMp3 } from '../../api/_mp3';
import { muestrasA16 } from '../../src/lib/nivelarVoces';
import { client, DB_URL, ensureSchema, Post, prepareEnv, request } from './helpers';
import { requests as aiRequests } from '../../e2e/support/mock-anthropic';

type Handler = {
  GET: (r: Request) => Promise<Response>;
  POST: Post;
  avanzar: (s: ReturnType<typeof postgres>, where: object, ctx: object) => Promise<void>;
};

const RATE = 24000;
const tono = (seg: number, rate = RATE, amp = 0.3) =>
  Float32Array.from({ length: Math.round(seg * rate) }, (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / rate));

const calls: { path: string; body: Record<string, unknown> }[] = [];
let creditosQuedan = 500000;
const eleven = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    const url = req.url ?? '';
    if (url.startsWith('/v1/user/subscription')) {
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ character_limit: creditosQuedan, character_count: 0 }));
    }
    if (url.startsWith('/v2/voices')) {
      const voices = [
        { voice_id: 'voz-mujer-es', labels: { gender: 'female', age: 'young', language: 'es' } },
        { voice_id: 'voz-ingles', labels: { gender: 'male', age: 'old', language: 'en', accent: 'british' } },
      ];
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ voices }));
    }
    const body = JSON.parse(raw || '{}');
    calls.push({ path: url, body });
    if (url.startsWith('/v1/text-to-dialogue/with-timestamps')) {
      // Medio segundo de voz por intervención, con silencio en los bordes como ElevenLabs.
      const m = Float32Array.from([...tono(0.1, RATE, 0), ...body.inputs.flatMap(() => [...tono(0.5)]), ...tono(0.2, RATE, 0)]);
      const pcm = muestrasA16(m);
      const audio_base64 = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString('base64');
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ audio_base64 }));
    }
    if (url.startsWith('/v1/sound-generation')) {
      const mp3 = await codificarMp3(muestrasA16(tono(body.duration_seconds ?? 2, 44100, 0.05)), 44100, 128);
      return res.writeHead(200, { 'Content-Type': 'audio/mpeg' }).end(Buffer.from(mp3));
    }
    res.writeHead(404).end();
  });
});

let api: Handler;
let comunidades: Post;
let sql: ReturnType<typeof postgres>;
const llaves: string[] = [];
const VERSOS: [number, string][] = [
  [1, 'Y salieron a él todos los pueblos de Judea, y se les dio el bautismo en el río.'],
  [2, 'Tú eres mi Hijo amado; en ti me deleito.'],
  [3, 'Y luego el Espíritu lo llevó al desierto.'],
  [4, 'Y estuvo allí cuarenta días.'],
];

beforeAll(async () => {
  await new Promise<void>((r) => eleven.listen(0, '127.0.0.1', r));
  process.env.ELEVENLABS_BASE_URL = `http://127.0.0.1:${(eleven.address() as AddressInfo).port}`;
  process.env.ELEVENLABS_API_KEY = 'clave-de-prueba';
  process.env.DRAMA_STORE_DIR = await mkdtemp(path.join(tmpdir(), 'drama-'));
  process.env.DRAMA_LIMITE_CUENTA = '1';
  process.env.DRAMA_LIMITE_DIA = '1000';
  process.env.DRAMA_SIN_SEGUIR = '1';
  await prepareEnv({ ai: true });
  // Un capítulo pequeño propio: así no hace falta generar public/data.
  const data = await mkdtemp(path.join(tmpdir(), 'drama-data-'));
  await mkdir(path.join(data, 'text', 'rv1909', 'oba'), { recursive: true });
  await writeFile(path.join(data, 'books.json'), JSON.stringify([{ id: 'oba', name: 'Abdías', chapters: 1 }]));
  await writeFile(path.join(data, 'versions.json'), JSON.stringify([]));
  await writeFile(path.join(data, 'text', 'rv1909', 'oba', '1.json'), JSON.stringify(VERSOS));
  // El trasfondo para ambientar: un lugar y una medida del capítulo.
  await mkdir(path.join(data, 'contexto', 'oba'), { recursive: true });
  await writeFile(
    path.join(data, 'contexto', 'oba', '1.json'),
    JSON.stringify({
      imagenes: [{ id: 'jordan', kind: 'lugar', title: 'Río Jordán', caption: 'Río de aguas lentas entre juncos, al pie del desierto de Judea.', verses: [1] }],
      medidas: [{ name: 'Cuarenta días', kind: 'Tiempo', value: 'unas seis semanas', note: 'Número de prueba en la Biblia.', verses: [4] }],
    }),
  );
  process.env.DATA_DIR = data;
  api = (await import('../../api/dramatizado')) as unknown as Handler;
  if (!DB_URL) return;
  ({ POST: comunidades } = await import('../../api/comunidades'));
  await ensureSchema(comunidades);
  const call = client(comunidades, '2026-11-08');
  for (const nombre of ['Abel', 'Ester']) llaves.push((await call('registrarse', { nombre })).json.llave);
  sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
  await api.GET(new Request('http://localhost/api/dramatizado?book=oba&chapter=1')); // crea la tabla
  await sql`delete from drama_grabado where libro in ('oba', 'jud')`;
});

afterAll(async () => {
  eleven.close();
  if (sql) await sql`delete from drama_grabado where libro in ('oba', 'jud')`;
  await sql?.end();
});

const get = (q = 'book=oba&chapter=1') => api.GET(new Request(`http://localhost/api/dramatizado?${q}`)).then((r) => r.json());
const post = (body: unknown, llave?: string) => api.POST(request('/api/dramatizado', body, llave));
const where = { book: 'oba', chapter: 1, version: 'rv1909', clave: 'oba' };
const ctx = { origen: 'http://localhost', cookie: null };

describe.skipIf(!DB_URL)('/api/dramatizado', () => {
  it('sin cuenta no lo empieza, y un pedido raro no vale', async () => {
    expect((await post({ book: 'oba', chapter: 1 })).status).toBe(401);
    expect((await post({ book: '../x', chapter: 1 }, llaves[0])).status).toBe(400);
    expect(await get()).toEqual({ estado: 'ninguno' });
  });

  it('sin créditos suficientes en ElevenLabs no empieza (deja el margen para el pódcast)', async () => {
    creditosQuedan = 5000;
    const res = await post({ book: 'oba', chapter: 1 }, llaves[0]);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/no quedan voces/);
    creditosQuedan = 500000;
  });

  it('escribe el guion, graba las piezas y mezcla el capítulo, que queda listo para todos', async () => {
    const res = await post({ book: 'oba', chapter: 1 }, llaves[0]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ estado: 'grabando', fase: 'guion' });
    // En Vercel cada fase se pide a sí misma la siguiente; aquí se avanzan a mano.
    // El POST ya empezó la primera fase por su cuenta: mientras la trabaja, avanzar no hace nada y hay que esperarla.
    for (let i = 0; i < 60 && (await get()).estado === 'grabando'; i++) {
      await api.avanzar(sql, where, ctx);
      await new Promise((r) => setTimeout(r, 50));
    }
    const listo = await get();
    expect(listo.estado).toBe('listo');
    expect(listo.url).toMatch(/^file:.*oba-1-\w+\.mp3$/);
    expect(listo.tiempos.map(([v]: [number, number]) => v)).toEqual([1, 2, 3, 4]);
    expect(listo.duracion).toBeGreaterThan(3);

    const [row] = await sql<{ corregidos: number[]; voces: Record<string, string[]> }[]>`select corregidos, voces from drama_grabado where libro = 'oba'`;
    // El versículo 3 que la IA cambió lo lee el narrador con el texto exacto.
    expect(row.corregidos).toEqual([3]);
    const dialogos = calls.filter((c) => c.path.startsWith('/v1/text-to-dialogue'));
    const textos = dialogos.flatMap((c) => (c.body.inputs as { text: string }[]).map((x) => x.text));
    expect(textos).toContain('Y luego el Espíritu lo llevó al desierto.');
    expect(textos.some((t) => t.includes('no dice la Biblia'))).toBe(false);
    // El narrador es Abel; la voz de Dios desde el cielo es un coro de tres voces que no usa nadie más.
    expect(row.voces.NARRADOR).toEqual(['452WrNT9o8dphaYW5YGU']);
    expect(row.voces.DIOS).toHaveLength(3);
    expect(new Set(row.voces.DIOS).size).toBe(3);
    expect(row.voces.DIOS).not.toContain(row.voces.JUAN[0]);
    const deDios = dialogos.filter((c) => (c.body.inputs as { text: string }[])[0].text.startsWith('[warm, majestic, slow] Tú eres'));
    expect(deDios).toHaveLength(3);
    // Las voces en inglés de la cuenta no entran al reparto.
    expect(Object.values(row.voces).flat()).not.toContain('voz-ingles');
    // La IA recibió el trasfondo del capítulo para ambientarlo, antes del texto, y las reglas para usarlo.
    const pedido = aiRequests.find((r) => JSON.stringify(r.system).includes('Escribes el guion de un capítulo dramatizado'))!;
    const mensaje = pedido.messages[0].content as string;
    expect(mensaje).toContain('Trasfondo de Abdías 1 para ambientarlo');
    expect(mensaje).toContain('- Río Jordán (lugar, v. 1): Río de aguas lentas entre juncos');
    expect(mensaje).toContain('- Cuarenta días (v. 4): unas seis semanas');
    expect(mensaje.indexOf('Trasfondo')).toBeLessThan(mensaje.indexOf('Capítulo: Abdías 1'));
    expect(JSON.stringify(pedido.system)).toContain('Úsalo para ambientar');
    // Ambiente, efecto y capa de trueno.
    expect(calls.filter((c) => c.path.startsWith('/v1/sound-generation')).map((c) => c.body.text)).toEqual(
      expect.arrayContaining(['flowing river, gentle current', 'splashing water', 'very distant low rolling thunder, soft and deep, no rain']),
    );
  });

  it('pedirlo otra vez no lo vuelve a grabar, y la misma cuenta no puede empezar otro hoy', async () => {
    const antes = calls.length;
    expect(await (await post({ book: 'oba', chapter: 1 }, llaves[1])).json()).toMatchObject({ estado: 'listo' });
    expect(calls.length).toBe(antes);
    const otro = await post({ book: 'jud', chapter: 1 }, llaves[0]);
    expect(otro.status).toBe(429);
    expect((await otro.json()).error).toMatch(/un capítulo al día/);
  });
});
