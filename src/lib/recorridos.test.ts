import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Place } from './data';
import {
  JOURNEYS,
  distanceKm,
  estimateVerse,
  formatKm,
  journeyAt,
  journeysFor,
  recorridoHref,
  resolveStops,
  splitPlaces,
  stopIndexAt,
} from './recorridos';

const DATA = path.resolve(import.meta.dirname, '../../public/data');
const fromDisk = async (book: string, chapter: number): Promise<Place[]> => {
  const file = path.join(DATA, 'places', book, `${chapter}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
};

describe('recorridos', () => {
  it('cada parada se ubica: con un lugar de OpenBible de su capítulo o con coordenadas propias', async () => {
    if (!existsSync(path.join(DATA, 'places'))) return; // sin npm run data
    for (const j of JOURNEYS) {
      const stops = await resolveStops(j, [], fromDisk);
      const missing = j.stops.filter((st) => !stops.some((r) => r.chapter === st.chapter && r.verse === st.verse && r.note === st.note));
      expect(missing.map((m) => `${j.id} ${m.chapter}:${m.verse} ${m.place}`)).toEqual([]);
    }
  });

  it('las paradas van en orden de lectura', () => {
    for (const j of JOURNEYS) {
      const keys = j.stops.map((st) => st.chapter * 1000 + st.verse);
      expect(keys).toEqual([...keys].sort((a, b) => a - b));
    }
  });

  it('en Hechos 18 se pasa del segundo al tercer viaje según el versículo', () => {
    const both = journeysFor('act', 18);
    expect(both.map((j) => j.id)).toEqual(['pablo-2', 'pablo-3']);
    expect(journeyAt(both, 'act', 18, 1)?.id).toBe('pablo-2');
    expect(journeyAt(both, 'act', 18, 23)?.id).toBe('pablo-3');
  });

  it('la parada alcanzada es la última cuyo versículo ya se leyó, también desde otro capítulo', () => {
    const pablo = JOURNEYS.find((j) => j.id === 'pablo-1')!.stops;
    expect(stopIndexAt(pablo, 'act', 13, 3)).toBe(0);
    expect(stopIndexAt(pablo, 'act', 13, 6)).toBe(3);
    expect(pablo[stopIndexAt(pablo, 'act', 14, 1)].place).toBe('Iconium');
    // Tres paradas en 14:21: queda en la última
    expect(pablo[stopIndexAt(pablo, 'act', 14, 21)].place).toBe('Antioch 2');
    const galilea = JOURNEYS.find((j) => j.id === 'jesus-galilea')!.stops;
    expect(stopIndexAt(galilea, 'mrk', 1, 3)).toBe(-1);
  });

  it('resalta los nombres de lugar del versículo sin tocar palabras parecidas', () => {
    const parts = splitPlaces('Y habiendo atravesado toda la isla hasta Papho, hallaron un hombre mago', ['Papho', 'Salamina']);
    expect(parts.filter((p) => p.place).map((p) => p.text)).toEqual(['Papho']);
    expect(parts.map((p) => p.text).join('')).toBe('Y habiendo atravesado toda la isla hasta Papho, hallaron un hombre mago');
    // Sin tildes en la lista ni mayúscula en el texto: «mar» común no se marca
    const mar = splitPlaces('anduvo junto á la mar de Galilea', ['Mar de Galilea', 'Galilea']);
    expect(mar.filter((p) => p.place).map((p) => p.text)).toEqual(['Galilea']);
  });

  it('sin tiempos en el audio, reparte el capítulo según el largo de cada versículo', () => {
    const verses: [number, string][] = [
      [1, 'a'.repeat(10)],
      [2, 'b'.repeat(30)],
      [3, 'c'.repeat(60)],
    ];
    expect(estimateVerse(0.05, verses)).toBe(1);
    expect(estimateVerse(0.3, verses)).toBe(2);
    expect(estimateVerse(0.9, verses)).toBe(3);
  });

  it('distancias y enlaces', () => {
    const km = distanceKm([
      { lon: 35.2342, lat: 31.7767 }, // Jerusalén
      { lon: 35.575, lat: 32.8811 }, // Capernaum
    ]);
    expect(km).toBeGreaterThan(120);
    expect(km).toBeLessThan(130);
    expect(formatKm(87.4)).toBe('87');
    expect(formatKm(1234)).toBe('1.230');
    expect(recorridoHref('act', 13, 6)).toBe('/recorrido/hechos/13?v=6');
  });
});
