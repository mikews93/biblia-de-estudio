// /api/estudiar: validación de la petición y respuesta NDJSON con la IA simulada (e2e/support/mock-anthropic.ts).
// Las pruebas con cuenta necesitan DATABASE_URL (ver tests/api/helpers.ts) y public/data.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { beforeAll, describe, expect, it } from 'vitest';

import { parseMindMap } from '../../src/lib/mapaMental';
import { parseScript } from '../../src/lib/podcast';
import { parseCards } from '../../src/lib/tarjetas';
import { client, DATA_DIR, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request } from './helpers';

type Event = { type: string; text?: string; n?: number; label?: string; ref?: string; message?: string };

let estudiar: Post;
let comunidades: Post;
let aiRequests: Record<string, any>[];
let llave: string;

beforeAll(async () => {
  ({ requests: aiRequests } = await prepareEnv({ ai: true }));
  ({ POST: estudiar } = await import('../../api/estudiar'));
  ({ POST: comunidades } = await import('../../api/comunidades'));
  if (DB_URL && HAS_DATA) {
    await ensureSchema(comunidades);
    llave = (await client(comunidades, '2026-10-18')('registrarse', { nombre: 'Estudio' })).json.llave;
  }
});

const ask = (body: unknown, key = llave) => estudiar(request('/api/estudiar', body, key));

async function events(res: Response): Promise<Event[]> {
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('application/x-ndjson');
  return (await res.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l) as Event);
}

const textOf = (evs: Event[]) => evs.filter((e) => e.type === 'text').map((e) => e.text).join('');
const lastAiText = () => JSON.stringify(aiRequests.at(-1));

