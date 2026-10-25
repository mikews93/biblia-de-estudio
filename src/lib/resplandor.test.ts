import { describe, expect, it } from 'vitest';

import { resplandorDe, resplandorNuevo } from './resplandor';

describe('huevo de pascua de la racha', () => {
  it('la luz crece con la racha', () => {
    expect([1, 3, 6, 7, 39, 40, 99, 100, 400].map((d) => resplandorDe(d)?.intensidad ?? 0)).toEqual([0, 1, 1, 2, 3, 4, 4, 5, 6]);
    expect(resplandorDe(40)?.centro).toBe('rostro');
  });

  it('sale sola solo el día en que se llega a una meta', () => {
    expect(resplandorNuevo(40)?.titulo).toBe('Tu rostro resplandece');
    expect(resplandorNuevo(41)).toBeNull();
  });
});
