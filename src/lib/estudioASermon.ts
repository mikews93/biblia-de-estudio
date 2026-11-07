import type { Turn } from './estudio';
import { guardarTallerIa } from './tallerIa';
import { conCitas } from './tallerTema';

// Convertir un estudio profundo en un mensaje (Mike, 2026-11-07): el estudio que la persona leyó y las preguntas que
// hizo, con sus respuestas, pasan a «Preparar un mensaje» (src/app/taller/preparar.tsx). La IA investiga partiendo de
// ese pasaje y dice cómo usar cada pregunta en el mensaje, porque son las mismas que tendrá la gente.

/** Lo que se le pasa a la IA (api/estudiar.ts, EstudioPrevio). */
export type EstudioPrevio = { cita: string; texto: string; preguntas: { pregunta: string; respuesta: string }[] };
/** Lo que guarda la pantalla: lo de la IA y dónde abrir el estudio otra vez. */
export type EstudioGuardado = EstudioPrevio & { book: string; chapter: number; verse?: number };

/** Como valida el servidor: 8 preguntas, el estudio y cada respuesta recortados. */
const MAX_PREGUNTAS = 8;
const MAX_ESTUDIO = 11_000;
const MAX_RESPUESTA = 3_500;
const MAX_PREGUNTA = 580;

const recortar = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);
/** Sin las marcas de la app: las citas pasan a referencias entre paréntesis y los versículos marcados, a su cita. */
const limpio = (t: Turn) => conCitas(t.text, t.sources ?? []).replace(/⟪([^⟫]+)⟫/g, '$1').trim();

/** El estudio (el primer turno) y cada pregunta de la persona con la respuesta que recibió. */
export function estudioPrevio(pasaje: { book: string; chapter: number; verse?: number; cita: string }, turns: Turn[]): EstudioGuardado | null {
  const estudio = turns[0];
  if (estudio?.role !== 'assistant' || !estudio.text.trim()) return null;
  const preguntas: EstudioPrevio['preguntas'] = [];
  for (let i = 1; i < turns.length - 1; i++) {
    const [q, r] = [turns[i], turns[i + 1]];
    if (q.role !== 'user' || r.role !== 'assistant' || !q.text.trim() || !r.text.trim() || r.cortada) continue;
    preguntas.push({ pregunta: recortar(q.text.trim(), MAX_PREGUNTA), respuesta: recortar(limpio(r), MAX_RESPUESTA) });
    i++;
  }
  return { ...pasaje, texto: recortar(limpio(estudio), MAX_ESTUDIO), preguntas: preguntas.slice(-MAX_PREGUNTAS) };
}

/** Para la IA, sin los datos de la pantalla. */
export const paraLaIA = ({ cita, texto, preguntas }: EstudioPrevio): EstudioPrevio => ({ cita, texto, preguntas });

/** Las preguntas, para que el borrador las use aunque no se marque su idea. */
export const preguntasParaBorrador = (e: EstudioPrevio) =>
  e.preguntas.length
    ? `Preguntas que hice al estudiar ${e.cita} (son las que también tendrá la gente; respóndelas en el mensaje):\n${e.preguntas.map((p) => `- «${p.pregunta}»`).join('\n')}`
    : '';

/** Empieza una preparación nueva con el estudio: lo de antes en «Preparar un mensaje» se reemplaza. */
export async function prepararDesdeEstudio(e: EstudioGuardado) {
  await guardarTallerIa('preparar', {
    vista: {
      texto: `Quiero preparar un sermón sobre ${e.cita} a partir de lo que estudié.`,
      tipo: 'sermon',
      etapa: 'orar',
      marcadas: [],
      enfoque: 0,
      direccion: '',
      plantilla: '',
      pedido: null,
      estudio: e,
    },
    convs: { investigar: [], borrador: [] },
  });
}
