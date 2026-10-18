import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { esCorriente, EVENTOS, REGION_COLORS, REINOS } from './historia';
import { apilar, crearEscala, etiquetaMarca, filasEn, FIN, INICIO } from './lineaTiempo';
import { parseRef } from './refs';

describe('escala', () => {
  const escala = crearEscala([-1000, -990, -980, -970, 30, 31, 32]);

  it('va de izquierda a derecha y su inversa devuelve el año', () => {
    expect(escala.x(INICIO)).toBe(0);
    expect(escala.x(FIN)).toBeCloseTo(escala.ancho);
    for (const y of [-3000, -1446, -586, -4, 30, 95]) {
      expect(escala.x(y)).toBeGreaterThan(escala.x(y - 1));
      expect(escala.año(escala.x(y))).toBeCloseTo(y, 5);
    }
  });

  it('los siglos con más historia ocupan más', () => {
    expect(escala.x(-950) - escala.x(-1000)).toBeGreaterThan(escala.x(-2950) - escala.x(-3000));
  });

  it('el zoom multiplica el ancho y las marcas no se pisan', () => {
    expect(crearEscala([-1000], 2).ancho).toBeCloseTo(crearEscala([-1000], 1).ancho * 2);
    const xs = escala.marcas.map(escala.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(64);
    expect(etiquetaMarca(-700)).toBe('700 a.C.');
    expect(etiquetaMarca(0)).toBe('Cristo');
  });
});

describe('apilar', () => {
  const caja = (t: [number, number]) => ({ x: t[0], w: t[1] });

  it('pone en la misma fila lo que no se toca y abre filas para lo que se solapa', () => {
    const { colocados, filas } = apilar<[number, number]>([[0, 50], [100, 50], [20, 50], [30, 50]], caja, 8);
    expect(filas).toBe(3);
    expect(colocados.map((c) => c.fila)).toEqual([0, 1, 2, 0]);
  });

  it('con un máximo de filas acorta la anterior en vez de abrir otra, salvo las fijas', () => {
    const items: [number, number][] = [[0, 300], [10, 300], [200, 50]];
    const { colocados, filas } = apilar(items, caja, 8, 2, 60);
    expect(filas).toBe(2);
    expect(colocados[0].w).toBe(192);
    expect(colocados[2].fila).toBe(0);
    expect(apilar(items, caja, 8, 2, 60, (t) => t[0] === 0).colocados[1].w).toBe(182);
    // Si no queda el mínimo, se abre otra fila
    expect(apilar<[number, number]>([[0, 300], [10, 300], [40, 50]], caja, 8, 2, 60).filas).toBe(3);
  });

  it('filasEn cuenta solo lo que se ve', () => {
    const { colocados } = apilar<[number, number]>([[0, 50], [20, 50], [500, 50]], caja);
    expect(filasEn(colocados, 0, 100)).toBe(2);
    expect(filasEn(colocados, 400, 600)).toBe(1);
    expect(filasEn(colocados, 200, 300, 0)).toBe(0);
  });
});

describe('reinos', () => {
  it('tienen región conocida, fechas en orden y enlaces que existen', () => {
    for (const r of REINOS) {
      expect(REGION_COLORS[r.region], r.titulo).toBeTruthy();
      expect(r.hasta! > r.desde, r.titulo).toBe(true);
      if (r.ref) {
        const { start } = parseRef(r.ref);
        const b = BOOKS.find((x) => x.id === start.book);
        expect(!!b && start.chapter <= b.chapters, `${r.titulo}: ${r.ref}`).toBe(true);
      }
    }
  });

  it('no repiten un evento largo', () => {
    const largos = new Set(EVENTOS.filter(esCorriente).map((e) => e.titulo));
    expect(REINOS.filter((r) => largos.has(r.titulo))).toEqual([]);
  });
});
