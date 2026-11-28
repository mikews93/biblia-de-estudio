import { describe, expect, it } from 'vitest';

import { aplicarCambios, fragmentosEnIngles } from './textoIngles';

// Trozos del guion del pódcast de 2 Reyes 2 que se grabó el 2026-11-27.
const GUION = `ANA: Un hombre que no muere, un río que se abre dos veces y un manto que cae del cielo. Todo eso pasa en un solo capítulo, Tomás: segundo de Reyes, capítulo dos.

TOMÁS: Y las tres veces Eliseo dice que no. Las notas de estudio explican que Each time, Elisha refused with a solemn vow, determined to be with his master to the end.⟦3⟧ En hebreo es un juramento: por la vida del Señor y por tu vida, no te dejaré.

TOMÁS: Los comentaristas no se ponen de acuerdo. Uno piensa que lo hacía through humility, not wishing any person to be witness of the honor conferred on him by God, or with the desire to prove the fidelity of Elisha⟦4⟧. Otro añade que quizás quería ahorrarle a Eliseo el dolor de verlo partir.`;

describe('fragmentosEnIngles', () => {
  it('encuentra las frases inglesas del guion de 2 Reyes 2, sin el español de alrededor', () => {
    expect(fragmentosEnIngles(GUION)).toEqual([
      'Each time, Elisha refused with a solemn vow, determined to be with his master to the end',
      'through humility, not wishing any person to be witness of the honor conferred on him by God, or with the desire to prove the fidelity of Elisha',
    ]);
  });

  it('no marca español con nombres o títulos en inglés', () => {
    expect(fragmentosEnIngles('El Treasury of Scripture Knowledge lo relaciona con Hebreos once, cinco.')).toEqual([]);
    expect(fragmentosEnIngles('TOMÁS: En hebreo dice «seará», un viento fuerte. O sea, es una tormenta.')).toEqual([]);
    expect(fragmentosEnIngles('ANA: Fue a Bet-El, a Jericó y al Jordán, y Eliseo no lo dejó ir solo.')).toEqual([]);
  });
});

describe('aplicarCambios', () => {
  it('cambia solo lo que está una vez', () => {
    expect(aplicarCambios('a b a c', [{ de: 'a', a: 'x' }, { de: 'c', a: 'z' }])).toBe('a b a z');
  });
});
