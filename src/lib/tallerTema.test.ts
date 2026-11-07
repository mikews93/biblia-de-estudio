import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import type { Mensaje } from './taller';
import { conCitas, crearDesdeMaqueta, estructuraParaIA, leerExploracion, leerMaqueta } from './tallerTema';

const EXPLORACION = `## Lo que entiendo
Quieres hablar a jóvenes ansiosos por el futuro.⟦1⟧

## Pasajes
- Filipenses 4:4-9 | Pablo escribe desde la cárcel y llama a orar en vez de afanarse.⟦1⟧
- **Mateo 6:25-34** | Jesús habla de no afanarse por el mañana.⟦2⟧
- Libro Inventado 3:1 | no existe

## Lo que dicen las fuentes
- Un comentario señala que la oración es el remedio contra el afán.⟦3⟧
- Hodge explica la providencia de Dios sobre lo pequeño.⟦4⟧

## Para afinar
- ¿Qué edad tienen?
- ¿Qué esperas que hagan esta semana?⟦2⟧`;

const MAQUETA = `## Idea central
- Tema: La paz de Dios | Complemento: guarda a quien le entrega sus cargas en oración.⟦1⟧
- Tema: «El afán» | Complemento: se vence orando con gratitud.

## Introducción: la necesidad
= El afán por el futuro es real y Dios lo toma en serio.⟦1⟧
? ¿Qué preocupaciones del futuro escuchas más en tu grupo?
> Filipenses 4:6 | el versículo que nombra el afán⟦1⟧

## La oración que da paz
? ¿Qué cambia cuando la petición va con gratitud?
> Salmos 55:22 | echar la carga sobre Jehová⟦2⟧`;

describe('leerExploracion', () => {
  it('separa lo que entiende, los pasajes, las fuentes y las preguntas', () => {
    const e = leerExploracion(EXPLORACION, BOOKS);
    expect(e.entiendo).toContain('jóvenes ansiosos');
    expect(e.pasajes.map((p) => p.cita)).toEqual(['Filipenses 4:4-9', 'Mateo 6:25-34', 'Libro Inventado 3:1']);
    expect(e.pasajes[0].pasaje).toEqual({ book: 'php', chapter: 4, from: 4, to: 9 });
    expect(e.pasajes[1].pasaje?.book).toBe('mat');
    expect(e.pasajes[2].pasaje).toBeNull();
    expect(e.pasajes[0].porque).toContain('⟦1⟧');
    expect(e.fuentes).toHaveLength(2);
    expect(e.preguntas).toEqual(['¿Qué edad tienen?', '¿Qué esperas que hagan esta semana?']);
  });

  it('mientras llega, devuelve solo lo que ya está', () => {
    const e = leerExploracion(EXPLORACION.slice(0, 120), BOOKS);
    expect(e.entiendo).toBeTruthy();
    expect(e.fuentes).toEqual([]);
  });
});

describe('leerMaqueta', () => {
  it('lee las ideas y cada parte con su pregunta y su pasaje de apoyo', () => {
    const m = leerMaqueta(MAQUETA, BOOKS);
    expect(m.ideas).toEqual([
      { tema: 'La paz de Dios', complemento: 'guarda a quien le entrega sus cargas en oración.' },
      { tema: 'El afán', complemento: 'se vence orando con gratitud.' },
    ]);
    expect(m.partes).toHaveLength(2);
    expect(m.partes[1]).toMatchObject({ titulo: 'La oración que da paz', apoyo: 'Salmos 55:22' });
    expect(m.partes[1].apoyoPasaje).toEqual({ book: 'psa', chapter: 55, from: 22, to: undefined });
    expect(m.partes[0].pregunta).toMatch(/^¿Qué preocupaciones/);
    expect(m.partes[0].frase).toBe('El afán por el futuro es real y Dios lo toma en serio.⟦1⟧');
    expect(m.partes[1].frase).toBe('');
  });
});

