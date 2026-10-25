import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { LINEAS_AYUDA, cordon, diaAbierto, emergencias, paisDe, progreso, telefonoBonito } from './pareja';
import { DIAS_PLAN, PLANES_PAREJA, planesPara } from './parejaPlanes';

const DATA = path.resolve(import.meta.dirname, '../../public/data');

describe('progreso', () => {
  it('empieza en el día 1, abierto', () => {
    expect(progreso({}, '2026-10-22')).toEqual({ dia: 1, abierto: true, terminado: false });
  });

  it('el día siguiente se abre al otro día de terminar el anterior', () => {
    expect(progreso({ 1: '2026-10-22' }, '2026-10-22')).toEqual({ dia: 2, abierto: false, terminado: false });
    expect(progreso({ 1: '2026-10-22' }, '2026-10-23')).toEqual({ dia: 2, abierto: true, terminado: false });
    // Sin culpa por los días que pasaron: sigue el que toca
    expect(progreso({ 1: '2026-10-01', 2: '2026-10-02' }, '2026-10-22')).toEqual({ dia: 3, abierto: true, terminado: false });
  });

  it('termina al hacer los siete días', () => {
    const hechos = Object.fromEntries(Array.from({ length: DIAS_PLAN }, (_, i) => [i + 1, `2026-10-${10 + i}`]));
    expect(progreso(hechos, '2026-10-22').terminado).toBe(true);
  });

  it('un día hecho siempre se puede volver a abrir', () => {
    const hechos = { 1: '2026-10-21', 2: '2026-10-22' };
    const p = progreso(hechos, '2026-10-22');
    expect(diaAbierto(1, p, hechos)).toBe(true);
    expect(diaAbierto(3, p, hechos)).toBe(false);
    expect(diaAbierto(4, p, hechos)).toBe(false);
  });
});

describe('cordon', () => {
  // 2026-10-19 es lunes
  const semana = (lunes: string, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(`${lunes}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });

  it('cuenta nudos y semanas con la meta', () => {
    const dias = [...semana('2026-10-05', 3), ...semana('2026-10-12', 4), ...semana('2026-10-19', 1)];
    const c = cordon(dias, '2026-10-20');
    expect(c).toEqual({ nudos: 8, semanas: 2, estaSemana: 1, gracia: false });
  });

  it('la semana en curso suma cuando llega a la meta', () => {
    expect(cordon([...semana('2026-10-12', 3), ...semana('2026-10-19', 3)], '2026-10-22').semanas).toBe(2);
  });

  it('una semana floja no rompe la racha; dos seguidas sí', () => {
    const conGracia = cordon([...semana('2026-09-28', 3), ...semana('2026-10-05', 3), ...semana('2026-10-12', 1), ...semana('2026-10-19', 3)], '2026-10-22');
    expect(conGracia.semanas).toBe(3);
    expect(conGracia.gracia).toBe(true);
    const rota = cordon([...semana('2026-09-28', 3), ...semana('2026-10-05', 1), ...semana('2026-10-12', 0), ...semana('2026-10-19', 3)], '2026-10-22');
    expect(rota.semanas).toBe(1);
  });

  it('la semana pasada floja se perdona mientras la de ahora sigue en curso', () => {
    const c = cordon([...semana('2026-10-05', 3), ...semana('2026-10-19', 1)], '2026-10-20');
    expect(c.semanas).toBe(1);
    expect(c.gracia).toBe(true);
  });

  it('sin días, todo en cero', () => {
    expect(cordon([], '2026-10-22')).toEqual({ nudos: 0, semanas: 0, estaSemana: 0, gracia: false });
  });
});

describe('planes en pareja', () => {
  it('cada plan tiene seis días y un encuentro, con pasajes de libros que existen', () => {
    const ids = new Set<string>();
    for (const plan of PLANES_PAREJA) {
      expect(ids.has(plan.id), plan.id).toBe(false);
      ids.add(plan.id);
      expect(plan.dias, plan.id).toHaveLength(DIAS_PLAN - 1);
      for (const d of [...plan.dias, plan.encuentro]) {
        const book = BOOKS.find((b) => b.id === d.pasaje.book);
        expect(book, `${plan.id}: ${d.referencia}`).toBeDefined();
        expect(d.pasaje.chapter).toBeLessThanOrEqual(book!.chapters);
        expect(d.pasaje.to).toBeGreaterThanOrEqual(d.pasaje.from);
        // La referencia que se muestra empieza con el libro y el capítulo del pasaje
        expect(d.referencia.startsWith(`${book!.name} ${d.pasaje.chapter}:${d.pasaje.from}`), d.referencia).toBe(true);
      }
    }
  });

  it.skipIf(!existsSync(path.join(DATA, 'books.json')))('los versículos existen en la RV1909', () => {
    for (const plan of PLANES_PAREJA) {
      for (const d of [...plan.dias, plan.encuentro]) {
        const verses = JSON.parse(readFileSync(path.join(DATA, 'text', 'rv1909', d.pasaje.book, `${d.pasaje.chapter}.json`), 'utf8')) as [number, string][];
        const nums = new Set(verses.map(([n]) => n));
        for (let v = d.pasaje.from; v <= d.pasaje.to; v++) expect(nums.has(v), `${d.referencia} v${v}`).toBe(true);
      }
    }
  });

  it('las adivinanzas se leen después de «¿Qué crees que va a escribir…?»', () => {
    const adivinas = PLANES_PAREJA.flatMap((p) => p.dias.map((d) => d.adivina).filter(Boolean)) as string[];
    expect(adivinas.length).toBeGreaterThan(10);
    // Empiezan en minúscula y sin punto final: la pantalla les pone mayúscula y punto
    for (const a of adivinas) expect(a, a).toMatch(/^[a-záéíóúñ].*[^.]$/);
  });

  it('novios y casados tienen planes propios y compartidos', () => {
    expect(planesPara('novios').map((p) => p.id)).toContain('antes-del-si');
    expect(planesPara('novios').map((p) => p.id)).toContain('hacia-el-hogar');
    expect(planesPara('novios').map((p) => p.id)).toContain('asi-es-el-amor');
    expect(planesPara('novios').map((p) => p.id)).not.toContain('honra');
    expect(planesPara('casados').map((p) => p.id)).toContain('honra');
    expect(planesPara('casados')[0].para).toBe('ambos');
  });
});

describe('líneas de ayuda', () => {
  it('reconoce el país del idioma del teléfono', () => {
    expect(paisDe('es-CO')).toBe('CO');
    expect(paisDe('es_MX')).toBe('MX');
    expect(paisDe('es')).toBeNull();
    expect(paisDe('fr-FR')).toBeNull();
    expect(paisDe(undefined)).toBeNull();
  });

  it('números claros y emergencias por país', () => {
    expect(telefonoBonito('18007997233')).toBe('1-800-799-7233');
    expect(telefonoBonito('08004141')).toBe('0800 4141');
    expect(telefonoBonito('08006853737')).toBe('0800 685 3737');
    expect(telefonoBonito('800102414')).toBe('800 10 2414');
    expect(telefonoBonito('155')).toBe('155');
    expect(emergencias('ES')).toBe('112');
    expect(emergencias('CO')).toBe('123');
    expect(emergencias('MX')).toBe('911');
    expect(new Set(LINEAS_AYUDA.map((l) => l.pais)).size).toBe(LINEAS_AYUDA.length);
  });
});
