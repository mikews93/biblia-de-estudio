import { describe, expect, it } from 'vitest';

import { buscarNombre, citasDeFicha, datosDe, delTramo, enlaceFicha, momentoDe } from '../../api/_personajes';

describe('personajes y lugares para la IA', () => {
  it('elige las personas del tramo y, si no se nombra ningún lugar, el escenario del capítulo', () => {
    const rows = [
      ['g2424g', 'Jesús', 'm', [1, 22, 25, 27], ['Jesús']],
      ['g2264h', 'Herodes', 'm', [1, 3], ['Herodes']],
      ['g4074g', 'Simón', 'm', [28, 29], ['Pedro']],
      ['h3672g', 'Mar de Galilea', 'l', [34], ['Genezaret']],
    ] as never;
    expect(delTramo(rows, 22, 33).map((r) => r[1])).toEqual(['Jesús', 'Simón', 'Mar de Galilea']);
  });

  it('cuenta de dónde viene una persona y su familia, en español', () => {
    const lineas = datosDe({
      id: 'h7327',
      nombre: 'Ruth',
      tipo: 'f',
      breve: 'Esposa de Mahalón',
      tribu: 'Pueblo de Moab',
      epoca: 'Antes de los reyes',
      menciones: 13,
      familia: { padres: [], hermanos: [], conyuges: [{ id: 'a', nombre: 'Mahalón' }, { id: 'b', nombre: 'Booz' }], hijos: [{ id: 'c', nombre: 'Obed' }] },
      lugares: [{ id: 'l', nombre: 'Moab', n: 6 }],
    });
    expect(lineas[0]).toBe('Ruth: Mujer, esposa de Mahalón.');
    expect(lineas[1]).toContain('Tribu o pueblo: Pueblo de Moab');
    expect(lineas[2]).toBe('Familia: cónyuge: Mahalón, Booz; hijos: Obed.');
    expect(lineas[3]).toContain('Moab (6)');
  });

  it('pasa las referencias de la ficha a citas de la app y busca por cualquiera de sus nombres', () => {
    const label = (r: string) => ({ 'jhn.1.44': 'Juan 1:44', 'luk.22.54': 'Lucas 22:54', 'luk.22.62': 'Lucas 22:62' })[r] ?? r;
    expect(citasDeFicha('from Bethsaida (⟦jhn.1.44⟧), denied (⟦luk.22.54-luk.22.62⟧)', label)).toBe('from Bethsaida (Juan 1:44), denied (Lucas 22:54-62)');
    const indice = [
      ['g4074g', 'Simón', 'm', 'Apóstol', 179, ['Cefas', 'Pedro']],
      ['g4613h', 'Simón', 'm', 'El zelote', 4, []],
      ['h1035g', 'Belén (Beth-lehem)', 'l', 'Ciudad', 53, ['Ephrata']],
    ] as never;
    expect(buscarNombre(indice, 'pedro')?.[0]).toBe('g4074g');
    expect(buscarNombre(indice, 'Simón')?.[0]).toBe('g4074g');
    expect(buscarNombre(indice, 'Belen')?.[0]).toBe('h1035g');
    expect(enlaceFicha({ id: 'h1035g', nombre: 'Belén (Beth-lehem)' })).toBe('https://zarzabiblia.com/ficha/h1035g-belen');
  });

  it('da el momento histórico del capítulo con lo que pasaba en el mundo', () => {
    const m = momentoDe('mat', 14);
    expect(m?.periodo.titulo).toBeTruthy();
    expect(m?.lineas[0]).toMatch(/^Periodo: /);
    expect(m?.lineas.some((l) => l.includes('Tiberio'))).toBe(true);
  });
});
