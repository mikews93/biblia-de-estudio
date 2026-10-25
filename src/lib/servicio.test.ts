import { describe, expect, it } from 'vitest';

import { nivelDe, siguienteNivel, totalDe } from './servicio';

describe('servicio', () => {
  it('suma estudios profundos, mensajes terminados y veces guiando', () => {
    expect(totalDe({ profundos: 7, escritos: 2, guiados: 3 })).toBe(12);
  });

  it('los niveles: 10, 40, 120, 300 y 1000', () => {
    expect([0, 9, 10, 39, 40, 120, 299, 300, 999, 1000, 5000].map((n) => nivelDe(n)?.nivel ?? 0)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5]);
    expect([0, 10, 999, 1000].map((n) => siguienteNivel(n)?.meta ?? null)).toEqual([10, 40, 1000, null]);
  });
});
