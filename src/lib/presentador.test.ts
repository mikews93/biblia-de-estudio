import { describe, expect, it } from 'vitest';

import { citasDeTexto, preguntasDeParte, trozosConCitas } from './presentador';

const books = [
  { id: 'luk', name: 'Lucas', abbr: 'Lc', chapters: 24, testament: 'NT' },
  { id: 'php', name: 'Filipenses', abbr: 'Fil', chapters: 4, testament: 'NT' },
] as never;
const pasaje = { book: 'php', chapter: 2, from: 5, to: 11 };

describe('presentador', () => {
  it('reconoce las citas con libro, también entre paréntesis con la fuente', () => {
    const t = 'Las notas lo dicen (Tyndale, Filipenses 2:3) y luego «todos buscan lo suyo» (RV1909, Filipenses 2:21).';
    expect(citasDeTexto(t, books)).toEqual(['Filipenses 2:3', 'Filipenses 2:21']);
    const trozos = trozosConCitas(t, books);
    expect(trozos.map((x) => x.texto).join('')).toBe(t);
    expect(trozos.filter((x) => x.cita).map((x) => x.texto)).toEqual(['Filipenses 2:3', 'Filipenses 2:21']);
  });

  it('las citas de solo versículo son del pasaje del mensaje', () => {
    expect(citasDeTexto('Fíjate en el v. 7 y en los versículos 9 al 11.', books, pasaje)).toEqual(['Filipenses 2:7', 'Filipenses 2:9-11']);
    expect(citasDeTexto('Fíjate en el v. 7.', books)).toEqual([]);
    expect(citasDeTexto('Lucas 15:20 y v. 22', books, pasaje)).toEqual(['Lucas 15:20', 'Filipenses 2:22']);
  });

  it('saca las preguntas que se escribieron, sin repetir', () => {
    expect(
      preguntasDeParte({
        paraGrupo: '¿Qué te alejó a ti?',
        texto: 'Todos nos fuimos. ¿Qué te alejó a ti? Y luego otra cosa.\nPregunta: ¿a dónde te da vergüenza volver?',
        claves: '- Cuándo corrió Dios hacia ti?\n- Pedir la herencia = desearle la muerte\nPregunta: Lo que más te costó dejar',
      }),
    ).toEqual(['¿Qué te alejó a ti?', '¿a dónde te da vergüenza volver?', 'Cuándo corrió Dios hacia ti?', 'Lo que más te costó dejar']);
  });
});
