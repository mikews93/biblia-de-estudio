// Eventos de iglesia: quien predica publica el bosquejo de un mensaje del Taller con un código corto y la
// congregación lo sigue en el teléfono (/evento/CODIGO) mientras avanza, punto por punto, con los versículos a
// un toque y sus propias notas. El servidor es api/vivo.ts.
//
// Las notas y una copia de lo que se vio de cada evento se guardan en el dispositivo y, con cuenta, en ella
// (almacén «eventos» de la sincronía), así quedan en «Mis eventos» aunque el evento se borre después.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { askStudy } from './estudio';
import { parseCita } from './cita';
import { sessionKey } from './comunidad';
import { requireConnection } from './conexion';
import { type Book, getChapter } from './data';
import { type PreguntaRepaso, parseRepaso } from './repaso';
import { huella } from './sellos';
import { origenCompartir } from './sitio';
import { cambio, registrar } from './sincronia';
import { ANUNCIOS, type Mensaje, type Pasaje, actualizarMensaje, anunciosDe, ideaCentral, tituloDe } from './taller';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type EstadoEvento = 'pronto' | 'en-vivo' | 'terminado';
/** `minutos` y `dinamica` son para quien predica: el reloj del punto y la dinámica que puede mandar a los teléfonos. */
export type PuntoEvento = { titulo: string; texto: string; citas: string[]; minutos?: number; dinamica?: string };

export type Evento = {
  codigo: string;
  titulo: string;
  pasaje: Pasaje | null;
  idea: string | null;
  autor: string;
  iglesia: string | null;
  estado: EstadoEvento;
  /** El punto en que va quien predica; −1 es la portada (antes del primer punto). */
  punto: number;
  /** Si los puntos aparecen a medida que se avanza (los que vienen no llegan al teléfono). */
  gradual: boolean;
  total: number;
  puntos: PuntoEvento[];
  /** La versión en que lee quien predica: los versículos se abren en ella en cada teléfono. */
  version?: string;
  /** Cuándo empezó en vivo y cuándo llegó al punto de ahora: el reloj de quien predica. */
  inicio?: string | null;
  puntoDesde?: string | null;
  creado: string;
  actualizado: string;
  /** Lo que quien predica puso para que todos respondan (null: nada). */
  interaccion: Interaccion | null;
  resultados?: Resultados | null;
  /** Solo para quien lo publicó: el mensaje del Taller. */
  mensaje?: string;
  /** Solo para quien lo publicó: los grupos a los que se avisa cuando empieza en vivo. */
  grupos?: string[];
};

/**
 * Una pregunta abierta (las respuestas forman un muro al revelarla) o un repaso de opción múltiple, una pregunta
 * a la vez. La respuesta correcta llega como −1 hasta que se revela.
 */
export type Interaccion = {
  id: string;
  tipo: 'pregunta' | 'repaso' | 'dinamica';
  titulo: string;
  preguntas?: PreguntaRepaso[];
  paso: number;
  reveladas: number[];
  /** La ruleta del mensaje (en grupo o por equipos). */
  juego?: 'ruleta';
  modo?: 'grupo' | 'equipos';
  casillas?: Record<string, number>;
  giro?: number;
  /** Una dinámica del catálogo que la iglesia hace a la vez: sus pasos, el de ahora y el reloj. */
  dinamica?: string;
  objetivo?: string;
  pasos?: string[];
  minutos?: number | null;
  fin?: string | null;
};
export type Resultados = {
  /** Cuántos respondieron la pregunta de ahora. */
  respondieron: number;
  /** Votos por opción de las preguntas reveladas del repaso. */
  votos?: Record<number, number[]>;
  /** Las respuestas de la pregunta abierta: para quien predica siempre (con las ocultas), para los demás al revelar. */
  muro?: { id: number; texto: string; oculta: boolean }[];
  /** Ruleta: lo que suma la iglesia y cada equipo. */
  puntaje?: { grupo: number; equipos: number[] };
};

export const CODIGO_LARGO = 6;

