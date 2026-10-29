import { describe, expect, it, vi } from 'vitest';

import { elegirAuto, minutes, parseScript } from './podcast';
import { ordenar } from './voces';
import { lineStarts } from './podcastTiempos';

describe('parseScript', () => {
  it('reparte las intervenciones de ANA y TOMÁS, con o sin acento y en cualquier caja', () => {
    const lines = parseScript('ANA: Empieza con una sorpresa.\nTOMÁS: Sí.\nTomas: Sin acento.\nana: en minúscula');
    expect(lines.map((l) => [l.speaker, l.text])).toEqual([
      ['ana', 'Empieza con una sorpresa.'],
      ['tomas', 'Sí.'],
      ['tomas', 'Sin acento.'],
      ['ana', 'en minúscula'],
    ]);
  });

  it('una línea sin nombre continúa la anterior y las marcas de cita sueltas se le suman', () => {
    const lines = parseScript('**ANA:** El versículo dieciséis ⟦1⟧\nlo resume todo ⟦2⟧.\n⟦2⟧⟦3⟧\nTOMÁS: Exacto.');
    expect(lines).toEqual([
      { speaker: 'ana', text: 'El versículo dieciséis lo resume todo.', cites: [1, 2, 3] },
      { speaker: 'tomas', text: 'Exacto.', cites: [] },
    ]);
  });

  it('descarta lo que viene antes del primer nombre y las intervenciones vacías', () => {
    expect(parseScript('Guion del pódcast\n\nANA:\nTOMÁS: Hola')).toEqual([{ speaker: 'tomas', text: 'Hola', cites: [] }]);
  });
});

describe('minutes', () => {
  it('unas 150 palabras por minuto y al menos 1', () => {
    expect(minutes([])).toBe(1);
    const line = (n: number) => ({ speaker: 'ana' as const, text: Array(n).fill('palabra').join(' '), cites: [] });
    expect(minutes([line(450), line(450)])).toBe(6);
  });
});

describe('lineStarts', () => {
  it('reparte la duración por la longitud de cada intervención', () => {
    const starts = lineStarts(['a'.repeat(82), 'b'.repeat(182), 'c'.repeat(82)], 40, 10);
    expect(starts).toEqual([10, 20, 40]);
  });
});

describe('pickVoices', () => {
  it('elige para Ana y Tomás las voces más naturales de mujer y de hombre', async () => {
    const Speech = await import('expo-speech');
    const voz = (name: string, language: string, localService = false) => ({ identifier: name, name, language, quality: 'Default', localService });
    vi.spyOn(Speech, 'getAvailableVoicesAsync').mockResolvedValue([
      voz('Microsoft Sabina Desktop - Spanish (Mexico)', 'es-MX', true),
      voz('Microsoft Jorge Desktop - Spanish (Mexico)', 'es-MX', true),
      voz('Microsoft Salome Online (Natural) - Spanish (Colombia)', 'es-CO'),
      voz('Microsoft Gonzalo Online (Natural) - Spanish (Colombia)', 'es-CO'),
    ] as never);
    const { pickVoices } = await import('./podcast');
    const v = await pickVoices();
    expect(v.ana.voice).toContain('Salome');
    expect(v.tomas.voice).toContain('Gonzalo');
  });

  it('respeta las voces que la persona eligió para Ana y Tomás', async () => {
    const { elegirVoz } = await import('./voces');
    const { pickVoices } = await import('./podcast');
    elegirVoz('ana', 'Microsoft Gonzalo Online (Natural) - Spanish (Colombia)');
    let v = await pickVoices();
    expect(v.ana.voice).toContain('Gonzalo');
    // Tomás no repite la voz de Ana
    expect(v.tomas.voice).not.toContain('Gonzalo');
    elegirVoz('tomas', 'Microsoft Jorge Desktop - Spanish (Mexico)');
    v = await pickVoices();
    expect(v.tomas.voice).toContain('Jorge');
    elegirVoz('ana', null);
    elegirVoz('tomas', null);
  });
});

describe('elegirAuto', () => {
  const voz = (id: string, language = 'es-US') => ({ identifier: id, name: id, language, quality: 'Default' as never });

  it('Ana con voz de mujer y Tomás con voz de hombre, aunque la más natural sea de hombre', () => {
    // En Android la primera de la lista es «esf», una voz de hombre: antes le tocaba a Ana
    const es = ordenar([voz('es-us-x-esf-network'), voz('es-us-x-sfb-network'), voz('es-us-x-esd-local')]);
    expect(es[0].id).toBe('es-us-x-esf-network');
    expect(elegirAuto(es)).toEqual({
      ana: { voice: 'es-us-x-sfb-network', pitch: 1 },
      tomas: { voice: 'es-us-x-esf-network', pitch: 1 },
    });
  });

  it('en Chrome de escritorio «Google español» (hombre) es Tomás', () => {
    const es = ordenar([voz('Google español', 'es-ES'), voz('Google español de Estados Unidos')]);
    expect(elegirAuto(es)).toMatchObject({ ana: { voice: 'Google español de Estados Unidos' }, tomas: { voice: 'Google español' } });
  });

  it('sin voz de hombre, Tomás usa otra voz con un tono más grave', () => {
    const es = ordenar([voz('es-us-x-sfb-network'), voz('es-us-x-esc-network')]);
    const v = elegirAuto(es);
    expect(v.ana.pitch).toBe(1);
    expect(v.tomas.pitch).toBeLessThan(1);
    expect(v.tomas.voice).not.toBe(v.ana.voice);
  });
});
