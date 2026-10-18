import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { Book, getWords } from './data';
import { PLANS, PlanDef, Season } from './planesCatalogo';

// Planes de lectura personales, guardados en el dispositivo. El avance se cuenta por capítulos leídos,
// no por fechas: si un día no se puede, el plan espera. Los de temporada tienen una fecha sugerida por día.

export { PLANS } from './planesCatalogo';
export type { PlanDef } from './planesCatalogo';

/** Lectura pausada, con tiempo para pensar: unas 150 palabras por minuto. */
const WORDS_PER_MINUTE = 150;
const DEFAULT_WORDS = 600;
export const MINUTE_OPTIONS = [5, 10, 15, 20, 30];
export const DAYS_OPTIONS = [3, 4, 5, 6, 7];

export type Reading = [book: string, chapter: number];

export type MyPlan = {
  /** El id del plan; en los de temporada lleva el año («adviento-2026»). */
  id: string;
  def: string;
  title: string;
  readings: Reading[];
  /** Minutos al día (solo en los planes a tu ritmo). */
  minutes: number;
  /** Días por semana que la persona quiere leer. */
  daysPerWeek: number;
  started: string;
  /** Índice de la lectura → fecha en que se leyó. */
  done: Record<number, string>;
  finished?: string;
};

export type PlanDay = { readings: number[]; title?: string; date?: string };

const KEY = 'planes';

let state: { plans: MyPlan[] } = { plans: [] };
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

