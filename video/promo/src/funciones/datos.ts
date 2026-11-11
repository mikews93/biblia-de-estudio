import type {VoTiming} from '../audio';
import interlinealTaps from './interlineal.taps.json';
import interlinealTiming from './interlineal.timing.json';

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
};
