import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { MyPlan, PLANS, expand, planDef } from './planes';
import { calendarWeeks, focusDay, milestones, questionFor, retoProgress, seasonTint } from './retos';
import { easter, nextSeason, parseDate, parseRetoId, seasonDates, seasonRun } from './temporadas';

const def = (id: string) => planDef(id, BOOKS)!;
const weekday = (d: string) => parseDate(d).getDay();

const reto = (id: string, year: number, patch: Partial<MyPlan> = {}): MyPlan => ({
  id: `${id}-${year}`,
  def: id,
  title: def(id).title,
  readings: expand(def(id), BOOKS),
  minutes: 5,
  daysPerWeek: 7,
  started: seasonRun(def(id), year).start,
  done: {},
  ...patch,
});

describe('el año cristiano', () => {
  it('Pascua de varios años (algoritmo de Meeus)', () => {
    const iso = (y: number) => {
      const d = easter(y);
      return `${d.getMonth() + 1}-${d.getDate()}`;
    };
    expect([2024, 2025, 2026, 2027, 2028, 2030].map(iso)).toEqual(['3-31', '4-20', '4-5', '3-28', '4-16', '4-21']);
  });

  it('Semana Santa va del Domingo de Ramos al de Resurrección (2027: 21 al 28 de marzo)', () => {
    const dates = seasonDates('semana-santa', 2027, 8);
    expect(dates[0]).toBe('2027-03-21');
    expect(dates[7]).toBe('2027-03-28');
    expect(weekday(dates[0])).toBe(0);
    expect(weekday(dates[5])).toBe(5); // Viernes Santo
  });

  it('Pentecostés: los diez días tras la Ascensión, y el último es el domingo de Pentecostés', () => {
    const dates = seasonDates('pentecostes', 2027, 10);
    expect(dates[0]).toBe('2027-05-07'); // el viernes después de la Ascensión (jueves 6 de mayo)
    expect(dates[9]).toBe('2027-05-16');
    expect(weekday(dates[9])).toBe(0);
    expect(seasonDates('pentecostes', 2026, 10).slice(-1)[0]).toBe('2026-05-24');
  });

  it('la próxima edición de cada reto desde el 18 de octubre de 2026', () => {
    const at = (id: string) => nextSeason(def(id), '2026-10-18')!;
    expect(at('adviento')).toMatchObject({ year: 2026, start: '2026-12-01', daysToStart: 44, running: false });
    expect(at('semana-santa')).toMatchObject({ year: 2027, start: '2027-03-21' });
    expect(at('pentecostes')).toMatchObject({ year: 2027, end: '2027-05-16' });
    expect(nextSeason(def('semana-santa'), '2027-03-24')).toMatchObject({ year: 2027, running: true });
  });

  it('parseRetoId separa el reto y el año', () => {
    expect(parseRetoId('semana-santa-2027')).toEqual({ def: 'semana-santa', year: 2027 });
    expect(parseRetoId('adviento')).toBeNull();
  });
});

describe('catálogo de retos', () => {
  const retos = PLANS.filter((p) => p.season);

  it('hay cinco retos y cada día tiene título y pregunta', () => {
    expect(retos.map((p) => p.id).sort()).toEqual(['adviento', 'anio-nuevo', 'cuaresma', 'pentecostes', 'semana-santa']);
    for (const p of retos) {
      expect(p.questions?.length, p.id).toBe(p.spec.length);
      for (const q of p.questions!) expect(q.trim().length, `${p.id}: ${q}`).toBeGreaterThan(20);
      // Un capítulo por día: el servidor calcula la lectura de un grupo con esto
      for (const [, chapter] of p.spec) expect(chapter, p.id).toBeGreaterThan(0);
    }
  });

  it('cada tiempo tiene su color, distinto en claro y en oscuro', () => {
    for (const p of retos) {
      const light = seasonTint(p.season!, { background: '#FBF8F3' });
      const dark = seasonTint(p.season!, { background: '#151311' });
      expect(light.accent).not.toBe(dark.accent);
      expect(light.name.length).toBeGreaterThan(3);
    }
    expect(seasonTint('adviento', { background: '#F4ECD8' }).accent).toBe(seasonTint('adviento', { background: '#FBF8F3' }).accent);
  });
});

