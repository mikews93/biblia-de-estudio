import { describe, expect, it } from 'vitest';

import {
  type PreguntaSala,
  type Sala,
  TONOS,
  cleanCode,
  newest,
  ordenPreguntas,
  preguntasDe,
  secondsLeft,
  seccionesDelEstudio,
  spacedCode,
  toneOf,
  touchesByVerse,
} from './vivo';

const sala = (version: number) => ({ version }) as Sala;

describe('lectura en vivo', () => {
  it('limpia el código como lo escriben: minúsculas, espacios y letras que se confunden', () => {
    expect(cleanCode('k7m qwe')).toBe('K7MQWE');
    expect(cleanCode('K7M-QWE-XX')).toBe('K7MQWE');
    // I, L, O, 0 y 1 no existen en los códigos (se confunden al dictarlos).
    expect(cleanCode('IL0O1A')).toBe('A');
    expect(spacedCode('K7MQWE')).toBe('K7M QWE');
  });

  it('se queda siempre con la versión más nueva aunque las respuestas lleguen cruzadas', () => {
    const v5 = sala(5);
    expect(newest(null, v5)).toBe(v5);
    expect(newest(v5, sala(4))).toBe(v5);
    const v6 = sala(6);
    expect(newest(v5, v6)).toBe(v6);
  });

  it('la cuenta atrás corrige la diferencia de reloj con el servidor', () => {
    const now = Date.parse('2026-10-21T20:00:00Z');
    const fin = '2026-10-21T20:05:00Z';
    expect(secondsLeft(fin, 0, now)).toBe(300);
    // El teléfono va 30 s atrasado respecto al servidor.
    expect(secondsLeft(fin, 30_000, now)).toBe(270);
    expect(secondsLeft(fin, 0, now + 400_000)).toBe(0);
    expect(secondsLeft(null, 0, now)).toBeNull();
  });

  it('cada persona ilumina siempre con el mismo tono y se agrupan por versículo', () => {
    expect(toneOf('ana')).toBe(toneOf('ana'));
    expect(TONOS).toContain(toneOf('beto'));
    const map = touchesByVerse([
      { usuario: 'a', nombre: 'Ana', versiculo: 16 },
      { usuario: 'b', nombre: 'Beto', versiculo: 16 },
      { usuario: 'c', nombre: 'Carla', versiculo: 3 },
    ]);
    expect(map.get(16)?.map((t) => t.nombre)).toEqual(['Ana', 'Beto']);
    expect(map.get(3)).toHaveLength(1);
  });
});

describe('estudio en grupo', () => {
  const estudio = [
    'Intro sin título.',
    '## Panorama\n\nPablo escribe desde la cárcel ⟦1⟧.',
    '## Palabras del griego: **zēteite** está en presente ⟦2⟧.',
    '## Para aplicar\n\n- ¿Qué buscas tú cada día? ⟦3⟧\n- **¿Con quién** necesitas perdonar?\n- Una idea que no es pregunta.',
  ].join('\n\n');
  const fuentes = [1, 2, 3, 4].map((n) => ({ n, label: `Fuente ${n}` }));

  it('parte el estudio Profundo en sus secciones, con las fuentes que cita cada una', () => {
    const s = seccionesDelEstudio(estudio, fuentes);
    expect(s.map((x) => x.titulo)).toEqual(['Panorama', 'Palabras del griego', 'Para aplicar']);
    expect(s[0].texto).toBe('Pablo escribe desde la cárcel ⟦1⟧.');
    expect(s[0].fuentes.map((f) => f.n)).toEqual([1]);
    // El texto en la misma línea del título («## Título: texto») queda como texto de la sección.
    expect(s[1].texto).toBe('**zēteite** está en presente ⟦2⟧.');
  });

  it('saca las preguntas de «Para aplicar» sin citas ni negritas', () => {
    const aplicar = seccionesDelEstudio(estudio)[2];
    expect(preguntasDe(aplicar.texto)).toEqual(['¿Qué buscas tú cada día?', '¿Con quién necesitas perdonar?']);
  });

  it('ordena el tablero: primero las que esperan y las más apoyadas', () => {
    const p = (id: string, apoyos: number, respondida = false): PreguntaSala => ({
      id,
      texto: id,
      autor: 'a',
      nombre: 'Ana',
      apoyos: Array.from({ length: apoyos }, (_, i) => `u${i}`),
      respondida,
    });
    expect(ordenPreguntas([p('vista', 5, true), p('una', 1), p('tres', 3), p('otra', 1)]).map((x) => x.id)).toEqual([
      'tres',
      'una',
      'otra',
      'vista',
    ]);
  });
});

describe('repaso relámpago', () => {
  it('lee las preguntas de opción múltiple y se salta las mal formadas', async () => {
    const { parseRepaso, acertoElGrupo } = await import('./repaso');
    const qs = parseRepaso(
      'P: ¿Dónde está Cristo?\nA) En el templo\nB) A la diestra de Dios\nC) En el monte\nD) Junto al mar\nR: B\nV: Colosenses 3:1\n\nP: Sin opciones\nR: A',
    );
    expect(qs).toEqual([{ texto: '¿Dónde está Cristo?', opciones: ['En el templo', 'A la diestra de Dios', 'En el monte', 'Junto al mar'], correcta: 1, cita: 'Colosenses 3:1' }]);
    expect(acertoElGrupo([0, 3, 1, 0], 1)).toBe(true);
    expect(acertoElGrupo([1, 1, 0, 0], 1)).toBe(false);
    expect(acertoElGrupo([0, 0, 0, 0], 1)).toBe(false);
  });
});

