import { describe, expect, it } from 'vitest';

import { DIAS, ENTRE_SEMANA, TODOS_LOS_DIAS, despertarDue, despertarMessage, diasLabel, weekday } from './despertarTexto';

// Sábado 24 de octubre de 2026, 6:10 en Bogotá (11:10 UTC).
const NOW = new Date('2026-10-24T11:10:00Z');
const base = { zona: 'America/Bogota', despertar: 6 * 60, despertar_dias: TODOS_LOS_DIAS, despertar_enviado: null, pospuesto: null };

describe('despertador', () => {
  it('días de la semana: lunes primero, bits como Date.getDay()', () => {
    expect(DIAS.map((d) => d.corto).join('')).toBe('LMXJVSD');
    expect(weekday('2026-10-24')).toBe(6);
    expect(weekday('2026-10-25')).toBe(0);
  });

  it('nombra los días como la gente', () => {
    expect(diasLabel(TODOS_LOS_DIAS)).toBe('Todos los días');
    expect(diasLabel(ENTRE_SEMANA)).toBe('De lunes a viernes');
    expect(diasLabel(0b1000001)).toBe('Fines de semana');
    expect(diasLabel((1 << 1) | (1 << 3) | (1 << 5))).toBe('Lunes, miércoles y viernes');
    expect(diasLabel(1 << 0)).toBe('Domingo');
  });

  it('suena a su hora, en sus días, una vez y no más de media hora tarde', () => {
    expect(despertarDue(base, NOW)).toEqual({ due: true, fecha: '2026-10-24', pospuesto: false });
    expect(despertarDue({ ...base, despertar_enviado: '2026-10-24' }, NOW).due).toBe(false);
    expect(despertarDue({ ...base, despertar_dias: ENTRE_SEMANA }, NOW).due).toBe(false);
    expect(despertarDue({ ...base, despertar: 6 * 60 + 15 }, NOW).due).toBe(false);
    expect(despertarDue({ ...base, despertar: 5 * 60 }, NOW).due).toBe(false);
    expect(despertarDue({ ...base, despertar: null }, NOW).due).toBe(false);
  });

  it('pospuesto: suena cuando pasan los minutos, aunque ya haya sonado hoy', () => {
    const s = { ...base, despertar_enviado: '2026-10-24' };
    expect(despertarDue({ ...s, pospuesto: new Date('2026-10-24T11:15:00Z') }, NOW).due).toBe(false);
    expect(despertarDue({ ...s, pospuesto: '2026-10-24T11:09:00Z' }, NOW)).toEqual({ due: true, fecha: '2026-10-24', pospuesto: true });
  });

  it('el aviso abre la pantalla de despertar', () => {
    expect(despertarMessage()).toMatchObject({ url: '/despertar?alarma=1', tag: 'despertar', alarma: true });
    expect(despertarMessage({ lectura: 'Juan 4' }).body).toContain('Juan 4');
  });
});
