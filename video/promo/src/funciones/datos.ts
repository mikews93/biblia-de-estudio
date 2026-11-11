import type {VoTiming} from '../audio';
import interlinealTaps from './interlineal.taps.json';
import interlinealTiming from './interlineal.timing.json';
import preguntarTaps from './preguntar.taps.json';
import preguntarTiming from './preguntar.timing.json';

/**
 * Los videos verticales de cada función (src/funciones/Funcion.tsx). La voz es de funciones/<id>.json
 * (Abel, la graba la acción «Video promocional»); las capturas y sus toques, de scripts/funciones/<id>.mjs.
 * Cada pantalla entra cuando Abel dice una palabra de una frase (`word`, la primera vez que suena).
 */
export type Pantalla = {src: string; line: string; word?: string; delay?: number};
export type Titular = {line: string; eyebrow: string; title: string};
export type Funcion = {
  id: string;
  timing: Record<string, VoTiming>;
  taps: Record<string, {x: number; y: number} | null>;
  /** La frase que se dice sobre la llama, antes del teléfono. */
  hook: string;
  pantallas: Pantalla[];
  titulares: Titular[];
};

export const FUNCIONES: Record<string, Funcion> = {
  interlineal: {
    id: 'interlineal',
    timing: interlinealTiming as Record<string, VoTiming>,
    taps: interlinealTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-lector', line: 'activar'},
      {src: '2-activo', line: 'activar', word: 'interlineal,', delay: 6},
      {src: '3-versiculo', line: 'activar', word: 'griego,'},
      {src: '4-palabra', line: 'tocar', word: 'palabra:', delay: 4},
      {src: '5-historia', line: 'historia', word: 'historia'},
      {src: '6-historia-abajo', line: 'historia', word: 'Génesis'},
    ],
    titulares: [
      {line: 'activar', eyebrow: 'INTERLINEAL', title: 'El griego, bajo cada versículo'},
      {line: 'tocar', eyebrow: 'CADA PALABRA', title: 'Su raíz, su gramática, sus usos'},
      {line: 'historia', eyebrow: 'LA HISTORIA DE UNA PALABRA', title: 'De Génesis a Apocalipsis'},
    ],
  },
  preguntar: {
    id: 'preguntar',
    timing: preguntarTiming as Record<string, VoTiming>,
    taps: preguntarTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-hoy', line: 'buscar'},
      {src: '2-buscador', line: 'buscar', word: 'buscador,', delay: 4},
      {src: '3-escrita', line: 'buscar', word: 'preguntarías'},
      {src: '4-tarjeta', line: 'respuesta'},
      {src: '5-respuesta', line: 'respuesta', word: 'versículo,'},
      {src: '6-respuesta-abajo', line: 'fuentes', word: 'revisa'},
      {src: '7-para-pensar', line: 'pensar', word: 'pregunta'},
    ],
    titulares: [
      {line: 'buscar', eyebrow: 'PREGÚNTALE A LA BIBLIA', title: 'Como se lo preguntarías a alguien'},
      {line: 'respuesta', eyebrow: 'CITA POR CITA', title: 'Respuestas con la Biblia abierta'},
      {line: 'fuentes', eyebrow: 'CITAS REVISADAS', title: 'Cada cita, comprobada'},
      {line: 'pensar', eyebrow: 'PARA PENSAR', title: 'Y una pregunta para ti'},
    ],
  },
};
