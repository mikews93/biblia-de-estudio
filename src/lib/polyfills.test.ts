import { describe, expect, it } from 'vitest';

import { at, findLastIndex, poner } from './polyfills';

describe('polyfills para navegadores viejos', () => {
  it('.at cuenta desde atrás con negativos y da undefined fuera de rango', () => {
    const lista = [1, 2, 3];
    expect(at.call(lista, -1)).toBe(3);
    expect(at.call(lista, 0)).toBe(1);
    expect(at.call(lista, 5)).toBeUndefined();
    expect(at.call(lista, -4)).toBeUndefined();
    expect(at.call([], -1)).toBeUndefined();
    expect(at.call('hola', -1)).toBe('a');
  });

  it('findLastIndex busca desde el final', () => {
    expect(findLastIndex.call([1, 2, 3, 2], (x) => x === 2)).toBe(3);
    expect(findLastIndex.call([1], (x) => x === 9)).toBe(-1);
  });

  it('solo agrega lo que falta y sin que aparezca al recorrer', () => {
    const viejo: Record<string, unknown> = {};
    poner(viejo, 'at', at);
    expect(viejo.at).toBe(at);
    expect(Object.keys(viejo)).toEqual([]);
    const nuevo = { at: 'propio' };
    poner(nuevo, 'at', at);
    expect(nuevo.at).toBe('propio');
  });
});
