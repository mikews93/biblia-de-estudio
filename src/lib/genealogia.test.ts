import { describe, expect, it } from 'vitest';

import { descripcion, hermanosDe, JESUS, linaje, Persona, Personas, personaHref, relacion } from './genealogia';

const persona = (id: number, nombre: string, sexo: Persona['sexo'], rel: Partial<Persona> = {}): Persona => ({
  id,
  nombre,
  sexo,
  padres: [],
  madres: [],
  conyuges: [],
  hijos: [],
  hermanos: [],
  cita: '',
  versiculos: 1,
  ...rel,
});

// Booz y Rut → Obed → Isaí → David y sus hermanos; José, padre legal de Jesús
const all: Personas = new Map(
  [
    persona(1, 'Booz', 'm', { conyuges: [2], hijos: [3] }),
    persona(2, 'Rut', 'f', { conyuges: [1], hijos: [3] }),
    persona(3, 'Obed', 'm', { padres: [1], madres: [2], hijos: [4] }),
    persona(4, 'Isaí', 'm', { padres: [3], hijos: [5, 6, 7] }),
    persona(5, 'David', 'm', { padres: [4], hermanos: [8] }),
    persona(6, 'Eliab', 'm', { padres: [4] }),
    persona(7, 'Sarvia', 'f', { padres: [4] }),
    persona(9, 'Hermano solo', '', { hermanos: [5] }),
    persona(10, 'José', 'm', { hijos: [JESUS] }),
    persona(JESUS, 'Jesús', 'm', { padres: [10] }),
  ].map((p) => [p.id, p]),
);
const get = (id: number) => all.get(id)!;

describe('descripcion', () => {
  it('distingue por padre, cónyuge, hijo o hermano, en ese orden', () => {
    expect(descripcion(get(5), all)).toBe('hijo de Isaí');
    expect(descripcion(get(7), all)).toBe('hija de Isaí');
    expect(descripcion(get(2), all)).toBe('esposa de Booz');
    expect(descripcion(get(10), all)).toBe('padre de Jesús');
    expect(descripcion(get(9), all)).toBe('hermano de David');
    expect(descripcion(persona(99, 'Nadie', 'm'), all)).toBe('');
  });

  it('Jesús tiene su propia descripción', () => {
    expect(descripcion(get(JESUS), all)).toBe('nacido de María, desposada con José (Mateo 1:16)');
  });
});

describe('linaje', () => {
  it('sube por el padre hasta donde se sabe', () => {
    expect(linaje(get(5), all).map((p) => p.nombre)).toEqual(['David', 'Isaí', 'Obed', 'Booz']);
  });

  it('no entra en un bucle si los datos tienen un ciclo', () => {
    const ciclo: Personas = new Map([
      [1, persona(1, 'A', 'm', { padres: [2] })],
      [2, persona(2, 'B', 'm', { padres: [1] })],
    ]);
    expect(linaje(ciclo.get(1)!, ciclo).map((p) => p.id)).toEqual([1, 2]);
  });
});

describe('hermanosDe', () => {
  it('suma los hermanos de la fuente y los demás hijos de los padres, sin la persona ni ids desconocidos', () => {
    expect(hermanosDe(get(5), all).sort()).toEqual([6, 7]);
  });
});

describe('relacion y personaHref', () => {
  it('José es el padre legal de Jesús', () => {
    expect(relacion.padre(get(10), get(JESUS))).toBe('padre legal');
    expect(relacion.padre(get(4), get(5))).toBe('padre');
    expect(relacion.padre(get(2))).toBe('madre');
    expect(relacion.conyuge(get(9))).toBe('cónyuge');
  });

  it('enlace con el nombre sin acentos', () => {
    expect(personaHref(get(4))).toBe('/genealogia/4-isai');
    expect(personaHref(persona(12, 'María Magdalena', 'f'))).toBe('/genealogia/12-maria-magdalena');
  });
});
