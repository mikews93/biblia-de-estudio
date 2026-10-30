import { describe, expect, it } from 'vitest';

import { Contexto, invitacionDeHoy } from './sembrarTexto';

const base: Contexto = {
  hoy: '2027-03-10',
  desde: '2026-11-01',
  abierto: true,
  tranquila: false,
  mesCubierto: false,
  terminados: [{ title: 'Juan en 21 días', finished: '2027-03-08' }],
  chaptersRead: 40,
};

describe('invitar a sembrar sin presión', () => {
  it('invita después de terminar un plan', () => {
    const inv = invitacionDeHoy(base);
    expect(inv?.momento).toBe('plan');
    expect(inv?.titulo).toContain('Juan en 21 días');
    expect(inv?.texto).toContain('es tuya igual');
  });

  it('el plan cuenta solo durante una semana', () => {
    expect(invitacionDeHoy({ ...base, hoy: '2027-03-20' })).toBeNull();
  });

  it('nunca a quien ya aporta, con lectura tranquila, en las tiendas o con el mes cubierto', () => {
    expect(invitacionDeHoy({ ...base, aporta: true })).toBeNull();
    expect(invitacionDeHoy({ ...base, tranquila: true })).toBeNull();
    expect(invitacionDeHoy({ ...base, abierto: false })).toBeNull();
    expect(invitacionDeHoy({ ...base, mesCubierto: true })).toBeNull();
  });

  it('no invita a quien llegó hace menos de un mes', () => {
    expect(invitacionDeHoy({ ...base, desde: '2027-02-20' })).toBeNull();
    expect(invitacionDeHoy({ ...base, desde: undefined })).toBeNull();
  });

  it('después de responder, espera un año', () => {
    expect(invitacionDeHoy({ ...base, respondida: '2026-12-01' })).toBeNull();
    expect(invitacionDeHoy({ ...base, respondida: '2026-03-01' })?.momento).toBe('plan');
  });

  it('al cumplir un año, y en diciembre si ya leyó algo', () => {
    expect(invitacionDeHoy({ ...base, terminados: [], desde: '2026-02-01' })?.momento).toBe('aniversario');
    expect(invitacionDeHoy({ ...base, terminados: [], hoy: '2026-12-15' })?.momento).toBe('diciembre');
    expect(invitacionDeHoy({ ...base, terminados: [], hoy: '2026-12-15', chaptersRead: 3 })).toBeNull();
    expect(invitacionDeHoy({ ...base, terminados: [] })).toBeNull();
  });
});
