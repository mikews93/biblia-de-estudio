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

// Palabras con que suele empezar una pregunta, ya sin tildes.
const INICIOS =
  /^(que|quien|quienes|como|cual|cuales|cuando|donde|cuanto|cuantos|cuantas|por que|para que|es|son|esta|estan|existe|existen|hay|puedo|puede|pueden|podemos|debo|debe|deben|debemos|tengo|tiene|dios|jesus|la biblia|explicame|explica|dime|ayudame a entender)\b/;

/**
 * ¿Lo escrito es una pregunta y no unas palabras que se buscan? Con signos de pregunta, siempre; sin ellos (dictado),
 * si empieza como una pregunta y tiene al menos cuatro palabras («qué dice la biblia del perdón»).
 */
export function esPregunta(texto: string): boolean {
  const t = texto.trim();
  if (t.length < 8 || t.length > MAX_PREGUNTA) return false;
  if (/^¿|\?$/.test(t)) return true;
  const limpio = sinAcentos(t);
  return limpio.split(' ').length >= 4 && INICIOS.test(limpio);
}

export const MAX_PREGUNTA = 300;

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
