import { describe, expect, it } from 'vitest';

import { minutes, parseScript } from './podcast';

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
