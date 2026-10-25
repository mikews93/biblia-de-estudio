import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CAMINO, DIAS_ENTRE_ETAPAS, IMPORTA, type Importa, coincidencias, crisisEn, importaValido, progresoCamino } from './camino';
import { CONOCERNOS } from './circulo';

const importa = (respuestas: Record<string, string>, innegociables: string[] = [], extra: Partial<Importa> = {}) =>
  importaValido({ respuestas: { hijos: 'si', misiones: 'si', ministerio: 'abierto', estable: 'si', finanzas: 'abierto', ...respuestas }, innegociables, ...extra })!;

describe('camino de preparación', () => {
  it('las etapas van en orden, una por día como mucho', () => {
    expect(progresoCamino([], '2026-10-25')).toEqual({ hechas: 0, siguiente: 1, abierta: true, abreEl: null, completo: false });
    const una = [{ etapa: 1, fecha: '2026-10-25' }];
    expect(progresoCamino(una, '2026-10-25')).toMatchObject({ siguiente: 2, abierta: false, abreEl: '2026-10-26' });
    expect(progresoCamino(una, '2026-10-26')).toMatchObject({ siguiente: 2, abierta: true, abreEl: null });
    const todas = CAMINO.map((e) => ({ etapa: e.n, fecha: `2026-11-0${e.n}` }));
    expect(progresoCamino(todas, '2026-11-09')).toMatchObject({ completo: true, siguiente: null });
    expect(DIAS_ENTRE_ETAPAS).toBe(1);
  });

  it('cada etapa tiene pasajes y preguntas, y los pasajes existen en la RV1909', () => {
    expect(CAMINO.map((e) => e.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const pasajes = [...CAMINO.flatMap((e) => e.pasajes.map((x) => x.pasaje)), ...CONOCERNOS.map((d) => d.pasaje)];
    for (const e of CAMINO) {
      expect(e.preguntas.length).toBeGreaterThanOrEqual(3);
      expect(e.intro.length).toBeGreaterThan(0);
    }
    for (const p of pasajes) {
      const capitulo = JSON.parse(readFileSync(`public/data/text/rv1909/${p.book}/${p.chapter}.json`, 'utf8')) as [number, string][];
      for (let v = p.from; v <= p.to; v++) expect(capitulo.some(([n]) => n === v), `${p.book} ${p.chapter}:${v}`).toBe(true);
    }
    const proposito = CAMINO.find((e) => e.proposito !== undefined)!;
    expect(proposito.preguntas[proposito.proposito!]).toMatch(/propósito/);
  });

  it('«Lo que sí importa» pide todas las respuestas y limpia lo demás', () => {
    expect(importaValido({ respuestas: { hijos: 'si' } })).toBeNull();
    expect(importaValido(null)).toBeNull();
    const v = importaValido({
      respuestas: Object.fromEntries(IMPORTA.map((q) => [q.clave, 'no'])),
      // Estudio y finanzas nunca son innegociables.
      innegociables: ['hijos', 'estable', 'otra'],
      sirvo: '  Alabanza   y niños ',
      proposito: 'x'.repeat(400),
      solteria: 'si',
    });
    expect(v).toMatchObject({ innegociables: ['hijos'], sirvo: 'Alabanza y niños', solteria: false });
    expect(v!.proposito.length).toBe(300);
  });

  it('coincidencias sin porcentajes: coinciden, para conversar o no encajan', () => {
    const ana = importa({}, ['hijos']);
    const beto = importa({ misiones: 'no', estable: 'no' });
    expect(coincidencias(ana, beto)).toEqual({ coinciden: ['hijos'], conversar: ['misiones', 'ministerio', 'estudio y trabajo', 'finanzas'], choca: false });
    // Si uno no negocia algo y el otro dice lo contrario, no encajan.
    expect(coincidencias(ana, importa({ hijos: 'no' })).choca).toBe(true);
    expect(coincidencias(importa({ hijos: 'no' }), ana).choca).toBe(true);
    // «Abierto» nunca choca.
    expect(coincidencias(ana, importa({ hijos: 'abierto' })).choca).toBe(false);
    // Lo que nadie marcó como innegociable se conversa.
    expect(coincidencias(importa({ misiones: 'no' }), importa({})).choca).toBe(false);
  });

  it('reconoce palabras de crisis, con tildes', () => {
    expect(crisisEn('A veces pienso en el suicidio')).toBe('vida');
    expect(crisisEn('ya no quiero vivir así')).toBe('vida');
    expect(crisisEn('mi papá me golpeaba de niño')).toBe('abuso');
    expect(crisisEn('Un tío abusó de mí')).toBe('abuso');
    expect(crisisEn('me violó un conocido')).toBe('abuso');
    expect(crisisEn('Me costó perdonar a mi papá, pero Dios me ayudó')).toBeNull();
    expect(crisisEn('Quiero servir en misiones')).toBeNull();
  });
});