function save(plans: MyPlan[]) {
  state = { plans };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

// ——— Fechas (siempre locales, «AAAA-MM-DD») ———

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const todayKey = () => dateKey(new Date());

/** Domingo de Pascua (calendario gregoriano, algoritmo de Meeus). */
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Fecha de cada lectura de una temporada. En Cuaresma se saltan los domingos y la última cae en Pascua. */
function seasonDates(season: Season, year: number, count: number): string[] {
  if (season === 'cuaresma') {
    const sunday = easter(year);
    const out: string[] = [];
    let d = addDays(sunday, -46); // Miércoles de Ceniza
    while (out.length < count - 1) {
      if (d.getDay() !== 0) out.push(dateKey(d));
      d = addDays(d, 1);
    }
    return [...out, dateKey(sunday)];
  }
  const start = season === 'adviento' ? new Date(year, 11, 1) : new Date(year, 0, 1);
  return Array.from({ length: count }, (_, i) => dateKey(addDays(start, i)));
}

/** La próxima edición de una temporada que aún no ha terminado (la en curso, o la siguiente). */
export function nextSeason(def: PlanDef, today = todayKey()) {
  const year = parseDate(today).getFullYear();
  for (const y of [year, year + 1]) {
    const dates = seasonDates(def.season!, y, def.spec.length);
    if (dates[dates.length - 1] >= today) {
      const start = dates[0];
      const daysToStart = Math.round((parseDate(start).getTime() - parseDate(today).getTime()) / 86_400_000);
      return { year: y, dates, start, end: dates[dates.length - 1], daysToStart, running: start <= today };
    }
  }
  return null;
}

// ——— Catálogo ———

/** Un plan del catálogo, o un plan propio con un libro («libro-rom»). */
export function planDef(id: string, books: Book[]): PlanDef | undefined {
  if (id.startsWith('libro-')) {
    const book = books.find((b) => b.id === id.slice(6));
    if (!book) return undefined;
    return { id, title: book.name, description: `Tu plan para leer ${book.name} completo.`, icon: '☰', spec: [[book.id]] };
  }
  return PLANS.find((p) => p.id === id);
}

export function expand(def: PlanDef, books: Book[]): Reading[] {
  return def.spec.flatMap(([book, chapter]) => {
    if (chapter) return [[book, chapter] as Reading];
    const n = books.find((b) => b.id === book)?.chapters ?? 0;
    return Array.from({ length: n }, (_, i) => [book, i + 1] as Reading);
  });
}

// ——— Tiempo ———

export type Words = Record<string, number[]>;

let words: Words | null = null;

export function useWords(): Words | null {
  const [w, setW] = useState(words);
  useEffect(() => {
    if (!words)
      getWords()
        .then((x) => setW((words = x)))
        .catch(() => setW((words = {})));
  }, []);
  return w;
}

export const minutesOf = ([book, chapter]: Reading, w: Words | null) =>
  (w?.[book]?.[chapter - 1] ?? DEFAULT_WORDS) / WORDS_PER_MINUTE;

/** Reparte los capítulos en días de unos `minutes` minutos, sin partir capítulos. */
export function splitByTime(readings: Reading[], minutes: number, w: Words | null): number[][] {
  const days: number[][] = [];
  let cur: number[] = [];
  let total = 0;
  readings.forEach((r, i) => {
    const m = minutesOf(r, w);
    // Se admite pasarse un poco antes que dejar un día casi vacío
    if (cur.length && total + m > minutes * 1.2) {
      days.push(cur);
      cur = [];
      total = 0;
    }
    cur.push(i);
    total += m;
  });
  if (cur.length) days.push(cur);
  return days;
}

/** Los días del plan: por tiempo en los de a tu ritmo; uno por fecha en los de temporada. */
export function planDays(plan: MyPlan, def: PlanDef | undefined, w: Words | null): PlanDay[] {
  if (def?.season) {
    const dates = seasonDates(def.season, Number(plan.id.split('-').pop()), plan.readings.length);
    return plan.readings.map((_, i) => ({ readings: [i], title: def.days?.[i], date: dates[i] }));
  }
  return splitByTime(plan.readings, plan.minutes, w).map((readings) => ({ readings }));
}

export function dayMinutes(plan: MyPlan, day: PlanDay, w: Words | null) {
  return Math.max(1, Math.round(day.readings.reduce((s, i) => s + minutesOf(plan.readings[i], w), 0)));
}

/** Dónde va la persona: el primer día con algo sin leer y, en temporada, el día que toca por fecha. */
export function planStatus(plan: MyPlan, days: PlanDay[], today = todayKey()) {
  const isDone = (d: PlanDay) => d.readings.every((i) => plan.done[i]);
  const next = days.findIndex((d) => !isDone(d));
  const doneDays = days.filter(isDone).length;
  let scheduled: number | null = null;
  if (days[0]?.date) {
    const idx = days.findLastIndex((d) => d.date! <= today);
    scheduled = idx;
  }
  /** Lecturas de temporada cuya fecha ya pasó y siguen sin leer. */
  const behind = scheduled === null ? 0 : days.slice(0, scheduled + 1).filter((d) => !isDone(d)).length;
  const remaining = days.length - doneDays;
  const weeks = remaining / Math.max(1, plan.daysPerWeek);
  const estimatedEnd = dateKey(addDays(parseDate(today), Math.ceil(weeks * 7) - 1));
  return { next: next === -1 ? null : next, doneDays, scheduled, behind, remaining, estimatedEnd };
}

// ——— Guardado ———

export async function startPlan(def: PlanDef, books: Book[], opts: { minutes: number; daysPerWeek: number }) {
  await load();
  const season = def.season ? nextSeason(def) : null;
  const id = season ? `${def.id}-${season.year}` : def.id;
  const plan: MyPlan = {
    id,
    def: def.id,
    title: def.title,
    readings: expand(def, books),
    minutes: opts.minutes,
    daysPerWeek: def.season ? 7 : opts.daysPerWeek,
    started: season?.start ?? todayKey(),
    done: {},
  };
  save([plan, ...state.plans.filter((p) => p.id !== id)]);
  return plan;
}

export async function updatePlan(id: string, patch: Partial<Pick<MyPlan, 'minutes' | 'daysPerWeek'>>) {
  await load();
  save(state.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export async function removePlan(id: string) {
  await load();
  save(state.plans.filter((p) => p.id !== id));
}

/** Al terminar un capítulo: cuenta para la primera lectura pendiente que coincida en cada plan ya empezado. */
export async function markPlanReading(book: string, chapter: number) {
  await load();
  const today = todayKey();
  let changed = false;
  const plans = state.plans.map((p) => {
    if (p.finished || p.started > today) return p;
    const i = p.readings.findIndex(([b, c], idx) => b === book && c === chapter && !p.done[idx]);
    if (i === -1) return p;
    changed = true;
    const done = { ...p.done, [i]: today };
    const finished = Object.keys(done).length === p.readings.length ? today : undefined;
    return { ...p, done, finished };
  });
  if (changed) save(plans);
}

/** Planes activos que tienen este capítulo pendiente. */
export const plansWaitingFor = (plans: MyPlan[], book: string, chapter: number) =>
  plans.filter((p) => !p.finished && p.started <= todayKey() && p.readings.some(([b, c], i) => b === book && c === chapter && !p.done[i]));

export function usePlans() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state.plans;
}
