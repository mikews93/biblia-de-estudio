// Acompañar a quien ora por una carga (ansiedad, tristeza, duelo…): leer un versículo no siempre basta, y hablarlo con
// alguien ayuda a salir. Hoy pregunta, como mucho una vez por semana, «¿cómo sigues?», y según la respuesta anima a
// hablar con un pastor, un mentor o alguien de confianza. Sin avisos push, sin rachas, siempre con «Ahora no».
// Las respuestas se quedan en el teléfono (src/lib/seguimiento.ts). Sin React Native, para probarlo en vitest.

import { contiene, OracionLeida, temasDe } from './paraTi';
import { PALABRAS_RIESGO, Tema, temaPorId } from './temas';

export type Respuesta = 'mejor' | 'igual' | 'dificil';

export type Paso = {
  /** AAAA-MM-DD. */
  fecha: string;
  /** La petición por la que se preguntó, o null si solo dijo «Ahora no». */
  oracion: string | null;
  respuesta?: Respuesta;
  /** Contestó «Sí, ya hablé con alguien». */
  hablo?: boolean;
};

const DIA = 86_400_000;
/** No se pregunta por una petición recién escrita: primero, unos días de oración. */
const ESPERA = 3;
/** Entre una pregunta y la siguiente (o un «Ahora no»), una semana. */
const CADA = 7;
/** Si ya habló con alguien, durante un mes no se le vuelve a sugerir: solo se pregunta cómo sigue. */
const HABLO_VALE = 30;

const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA);

/** La petición por la que toca preguntar hoy, o null. */
export function tocaPreguntar(
  oraciones: (OracionLeida & { id: string })[],
  historial: Paso[],
  hoy: string,
  ocultos: string[] = [],
): { oracion: OracionLeida & { id: string }; tema: Tema } | null {
  const ultima = historial.at(-1);
  if (ultima && dias(ultima.fecha, hoy) < CADA) return null;
  const abiertas = oraciones
    .filter((o) => !o.respondida && Date.parse(hoy) - o.created >= ESPERA * DIA)
    .sort((a, b) => b.created - a.created);
  for (const o of abiertas) {
    const texto = `${o.titulo}\n${o.detalle ?? ''}`;
    const tema = temasDe(texto).find((t) => t.acompanar && !ocultos.includes(t.id));
    const riesgo = contiene(texto, PALABRAS_RIESGO);
    if (!tema && !riesgo) continue;
    const previa = historial.filter((p) => p.oracion === o.id).at(-1);
    if (previa && dias(previa.fecha, hoy) < CADA) continue;
    return { oracion: o, tema: tema ?? temaPorId('tristeza')! };
  }
  return null;
}

export type Consejo = {
  /** Cómo se dice, en una o dos frases. */
  texto: string;
  /** Invitar a escribirle a alguien de confianza. */
  hablar: boolean;
  /** Preguntar si ya lo habló con alguien. */
  preguntarSiHablo: boolean;
  /** Mostrar las líneas de ayuda. */
  lineas: boolean;
};

/** Qué decir después de «¿cómo sigues?», mirando también las respuestas anteriores por la misma petición. */
export function consejo(respuesta: Respuesta, previas: Paso[], hoy: string): Consejo {
  const hablo = previas.some((p) => p.hablo && dias(p.fecha, hoy) < HABLO_VALE);
  const seguidas = [...previas.filter((p) => p.respuesta), { respuesta }]
    .reverse()
    .findIndex((p) => p.respuesta === 'mejor');
  const sinMejoria = seguidas === -1 ? previas.filter((p) => p.respuesta).length + 1 : seguidas;
  const dificiles = [...previas.map((p) => p.respuesta), respuesta].slice(-2).filter((r) => r === 'dificil').length;

  if (respuesta === 'mejor')
    return {
      texto: 'Gracias a Dios. Cuéntaselo a alguien: tu historia puede animar a otro, y darle gracias juntos también sana.',
      hablar: false,
      preguntarSiHablo: false,
      lineas: false,
    };
  if (hablo)
    return {
      texto: 'Sigue apoyándote en la persona con quien hablaste. Pedir ayuda otra vez no es molestar: es dejar que te acompañen.',
      hablar: respuesta === 'dificil',
      preguntarSiHablo: false,
      lineas: dificiles >= 2,
    };
  if (respuesta === 'igual' && sinMejoria < 2)
    return {
      texto: 'Seguir orando no es fracasar: Dios está obrando aunque no se vea todavía. ¿Has podido hablarlo con alguien?',
      hablar: false,
      preguntarSiHablo: true,
      lineas: false,
    };
  return {
    texto:
      'No tienes que cargarlo en silencio. Hablarlo con tu pastor, un mentor o alguien de confianza ayuda de verdad: «Sobrellevad los unos las cargas de los otros» (Gálatas 6:2).',
    hablar: true,
    preguntarSiHablo: true,
    lineas: dificiles >= 2,
  };
}

/** El mensaje listo para enviar a alguien de confianza. No dice el tema: eso lo cuenta la persona cuando quiera. */
export const MENSAJE_CONFIANZA =
  'Hola, ¿tienes un rato esta semana? Estoy pasando por algo y me ayudaría mucho hablarlo contigo y que oremos juntos.';
