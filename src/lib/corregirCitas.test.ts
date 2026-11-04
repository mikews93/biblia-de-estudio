import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { buscarEnBiblia, corregirCitas } from './corregirCitas';

const leer = async (book: string, chapter: number, version = 'rv1909') =>
  JSON.parse(readFileSync(`public/data/text/${version}/${book}/${chapter}.json`, 'utf8'));
const base = { books: BOOKS, leer, versiones: ['rv1909'] };

describe('corregirCitas', () => {
  it('deja igual una respuesta con las citas bien', async () => {
    const texto = 'Dios «ha dado á su Hijo unigénito» (Juan 3:16).';
    expect(await corregirCitas(texto, base)).toEqual({ texto, cambios: [] });
  });

  it('pone el versículo de al lado si las palabras están ahí', async () => {
    const { texto } = await corregirCitas('«Porque no envió Dios á su Hijo al mundo» (Juan 3:16).', base);
    expect(texto).toBe('«Porque no envió Dios á su Hijo al mundo» (Juan 3:17).');
  });

  it('busca la frase en el capítulo y luego en toda la Biblia', async () => {
    const enCapitulo = await corregirCitas('Jesús dice «el que en él cree, no es condenado» (Juan 3:2).', base);
    expect(enCapitulo.texto).toContain('(Juan 3:18)');
    const enOtroLibro = await corregirCitas('«Jehová es mi pastor; nada me faltará» (Juan 3:17).', {
      ...base,
      buscar: (f) => buscarEnBiblia(f, BOOKS.filter((b) => b.id === 'psa'), (b, c) => leer(b, c)),
    });
    expect(enOtroLibro.texto).toBe('«Jehová es mi pastor; nada me faltará» (Salmos 23:1).');
  });

  it('cita el capítulo si el versículo no existe', async () => {
    const { texto } = await corregirCitas('Lo repite en Juan 3:99 y en Juan 30:1.', base);
    expect(texto).toBe('Lo repite en Juan 3 y en Juan.');
  });

  it('pide a la IA lo que no se arregla solo y aplica sus cambios', async () => {
    const pedidos: unknown[] = [];
    const { texto } = await corregirCitas('Pablo enseña. Romanos 8:28 dice: «el amor nunca deja de ser» y nos consuela.', {
      ...base,
      reparar: async (t, problemas) => {
        pedidos.push(problemas);
        return [{ de: 'Romanos 8:28 dice: «el amor nunca deja de ser»', a: '1 Corintios 13:8 dice: «La caridad nunca deja de ser»' }];
      },
    });
    expect(pedidos).toHaveLength(1);
    expect(texto).toBe('Pablo enseña. 1 Corintios 13:8 dice: «La caridad nunca deja de ser» y nos consuela.');
  });

  it('si nada la arregla, quita la oración con la frase inventada', async () => {
    const { texto, cambios } = await corregirCitas('Dios es fiel. Romanos 8:28 dice: «los gatos vuelan sobre el mar». Confía en él.', base);
    expect(texto).toBe('Dios es fiel. Confía en él.');
    expect(cambios).toEqual(['quitada: Romanos 8:28']);
  });
});

describe('comillas junto a una fuente', () => {
  it('no llama a la IA ni cambia nada si solo no cuadran las comillas de una fuente ⟦n⟧', async () => {
    let llamadas = 0;
    const texto = 'Respuesta a «¿qué significa unigénito en este versículo?» ⟦1⟧.';
    const r = await corregirCitas(texto, {
      ...base,
      sources: [{ n: 1, label: 'Juan 3:16', ref: 'jhn.3.16' }],
      reparar: async () => {
        llamadas++;
        return [];
      },
    });
    expect(r.texto).toBe(texto);
    expect(llamadas).toBe(0);
  });
});
