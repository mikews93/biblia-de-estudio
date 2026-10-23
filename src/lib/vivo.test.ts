import { describe, expect, it } from 'vitest';

import {
  type PreguntaSala,
  type Sala,
  TONOS,
  cleanCode,
  newest,
  ordenPreguntas,
  preguntasDe,
  secondsLeft,
  seccionesDelEstudio,
  spacedCode,
  toneOf,
  touchesByVerse,
} from './vivo';

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

describe('estudio en grupo', () => {
  const estudio = [
    'Intro sin título.',
    '## Panorama\n\nPablo escribe desde la cárcel ⟦1⟧.',
    '## Palabras del griego: **zēteite** está en presente ⟦2⟧.',
    '## Para aplicar\n\n- ¿Qué buscas tú cada día? ⟦3⟧\n- **¿Con quién** necesitas perdonar?\n- Una idea que no es pregunta.',
  ].join('\n\n');
  const fuentes = [1, 2, 3, 4].map((n) => ({ n, label: `Fuente ${n}` }));

  it('parte el estudio Profundo en sus secciones, con las fuentes que cita cada una', () => {
    const s = seccionesDelEstudio(estudio, fuentes);
    expect(s.map((x) => x.titulo)).toEqual(['Panorama', 'Palabras del griego', 'Para aplicar']);
    expect(s[0].texto).toBe('Pablo escribe desde la cárcel ⟦1⟧.');
    expect(s[0].fuentes.map((f) => f.n)).toEqual([1]);
    // El texto en la misma línea del título («## Título: texto») queda como texto de la sección.
    expect(s[1].texto).toBe('**zēteite** está en presente ⟦2⟧.');
  });

  it('saca las preguntas de «Para aplicar» sin citas ni negritas', () => {
    const aplicar = seccionesDelEstudio(estudio)[2];
    expect(preguntasDe(aplicar.texto)).toEqual(['¿Qué buscas tú cada día?', '¿Con quién necesitas perdonar?']);
  });

  it('ordena el tablero: primero las que esperan y las más apoyadas', () => {
    const p = (id: string, apoyos: number, respondida = false): PreguntaSala => ({
      id,
      texto: id,
      autor: 'a',
      nombre: 'Ana',
      apoyos: Array.from({ length: apoyos }, (_, i) => `u${i}`),
      respondida,
    });
    expect(ordenPreguntas([p('vista', 5, true), p('una', 1), p('tres', 3), p('otra', 1)]).map((x) => x.id)).toEqual([
      'tres',
      'una',
      'otra',
      'vista',
    ]);
  });
});
