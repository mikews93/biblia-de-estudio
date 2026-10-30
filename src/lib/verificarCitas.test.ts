import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { buscarCitas, comparar, revisarCitas } from './verificarCitas';

const capitulo = async (book: string, chapter: number, version: string) =>
  JSON.parse(readFileSync(`public/data/text/${version}/${book}/${chapter}.json`, 'utf8'));
const nombre = (id: string) => BOOKS.find((b) => b.id === id)?.name ?? id;
const revisar = (text: string, sources = []) => revisarCitas(buscarCitas(text, BOOKS, sources), capitulo, ['rv1909'], nombre);

describe('buscarCitas', () => {
  it('junta las comillas con la cita más cercana de la línea', () => {
    const c = buscarCitas('Jesús dice «de tal manera amó Dios al mundo» (Juan 3:16). Luego Romanos 8:28 lo confirma.', BOOKS);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ texto: 'Juan 3:16', pasaje: { book: 'jhn', chapter: 3, verse: 16, verseEnd: 16 }, frase: 'de tal manera amó Dios al mundo' });
    expect(c[1].frase).toBeUndefined();
  });

  it('usa las fuentes ⟦n⟧ que son un pasaje y no revisa las marcas ⟪…⟫', () => {
    const c = buscarCitas('Bendice a Dios porque «no apartó su misericordia y su verdad» ⟦2⟧.\n\n⟪Juan 3:16⟫', BOOKS, [
      { n: 2, label: 'Génesis 24:27', ref: 'gen.24.27' },
    ]);
    expect(c).toEqual([{ texto: 'Génesis 24:27', pasaje: { book: 'gen', chapter: 24, verse: 27, verseEnd: 27 }, frase: 'no apartó su misericordia y su verdad' }]);
  });

  it('no toma por cita una palabra suelta entre comillas', () => {
    expect(buscarCitas('La traduce «misericordia» (Salmos 136:1).', BOOKS)[0].frase).toBeUndefined();
  });
});

describe('comparar', () => {
  it('acepta la cita tal cual, con tildes o trozos separados por …', () => {
    const t = 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito';
    expect(comparar('que ha dado a su Hijo', t)).toBe('igual');
    expect(comparar('de tal manera amó… su Hijo unigénito', t)).toBe('igual');
    expect(comparar('Dios amó de tal manera al mundo', t)).toBe('casi');
    expect(comparar('el Señor es mi pastor, nada me faltará', t)).toBe('distinta');
  });
});

describe('revisarCitas', () => {
  it('da por buena una cita que dice lo que dice el versículo', async () => {
    const [r] = await revisar('«que ha dado á su Hijo unigénito» (Juan 3:16)');
    expect(r.estado).toBe('bien');
  });

  it('avisa si el versículo no existe', async () => {
    const [a, b] = await revisar('Mira Juan 3:99 y también Juan 30:1.');
    expect(a).toMatchObject({ estado: 'no-existe', detalle: 'Juan 3 tiene 36 versículos.' });
    expect(b).toMatchObject({ estado: 'no-existe', detalle: 'Juan tiene 21 capítulos.' });
  });

  it('avisa si las palabras están en otro versículo cercano', async () => {
    const [r] = await revisar('«Porque no envió Dios á su Hijo al mundo» (Juan 3:16)');
    expect(r).toMatchObject({ estado: 'otro-versiculo', verso: 17 });
  });

  it('enseña lo que dice de verdad si no coincide', async () => {
    const [r] = await revisar('Juan 3:16 dice: «el Señor es mi pastor, nada me faltará»');
    expect(r.estado).toBe('no-coincide');
    if (r.estado === 'no-coincide') expect(r.texto).toMatch(/^Porque de tal manera/);
  });
});
