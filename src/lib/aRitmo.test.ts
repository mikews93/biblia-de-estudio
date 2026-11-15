import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aRitmo } from './aRitmo';

describe('aRitmo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('avisa enseguida la primera vez y junta los trozos que llegan seguidos', () => {
    const vistos: string[] = [];
    const avisar = aRitmo((t: string) => vistos.push(t), 50);
    avisar('a');
    avisar('ab');
    avisar('abc');
    expect(vistos).toEqual(['a']);
    vi.advanceTimersByTime(50);
    expect(vistos).toEqual(['a', 'abc']);
  });

  it('el último trozo llega aunque no venga otro detrás', () => {
    const vistos: string[] = [];
    const avisar = aRitmo((t: string) => vistos.push(t), 50);
    avisar('a');
    avisar('ab');
    vi.advanceTimersByTime(49);
    expect(vistos).toEqual(['a']);
    vi.advanceTimersByTime(1);
    expect(vistos).toEqual(['a', 'ab']);
  });

  it('cancelar descarta lo pendiente', () => {
    const vistos: string[] = [];
    const avisar = aRitmo((t: string) => vistos.push(t), 50);
    avisar('a');
    avisar('ab');
    avisar.cancelar();
    vi.advanceTimersByTime(100);
    expect(vistos).toEqual(['a']);
  });
});
