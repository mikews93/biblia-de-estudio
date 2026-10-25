// Llevar un mensaje del Taller en vivo, parte por parte: en la lectura con la célula (api/_celula.ts, estado.guion)
// y en los eventos de la iglesia. Aquí está lo que no depende de la pantalla: qué se manda al servidor de cada
// parte (solo títulos, minutos y citas, nunca las notas de quien guía), a qué versículos se pasa al llegar a una
// parte y cómo se cuenta el tiempo.

import type { Book } from './data';
import { dinamica } from './dinamicas';
import { citasEn, leerCita } from './eventos';
import { ANUNCIOS, type Mensaje, type Pasaje, type Seccion, anunciosDe } from './taller';
import type { Guion, Rango } from './vivo';

/** Las citas de una parte: las que aparecen en lo que escribió y la del pasaje que la apoya. */
export function citasDeParte(s: Seccion, books: Book[]) {
  const citas = citasEn(`${s.paraGrupo ?? ''}\n${s.texto}\n${s.claves ?? ''}`, books);
  const apoyo = s.apoyo?.cita ? citasEn(s.apoyo.cita, books)[0] : undefined;
  return apoyo && !citas.includes(apoyo) ? [...citas, apoyo] : citas;
}

/**
 * Lo que se manda al empezar: el título y, de cada parte, su título, sus minutos y sus citas. Si el mensaje tiene
 * anuncios, cierran el guion como una última parte («Anuncios», sin minutos ni citas).
 */
export function guionDe(m: Mensaje, titulo: string, books: Book[]) {
  const anuncios = anunciosDe(m).length > 0;
  const partes = m.secciones.slice(0, anuncios ? 29 : 30).map((s) => ({
    titulo: (s.titulo.trim() || 'Sin título').slice(0, 120),
    minutos: s.minutos > 0 ? Math.min(s.minutos, 120) : 0,
    citas: citasDeParte(s, books).slice(0, 12),
  }));
  if (anuncios) partes.push({ titulo: ANUNCIOS, minutos: 0, citas: [] });
  return { mensaje: m.id, titulo: titulo.slice(0, 120), partes };
}

/** Los versículos de un pasaje elegido («Lucas 15:11-32» → del 11 al 32). Sin versículos, el capítulo entero. */
export function rangoDe(p: Pick<Pasaje, 'from' | 'to'> | null | undefined): Rango | null {
  if (!p?.from) return null;
  return { desde: p.from, hasta: Math.max(p.from, p.to ?? p.from) };
}

/** «versículos 11 al 32», «versículo 16». */
export const rangoTexto = (r: Rango) => (r.hasta > r.desde ? `versículos ${r.desde} al ${r.hasta}` : `versículo ${r.desde}`);

/** «solo los versículos 11 al 32», «solo el versículo 16». */
export const soloRango = (r: Rango) => `solo ${r.hasta > r.desde ? 'los' : 'el'} ${rangoTexto(r)}`;

/**
 * Lo que hace quien guía al llegar a una parte (−1 es la portada): la marca como la de ahora, pasa al pasaje de su
 * primera cita (o al del mensaje) con solo esos versículos y pone en todas las pantallas lo que escribió para el
 * grupo y su dinámica. Si la parte no tiene nada para el grupo, quita la tarjeta anterior.
 */
export function moverAParte(m: Mensaje, parte: number, books: Book[]) {
  const anuncios = anunciosDe(m);
  // Después de la última parte, los anuncios: una tarjeta con la lista, en el pasaje en que se terminó.
  if (anuncios.length && parte === Math.min(m.secciones.length, 29)) {
    return { parte, tarjeta: { tipo: 'parte' as const, titulo: ANUNCIOS, texto: anuncios.map((a) => `• ${a}`).join('\n').slice(0, 1500), minutos: null } };
  }
  const s = parte >= 0 ? m.secciones[parte] : undefined;
  const cita = s ? citasDeParte(s, books).map((c) => leerCita(c, books)).find(Boolean) : undefined;
  const pasaje = cita ? { book: cita.book, chapter: cita.chapter, from: cita.from, to: cita.to } : m.pasaje;
  const d = dinamica(s?.dinamica);
  const texto = s?.paraGrupo?.trim();
  return {
    parte,
    ...(pasaje && { libro: pasaje.book, capitulo: pasaje.chapter, rango: rangoDe(pasaje) }),
    tarjeta:
      s && (texto || d)
        ? { tipo: 'parte' as const, titulo: s.titulo.trim() || 'Sin título', texto: texto?.slice(0, 1500), pasos: d?.pasos, minutos: s.minutos || null }
        : null,
  };
}

/** Segundos que pasaron desde una hora del servidor, con el reloj del teléfono corregido. */
export function segundosDesde(desde: string | null | undefined, skewMs = 0, now = Date.now()) {
  if (!desde) return 0;
  return Math.max(0, Math.floor((now + skewMs - Date.parse(desde)) / 1000));
}

/** Los minutos que se planearon para todo el mensaje. */
export const minutosPlaneados = (partes: { minutos?: number }[]) => partes.reduce((n, p) => n + (p.minutos ?? 0), 0);

/** Cuánto del mensaje va, de 0 a 1: las partes terminadas y lo que lleva la de ahora (sin pasar de su tiempo). */
export function avance(g: Pick<Guion, 'partes' | 'parte'>, enLaParte: number) {
  if (g.parte < 0 || !g.partes.length) return 0;
  const total = minutosPlaneados(g.partes);
  // Sin minutos en el plan, cada parte pesa lo mismo.
  if (!total) return Math.min(1, (g.parte + 0.5) / g.partes.length);
  const hechas = minutosPlaneados(g.partes.slice(0, g.parte));
  const ahora = g.partes[g.parte].minutos;
  return Math.min(1, (hechas + Math.min(ahora, enLaParte / 60)) / total);
}
