import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Mis sellos', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 10)); // miércoles 21 de octubre de 2026
  });
  afterEach(() => vi.useRealTimers());

  const guardado = async () => JSON.parse((await AsyncStorage.getItem('sellos'))!);

  it('cada palabra cuenta una vez, sin importar cómo se escriba su número de Strong', async () => {
    const s = await import('./sellos');
    await s.iniciar();
    await s.huellaPalabra('G0026');
    await s.huellaPalabra('g26');
    await s.huellaPalabra('G26a');
    await s.huellaPalabra('H2617');
    expect(s.cuenta(await guardado(), 'palabra')).toBe(2);
  });

  it('a las 10 palabras se gana «Buscador de tesoros» y queda por celebrar una sola vez', async () => {
    const s = await import('./sellos');
    await s.iniciar();
    for (let i = 1; i <= 9; i++) await s.huellaPalabra(`G${i}`);
    expect(s.porCelebrar()).toBeNull();
    await s.huellaPalabra('G10');
    expect(s.porCelebrar()?.id).toBe('palabras-10');
    expect((await guardado()).ganados['palabras-10']).toEqual({ fecha: '2026-10-21', visto: false });
    await s.celebrado('palabras-10');
    expect(s.porCelebrar()).toBeNull();
  });

  it('lo que ya se había hecho antes de los sellos se gana sin fiesta', async () => {
    const s = await import('./sellos');
    const dias = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    await s.huellasDe('dia', dias);
    await s.iniciar();
    const estado = await guardado();
    expect(estado.ganados['dias-30']).toEqual({ fecha: '2026-10-21', visto: true });
    expect(s.porCelebrar()).toBeNull();
  });

  it('explorar una palabra o un lugar también es un día con la Palabra en «Tu semana»', async () => {
    const s = await import('./sellos');
    await s.huellaLugar('Antioquía');
    await vi.waitFor(async () => {
      expect(JSON.parse((await AsyncStorage.getItem('progreso'))!).days).toEqual(['2026-10-21']);
    });
    // El mapa y la ficha del mismo lugar cuentan una vez
    await s.huellaLugar('antioquia');
    expect(s.cuenta(await guardado(), 'lugar')).toBe(1);
  });

  it('semanasConMeta: el lunes de cada semana con 5 días o más', async () => {
    const { semanasConMeta } = await import('./sellos');
    const semana = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-18'];
    expect(semanasConMeta([...semana, '2026-10-19', '2026-10-20'])).toEqual(['2026-10-12']);
    expect(semanasConMeta(semana.slice(0, 4))).toEqual([]);
  });

  it('el siguiente sello es el más avanzado de los que ya empezaron', async () => {
    const s = await import('./sellos');
    await s.iniciar();
    await s.huellaPalabra('G1');
    for (const id of ['a', 'b', 'c', 'd']) await s.huella('diferencia', id);
    const sig = s.siguienteSello(await guardado(), s.sellosPara());
    expect(sig?.sello.id).toBe('bereano');
    expect(sig?.n).toBe(4);
  });

  it('otro público suma sus sellos (y sus familias) sin cambiar los de todos', async () => {
    const s = await import('./sellos');
    const base = s.selloPorId('celula')!;
    s.definirSellos([{ ...base, id: 'joven-celula', publico: 'jovenes', familia: 'misiones' }], [
      { id: 'misiones', titulo: 'Misiones', subtitulo: 'Para jóvenes' },
    ]);
    expect(s.sellosPara().some((x) => x.id === 'joven-celula')).toBe(false);
    expect(s.sellosPara('jovenes').some((x) => x.id === 'joven-celula')).toBe(true);
    expect(s.getFamilias().at(-1)?.id).toBe('misiones');
  });

  it('en la cuenta va una entrada por huella y por sello; lo que llega de otro dispositivo no se vuelve a celebrar', async () => {
    const s = await import('./sellos');
    await s.iniciar();
    await s.huella('celula', 'ABC123');
    expect(s.porCelebrar()?.id).toBe('celula');
    const entradas = s.partirSellos(await guardado());
    expect(entradas).toEqual({ 'h.celula:abc123': '2026-10-21', 'g.celula': '2026-10-21' });
    const otro = s.unirSellos(entradas, { huellas: {}, ganados: {}, iniciado: true });
    expect(otro.ganados.celula).toEqual({ fecha: '2026-10-21', visto: true });
    expect(s.porCelebrar(otro)).toBeNull();
  });
});
