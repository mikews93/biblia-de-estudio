import { describe, expect, it } from 'vitest';

import { CapituloRow, IndiceRow, buscarFichas, epocaDe, fichaHref, fichaId, marcarNombres } from './fichas';

const INDICE: IndiceRow[] = [
  ['h1732', 'David', 'm', 'Rey, hijo de Isaí', 964, []],
  ['h1035g', 'Belén (Beth-lehem)', 'l', 'Ciudad o pueblo en Judá', 53, ['Beth-lehem', 'Ephrata']],
  ['h3609', 'Daniel', 'm', 'Hijo de David', 2, []],
  ['h1840g', 'Daniel', 'm', 'Profeta', 72, ['Beltsasar']],
];

describe('fichas', () => {
  it('arma y lee la ruta', () => {
    expect(fichaHref({ id: 'h1035g', nombre: 'Belén (Beth-lehem)' })).toBe('/ficha/h1035g-belen');
    expect(fichaId('h1035g-belen')).toBe('h1035g');
  });

  it('busca sin acentos, por otros nombres y con los más nombrados primero', () => {
    expect(buscarFichas(INDICE, 'belen')[0][0]).toBe('h1035g');
    expect(buscarFichas(INDICE, 'ephr')[0][0]).toBe('h1035g');
    expect(buscarFichas(INDICE, 'daniel').map((r) => r[0])).toEqual(['h1840g', 'h3609']);
    expect(buscarFichas(INDICE, 'd')).toEqual([]);
  });

  it('marca los nombres como palabras enteras', () => {
    const rows: CapituloRow[] = [
      ['h1732', 'David', 'm', [1], ['David']],
      ['h1035g', 'Belén (Beth-lehem)', 'l', [1], ['Beth-lehem']],
    ];
    const tramos = marcarNombres('Y David fué á Beth-lehem; Davides no.', rows);
    expect(tramos.filter((t) => t.ficha).map((t) => t.texto)).toEqual(['David', 'Beth-lehem']);
    expect(tramos.map((t) => t.texto).join('')).toBe('Y David fué á Beth-lehem; Davides no.');
  });

  it('sitúa a la persona en los periodos donde más se habla de ella', () => {
    const e = epocaDe({ epoca: 'El reino unido', citas: [['1sa', [[16, [1, 2, 3, 4, 5]]]], ['2sa', [[5, [1, 2, 3, 4]]]], ['mat', [[1, [1]]]]] });
    expect(e?.periodos.map((p) => p.id)).toEqual(['saul', 'david']);
    expect(e?.libro).toBe('1sa');
  });
});
