import { describe, expect, it } from 'vitest';

import { PAUSA_MS, decidir } from './musicaPodcast';

const base = { sonando: false, encendida: true, nuestra: false, ambiente: null as string | null, quietoMs: 0 };

describe('música de fondo del pódcast', () => {
  it('entra cuando el pódcast suena y no hay otra música', () => {
    expect(decidir({ ...base, sonando: true })).toBe('poner');
    expect(decidir({ ...base, sonando: true, encendida: false })).toBeNull();
    // Si la persona ya tenía otra pista de ambiente, no se toca.
    expect(decidir({ ...base, sonando: true, ambiente: 'noche' })).toBeNull();
  });

  it('una pausa corta entre intervenciones no la apaga; una larga, sí (solo si la puso el pódcast)', () => {
    const puesta = { ...base, nuestra: true, ambiente: 'piano' };
    expect(decidir({ ...puesta, quietoMs: 800 })).toBeNull();
    expect(decidir({ ...puesta, quietoMs: PAUSA_MS })).toBe('quitar');
    expect(decidir({ ...puesta, nuestra: false, quietoMs: PAUSA_MS })).toBeNull();
    expect(decidir({ ...puesta, sonando: true, encendida: false })).toBe('quitar');
  });
});
