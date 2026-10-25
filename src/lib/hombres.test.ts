import { describe, expect, it } from 'vitest';

import { HOMBRES, SEMANAS_HOMBRES, invitacionHombres, progresoHombres } from './hombres';

describe('Hombres de pie', () => {
  it('ocho semanas numeradas en orden, cada una con pasaje, preguntas y reto', () => {
    expect(SEMANAS_HOMBRES).toBe(8);
    HOMBRES.forEach((s, i) => {
      expect(s.n).toBe(i + 1);
      expect(s.pasajes.length).toBeGreaterThan(0);
      for (const { pasaje } of s.pasajes) expect(pasaje.to).toBeGreaterThanOrEqual(pasaje.from);
      expect(s.preguntas.length).toBeGreaterThanOrEqual(3);
      expect(s.reto.length).toBeGreaterThan(20);
    });
    // Al menos una semana invita a otro hombre, y la última lleva a leer con los hijos
    expect(HOMBRES.some((s) => s.invitar)).toBe(true);
    expect(HOMBRES[SEMANAS_HOMBRES - 1].hijos).toBe(true);
  });

  it('las semanas se abren en orden', () => {
    expect(progresoHombres([])).toEqual({ hechas: 0, siguiente: 1, completo: false });
    expect(progresoHombres([1, 2])).toEqual({ hechas: 2, siguiente: 3, completo: false });
    expect(progresoHombres([2])).toMatchObject({ siguiente: 1 });
    expect(progresoHombres([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ hechas: 8, siguiente: null, completo: true });
  });

  it('la invitación lleva el enlace', () => {
    expect(invitacionHombres('https://x.test/hombres')).toMatch(/Hombres de pie.*https:\/\/x\.test\/hombres$/);
  });
});
