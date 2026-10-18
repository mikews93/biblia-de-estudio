import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { greeting, questionOfTheDay, verseOfTheDay } from './daily';

const DATA = path.resolve(__dirname, '../../public/data');
// Dos meses seguidos recorren toda la lista de versículos (60) y de preguntas (7)
const days = Array.from({ length: 70 }, (_, i) => new Date(2026, 0, 1 + i, 8));

describe('contenido del día', () => {
  it('es el mismo durante todo el día y cambia al siguiente', () => {
    const morning = new Date(2026, 4, 10, 0, 5);
    const night = new Date(2026, 4, 10, 23, 55);
    expect(verseOfTheDay(night)).toEqual(verseOfTheDay(morning));
    expect(questionOfTheDay(night)).toBe(questionOfTheDay(morning));
    expect(verseOfTheDay(new Date(2026, 4, 11))).not.toEqual(verseOfTheDay(morning));
  });

  it('los versículos del día son capítulos que existen y no se repiten en 60 días', () => {
    const seen = new Set(days.slice(0, 60).map((d) => JSON.stringify(verseOfTheDay(d))));
    expect(seen.size).toBe(60);
    for (const d of days) {
      const v = verseOfTheDay(d);
      const book = BOOKS.find((b) => b.id === v.book);
      expect(book, v.book).toBeDefined();
      expect(v.chapter).toBeLessThanOrEqual(book!.chapters);
    }
  });

  it.skipIf(!existsSync(DATA))('cada versículo del día existe en la RV1909 (public/data)', () => {
    for (const d of days.slice(0, 60)) {
      const { book, chapter, verse } = verseOfTheDay(d);
      const verses = JSON.parse(readFileSync(path.join(DATA, 'text/rv1909', book, `${chapter}.json`), 'utf8')) as [number, string][];
      expect(verses.some(([n]) => n === verse), `${book} ${chapter}:${verse}`).toBe(true);
    }
  });

  it('las preguntas rotan todas', () => {
    expect(new Set(days.map(questionOfTheDay)).size).toBe(7);
  });

  it('saludo según la hora', () => {
    expect(greeting(new Date(2026, 0, 1, 6))).toBe('Buenos días');
    expect(greeting(new Date(2026, 0, 1, 12))).toBe('Buenas tardes');
    expect(greeting(new Date(2026, 0, 1, 18, 59))).toBe('Buenas tardes');
    expect(greeting(new Date(2026, 0, 1, 19))).toBe('Buenas noches');
  });
});
