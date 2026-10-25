import { describe, expect, it } from 'vitest';

import { calcularRacha, rachaDue, rachaMessage, rachaParaAvisos, siguienteHito, sumarDias } from './rachaTexto';

const HOY = '2026-10-25';
/** Los últimos n días hasta `hasta` (incluido). */
const seguidos = (n: number, hasta = HOY) => Array.from({ length: n }, (_, i) => sumarDias(hasta, -i));

describe('racha devocional', () => {
  it('sin devocionales no hay racha', () => {
    expect(calcularRacha([], HOY)).toMatchObject({ actual: 0, mejor: 0, estado: 'sin', vence: null });
  });

  it('cuenta los días seguidos hasta hoy', () => {
    const r = calcularRacha(seguidos(5), HOY);
    expect(r).toMatchObject({ actual: 5, mejor: 5, hoyHecho: true, estado: 'hecha', descansoDisponible: true });
    // Hecha hoy y con el día libre disponible: mañana puede descansar, pasado mañana es el último día.
    expect(r.vence).toBe('2026-10-27');
  });

  it('hoy aún no: la racha sigue viva y hoy puede ser el día libre', () => {
    const r = calcularRacha(seguidos(4, '2026-10-24'), HOY);
    expect(r).toMatchObject({ actual: 4, hoyHecho: false, estado: 'libre', vence: '2026-10-26' });
  });

  it('un día sin devocional se perdona una vez por semana', () => {
    // 20, 21, (22 libre), 23, 24, 25
    const r = calcularRacha(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24', HOY], HOY);
    expect(r).toMatchObject({ actual: 5, descansos: ['2026-10-22'], descansoDisponible: false, vence: '2026-10-26' });
  });

  it('el día libre usado ayer deja hoy como último día', () => {
    const r = calcularRacha(['2026-10-22', '2026-10-23'], HOY);
    expect(r).toMatchObject({ actual: 2, estado: 'riesgo', vence: HOY, descansos: ['2026-10-24'] });
  });

  it('dos días sin devocional la reinician, pero queda la mejor', () => {
    const r = calcularRacha(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-21', '2026-10-22'], '2026-10-22');
    expect(r).toMatchObject({ actual: 2, mejor: 4 });
  });

  it('dos días libres en menos de una semana rompen la racha', () => {
    // 18, (19 libre), 20, 21, (22: ya no hay día libre) → se reinicia; 23 empieza de nuevo
    const r = calcularRacha(['2026-10-18', '2026-10-20', '2026-10-21', '2026-10-23'], '2026-10-23');
    expect(r).toMatchObject({ actual: 1, mejor: 3 });
  });

  it('después de siete días vuelve el día libre', () => {
    const dias = ['2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-20'];
    expect(calcularRacha(dias, '2026-10-20')).toMatchObject({ actual: 9, descansos: ['2026-10-11', '2026-10-19'] });
  });

  it('ignora repetidos, fechas futuras y basura', () => {
    expect(calcularRacha([HOY, HOY, '2026-10-24', '2026-11-30', 'x'], HOY)).toMatchObject({ actual: 2 });
  });

  it('las metas: 3, 7, 21, 40, 100, 365', () => {
    expect([0, 3, 6, 21, 99, 365].map(siguienteHito)).toEqual([3, 7, 7, 40, 100, null]);
  });
});

describe('aviso para no perder la racha', () => {
  const r = { dias: 6, vence: HOY };

  it('se manda la noche del último día, una sola vez', () => {
    expect(rachaDue(r, { fecha: HOY, minutos: 20 * 60 + 5 }, null)).toBe(true);
    expect(rachaDue(r, { fecha: HOY, minutos: 19 * 60 }, null)).toBe(false);
    expect(rachaDue(r, { fecha: HOY, minutos: 20 * 60 + 5 }, HOY)).toBe(false);
    expect(rachaDue(r, { fecha: '2026-10-24', minutos: 21 * 60 }, null)).toBe(false);
    expect(rachaDue({ dias: 1, vence: HOY }, { fecha: HOY, minutos: 21 * 60 }, null)).toBe(false);
  });

  it('solo desde dos días de racha', () => {
    expect(rachaParaAvisos(calcularRacha([HOY], HOY))).toBeUndefined();
    expect(rachaParaAvisos(calcularRacha(seguidos(3), HOY))).toEqual({ dias: 3, vence: '2026-10-27' });
  });

  it('dice cuántos días lleva y si está cerca de una meta', () => {
    const a = rachaMessage(6);
    expect(a.title).toBe('Tu racha de 6 días te espera');
    expect(a.body).toContain('Te falta un día para los 7');
    expect(a.url).toBe('/diario?hoy=1');
    expect(rachaMessage(10).body).not.toContain('falta');
  });
});
