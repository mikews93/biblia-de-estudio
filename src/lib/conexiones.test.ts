import { describe, expect, it } from 'vitest';

import { arcosDe, capituloEn, colorDistancia, eje, libroEn, librosVecinos, masFuertes, miles, type Resumen } from './conexiones';

const BOOKS = [
  { id: 'gen', chapters: 3 },
  { id: 'exo', chapters: 2 },
  { id: 'mat', chapters: 4 },
];

describe('conexiones', () => {
  it('pone cada capítulo en su lugar de la fila', () => {
    const { inicio, total } = eje(BOOKS);
    expect(inicio).toEqual([0, 3, 5]);
    expect(total).toBe(9);
    expect(capituloEn(BOOKS, inicio, 0)).toEqual({ libro: 0, chapter: 1 });
    expect(capituloEn(BOOKS, inicio, 4)).toEqual({ libro: 1, chapter: 2 });
    expect(capituloEn(BOOKS, inicio, 8)).toEqual({ libro: 2, chapter: 4 });
    expect(libroEn(inicio, total, 0)).toBe(0);
    expect(libroEn(inicio, total, 0.5)).toBe(1);
    expect(libroEn(inicio, total, 1)).toBe(2);
    expect(libroEn(inicio, total, -1)).toBe(0);
  });

  it('cuenta una vez los arcos dentro del mismo libro', () => {
    // Éxodo (capítulos 3 y 4): 3↔4 está en las dos filas; 3↔8 sale hacia Mateo
    const filas = [
      [4, 2, 8, 5],
      [3, 2],
    ];
    expect(arcosDe(filas, 3)).toEqual([
      { a: 3, b: 4, n: 2 },
      { a: 3, b: 8, n: 5 },
    ]);
    expect(arcosDe(filas, 3, 2)).toEqual([{ a: 3, b: 4, n: 2 }]);
    expect(arcosDe(filas, 3, undefined, 1)).toEqual([{ a: 3, b: 8, n: 5 }]);
  });

  it('los libros vecinos no se cuentan a sí mismos', () => {
    const r: Resumen = { versiculos: 0, pares: 0, capitulos: [], libros: [[9, 1, 4], [1, 0, 0], [4, 0, 7]] };
    expect(librosVecinos(r, 0)).toEqual([
      [2, 4],
      [1, 1],
    ]);
  });

  it('las referencias más fuertes van primero y sin repetir', () => {
    const refs = { '1': [['jhn.1.1', 40], ['heb.11.3', 12]] as [string, number][], '2': [['jhn.1.1-jhn.1.3', 50]] as [string, number][] };
    expect(masFuertes(refs, 2)).toEqual([
      [2, 'jhn.1.1-jhn.1.3', 50],
      [1, 'jhn.1.1', 40],
    ]);
  });

  it('el color va del ámbar (cerca) al azul (lejos)', () => {
    expect(colorDistancia(0, false)).toBe('rgb(176,102,30)');
    expect(colorDistancia(1, true)).toBe('rgb(110,166,220)');
    expect(miles(286602)).toBe('286 602');
    expect(miles(999)).toBe('999');
  });
});