describe('calendario del reto', () => {
  it('Adviento 2026: cuatro semanas de lunes a domingo, con relleno fuera de las fechas', () => {
    const weeks = calendarWeeks(seasonRun(def('adviento'), 2026).dates);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toEqual({ date: '2026-11-30', index: null, outside: true }); // lunes antes del 1 de diciembre
    expect(weeks[0][1]).toEqual({ date: '2026-12-01', index: 0, outside: false });
    expect(weeks[3][4]).toEqual({ date: '2026-12-25', index: 24, outside: false });
    expect(weeks[3][6].outside).toBe(true);
  });

  it('Cuaresma: los domingos quedan como descanso dentro del reto', () => {
    const weeks = calendarWeeks(seasonRun(def('cuaresma'), 2027).dates);
    const rest = weeks.flat().filter((c) => c.index === null && !c.outside);
    expect(rest).toHaveLength(6); // incluido el Domingo de Ramos
    for (const c of rest) expect(weekday(c.date)).toBe(0);
    // El Domingo de Resurrección sí tiene lectura
    expect(weeks.flat().find((c) => c.date === '2027-03-28')?.index).toBe(40);
  });
});

describe('avance e hitos', () => {
  it('los hitos dependen del largo del reto', () => {
    expect(milestones(25, 0).map((m) => [m.at, m.label])).toEqual([
      [1, 'Primer paso'],
      [7, 'Una semana en camino'],
      [13, 'Mitad del camino'],
      [25, 'Reto completo'],
    ]);
    expect(milestones(8, 4).map((m) => [m.at, m.reached])).toEqual([
      [1, true],
      [4, true],
      [8, false],
    ]);
  });

  it('nada se pierde: lo de días anteriores «te espera» y el hito se celebra hasta la siguiente lectura', () => {
    const run = seasonRun(def('adviento'), 2026);
    const plan = reto('adviento', 2026, { done: { 0: '2026-12-01', 2: '2026-12-04' }, reflections: { 0: 'Gracia temprana', 1: '  ' } });
    const p = retoProgress(plan, run, '2026-12-04');
    expect(p).toMatchObject({ total: 25, done: 2, todayIndex: 3, next: 1, behind: 1, celebrate: null, reflections: 1, started: true, ended: false });
    expect([0, 1, 2, 3, 4].map(p.state)).toEqual(['hecho', 'pendiente', 'hecho', 'hoy', 'futuro']);
    expect(focusDay(p)).toBe(3);

    const first = retoProgress(reto('adviento', 2026, { done: { 0: '2026-12-01' } }), run, '2026-12-01');
    expect(first.celebrate).toBe('Primer paso');
    expect(focusDay(first)).toBe(1); // ya leyó lo de hoy: se abre lo siguiente
  });

  it('antes de empezar se abre el primer día; un domingo de Cuaresma, lo pendiente', () => {
    const run = seasonRun(def('cuaresma'), 2027);
    expect(focusDay(retoProgress(reto('cuaresma', 2027), run, '2027-01-10'))).toBe(0);
    const sunday = '2027-02-14'; // primer domingo de Cuaresma 2027 (Ceniza: 10 de febrero)
    expect(weekday(sunday)).toBe(0);
    const p = retoProgress(reto('cuaresma', 2027, { done: { 0: '2027-02-10' } }), run, sunday);
    expect(p.todayIndex).toBeNull();
    expect(focusDay(p)).toBe(1);
  });

  it('questionFor da la pregunta del capítulo recién leído', () => {
    const plan = reto('semana-santa', 2027, { reflections: { 5: 'Gracias' } });
    expect(questionFor(plan, def('semana-santa'), 'jhn', 19)).toMatchObject({ index: 5, title: 'Viernes Santo: consumado es', answered: true });
    expect(questionFor(plan, def('semana-santa'), 'gen', 1)).toBeNull();
    expect(questionFor(plan, def('juan'), 'jhn', 19)).toBeNull();
  });
});
