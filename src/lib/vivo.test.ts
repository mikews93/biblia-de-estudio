import { describe, expect, it } from 'vitest';

import { type Sala, TONOS, cleanCode, newest, secondsLeft, spacedCode, toneOf, touchesByVerse } from './vivo';

const sala = (version: number) => ({ version }) as Sala;

describe('lectura en vivo', () => {
  it('limpia el código como lo escriben: minúsculas, espacios y letras que se confunden', () => {
    expect(cleanCode('k7m qwe')).toBe('K7MQWE');
    expect(cleanCode('K7M-QWE-XX')).toBe('K7MQWE');
    // I, L, O, 0 y 1 no existen en los códigos (se confunden al dictarlos).
    expect(cleanCode('IL0O1A')).toBe('A');
    expect(spacedCode('K7MQWE')).toBe('K7M QWE');
  });

  it('se queda siempre con la versión más nueva aunque las respuestas lleguen cruzadas', () => {
    const v5 = sala(5);
    expect(newest(null, v5)).toBe(v5);
    expect(newest(v5, sala(4))).toBe(v5);
    const v6 = sala(6);
    expect(newest(v5, v6)).toBe(v6);
  });

  it('la cuenta atrás corrige la diferencia de reloj con el servidor', () => {
    const now = Date.parse('2026-10-21T20:00:00Z');
    const fin = '2026-10-21T20:05:00Z';
    expect(secondsLeft(fin, 0, now)).toBe(300);
    // El teléfono va 30 s atrasado respecto al servidor.
    expect(secondsLeft(fin, 30_000, now)).toBe(270);
    expect(secondsLeft(fin, 0, now + 400_000)).toBe(0);
    expect(secondsLeft(null, 0, now)).toBeNull();
  });

  it('cada persona ilumina siempre con el mismo tono y se agrupan por versículo', () => {
    expect(toneOf('ana')).toBe(toneOf('ana'));
    expect(TONOS).toContain(toneOf('beto'));
    const map = touchesByVerse([
      { usuario: 'a', nombre: 'Ana', versiculo: 16 },
      { usuario: 'b', nombre: 'Beto', versiculo: 16 },
      { usuario: 'c', nombre: 'Carla', versiculo: 3 },
    ]);
    expect(map.get(16)?.map((t) => t.nombre)).toEqual(['Ana', 'Beto']);
    expect(map.get(3)).toHaveLength(1);
  });
});
