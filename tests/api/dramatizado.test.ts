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
  repartir: (plan: object, disponibles: object[], semilla: string, fijas?: Record<string, string>) => Record<string, string[]>;
  persistente: (id: string) => boolean;
  completarReparto: (s: ReturnType<typeof postgres>, plan: object, disponibles: object[], fijas: Record<string, string>) => Promise<object[]>;
};

const RATE = 24000;
const tono = (seg: number, rate = RATE, amp = 0.3) =>
  Float32Array.from({ length: Math.round(seg * rate) }, (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / rate));

const calls: { path: string; body: Record<string, unknown> }[] = [];
let creditosQuedan = 500000;
let mudaDada = false;
const bibliotecaPedidos: string[] = [];
const anadidas: string[] = [];
const borradas: string[] = [];
let sinSitio = 0;
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
    if (url.startsWith('/v1/shared-voices')) {
      // La biblioteca: por género y edad; la primera de mujer mayor se presenta como «la voz de Dios» y no vale.
      const q = new URL(url, 'http://x').searchParams;
      bibliotecaPedidos.push(`${q.get('gender')}|${q.get('age')}|${q.get('accent') ?? ''}`);
      const voices = [
        { voice_id: `lib-dios-${q.get('gender')}-${q.get('age')}`, public_owner_id: 'dueno-1', name: 'God - Deep and Powerful' },
        { voice_id: `lib-${q.get('gender')}-${q.get('age')}`, public_owner_id: 'dueno-2', name: 'Abuela Rosa' },
      ];
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ voices }));
    }
    if (url.startsWith('/v1/voices/add/')) {
      if (sinSitio > 0) {
        sinSitio--;
        return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ detail: { status: 'voice_limit_reached', message: 'You have reached your maximum amount of custom voices' } }));
      }
      anadidas.push(url.split('/').at(-1)!);
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ voice_id: url.split('/').at(-1) }));
    }
    if (req.method === 'DELETE' && url.startsWith('/v1/voices/')) {
      borradas.push(url.split('/').at(-1)!);
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    }
    const body = JSON.parse(raw || '{}');
    calls.push({ path: url, body });
    if (url.startsWith('/v1/text-to-dialogue/with-timestamps')) {
      // Voz al ritmo del habla (unos 14 caracteres por segundo) por intervención, con silencio en los bordes como
      // ElevenLabs, y dónde suena cada una.
      const largos: number[] = body.inputs.map((x: { text: string }) => x.text.length / 14);
      // La primera vez, la última intervención de la toma de los vv. 3-4 llega muda (le pasa a ElevenLabs).
      const muda = body.inputs.length > 1 && !mudaDada && body.inputs.at(-1).text.includes('cuarenta días');
      if (muda) mudaDada = true;
      const m = Float32Array.from([
        ...tono(0.1, RATE, 0),
        ...largos.flatMap((d, k) => [...tono(d, RATE, muda && k === largos.length - 1 ? 0 : 0.3)]),
        ...tono(0.2, RATE, 0),
      ]);
      const pcm = muestrasA16(m);
      const audio_base64 = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString('base64');
      let at = 0.1;
      const voice_segments = largos.map((d, k) => {
        const sg = { start_time_seconds: at, end_time_seconds: at + d, dialogue_input_index: k };
        at += d;
        return sg;
      });
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ audio_base64, voice_segments }));
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
  // Una cortina de entrada de 6 s para el tono «esperanza»: la narración empieza cuando va terminando.
  const cortinas = await mkdtemp(path.join(tmpdir(), 'drama-cortinas-'));
  await writeFile(path.join(cortinas, 'esperanza-entrada.mp3'), await codificarMp3(muestrasA16(tono(6, 44100, 0.1)), 44100, 128));
  process.env.DRAMA_CORTINAS_DIR = cortinas;
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
  await sql`delete from drama_voz where personaje = 'JUAN_BAUTISTA'`;
});

