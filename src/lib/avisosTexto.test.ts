import { describe, expect, it } from 'vitest';

import { dailyMessage, EstadoAvisos, horaLabel, isDue, localNow, validZone } from './avisosTexto';

const all = { lectura: true, tarjetas: true, reto: true };
const HOY = '2026-12-03';

describe('dailyMessage', () => {
  it('sin leer hoy: la lectura que toca, con las tarjetas pendientes', () => {
    const estado: EstadoAvisos = {
      leido: '2026-12-02',
      lectura: { titulo: 'Juan 4', url: '/juan/4' },
      tarjetas: ['2026-11-30', '2026-12-03', '2026-12-09'],
    };
    expect(dailyMessage(estado, all, HOY)).toEqual({
      title: 'Tu lectura de hoy',
      body: 'Juan 4 te espera. También tienes 2 tarjetas para repasar.',
      url: '/juan/4',
      tag: 'diario',
    });
  });

  it('sin nada guardado aún: una invitación a abrir la Biblia', () => {
    expect(dailyMessage({}, all, HOY)).toMatchObject({ body: 'Unos minutos con la Palabra hacen bien al alma. ¿Abrimos la Biblia?', url: '/' });
  });

  it('el día del desafío va primero, con su título y su lectura', () => {
    const estado: EstadoAvisos = {
      reto: {
        titulo: 'Adviento',
        icono: '🕯',
        url: '/planes/adviento',
        dias: [
          { fecha: '2026-12-03', dia: 5, titulo: 'El ángel visita a María', lectura: 'Lucas 1' },
          { fecha: '2026-12-04', dia: 6, lectura: 'Lucas 2' },
        ],
      },
      tarjetas: ['2026-12-01'],
    };
    expect(dailyMessage(estado, all, HOY)).toEqual({
      title: '🕯 Adviento · Día 5',
      body: '«El ángel visita a María». Hoy toca Lucas 1. Y tienes 1 tarjeta para repasar.',
      url: '/planes/adviento',
      tag: 'diario',
    });
  });

  it('si ya leyó, solo las tarjetas; y si no hay nada, no escribe', () => {
    expect(dailyMessage({ leido: HOY, tarjetas: ['2026-12-03'] }, all, HOY)).toEqual({
      title: 'Repaso de hoy',
      body: '1 tarjeta te espera para no olvidar lo que estudiaste.',
      url: '/repaso',
      tag: 'diario',
    });
    expect(dailyMessage({ leido: HOY, tarjetas: ['2026-12-05'] }, all, HOY)).toBeNull();
  });

  it('respeta lo que la persona apagó', () => {
    const estado: EstadoAvisos = {
      tarjetas: ['2026-12-01'],
      reto: { titulo: 'Adviento', url: '/planes/adviento', dias: [{ fecha: HOY, dia: 5 }] },
    };
    expect(dailyMessage(estado, { lectura: false, tarjetas: false, reto: false }, HOY)).toBeNull();
    expect(dailyMessage(estado, { lectura: true, tarjetas: false, reto: false }, HOY)?.title).toBe('Tu lectura de hoy');
    expect(dailyMessage(estado, { lectura: false, tarjetas: false, reto: true }, HOY)?.body).toBe('Hoy hay lectura nueva.');
  });
});

describe('hora local', () => {
  const instant = new Date('2026-12-03T13:45:00Z');

  it('fecha y minuto en la zona de la persona', () => {
    expect(localNow('America/Bogota', instant)).toEqual({ fecha: '2026-12-03', minutos: 8 * 60 + 45 });
    expect(localNow('Asia/Tokyo', instant)).toEqual({ fecha: '2026-12-03', minutos: 22 * 60 + 45 });
    expect(localNow('Pacific/Honolulu', new Date('2026-12-03T05:00:00Z'))).toEqual({ fecha: '2026-12-02', minutos: 19 * 60 });
    expect(localNow('Zona/Inventada', instant)).toEqual({ fecha: '2026-12-03', minutos: 13 * 60 + 45 });
  });

  it('valida zonas', () => {
    expect(validZone('America/Mexico_City')).toBe(true);
    expect(validZone('Zona/Inventada')).toBe(false);
    expect(validZone('')).toBe(false);
    expect(validZone(5)).toBe(false);
  });

  it('toca cuando pasó la hora elegida, una vez al día y sin llegar horas tarde', () => {
    const s = { zona: 'America/Bogota', hora: 8 * 60 + 30, enviado: null };
    expect(isDue(s, instant)).toEqual({ due: true, fecha: '2026-12-03' });
    expect(isDue({ ...s, enviado: '2026-12-03' }, instant).due).toBe(false);
    expect(isDue({ ...s, enviado: '2026-12-02' }, instant).due).toBe(true);
    expect(isDue({ ...s, hora: 9 * 60 }, instant).due).toBe(false);
    expect(isDue({ ...s, hora: 4 * 60 }, instant).due).toBe(false);
  });
});

it('horaLabel lo dice como la gente', () => {
  expect(horaLabel(450)).toEqual({ hora: '7:30', parte: 'de la mañana' });
  expect(horaLabel(750)).toEqual({ hora: '12:30', parte: 'de la tarde' });
  expect(horaLabel(21 * 60)).toEqual({ hora: '9:00', parte: 'de la noche' });
  expect(horaLabel(0)).toEqual({ hora: '12:00', parte: 'de la madrugada' });
});
