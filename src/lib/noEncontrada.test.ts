import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { PANTALLAS, limpiarRuta, sugerirRuta } from './noEncontrada';

describe('limpiarRuta', () => {
  it('quita la puntuación que queda pegada al copiar un enlace', () => {
    expect(limpiarRuta('/instalar.')).toBe('/instalar');
    expect(limpiarRuta('/instalar),')).toBe('/instalar');
    expect(limpiarRuta('/juan/3/16.')).toBe('/juan/3/16');
    expect(limpiarRuta('/juan/3/16%C2%BB')).toBe('/juan/3/16');
    expect(limpiarRuta('/instalar./')).toBe('/instalar');
    expect(limpiarRuta('/.')).toBe('/');
  });

  it('deja en paz las direcciones bien escritas', () => {
    expect(limpiarRuta('/instalar')).toBeNull();
    expect(limpiarRuta('/instalar/')).toBeNull();
    expect(limpiarRuta('/juan/3/16')).toBeNull();
    expect(limpiarRuta('/')).toBeNull();
    expect(limpiarRuta('/%E0%A4%A')).toBeNull();
  });
});

describe('sugerirRuta', () => {
  it('propone la pantalla con una letra de menos o cambiada', () => {
    expect(sugerirRuta('/instala')?.href).toBe('/instalar');
    expect(sugerirRuta('/terminso')?.href).toBe('/terminos');
    expect(sugerirRuta('/Privacidád')?.href).toBe('/privacidad');
  });

  it('propone el libro, con su capítulo y versículo', () => {
    expect(sugerirRuta('/jaun/3/16')).toEqual({ href: '/juan/3/16', nombre: '3:16', libro: 'jhn' });
    expect(sugerirRuta('/génesis/1')).toEqual({ href: '/genesis/1', nombre: '1', libro: 'gen' });
    expect(sugerirRuta('/apocalipsi')?.href).toBe('/apocalipsis/1');
  });

  it('no inventa cuando nada se parece', () => {
    expect(sugerirRuta('/xyzzyqwerty')).toBeNull();
    expect(sugerirRuta('/')).toBeNull();
  });
});

it('PANTALLAS sigue a src/app', () => {
  const app = path.resolve(__dirname, '../app');
  const enDisco = readdirSync(app)
    .map((f) => f.replace(/\.tsx$/, ''))
    .filter((f) => !/^[[_+]/.test(f) && !['index', 'i', 'amigo', 'unirse', 'evento', 'ficha', 'mapa', 'mapa-mental', 'podcast', 'recorrido', 'tarjetas', 'comparar', 'cuidar', 'despertar'].includes(f));
  expect([...PANTALLAS].sort()).toEqual(enDisco.sort());
});