afterAll(async () => {
  eleven.close();
  if (sql) await sql`delete from drama_grabado where libro in ('oba', 'jud')`;
  if (sql) await sql`delete from drama_voz where personaje = 'JUAN_BAUTISTA'`;
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
    // La cortina de entrada suena sola antes de que empiece el narrador; y hay una versión «solo voces».
    expect(listo.tiempos[0][1]).toBeGreaterThanOrEqual(4.4);
    expect(listo.soloVoces).toMatch(/^file:.*oba-1-\w+-voces\.mp3$/);

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
    expect(row.voces.DIOS).not.toContain(row.voces.JUAN_BAUTISTA[0]);
    const deDios = dialogos.filter((c) => (c.body.inputs as { text: string }[])[0].text.startsWith('[warm, majestic, slow] Tú eres'));
    expect(deDios).toHaveLength(3);
    // Cada escena se graba en tomas de corrido: el v. 1 (narrador y Juan) en una; el 3 y el 4 juntos en otra, unida
    // con lo que dijo Dios justo antes. La voz de Dios, el efecto y la pausa cortan la toma.
    const tomas = dialogos.filter((c) => !(c.body.inputs as { text: string }[])[0].text.startsWith('[warm, majestic'));
    expect(tomas.filter((c) => (c.body.inputs as unknown[]).length > 1)).toHaveLength(2);
    const [v1, v34] = tomas.filter((c) => (c.body.inputs as unknown[]).length > 1).map((c) => c.body);
    expect((v34.inputs as { text: string }[]).map((x) => x.text).join(' ')).toContain('cuarenta días');
    expect(v34.previous_text).toBe('Tú eres mi Hijo amado; en ti me deleito.');
    // La intervención que llegó muda se grabó otra vez sola.
    expect(mudaDada).toBe(true);
    expect(dialogos.filter((c) => (c.body.inputs as { text: string }[]).length === 1 && (c.body.inputs as { text: string }[])[0].text.includes('cuarenta días'))).toHaveLength(1);
    // Estabilidad por papel: con personajes, más emoción; el narrador solo, natural; Dios, firme.
    expect(v1.settings).toEqual({ stability: 0.35 });
    expect(v34.settings).toEqual({ stability: 0.5 });
    expect(deDios[0].body.settings).toEqual({ stability: 0.6 });
    // La pausa dentro de la línea se queda; el gesto que no se oye se quita.
    const juan = (v1.inputs as { text: string }[])[1].text;
    expect(juan).toMatch(/^\[proclaiming\] \S+ \[short pause\] /);
    expect(juan).not.toContain('smiling');
    // Juan el Bautista guarda su voz para los demás capítulos.
    const [fija] = await sql<{ voz: string }[]>`select voz from drama_voz where personaje = 'JUAN_BAUTISTA' and edad = 'joven'`;
    expect(fija.voz).toBe(row.voces.JUAN_BAUTISTA[0]);
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
    const sonidos = calls.filter((c) => c.path.startsWith('/v1/sound-generation'));
    expect(sonidos.map((c) => c.body.text)).toEqual(
      expect.arrayContaining(['flowing river, gentle current', 'crowd murmuring by the water', 'splashing water', 'very distant low rolling thunder, soft and deep, no rain']),
    );
    expect(sonidos.every((c) => c.body.model_id === 'eleven_text_to_sound_v3')).toBe(true);
    expect(JSON.stringify(pedido.system)).toContain('DIRECCION');
  });

  it('pedirlo otra vez no lo vuelve a grabar, y la misma cuenta no puede empezar otro hoy', async () => {
    const antes = calls.length;
    expect(await (await post({ book: 'oba', chapter: 1 }, llaves[1])).json()).toMatchObject({ estado: 'listo' });
    expect(calls.length).toBe(antes);
    const otro = await post({ book: 'jud', chapter: 1 }, llaves[0]);
    expect(otro.status).toBe(429);
    expect((await otro.json()).error).toMatch(/un capítulo al día/);
  });

  it('quien cuida la app puede rehacer un capítulo grabado antes de la dirección nueva; nadie más', async () => {
    process.env.CUIDADORES = 'cuida-drama@zarza.test';
    const call = client(comunidades, '2026-11-08');
    await sql`delete from usuarios where correo = 'cuida-drama@zarza.test'`;
    const cuida = (await call('registrarse', { nombre: 'Rut', correo: 'cuida-drama@zarza.test', clave: 'una clave larga' })).json.llave as string;
    // Una grabación de antes: sin «solo voces».
    await sql`update drama_grabado set url_voces = null where libro = 'oba' and capitulo = 1`;
    expect(await get()).toMatchObject({ estado: 'listo', anterior: true });
    const antes = calls.length;
    expect(await (await post({ book: 'oba', chapter: 1, rehacer: true }, llaves[1])).json()).toMatchObject({ estado: 'listo' });
    expect(calls.length).toBe(antes);
    const res = await post({ book: 'oba', chapter: 1, rehacer: true }, cuida);
    expect(await res.json()).toMatchObject({ estado: 'grabando', fase: 'guion' });
    for (let i = 0; i < 60 && (await get()).estado === 'grabando'; i++) {
      await api.avanzar(sql, where, ctx);
      await new Promise((r) => setTimeout(r, 50));
    }
    const nuevo = await get();
    expect(nuevo.estado).toBe('listo');
    expect(nuevo.soloVoces).toBeTruthy();
    expect(nuevo.anterior).toBeUndefined();
    delete process.env.CUIDADORES;
  });
});

