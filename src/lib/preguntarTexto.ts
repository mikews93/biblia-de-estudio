// Lo que se lee del texto de una pregunta y de su respuesta (src/lib/preguntar.ts), sin dependencias de la app.

import { PREPARADAS, type Preparada } from './preguntasPreparadas';

export const sinAcentos = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** La pregunta preparada que coincide con lo escrito (sin contar tildes ni signos), si hay una. */
export function preparadaDe(texto: string): Preparada | undefined {
  const t = sinAcentos(texto);
  return PREPARADAS.find((p) => sinAcentos(p.texto) === t);
}

// Palabras con que suele empezar una pregunta, ya sin tildes, también detrás de «y», «pero». Las que preguntan
// («qué», «cuándo», «de quién») van aparte y con su tilde (INTERROGATIVA): sin ella son otra cosa («cuando tengo miedo»,
// «para que todo aquel que en él cree»), y lo dudoso lo decide el servidor (api/_tipo.ts).
const INICIOS = new RegExp(
  '^(?:(?:y|e|pero|entonces|o sea|oye|bueno)\\s+)?(?:' +
    'por que|acaso|es|son|esta|estan|existe|existen|hay|puedo|puede|pueden|podemos|podria|debo|debe|deben|' +
    'debemos|deberia|tengo|tiene|se puede|dios|jesus|la biblia|explicame|explica|dime|cuentame|hablame|' +
    'ayudame a entender|quiero saber|quisiera saber|quiero entender|me puedes|me podrias|podrias|sabes|significado de|y si' +
    ')\\b',
);

// En español la tilde marca la palabra que pregunta («de quién huía», «Caín a qué le temía»): con ella, en cualquier
// parte de la frase, es una pregunta aunque el dictado no ponga los signos.
const INTERROGATIVA = /(^|[\s,(«"])(qué|quién|quiénes|cuál|cuáles|cómo|dónde|adónde|cuándo|cuánto|cuánta|cuántos|cuántas)(?=$|[\s,.;:)»"?])/i;

/**
 * ¿Lo escrito es una pregunta y no unas palabras que se buscan? Con signos de pregunta, siempre; sin ellos (dictado),
 * si empieza como una pregunta o lleva una palabra que pregunta con su tilde («a qué», «de quién»), y tiene al menos cuatro palabras
 * («qué dice la biblia del perdón», «de quién huía Caín después de matar a Abel»).
 */
export function esPregunta(texto: string): boolean {
  const t = texto.trim();
  if (t.length < 8 || t.length > MAX_PREGUNTA) return false;
  if (/[¿?]/.test(t)) return true;
  const limpio = sinAcentos(t);
  if (limpio.split(' ').length < 4) return false;
  return INICIOS.test(limpio) || INTERROGATIVA.test(t);
}

export const MAX_PREGUNTA = 300;

// Doctrinas y herejías que se buscan con una o dos palabras («modalismo», «los nestorianos»): se ofrecen como pregunta.
const ISMO = /^(?:el |los |la |las )?([a-záéíóúñü]+(?:ismo|ianos|istas))$/i;

/**
 * Lo buscado dicho como pregunta, para ofrecer «¿Era una pregunta?» cuando no se reconoció como tal: «modalismo» →
 * «¿Qué es el modalismo?»; unas palabras de idea («caín tenía miedo de los demás») → «¿Caín tenía miedo de los demás?».
 * Nada para lo corto o lo que ya es pregunta.
 */
export function comoPregunta(texto: string): string | undefined {
  const t = texto.trim().replace(/[.!¡]+$/, '');
  if (!t || esPregunta(t) || t.length > MAX_PREGUNTA - 2) return undefined;
  const ismo = t.match(ISMO);
  if (ismo) {
    const w = ismo[1].toLowerCase();
    return /(ianos|istas)$/.test(w) ? `¿Quiénes eran los ${w}?` : `¿Qué es el ${w}?`;
  }
  if (t.split(/\s+/).length < 4) return undefined;
  return `¿${t.charAt(0).toUpperCase()}${t.slice(1)}?`;
}

/** Las preguntas que la IA propone para seguir, en la última línea: «Sigue: ¿…? | ¿…?». */
const SIGUE = /\n*\s*Sigue:\s*([^\n]*)\s*$/i;

/** La respuesta sin la línea de «Sigue» (también mientras llega) y las preguntas que propone. */
export function separar(texto: string): { cuerpo: string; sugerencias: string[] } {
  const m = texto.match(SIGUE);
  // Mientras llega, una línea que empieza a ser «Sigue:» no se enseña.
  const cuerpo = (m ? texto.slice(0, m.index) : texto.replace(/\n+\s*S(i(g(ue?)?)?)?$/i, '')).trimEnd();
  const sugerencias = m
    ? m[1]
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s.length >= 6 && s.length <= 120)
        .slice(0, 3)
    : [];
  return { cuerpo, sugerencias };
}

/** La parte «En corto» de la respuesta y los versículos ⟪…⟫ que la siguen: lo que se ve en la tarjeta del buscador. */
export function enCorto(cuerpo: string): string {
  const m = cuerpo.match(/##\s*En corto\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  return m ? `## En corto\n${m[1].trim()}` : '';
}
