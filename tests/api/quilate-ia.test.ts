// Cada llamada a la IA de Zarza deja su traza en Quilate, no solo /api/estudiar: el buscador, los comentarios, el
// diccionario, las comunidades, el cuidado de preguntas, el dramatizado y la transcripción de videos.
// Quilate se simula con un servidor local que guarda lo que recibe. Las pruebas del buscador necesitan DATABASE_URL.
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request } from './helpers';

type Paso = {
  id: string;
  traceId: string;
  parentId: string | null;
  kind: string;
  name: string;
  model: string | null;
  fn: string | null;
  input: unknown;
  output: unknown;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  error: string | null;
  environment: string | null;
};
type Ayudas = typeof import('../../api/_quilate');

let servidor: Server;
let ia: Ayudas;
let buscar: Post;
let llave: string;
const recibidos: Paso[] = [];

beforeAll(async () => {
  servidor = createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (parte) => (cuerpo += parte));
    req.on('end', () => {
      if (req.url === '/v1/ingest') recibidos.push(...(JSON.parse(cuerpo) as { spans: Paso[] }).spans);
      res.writeHead(202).end();
    });
  });
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  process.env.QUILATE_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  process.env.QUILATE_KEY = 'quilate_sk_prueba';
  process.env.VERCEL_ENV = 'preview';
  await prepareEnv({ ai: true });
  ia = await import('../../api/_quilate');
  ({ POST: buscar } = await import('../../api/buscar'));
  if (DB_URL && HAS_DATA) {
    const { POST: comunidades } = await import('../../api/comunidades');
    await ensureSchema(comunidades);
    llave = (
      await client(comunidades, '2026-11-12')('registrarse', {
        nombre: 'Trazas del buscador',
      })
    ).json.llave;
  }
});

afterAll(() => {
  servidor.close();
  for (const variable of ['QUILATE_URL', 'QUILATE_KEY', 'VERCEL_ENV']) delete process.env[variable];
});

/** Las trazas salen después de responder: se espera a que lleguen las raíces pedidas. */
async function trazas(desde: number, raices = 1) {
  for (let espera = 0; espera < 200; espera++) {
    const nuevos = recibidos.slice(desde);
    if (nuevos.filter((paso) => paso.parentId === null).length >= raices) return nuevos;
    await new Promise((sigue) => setTimeout(sigue, 25));
  }
  throw new Error('La traza no llegó a Quilate');
}

const mensaje = (
  content: import('../../api/_quilate').MensajeClaude['content'],
  usage = {
    input_tokens: 120,
    output_tokens: 30,
    cache_read_input_tokens: 900,
    cache_creation_input_tokens: 40,
  },
) => ({ content, usage, stop_reason: 'end_turn' });

