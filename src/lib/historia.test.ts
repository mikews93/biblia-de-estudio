import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { año, ERAS, EVENTOS, eventosDe, fechaEvento, fechaPeriodo, periodoDe, PERIODOS, rango } from './historia';
import { parseRef } from './refs';

const chapterExists = (book: string, chapter: number) => {
  const b = BOOKS.find((x) => x.id === book);
  return !!b && chapter >= 1 && chapter <= b.chapters;
};

describe('periodoDe', () => {
  it('cada capítulo de la Biblia tiene su periodo', () => {
    const sin = BOOKS.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => i + 1).filter((c) => !periodoDe(b.id, c)).map((c) => `${b.id}.${c}`));
    expect(sin).toEqual([]);
  });

  it('los cortes dentro de un libro caen donde deben', () => {
    expect(periodoDe('gen', 11)?.id).toBe('origenes');
    expect(periodoDe('gen', 12)?.id).toBe('abraham');
    expect(periodoDe('2sa', 1)?.id).toBe('david');
    expect(periodoDe('xyz', 1)).toBeUndefined();
    expect(periodoDe('gen', 51)).toBeUndefined();
  });

  it('el enlace de cada periodo abre un capítulo que existe', () => {
    for (const p of Object.values(PERIODOS)) {
      const [book, chapter] = p.ref.split('.');
      expect(chapterExists(book, Number(chapter)), `${p.id}: ${p.ref}`).toBe(true);
      expect(p.desde, p.id).toBeLessThanOrEqual(p.hasta);
    }
  });
});

describe('eventos del mundo', () => {
  it('las referencias de los eventos existen', () => {
    for (const e of EVENTOS.filter((x) => x.ref)) {
      const { start } = parseRef(e.ref!);
      expect(chapterExists(start.book, start.chapter), `${e.titulo}: ${e.ref}`).toBe(true);
    }
  });

  it('eventosDe devuelve como mucho max, ordenados por fecha y cerca del periodo', () => {
    for (const p of Object.values(PERIODOS)) {
      const list = eventosDe(p, 4);
      expect(list.length, p.id).toBeLessThanOrEqual(4);
      expect(list.map((e) => e.desde)).toEqual([...list.map((e) => e.desde)].sort((a, b) => a - b));
      for (const e of list) expect((e.hasta ?? e.desde) >= p.desde - 250 && e.desde <= p.hasta + 250, `${p.id}: ${e.titulo}`).toBe(true);
    }
  });

  it('las eras van seguidas, sin huecos', () => {
    for (let i = 1; i < ERAS.length; i++) expect(ERAS[i].desde).toBe(ERAS[i - 1].hasta);
  });
});

describe('fechas', () => {
  it('antes y después de Cristo, con «c.» en las aproximadas', () => {
    expect(año(-1010)).toBe('1010 a.C.');
    expect(año(30)).toBe('30 d.C.');
    expect(rango(-1010, -970, true)).toBe('c. 1010–970 a.C.');
    expect(rango(-6, 30)).toBe('6 a.C.–30 d.C.');
    expect(rango(41, 54)).toBe('41–54 d.C.');
    expect(rango(70)).toBe('70 d.C.');
  });

  it('fechaPeriodo y fechaEvento', () => {
    expect(fechaPeriodo(PERIODOS.origenes)).toBe('Sin fecha');
    expect(fechaPeriodo(PERIODOS.abraham)).toBe('c. 2091–1991 a.C.');
    expect(fechaEvento({ desde: 100, c: true, region: 'América', titulo: '', texto: '' })).toBe('c. 100 d.C.');
  });
});
