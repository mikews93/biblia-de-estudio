/** Lo que la app y el servidor saben de cada vuelta de una conversación con la IA. */
type Vuelta = { role: 'user' | 'assistant'; text: string };

/** Vueltas que se mandan a la IA: la primera respuesta (el estudio) y las últimas preguntas con sus respuestas. */
export const MAX_VUELTAS = 12;

/**
 * Deja la conversación como la espera la IA: respuestas y preguntas alternadas, sin respuestas vacías.
 * Si una pregunta se quedó sin respuesta (falló la red, se cerró la app) y luego llegó otra, vale la última:
 * así una pregunta fallida no deja la conversación rota para siempre. Devuelve null si no tiene arreglo.
 */
export function ordenarVueltas<T extends Vuelta>(vueltas: unknown): T[] | null {
  if (!Array.isArray(vueltas)) return null;
  const limpias: T[] = [];
  for (const v of vueltas) {
    if ((v?.role !== 'user' && v?.role !== 'assistant') || typeof v.text !== 'string') return null;
    if (!v.text.trim()) continue;
    if (limpias[limpias.length - 1]?.role === v.role) limpias[limpias.length - 1] = v;
    else limpias.push(v);
  }
  if (limpias.length && (limpias[0].role !== 'assistant' || limpias[limpias.length - 1].role !== 'user')) return null;
  return limpias;
}

/** Para mandar una conversación larga: la primera respuesta y las últimas vueltas, sin pasarse del máximo. */
export function recortarVueltas<T extends Vuelta>(vueltas: T[]): T[] {
  if (vueltas.length <= MAX_VUELTAS) return vueltas;
  // Desde una pregunta: con la primera respuesta delante, siguen alternadas.
  let desde = vueltas.length - (MAX_VUELTAS - 1);
  if (vueltas[desde].role !== 'user') desde++;
  return [vueltas[0], ...vueltas.slice(desde)];
}
