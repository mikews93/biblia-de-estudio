import { describe, expect, it } from 'vitest';

import { type FilaDiccionario, type Sentido, buscarArticulos, claveLexico, resumen, sentidoEn, vecesSentido } from './fuentesAbiertas';

describe('léxico de UBS', () => {
  it('lleva el Strong al nombre del archivo', () => {
    expect(claveLexico('G26')).toBe('G0026');
    expect(claveLexico('H2617A')).toBe('H2617');
    expect(claveLexico('x')).toBeNull();
  });

  it('encuentra el sentido del versículo', () => {
    const s: Sentido[] = [
      [['amor'], 'tener amor', '', 'Actitudes', { jhn: '3.16 13.35' }],
      [['comida de hermandad'], 'comida', '', 'Comer', { jud: '1.12' }],
    ];
    expect(sentidoEn(s, 'jud', 1, 12)).toBe(1);
    expect(sentidoEn(s, 'jhn', 3, 16)).toBe(0);
    expect(sentidoEn(s, 'jhn', 3, 1)).toBe(-1);
    expect(vecesSentido(s[0])).toBe(2);
  });
});

describe('diccionario Tyndale', () => {
  const indice: FilaDiccionario[] = [
    ['1', 'Gracia', 'keyterm'],
    ['2', 'Gracia, Medios de', ''],
    ['3', 'Getsemaní', 'place'],
    ['4', 'Año de gracia', ''],
  ];
  it('pone primero el título igual, sin importar tildes', () => {
    expect(buscarArticulos(indice, 'gracia').map((f) => f[0])).toEqual(['1', '2', '4']);
    expect(buscarArticulos(indice, 'getsemani').map((f) => f[0])).toEqual(['3']);
    expect(buscarArticulos(indice, 'de')).toEqual([]);
  });

  it('resume sin marcas', () => {
    expect(resumen('## Título\n\nEl lugar ⟦mat.26.36⟧ donde oró, cerca de ⟦d:5|Jerusalén⟧.')).toBe('El lugar donde oró, cerca de Jerusalén.');
  });
});
