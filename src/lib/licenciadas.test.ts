import { describe, expect, it } from 'vitest';

import { chapterHtml, chapterVerses, chapterVersesHtml, licensedById, type ApiNode } from './licenciadas';

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

describe('chapterVersesHtml', () => {
  it('parte el HTML de YouVersion por versículos, sin números visibles ni etiquetas', () => {
    const html =
      '<div class="p"><span class="yv-v" v="16"></span><span class="yv-vlbl">16</span>Porque de tal manera amó Dios al mundo, ' +
      '<span class="wj">que ha dado a su Hijo unigénito</span>.</div>' +
      '<div class="p"><span class="yv-v" v="17"></span><span class="yv-vlbl">17</span>Dios no envió a su Hijo &amp; al mundo&#8230;</div>';
    expect(chapterVersesHtml(html)).toEqual([
      [16, 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito.'],
      [17, 'Dios no envió a su Hijo & al mundo…'],
    ]);
  });

  it('acepta el versículo como envoltorio, versos poéticos y versículos unidos', () => {
    const html =
      '<div class="q1"><span v="1" class="yv-v"><span class="yv-vlbl">1</span>El Señor es mi pastor,</span></div>' +
      '<div class="q2"><span class="yv-v" v="1">nada me falta.</span></div>' +
      '<div class="p"><span class="yv-v" v="2-3"><span class="yv-vlbl">2-3</span>En verdes pastos…</span></div>';
    expect(chapterVersesHtml(html)).toEqual([
      [1, 'El Señor es mi pastor, nada me falta.'],
      [2, 'En verdes pastos…', '2-3'],
    ]);
  });
});

describe('licensedById', () => {
  it('conoce las versiones de API.Bible y no las libres', () => {
    expect(licensedById('nbla')?.bibleId).toBe('ce11b813f9a27e20-01');
    expect(licensedById('rv1909')).toBeUndefined();
  });
});

describe('chapterHtml', () => {
  it('separa las notas al pie del texto y las guarda por versículo', () => {
    const html =
      '<div class="p"><span class="yv-v" v="16"></span><span class="yv-vlbl">16</span>Porque de tal manera amó Dios al mundo, que dio a su Hijo unigénito' +
      '<span class="yv-n f"><span class="fr">3:16 </span><span class="ft">O único</span></span>, para que…</div>';
    const { verses, notes } = chapterHtml(html);
    expect(verses).toEqual([[16, 'Porque de tal manera amó Dios al mundo, que dio a su Hijo unigénito, para que…']]);
    expect(notes).toEqual({ 16: ['O único'] });
  });
});
