// «Del sermón a tu semana»: la persona escribe o dicta sus notas del sermón del domingo y la IA prepara cinco días
// de devocional sobre ese pasaje (api/estudiar.ts, campo «semana»). Cada día se hace con el devocional guiado
// (src/components/Devotional.tsx) y lo escrito va al diario. Se guarda en el dispositivo y, si hay cuenta, en ella.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Book } from './data';
import { type Source, askStudy } from './estudio';
import { cambio, registrar } from './sincronia';
import { type Pasaje, parsePasaje, pasajeLabel } from './taller';
import { addDays, dateKey, daysBetween, parseDate, todayKey } from './temporadas';
import { getSettings } from './theme';

export const DIAS = 5;
/** Lo que acepta el servidor (api/estudiar.ts, MAX_NOTAS). */
export const MAX_NOTAS = 8000;
export const MIN_NOTAS = 10;

export type Dia = {
  titulo: string;
  pasaje: Pasaje;
  /** «Juan 3:1-8», para mostrarlo sin cargar los libros. */
  referencia: string;
  /** La frase de las notas del domingo con la que se une este día. */
  domingo: string;
  /** Las secciones del devocional (Observa, Medita, Vive, Ora, Llévalo contigo), como las lee parseDevocional. */
  texto: string;
};

export type Semana = {
  id: string;
  titulo: string;
  pasaje: Pasaje;
  referencia: string;
  notas: string;
  predicador?: string;
  /** Día 1 («AAAA-MM-DD»): el lunes si se prepara en domingo; si no, el mismo día. */
  inicio: string;
  dias: Dia[];
  fuentes: Source[];
  /** Día (0 a 4) → id de la entrada del diario con la que se terminó. */
  hechos: Record<string, string>;
  creado: number;
};

const KEY = 'semanas';
const BORRADOR = 'semana-borrador';

let state: Semana[] = [];
let loaded: Promise<void> | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw) as Semana[];
    })
    .catch(() => {})
    .then(() => {
      isLoaded = true;
      listeners.forEach((l) => l());
    });
  return loaded;
}

function write(next: Semana[]) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

function save(next: Semana[]) {
  write(next);
  cambio();
}

registrar<Semana[]>({
  nombre: 'semanas',
  leer: () => load().then(() => state),
  escribir: write,
  partir: (s) => Object.fromEntries(s.map((w) => [w.id, w])),
  unir: (entradas) => (Object.values(entradas) as Semana[]).sort((a, b) => b.creado - a.creado),
  hora: (v) => (v as Semana).creado,
});

export function useSemanas() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { semanas: state, ready: isLoaded };
}

export async function guardarSemana(semana: Semana) {
  await load();
  save([semana, ...state.filter((w) => w.id !== semana.id)]);
}

export async function marcarHecho(id: string, dia: number, entrada: string) {
  await load();
  save(state.map((w) => (w.id === id ? { ...w, hechos: { ...w.hechos, [dia]: entrada } } : w)));
}

export async function borrarSemana(id: string) {
  await load();
  save(state.filter((w) => w.id !== id));
}

// ——— Borrador de las notas: no se pierde lo escrito al salir de la pantalla ———

export type Borrador = { pasaje: string; notas: string; predicador: string };

export async function leerBorrador(): Promise<Borrador | null> {
  const raw = await AsyncStorage.getItem(BORRADOR).catch(() => null);
  return raw ? (JSON.parse(raw) as Borrador) : null;
}

/** Guarda el borrador; también sirve para llegar a /semana/nueva con las notas de otro lugar (un evento). */
export async function guardarBorrador(b: Borrador) {
  await AsyncStorage.setItem(BORRADOR, JSON.stringify(b)).catch(() => {});
}

export const borrarBorrador = () => AsyncStorage.removeItem(BORRADOR).catch(() => {});

// ——— Fechas ———

/** El día 1: si se prepara en domingo (el día del sermón), empieza el lunes. */
export function inicioDesde(now = new Date()) {
  return dateKey(now.getDay() === 0 ? addDays(now, 1) : now);
}

/** La fecha de cada día. Los domingos no cuentan: son el día del siguiente sermón. */
export function fechaDia(s: Semana, dia: number) {
  let d = parseDate(s.inicio);
  for (let i = 0; i < dia; i++) {
    d = addDays(d, 1);
    if (d.getDay() === 0) d = addDays(d, 1);
  }
  return d;
}

