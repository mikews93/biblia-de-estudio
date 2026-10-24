import { describe, expect, it } from 'vitest';

import { avance, guionDe, minutosPlaneados, moverAParte, rangoDe, rangoTexto, segundosDesde, soloRango } from './guion';
import type { Mensaje } from './taller';

const books = [
  { id: 'luk', name: 'Lucas', abbr: 'Lc', chapters: 24, testament: 'NT' },
  { id: 'rom', name: 'Romanos', abbr: 'Ro', chapters: 16, testament: 'NT' },
] as never;

const m = {
  id: 'msg1',
  tipo: 'sermon',
  titulo: 'El padre que corre',
  pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
  secciones: [
    { id: 'a', titulo: 'Se fue', ayuda: '', texto: 'Mis notas: ver Lucas 15:12-13', minutos: 8, paraGrupo: '' },
    { id: 'b', titulo: 'El padre corrió', ayuda: '', texto: 'Notas privadas', minutos: 10, paraGrupo: '¿Cuándo corrió Dios hacia ti?', dinamica: 'termometro' },
    { id: 'c', titulo: 'Para hoy', ayuda: '', texto: '', minutos: 0, apoyo: { cita: 'Romanos 5:8', porque: 'el amor primero' } },
  ],
} as unknown as Mensaje;

describe('guion', () => {
  it('manda solo títulos, minutos y citas: nunca las notas', () => {
    const g = guionDe(m, 'El padre que corre', books);
    expect(g).toEqual({
      mensaje: 'msg1',
      titulo: 'El padre que corre',
      partes: [
        { titulo: 'Se fue', minutos: 8, citas: ['Lucas 15:12-13'] },
        { titulo: 'El padre corrió', minutos: 10, citas: [] },
        { titulo: 'Para hoy', minutos: 0, citas: ['Romanos 5:8'] },
      ],
    });
    expect(JSON.stringify(g)).not.toContain('Notas privadas');
  });

  it('los versículos del pasaje elegido', () => {
    expect(rangoDe({ from: 11, to: 32 })).toEqual({ desde: 11, hasta: 32 });
    expect(rangoDe({ from: 16 })).toEqual({ desde: 16, hasta: 16 });
    expect(rangoDe({})).toBeNull();
    expect(rangoTexto({ desde: 11, hasta: 32 })).toBe('versículos 11 al 32');
    expect(soloRango({ desde: 16, hasta: 16 })).toBe('solo el versículo 16');
  });

  it('al llegar a una parte va a su primera cita, o al pasaje del mensaje, con su tarjeta', () => {
    // La primera parte cita Lucas 15:12-13 en las notas: se pasa ahí, sin tarjeta porque no tiene nada para el grupo.
    expect(moverAParte(m, 0, books)).toEqual({ parte: 0, libro: 'luk', capitulo: 15, rango: { desde: 12, hasta: 13 }, tarjeta: null });
    // La segunda no cita nada: vuelve al pasaje del mensaje y pone lo del grupo con los pasos de su dinámica.
    const b = moverAParte(m, 1, books);
    expect(b).toMatchObject({ parte: 1, libro: 'luk', capitulo: 15, rango: { desde: 11, hasta: 32 } });
    expect(b.tarjeta).toMatchObject({ tipo: 'parte', titulo: 'El padre corrió', texto: '¿Cuándo corrió Dios hacia ti?', minutos: 10 });
    expect(b.tarjeta?.pasos?.length).toBeGreaterThan(0);
    // La tercera va al pasaje que la apoya. La portada vuelve al pasaje del mensaje.
    expect(moverAParte(m, 2, books)).toMatchObject({ libro: 'rom', capitulo: 5, rango: { desde: 8, hasta: 8 } });
    expect(moverAParte(m, -1, books)).toMatchObject({ parte: -1, rango: { desde: 11, hasta: 32 }, tarjeta: null });
  });

  it('cuenta el tiempo y el avance del mensaje', () => {
    const now = Date.parse('2026-10-24T20:10:00Z');
    expect(segundosDesde('2026-10-24T20:00:00Z', 0, now)).toBe(600);
    // El teléfono va 5 s atrasado respecto al servidor.
    expect(segundosDesde('2026-10-24T20:00:00Z', 5000, now)).toBe(605);
    expect(segundosDesde(null)).toBe(0);
    const partes = [{ minutos: 8 }, { minutos: 10 }, { minutos: 2 }];
    expect(minutosPlaneados(partes)).toBe(20);
    expect(avance({ partes, parte: -1 } as never, 0)).toBe(0);
    // Pasaron las 8 de la primera y 5 de las 10 de la segunda: 13 de 20.
    expect(avance({ partes, parte: 1 } as never, 300)).toBeCloseTo(13 / 20);
    // Pasarse del tiempo de la parte no adelanta las siguientes.
    expect(avance({ partes, parte: 1 } as never, 3000)).toBeCloseTo(18 / 20);
  });
});
