// /api/buscar: la IA simulada propone php.4.6, mat.6.34, gen.99.1 (no existe) y jhn.3.16, y se queda con los dos primeros.
// El servidor debe comprobar cada referencia contra el texto real de la versión que lee la persona (sin ella, la RV1909). Ver tests/api/helpers.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { client, DATA_DIR, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request } from './helpers';

let buscar: Post;
let aiRequests: Record<string, any>[];
let llave: string;

beforeAll(async () => {
  ({ requests: aiRequests } = await prepareEnv({ ai: true }));
  ({ POST: buscar } = await import('../../api/buscar'));
  if (DB_URL && HAS_DATA) {
    const { POST: comunidades } = await import('../../api/comunidades');
    await ensureSchema(comunidades);
    llave = (await client(comunidades, '2026-10-18')('registrarse', { nombre: 'Buscador' })).json.llave;
  }
});

const search = (body: unknown, key = llave) => buscar(request('/api/buscar', body, key));
const text = (version: string, book: string, chapter: number, verse: number) =>
  (JSON.parse(readFileSync(path.join(DATA_DIR, 'text', version, book, `${chapter}.json`), 'utf8')) as [number, string][]).find(
    ([n]) => n === verse,
  )![1];
const rv = (book: string, chapter: number, verse: number) => text('rv1909', book, chapter, verse);

describe('/api/buscar', () => {
  it('sin cuenta: 401', async () => {
    const res = await buscar(request('/api/buscar', { query: 'ansiedad' }));
    expect(res.status).toBe(401);
    expect((await res.json()).cuenta).toBe(true);
  });

  describe.skipIf(!DB_URL || !HAS_DATA)('con cuenta', () => {
    it('valida la búsqueda sin llamar a la IA', async () => {
      const before = aiRequests.length;
      const err = async (body: unknown) => {
        const res = await search(body);
        expect(res.status).toBe(400);
        return (await res.json()).error;
      };
      expect(await err('{roto')).toBe('JSON no válido');
      expect(await err({ query: '  a  ' })).toBe('Escribe un poco más lo que buscas');
      expect(await err({})).toBe('Escribe un poco más lo que buscas');
      expect(await err({ query: 'x'.repeat(201) })).toBe('La búsqueda es demasiado larga');
      expect(aiRequests.length).toBe(before);
    });

    it('comprueba cada pasaje propuesto contra la RV1909 y devuelve los que la IA conserva, con su texto real', async () => {
      const before = aiRequests.length;
      const res = await search({ query: 'versículos sobre la ansiedad' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        results: [
          { ref: 'php.4.6', label: 'Filipenses 4:6', text: rv('php', 4, 6), reason: 'Pide no estar afanosos y presentar todo a Dios en oración.', version: 'rv1909' },
          { ref: 'mat.6.34', label: 'Mateo 6:34', text: rv('mat', 6, 34), reason: 'Jesús enseña a no afanarse por el día de mañana.', version: 'rv1909' },
        ],
      });

      // Dos llamadas: propuesta y revisión. A la revisión no llega la referencia inventada.
      expect(aiRequests.length).toBe(before + 2);
      const review = aiRequests.at(-1)!.messages[0].content as string;
      expect(review).toContain('[1] Filipenses 4:6: ');
      expect(review).toContain(`[3] Juan 3:16: ${rv('jhn', 3, 16)}`);
      expect(review).not.toContain('Génesis 99');
      expect(review).toContain('«versículos sobre la ansiedad»');
      expect(review).toContain('textos reales de la versión «Reina-Valera 1909»');
    });

    it('con otra versión libre, la IA lee esa versión y los resultados vienen en ella', async () => {
      const res = await search({ query: 'versículos sobre la ansiedad', version: 'bes' });
      const { results } = await res.json();
      expect(results.map((r: { version: string }) => r.version)).toEqual(['bes', 'bes']);
      expect(results[0].text).toBe(text('bes', 'php', 4, 6));
      expect(results[0].text).not.toBe(rv('php', 4, 6));
      const review = aiRequests.at(-1)!;
      expect(review.system).toContain('(La Biblia en Español Sencillo)');
      expect(review.messages[0].content).toContain(`textos reales de la versión «La Biblia en Español Sencillo»:\n[1] Filipenses 4:6: ${text('bes', 'php', 4, 6)}`);
    });

    it('con una versión con derechos, la IA lee la RV1909 (la app muestra después la versión de la persona)', async () => {
      const res = await search({ query: 'versículos sobre la ansiedad', version: 'nbla' });
      const { results } = await res.json();
      expect(results.map((r: { version: string; text: string }) => [r.version, r.text])).toEqual([
        ['rv1909', rv('php', 4, 6)],
        ['rv1909', rv('mat', 6, 34)],
      ]);
      expect(aiRequests.at(-1)!.messages[0].content).toContain('textos reales de la versión «Reina-Valera 1909»');
    });

    it('rechaza versiones que no existen', async () => {
      const res = await search({ query: 'ansiedad', version: 'inventada' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Versión no válida');
    });
  });
});
