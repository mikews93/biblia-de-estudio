import { describe, expect, it } from 'vitest';

import { describeMorph } from './morph';

describe('describeMorph: griego (Robinson)', () => {
  it('verbos con persona y número', () => {
    expect(describeMorph('V-PAI-3S')).toBe('verbo: presente, activa, indicativo, 3.ª persona, singular');
    expect(describeMorph('V-AAM-2P')).toBe('verbo: aoristo, activa, imperativo, 2.ª persona, plural');
  });

  it('aoristo segundo y participios con caso, número y género', () => {
    expect(describeMorph('V-2AAP-NSM')).toBe('verbo: aoristo segundo, activa, participio, nominativo, singular, masculino');
    expect(describeMorph('V-PAN')).toBe('verbo: presente, activa, infinitivo');
  });

  it('sustantivos, artículos y pronombres', () => {
    expect(describeMorph('N-NSF')).toBe('sustantivo: nominativo, singular, femenino');
    expect(describeMorph('T-GPM')).toBe('artículo: genitivo, plural, masculino');
    expect(describeMorph('P-1GS')).toBe('pronombre personal: 1.ª persona, genitivo, singular');
  });

  it('partes invariables, compuestas y códigos desconocidos', () => {
    expect(describeMorph('CONJ')).toBe('conjunción');
    expect(describeMorph('ADV')).toBe('adverbio');
    expect(describeMorph('CONJ + G1565=D')).toBe('conjunción');
    expect(describeMorph('ZZZ')).toBe('ZZZ');
  });
});

describe('describeMorph: hebreo y arameo (OpenScriptures)', () => {
  it('prefijos separados por barra: conjunción + artículo + sustantivo', () => {
    expect(describeMorph('HC/Td/Ncfsa')).toBe('conjunción + artículo + sustantivo: común, femenino, singular, absoluto');
  });

  it('verbos con tronco, tipo y persona', () => {
    expect(describeMorph('HVqp3ms')).toBe('verbo: qal, perfecto, 3.ª persona, masculino, singular');
    expect(describeMorph('HVhi1cp')).toBe('verbo: hifil, imperfecto, 1.ª persona, común, plural');
  });

  it('el arameo usa sus propios troncos y lo dice', () => {
    expect(describeMorph('AVqp3ms')).toBe('arameo · verbo: peal, perfecto, 3.ª persona, masculino, singular');
  });

  it('nombres propios, preposiciones y sufijos', () => {
    expect(describeMorph('HNp')).toBe('sustantivo: nombre propio');
    expect(describeMorph('HR/Ncmsc')).toBe('preposición + sustantivo: común, masculino, singular, constructo');
    expect(describeMorph('HNcmpc/Sp3ms')).toBe('sustantivo: común, masculino, plural, constructo + sufijo: pronominal, 3.ª persona, masculino, singular');
  });

  it('no toma por hebreo los códigos griegos que empiezan por A o H', () => {
    expect(describeMorph('A-NSM')).toBe('adjetivo: nominativo, singular, masculino');
    expect(describeMorph('HEB')).toBe('palabra hebrea');
    expect(describeMorph('ARAM')).toBe('palabra aramea');
  });
});
