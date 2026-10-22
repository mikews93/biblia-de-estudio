import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { SELLOS_JOVENES, abierta, barajar, claveMision, estrellas, huellasMisiones, misionDeHoy, retoPendiente, siguiente, type Registro } from './jovenes';
import { nuevosGanados, sellosPara } from './sellos';
import { RUTAS } from './jovenesRutas';

const bes: Record<string, Record<string, [number, string][]>> = JSON.parse(
  gunzipSync(readFileSync('pipeline/versions/bes.json.gz')).toString('utf8'),
);

const hecho = (fecha: string, extra: Partial<Registro> = {}): Registro => ({ fecha, ...extra });

describe('las rutas del Modo Jóvenes', () => {
  it('cada misión apunta a un pasaje que existe en el Español Sencillo, con sus preguntas dentro del pasaje', () => {
    for (const r of RUTAS) {
      expect(r.misiones).toHaveLength(6);
      expect(new Set(r.misiones.map((m) => m.id)).size).toBe(6);
      for (const m of r.misiones) {
        const verses = bes[m.book]?.[String(m.chapter)]?.map(([n]) => n) ?? [];
        expect(verses, `${r.id}.${m.id}`).toContain(m.from);
        expect(verses, `${r.id}.${m.id}`).toContain(m.to);
        for (const p of m.preguntas) {
          expect(p.v).toBeGreaterThanOrEqual(m.from);
          expect(p.v).toBeLessThanOrEqual(m.to);
          expect(new Set(p.opciones).size).toBe(3);
        }
      }
    }
  });
});

describe('estrellas y orden de las misiones', () => {
  it('una estrella por entender, otra por escribir y otra por vivir el reto', () => {
    expect(estrellas(undefined)).toBe(0);
    expect(estrellas(hecho('2026-10-20'))).toBe(1);
    expect(estrellas(hecho('2026-10-20', { respuesta: '   ' }))).toBe(1);
    expect(estrellas(hecho('2026-10-20', { respuesta: 'Pienso que…' }))).toBe(2);
    expect(estrellas(hecho('2026-10-20', { respuesta: 'Sí', hecho: '2026-10-22' }))).toBe(3);
  });

  it('las misiones de una ruta se abren en orden', () => {
    const jesus = RUTAS[0];
    const s = { [claveMision('jesus', 'redes')]: hecho('2026-10-20') };
    expect(siguiente(jesus, s)).toBe(1);
    expect(abierta(jesus, 1, s)).toBe(true);
    expect(abierta(jesus, 2, s)).toBe(false);
  });

  it('la misión de hoy sigue la última ruta en que se avanzó', () => {
    expect(misionDeHoy({})?.mision.id).toBe('redes');
    const s = {
      [claveMision('jesus', 'redes')]: hecho('2026-10-18'),
      [claveMision('paz', 'aves')]: hecho('2026-10-20'),
    };
    const hoy = misionDeHoy(s)!;
    expect([hoy.ruta.id, hoy.mision.id]).toEqual(['paz', 'filipenses']);
  });

  it('al terminar una ruta propone la primera ruta con misiones pendientes', () => {
    const s = Object.fromEntries(RUTAS[1].misiones.map((m) => [claveMision('identidad', m.id), hecho('2026-10-20')]));
    expect(misionDeHoy(s)?.ruta.id).toBe('jesus');
  });

  it('recuerda el reto de la semana hasta que se vive o pasan siete días', () => {
    const s = { [claveMision('jesus', 'techo')]: hecho('2026-10-15') };
    expect(retoPendiente(s, '2026-10-21')?.mision.id).toBe('techo');
    expect(retoPendiente(s, '2026-10-22')).toBeNull();
    expect(retoPendiente({ [claveMision('jesus', 'techo')]: hecho('2026-10-20', { hecho: '2026-10-21' }) }, '2026-10-21')).toBeNull();
  });
});

describe('sellos en el álbum de la app', () => {
  // Lo que se ganaría con las huellas que dejan las misiones hechas.
  const ganaria = (s: Record<string, Registro>) => {
    const huellas: Record<string, string> = {};
    for (const [tipo, ids] of Object.entries(huellasMisiones(s))) for (const id of ids) huellas[`${tipo}:${id.toLowerCase()}`] = '2026-10-21';
    return nuevosGanados({ huellas, ganados: {}, iniciado: true }, SELLOS_JOVENES).map((x) => x.id);
  };

  it('son del público «jovenes»: no aparecen en la app para todos', () => {
    expect(sellosPara('todos').some((x) => x.id.startsWith('jovenes-'))).toBe(false);
    expect(sellosPara('jovenes').filter((x) => x.id.startsWith('jovenes-'))).toHaveLength(SELLOS_JOVENES.length);
  });

  it('el primer paso llega con la primera misión', () => {
    expect(ganaria({ [claveMision('jesus', 'redes')]: hecho('2026-10-21') })).toEqual(['jovenes-primera']);
  });

  it('el sello de una ruta se gana al terminar sus seis misiones', () => {
    const casi = Object.fromEntries(RUTAS[2].misiones.slice(0, 5).map((m) => [claveMision('valientes', m.id), hecho('2026-10-20')]));
    expect(ganaria(casi)).not.toContain('jovenes-ruta-valientes');
    expect(ganaria({ ...casi, [claveMision('valientes', 'leones')]: hecho('2026-10-21') })).toContain('jovenes-ruta-valientes');
  });

  it('«Sobre la roca» pide cinco misiones con sus tres estrellas', () => {
    const tres = (n: number) =>
      Object.fromEntries(RUTAS[0].misiones.slice(0, n).map((m) => [claveMision('jesus', m.id), hecho('2026-10-20', { respuesta: 'Sí', hecho: '2026-10-21' })]));
    expect(ganaria(tres(4))).not.toContain('jovenes-profundo');
    expect(ganaria(tres(5))).toContain('jovenes-profundo');
  });

  it('con todo hecho se ganan todos los sellos de las misiones', () => {
    const todo = Object.fromEntries(RUTAS.flatMap((r) => r.misiones.map((m) => [claveMision(r.id, m.id), hecho('2026-10-20', { respuesta: 'Sí', hecho: '2026-10-21' })])));
    expect(ganaria(todo).sort()).toEqual(SELLOS_JOVENES.map((x) => x.id).sort());
  });
});

describe('barajar', () => {
  it('siempre igual para la misma semilla y sin perder opciones', () => {
    const a = barajar(['a', 'b', 'c'], 'jesus.redes.0');
    expect(barajar(['a', 'b', 'c'], 'jesus.redes.0')).toEqual(a);
    expect(a.map((x) => x.item).sort()).toEqual(['a', 'b', 'c']);
  });

  it('la correcta no queda siempre en el mismo lugar', () => {
    const lugares = new Set(RUTAS.flatMap((r) => r.misiones.flatMap((m, i) => m.preguntas.map((p, j) => barajar(p.opciones, `${r.id}.${m.id}.${j}`).findIndex((x) => x.original === 0)))));
    expect(lugares.size).toBe(3);
  });
});