/** El código como lo escriba la persona: «abc 234», «ABC-234» o el enlace entero. */
export function limpiarCodigo(input: string) {
  const raw = input.match(/evento\/([^/?#\s]+)/i)?.[1] ?? input;
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODIGO_LARGO);
}

/** «ABC234» → «ABC 234», para leerlo en voz alta o en la pantalla. */
export const codigoLegible = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

export const enlaceEvento = (codigo: string) => `${origenCompartir()}/evento/${codigo}`;
/** Sin «https://», para escribirlo a mano desde la pantalla de la iglesia. */
export const enlaceCorto = (codigo: string) => enlaceEvento(codigo).replace(/^https?:\/\//, '');

// Servidor

export class EventoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** El evento como lo ve la congregación (sin cuenta). */
export async function verEvento(codigo: string): Promise<Evento> {
  requireConnection();
  let res: Response;
  try {
    res = await fetch(`${API}/api/vivo?codigo=${encodeURIComponent(codigo)}`);
  } catch {
    throw new EventoError('No hay conexión. Para seguir el evento hace falta internet.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new EventoError(json.error ?? `Algo falló (${res.status})`, res.status);
  return json.evento as Evento;
}

async function accion<T>(nombre: string, body: Record<string, unknown> = {}): Promise<T> {
  requireConnection();
  const llave = await sessionKey();
  if (!llave) throw new EventoError('Para publicar un evento necesitas una cuenta.', 401);
  let res: Response;
  try {
    res = await fetch(`${API}/api/vivo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llave}` },
      body: JSON.stringify({ accion: nombre, ...body }),
    });
  } catch {
    throw new EventoError('No hay conexión. Inténtalo cuando vuelvas a tener internet.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new EventoError(json.error ?? `Algo falló (${res.status})`, res.status);
  return json as T;
}

// Mis eventos publicados: se piden una vez y se guardan en memoria mientras la app está abierta.
let mios: Evento[] | null = null;
let miosCargando: Promise<Evento[]> | null = null;
const escuchasMios = new Set<() => void>();

function ponerMio(e: Evento) {
  mios = [e, ...(mios ?? []).filter((x) => x.codigo !== e.codigo)];
  escuchasMios.forEach((l) => l());
  return e;
}

export function cargarMios(forzar = false) {
  if (forzar) miosCargando = null;
  miosCargando ??= accion<{ eventos: Evento[] }>('mios')
    .then((r) => {
      mios = r.eventos;
      escuchasMios.forEach((l) => l());
      return r.eventos;
    })
    .catch((e) => {
      miosCargando = null;
      throw e;
    });
  return miosCargando;
}

export function useMisEventos(activo: boolean) {
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    escuchasMios.add(l);
    if (activo) cargarMios().catch((e) => setError(e.message));
    return () => {
      escuchasMios.delete(l);
    };
  }, [activo]);
  return { eventos: activo ? mios : [], error };
}

export async function publicarEvento(datos: ReturnType<typeof contenidoDe> & { mensaje: string; gradual: boolean; version?: string }) {
  const evento = ponerMio((await accion<{ evento: Evento }>('publicar', datos)).evento);
  // Guiar un evento cuenta como servir a otros (src/lib/servicio.ts).
  huella('guiar', `evento:${evento.codigo}`).catch(() => {});
  return evento;
}

/**
 * Publica (o pone al día) el evento de un mensaje con lo que ya se eligió en el Taller, o lo de siempre: los puntos
 * a medida que se avanza y sin las notas completas. Lo usa «Mis sermones» para presentarlo en la iglesia de un toque.
 */
export async function publicarMensaje(m: Mensaje, books: Book[], version: string) {
  const conNotas = m.evento?.conNotas ?? false;
  const gradual = m.evento?.gradual ?? true;
  const e = await publicarEvento({ mensaje: m.id, gradual, version, ...contenidoDe(m, books, conNotas) });
  actualizarMensaje(m.id, { evento: { codigo: e.codigo, conNotas, gradual } });
  return e;
}

export const moverEvento = async (codigo: string, cambio: { punto?: number; estado?: EstadoEvento }) =>
  ponerMio((await accion<{ evento: Evento }>('mover', { codigo, ...cambio })).evento);

/** Los grupos a los que se avisa cuando el evento empieza en vivo (si ya empezó, se les avisa al momento). */
export async function gruposEvento(e: Evento, grupos: string[]) {
  const r = await accion<{ grupos: string[] }>('gruposEvento', { codigo: e.codigo, grupos });
  return ponerMio({ ...e, grupos: r.grupos });
}

export const verMiEvento = async (codigo: string) => ponerMio((await accion<{ evento: Evento }>('ver', { codigo })).evento);

// Interactuar en vivo: la congregación responde sin cuenta

export const interactuarEvento = async (
  codigo: string,
  cambio: {
    nueva?:
      | { tipo: 'pregunta' | 'repaso'; titulo: string; preguntas?: PreguntaRepaso[]; juego?: 'ruleta'; modo?: 'grupo' | 'equipos' }
      | { tipo: 'dinamica'; dinamica: string; minutos?: number };
    revelar?: true;
    paso?: number;
    reloj?: 'iniciar' | 'parar';
    girar?: true;
    quitar?: true;
  },
) => ponerMio((await accion<{ evento: Evento }>('interactuar', { codigo, ...cambio })).evento);

export const ocultarRespuesta = async (codigo: string, id: number, oculta: boolean) =>
  ponerMio((await accion<{ evento: Evento }>('ocultarRespuesta', { codigo, id, oculta })).evento);

const PARTICIPANTE = 'evento-participante';
let participante: Promise<string> | null = null;

/** El identificador de este teléfono para responder en los eventos: se inventa una vez, sin datos de la persona. */
export function participanteId() {
  participante ??= AsyncStorage.getItem(PARTICIPANTE)
    .catch(() => null)
    .then((id) => {
      if (id) return id;
      const nuevo = Array.from({ length: 24 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join('');
      AsyncStorage.setItem(PARTICIPANTE, nuevo).catch(() => {});
      return nuevo;
    });
  return participante;
}

export async function responderEvento(codigo: string, interaccion: string, respuesta: { texto: string } | { opcion: number }) {
  requireConnection();
  let res: Response;
  try {
    res = await fetch(`${API}/api/vivo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'responderEvento', codigo, interaccion, participante: await participanteId(), ...respuesta }),
    });
  } catch {
    throw new EventoError('No hay conexión. Vuelve a intentarlo.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new EventoError(json.error ?? `Algo falló (${res.status})`, res.status);
}

const repasosMensaje = new Map<string, Promise<PreguntaRepaso[]>>();

/**
 * El repaso de un mensaje: la IA del Taller prepara las preguntas con el bosquejo y el texto de todas sus citas
 * (un sermón suele recorrer varios pasajes, no un solo capítulo). Se pide una vez por evento mientras la app está abierta.
 */
export function repasoDelMensaje(e: Evento, books: Book[], juego: 'repaso' | 'ruleta' = 'repaso') {
  const clave = `${juego}:${e.codigo}`;
  let p = repasosMensaje.get(clave);
  if (p) return p;
  p = (async () => {
    const citas = [...new Set(e.puntos.flatMap((x) => x.citas))].slice(0, 20);
    const textos = await Promise.all(
      citas.map(async (c) => {
        const r = leerCita(c, books);
        if (!r) return null;
        const vs = await getChapter(r.book, r.chapter).catch(() => []);
        const t = vs
          .filter(([n]) => !r.from || (n >= r.from && n <= (r.to ?? r.from)))
          .map(([n, t]) => `${n} ${t}`)
          .join(' ')
          .slice(0, 700);
        return t ? `${c}: ${t}` : null;
      }),
    );
    const borrador = [
      `Título: ${e.titulo}`,
      e.idea ? `Idea central: ${e.idea}` : '',
      ...e.puntos.map((x, i) => `${i + 1}. ${x.titulo}${x.texto ? `\n${x.texto}` : ''}${x.citas.length ? `\nCitas: ${x.citas.join('; ')}` : ''}`),
      textos.some(Boolean) ? `Versículos (RV1909):\n${textos.filter(Boolean).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 11500);
    const pasaje = e.pasaje ?? leerCita(citas[0] ?? '', books) ?? null;
    if (!pasaje) throw new Error('El mensaje necesita un pasaje o una cita para preparar el repaso.');
    const r = await askStudy(
      {
        book: pasaje.book,
        chapter: pasaje.chapter,
        messages: [],
        taller: { modo: juego, tipo: 'sermon', paso: 'bosquejo', borrador },
      },
      () => {},
    );
    const qs = parseRepaso(r.text);
    if (!qs.length) throw new Error('No salió bien el repaso. Inténtalo otra vez.');
    return qs;
  })();
  p.catch(() => repasosMensaje.delete(clave));
  repasosMensaje.set(clave, p);
  return p;
}

export async function borrarEvento(codigo: string) {
  await accion('borrar', { codigo });
  mios = (mios ?? []).filter((x) => x.codigo !== codigo);
  escuchasMios.forEach((l) => l());
}

// Del Taller al evento

/** Junta en un texto las piezas no vacías, separadas por un párrafo. */
const juntar = (...partes: (string | undefined)[]) =>
  partes
    .map((p) => p?.trim())
    .filter(Boolean)
    .join('\n\n');

const CANDIDATA = /(?:\b[1-3]\s?)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}\.?\s+\d{1,3}\s*[:.]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?/g;

/** Las citas con versículo que aparecen en un texto («Romanos 5:8», «1 Jn 4:9-10»), escritas con el nombre del libro. */
export function citasEn(texto: string, books: Book[]): string[] {
  const out: string[] = [];
  for (const [candidata] of texto.matchAll(CANDIDATA)) {
    const c = parseCita(candidata, books);
    if (!c || c.problem || c.verse === undefined) continue;
    const name = books.find((b) => b.id === c.book)?.name ?? c.book;
    const label = `${name} ${c.chapter}:${c.verse}${c.verseEnd ? `-${c.verseEnd}` : ''}`;
    if (!out.includes(label)) out.push(label);
  }
  return out.slice(0, 12);
}

/**
 * Lo que se publica de un mensaje del Taller. Cada punto lleva lo que se escribió «para la congregación» (en un
 * encuentro, «para el grupo») y, si se elige, también las notas de quien predica. Las citas se sacan de todo,
 * aunque las notas no se muestren: los versículos del punto siempre llegan.
 */
export function contenidoDe(m: Mensaje, books: Book[], conNotas: boolean) {
  const puntos: PuntoEvento[] = m.secciones.map((s) => ({
    titulo: s.titulo.trim() || 'Sin título',
    texto: juntar(s.paraGrupo, conNotas ? s.texto : undefined),
    citas: citasEn(`${s.paraGrupo ?? ''}\n${s.texto}`, books),
    ...(s.minutos > 0 && { minutos: s.minutos }),
    ...(s.dinamica && { dinamica: s.dinamica }),
  }));
  // Los anuncios cierran el mensaje: la congregación los ve en su teléfono al llegar al final.
  const anuncios = anunciosDe(m);
  if (anuncios.length) puntos.push({ titulo: ANUNCIOS, texto: anuncios.map((a) => `• ${a}`).join('\n'), citas: [] });
  return { titulo: tituloDe(m, books), idea: ideaCentral(m), pasaje: m.pasaje, puntos };
}

/** Si lo publicado ya no coincide con el mensaje (se editó después de publicar, o se lee en otra versión). */
export function desactualizado(e: Evento, m: Mensaje, books: Book[], version?: string) {
  const c = contenidoDe(m, books, !!m.evento?.conNotas);
  // Postgres guarda el JSON con las claves en otro orden: se compara campo por campo.
  const pasaje = (p: Pasaje | null) => (p ? [p.book, p.chapter, p.from ?? null, p.to ?? null].join('.') : '');
  const punto = (p: PuntoEvento) => JSON.stringify([p.titulo, p.texto, p.citas, p.minutos ?? 0, p.dinamica ?? null]);
  return (
    (!!version && version !== (e.version ?? 'rv1909')) ||
    c.titulo !== e.titulo ||
    (c.idea || null) !== e.idea ||
    pasaje(c.pasaje) !== pasaje(e.pasaje) ||
    c.puntos.map(punto).join() !== e.puntos.map(punto).join()
  );
}

/** Una cita escrita («Romanos 5:8») lista para abrir el capítulo y mostrar los versículos. */
export function leerCita(label: string, books: Book[]) {
  const c = parseCita(label, books);
  if (!c || c.problem) return null;
  return { book: c.book, chapter: c.chapter, from: c.verse, to: c.verseEnd ?? c.verse };
}

// Lo que cada persona guarda de los eventos que siguió

export type Seguido = {
  codigo: string;
  titulo: string;
  pasaje: Pasaje | null;
  idea: string | null;
  autor: string;
  iglesia: string | null;
  /** Los puntos que llegó a ver (con «gradual», los que se fueron mostrando). */
  puntos: PuntoEvento[];
  total: number;
  /** Cuándo lo abrió por primera vez (ms). */
  visto: number;
  /** Último cambio de las notas o de la copia (ms). */
  actualizado: number;
  /** Notas por punto («0», «1»…) y la general («general»). */
  notas: Record<string, string>;
};

const KEY = 'eventos';
let state: Record<string, Seguido> = {};
let loaded: Promise<void> | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw) as Record<string, Seguido>;
    })
    .catch(() => {})
    .then(() => {
      isLoaded = true;
      listeners.forEach((l) => l());
    });
  return loaded;
}

