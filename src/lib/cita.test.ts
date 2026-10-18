import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { citaLabel, parseCita } from './cita';

const cita = (texto: string, disponibles: string[] = ['rv1909']) => parseCita(texto, BOOKS, disponibles);

describe('parseCita: citas escritas', () => {
  it('lee libro, capítulo y versículo con distintos separadores', () => {
    expect(cita('Juan 3:16')).toMatchObject({ book: 'jhn', chapter: 3, verse: 16 });
    expect(cita('jn 3.16')).toMatchObject({ book: 'jhn', chapter: 3, verse: 16 });
    expect(cita('Jn3:16')).toMatchObject({ book: 'jhn', chapter: 3, verse: 16 });
  });

  it('lee un tramo de versículos con coma europea y guion', () => {
    expect(cita('Jn 3,16-18')).toMatchObject({ book: 'jhn', chapter: 3, verse: 16, verseEnd: 18 });
    expect(cita('Romanos 8:28–30')).toMatchObject({ book: 'rom', chapter: 8, verse: 28, verseEnd: 30 });
  });

  it('descarta un final de tramo que no avanza', () => {
    expect(cita('Juan 3:18-16')).toMatchObject({ verse: 18, verseEnd: undefined });
  });

  it('entiende los libros con número escritos de varias maneras', () => {
    expect(cita('1 reyes 2:5')).toMatchObject({ book: '1ki', chapter: 2, verse: 5 });
    expect(cita('1reyes 2:5')).toMatchObject({ book: '1ki' });
    expect(cita('2 Cor 5:17')).toMatchObject({ book: '2co', chapter: 5, verse: 17 });
    expect(cita('II Corintios 5:17')).toMatchObject({ book: '2co' });
    expect(cita('1ra de Juan 4:8')).toMatchObject({ book: '1jn', chapter: 4, verse: 8 });
    expect(cita('1jn4:8')).toMatchObject({ book: '1jn', chapter: 4, verse: 8 });
  });

  it('no confunde Juan con 1 Juan', () => {
    expect(cita('Juan 1:1')?.book).toBe('jhn');
    expect(cita('1 Juan 1:1')?.book).toBe('1jn');
  });

  it('acepta abreviaturas, comienzos de nombre y una letra de más o de menos', () => {
    expect(cita('Flp 4:13')?.book).toBe('php');
    expect(cita('filip 4:13')?.book).toBe('php');
    expect(cita('Ap 21:4')?.book).toBe('rev');
    expect(cita('genisis 1:1')?.book).toBe('gen');
    expect(cita('Éxodo 20')).toMatchObject({ book: 'exo', chapter: 20, verse: undefined });
  });

  it('abre el capítulo 1 con el nombre entero del libro, pero no con una abreviatura corta', () => {
    expect(cita('Job')).toMatchObject({ book: 'job', chapter: 1 });
    expect(cita('Salmos')).toMatchObject({ book: 'psa', chapter: 1 });
    expect(cita('mal')).toBeNull();
    expect(cita('am')).toBeNull();
  });

  it('en un libro de un solo capítulo el número es el versículo', () => {
    expect(cita('Judas 5')).toMatchObject({ book: 'jud', chapter: 1, verse: 5 });
    expect(cita('Abdías 3-5')).toMatchObject({ book: 'oba', chapter: 1, verse: 3, verseEnd: 5 });
    expect(cita('Judas 1:24')).toMatchObject({ book: 'jud', chapter: 1, verse: 24 });
  });

  it('«Juan 3-5» es un tramo de capítulos: abre el primero', () => {
    expect(cita('Juan 3-5')).toMatchObject({ book: 'jhn', chapter: 3, verse: undefined });
  });

  it('separa un número dictado sin pausa cuando solo hay una lectura posible', () => {
    expect(cita('Juan 316')).toMatchObject({ book: 'jhn', chapter: 3, verse: 16 });
    // Salmos tiene 150 capítulos: 119 es un capítulo, no 1:19
    expect(cita('Salmo 119')).toMatchObject({ book: 'psa', chapter: 119, verse: undefined });
  });

  it('marca el problema cuando el capítulo no existe', () => {
    expect(cita('Juan 30')).toMatchObject({ book: 'jhn', chapter: 30, problem: 'Juan tiene 21 capítulos.' });
    expect(cita('Juan 0')?.problem).toBe('Juan tiene 21 capítulos.');
    expect(cita('Juan 3:16')?.problem).toBeUndefined();
  });

  it('no toma por cita lo que no lo es', () => {
    expect(cita('amor')).toBeNull();
    expect(cita('juan 3 amor')).toBeNull();
    expect(cita('3:16')).toBeNull();
    expect(cita('')).toBeNull();
    expect(cita('todo lo puedo en Cristo')).toBeNull();
  });
});

