import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { formatRef, parseRef } from './refs';

describe('parseRef', () => {
  it('un versículo suelto empieza y termina en el mismo sitio', () => {
    expect(parseRef('rom.5.8')).toEqual({
      start: { book: 'rom', chapter: 5, verse: 8 },
      end: { book: 'rom', chapter: 5, verse: 8 },
    });
  });

  it('un tramo, también con libros que empiezan por número', () => {
    expect(parseRef('1jn.4.9-1jn.4.10')).toEqual({
      start: { book: '1jn', chapter: 4, verse: 9 },
      end: { book: '1jn', chapter: 4, verse: 10 },
    });
  });
});

describe('formatRef', () => {
  it('escribe cada forma de tramo como se lee en español', () => {
    expect(formatRef('jhn.3.16', BOOKS)).toBe('Juan 3:16');
    expect(formatRef('mat.6.33-mat.6.34', BOOKS)).toBe('Mateo 6:33-34');
    expect(formatRef('mat.5.1-mat.7.29', BOOKS)).toBe('Mateo 5:1–7:29');
    expect(formatRef('mal.4.6-mat.1.1', BOOKS)).toBe('Malaquías 4:6 – Mateo 1:1');
  });

  it('usa el código si no conoce el libro', () => {
    expect(formatRef('xyz.1.2', BOOKS)).toBe('xyz 1:2');
  });
});
