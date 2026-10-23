// El repaso relámpago del estudio en grupo: cinco preguntas de opción múltiple sobre el capítulo que la IA prepara
// una vez y quedan guardadas para todos (herramienta «repaso» de api/estudiar.ts). Sin dependencias de React
// Native: también lo usa api/_celula.ts.

export type PreguntaRepaso = { texto: string; opciones: string[]; correcta: number; cita: string | null };

export const LETRAS = ['A', 'B', 'C', 'D'];
export const MAX_PREGUNTAS = 8;

/** Lee el formato «P: … / A) … / R: B / V: cita». Se salta las preguntas mal formadas. */
export function parseRepaso(text: string): PreguntaRepaso[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      const texto = lines.find((l) => /^P:/i.test(l))?.replace(/^P:\s*/i, '');
      const opciones = LETRAS.map((L) => lines.find((l) => new RegExp(`^${L}[).]\\s`).test(l))?.replace(/^[A-D][).]\s*/, ''));
      const letra = lines.find((l) => /^R:/i.test(l))?.replace(/^R:\s*/i, '').trim()[0]?.toUpperCase();
      const cita = lines.find((l) => /^V:/i.test(l))?.replace(/^V:\s*/i, '') || null;
      const correcta = letra ? LETRAS.indexOf(letra) : -1;
      if (!texto || opciones.some((o) => !o) || correcta < 0) return null;
      return { texto, opciones: opciones as string[], correcta, cita };
    })
    .filter((q): q is PreguntaRepaso => q !== null)
    .slice(0, MAX_PREGUNTAS);
}

/** Una pregunta «la acertó el grupo» si la mayoría de quienes respondieron eligió la correcta. */
export function acertoElGrupo(votos: number[], correcta: number) {
  const total = votos.reduce((a, b) => a + b, 0);
  return total > 0 && votos[correcta] * 2 > total;
}

/** Cómo se juega: en equipo (el grupo acierta junto), con puntos y podio, o dos equipos. */
export type ModoRepaso = 'grupo' | 'puntos' | 'equipos';
export const NOMBRES_EQUIPOS = ['Equipo Lámpara', 'Equipo Pergamino'];

/** Segundos para el extra por rapidez: responder al instante vale 1000, al final de este tiempo 500. */
const RAPIDEZ_SEGUNDOS = 30;

/** Los puntos de una respuesta correcta según lo que tardó desde que apareció la pregunta. */
export function puntosPor(segundos: number) {
  const t = Math.min(Math.max(segundos, 0), RAPIDEZ_SEGUNDOS) / RAPIDEZ_SEGUNDOS;
  return Math.round((1000 - 500 * t) / 10) * 10;
}

export type RespuestaRepaso = { usuario: string; nombre: string; paso: number; opcion: number; creado: string };

/**
 * Los puntos de cada persona en las preguntas ya reveladas, de más a menos (a igualdad, por nombre). Solo se
 * cuentan las reveladas: así nadie sabe antes de tiempo si acertó.
 */
export function marcador(respuestas: RespuestaRepaso[], preguntas: PreguntaRepaso[], desdes: (string | null)[], reveladas: number[]) {
  const map = new Map<string, { usuario: string; nombre: string; puntos: number; aciertos: number }>();
  for (const r of respuestas) {
    const fila = map.get(r.usuario) ?? { usuario: r.usuario, nombre: r.nombre, puntos: 0, aciertos: 0 };
    map.set(r.usuario, fila);
    if (!reveladas.includes(r.paso) || preguntas[r.paso]?.correcta !== r.opcion) continue;
    const desde = desdes[r.paso];
    fila.puntos += puntosPor(desde ? (Date.parse(r.creado) - Date.parse(desde)) / 1000 : RAPIDEZ_SEGUNDOS);
    fila.aciertos++;
  }
  return [...map.values()].sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
}

/** Reparte a quienes están en dos equipos parejos; quien llega después va al equipo con menos gente. */
export function equipoPara(equipos: Record<string, number>) {
  const n = [0, 0];
  for (const e of Object.values(equipos)) n[e]++;
  return n[0] <= n[1] ? 0 : 1;
}
