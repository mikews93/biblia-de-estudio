import { describe, expect, it } from 'vitest';

import { PREPARADAS } from './preguntasPreparadas';
import { enCorto, esPregunta, preparadaDe, separar } from './preguntarTexto';

describe('esPregunta', () => {
  it('reconoce preguntas con signos o dictadas sin ellos', () => {
    expect(esPregunta('¿Qué dice la Biblia sobre la ansiedad?')).toBe(true);
    expect(esPregunta('quién escribió el libro de hebreos')).toBe(true);
    expect(esPregunta('por qué hay cuatro evangelios')).toBe(true);
    expect(esPregunta('Jesús es Dios?')).toBe(true);
  });

  it('deja como búsqueda las palabras, los temas y las citas', () => {
    expect(esPregunta('Todo lo puedo en Cristo')).toBe(false);
    expect(esPregunta('La ansiedad')).toBe(false);
    expect(esPregunta('Perdonar a quien me hirió')).toBe(false);
    expect(esPregunta('Juan 3:16')).toBe(false);
    expect(esPregunta('que amor')).toBe(false);
  });
});

describe('preparadaDe', () => {
  it('encuentra la pregunta preparada sin contar tildes ni signos', () => {
    expect(preparadaDe('que es la trinidad')?.id).toBe('trinidad');
    expect(preparadaDe('¿Quién escribió la Biblia?')?.id).toBe('quien-escribio');
    expect(preparadaDe('¿Qué es la gracia?')).toBeUndefined();
  });

  it('tiene ids únicos y todas son preguntas', () => {
    expect(new Set(PREPARADAS.map((p) => p.id)).size).toBe(PREPARADAS.length);
    for (const p of PREPARADAS) expect(esPregunta(p.texto)).toBe(true);
  });
});

describe('separar y enCorto', () => {
  const respuesta =
    '## En corto\nNo es pecado sentir angustia.⟦1⟧\n\n⟪Filipenses 4:6⟫\n\n## Lo que dice la Biblia\nPablo ora.\n\n## Para pensar\n¿Qué te preocupa?\n\nSigue: ¿Y si no se va? | ¿Jesús sintió angustia?';

  it('quita la línea «Sigue» y devuelve las preguntas para seguir', () => {
    const { cuerpo, sugerencias } = separar(respuesta);
    expect(cuerpo.endsWith('¿Qué te preocupa?')).toBe(true);
    expect(sugerencias).toEqual(['¿Y si no se va?', '¿Jesús sintió angustia?']);
  });

  it('no enseña una línea «Sigue» a medio llegar', () => {
    expect(separar('## Para pensar\n¿Algo?\n\nSig').cuerpo).toBe('## Para pensar\n¿Algo?');
    expect(separar('## Para pensar\n¿Algo?\n\nSigue: ¿Y si').cuerpo).toBe('## Para pensar\n¿Algo?');
  });

  it('enCorto toma solo la primera parte con sus versículos', () => {
    expect(enCorto(separar(respuesta).cuerpo)).toBe('## En corto\nNo es pecado sentir angustia.⟦1⟧\n\n⟪Filipenses 4:6⟫');
    expect(enCorto('## En corto\nAún llega')).toBe('## En corto\nAún llega');
    expect(enCorto('Nada')).toBe('');
  });
});
