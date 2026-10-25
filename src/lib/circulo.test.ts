import { describe, expect, it } from 'vitest';

import { CONOCERNOS, SEMANAS, alertaMensaje, diaConocer, edad, fechaValida, lunes, semanaDe } from './circulo';

describe('círculo de solteros', () => {
  it('cuenta la edad cumplida', () => {
    expect(edad('2008-10-26', '2026-10-25')).toBe(17);
    expect(edad('2008-10-25', '2026-10-25')).toBe(18);
    expect(edad('2000-02-29', '2026-02-28')).toBe(25);
  });

  it('acepta solo fechas reales', () => {
    expect(fechaValida('2000-05-10')).toBe(true);
    expect(fechaValida('2001-02-29')).toBe(false);
    expect(fechaValida('10/05/2000')).toBe(false);
  });

  it('todos los días de la semana tienen la misma pregunta, y cambia el lunes', () => {
    expect(lunes('2026-10-25')).toBe('2026-10-19');
    expect(semanaDe('2026-10-19').pregunta).toBe(semanaDe('2026-10-25').pregunta);
    expect(semanaDe('2026-10-26').pregunta).not.toBe(semanaDe('2026-10-25').pregunta);
    expect(semanaDe('2026-01-05')).toMatchObject({ clave: '2026-01-05', titulo: SEMANAS[0].titulo });
    expect(semanaDe('2025-12-29').titulo).toBe(SEMANAS[SEMANAS.length - 1].titulo);
  });

  it('«Conocernos» abre un día por día cuando los dos respondieron', () => {
    expect(diaConocer([], '2026-10-25')).toEqual({ dia: 1, abierto: true, terminado: false });
    expect(diaConocer([{ dia: 1, fecha: '2026-10-25' }], '2026-10-25')).toEqual({ dia: 2, abierto: false, terminado: false });
    expect(diaConocer([{ dia: 1, fecha: '2026-10-25' }], '2026-10-26')).toEqual({ dia: 2, abierto: true, terminado: false });
    const todos = CONOCERNOS.map((_, i) => ({ dia: i + 1, fecha: `2026-11-0${i + 1}` }));
    expect(diaConocer(todos, '2026-11-09').terminado).toBe(true);
  });

  it('avisa de mensajes que piden dinero, fotos, otra app o un teléfono', () => {
    expect(alertaMensaje('¿Me prestas dinero para el pasaje?')).toBe('Habla de dinero');
    expect(alertaMensaje('Mejor escríbeme por WhatsApp')).toBe('Pide pasar a otra app');
    expect(alertaMensaje('mi número es +57 300 123 4567')).toBe('Comparte un número de teléfono');
    expect(alertaMensaje('mándame una foto tuya')).toBe('Pide fotos');
    expect(alertaMensaje('Me encantó lo que escribiste sobre Rut 1:16')).toBeNull();
  });
});
