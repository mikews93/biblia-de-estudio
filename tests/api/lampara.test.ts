// La lámpara diaria de /api/estudiar: las preguntas propias tienen un tope por cuenta y día; lo que se guarda para
// todos no lo gasta. Necesita DATABASE_URL (ver tests/api/helpers.ts) y public/data.
import { beforeAll, describe, expect, it } from 'vitest';

import { client, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request } from './helpers';

let estudiar: Post;
let comunidades: Post;

beforeAll(async () => {
  process.env.LAMPARA_DIA = '2';
  await prepareEnv({ ai: true });
  ({ POST: estudiar } = await import('../../api/estudiar'));
  ({ POST: comunidades } = await import('../../api/comunidades'));
  if (DB_URL && HAS_DATA) await ensureSchema(comunidades);
});

describe.skipIf(!DB_URL || !HAS_DATA)('/api/estudiar: la lámpara diaria', () => {
  it('después de dos preguntas responde 429 con un aviso amable; los estudios guardados siguen abiertos', async () => {
    const registrar = client(comunidades, '2026-10-22');
    const llave = (await registrar('registrarse', { nombre: 'Lámpara' })).json.llave;
    const otra = (await registrar('registrarse', { nombre: 'Otra' })).json.llave;
    const ask = (body: unknown, key = llave) => estudiar(request('/api/estudiar', body, key));
    const base = { book: 'rut', chapter: 1, verse: 16 };
    const pregunta = (texto: string) => ({ ...base, messages: [{ role: 'assistant', text: 'Estudio' }, { role: 'user', text: texto }] });

    expect((await ask(base)).status).toBe(200); // el estudio para todos no gasta
    expect((await ask(pregunta('¿Quién era Rut?'))).status).toBe(200);
    expect((await ask(pregunta('¿Y Noemí?'))).status).toBe(200);
    const vacia = await ask(pregunta('¿Y Booz?'));
    expect(vacia.status).toBe(429);
    expect(await vacia.json()).toEqual({ error: expect.stringContaining('Tu lámpara de hoy ya dio su luz'), lampara: true });
    expect((await ask(base)).status).toBe(200);
    expect((await ask(pregunta('¿Y Booz?'), otra)).status).toBe(200); // cada cuenta tiene la suya
  });
});