function write(next: Record<string, Seguido>, now = false) {
  state = next;
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  const save = () => AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  if (now) save();
  else saveTimer = setTimeout(save, 400);
}

registrar<Record<string, Seguido>>({
  nombre: 'eventos',
  leer: () => load().then(() => state),
  escribir: (next) => write(next, true),
  partir: (s) => s,
  unir: (entradas) => entradas as Record<string, Seguido>,
  hora: (v) => (v as Seguido).actualizado,
});

/** Guarda la copia de lo que se ve del evento. Los puntos ya vistos se conservan aunque el servidor no los mande. */
export async function recordarEvento(e: Evento) {
  await load();
  const antes = state[e.codigo];
  const puntos = e.puntos.length >= (antes?.puntos.length ?? 0) ? e.puntos : [...e.puntos, ...antes!.puntos.slice(e.puntos.length)];
  const copia = { titulo: e.titulo, pasaje: e.pasaje, idea: e.idea, autor: e.autor, iglesia: e.iglesia, puntos, total: e.total };
  if (antes && JSON.stringify({ ...copia }) === JSON.stringify({ titulo: antes.titulo, pasaje: antes.pasaje, idea: antes.idea, autor: antes.autor, iglesia: antes.iglesia, puntos: antes.puntos, total: antes.total })) {
    return;
  }
  const now = Date.now();
  write({ ...state, [e.codigo]: { codigo: e.codigo, visto: antes?.visto ?? now, notas: antes?.notas ?? {}, ...copia, actualizado: now } });
  cambio('eventos');
}