describe('/api/estudiar sin cuenta', () => {
  it('pide una cuenta antes de mirar la petición', async () => {
    const res = await estudiar(request('/api/estudiar', { book: 'jhn', chapter: 3 }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Necesitas una cuenta', cuenta: true });
  });

  it.skipIf(!DB_URL)('una llave que no existe tampoco sirve', async () => {
    const res = await ask({ book: 'jhn', chapter: 3 }, 'inventada');
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Tu sesión terminó. Vuelve a entrar.');
  });
});

describe.skipIf(!DB_URL || !HAS_DATA)('/api/estudiar con cuenta', () => {
  const bad = async (body: unknown, status = 400) => {
    const res = await ask(body);
    expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(status);
    return (await res.json()).error as string;
  };

  it('rechaza libros, capítulos, versículos y palabras que no existen', async () => {
    expect(await bad('{roto')).toBe('JSON no válido');
    expect(await bad({ book: 'xyz', chapter: 1 })).toBe('Libro o capítulo no válido');
    expect(await bad({ book: 'jhn', chapter: 22 })).toBe('Libro o capítulo no válido');
    expect(await bad({ book: 'jhn', chapter: 0 })).toBe('Libro o capítulo no válido');
    expect(await bad({ book: 'jhn', chapter: 1.5 })).toBe('Libro o capítulo no válido');
    expect(await bad({ book: 'jhn' })).toBe('Libro o capítulo no válido');
    expect(await bad({ book: 'jhn', chapter: 3, verse: 0 })).toBe('Versículo no válido');
    expect(await bad({ book: 'jhn', chapter: 3, verse: 99 }, 404)).toBe('Ese versículo no existe');
    expect(await bad({ book: 'jhn', chapter: 3, word: 0 })).toBe('Palabra no válida');
    expect(await bad({ book: 'jhn', chapter: 3, verse: 16, word: -1 })).toBe('Palabra no válida');
    expect(await bad({ book: 'jhn', chapter: 3, verse: 16, word: 500 }, 404)).toBe('Esa palabra no existe en el versículo');
  });

  it('la conversación alterna asistente y persona, termina en una pregunta y tiene límites', async () => {
    const turn = (role: string, text = 'x') => ({ role, text });
    const base = { book: 'jhn', chapter: 3 };
    expect(await bad({ ...base, messages: [turn('user')] })).toBe('Conversación no válida');
    expect(await bad({ ...base, messages: [turn('assistant')] })).toBe('Conversación no válida');
    expect(await bad({ ...base, messages: [turn('assistant'), turn('user', 'x'.repeat(601))] })).toBe('Conversación no válida');
    expect(await bad({ ...base, messages: [turn('assistant'), { role: 'user', text: 5 }] })).toBe('Conversación no válida');
    expect(await bad({ ...base, messages: 'hola' })).toBe('Conversación no válida');
    const long = Array.from({ length: 14 }, (_, i) => turn(i % 2 ? 'user' : 'assistant'));
    expect(await bad({ ...base, messages: long })).toBe('Conversación no válida');
  });

  it('valida el pedido del Taller y las herramientas', async () => {
    const base = { book: 'jhn', chapter: 3 };
    const taller = { modo: 'sugerir', tipo: 'sermon', paso: 'bosquejo' };
    expect(await bad({ ...base, taller: { ...taller, modo: 'escribir' } })).toBe('Pedido del Taller no válido');
    expect(await bad({ ...base, taller: { ...taller, borrador: 'x'.repeat(12001) } })).toBe('Pedido del Taller no válido');
    expect(await bad({ ...base, taller: { ...taller, desde: 0 } })).toBe('Pedido del Taller no válido');
    expect(await bad({ ...base, taller: 'sermon' })).toBe('Pedido del Taller no válido');
    expect(await bad({ ...base, herramienta: 'video' })).toBe('Herramienta no válida');
    expect(await bad({ ...base, herramienta: 'constructor' })).toBe('Herramienta no válida');
    expect(await bad({ ...base, herramienta: 'mapa', verse: 3 })).toBe('Herramienta no válida');
    expect(await bad({ ...base, herramienta: 'mapa', taller })).toBe('Herramienta no válida');
    expect(await bad({ ...base, nueva: true })).toBe('Pedido no válido');
    expect(await bad({ ...base, herramienta: 'mapa', nueva: 'sí' })).toBe('Pedido no válido');
  });

  it('estudio de un capítulo: texto por partes, la fuente citada con su referencia y «done»', async () => {
    const evs = await events(await ask({ book: 'jhn', chapter: 3 }));
    expect(evs.filter((e) => e.type === 'text').length).toBeGreaterThan(2); // llega por partes
    expect(textOf(evs)).toBe('Estudio simulado del pasaje: Dios ama al mundo y da a su Hijo.⟦1⟧');
    expect(evs.filter((e) => e.type === 'source')).toEqual([{ type: 'source', n: 1, label: 'Juan 3:1', ref: 'jhn.3.1' }]);
    expect(evs.at(-1)).toEqual({ type: 'done' });
    // La marca de cita llega después de su fuente
    expect(evs.findIndex((e) => e.type === 'source')).toBeLessThan(evs.findIndex((e) => e.text === '⟦1⟧'));

    // La IA recibió el capítulo de la RV1909, el griego y las referencias cruzadas como documentos
    const sent = aiRequests.at(-1)!;
    const docs = sent.messages[0].content.filter((b: { type: string }) => b.type === 'document');
    expect(docs.map((d: { title: string }) => d.title)).toEqual([
      'Juan 3 · Reina-Valera 1909',
      'Juan 3 · Griego (STEPBible TAGNT)',
      'Referencias cruzadas de Juan 3 (OpenBible.info)',
    ]);
    const rv = JSON.parse(readFileSync(path.join(DATA_DIR, 'text/rv1909/jhn/3.json'), 'utf8')) as [number, string][];
    expect(docs[0].source.content).toHaveLength(rv.length);
    expect(docs[0].source.content[15].text).toBe(`3:16 ${rv[15][1]}`);
    expect(sent.messages[0].content.at(-1).text).toContain('Prepara un estudio de Juan 3');
    expect(sent.system).not.toContain('Taller');
  });

  it('las preguntas de seguimiento van detrás del primer mensaje', async () => {
    const messages = [
      { role: 'assistant', text: 'Estudio anterior' },
      { role: 'user', text: '¿Quién era Nicodemo?' },
    ];
    const evs = await events(await ask({ book: 'jhn', chapter: 3, verse: 16, messages }));
    expect(textOf(evs)).toBe('Respuesta simulada a «¿Quién era Nicodemo?».⟦1⟧');
    const sent = aiRequests.at(-1)!;
    expect(sent.messages.slice(1)).toEqual([
      { role: 'assistant', content: 'Estudio anterior' },
      { role: 'user', content: '¿Quién era Nicodemo?' },
    ]);
    // Con versículo, el griego va con el análisis completo
    expect(lastAiText()).toContain('adverbio');
  });

  it('«¿Por qué esta palabra?» añade otros pasajes con la misma palabra', async () => {
    await events(await ask({ book: 'jhn', chapter: 3, verse: 16, word: 0 }));
    const text = lastAiText();
    expect(text).toContain('Otros pasajes del Nuevo Testamento con');
    expect(text).toContain('La persona tocó la palabra griega οὕτως');
  });

  it('el Taller usa sus reglas y lleva el borrador', async () => {
    await events(
      await ask({ book: 'jhn', chapter: 3, taller: { modo: 'revisar', tipo: 'encuentro', paso: 'revisar', desde: 1, hasta: 8, borrador: 'Mi idea' } }),
    );
    const sent = aiRequests.at(-1)!;
    expect(sent.system).toContain('Ahora acompañas a alguien en el Taller');
    const task = sent.messages[0].content.at(-1).text as string;
    expect(task).toContain('un encuentro de grupo pequeño (60 a 90 minutos) sobre Juan 3:1-8');
    expect(task).toContain('Lo que llevo:\nMi idea');
    expect(task).toContain('que las preguntas lleven al texto');
  });

  it('la herramienta de un capítulo se guarda para todos y «nueva» pide otra versión', async () => {
    // Juan 5 empieza sin nada guardado, para que la prueba se pueda repetir con la misma base
    const sql = postgres(DB_URL!, { max: 1, onnotice: () => {} });
    await sql`delete from herramientas_ia where libro = 'jhn' and capitulo = 5`.catch(() => {});
    await sql.end();
    const base = { book: 'jhn', chapter: 5, herramienta: 'mapa' };
    const before = aiRequests.length;

    const first = await events(await ask(base));
    expect(aiRequests.length).toBe(before + 1);
    expect(first.at(-1)?.type).toBe('done');

    // Otra persona lo recibe al instante, igual, sin otra llamada a la IA
    const otra = (await client(comunidades, '2026-10-18')('registrarse', { nombre: 'Otra persona' })).json.llave;
    const second = await events(await ask(base, otra));
    expect(aiRequests.length).toBe(before + 1);
    expect(textOf(second)).toBe(textOf(first));
    expect(second.filter((e) => e.type === 'source')).toEqual(first.filter((e) => e.type === 'source'));
    expect(second.at(-1)?.type).toBe('done');

    // «Preparar otra versión» vuelve a llamar a la IA, y lo nuevo queda guardado
    await events(await ask({ ...base, nueva: true }));
    expect(aiRequests.length).toBe(before + 2);
    await events(await ask(base));
    expect(aiRequests.length).toBe(before + 2);
  });

  it('las herramientas devuelven un texto que la app sabe leer', async () => {
    const podcast = textOf(await events(await ask({ book: 'jhn', chapter: 3, herramienta: 'podcast' })));
    expect(parseScript(podcast).map((l) => l.speaker)).toEqual(['ana', 'tomas', 'ana']);

    // «nueva» para que llegue a la IA aunque otra ejecución ya la haya guardado
    const tarjetas = textOf(await events(await ask({ book: 'jhn', chapter: 3, herramienta: 'tarjetas', nueva: true })));
    expect(lastAiText()).toContain('tarjetas de repaso de Juan 3');
    expect(parseCards(tarjetas, [], 'jhn', 3)).toHaveLength(3);

    const mapa = textOf(await events(await ask({ book: 'jhn', chapter: 3, herramienta: 'mapa' })));
    const m = parseMindMap(mapa);
    expect(m.title).toBe('El nuevo nacimiento y el amor de Dios');
    expect(m.branches.map((b) => [b.from, b.to, b.leaves.length])).toEqual([
      [1, 21, 2],
      [22, 36, 1],
    ]);
  });
});
