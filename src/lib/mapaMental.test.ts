import { describe, expect, it } from 'vitest';

import { parseMindMap, versesLabel } from './mapaMental';

describe('parseMindMap', () => {
  it('convierte el esquema en idea central, ramas y hojas con sus versículos', () => {
    const map = parseMindMap(
      '# El nuevo nacimiento y el amor de Dios\n- Jesús y Nicodemo (vv. 1-21)\n  - Hay que nacer otra vez (v. 3)\n  - Dios amó al mundo (v. 16)\n- Testimonio de Juan el Bautista (vv. 22-36)\n  - Él crece, yo mengüo (v. 30)',
    );
    expect(map.title).toBe('El nuevo nacimiento y el amor de Dios');
    expect(map.branches).toEqual([
      {
        text: 'Jesús y Nicodemo',
        from: 1,
        to: 21,
        cites: [],
        leaves: [
          { text: 'Hay que nacer otra vez', from: 3, to: undefined, cites: [] },
          { text: 'Dios amó al mundo', from: 16, to: undefined, cites: [] },
        ],
      },
      {
        text: 'Testimonio de Juan el Bautista',
        from: 22,
        to: 36,
        cites: [],
        leaves: [{ text: 'Él crece, yo mengüo', from: 30, to: undefined, cites: [] }],
      },
    ]);
  });

  it('acepta tabulaciones, asteriscos, negritas y viñetas •; las citas sueltas van al último nodo', () => {
    const map = parseMindMap('## **Idea**\n* Rama uno (vv. 1-3) ⟦1⟧\n\t• Hoja (v. 2) ⟦2⟧.\n⟦3⟧\n- Rama dos');
    expect(map.title).toBe('Idea');
    expect(map.branches[0]).toMatchObject({ text: 'Rama uno', from: 1, to: 3, cites: [1] });
    expect(map.branches[0].leaves[0]).toMatchObject({ text: 'Hoja', from: 2, cites: [2, 3] });
    expect(map.branches[1]).toMatchObject({ text: 'Rama dos', from: undefined, leaves: [] });
  });

  it('una hoja antes de cualquier rama se ignora; solo cuenta el primer título', () => {
    const map = parseMindMap('  - hoja huérfana\n# Primero\n# Segundo\n- Rama');
    expect(map.title).toBe('Primero');
    expect(map.branches.map((b) => b.text)).toEqual(['Rama']);
  });
});

describe('versesLabel', () => {
  it('v. o vv. según el tramo', () => {
    expect(versesLabel({ text: '', cites: [] })).toBe('');
    expect(versesLabel({ text: '', from: 3, cites: [] })).toBe('v. 3');
    expect(versesLabel({ text: '', from: 3, to: 3, cites: [] })).toBe('v. 3');
    expect(versesLabel({ text: '', from: 1, to: 8, cites: [] })).toBe('vv. 1-8');
  });
});