describe('conClaude: una llamada a Claude como traza', () => {
  it('guarda el nombre, la función, el modelo, lo pedido, el texto que respondió y los tokens, también los de caché', async () => {
    const desde = recibidos.length;
    const res = await ia.conClaude('Línea de contexto', { fn: 'contexto', model: 'claude-haiku-5-5', input: 'Juan 3:16' }, async () =>
      mensaje([
        { type: 'text', text: 'Jesús habla con ' },
        { type: 'text', text: 'Nicodemo de noche.' },
      ]),
    );
    expect(res.content).toHaveLength(2);
    const [paso] = await trazas(desde);
    expect({ ...paso }).toMatchObject({
      parentId: null,
      kind: 'model',
      name: 'Línea de contexto',
      fn: 'contexto',
      model: 'claude-haiku-5-5',
      input: 'Juan 3:16',
      output: 'Jesús habla con Nicodemo de noche.',
      inputTokens: 120,
      outputTokens: 30,
      cacheReadTokens: 900,
      cacheWriteTokens: 40,
      error: null,
      environment: 'preview',
    });
  });

  it('cuando la IA responde con una herramienta, la salida es lo que pasó a la herramienta', async () => {
    const desde = recibidos.length;
    await ia.conClaude('Explicar palabra', { fn: 'diccionario', model: 'm', input: 'Gracia' }, async () =>
      mensaje([
        {
          type: 'tool_use',
          name: 'explicar',
          input: { breve: 'Favor que no se merece.' },
        },
      ]),
    );
    const [paso] = await trazas(desde);
    expect(paso.output).toEqual({
      explicar: { breve: 'Favor que no se merece.' },
    });
  });

  it('si la llamada falla, la traza guarda el error y el error sigue su camino', async () => {
    const desde = recibidos.length;
    await expect(
      ia.conClaude('Proponer preguntas', { fn: 'comunidades', model: 'm', input: 'Rut 1' }, async () => {
        throw new Error('saturada');
      }),
    ).rejects.toThrow('saturada');
    const [paso] = await trazas(desde);
    expect(paso).toMatchObject({
      name: 'Proponer preguntas',
      error: 'Error: saturada',
      output: null,
    });
  });

  it('dentro de una traza abierta queda como un paso de ella, no como una traza aparte', async () => {
    const desde = recibidos.length;
    await ia.quilate.span('Respuesta', { kind: 'chain', fn: 'pregunta' }, () =>
      ia.conClaude('Corregir citas', { fn: 'corregir', model: 'm', input: 'Juan 3:16' }, async () =>
        mensaje([{ type: 'text', text: '[]' }]),
      ),
    );
    await ia.quilate.flush();
    const pasos = await trazas(desde);
    const raiz = pasos.find((paso) => paso.parentId === null)!;
    const hijo = pasos.find((paso) => paso.name === 'Corregir citas')!;
    expect(hijo).toMatchObject({
      parentId: raiz.id,
      traceId: raiz.traceId,
      kind: 'model',
    });
  });

  it('lo pedido y lo respondido se recortan: una traza nunca carga un capítulo entero', async () => {
    const desde = recibidos.length;
    const largo = 'a'.repeat(ia.MAX_TEXTO_TRAZA * 3);
    await ia.conClaude('Guion dramatizado', { fn: 'dramatizado', model: 'm', input: largo }, async () =>
      mensaje([{ type: 'text', text: largo }]),
    );
    const [paso] = await trazas(desde);
    expect((paso.input as string).length).toBe(ia.MAX_TEXTO_TRAZA);
    expect((paso.output as string).length).toBe(ia.MAX_TEXTO_TRAZA);
  });
});

describe('transcribir un video con Gemini deja su traza', () => {
  it('con el modelo de Gemini, el enlace y los tokens que cuenta Google', async () => {
    process.env.GEMINI_API_KEY = 'clave-de-prueba';
    const { transcribirConGemini } = await import('../../api/_videos');
    const desde = recibidos.length;
    const texto = await transcribirConGemini('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    delete process.env.GEMINI_API_KEY;
    const [paso] = await trazas(desde);
    expect({ ...paso }).toMatchObject({
      parentId: null,
      kind: 'model',
      name: 'Transcribir video',
      fn: 'videos',
      model: 'gemini-2.5-flash',
      input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      output: texto,
      error: null,
    });
    expect(paso.inputTokens).toBeGreaterThan(0);
    expect(paso.outputTokens).toBeGreaterThan(0);
  });
});

describe.skipIf(!DB_URL || !HAS_DATA)('el buscador con IA deja su traza', () => {
  it('una búsqueda es una traza: lo buscado, y adentro la propuesta y la revisión de pasajes', async () => {
    const desde = recibidos.length;
    const res = await buscar(request('/api/buscar', { query: 'versículos sobre la ansiedad' }, llave));
    expect(res.status).toBe(200);
    const respuesta = (await res.json()) as { results: { ref: string }[] };
    const pasos = await trazas(desde);
    const raiz = pasos.find((paso) => paso.parentId === null)!;
    expect({ ...raiz }).toMatchObject({
      kind: 'chain',
      name: 'Buscar con IA',
      fn: 'buscar',
      input: 'versículos sobre la ansiedad',
      error: null,
    });
    expect(raiz.output).toEqual(respuesta.results.map((r) => r.ref));
    const vueltas = pasos.filter((paso) => paso.kind === 'model');
    expect(vueltas.map((paso) => paso.name)).toEqual(['Proponer pasajes', 'Revisar pasajes']);
    for (const vuelta of vueltas)
      expect(vuelta).toMatchObject({
        parentId: raiz.id,
        traceId: raiz.traceId,
        fn: 'buscar',
      });
    expect(vueltas.every((vuelta) => vuelta.model && vuelta.outputTokens > 0)).toBe(true);
  });
});
