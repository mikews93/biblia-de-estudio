import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { reportReading } from './comunidad';
import { lanzarConfeti } from './confeti';
import { markPlanReading } from './planes';
import { cambio, registrar } from './sincronia';

// Progreso de lectura guardado en el dispositivo (y en la cuenta, si hay una: ver sincronia.ts). La racha es semanal y perdona días:
// cuenta cuántos días distintos se leyó en la semana, con una meta de 5 de 7.

export const WEEKLY_GOAL = 5;
const KEY = 'progreso';

type Progress = { chapters: Record<string, number[]>; days: string[] };

let state: Progress = { chapters: {}, days: [] };
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = { ...state, ...JSON.parse(raw) };
    })
    .catch(() => {})
    .then(() => listeners.forEach((l) => l()));
  return loaded;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Días con la Palabra en la semana de hoy (de lunes a domingo). */
const diasDeLaSemana = (days: string[]) => weekDays(days).filter((d) => d.read).length;

/** Al sumar el día que completa la meta de la semana, una pequeña fiesta (una vez por semana). */
function nuevoDia(days: string[]) {
  const next = [...days, today()].slice(-120);
  if (diasDeLaSemana(days) < WEEKLY_GOAL && diasDeLaSemana(next) >= WEEKLY_GOAL) lanzarConfeti('fuegos');
  return next;
}

export async function markChapterRead(book: string, chapter: number) {
  await load();
  const read = new Set(state.chapters[book] ?? []);
  read.add(chapter);
  const days = state.days.includes(today()) ? state.days : nuevoDia(state.days);
  write({ chapters: { ...state.chapters, [book]: [...read].sort((a, b) => a - b) }, days });
  cambio();
  reportReading(book, chapter);
  markPlanReading(book, chapter);
}

/** Un día con la Palabra sin terminar un capítulo: explorar una palabra original, un lugar, una promesa… */
export async function markStudyDay() {
  await load();
  if (state.days.includes(today())) return;
  write({ ...state, days: nuevoDia(state.days) });
  cambio();
}

function write(next: Progress) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

// En la cuenta va un capítulo leído por entrada («c.jhn.3») y un día con lectura por entrada («d.2026-10-21»):
// lo leído en dos dispositivos se suma.
registrar<Progress>({
  nombre: 'progreso',
  leer: () => load().then(() => state),
  escribir: write,
  partir: (s) => {
    const out: Record<string, 1> = {};
    for (const [book, chapters] of Object.entries(s.chapters)) for (const c of chapters) out[`c.${book}.${c}`] = 1;
    for (const d of s.days) out[`d.${d}`] = 1;
    return out;
  },
  unir: (entradas) => {
    const chapters: Record<string, number[]> = {};
    const days: string[] = [];
    for (const k of Object.keys(entradas)) {
      if (k.startsWith('d.')) days.push(k.slice(2));
      else if (k.startsWith('c.')) {
        const [, book, c] = k.split('.');
        (chapters[book] ??= []).push(Number(c));
      }
    }
    for (const list of Object.values(chapters)) list.sort((a, b) => a - b);
    return { chapters, days: days.sort().slice(-120) };
  },
});

/** Lunes a domingo de la semana actual, con si hubo lectura ese día. */
export function weekDays(days: string[]) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { label: 'LMXJVSD'[i], read: days.includes(key), isToday: key === today() };
  });
}

export function useProgress() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
