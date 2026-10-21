import { describe, expect, it } from 'vitest';

import { DEFAULT_COMPARE, MAX_COMPARE, changedShare, compareList, diffWords, findVerse, toggleCompare } from './comparar';
import type { Version } from './data';

const v = (id: string, licensed = false): Version => ({ id, name: id, abbr: id.toUpperCase(), credit: id, licensed });
const ALL = ['rv1909', 'rv1865', 'rvg', 'bes', 'pdt', 'blm'].map((id) => v(id)).concat(v('nbla', true));

describe('comparar versiones', () => {
  it('pone primero la versión que se lee y sigue el orden de la lista', () => {
    expect(compareList(undefined, 'bes', ALL).map((x) => x.id)).toEqual(['bes', 'rv1909', 'rvg', 'pdt']);
    expect(compareList(['nbla', 'blm'], 'rv1909', ALL).map((x) => x.id)).toEqual(['rv1909', 'blm', 'nbla']);
    // Una versión con derechos que la clave ya no tiene simplemente no aparece
    expect(compareList(['ntv', 'blm'], 'rv1909', ALL).map((x) => x.id)).toEqual(['rv1909', 'blm']);
  });

  it('añade y quita versiones sin quedarse sin ninguna ni pasar del máximo', () => {
    expect(toggleCompare(undefined, 'blm')).toEqual([...DEFAULT_COMPARE, 'blm']);
    expect(toggleCompare(['rv1909', 'bes'], 'bes')).toEqual(['rv1909']);
    expect(toggleCompare(['rv1909'], 'rv1909')).toEqual(['rv1909']);
    const full = ALL.slice(0, MAX_COMPARE).map((x) => x.id);
    expect(toggleCompare(full, 'nbla')).toEqual(full);
  });

  it('encuentra el versículo aunque la versión una varios', () => {
    const verses: [number, string, string?][] = [[8, 'ocho'], [9, 'del nueve al once', '9-11'], [12, 'doce']];
    expect(findVerse(verses, 10)?.[1]).toBe('del nueve al once');
    expect(findVerse(verses, 12)?.[1]).toBe('doce');
    expect(findVerse(verses, 13)).toBeUndefined();
  });

  it('marca solo las palabras que cambian, sin fijarse en tildes, mayúsculas ni signos', () => {
    const base = 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito';
    const other = 'Porque de tal manera amó Dios al mundo, que dio a Su Hijo unigénito';
    const pieces = diffWords(base, other);
    expect(pieces.map((p) => p.text).join('')).toBe(other);
    expect(pieces.filter((p) => p.changed).map((p) => p.text.trim())).toEqual(['dio']);
    expect(changedShare(pieces)).toBeCloseTo(1 / 14);
  });

  it('un texto igual no tiene cambios y uno distinto los tiene todos', () => {
    expect(diffWords('Jesús lloró.', 'Jesús lloró.')).toEqual([{ text: 'Jesús lloró.', changed: false }]);
    expect(changedShare(diffWords('Jesús lloró.', 'Y lloró Jesús.'))).toBeGreaterThan(0);
    expect(diffWords('', 'Hola mundo')).toEqual([{ text: 'Hola mundo', changed: true }]);
  });
});
