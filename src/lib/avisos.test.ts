import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { buildEstado, isIOS } from './avisos';
import { expand, MyPlan, planDays, PLANS } from './planes';
import { Card } from './tarjetas';

const def = (id: string) => PLANS.find((p) => p.id === id)!;
const plan = (id: string, patch: Partial<MyPlan> = {}): MyPlan => ({
  id,
  def: id.replace(/-\d{4}$/, ''),
  title: def(id.replace(/-\d{4}$/, '')).title,
  readings: expand(def(id.replace(/-\d{4}$/, '')), BOOKS),
  minutes: 10,
  daysPerWeek: 7,
  started: '2026-10-01',
  done: {},
  ...patch,
});
const card = (id: string, due: string) => ({ id, due }) as Card;

describe('buildEstado', () => {
  it('sin planes: donde se quedó, el último día con lectura y las fechas de repaso ordenadas', () => {
    const estado = buildEstado({
      plans: [],
      cards: { a: card('a', '2026-10-20'), b: card('b', '2026-10-18') },
      days: ['2026-10-16', '2026-10-17'],
      books: BOOKS,
      last: { book: 'jhn', chapter: 3 },
      today: '2026-10-18',
    });
    expect(estado).toEqual({
      leido: '2026-10-17',
      lectura: { titulo: 'Juan 3', url: '/juan/3' },
      tarjetas: ['2026-10-18', '2026-10-20'],
    });
  });

  it('con un plan a tu ritmo: su primera lectura pendiente', () => {
    const estado = buildEstado({
      plans: [plan('juan', { done: { 0: '2026-10-01', 1: '2026-10-02' } })],
      cards: {},
      days: [],
      books: BOOKS,
      last: { book: 'gen', chapter: 1 },
      today: '2026-10-18',
    });
    expect(estado.lectura).toEqual({ titulo: 'Juan 3', url: '/juan/3' });
  });

  it('con un desafío de temporada: los días que faltan desde hoy, con su título y su lectura', () => {
    const p = plan('adviento-2026', { started: '2026-11-29' });
    const days = planDays(p, def('adviento'), null);
    const today = days[2].date!;
    const withDone = { ...p, done: { 2: today } };
    const estado = buildEstado({ plans: [withDone], cards: {}, days: [], books: BOOKS, last: null, today });
    expect(estado.reto).toMatchObject({ titulo: def('adviento').title, icono: def('adviento').icon, url: '/planes/adviento' });
    // El día de hoy ya se leyó: el siguiente pendiente es el 4.º.
    const [first] = estado.reto!.dias;
    const [b, c] = p.readings[3];
    expect(first).toEqual({ fecha: days[3].date, dia: 4, titulo: days[3].title, lectura: `${BOOKS.find((x) => x.id === b)!.name} ${c}` });
    expect(estado.reto!.dias.every((d) => d.fecha > today)).toBe(true);
  });
});

it('reconoce iPhone, iPad (también el que se presenta como Mac) y no a Android', () => {
  expect(isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' })).toBe(true);
  expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe(true);
  expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe(false);
  expect(isIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7)' })).toBe(false);
});
