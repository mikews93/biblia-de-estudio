import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('confeti', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 16, 10)); // viernes 16 de octubre de 2026
  });
  afterEach(() => vi.useRealTimers());

  it('dos logros seguidos lanzan una sola fiesta', async () => {
    const { alLanzar, lanzarConfeti } = await import('./confeti');
    const vistos: string[] = [];
    alLanzar((l) => vistos.push(l.estilo));
    lanzarConfeti('fuegos');
    lanzarConfeti('confeti');
    expect(vistos).toEqual(['fuegos']);
    vi.setSystemTime(new Date(2026, 9, 16, 10, 0, 2));
    lanzarConfeti('confeti');
    expect(vistos).toEqual(['fuegos', 'confeti']);
  });

  it('el día que completa la meta de la semana lanza fuegos, una sola vez', async () => {
    await AsyncStorage.setItem('progreso', JSON.stringify({ chapters: {}, days: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'] }));
    const { alLanzar } = await import('./confeti');
    const { markStudyDay, markChapterRead } = await import('./progress');
    const vistos: string[] = [];
    alLanzar((l) => vistos.push(l.estilo));
    await markStudyDay();
    expect(vistos).toEqual(['fuegos']);
    vi.setSystemTime(new Date(2026, 9, 17, 10));
    await markChapterRead('jhn', 1);
    expect(vistos).toEqual(['fuegos']);
  });

  it('terminar un plan lanza fuegos', async () => {
    const { alLanzar } = await import('./confeti');
    const planes = await import('./planes');
    const vistos: string[] = [];
    alLanzar((l) => vistos.push(l.estilo));
    await AsyncStorage.setItem(
      'planes',
      JSON.stringify({ plans: [{ id: 'p', title: 'Uno', started: '2026-10-01', readings: [['jhn', 1], ['jhn', 2]], done: { 0: '2026-10-01' } }] }),
    );
    await planes.markPlanReading('jhn', 2);
    expect(vistos).toEqual(['fuegos']);
  });
});
