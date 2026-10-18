import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';

describe('progreso de lectura', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 10)); // miércoles 14 de octubre de 2026
  });
  afterEach(() => vi.useRealTimers());

  it('weekDays: de lunes a domingo, con los días leídos y hoy marcados', async () => {
    const { weekDays } = await import('./progress');
    const week = weekDays(['2026-10-12', '2026-10-14', '2026-10-19', '2026-10-11']);
    expect(week.map((d) => d.label).join('')).toBe('LMXJVSD');
    expect(week.map((d) => d.read)).toEqual([true, false, true, false, false, false, false]);
    expect(week.findIndex((d) => d.isToday)).toBe(2);
  });

  it('weekDays el domingo sigue en la misma semana', async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 22));
    const { weekDays } = await import('./progress');
    const week = weekDays(['2026-10-12', '2026-10-18']);
    expect(week[0].read).toBe(true);
    expect(week[6]).toMatchObject({ read: true, isToday: true });
  });

  it('markChapterRead guarda los capítulos ordenados y cuenta el día una sola vez', async () => {
    const { markChapterRead } = await import('./progress');
    await markChapterRead('jhn', 3);
    await markChapterRead('jhn', 1);
    await markChapterRead('jhn', 3);
    const saved = JSON.parse((await AsyncStorage.getItem('progreso'))!);
    expect(saved).toEqual({ chapters: { jhn: [1, 3] }, days: ['2026-10-14'] });
  });

  it('conserva lo guardado antes y solo los últimos 120 días', async () => {
    const days = Array.from({ length: 120 }, (_, i) => `2026-01-${String(i).padStart(3, '0')}`);
    await AsyncStorage.setItem('progreso', JSON.stringify({ chapters: { rom: [8] }, days }));
    const { markChapterRead } = await import('./progress');
    await markChapterRead('rom', 1);
    const saved = JSON.parse((await AsyncStorage.getItem('progreso'))!);
    expect(saved.chapters).toEqual({ rom: [1, 8] });
    expect(saved.days).toHaveLength(120);
    expect(saved.days.at(-1)).toBe('2026-10-14');
    expect(saved.days[0]).toBe('2026-01-001');
  });

  it('leer un capítulo avanza los planes que lo esperan', async () => {
    const planes = await import('./planes');
    const { markChapterRead } = await import('./progress');
    await planes.startPlan(planes.planDef('marcos', BOOKS)!, BOOKS, { minutes: 10, daysPerWeek: 5 });
    await markChapterRead('mrk', 1);
    await vi.waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem('planes'))!);
      expect(saved.plans[0].done).toEqual({ 0: '2026-10-14' });
    });
  });
});