describe('juegos del capítulo', () => {
  const versos: [number, string][] = [
    [1, 'Si habéis pues resucitado con Cristo, buscad las cosas de arriba'],
    [2, 'Poned la mira en las cosas de arriba'],
    [4, 'Amén.'],
    [3, 'Porque muertos sois, y vuestra vida está escondida con Cristo en Dios.'],
  ];
  const azar = () => 0.42;

  it('lee «dos verdades y una mentira» con tres opciones', async () => {
    const { parseRepaso } = await import('./repaso');
    const [q] = parseRepaso('P: Sobre el versículo 3\nA) uno\nB) dos\nC) tres\nR: C\nV: Col 3:3');
    expect(q.opciones).toEqual(['uno', 'dos', 'tres']);
    expect(q.correcta).toBe(2);
    expect(parseRepaso('P: x\nA) uno\nB) dos\nR: C')).toEqual([]);
  });

  it('ordena el versículo: mismas palabras, revueltas, con la solución', async () => {
    const { preguntasOrdena, mismaRespuesta } = await import('./repaso');
    const qs = preguntasOrdena('Colosenses', 3, versos, 5, azar);
    expect(qs.map((q) => q.cita)).toEqual(['Colosenses 3:1', 'Colosenses 3:2', 'Colosenses 3:3']);
    for (const q of qs) {
      expect([...q.opciones].sort()).toEqual(q.solucion!.split(' ').sort());
      expect(q.opciones.join(' ')).not.toBe(q.solucion);
    }
    expect(mismaRespuesta('poned la mira  en las cosas de arriba', 'Poned la mira en las cosas de arriba')).toBe(true);
  });

  it('espada bíblica: un pedazo del versículo y su número como solución', async () => {
    const { preguntasEspada } = await import('./repaso');
    const qs = preguntasEspada('Colosenses', 3, versos, 5, azar);
    expect(qs.length).toBe(3);
    for (const q of qs) {
      const v = versos.find(([n]) => String(n) === q.solucion)![1];
      expect(v).toContain(q.texto.replace(/[«»…]/g, ''));
      expect(q.versiculos).toBe(4);
    }
  });
});

describe('ruleta de preguntas', () => {
  it('lee la categoría y el nivel de cada pregunta', async () => {
    const { parseRepaso } = await import('./repaso');
    const [q] = parseRepaso('C: tema\nN: 3\nP: ¿Qué enseña?\nA) a\nB) b\nC) c\nD) d\nR: B\nV: Col 3:1');
    expect(q).toMatchObject({ categoria: 'tema', nivel: 3, correcta: 1, opciones: ['a', 'b', 'c', 'd'] });
  });

  it('recorta lo largo que escribe la IA en vez de rechazar todo el juego', async () => {
    const { parseRepaso, MAX_OPCION, MAX_TEXTO_PREGUNTA, MAX_CITA } = await import('./repaso');
    const larga = 'Cuando un compañero del colegio se burla de su fe, responde con calma y le explica lo que cree '.repeat(4);
    const [q] = parseRepaso(
      `C: vida\nN: 3\nP: ${'¿Qué haría Elías? '.repeat(30)}\nA) ${larga}\nB) corta\nC) otra\nD) más\nR: A\nV: 1 Reyes 18:21; 1 Reyes 18:36-39; Santiago 5:17-18 y 1 Reyes 19:1-4 (todo el pasaje)`,
    );
    expect(q.opciones[0].length).toBeLessThanOrEqual(MAX_OPCION);
    expect(q.opciones[0].endsWith('…')).toBe(true);
    expect(q.texto.length).toBeLessThanOrEqual(MAX_TEXTO_PREGUNTA);
    expect(q.cita).toBe('1 Reyes 18:21');
    expect(q.cita!.length).toBeLessThanOrEqual(MAX_CITA);
  });

  it('cada giro cae en una casilla con su pregunta, sin repetir', async () => {
    const { girarRuleta, RULETA } = await import('./repaso');
    const preguntas = RULETA.map((c) => ({ texto: `${c.categoria}${c.nivel}`, opciones: ['a', 'b', 'c', 'd'], correcta: 0, cita: null, categoria: c.categoria, nivel: c.nivel }));
    const usadas: number[] = [];
    let k = 0;
    const azar = () => ((k++ * 7) % 10) / 10;
    for (let n = 0; n < RULETA.length; n++) {
      const g = girarRuleta(preguntas, usadas, azar)!;
      expect(RULETA[g.casilla]).toMatchObject({ categoria: preguntas[g.paso].categoria, nivel: preguntas[g.paso].nivel });
      expect(usadas).not.toContain(g.paso);
      usadas.push(g.paso);
    }
    expect(girarRuleta(preguntas, usadas)).toBeNull();
  });

  it('el puntaje: el valor de la casilla por la parte que acertó, también por equipos', async () => {
    const { puntajeRuleta, RULETA } = await import('./repaso');
    const casilla = RULETA.findIndex((c) => c.puntos === 300);
    const q = { texto: 'x', opciones: ['a', 'b', 'c', 'd'], correcta: 1, cita: null };
    const r = (usuario: string, opcion: number, equipo: number) => ({ usuario, paso: 0, opcion, equipo });
    const p = puntajeRuleta([r('a', 1, 0), r('b', 1, 0), r('c', 0, 1), r('d', 1, 1)], [q], { 0: casilla }, [0]);
    expect(p.grupo).toBe(230);
    expect(p.equipos).toEqual([300, 150]);
    expect(p.personas).toEqual({ a: 300, b: 300, c: 0, d: 300 });
    expect(puntajeRuleta([r('a', 1, 0)], [q], { 0: casilla }, []).grupo).toBe(0);
  });
});

