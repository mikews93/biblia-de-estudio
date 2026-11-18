import { describe, expect, it } from 'vitest';

import { alternar, citaDe, sumarTramo, textoDe, textoParaCopiar, tramos, versiculosTexto } from './seleccion';

const verses: [number, string][] = [
  [16, 'Porque de tal manera amó Dios al mundo,'],
  [17, 'Porque no envió Dios a su Hijo al mundo'],
  [18, 'El que en él cree, no es condenado;'],
  [19, 'Y esta es la condenación:'],
  [20, 'Porque todo aquel que hace lo malo'],
];

describe('selección de varios versículos', () => {
  it('pone y quita versículos, siempre en orden', () => {
    expect(alternar([18], 16)).toEqual([16, 18]);
    expect(alternar([16, 18], 16)).toEqual([18]);
    expect(sumarTramo([20], 18, 16)).toEqual([16, 17, 18, 20]);
  });

  it('agrupa los tramos seguidos', () => {
    expect(tramos([20, 16, 17, 18])).toEqual([
      [16, 18],
      [20, 20],
    ]);
    expect(versiculosTexto([16])).toBe('16');
    expect(versiculosTexto([16, 17, 18, 20])).toBe('16-18, 20');
    expect(citaDe('Juan', 3, [16, 17])).toBe('Juan 3:16-17');
  });

  it('junta el texto y marca los saltos', () => {
    expect(textoDe(verses, [16, 17])).toBe('Porque de tal manera amó Dios al mundo, Porque no envió Dios a su Hijo al mundo');
    expect(textoDe(verses, [16, 18])).toBe('Porque de tal manera amó Dios al mundo, … El que en él cree, no es condenado;');
  });

  it('copia con números si son varios', () => {
    expect(textoParaCopiar(verses, [16], 'Juan 3:16 (RV1909)', 'https://zarzabiblia.com/juan/3/16')).toBe(
      '«Porque de tal manera amó Dios al mundo,»\nJuan 3:16 (RV1909)\nhttps://zarzabiblia.com/juan/3/16',
    );
    expect(textoParaCopiar(verses, [16, 17], 'Juan 3:16-17', 'x')).toBe(
      '16 Porque de tal manera amó Dios al mundo, 17 Porque no envió Dios a su Hijo al mundo\nJuan 3:16-17\nx',
    );
  });
});