/** El día que toca hoy (0 a 4), o -1 antes de empezar y DIAS después de terminar. */
export function diaDeHoy(s: Semana, hoy = todayKey()) {
  if (daysBetween(s.inicio, hoy) < 0) return -1;
  for (let i = 0; i < DIAS; i++) if (daysBetween(dateKey(fechaDia(s, i)), hoy) <= 0) return i;
  return DIAS;
}

export const hechos = (s: Semana) => Object.keys(s.hechos).length;

/** El primer día sin hacer, o null si la semana está completa. */
export function siguiente(s: Semana): number | null {
  for (let i = 0; i < s.dias.length; i++) if (!s.hechos[i]) return i;
  return null;
}

/** La semana que conviene mostrar en Hoy: la más reciente que tiene días sin hacer y no terminó hace más de una semana. */
export function semanaActiva(semanas: Semana[], hoy = todayKey()): Semana | null {
  return semanas.find((s) => siguiente(s) !== null && daysBetween(s.inicio, hoy) < DIAS + 7) ?? null;
}

// ——— La respuesta de la IA ———

/** Separa la respuesta en el título y los días; tolera que llegue a medias mientras se escribe. */
export function parseSemana(text: string, books: Book[], fallback: Pasaje): { titulo: string; dias: Dia[] } {
  const titulo = text.match(/^#\s+(.+?)\s*$/m)?.[1].replace(/\*\*/g, '').trim() ?? '';
  const partes = text.split(/^##\s+D[ií]a\s+/im).slice(1);
  const dias = partes.map((parte) => {
    const lines = parte.split('\n');
    const head = lines[0].replace(/^\d+\s*[·.:\-–—]?\s*/, '').replace(/\*\*/g, '').trim();
    const body = lines.slice(1).join('\n');
    const cita = body.match(/^\s*\**Pasaje\**\s*:\s*\**(.+?)\**\s*$/im)?.[1].trim() ?? '';
    const domingo = body.match(/^\s*\**Del domingo\**\s*:\s*\**(.+?)\**\s*$/im)?.[1].trim() ?? '';
    const pasaje = parsePasaje(cita.replace(/[.;]$/, ''), books) ?? fallback;
    const start = body.search(/^#{1,3}\s+Observa/im);
    return {
      titulo: head,
      pasaje,
      referencia: pasajeLabel(pasaje, books),
      domingo: domingo.replace(/^[«"“]+|[»"”]+$/g, '').trim(),
      texto: start >= 0 ? body.slice(start).trim() : '',
    };
  });
  return { titulo, dias };
}

/** Un día está completo cuando ya trae su versículo para llevar (la última sección). */
export const diaCompleto = (d: Dia) => /^#{1,3}\s+Ll[eé]valo/im.test(d.texto);

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Pide la semana a la IA. onUpdate recibe los días según van llegando. */
export async function prepararSemana(
  req: { pasaje: Pasaje; notas: string; predicador?: string },
  books: Book[],
  onUpdate: (parcial: { titulo: string; dias: Dia[] }) => void,
  signal?: AbortSignal,
): Promise<Semana> {
  const { pasaje, notas, predicador } = req;
  const { text, sources } = await askStudy(
    {
      book: pasaje.book,
      chapter: pasaje.chapter,
      messages: [],
      semana: { notas, desde: pasaje.from, hasta: pasaje.to, predicador: predicador || undefined },
      version: getSettings().version,
    },
    (t) => onUpdate(parseSemana(t, books, pasaje)),
    signal,
  );
  const { titulo, dias } = parseSemana(text, books, pasaje);
  const completos = dias.filter(diaCompleto).slice(0, DIAS);
  if (completos.length < 3) throw new Error('La IA no terminó de preparar la semana. Inténtalo de nuevo.');
  return {
    id: uid(),
    titulo: titulo || pasajeLabel(pasaje, books),
    pasaje,
    referencia: pasajeLabel(pasaje, books),
    notas,
    predicador: predicador || undefined,
    inicio: inicioDesde(),
    dias: completos,
    fuentes: sources,
    hechos: {},
    creado: Date.now(),
  };
}
