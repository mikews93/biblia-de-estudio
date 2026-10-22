import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { PALABRAS, TEMAS, palabraDeLaSemana, palabraDeStrong, palabraPorId, partirRelato, primeraReferencia, recorrido, unirApariciones } from './palabras';

const DATA = path.resolve(import.meta.dirname, '../../public/data');

describe('catálogo', () => {
  it('cada tema tiene una palabra hebrea y una griega, y los ids no se repiten', () => {
    for (const t of TEMAS) expect(t.palabras.map((p) => p.strongs[0][0]).sort()).toEqual(['G', 'H']);
    expect(new Set(PALABRAS.map((p) => p.id)).size).toBe(PALABRAS.length);
    expect(palabraPorId('jesed')?.pareja?.id).toBe('eleos');
    expect(palabraPorId('ELEOS')?.hebreo).toBe(false);
    expect(palabraDeStrong('G0025')?.id).toBe('agape');
    expect(palabraDeStrong('G9999')).toBeNull();
  });

  it.skipIf(!existsSync(path.join(DATA, 'concordance')))('cada número de Strong existe en la concordancia', () => {
    for (const p of PALABRAS) for (const s of p.strongs) expect(existsSync(path.join(DATA, 'concordance', `${s}.json`)), `${p.id} ${s}`).toBe(true);
  });

  it('la palabra de la semana es la misma de lunes a domingo y cambia el lunes', () => {
    const lunes = palabraDeLaSemana(new Date(2026, 9, 19));
    expect(palabraDeLaSemana(new Date(2026, 9, 25))).toBe(lunes);
    expect(palabraDeLaSemana(new Date(2026, 9, 26))).not.toBe(lunes);
  });
});

describe('apariciones', () => {
  const books = [
    { id: 'gen', testament: 'AT' as const },
    { id: 'rut', testament: 'AT' as const },
    { id: 'jhn', testament: 'NT' as const },
  ];
  it('une varias concordancias en el orden de la Biblia y cuenta por libro', () => {
    const order = new Map(books.map((b, i) => [b.id, i]));
    const uses = unirApariciones(
      [
        [['rut.2.20', 'a', 'x']],
        [['gen.24.27', 'b', 'y'], ['rut.1.8', 'c', 'z']],
      ],
      order,
    );
    expect(uses.map((u) => u[0])).toEqual(['gen.24.27', 'rut.1.8', 'rut.2.20']);
    expect(recorrido(uses, books)).toEqual([
      { id: 'gen', count: 1, at: true },
      { id: 'rut', count: 2, at: true },
      { id: 'jhn', count: 0, at: false },
    ]);
  });
});

describe('relato', () => {
  const text =
    '## Qué significa\nBondad leal ⟦1⟧.\n\n## Una oración respondida\nEl siervo ⟦2⟧⟦3⟧.\n\n## Nuevas cada mañana\nNo somos consumidos.\n\n## El hilo\nLealtad.\n\n## Para pensar\n- ¿Primera?\n- ¿Segunda?';
  it('separa qué significa, los momentos, el hilo y las preguntas', () => {
    const r = partirRelato(text);
    expect(r.significado).toBe('Bondad leal ⟦1⟧.');
    expect(r.momentos.map((m) => m.titulo)).toEqual(['Una oración respondida', 'Nuevas cada mañana']);
    expect(r.hilo).toBe('Lealtad.');
    expect(r.preguntas).toEqual(['¿Primera?', '¿Segunda?']);
  });

  it('el pasaje de un momento es su primera cita a un versículo, no al léxico', () => {
    const sources = [
      { n: 2, label: 'Léxico de STEPBible: חֶסֶד (H2617A)' },
      { n: 3, label: 'Génesis 24:27', ref: 'gen.24.27' },
    ];
    expect(primeraReferencia('El siervo ⟦2⟧⟦3⟧.', sources)?.ref).toBe('gen.24.27');
    expect(primeraReferencia('Sin citas.', sources)).toBeNull();
  });
});
