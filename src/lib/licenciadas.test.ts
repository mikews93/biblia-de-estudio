import { describe, expect, it } from 'vitest';

import { chapterVerses, licensedById, type ApiNode } from './licenciadas';

const verse = (n: string): ApiNode => ({
  name: 'verse',
  type: 'tag',
  attrs: { number: n, style: 'v', sid: `JHN 3:${n}` },
  items: [{ text: n, type: 'text' }],
});
const text = (t: string, id: string): ApiNode => ({ text: t, type: 'text', attrs: { verseId: id, verseOrgIds: [id] } });

describe('chapterVerses', () => {
  it('junta el texto de cada versículo y deja fuera números, notas y títulos', () => {
    const content: ApiNode[] = [
      { name: 'para', type: 'tag', attrs: { style: 's1' }, items: [{ text: 'Jesús y Nicodemo', type: 'text' }] },
      {
        name: 'para',
        type: 'tag',
        attrs: { style: 'p' },
        items: [
          verse('16'),
          text('Porque de tal manera amó Dios al mundo, ', 'JHN.3.16'),
          {
            name: 'char',
            type: 'tag',
            attrs: { style: 'wj' },
            items: [text('que dio a Su Hijo unigénito', 'JHN.3.16')],
          },
          { name: 'note', type: 'tag', attrs: { style: 'f' }, items: [{ text: 'O único', type: 'text' }] },
          text('.', 'JHN.3.16'),
          verse('17'),
          text('Porque Dios no envió a Su Hijo al mundo para juzgar al mundo.', 'JHN.3.17'),
        ],
      },
    ];
    expect(chapterVerses(content)).toEqual([
      [16, 'Porque de tal manera amó Dios al mundo, que dio a Su Hijo unigénito.'],
      [17, 'Porque Dios no envió a Su Hijo al mundo para juzgar al mundo.'],
    ]);
  });

  it('separa con un espacio los versos poéticos de un mismo versículo', () => {
    const content: ApiNode[] = [
      { name: 'para', type: 'tag', attrs: { style: 'q1' }, items: [verse('1'), text('El Señor es mi pastor,', 'PSA.23.1')] },
      { name: 'para', type: 'tag', attrs: { style: 'q2' }, items: [text('Nada me faltará.', 'PSA.23.1')] },
    ];
    expect(chapterVerses(content)).toEqual([[1, 'El Señor es mi pastor, Nada me faltará.']]);
  });

  it('marca los versículos unidos con su etiqueta', () => {
    const content: ApiNode[] = [
      { name: 'para', type: 'tag', attrs: { style: 'p' }, items: [text('Y al que puede…', 'ROM.16.25-ROM.16.27')] },
    ];
    expect(chapterVerses(content)).toEqual([[25, 'Y al que puede…', '25-27']]);
  });
});

describe('licensedById', () => {
  it('conoce las versiones de API.Bible y no las libres', () => {
    expect(licensedById('nbla')?.bibleId).toBe('ce11b813f9a27e20-01');
    expect(licensedById('rv1909')).toBeUndefined();
  });
});
