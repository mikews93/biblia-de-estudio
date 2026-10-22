import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { barajar } from './jovenes';
import {
  SELLOS_NINOS,
  charlaPendiente,
  estrellasHistoria,
  historiaAbierta,
  huellasNinos,
  preguntaAdulto,
  siguienteHistoria,
  totalEstrellas,
  versoDeLaSemana,
  type RegistroHistoria,
} from './ninos';
import { HISTORIAS, MEMORIA, trozos } from './ninosHistorias';
import { nuevosGanados, sellosPara } from './sellos';

const bes: Record<string, Record<string, [number, string][]>> = JSON.parse(
  gunzipSync(readFileSync('pipeline/versions/bes.json.gz')).toString('utf8'),
);
const texto = (book: string, chapter: number, verse: number) => bes[book]?.[String(chapter)]?.find(([n]) => n === verse)?.[1];

type Estado = { historias: Record<string, RegistroHistoria>; memoria: Record<string, string> };
const estado = (historias: Record<string, RegistroHistoria> = {}, memoria: Record<string, string> = {}): Estado => ({ historias, memoria });

describe('las historias del Espacio Niños', () => {
  it('son doce, con ilustración propia y versículos que existen en el Español Sencillo', () => {
    expect(HISTORIAS).toHaveLength(12);
    expect(new Set(HISTORIAS.map((h) => h.id)).size).toBe(12);
    for (const h of HISTORIAS) {
      for (const v of h.versos) expect(texto(h.book, h.chapter, v), `${h.id} ${v}`).toBeTruthy();
      expect([...h.versos].sort((a, b) => a - b)).toEqual(h.versos);
    }
  });

  it('cada pregunta tiene su respuesta en un versículo que se escucha, y dos opciones distintas', () => {
    for (const h of HISTORIAS) {
      for (const p of h.preguntas) {
        expect(h.versos, `${h.id}: ${p.q}`).toContain(p.v);
        expect(p.opciones[0].t).not.toBe(p.opciones[1].t);
        expect(p.opciones.every((o) => o.e && o.t)).toBe(true);
      }
    }
  });

  it('la opción correcta no queda siempre del mismo lado', () => {
    const lados = HISTORIAS.flatMap((h) => h.preguntas.map((p, i) => barajar(p.opciones, `${h.id}.${i}`).findIndex((x) => x.original === 0)));
    expect(new Set(lados).size).toBe(2);
  });
});

describe('estrellas y camino', () => {
  it('dos estrellas al escuchar y responder, la tercera al conversar en familia', () => {
    expect(estrellasHistoria(undefined)).toBe(0);
    expect(estrellasHistoria({ fecha: '2026-10-22' })).toBe(2);
    expect(estrellasHistoria({ fecha: '2026-10-22', familia: '2026-10-22' })).toBe(3);
    expect(totalEstrellas(estado({ creacion: { fecha: '2026-10-21', familia: '2026-10-21' }, arcoiris: { fecha: '2026-10-22' } }))).toBe(5);
  });

  it('las historias se abren en orden', () => {
    const s = estado({ creacion: { fecha: '2026-10-22' } });
    expect(siguienteHistoria(estado())).toBe(0);
    expect(siguienteHistoria(s)).toBe(1);
    expect(historiaAbierta(1, s)).toBe(true);
    expect(historiaAbierta(2, s)).toBe(false);
    expect(siguienteHistoria(estado(Object.fromEntries(HISTORIAS.map((h) => [h.id, { fecha: '2026-10-22' }]))))).toBeNull();
  });

  it('recuerda la charla en familia durante una semana', () => {
    const s = estado({ david: { fecha: '2026-10-15' } });
    expect(charlaPendiente(s, '2026-10-21')?.id).toBe('david');
    expect(charlaPendiente(s, '2026-10-22')).toBeNull();
    expect(charlaPendiente(estado({ david: { fecha: '2026-10-21', familia: '2026-10-21' } }), '2026-10-21')).toBeNull();
  });
});

describe('versículos de memoria', () => {
  it('cada uno es el texto del Español Sencillo', () => {
    const limpia = (t: string) => t.toLowerCase().replace(/[^a-záéíóúñü ]/g, '');
    for (const m of MEMORIA) expect(limpia(m.texto), m.id).toBe(limpia(texto(m.book, m.chapter, m.verse)!));
  });

  it('se parten en trozos cortos que, juntos, dicen el versículo entero', () => {
    for (const m of MEMORIA) {
      const t = trozos(m.texto);
      expect(t.join(' ')).toBe(m.texto);
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(t.every((x) => x.length <= 26)).toBe(true);
    }
  });

  it('cambia cada lunes y da la vuelta a la lista', () => {
    expect(versoDeLaSemana('2026-01-05').id).toBe(MEMORIA[0].id);
    expect(versoDeLaSemana('2026-01-11').id).toBe(MEMORIA[0].id);
    expect(versoDeLaSemana('2026-01-12').id).toBe(MEMORIA[1].id);
    expect(versoDeLaSemana('2026-03-02').id).toBe(MEMORIA[0].id);
  });
});

describe('sellos del Espacio Niños', () => {
  const ganaria = (s: Estado) => {
    const huellas: Record<string, string> = {};
    for (const [tipo, ids] of Object.entries(huellasNinos(s))) for (const id of ids) huellas[`${tipo}:${id.toLowerCase()}`] = '2026-10-22';
    return nuevosGanados({ huellas, ganados: {}, iniciado: true }, SELLOS_NINOS).map((x) => x.id);
  };

  it('son del público «ninos»: no aparecen para todos ni en el Modo Jóvenes', () => {
    expect(sellosPara('todos').some((x) => x.id.startsWith('ninos-'))).toBe(false);
    expect(sellosPara('jovenes').some((x) => x.id.startsWith('ninos-'))).toBe(false);
    expect(sellosPara('ninos').filter((x) => x.publico === 'ninos')).toHaveLength(SELLOS_NINOS.length);
  });

  it('la primera historia, la familia y los versículos', () => {
    expect(ganaria(estado({ creacion: { fecha: '2026-10-22' } }))).toEqual(['ninos-primera']);
    const tres = estado(Object.fromEntries(HISTORIAS.slice(0, 3).map((h) => [h.id, { fecha: '2026-10-21', familia: '2026-10-22' }])));
    expect(ganaria(tres)).toContain('ninos-familia');
    expect(ganaria(estado({}, { pastor: '2026-10-22' }))).toEqual(['ninos-verso']);
  });

  it('con todo hecho se ganan los seis', () => {
    const todo = estado(
      Object.fromEntries(HISTORIAS.map((h) => [h.id, { fecha: '2026-10-21', familia: '2026-10-22' }])),
      Object.fromEntries(MEMORIA.map((m) => [m.id, '2026-10-22'])),
    );
    expect(ganaria(todo).sort()).toEqual(SELLOS_NINOS.map((x) => x.id).sort());
  });
});

it('la pregunta de adultos es una multiplicación de dos cifras', () => {
  for (const semilla of [0, 1, 7, 99, 1234567]) {
    const { q, r } = preguntaAdulto(semilla);
    const [a, b] = q.match(/\d+/g)!.map(Number);
    expect(a * b).toBe(r);
    expect(r).toBeGreaterThanOrEqual(42);
  }
});
