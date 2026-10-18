import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import {
  dateKey,
  dayMinutes,
  expand,
  MyPlan,
  nextSeason,
  parseDate,
  planDays,
  planDef,
  planStatus,
  plansWaitingFor,
  PLANS,
  splitByTime,
} from './planes';

const def = (id: string) => planDef(id, BOOKS)!;

const plan = (patch: Partial<MyPlan> = {}): MyPlan => ({
  id: 'juan',
  def: 'juan',
  title: 'Juan',
  readings: expand(def('juan'), BOOKS),
  minutes: 10,
  daysPerWeek: 7,
  started: '2026-01-01',
  done: {},
  ...patch,
});

describe('fechas locales', () => {
  it('dateKey y parseDate van y vuelven sin perder el día', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateKey(parseDate('2026-12-31'))).toBe('2026-12-31');
    expect(dateKey(parseDate('2028-02-29'))).toBe('2028-02-29');
  });
});

describe('catálogo', () => {
  it('ids únicos y capítulos que existen', () => {
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(PLANS.length);
    for (const p of PLANS) {
      for (const [book, chapter] of p.spec) {
        const b = BOOKS.find((x) => x.id === book);
        expect(b, `${p.id}: ${book}`).toBeDefined();
        if (chapter) expect(chapter, `${p.id}: ${book} ${chapter}`).toBeLessThanOrEqual(b!.chapters);
      }
    }
  });

  it('los de temporada tienen un título por lectura', () => {
    for (const p of PLANS.filter((x) => x.season)) expect(p.days?.length, p.id).toBe(p.spec.length);
  });

  it('expand reparte los libros enteros en capítulos', () => {
    expect(expand(def('juan'), BOOKS)).toHaveLength(21);
    expect(expand(def('juan'), BOOKS)[20]).toEqual(['jhn', 21]);
    expect(expand(def('nt'), BOOKS)).toHaveLength(260);
    expect(expand(def('biblia'), BOOKS)).toHaveLength(1189);
  });

  it('planDef arma un plan de un libro, o nada si el libro no existe', () => {
    expect(planDef('libro-rom', BOOKS)).toMatchObject({ id: 'libro-rom', title: 'Romanos', spec: [['rom']] });
    expect(planDef('libro-xyz', BOOKS)).toBeUndefined();
    expect(planDef('no-existe', BOOKS)).toBeUndefined();
  });
});

describe('temporadas', () => {
  it('Cuaresma va del Miércoles de Ceniza a Pascua sin domingos (Pascua 2027: 28 de marzo)', () => {
    const s = nextSeason(def('cuaresma'), '2026-10-18')!;
    expect(s).toMatchObject({ year: 2027, start: '2027-02-10', end: '2027-03-28', running: false });
    expect(s.dates).toHaveLength(41);
    expect(s.dates[39]).toBe('2027-03-27'); // Sábado Santo
    expect(s.dates.slice(0, -1).every((d) => parseDate(d).getDay() !== 0)).toBe(true);
    expect(s.daysToStart).toBe(115);
  });

  it('Pascua según el calendario gregoriano en años conocidos', () => {
    // La última lectura cae en Pascua
    expect(nextSeason(def('cuaresma'), '2026-01-01')!.end).toBe('2026-04-05');
    expect(nextSeason(def('cuaresma'), '2025-01-01')!.end).toBe('2025-04-20');
    expect(nextSeason(def('cuaresma'), '2024-01-01')!.end).toBe('2024-03-31');
  });

  it('Adviento en curso o el del año siguiente cuando ya pasó', () => {
    expect(nextSeason(def('adviento'), '2026-12-10')).toMatchObject({
      year: 2026,
      start: '2026-12-01',
      end: '2026-12-25',
      running: true,
      daysToStart: -9,
    });
    expect(nextSeason(def('adviento'), '2026-12-26')).toMatchObject({ year: 2027, start: '2027-12-01' });
  });

  it('Año nuevo: el 31 de diciembre ya mira al año siguiente', () => {
    expect(nextSeason(def('anio-nuevo'), '2026-12-31')).toMatchObject({ year: 2027, start: '2027-01-01', end: '2027-01-21' });
  });
});

describe('reparto en días', () => {
  it('sin datos de palabras cuenta 4 minutos por capítulo y no se pasa más de un 20 %', () => {
    const days = splitByTime(expand(def('juan'), BOOKS), 10, null);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual([0, 1, 2]);
    expect(days.flat()).toEqual([...Array(21).keys()]);
  });

  it('un capítulo largo va solo en su día y nunca se parte', () => {
    const readings = expand(def('juan'), BOOKS).slice(0, 4);
    const words = { jhn: [300, 3000, 300, 300] }; // 2, 20, 2 y 2 minutos
    expect(splitByTime(readings, 5, words)).toEqual([[0], [1], [2, 3]]);
  });

  it('dayMinutes redondea y nunca baja de 1', () => {
    const p = plan();
    expect(dayMinutes(p, { readings: [0, 1, 2] }, null)).toBe(12);
    expect(dayMinutes(p, { readings: [0] }, { jhn: [10] })).toBe(1);
  });

  it('en temporada hay un día por lectura con su fecha y su título', () => {
    const adviento = def('adviento');
    const p = plan({ id: 'adviento-2026', def: 'adviento', readings: expand(adviento, BOOKS) });
    const days = planDays(p, adviento, null);
    expect(days).toHaveLength(25);
    expect(days[0]).toEqual({ readings: [0], title: 'La primera promesa', date: '2026-12-01' });
    expect(days[24].date).toBe('2026-12-25');
  });
});

