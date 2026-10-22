import { describe, expect, it } from 'vitest';

import { HILOS, arcos, espera, fechaPaso, hilosEn, pasoEnRef, posicion, textoEspera, CRISTO, FUTURO } from './promesas';
import { parseRef } from './refs';

describe('promesas', () => {
  it('cada hilo tiene ids únicos, una promesa y un cumplimiento o una esperanza', () => {
    expect(new Set(HILOS.map((h) => h.id)).size).toBe(HILOS.length);
    for (const h of HILOS) {
      expect(h.pasos.some((p) => p.rol === 'promesa' || p.rol === 'figura'), h.id).toBe(true);
      expect(h.pasos.some((p) => p.rol === 'cumple' || p.rol === 'espera'), h.id).toBe(true);
    }
  });

  it('las referencias están bien formadas y no cruzan de capítulo', () => {
    for (const h of HILOS)
      for (const p of h.pasos) {
        if (!p.ref) {
          expect(p.año, h.id).toBeDefined();
          continue;
        }
        const { start, end } = parseRef(p.ref);
        expect(start.book).toBe(end.book);
        expect(start.chapter, p.ref).toBe(end.chapter);
        expect(end.verse >= start.verse, p.ref).toBe(true);
      }
  });

  it('lo que aún esperamos no lleva fechas', () => {
    for (const h of HILOS.filter((x) => x.tema === 'esperanza')) expect(h.pasos.every((p) => p.año == null)).toBe(true);
  });

  it('calcula la espera entre la promesa y el cumplimiento', () => {
    const virgen = HILOS.find((h) => h.id === 'virgen')!;
    expect(espera(virgen)).toBe(729);
    expect(textoEspera(729)).toBe('unos 750 años después');
    expect(textoEspera(67)).toBe('unos 70 años después');
    expect(textoEspera(3)).toBe('3 años después');
    expect(fechaPaso(virgen.pasos[0])).toBe('c. 734 a.C.');
  });

  it('encuentra los hilos de un versículo y marca el otro extremo en las referencias', () => {
    const aqui = hilosEn('isa', 7, 14);
    expect(aqui.map((e) => e.hilo.id)).toEqual(['virgen']);
    expect(pasoEnRef(aqui, 'mat.1.23')?.paso.rol).toBe('cumple');
    expect(pasoEnRef(aqui, 'rom.1.1')).toBeUndefined();
    expect(hilosEn('isa', 53).length).toBeGreaterThan(3);
  });

  it('el arco va del principio a la cruz y después a lo que esperamos', () => {
    expect(posicion(undefined)).toBe(0);
    expect(posicion(30)).toBeCloseTo(CRISTO);
    expect(posicion(-2091)).toBeLessThan(posicion(-1000));
    expect(posicion(-1000)).toBeLessThan(posicion(-5));
    for (const a of arcos()) {
      expect(a.hasta).toBeGreaterThan(a.desde);
      if (a.futuro) expect(a.hasta).toBe(FUTURO);
    }
  });
});
