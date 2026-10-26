import { describe, expect, it } from 'vitest';

import { citaHablada, nombreCorto, ordenar } from './voces';

const v = (name: string, language: string, extra: { identifier?: string; localService?: boolean } = {}) => ({
  identifier: extra.identifier ?? name,
  name,
  language,
  quality: 'Default' as never,
  localService: extra.localService ?? true,
});

describe('ordenar', () => {
  it('pone primero las voces neuronales y las de Google, y al final las robóticas', () => {
    const voces = ordenar([
      v('Microsoft Sabina Desktop - Spanish (Mexico)', 'es-MX'),
      v('Google español', 'es-ES', { localService: false }),
      v('Microsoft Salome Online (Natural) - Spanish (Colombia)', 'es-CO', { localService: false }),
      v('Eddy (español (México))', 'es-MX'),
      v('English', 'en-US'),
    ]);
    expect(voces.map((x) => x.nombre)).toEqual(['Salome', 'Google', 'Sabina', 'Eddy']);
    expect(voces[0]).toMatchObject({ acento: 'Colombia', calidad: 'natural' });
    expect(voces.at(-1)?.calidad).toBe('basica');
  });

  it('en Android prefiere las voces «network» y numera las que solo tienen código', () => {
    const voces = ordenar([
      v('es-us-x-esc-local', 'es-US', { identifier: 'es-us-x-esc-local' }),
      v('es-us-x-esf-network', 'es-US', { identifier: 'es-us-x-esf-network' }),
    ]);
    expect(voces.map((x) => [x.id, x.nombre])).toEqual([
      ['es-us-x-esf-network', 'Voz 1'],
      ['es-us-x-esc-local', 'Voz 2'],
    ]);
  });

  it('a igual calidad, un acento latinoamericano antes que el de España', () => {
    const voces = ordenar([v('Mónica', 'es-ES'), v('Paulina', 'es-MX')]);
    expect(voces.map((x) => x.nombre)).toEqual(['Paulina', 'Mónica']);
  });
});

describe('nombreCorto', () => {
  it('deja solo el nombre de la voz', () => {
    expect(nombreCorto('Microsoft Dalia Online (Natural) - Spanish (Mexico)')).toBe('Dalia');
    expect(nombreCorto('Google español de Estados Unidos')).toBe('Google');
    expect(nombreCorto('Paulina (Mejorada)')).toBe('Paulina');
  });
});

it('dice la cita sin «dos puntos»', () => {
  expect(citaHablada('Juan', 3, 16)).toBe('Juan, capítulo 3, versículo 16');
});
