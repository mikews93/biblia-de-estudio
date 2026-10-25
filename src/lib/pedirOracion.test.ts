import { describe, expect, it } from 'vitest';

import { ANIMOS_SUGERIDOS, MAX_ANIMO, autorVisible, revisarPeticion, textoSugerido, visibleEnGrupo } from './pedirOracion';

const DIA = 86_400_000;

describe('pedir oración al grupo', () => {
  it('propone solo el título, en una frase corta', () => {
    expect(textoSugerido('Ansiedad por el trabajo nuevo')).toBe('Oren por mí: ansiedad por el trabajo nuevo.');
    expect(textoSugerido('Trabajo para papá.')).toBe('Oren por mí: trabajo para papá.');
    expect(textoSugerido('  ')).toBe('Oren por mí, estoy pasando un tiempo difícil.');
  });

  it('antes que al grupo, a alguien que ayude hoy si habla de hacerse daño', () => {
    expect(revisarPeticion('Ya no quiero vivir así').riesgo).toBe(true);
    expect(revisarPeticion('Oren por mi examen').riesgo).toBe(false);
  });

  it('sugiere contar menos cuando se cuenta mucho', () => {
    expect(revisarPeticion('Oren por mí').larga).toBe(false);
    expect(revisarPeticion('a'.repeat(300)).larga).toBe(true);
  });

  it('las abiertas dejan de verse al mes; las respondidas se quedan', () => {
    const ahora = Date.parse('2026-10-25T12:00:00Z');
    expect(visibleEnGrupo({ respondida: false, creado: ahora - 29 * DIA }, ahora)).toBe(true);
    expect(visibleEnGrupo({ respondida: false, creado: ahora - 31 * DIA }, ahora)).toBe(false);
    expect(visibleEnGrupo({ respondida: true, creado: ahora - 300 * DIA }, ahora)).toBe(true);
  });

  it('sin nombre sale como alguien del grupo', () => {
    expect(autorVisible(null)).toBe('Alguien del grupo');
    expect(autorVisible('Ana')).toBe('Ana');
  });

  it('los ánimos sugeridos caben', () => {
    for (const a of ANIMOS_SUGERIDOS) expect(a.length).toBeLessThanOrEqual(MAX_ANIMO);
  });
});
