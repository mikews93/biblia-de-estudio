import { describe, expect, it } from 'vitest';

import { citaHablada, generoDeVoz, nombreCorto, ordenar, paraHablar } from './voces';

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
    expect(voces.map((x) => x.nombre)).toEqual(['Salome', voces[1].nombre, 'Sabina', 'Eddy']);
    // «Google español» es una voz de hombre: recibe un nombre de hombre
    expect(voces[1]).toMatchObject({ genero: 'hombre' });
    expect(['Pablo', 'Pedro', 'Andrés', 'Felipe', 'Esteban', 'Samuel', 'Daniel', 'Gabriel', 'Timoteo', 'Lucas', 'Mateo', 'Simón']).toContain(voces[1].nombre);
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
    // Nombre de mujer para las voces de mujer y de hombre para las de hombre
    const mujeres = ['Sara', 'Rut', 'Lidia', 'Débora', 'Ester', 'Miriam', 'Marta', 'Priscila', 'Noemí', 'Raquel', 'Abigail', 'Elisa'];
    expect(voces.find((x) => x.id === 'es-us-x-esf-network')).toMatchObject({ genero: 'hombre' });
    expect(mujeres).not.toContain(nombre('es-us-x-esf-network'));
    expect(mujeres).toContain(nombre('es-us-x-sfb-network'));
    expect(mujeres).toContain(nombre('es-us-x-esc-local'));
    expect(voces.find((x) => x.id === 'es-us-x-esc-local')?.sinInternet).toBe(true);
    // El mismo código se llama igual en cualquier teléfono, aunque cambie el orden o falten otras voces
    expect(ordenar([lista[1]])[0].nombre).toBe(nombre('es-us-x-esf-network'));
  });

  it('a igual calidad, un acento latinoamericano antes que el de España', () => {
    const voces = ordenar([v('Mónica', 'es-ES'), v('Paulina', 'es-MX')]);
    expect(voces.map((x) => x.nombre)).toEqual(['Paulina', 'Mónica']);
  });
});

describe('generoDeVoz', () => {
  it('sabe si suena a mujer o a hombre por el código, la voz de Google o el nombre', () => {
    expect(generoDeVoz('es-es-x-eed-network', 'es-es-x-eed-network')).toBe('hombre');
    expect(generoDeVoz('es-es-x-eea-local', 'es-es-x-eea-local')).toBe('mujer');
    expect(generoDeVoz('Google español', 'Google español')).toBe('hombre');
    expect(generoDeVoz('Google español de Estados Unidos', 'Google español de Estados Unidos')).toBe('mujer');
    expect(generoDeVoz('Google español de Estados Unidos 3 (Natural)', 'x')).toBe('hombre');
    expect(generoDeVoz('Microsoft Dalia Online (Natural) - Spanish (Mexico)', 'x')).toBe('mujer');
    expect(generoDeVoz('Microsoft Tomas Online (Natural) - Spanish (Argentina)', 'x')).toBe('hombre');
    expect(generoDeVoz('Jorge', 'com.apple.voice.compact.es-ES.Jorge')).toBe('hombre');
    expect(generoDeVoz('Spanish female', 'x')).toBe('mujer');
    expect(generoDeVoz('español (México)', 'x')).toBeUndefined();
  });

  it('las voces que no se sabe cómo suenan no reciben nombre de persona', () => {
    const voces = ordenar([v('es-mx-x-abc-local', 'es-MX', { identifier: 'es-mx-x-abc-local' })]);
    expect(voces[0].nombre).toBe('Voz 1');
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
