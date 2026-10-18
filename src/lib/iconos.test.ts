import { describe, expect, it } from 'vitest';

import { EVENTOS, PERIODOS, RAMAS, REINOS, TRONCO, esCorriente } from './historia';
import { iconoEvento, iconoPeriodo } from './iconos';

describe('iconos de la línea de tiempo', () => {
  it('cada hecho del mundo tiene un icono propio', () => {
    expect(EVENTOS.filter((e) => iconoEvento(e) === 'punto').map((e) => e.titulo)).toEqual([]);
  });

  it('cada época con fecha tiene un icono propio', () => {
    expect(Object.values(PERIODOS).filter((p) => iconoPeriodo(p) === 'punto').map((p) => p.titulo)).toEqual([]);
  });

  it('elige por lo que cuenta', () => {
    const ev = (titulo: string) => iconoEvento(EVENTOS.find((e) => e.titulo === titulo)!);
    expect(ev('Batalla de Qarqar')).toBe('espada');
    expect(ev('Estela de Mesa')).toBe('estela');
    expect(ev('César Augusto')).toBe('corona');
    expect(ev('La Gran Pirámide de Guiza')).toBe('piramide');
    expect(iconoPeriodo(PERIODOS.salmos)).toBe('arpa');
    expect(iconoPeriodo(PERIODOS.romanos)).toBe('pluma');
    expect(iconoPeriodo(PERIODOS.viaje2)).toBe('barco');
    expect(iconoPeriodo(PERIODOS.pasion)).toBe('cruz');
  });
});

describe('ramas', () => {
  const corrientes = new Set([...REINOS, ...EVENTOS.filter(esCorriente)].map((e) => e.titulo));

  it('cada ligadura une dos reinos que existen, en orden', () => {
    const fecha = new Map([...REINOS, ...EVENTOS].map((e) => [e.titulo, e.desde]));
    for (const [a, b] of RAMAS) {
      expect(corrientes.has(a), a).toBe(true);
      expect(corrientes.has(b), b).toBe(true);
      expect(fecha.get(a)! < fecha.get(b)!, `${a} → ${b}`).toBe(true);
    }
  });

  it('el tronco va seguido de principio a fin', () => {
    const medio = TRONCO.filter((t) => t.pos === 'medio' || t.pos === 'abajo').sort((a, b) => a.desde - b.desde);
    for (let i = 1; i < medio.length; i++) expect(medio[i].desde, `${medio[i].desde}`).toBe(medio[i - 1].hasta);
  });
});
