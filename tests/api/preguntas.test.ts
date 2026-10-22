// Preguntas frecuentes anónimas (api/_preguntas.ts): se limpian antes de guardar y no quedan ligadas a la cuenta.
import postgres from 'postgres';
import { beforeAll, describe, expect, it } from 'vitest';

import { limpiarPregunta } from '../../api/_preguntas';
import { client, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request } from './helpers';

describe('limpiarPregunta', () => {
  it('borra correos, enlaces, teléfonos, menciones y números largos', () => {
    expect(limpiarPregunta('¿Qué significa «nacer de nuevo»? escríbeme a ana.ruiz@correo.com o al +57 300 123 4567')).toBe(
      '¿Qué significa «nacer de nuevo»? escríbeme a o al',
    );
    expect(limpiarPregunta('Mira https://ejemplo.com/x y dime @beto, mi cédula 1020304050')).toBe('Mira y dime , mi cédula');
    expect(limpiarPregunta('¿Por qué Juan 3:16 dice «unigénito»?')).toBe('¿Por qué Juan 3:16 dice «unigénito»?');
  });

  it('descarta lo que queda demasiado corto o es demasiado largo', () => {
    expect(limpiarPregunta('¿y?')).toBeNull();
    expect(limpiarPregunta('a'.repeat(401))).toBeNull();
  });
});

let estudiar: Post;
let comunidades: Post;

beforeAll(async () => {
  await prepareEnv({ ai: true });
  ({ POST: estudiar } = await import('../../api/estudiar'));
  ({ POST: comunidades } = await import('../../api/comunidades'));
  if (DB_URL && HAS_DATA) await ensureSchema(comunidades);
});

describe.skipIf(!DB_URL || !HAS_DATA)('/api/estudiar con «compartir»', () => {
  it('guarda la pregunta limpia con un seudónimo por capítulo, sin cuenta; no la guarda sin permiso ni en el Modo Jóvenes', async () => {
    const r = await client(comunidades, '2026-10-22')('registrarse', { nombre: 'Pregunta' });
    const { llave, usuario } = r.json;
    const ask = (body: object) => estudiar(request('/api/estudiar', body, llave));
    const turno = (texto: string) => [{ role: 'assistant', text: 'Estudio' }, { role: 'user', text: texto }];
    const base = { book: 'jon', chapter: 1 };

    expect((await ask({ ...base, compartir: true, messages: turno('¿Por qué huyó Jonás a Tarsis? mi correo: jo@na.s') })).status).toBe(200);
    expect((await ask({ ...base, messages: turno('¿Pregunta sin permiso de compartir?') })).status).toBe(200);
    expect((await ask({ ...base, compartir: true, publico: 'jovenes', messages: turno('¿Pregunta desde el Modo Jóvenes?') })).status).toBe(200);
    expect((await ask({ book: 'jon', chapter: 2, compartir: true, messages: turno('¿Cómo oró Jonás dentro del pez?') })).status).toBe(200);

    const sql = postgres(DB_URL!, { max: 1, onnotice: () => {} });
    const filas = await sql<{ capitulo: number; texto: string; quien: string }[]>`
      select capitulo, texto, quien from preguntas_anonimas where libro = 'jon' order by id`;
    await sql.end();
    const mias = filas.slice(-2);
    expect(mias.map((f) => [f.capitulo, f.texto])).toEqual([
      [1, '¿Por qué huyó Jonás a Tarsis? mi correo:'],
      [2, '¿Cómo oró Jonás dentro del pez?'],
    ]);
    expect(filas.some((f) => /sin permiso|Modo Jóvenes/.test(f.texto))).toBe(false);
    // El seudónimo cambia de capítulo a capítulo y no es el id de la cuenta
    expect(mias[0].quien).not.toBe(mias[1].quien);
    expect(mias.map((f) => f.quien)).not.toContain(usuario.id);
  });
});
