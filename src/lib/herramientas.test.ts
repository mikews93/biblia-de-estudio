import { describe, expect, it } from 'vitest';

import { splitCites, verseRange } from './herramientas';

describe('splitCites', () => {
  it('separa las marcas ⟦n⟧ sin dejar espacios antes de la puntuación', () => {
    expect(splitCites('Dios amó al mundo ⟦2⟧⟦3⟧. Y dio a su Hijo ⟦2⟧ ,  unigénito')).toEqual({
      text: 'Dios amó al mundo. Y dio a su Hijo, unigénito',
      cites: [2, 3],
    });
  });

  it('sin marcas devuelve el texto limpio y ninguna cita', () => {
    expect(splitCites('  hola  ')).toEqual({ text: 'hola', cites: [] });
  });
});

describe('verseRange', () => {
  it('lee «(v. 3)», «(vv. 1-8)», «(vv. 4, 6)» y «(versículos 2–5)» al final', () => {
    expect(verseRange('Nacer otra vez (v. 3)')).toEqual({ text: 'Nacer otra vez', from: 3, to: undefined });
    expect(verseRange('Jesús y Nicodemo (vv. 1-8)')).toEqual({ text: 'Jesús y Nicodemo', from: 1, to: 8 });
    expect(verseRange('Dos ideas (vv. 4, 6)')).toEqual({ text: 'Dos ideas', from: 4, to: undefined });
    expect(verseRange('Tramo (versículos 2–5)')).toEqual({ text: 'Tramo', from: 2, to: 5 });
  });

  it('con un punto después del paréntesis también lo reconoce', () => {
    expect(verseRange('Hay que nacer otra vez (v. 3).')).toEqual({ text: 'Hay que nacer otra vez', from: 3, to: undefined });
  });

  it('no toca paréntesis que no son versículos ni los que están en medio', () => {
    expect(verseRange('Juan (el apóstol)')).toEqual({ text: 'Juan (el apóstol)' });
    expect(verseRange('Antes (v. 3) y después')).toEqual({ text: 'Antes (v. 3) y después' });
  });
});