describe('crearDesdeMaqueta', () => {
  afterEach(() => vi.useRealTimers());

  it('crea el mensaje con las partes de la plantilla, sin escribir sus notas', async () => {
    vi.useFakeTimers();
    const maqueta = leerMaqueta(MAQUETA, BOOKS);
    const id = await crearDesdeMaqueta({
      tipo: 'sermon',
      plantilla: 'expositiva',
      pasaje: { book: 'php', chapter: 4, from: 4, to: 9 },
      situacion: '  Jóvenes ansiosos  ',
      maqueta,
      idea: maqueta.ideas[0],
      sources: [
        { n: 1, label: 'Filipenses 4:6' },
        { n: 2, label: 'Salmos 55:22' },
      ],
    });
    await vi.advanceTimersByTimeAsync(400);
    const m = (JSON.parse((await AsyncStorage.getItem('taller'))!) as Mensaje[]).find((x) => x.id === id)!;
    expect(m.pasaje).toEqual({ book: 'php', chapter: 4, from: 4, to: 9 });
    expect(m.situacion).toBe('Jóvenes ansiosos');
    expect(m.tema).toBe('La paz de Dios');
    // La expositiva tiene cinco partes: las dos de la maqueta y el resto como en la plantilla.
    expect(m.secciones).toHaveLength(5);
    expect(m.secciones[0]).toMatchObject({ titulo: 'Introducción: la necesidad', apoyo: { cita: 'Filipenses 4:6', porque: 'el versículo que nombra el afán (Filipenses 4:6)' } });
    expect(m.secciones[1]).toMatchObject({ titulo: 'La oración que da paz', ayuda: '¿Qué cambia cuando la petición va con gratitud?' });
    expect(m.secciones[2].titulo).toBe('Punto 2');
    // La frase de la maqueta abre el borrador, con sus citas como referencias; las demás partes quedan vacías.
    expect(m.secciones[0].texto).toBe('El afán por el futuro es real y Dios lo toma en serio. (Filipenses 4:6)');
    expect(m.secciones.slice(1).every((s) => s.texto === '')).toBe(true);
  });
});

describe('ayudas', () => {
  it('pasa las citas a referencias y describe la estructura', () => {
    expect(conCitas('Echar la carga⟦2⟧', [{ n: 2, label: 'Salmos 55:22' }])).toBe('Echar la carga (Salmos 55:22)');
    expect(estructuraParaIA('expositiva')).toContain('1. Introducción: la necesidad');
  });
});

describe('leerExploracion del Taller con borrador', () => {
  const PREPARAR = `## Lo que entiendo
Jóvenes con ansiedad por el futuro.⟦1⟧

## Pasajes
- Mateo 14:22-33 | Pedro mira el viento.⟦1⟧

## Lo que dicen las fuentes
- Un comentario señala que Jesús oraba en el monte.⟦2⟧

## Puntos de vista
- ¿«No os afanéis» prohíbe planear? | Una lectura dice que no; otra, que sí con matices.⟦3⟧

## Predicaciones
- Cuando el viento sopla | Pedro se hunde al mirar las olas.⟦4⟧
- Ninguna

## Momento histórico
- En Galilea las tormentas llegan de golpe.⟦5⟧

## Protagonistas
- Pedro | Pescador de Betsaida, un pueblo pequeño; impulsivo y valiente.⟦6⟧

## Lo que preguntaste
- ¿Por qué los mandó a la tormenta? | Úsala para abrir el mensaje: Jesús los mandó y oraba por ellos.⟦2⟧

## Enfoques
- Mira a Jesús, no a las olas | Mateo 14:22-33 | La ansiedad se vence mirando a Jesús.⟦1⟧
- Tu Padre ya sabe | «Mateo 6:25-34». | El Padre cuida.`;

  it('lee los puntos de vista, las predicaciones, el momento histórico, los protagonistas y los enfoques con su pasaje', () => {
    const e = leerExploracion(PREPARAR, BOOKS);
    expect(e.fuentes).toEqual(['Un comentario señala que Jesús oraba en el monte.⟦2⟧']);
    expect(e.vistas).toEqual([{ pregunta: '¿No os afanéis prohíbe planear?', texto: 'Una lectura dice que no; otra, que sí con matices.⟦3⟧' }]);
    expect(e.predicaciones).toEqual([{ titulo: 'Cuando el viento sopla', idea: 'Pedro se hunde al mirar las olas.⟦4⟧' }]);
    expect(e.contexto).toEqual(['En Galilea las tormentas llegan de golpe.⟦5⟧']);
    expect(e.protagonistas).toEqual([{ nombre: 'Pedro', texto: 'Pescador de Betsaida, un pueblo pequeño; impulsivo y valiente.⟦6⟧' }]);
    // Desde un estudio profundo: sus preguntas no se confunden con «Para afinar»
    expect(e.deEstudio).toEqual([{ pregunta: '¿Por qué los mandó a la tormenta?', texto: 'Úsala para abrir el mensaje: Jesús los mandó y oraba por ellos.⟦2⟧' }]);
    expect(e.preguntas).toEqual([]);
    expect(e.enfoques.map((x) => [x.titulo, x.cita, x.pasaje])).toEqual([
      ['Mira a Jesús, no a las olas', 'Mateo 14:22-33', { book: 'mat', chapter: 14, from: 22, to: 33 }],
      ['Tu Padre ya sabe', 'Mateo 6:25-34', { book: 'mat', chapter: 6, from: 25, to: 34 }],
    ]);
    expect(e.enfoques[0].idea).toBe('La ansiedad se vence mirando a Jesús.⟦1⟧');
  });
});
