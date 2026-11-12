import { describe, expect, it } from 'vitest';

import { ContextoResena, MAX_PEDIDAS, tocaPedirResena } from './resenaTexto';

const base: ContextoResena = {
  hoy: '2026-11-20',
  desde: '2026-11-01',
  plataforma: 'android',
  modo: 'general',
  tranquila: false,
  capitulos: 8,
  dias: 5,
};

describe('tocaPedirResena', () => {
  it('pide a quien ya lleva más de una semana y varios capítulos en días distintos', () => {
    expect(tocaPedirResena(base)).toBe(true);
  });

  it('solo en Android', () => {
    expect(tocaPedirResena({ ...base, plataforma: 'web' })).toBe(false);
    expect(tocaPedirResena({ ...base, plataforma: 'ios' })).toBe(false);
  });

  it('nunca en Modo Jóvenes, Espacio Niños ni con «Lectura tranquila»', () => {
    expect(tocaPedirResena({ ...base, modo: 'jovenes' })).toBe(false);
    expect(tocaPedirResena({ ...base, modo: 'ninos' })).toBe(false);
    expect(tocaPedirResena({ ...base, tranquila: true })).toBe(false);
  });

  it('espera una semana desde que llegó', () => {
    expect(tocaPedirResena({ ...base, desde: '2026-11-15' })).toBe(false);
    expect(tocaPedirResena({ ...base, desde: '2026-11-13' })).toBe(true);
    expect(tocaPedirResena({ ...base, desde: undefined })).toBe(false);
  });

  it('espera a que haya leído en serio', () => {
    expect(tocaPedirResena({ ...base, capitulos: 4 })).toBe(false);
    expect(tocaPedirResena({ ...base, dias: 2 })).toBe(false);
  });

  it('deja 120 días entre una vez y otra, y para del todo después de tres', () => {
    expect(tocaPedirResena({ ...base, pedidas: ['2026-10-01'] })).toBe(false);
    expect(tocaPedirResena({ ...base, pedidas: ['2026-07-01'] })).toBe(true);
    const viejas = Array.from({ length: MAX_PEDIDAS }, (_, i) => `202${i}-01-01`);
    expect(tocaPedirResena({ ...base, pedidas: viejas })).toBe(false);
  });
});
