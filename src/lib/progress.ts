import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Progreso de lectura guardado en el dispositivo. La racha es semanal y perdona días:
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

export async function markChapterRead(book: string, chapter: number) {
  await load();
  const read = new Set(state.chapters[book] ?? []);
  read.add(chapter);
  const days = state.days.includes(today()) ? state.days : [...state.days, today()].slice(-120);
  state = { chapters: { ...state.chapters, [book]: [...read].sort((a, b) => a - b) }, days };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

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
