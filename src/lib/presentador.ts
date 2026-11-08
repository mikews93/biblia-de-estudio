// La vista de quien presenta un mensaje del Taller en vivo (la sala de la célula y el modo presentar): sus notas
// con las citas que se pueden mostrar a todos de un toque, y las preguntas que escribió listas para mandarlas.
// Aquí solo lo que no depende de la pantalla.

import type { Book } from './data';
import { citasEn } from './eventos';
import type { Pasaje, Seccion } from './taller';

/** Un trozo de las notas: texto corrido o una cita que se puede mostrar («Lucas 15:20»). */
export type Trozo = { texto: string; cita?: string };

const CITA = /(?:\b[1-3]\s?)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}\.?\s+\d{1,3}\s*[:.]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?/g;
// «v. 20», «vv. 20-24», «versículo 20», «versículos 11 al 13»: del pasaje del mensaje.
const RELATIVA = /\b(?:vv?\.|vers[ií]culos?)\s*(\d{1,3})(?:\s*(?:[-–]|al|a)\s*(\d{1,3}))?/gi;

/**
 * Parte un texto en trozos y reconoce las citas: las escritas con el libro («Lucas 15:20», «1 Jn 4:9-10») y, si hay
 * pasaje, las que solo dan el versículo («v. 20», «versículos 11 al 13»), que son del capítulo del pasaje.
 */
export function trozosConCitas(texto: string, books: Book[], pasaje?: Pasaje | null): Trozo[] {
  const hallazgos: { i: number; fin: number; cita: string }[] = [];
  for (const m of texto.matchAll(CITA)) {
    const cita = citasEn(m[0], books)[0];
    if (cita) hallazgos.push({ i: m.index!, fin: m.index! + m[0].length, cita });
  }
  const libro = pasaje && books.find((b) => b.id === pasaje.book);
  if (libro) {
    for (const m of texto.matchAll(RELATIVA)) {
      const desde = Number(m[1]);
      const hasta = m[2] ? Number(m[2]) : undefined;
      if (!desde || (hasta !== undefined && hasta <= desde)) continue;
      const i = m.index!;
      if (hallazgos.some((h) => i < h.fin && i + m[0].length > h.i)) continue;
      hallazgos.push({
        i,
        fin: i + m[0].length,
        cita: `${libro.name} ${pasaje!.chapter}:${desde}${hasta ? `-${hasta}` : ''}`,
      });
    }
  }
  hallazgos.sort((a, b) => a.i - b.i);
  const out: Trozo[] = [];
  let at = 0;
  for (const h of hallazgos) {
    if (h.i < at) continue;
    if (h.i > at) out.push({ texto: texto.slice(at, h.i) });
    out.push({ texto: texto.slice(h.i, h.fin), cita: h.cita });
    at = h.fin;
  }
  if (at < texto.length) out.push({ texto: texto.slice(at) });
  return out;
}

/** Las citas de un texto, sin repetir, en el orden en que aparecen. */
export function citasDeTexto(texto: string, books: Book[], pasaje?: Pasaje | null): string[] {
  const out: string[] = [];
  for (const t of trozosConCitas(texto, books, pasaje)) if (t.cita && !out.includes(t.cita)) out.push(t.cita);
  return out;
}

const MAX_PREGUNTA = 200;

/**
 * Las preguntas que la persona escribió en una parte, para mandarlas al grupo sin copiarlas: lo que va entre «¿» y
 * «?», y las líneas que terminan en «?» o empiezan con «Pregunta:». Primero lo que es para el grupo.
 */
export function preguntasDeParte(s: Pick<Seccion, 'texto' | 'claves' | 'paraGrupo'>): string[] {
  const out: string[] = [];
  const poner = (q: string) => {
    const t = q
      .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
      .replace(/^\s*preguntas?\s*(?:al grupo|para el grupo|a la iglesia)?\s*:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (t.length < 6 || t.length > MAX_PREGUNTA) return;
    const clave = t.toLowerCase().replace(/[¿?¡!.,;:«»"]/g, '');
    if (!out.some((x) => x.toLowerCase().replace(/[¿?¡!.,;:«»"]/g, '') === clave)) out.push(t);
  };
  for (const texto of [s.paraGrupo ?? '', s.texto, s.claves ?? '']) {
    for (const linea of texto.split('\n')) {
      const abiertas = [...linea.matchAll(/¿[^¿?]{3,}\?/g)].map((m) => m[0]);
      if (abiertas.length) abiertas.forEach(poner);
      else if (/\?\s*$/.test(linea)) {
        // Sin «¿»: la última frase de la línea es la pregunta.
        const frases = linea.replace(/^\s*(?:[-*•]\s+)?preguntas?\s*:\s*/i, '').split(/(?<=[.;!])\s+/);
        poner(frases[frases.length - 1]);
      } else if (/^\s*(?:[-*•]\s+)?preguntas?\s*:/i.test(linea)) poner(linea);
    }
  }
  return out.slice(0, 8);
}
