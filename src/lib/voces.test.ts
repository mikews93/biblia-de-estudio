import { describe, expect, it } from 'vitest';

import { citaHablada, nombreCorto, ordenar, paraHablar } from './voces';

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

  it('en Android prefiere las voces «network» y da un nombre propio a las que solo tienen código', () => {
    const lista = [
      v('es-us-x-esc-local', 'es-US', { identifier: 'es-us-x-esc-local' }),
      v('es-us-x-esf-network', 'es-US', { identifier: 'es-us-x-esf-network' }),
      v('es-us-x-esf-local', 'es-US', { identifier: 'es-us-x-esf-local' }),
      v('es-us-x-sfb-network', 'es-US', { identifier: 'es-us-x-sfb-network' }),
    ];
    const voces = ordenar(lista);
    expect(voces.map((x) => x.id).slice(0, 2)).toEqual(['es-us-x-esf-network', 'es-us-x-sfb-network']);
    const nombre = (id: string) => voces.find((x) => x.id === id)!.nombre;
    // La local y la de red son la misma voz: mismo nombre; voces distintas, nombres distintos
    expect(nombre('es-us-x-esf-local')).toBe(nombre('es-us-x-esf-network'));
    expect(new Set(voces.map((x) => x.nombre)).size).toBe(3);
    expect(voces.every((x) => !/^voz/i.test(x.nombre))).toBe(true);
    expect(voces.find((x) => x.id === 'es-us-x-esc-local')?.sinInternet).toBe(true);
    // El mismo código se llama igual en cualquier teléfono, aunque cambie el orden o falten otras voces
    expect(ordenar([lista[1]])[0].nombre).toBe(nombre('es-us-x-esf-network'));
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

it('las citas con dos puntos se leen como capítulo y versículo', () => {
  expect(paraHablar('Lee Juan 3:16 y Salmo 23:1-3.')).toBe('Lee Juan capítulo 3, versículo 16 y Salmo capítulo 23, versículos 1 al 3.');
});
