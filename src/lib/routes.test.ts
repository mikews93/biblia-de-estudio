import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { BOOK_SLUGS, bookIdFromParam, chapterHref, verseHref } from './routes';

describe('rutas en español', () => {
  it('cada libro tiene un nombre de URL único y sin acentos', () => {
    expect(Object.keys(BOOK_SLUGS).sort()).toEqual(BOOKS.map((b) => b.id).sort());
    const slugs = Object.values(BOOK_SLUGS);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it('arma los enlaces de capítulo y versículo', () => {
    expect(chapterHref('jhn', 3)).toBe('/juan/3');
    expect(verseHref('1co', 13, 4)).toBe('/1-corintios/13/4');
    expect(chapterHref('desconocido', 1)).toBe('/desconocido/1');
  });

  it('acepta el nombre en la URL, el código antiguo y mayúsculas o escapes', () => {
    expect(bookIdFromParam('juan')).toBe('jhn');
    expect(bookIdFromParam('1-corintios')).toBe('1co');
    expect(bookIdFromParam('JHN')).toBe('jhn');
    expect(bookIdFromParam('G%C3%A9nesis')).toBe('génesis'); // con acento no es un slug: queda tal cual
    expect(bookIdFromParam('Genesis')).toBe('gen');
  });

  it('ida y vuelta: del código a la URL y de la URL al código', () => {
    for (const b of BOOKS) expect(bookIdFromParam(chapterHref(b.id, 1).split('/')[1])).toBe(b.id);
  });
});
