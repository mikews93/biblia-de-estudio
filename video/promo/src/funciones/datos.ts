import type {VoTiming} from '../audio';
import compartirTaps from './compartir.taps.json';
import compartirTiming from './compartir.timing.json';
import compararTaps from './comparar.taps.json';
import compararTiming from './comparar.timing.json';
import historiaTaps from './historia.taps.json';
import historiaTiming from './historia.timing.json';
import despertadorTaps from './despertador.taps.json';
import despertadorTiming from './despertador.timing.json';
import oracionTaps from './oracion.taps.json';
import oracionTiming from './oracion.timing.json';
import parejaTaps from './pareja.taps.json';
import parejaTiming from './pareja.timing.json';
import estudioTaps from './estudio.taps.json';
import estudioTiming from './estudio.timing.json';
import planesTaps from './planes.taps.json';
import planesTiming from './planes.timing.json';
import mapaTaps from './mapa.taps.json';
import mapaTiming from './mapa.timing.json';
import conexionesTaps from './conexiones.taps.json';
import conexionesTiming from './conexiones.timing.json';
import promesasTaps from './promesas.taps.json';
import promesasTiming from './promesas.timing.json';
import jovenesTaps from './jovenes.taps.json';
import jovenesTiming from './jovenes.timing.json';
import comunidadTaps from './comunidad.taps.json';
import comunidadTiming from './comunidad.timing.json';
import hoyTaps from './hoy.taps.json';
import hoyTiming from './hoy.timing.json';
import notasTaps from './notas.taps.json';
import notasTiming from './notas.timing.json';
import repasoTaps from './repaso.taps.json';
import repasoTiming from './repaso.timing.json';
import fichasTaps from './fichas.taps.json';
import fichasTiming from './fichas.timing.json';
import dinamicasTaps from './dinamicas.taps.json';
import dinamicasTiming from './dinamicas.timing.json';
import eventosTaps from './eventos.taps.json';
import eventosTiming from './eventos.timing.json';
import circuloTaps from './circulo.taps.json';
import circuloTiming from './circulo.timing.json';
import sinconexionTaps from './sinconexion.taps.json';
import sinconexionTiming from './sinconexion.timing.json';
import dramatizadoTaps from './dramatizado.taps.json';
import dramatizadoTiming from './dramatizado.timing.json';
import interlinealTaps from './interlineal.taps.json';
import interlinealTiming from './interlineal.timing.json';
import podcastTaps from './podcast.taps.json';
import podcastTiming from './podcast.timing.json';
import prepararTaps from './preparar.taps.json';
import prepararTiming from './preparar.timing.json';
import presentarTaps from './presentar.taps.json';
import presentarTiming from './presentar.timing.json';
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
  compartir: {
    id: 'compartir',
    timing: compartirTiming as Record<string, VoTiming>,
    taps: compartirTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-lector', line: 'tocar'},
      {src: '2-acciones', line: 'tocar', word: 'Compartir.'},
      {src: '3-amanecer', line: 'fondos'},
      {src: '4-estrellas', line: 'fondos', word: 'letra,'},
      {src: '5-dedicar', line: 'fondos', word: 'destaca'},
      {src: '6-original-olivo', line: 'dedicar', word: 'griego'},
      {src: '7-historia', line: 'enviar'},
    ],
    titulares: [
      {line: 'tocar', eyebrow: 'COMPARTIR', title: 'Un versículo hecho imagen'},
      {line: 'fondos', eyebrow: 'A TU GUSTO', title: 'Fondos, letras y palabras destacadas'},
      {line: 'dedicar', eyebrow: 'MÁS QUE UNA FOTO', title: 'Dedicado, y con su palabra original'},
      {line: 'enviar', eyebrow: 'LISTO', title: 'Para tu muro o tus historias'},
    ],
  },
  comparar: {
    id: 'comparar',
    timing: compararTiming as Record<string, VoTiming>,
    taps: compararTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-lector', line: 'abrir'},
      {src: '2-capitulo', line: 'abrir', word: 'compara'},
      {src: '3-versiculo', line: 'marcar'},
      {src: '5-por-que', line: 'porque'},
      {src: '4-versiculo-abajo', line: 'porque', word: 'explica'},
    ],
    titulares: [
      {line: 'abrir', eyebrow: 'COMPARAR VERSIONES', title: 'Varias traducciones, lado a lado'},
      {line: 'marcar', eyebrow: 'DE UN VISTAZO', title: 'Lo que cambia, marcado'},
      {line: 'porque', eyebrow: 'POR QUÉ DIFIEREN', title: 'Explicado desde el original'},
    ],
  },
  historia: {
    id: 'historia',
    timing: historiaTiming as Record<string, VoTiming>,
    taps: historiaTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-linea', line: 'linea'},
      {src: '2-reino-dividido', line: 'linea', word: 'mundo,'},
      {src: '3-genealogia', line: 'familias'},
      {src: '4-jesus', line: 'familias', word: 'persona:'},
      {src: '5-jesus-abajo', line: 'linaje'},
    ],
    titulares: [
      {line: 'linea', eyebrow: 'LÍNEA DE TIEMPO', title: 'La Biblia y la historia del mundo'},
      {line: 'familias', eyebrow: 'FAMILIAS DE LA BIBLIA', title: 'Padres, hijos y linaje'},
      {line: 'linaje', eyebrow: 'A UN TOQUE', title: 'De Jesús hasta Adán'},
    ],
  },
  despertador: {
    id: 'despertador',
    timing: despertadorTiming as Record<string, VoTiming>,
    taps: despertadorTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-ajustes', line: 'hora'},
      {src: '2-que-suena', line: 'suena'},
      {src: '4-amanece', line: 'amanece'},
      {src: '6-abajo', line: 'amanece', word: 'leen'},
    ],
    titulares: [
      {line: 'hora', eyebrow: 'DESPERTADOR', title: 'Despierta con la Biblia'},
      {line: 'suena', eyebrow: 'A TU MANERA', title: 'Versículo, lectura o música'},
      {line: 'amanece', eyebrow: 'CADA MAÑANA', title: 'Amanece en tu pantalla'},
    ],
  },
  oracion: {
    id: 'oracion',
    timing: oracionTiming as Record<string, VoTiming>,
    taps: oracionTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-lista', line: 'lista'},
      {src: '2-camino', line: 'camino'},
      {src: '4-abierta', line: 'grupo'},
      {src: '5-pedir', line: 'grupo', word: 'ore'},
      {src: '7-animos', line: 'animos'},
    ],
    titulares: [
      {line: 'lista', eyebrow: 'DIARIO DE ORACIÓN', title: 'Lo que le pides a Dios'},
      {line: 'camino', eyebrow: 'MI CAMINO', title: 'Lo que Dios ha respondido'},
      {line: 'grupo', eyebrow: 'TU GRUPO', title: 'Que oren contigo'},
      {line: 'animos', eyebrow: 'ÁNIMOS', title: 'Tu grupo te acompaña'},
    ],
  },
  pareja: {
    id: 'pareja',
    timing: parejaTiming as Record<string, VoTiming>,
    taps: parejaTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-portada', line: 'invitar'},
      {src: '2-invitacion', line: 'invitar', word: 'código,'},
      {src: '3-inicio', line: 'dia'},
      {src: '5-dia', line: 'dia', word: 'pasaje,'},
      {src: '6-responder', line: 'revelar'},
      {src: '7-revelado', line: 'revelar', word: 'abre'},
      {src: '4-inicio-abajo', line: 'planes'},
    ],
    titulares: [
      {line: 'invitar', eyebrow: 'EN PAREJA', title: 'Un rato con Dios, los dos'},
      {line: 'dia', eyebrow: 'CINCO MINUTOS', title: 'Un pasaje, una pregunta, una oración'},
      {line: 'revelar', eyebrow: 'A SOLAS Y JUNTOS', title: 'Lo que escribió el otro'},
      {line: 'planes', eyebrow: 'NOVIOS Y CASADOS', title: 'Un plan para cada etapa'},
    ],
  },
  estudio: {
    id: 'estudio',
    timing: estudioTiming as Record<string, VoTiming>,
    taps: estudioTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-versiculo', line: 'tocar'},
      {src: '2-investigando', line: 'investiga'},
      {src: '3-estudio', line: 'investiga', word: 'arma'},
      {src: '4-costumbres', line: 'detalle'},
      {src: '5-griego', line: 'detalle', word: 'griego,'},
      {src: '6-doctrina', line: 'detalle', word: 'enseña.'},
      {src: '7-aplicar', line: 'aplicar'},
    ],
    titulares: [
      {line: 'tocar', eyebrow: 'ESTUDIO PROFUNDO', title: 'Estudia cualquier versículo'},
      {line: 'investiga', eyebrow: 'INVESTIGA POR TI', title: 'Diccionarios, comentarios y teologías'},
      {line: 'detalle', eyebrow: 'EN DETALLE', title: 'Costumbres, griego y doctrina'},
      {line: 'aplicar', eyebrow: 'PARA TU VIDA', title: 'Preguntas y fuentes a la vista'},
    ],
  },
  planes: {
    id: 'planes',
    timing: planesTiming as Record<string, VoTiming>,
    taps: planesTaps,
    hook: 'hook',
    pantallas: [
      {src: '2-toca', line: 'retos'},
      {src: '3-adviento', line: 'dia'},
      {src: '4-adviento-abajo', line: 'dia', word: 'espera.'},
      {src: '5-mas-planes', line: 'temas'},
      {src: '6-mas-planes-2', line: 'temas', word: 'libro'},
    ],
    titulares: [
      {line: 'retos', eyebrow: 'PLANES DE LECTURA', title: 'Al ritmo del año cristiano'},
      {line: 'dia', eyebrow: 'UN CAPÍTULO AL DÍA', title: 'Y el plan te espera'},
      {line: 'temas', eyebrow: 'PARA CADA MOMENTO', title: 'Planes para lo que vives'},
    ],
  },
  mapa: {
    id: 'mapa',
    timing: mapaTiming as Record<string, VoTiming>,
    taps: mapaTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-recorridos', line: 'abrir'},
      {src: '2-recorrido', line: 'abrir', word: 'escuchar.'},
      {src: '3-jordan', line: '@clip'},
      {src: '4-desierto', line: 'sigue', word: 'desierto,'},
      {src: '5-galilea', line: 'sigue', word: 'Galilea…'},
      {src: '6-mar', line: 'sigue', word: 'paso'},
    ],
    titulares: [
      {line: 'abrir', eyebrow: 'RECORRIDOS', title: 'El mapa que sigue la lectura'},
      {line: 'sigue', eyebrow: 'PASO A PASO', title: 'Cada lugar, mientras suena'},
    ],
    clip: {
      after: 'abrir',
      src: 'clips/dramatizado-mrk-1.mp3',
      from: 71.3,
      dur: 8,
      lineas: [{t: 0, quien: 'Narrador', texto: 'Y aconteció en aquellos días, que Jesús vino de Nazaret de Galilea, y Juan le dio el bautismo en el Jordán.'}],
    },
  },
  conexiones: {
    id: 'conexiones',
    timing: conexionesTiming as Record<string, VoTiming>,
    taps: conexionesTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-toda-la-biblia', line: 'arcos'},
      {src: '2-isaias', line: 'libro'},
      {src: '3-isaias-53', line: 'capitulo'},
      {src: '4-isaias-53-refs', line: 'capitulo', word: 'fuertes,'},
    ],
    titulares: [
      {line: 'arcos', eyebrow: 'CONEXIONES', title: 'Toda la Biblia, conectada'},
      {line: 'libro', eyebrow: 'POR LIBRO', title: 'Con quién conversa cada libro'},
      {line: 'capitulo', eyebrow: 'POR CAPÍTULO', title: 'Las referencias más fuertes'},
    ],
  },
  promesas: {
    id: 'promesas',
    timing: promesasTiming as Record<string, VoTiming>,
    taps: promesasTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-promesas', line: 'arcos'},
      {src: '2-hilos', line: 'hilo'},
      {src: '3-hilo', line: 'hilo', word: 'Edén'},
      {src: '4-hilo-abajo', line: 'cumple'},
      {src: '5-hilo-cristo', line: 'cumple', word: 'esperamos.'},
    ],
    titulares: [
      {line: 'arcos', eyebrow: 'PROMESA Y CUMPLIMIENTO', title: 'Las promesas de Dios son en Él Sí'},
      {line: 'hilo', eyebrow: 'LOS GRANDES HILOS', title: 'Del Edén a la cruz'},
      {line: 'cumple', eyebrow: 'PASO A PASO', title: 'Lo cumplido y lo que esperamos'},
    ],
  },
  jovenes: {
    id: 'jovenes',
    timing: jovenesTiming as Record<string, VoTiming>,
    taps: jovenesTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-misiones', line: 'rutas'},
      {src: '2-toca', line: 'rutas', word: 'ruta'},
      {src: '3-ruta', line: 'rutas', word: 'misión'},
      {src: '4-lee', line: 'mision'},
      {src: '6-respondio', line: 'mision', word: 'respondes'},
      {src: '7-paso', line: 'mision', word: 'piensas…'},
      {src: '8-paso', line: 'mision', word: 'reto'},
      {src: '9-paso', line: 'sello'},
      {src: '11-paso', line: 'sello', word: 'sellos.'},
    ],
    titulares: [
      {line: 'rutas', eyebrow: 'MODO JÓVENES', title: 'Rutas de seis misiones'},
      {line: 'mision', eyebrow: 'CADA MISIÓN', title: 'Lee, entiende, piensa y vive'},
      {line: 'sello', eyebrow: 'SIN RANKINGS', title: 'Estrellas y sellos'},
    ],
  },
  comunidad: {
    id: 'comunidad',
    timing: comunidadTiming as Record<string, VoTiming>,
    taps: comunidadTaps,
    hook: 'hook',
    pantallas: [
      {src: '2-me-gusta', line: 'muro'},
      {src: '3-gustado', line: 'muro', word: 'resaltan'},
      {src: '4-muro-abajo', line: 'muro', word: 'preguntan…'},
      {src: '5-amigos', line: 'amigos'},
      {src: '8-grupos', line: 'grupo'},
      {src: '6-grupo', line: 'grupo', word: 'leen'},
    ],
    titulares: [
      {line: 'muro', eyebrow: 'COMUNIDAD', title: 'Lo que tus amigos leen'},
      {line: 'amigos', eyebrow: 'AMIGOS', title: 'Tú decides quién te ve'},
      {line: 'grupo', eyebrow: 'GRUPOS', title: 'Leer juntos, cada día'},
    ],
  },
  hoy: {
    id: 'hoy',
    timing: hoyTiming as Record<string, VoTiming>,
    taps: hoyTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-manana', line: 'portada'},
      {src: '2-noche', line: 'portada', word: 'cambia'},
      {src: '3-para-ti', line: 'parati'},
      {src: '4-por-que', line: 'parati', word: 'rastrearte:'},
      {src: '5-accesos', line: 'todo'},
      {src: '6-todo', line: 'todo', word: 'función,'},
    ],
    titulares: [
      {line: 'portada', eyebrow: 'HOY', title: 'Un versículo para empezar'},
      {line: 'parati', eyebrow: 'PARA TI', title: 'Elegido sin rastrearte'},
      {line: 'todo', eyebrow: 'TODO EN ZARZA', title: 'Cada función, a mano'},
    ],
  },
  notas: {
    id: 'notas',
    timing: notasTiming as Record<string, VoTiming>,
    taps: notasTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-lector', line: 'resaltar'},
      {src: '2-panel', line: 'resaltar', word: 'resáltalo'},
      {src: '3-resaltado', line: 'resaltar', word: 'color'},
      {src: '4-nota', line: 'nota'},
      {src: '5-con-nota', line: 'nota', word: 'palabras.'},
      {src: '6-mis-notas', line: 'mis'},
      {src: '7-exportar', line: 'mis', word: 'Word,'},
    ],
    titulares: [
      {line: 'resaltar', eyebrow: 'RESALTAR', title: 'Tus colores'},
      {line: 'nota', eyebrow: 'NOTAS', title: 'Lo que Dios te dijo'},
      {line: 'mis', eyebrow: 'EXPORTAR', title: 'Word, PDF o texto'},
    ],
  },
  repaso: {
    id: 'repaso',
    timing: repasoTiming as Record<string, VoTiming>,
    taps: repasoTaps,
    hook: 'hook',
    pantallas: [
      {src: '2-herramientas', line: 'mapa'},
      {src: '3-mapa', line: 'mapa', word: 'ideas'},
      {src: '4-idea', line: 'mapa', word: 'versículo.'},
      {src: '5-tarjetas', line: 'tarjetas'},
      {src: '6-repaso', line: 'repaso'},
      {src: '7-respuesta', line: 'repaso', word: 'ves…'},
    ],
    titulares: [
      {line: 'mapa', eyebrow: 'MAPA MENTAL', title: 'El capítulo de un vistazo'},
      {line: 'tarjetas', eyebrow: 'TARJETAS', title: 'Pregunta y respuesta'},
      {line: 'repaso', eyebrow: 'REPASO', title: 'Justo antes de olvidar'},
    ],
  },
  fichas: {
    id: 'fichas',
    timing: fichasTiming as Record<string, VoTiming>,
    taps: fichasTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-buscar', line: 'diccionario'},
      {src: '2-diccionario', line: 'diccionario', word: 'diccionario'},
      {src: '3-articulo', line: 'diccionario', word: 'explica'},
      {src: '5-ficha-abajo', line: 'ficha'},
      {src: '7-concordancia', line: 'concordancia'},
      {src: '8-concordancia-abajo', line: 'concordancia', word: 'traduce.'},
    ],
    titulares: [
      {line: 'diccionario', eyebrow: 'DICCIONARIO BÍBLICO', title: 'Lugares, personas y objetos'},
      {line: 'ficha', eyebrow: 'FICHAS', title: 'Vida, viajes y mapa'},
      {line: 'concordancia', eyebrow: 'CONCORDANCIA', title: 'Cada palabra en el original'},
    ],
  },
  dinamicas: {
    id: 'dinamicas',
    timing: dinamicasTiming as Record<string, VoTiming>,
    taps: dinamicasTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-taller', line: 'lista'},
      {src: '2-lista', line: 'lista', word: 'dinámicas'},
      {src: '3-lista-abajo', line: 'lista', word: 'entrar'},
      {src: '4-dinamica', line: 'dinamica'},
      {src: '5-dinamica-abajo', line: 'dinamica', word: 'materiales,'},
    ],
    titulares: [
      {line: 'lista', eyebrow: 'DINÁMICAS', title: '23 para tu grupo'},
      {line: 'dinamica', eyebrow: 'PASO A PASO', title: 'Solo la Biblia y el grupo'},
    ],
  },
  eventos: {
    id: 'eventos',
    timing: eventosTiming as Record<string, VoTiming>,
    taps: eventosTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-presentar', line: 'publicar'},
      {src: '2-preparar', line: 'publicar', word: 'evento…'},
      {src: '3-codigo', line: 'publicar', word: 'código'},
      {src: '4-entrar', line: 'entrar'},
      {src: '5-pronto', line: 'entrar', word: 'cuenta.'},
      {src: '7-vivo', line: 'vivo'},
      {src: '8-versiculo', line: 'vivo', word: 'abren'},
      {src: '9-nota', line: 'vivo', word: 'notas.'},
      {src: '11-termino', line: 'final'},
      {src: '12-comparte', line: 'final', word: 'comparten'},
    ],
    titulares: [
      {line: 'publicar', eyebrow: 'EVENTOS', title: 'Tu sermón, con un código'},
      {line: 'entrar', eyebrow: 'LA CONGREGACIÓN', title: 'Entra sin cuenta'},
      {line: 'vivo', eyebrow: 'EN VIVO', title: 'Punto por punto'},
      {line: 'final', eyebrow: 'AL TERMINAR', title: 'Notas para llevar'},
    ],
  },
  circulo: {
    id: 'circulo',
    timing: circuloTiming as Record<string, VoTiming>,
    taps: circuloTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-camino', line: 'camino'},
      {src: '2-etapa', line: 'camino', word: 'duele.'},
      {src: '3-circulo', line: 'circulo'},
      {src: '3b-circulo-abajo', line: 'circulo', word: 'pregunta'},
      {src: '4-persona', line: 'conocer'},
      {src: '5-conocernos', line: 'conocer', word: 'siete'},
      {src: '6-hombres', line: 'hombres'},
      {src: '7-semana', line: 'hombres', word: 'ocho'},
      {src: '8-reto', line: 'hombres', word: 'crecer'},
    ],
    titulares: [
      {line: 'camino', eyebrow: 'EL CAMINO', title: 'Siete etapas'},
      {line: 'circulo', eyebrow: 'CÍRCULO DE SOLTEROS', title: 'Cuidado por tu iglesia'},
      {line: 'conocer', eyebrow: 'CONOCERNOS', title: 'Siete días de preguntas'},
      {line: 'hombres', eyebrow: 'HOMBRES DE PIE', title: 'Ocho semanas juntos'},
    ],
  },
  sinconexion: {
    id: 'sinconexion',
    timing: sinconexionTiming as Record<string, VoTiming>,
    taps: sinconexionTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-descargas', line: 'descargar'},
      {src: '2-bajando', line: 'descargar', word: 'completa'},
      {src: '3-descargada', line: 'descargar', word: 'pesa'},
      {src: '4-libros', line: 'leer'},
      {src: '5-lector', line: 'leer', word: 'campo'},
      {src: '6-buscar', line: 'buscar'},
    ],
    titulares: [
      {line: 'descargar', eyebrow: 'SIN CONEXIÓN', title: 'La Biblia entera, descargada'},
      {line: 'leer', eyebrow: 'SIN INTERNET', title: 'Igual la lees'},
      {line: 'buscar', eyebrow: 'BUSCAR', title: 'También sin datos'},
    ],
  },
  presentar: {
    id: 'presentar',
    timing: presentarTiming as Record<string, VoTiming>,
    taps: presentarTaps,
    hook: 'hook',
    pantallas: [
      {src: '1-empezar', line: 'empezar'},
      {src: '2-portada', line: 'empezar', word: 'código.', delay: -6},
      {src: '3-notas', line: 'notas'},
      {src: '4-todos-ven-la-cita', line: 'cita', word: 'aparece'},
      {src: '5-preguntas', line: 'preguntas'},
      {src: '6-pregunta-en-el-telefono', line: 'preguntas', word: 'secreto,'},
      {src: '8-dinamica-para-todos', line: 'preguntas', word: 'pasos.', delay: -8},
    ],
    titulares: [
      {line: 'empezar', eyebrow: 'LECTURA EN VIVO', title: 'Tu grupo, cada uno en su teléfono'},
      {line: 'notas', eyebrow: 'PARA QUIEN GUÍA', title: 'Tus notas y tu reloj'},
      {line: 'cita', eyebrow: 'UN TOQUE', title: 'La cita, en todas las pantallas'},
      {line: 'preguntas', eyebrow: 'PARTICIPAN TODOS', title: 'Preguntas y dinámicas en vivo'},
    ],
  },
};