/** Escribe la nota de un punto («0», «1»…) o la general («general»). */
export function guardarNotaEvento(codigo: string, donde: string, texto: string) {
  const antes = state[codigo];
  if (!antes) return;
  const notas = { ...antes.notas };
  if (texto.trim()) notas[donde] = texto;
  else delete notas[donde];
  write({ ...state, [codigo]: { ...antes, notas, actualizado: Date.now() } });
  cambio('eventos');
}

export function olvidarEvento(codigo: string) {
  const next = { ...state };
  delete next[codigo];
  write(next);
  cambio('eventos');
}

export const cuantasNotas = (s: Seguido) => Object.values(s.notas).filter((t) => t.trim()).length;

export function useEventosSeguidos() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { seguidos: state, ready: isLoaded };
}

/** Las notas de un evento como texto, para copiarlas o mandarlas. */
export function notasComoTexto(s: Seguido, pasaje: string) {
  const out = [s.titulo];
  if (pasaje && pasaje !== s.titulo) out.push(pasaje);
  out.push(`${s.autor}${s.iglesia ? ` · ${s.iglesia}` : ''}`);
  if (s.idea) out.push('', `Idea central: ${s.idea}`);
  s.puntos.forEach((p, i) => {
    const nota = s.notas[String(i)]?.trim();
    out.push('', `*${i + 1}. ${p.titulo}*`);
    if (p.citas.length) out.push(p.citas.join(' · '));
    if (nota) out.push(`Mi nota: ${nota}`);
  });
  const general = s.notas.general?.trim();
  if (general) out.push('', '*Mis notas*', general);
  return out.join('\n');
}
