import { describe, expect, it } from 'vitest';

import { FilaAgenda, proximoAviso } from './avisosAgenda';

const base: FilaAgenda = {
  zona: 'America/Bogota',
  hora: 7 * 60,
  lectura: true,
  tarjetas: false,
  reto: false,
  racha: false,
  estado: null,
  enviado: null,
  racha_enviado: null,
  despertar: null,
  despertar_dias: 127,
  despertar_enviado: null,
  pospuesto: null,
  silencio_desde: null,
  silencio_hasta: null,
};

// 2026-11-13 05:00 en Bogotá (UTC-5) = 10:00 UTC.
const ahora = new Date('2026-11-13T10:00:20Z');
const tresHoras = ahora.getTime() + 3 * 3600_000;

describe('proximoAviso', () => {
  it('encuentra el minuto del recordatorio diario', () => {
    expect(new Date(proximoAviso([base], ahora, tresHoras)).toISOString()).toBe('2026-11-13T12:00:00.000Z');
  });

  it('si ya se envió hoy, no toca nada hasta el límite', () => {
    expect(proximoAviso([{ ...base, hora: 5 * 60, enviado: '2026-11-13' }], ahora, tresHoras)).toBe(tresHoras);
  });

  it('el despertador y el «10 minutos más»', () => {
    const despertar = { ...base, lectura: false, despertar: 5 * 60 + 30 };
    expect(new Date(proximoAviso([despertar], ahora, tresHoras)).toISOString()).toBe('2026-11-13T10:30:00.000Z');
    const pospuesto = { ...base, lectura: false, pospuesto: new Date('2026-11-13T10:09:30Z') };
    expect(new Date(proximoAviso([pospuesto], ahora, tresHoras)).toISOString()).toBe('2026-11-13T10:10:00.000Z');
  });

  it('el despertador no suena en días no elegidos', () => {
    // 2026-11-13 es viernes; solo domingo (bit 0).
    const despertar = { ...base, lectura: false, despertar: 5 * 60 + 30, despertar_dias: 1 };
    expect(proximoAviso([despertar], ahora, tresHoras)).toBe(tresHoras);
  });

  it('cientos de suscripciones se revisan rápido', () => {
    const muchas = Array.from({ length: 500 }, (_, i) => ({ ...base, zona: i % 2 ? 'America/Bogota' : 'Europe/Madrid', hora: 23 * 60 }));
    const t0 = performance.now();
    proximoAviso(muchas, ahora, tresHoras);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
