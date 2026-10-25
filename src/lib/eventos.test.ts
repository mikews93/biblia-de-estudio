import { describe, expect, it } from 'vitest';

import { citasEn, codigoLegible, contenidoDe, limpiarCodigo } from './eventos';
import type { Mensaje } from './taller';

const books = [
  { id: 'luk', name: 'Lucas', abbr: 'Lc', chapters: 24, testament: 'NT' },
  { id: 'rom', name: 'Romanos', abbr: 'Ro', chapters: 16, testament: 'NT' },
  { id: '1jn', name: '1 Juan', abbr: '1 Jn', chapters: 5, testament: 'NT' },
  { id: 'jhn', name: 'Juan', abbr: 'Jn', chapters: 21, testament: 'NT' },
] as never;

describe('eventos', () => {
  it('limpia el código como lo escriba la persona', () => {
    expect(limpiarCodigo('abc 234')).toBe('ABC234');
    expect(limpiarCodigo('ABC-234')).toBe('ABC234');
    expect(limpiarCodigo('https://biblia.migueblanco.com/evento/QWE789?x=1')).toBe('QWE789');
    expect(codigoLegible('ABC234')).toBe('ABC 234');
  });

  it('encuentra las citas con versículo de un texto', () => {
    expect(citasEn('Mira Romanos 5:8 y también 1 Jn 4:9-10. Vuelve a romanos 5:8.', books)).toEqual(['Romanos 5:8', '1 Juan 4:9-10']);
    expect(citasEn('Punto 1: tres cosas. Juan 3 sin versículo. Lucas 99:1 no existe.', books)).toEqual([]);
  });

  it('publica lo que es para la congregación y saca las citas también de las notas', () => {
    const m = {
      id: 'x',
      tipo: 'sermon',
      titulo: 'El hijo que vuelve',
      pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
      tema: 'Dios',
      complemento: 'corre hacia nosotros',
      secciones: [
        { id: 'a', titulo: 'Se fue', ayuda: '', texto: 'Mis notas privadas, ver Lucas 15:12', minutos: 5, paraGrupo: 'Todos nos alejamos' },
        { id: 'b', titulo: '  ', ayuda: '', texto: '', minutos: 5 },
      ],
    } as unknown as Mensaje;
    const sin = contenidoDe(m, books, false);
    expect(sin.idea).toBe('Dios: corre hacia nosotros');
    // Los minutos de cada punto viajan para el reloj de quien predica.
    expect(sin.puntos[0]).toEqual({ titulo: 'Se fue', texto: 'Todos nos alejamos', citas: ['Lucas 15:12'], minutos: 5 });
    expect(sin.puntos[1].titulo).toBe('Sin título');
    expect(contenidoDe(m, books, true).puntos[0].texto).toBe('Todos nos alejamos\n\nMis notas privadas, ver Lucas 15:12');
  });

  it('cierra con los anuncios como último punto', () => {
    const m = {
      titulo: 'T', tema: '', complemento: '', pasaje: null,
      secciones: [{ id: 'a', titulo: 'Uno', ayuda: '', texto: '', minutos: 5 }],
      anuncios: '- Cena el viernes\n\n2. Bautismos el domingo',
    } as unknown as Mensaje;
    const c = contenidoDe(m, books, false);
    expect(c.puntos).toHaveLength(2);
    expect(c.puntos[1]).toEqual({ titulo: 'Anuncios', texto: '• Cena el viernes\n• Bautismos el domingo', citas: [] });
    expect(contenidoDe({ ...m, anuncios: '  ' }, books, false).puntos).toHaveLength(1);
  });
});

describe('desactualizado', () => {
  it('no se confunde con el orden de las claves que devuelve Postgres', async () => {
    const { desactualizado } = await import('./eventos');
    const m = {
      titulo: 'T', tema: '', complemento: '', pasaje: { book: 'luk', chapter: 15, from: 11, to: 24 },
      secciones: [{ id: 'a', titulo: 'Uno', ayuda: '', texto: 'Romanos 5:8', minutos: 1 }],
    } as unknown as Mensaje;
    const e = {
      titulo: 'T', idea: null, pasaje: { to: 24, book: 'luk', from: 11, chapter: 15 },
      puntos: [{ citas: ['Romanos 5:8'], minutos: 1, texto: '', titulo: 'Uno' }],
    } as never;
    expect(desactualizado(e, m, books)).toBe(false);
    expect(desactualizado(e, { ...m, titulo: 'Otro' }, books)).toBe(true);
    // También si ahora se lee en otra versión que la publicada (la RV1909 si no dice).
    expect(desactualizado(e, m, books, 'rv1909')).toBe(false);
    expect(desactualizado(e, m, books, 'nbla')).toBe(true);
  });
});