describe('parseCita: citas dictadas', () => {
  it('«primera de Reyes capítulo dos versículo cinco»', () => {
    expect(cita('primera de Reyes capítulo dos versículo cinco')).toMatchObject({ book: '1ki', chapter: 2, verse: 5 });
  });

  it('números en palabras: decenas, «y» y centenas', () => {
    expect(cita('juan tres dieciséis')).toMatchObject({ book: 'jhn', chapter: 3, verse: 16 });
    expect(cita('salmo ciento diecinueve versículo ciento cinco')).toMatchObject({ book: 'psa', chapter: 119, verse: 105 });
    expect(cita('salmo treinta y siete versículo cuatro')).toMatchObject({ book: 'psa', chapter: 37, verse: 4 });
  });

  it('tramos dictados: «del 5 al 8», «5 hasta 8»', () => {
    expect(cita('mateo cinco versículos tres al doce')).toMatchObject({ book: 'mat', chapter: 5, verse: 3, verseEnd: 12 });
    expect(cita('Romanos 12 1 hasta 2')).toMatchObject({ book: 'rom', chapter: 12, verse: 1, verseEnd: 2 });
  });

  it('ignora las palabras de relleno alrededor del libro', () => {
    expect(cita('abre el evangelio según san Juan capítulo tres')).toMatchObject({ book: 'jhn', chapter: 3 });
    expect(cita('¿Segunda de Timoteo 3:16?')).toMatchObject({ book: '2ti', chapter: 3, verse: 16 });
  });
});

describe('parseCita: versiones', () => {
  it('reconoce una versión que no está en la app (id null)', () => {
    expect(cita('1 reyes 2:5 nbla')).toEqual({
      book: '1ki',
      chapter: 2,
      verse: 5,
      verseEnd: undefined,
      version: { abbr: 'NBLA', name: 'Nueva Biblia de las Américas', id: null },
    });
    expect(cita('Juan 3:16 en la Reina Valera 1960')?.version).toMatchObject({ abbr: 'RVR1960', id: null });
    expect(cita('Juan 3:16 NVI')?.version?.abbr).toBe('NVI');
  });

  it('da el id de la versión solo si está disponible', () => {
    expect(cita('Juan 3:16 rv1909')?.version).toMatchObject({ abbr: 'RV1909', id: 'rv1909' });
    expect(cita('Juan 3:16 rv1909', [])?.version).toMatchObject({ abbr: 'RV1909', id: null });
    expect(cita('Juan 3:16 BES', ['rv1909', 'bes'])?.version).toMatchObject({ id: 'bes' });
  });

  it('«Reina Valera» a secas es la RV1909 de la app y no se confunde con la de 1960', () => {
    expect(cita('Salmo 23 reina valera')?.version).toMatchObject({ abbr: 'RV1909', id: 'rv1909' });
    expect(cita('Salmo 23 RVR1960')?.version?.abbr).toBe('RVR1960');
  });

  it('la versión no se come el libro ni los números', () => {
    expect(cita('nbla 1 reyes 2:5')).toMatchObject({ book: '1ki', chapter: 2, verse: 5 });
  });
});

describe('citaLabel', () => {
  it('escribe la cita con el nombre del libro', () => {
    expect(citaLabel({ book: 'jhn', chapter: 3 }, BOOKS)).toBe('Juan 3');
    expect(citaLabel({ book: 'jhn', chapter: 3, verse: 16 }, BOOKS)).toBe('Juan 3:16');
    expect(citaLabel({ book: 'jhn', chapter: 3, verse: 16, verseEnd: 18 }, BOOKS)).toBe('Juan 3:16-18');
    expect(citaLabel({ book: 'xyz', chapter: 1 }, BOOKS)).toBe('xyz 1');
  });
});