describe.skipIf(!DB_URL)('voces de la biblioteca de ElevenLabs', () => {
  const plan = {
    personajes: [
      { id: 'ZACARIAS', genero: 'hombre', edad: 'mayor', nombre: 'Zacarías' },
      { id: 'ELISABET', genero: 'mujer', edad: 'mayor', nombre: 'Elisabet' },
      { id: 'MARIA_MADRE', genero: 'mujer', edad: 'joven', nombre: 'María' },
    ],
    escenas: [],
  };
  it('busca en la biblioteca la voz que falta (una anciana), sin «voces de Dios», y la añade a la cuenta', async () => {
    await sql`delete from drama_biblioteca`;
    anadidas.length = 0;
    bibliotecaPedidos.length = 0;
    const disponibles = await api.completarReparto(sql, plan, [], {});
    // Zacarías tiene voces de hombre mayor entre las conocidas; María, la joven de la cuenta (voz-mujer-es) no está
    // aquí porque pasamos la cuenta vacía: faltan una mujer mayor y una mujer joven.
    expect(bibliotecaPedidos).toContain('female|old|latin american');
    expect(anadidas).toEqual(['lib-female-old', 'lib-female-young']);
    expect(disponibles).toEqual(expect.arrayContaining([{ id: 'lib-female-old', genero: 'mujer', edad: 'mayor' }]));
    const v = api.repartir(plan, disponibles, 'luk:1', {});
    expect(v.ELISABET).toEqual(['lib-female-old']);
    expect(['Yb8JGzcZyW5YYzenhRCm', 'wfTWLJ20rcMqvU8gIiAB']).toContain(v.ZACARIAS[0]);
    expect((await sql`select voz from drama_biblioteca order by voz`).map((r) => r.voz)).toEqual(['lib-female-old', 'lib-female-young']);
  });
  it('si la cuenta no tiene sitio, quita la añadida menos usada y vuelve a poner las fijas cuando hacen falta', async () => {
    await sql`delete from drama_biblioteca`;
    await sql`insert into drama_biblioteca (voz, dueno, genero, edad, nombre, en_cuenta, usada) values
      ('lib-vieja', 'd', 'hombre', 'adulto', 'Vieja', true, now() - interval '30 days'),
      ('lib-elisabet', 'd', 'mujer', 'mayor', 'Elisabet', false, now() - interval '10 days')`;
    anadidas.length = 0;
    borradas.length = 0;
    sinSitio = 1;
    // Elisabet ya tenía voz (quitada de la cuenta): se vuelve a añadir, liberando la menos usada.
    const disponibles = await api.completarReparto(sql, plan, [{ id: 'voz-mujer-es', genero: 'mujer', edad: 'joven' }], { 'ELISABET|mayor': 'lib-elisabet' });
    expect(borradas).toEqual(['lib-vieja']);
    expect(anadidas).toEqual(['lib-elisabet']);
    expect(api.repartir(plan, disponibles, 'luk:1', { 'ELISABET|mayor': 'lib-elisabet' }).ELISABET).toEqual(['lib-elisabet']);
    expect((await sql`select en_cuenta from drama_biblioteca where voz = 'lib-vieja'`)[0].en_cuenta).toBe(false);
  });
});

describe('el reparto de voces', () => {
  const plan = {
    personajes: [
      { id: 'PEDRO', genero: 'hombre', edad: 'adulto', nombre: 'Pedro' },
      { id: 'GENTE_1', genero: 'hombre', edad: 'adulto', nombre: 'La gente' },
    ],
    escenas: [],
  };
  it('un personaje con nombre conserva la voz que tuvo en otros capítulos', () => {
    for (const semilla of ['mrk:1', 'jhn:21', 'act:2']) {
      expect(api.repartir(plan, [], semilla, { 'PEDRO|adulto': 'CE9m1PQE2E76CKUkNL7C' }).PEDRO).toEqual(['CE9m1PQE2E76CKUkNL7C']);
    }
    // Una voz guardada que ya no está en el reparto, o de otro género, no se usa.
    expect(api.repartir(plan, [], 'mrk:1', { 'PEDRO|adulto': 'no-existe' }).PEDRO[0]).not.toBe('no-existe');
    expect(api.repartir(plan, [], 'mrk:1', { 'PEDRO|adulto': 'iBGVhgcEZS6A5gTOjqSJ' }).PEDRO[0]).not.toBe('iBGVhgcEZS6A5gTOjqSJ');
  });
  it('una voz guardada que no es de la edad del personaje se cambia por una de su edad', () => {
    const anciano = { personajes: [{ id: 'ZACARIAS', genero: 'hombre', edad: 'mayor', nombre: 'Zacarías' }], escenas: [] };
    const v = api.repartir(anciano, [], 'luk:1', { 'ZACARIAS|mayor': 'ByVRQtaK1WDOvTmP1PKO' }).ZACARIAS[0];
    expect(['Yb8JGzcZyW5YYzenhRCm', 'wfTWLJ20rcMqvU8gIiAB']).toContain(v);
  });
  it('los grupos y los papeles sin nombre no guardan voz', () => {
    expect(['PEDRO', 'MARIA_MAGDALENA', 'JUAN_BAUTISTA'].every(api.persistente)).toBe(true);
    expect(['GENTE_1', 'SOLDADO', 'CRIADA_2', 'FARISEO_1', 'MULTITUD'].some(api.persistente)).toBe(false);
  });
});
