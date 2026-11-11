import type {VoTiming} from '../audio';
import interlinealTaps from './interlineal.taps.json';
import interlinealTiming from './interlineal.timing.json';
import podcastTaps from './podcast.taps.json';
import podcastTiming from './podcast.timing.json';
import preguntarTaps from './preguntar.taps.json';
import preguntarTiming from './preguntar.timing.json';

/**
 * Los videos verticales de cada función (src/funciones/Funcion.tsx). La voz es de funciones/<id>.json
 * (Abel, la graba la acción «Video promocional»); las capturas y sus toques, de scripts/funciones/<id>.mjs.
 * Cada pantalla entra cuando Abel dice una palabra de una frase (`word`, la primera vez que suena).
 */
/** `line` puede ser '@clip' (el audio real); `t` = segundos desde que empieza, en vez de `word`. */
export type Pantalla = {src: string; line: string; word?: string; t?: number; delay?: number};
/** Un trozo del audio real de la app (archivo en public/), con lo que dice cada voz para los subtítulos. */
export type Clip = {after: string; src: string; from: number; dur: number; lineas: {t: number; quien: string; texto: string}[]};
export type Titular = {line: string; eyebrow: string; title: string};
export type Funcion = {
  id: string;
  timing: Record<string, VoTiming>;
  taps: Record<string, {x: number; y: number} | null>;
  /** La frase que se dice sobre la llama, antes del teléfono. */
  hook: string;
  pantallas: Pantalla[];
  titulares: Titular[];
  clip?: Clip;
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
  podcast: {
    id: 'podcast',
    timing: podcastTiming as Record<string, VoTiming>,
    taps: podcastTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-lector', line: 'abrir'},
      {src: '2-podcast', line: 'abrir', word: 'pódcast:', delay: 4},
      {src: '3-sonando', line: '@clip'},
      {src: '4-sonando-abajo', line: '@clip', t: 6.6},
      {src: '5-barra-lector', line: 'barra'},
      {src: '6-siguiente', line: 'barra', word: 'siguiente.', delay: 4},
      {src: '8-grabando', line: 'grabar', word: 'grabas'},
    ],
    titulares: [
      {line: 'abrir', eyebrow: 'PÓDCAST DEL CAPÍTULO', title: 'Dos voces que te lo explican'},
      {line: 'barra', eyebrow: 'MIENTRAS LEES', title: 'Suena en la barra de abajo'},
      {line: 'grabar', eyebrow: 'VOCES NATURALES', title: 'Lo grabas una vez, queda para todos'},
    ],
    clip: {
      after: 'abrir',
      src: 'clips/podcast-jhn-3.mp3',
      from: 0,
      dur: 9.6,
      lineas: [
        {t: 0, quien: 'Ana', texto: 'Un maestro de la ley, respetado por todos, va a ver a Jesús de noche. ¿Por qué a escondidas?'},
        {t: 6.6, quien: 'Tomás', texto: 'Juan no lo explica, y eso ya dice algo.'},
      ],
    },
  },
};
