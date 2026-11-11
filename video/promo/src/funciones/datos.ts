import type {VoTiming} from '../audio';
import dramatizadoTaps from './dramatizado.taps.json';
import dramatizadoTiming from './dramatizado.timing.json';
import interlinealTaps from './interlineal.taps.json';
import interlinealTiming from './interlineal.timing.json';
import podcastTaps from './podcast.taps.json';
import podcastTiming from './podcast.timing.json';
import prepararTaps from './preparar.taps.json';
import prepararTiming from './preparar.timing.json';
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
  dramatizado: {
    id: 'dramatizado',
    timing: dramatizadoTiming as Record<string, VoTiming>,
    taps: dramatizadoTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-lector', line: 'abrir', word: 'Escuchar', delay: -14},
      {src: '2-hoja', line: 'abrir', word: 'Escuchar', delay: 6},
      {src: '3-sonando', line: '@clip'},
      {src: '4-sonando-v11', line: '@clip', t: 7.3},
      {src: '5-pedir', line: 'pedir'},
      {src: '6-guion', line: 'pedir', word: 'pídelo:', delay: 6},
      {src: '7-voces', line: 'pedir', word: 'minutos…'},
      {src: '8-listo', line: 'pedir', word: 'queda'},
    ],
    titulares: [
      {line: 'abrir', eyebrow: 'AUDIO DRAMATIZADO', title: 'La Biblia, como si estuvieras allí'},
      {line: 'seguir', eyebrow: 'VERSÍCULO A VERSÍCULO', title: 'Sabes siempre por dónde vas'},
      {line: 'pedir', eyebrow: 'A PEDIDO', title: 'Tu capítulo, en unos minutos'},
    ],
    clip: {
      after: 'abrir',
      src: 'clips/dramatizado-mrk-1.mp3',
      from: 80.6,
      dur: 17.3,
      lineas: [
        {t: 0, quien: 'Narrador', texto: 'Y luego, saliendo del agua, vio los cielos abiertos y el Espíritu descendía sobre él como una paloma.'},
        {t: 7.3, quien: 'Narrador', texto: 'Y una voz salió del cielo:'},
        {t: 9.4, quien: 'La voz del cielo', texto: 'Tú eres mi Hijo amado, a quien he elegido, en quien descansa mi favor.'},
      ],
    },
  },
  preparar: {
    id: 'preparar',
    timing: prepararTiming as Record<string, VoTiming>,
    taps: prepararTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-taller', line: 'orar'},
      {src: '2-orar', line: 'orar', word: 'cuéntale'},
      {src: '3-investigacion', line: 'investigar'},
      {src: '4-fuentes', line: 'investigar', word: 'teologías,'},
      {src: '5-direccion', line: 'borrador'},
      {src: '6-escribiendo', line: 'borrador', word: 'borrador'},
      {src: '7-borrador', line: 'borrador', word: 'idea'},
      {src: '8-partes', line: 'borrador', word: 'dinámicas.'},
      {src: '9-cambios', line: 'cambios', word: 'pides'},
    ],
    titulares: [
      {line: 'orar', eyebrow: 'TALLER', title: 'Empieza con lo que Dios te puso'},
      {line: 'investigar', eyebrow: 'INVESTIGA CONTIGO', title: 'Pasajes, comentarios y teologías'},
      {line: 'borrador', eyebrow: 'BORRADOR COMPLETO', title: 'Tu mensaje, listo para revisar'},
      {line: 'cambios', eyebrow: 'TÚ DECIDES', title: 'Hasta que sea tuyo'},
    ],
  },
};