describe('planStatus', () => {
  it('el siguiente día es el primero con algo sin leer, aunque haya días leídos después', () => {
    const p = plan({ done: { 0: '2026-01-01', 1: '2026-01-01', 2: '2026-01-01', 6: '2026-01-02' } });
    const days = planDays(p, def('juan'), null);
    const s = planStatus(p, days, '2026-01-03');
    expect(s).toMatchObject({ next: 1, doneDays: 1, remaining: 6, scheduled: null, behind: 0 });
  });

  it('estima el final según los días por semana', () => {
    const p = plan({ daysPerWeek: 7 });
    const days = planDays(p, def('juan'), null); // 7 días
    expect(planStatus(p, days, '2026-03-01').estimatedEnd).toBe('2026-03-07');
    const p5 = plan({ daysPerWeek: 5 });
    // 7 días a 5 por semana = 1,4 semanas → 10 días
    expect(planStatus(p5, days, '2026-03-01').estimatedEnd).toBe('2026-03-10');
  });

  it('plan terminado: sin siguiente día', () => {
    const p = plan();
    p.done = Object.fromEntries(p.readings.map((_, i) => [i, '2026-01-01']));
    expect(planStatus(p, planDays(p, def('juan'), null), '2026-02-01')).toMatchObject({ next: null, remaining: 0 });
  });

  it('en temporada cuenta las lecturas atrasadas hasta la fecha de hoy', () => {
    const adviento = def('adviento');
    const p = plan({ id: 'adviento-2026', def: 'adviento', readings: expand(adviento, BOOKS), done: { 0: '2026-12-01', 2: '2026-12-03' } });
    const days = planDays(p, adviento, null);
    expect(planStatus(p, days, '2026-12-05')).toMatchObject({ scheduled: 4, behind: 3, next: 1 });
    expect(planStatus(p, days, '2026-11-20')).toMatchObject({ scheduled: -1, behind: 0 });
  });
});

describe('plansWaitingFor', () => {
  it('solo planes empezados, sin terminar y con ese capítulo pendiente', () => {
    const plans = [
      plan({ id: 'a', done: { 2: '2026-01-01' } }),
      plan({ id: 'b' }),
      plan({ id: 'c', finished: '2026-01-02' }),
      plan({ id: 'd', started: '2999-01-01' }),
    ];
    expect(plansWaitingFor(plans, 'jhn', 3).map((p) => p.id)).toEqual(['b']);
    expect(plansWaitingFor(plans, 'jhn', 4).map((p) => p.id)).toEqual(['a', 'b']);
    expect(plansWaitingFor(plans, 'rom', 1)).toEqual([]);
  });
});

describe('guardado en el dispositivo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 9));
  });
  afterEach(() => vi.useRealTimers());

  const saved = async () => JSON.parse((await AsyncStorage.getItem('planes'))!) as { plans: MyPlan[] };

  it('startPlan guarda el plan y markPlanReading marca la primera lectura pendiente de ese capítulo', async () => {
    const m = await import('./planes');
    await m.startPlan(m.planDef('juan', BOOKS)!, BOOKS, { minutes: 10, daysPerWeek: 5 });
    let [p] = (await saved()).plans;
    expect(p).toMatchObject({ id: 'juan', started: '2026-10-18', daysPerWeek: 5, done: {} });
    expect(p.readings).toHaveLength(21);

    await m.markPlanReading('jhn', 3);
    await m.markPlanReading('jhn', 3); // otra vez el mismo: no cuenta dos veces
    [p] = (await saved()).plans;
    expect(p.done).toEqual({ 2: '2026-10-18' });
    expect(p.finished).toBeUndefined();
  });

  it('al leer el último capítulo el plan queda terminado', async () => {
    const m = await import('./planes');
    await m.startPlan(m.planDef('libro-jud', BOOKS)!, BOOKS, { minutes: 10, daysPerWeek: 7 });
    await m.markPlanReading('jud', 1);
    expect((await saved()).plans[0]).toMatchObject({ id: 'libro-jud', finished: '2026-10-18' });
  });

  it('un plan de temporada lleva el año, empieza en su fecha y no avanza antes de tiempo', async () => {
    const m = await import('./planes');
    const p = await m.startPlan(m.planDef('adviento', BOOKS)!, BOOKS, { minutes: 10, daysPerWeek: 3 });
    expect(p).toMatchObject({ id: 'adviento-2026', started: '2026-12-01', daysPerWeek: 7 });
    await m.markPlanReading('gen', 3);
    expect((await saved()).plans[0].done).toEqual({});
  });

  it('volver a empezar un plan lo reemplaza, y removePlan lo quita', async () => {
    const m = await import('./planes');
    const juan = m.planDef('juan', BOOKS)!;
    await m.startPlan(juan, BOOKS, { minutes: 10, daysPerWeek: 5 });
    await m.markPlanReading('jhn', 1);
    await m.startPlan(juan, BOOKS, { minutes: 20, daysPerWeek: 5 });
    expect((await saved()).plans).toHaveLength(1);
    expect((await saved()).plans[0]).toMatchObject({ minutes: 20, done: {} });
    await m.updatePlan('juan', { daysPerWeek: 3 });
    expect((await saved()).plans[0].daysPerWeek).toBe(3);
    await m.removePlan('juan');
    expect((await saved()).plans).toEqual([]);
  });
});
