import { describe, expect, it } from 'vitest';

import { chaptersLabel, friendUrl, postReference, Publicacion } from './social';

const post = (patch: Partial<Publicacion>): Publicacion => ({
  id: '1',
  tipo: 'lectura',
  audiencia: 'amigos',
  libro: 'jhn',
  libroNombre: 'Juan',
  capitulo: null,
  versiculo: null,
  version: null,
  cita: null,
  texto: null,
  datos: {},
  creado: '',
  actualizado: '',
  autorId: 'a',
  autor: 'Ana',
  autorFoto: null,
  mia: false,
  meGusta: 0,
  yoMeGusta: false,
  comentarios: 0,
  ...patch,
});

describe('publicaciones', () => {
  it('referencia de capítulo o versículo', () => {
    expect(postReference(post({ capitulo: 3, versiculo: 16 }))).toBe('Juan 3:16');
    expect(postReference(post({ capitulo: 3 }))).toBe('Juan 3');
    expect(postReference(post({}))).toBeNull();
  });

  it('capítulos leídos: «Juan 3, 4 y 5»', () => {
    expect(chaptersLabel(post({ datos: { capitulos: [3, 4, 5] } }))).toBe('Juan 3, 4 y 5');
    expect(chaptersLabel(post({ datos: { capitulos: [3] } }))).toBe('Juan 3');
    expect(chaptersLabel(post({ datos: {} }))).toBe('Juan');
  });

  it('enlace de amistad con el dominio publicado cuando no hay navegador', () => {
    expect(friendUrl('ABCD2345')).toMatch(/\/amigo\/ABCD2345$/);
  });
});
