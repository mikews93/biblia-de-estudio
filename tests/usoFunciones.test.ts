import { describe, expect, it } from 'vitest';

import { catalogo } from '@/lib/todo';
import { EN_OTRO_LUGAR, funcionDeRuta, ordenar, puntos, sumar } from '@/lib/usoFunciones';

const todas = catalogo({ book: 'jhn', chapter: 3 }).flatMap((g) => g.funciones);
const DIA = 86_400_000;
const ahora = Date.parse('2026-11-05T12:00:00Z');

describe('accesos de Hoy según el uso', () => {
  it('sin uso sale el orden de siempre, con Estudiar con IA primero', () => {
    expect(ordenar(todas, {}, ahora).map((f) => f.id).slice(0, 5)).toEqual(['estudiar', 'libros', 'notas', 'diario', 'despertador']);
  });

  it('lo que se usa sube, y dos usos bastan para pasar al primero de siempre', () => {
    let uso = sumar({}, 'comparar', ahora);
    uso = sumar(uso, 'comparar', ahora);
    expect(ordenar(todas, uso, ahora)[0].id).toBe('comparar');
  });

  it('lo que dejó de usarse pierde la mitad del peso cada dos semanas', () => {
    const uso = sumar({}, 'podcast', ahora - 14 * DIA);
    expect(puntos(uso.podcast, ahora)).toBeCloseTo(0.5);
  });

  it('nunca repite lo que ya está en la barra de abajo o en Hoy', () => {
    let uso = {};
    for (const id of EN_OTRO_LUGAR) uso = sumar(sumar(uso, id, ahora), id, ahora);
    const ids = ordenar(todas, uso, ahora).map((f) => f.id);
    for (const id of ['planes', 'taller', 'comunidad', 'preguntar', 'sellos', 'notificaciones', 'cuenta']) expect(ids).not.toContain(id);
  });

  it('reconoce la función de cada ruta', () => {
    expect(funcionDeRuta('/comparar/romanos/8')).toBe('comparar');
    expect(funcionDeRuta('/podcast/jhn/3')).toBe('podcast');
    expect(funcionDeRuta('/taller/dinamicas')).toBe('dinamicas');
    expect(funcionDeRuta('/diario?vista=oraciones')).toBe('diario');
    expect(funcionDeRuta('/juan/3')).toBeNull();
    expect(funcionDeRuta('/')).toBeNull();
  });
});
