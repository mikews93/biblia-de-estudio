// api/_semantica.ts: el vecino más cercano sobre vectores int8 con su escala.
import { describe, expect, it } from 'vitest';

import { nearest } from '../../api/_semantica';

const vectors = (rows: number[][]) => {
  const dim = rows[0].length;
  const values = new Int8Array(rows.length * dim);
  const scales = new Float32Array(rows.length);
  rows.forEach((r, i) => {
    const max = Math.max(...r.map(Math.abs));
    scales[i] = max / 127;
    r.forEach((x, k) => (values[i * dim + k] = Math.round(x / scales[i])));
  });
  return { model: 'm', dtype: 'q8', query: '', dim, refs: rows.map((_, i) => `r${i}`), values, scales };
};

describe('nearest', () => {
  it('ordena por parecido y respeta el límite y el filtro', () => {
    const vs = vectors([[1, 0, 0], [0.6, 0.8, 0], [0, 1, 0], [-1, 0, 0]]);
    const q = new Float32Array([0.8, 0.6, 0]);
    expect(nearest(q, vs, 3).map((h) => h.ref)).toEqual(['r1', 'r0', 'r2']);
    expect(nearest(q, vs, 1).map((h) => h.ref)).toEqual(['r1']);
    expect(nearest(q, vs, 2, (r) => r !== 'r1').map((h) => h.ref)).toEqual(['r0', 'r2']);
    expect(nearest(q, vs, 1)[0].score).toBeCloseTo(0.96, 2);
  });
});
