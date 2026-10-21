import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { Book, getWords } from './data';
import { PLANS, PlanDef } from './planesCatalogo';
import { cambio, Entradas, registrar } from './sincronia';
import { addDays, dateKey, nextSeason, parseDate, seasonDates, todayKey } from './temporadas';

// Planes de lectura personales, guardados en el dispositivo (y en la cuenta, si hay una). El avance se cuenta por capítulos leídos,
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
  /** Solo en los retos de temporada: índice de la lectura → lo que la persona respondió a la pregunta del día. */
  reflections?: Record<number, string>;
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

function write(plans: MyPlan[]) {
  state = { plans };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

function save(plans: MyPlan[]) {
  write(plans);
  cambio();
}

// En la cuenta cada plan es una entrada, y cada lectura hecha y cada respuesta de un reto, otra
// («adviento-2026/d/3», «adviento-2026/r/3»): lo leído en dos dispositivos se suma en vez de pisarse.
registrar<MyPlan[]>({
  nombre: 'planes',
  leer: () => load().then(() => state.plans),
  escribir: write,
  partir: (plans) => {
    const out: Entradas = {};
    for (const { done, reflections, finished: _, ...base } of plans) {
      out[base.id] = base;
      for (const [i, date] of Object.entries(done)) out[`${base.id}/d/${i}`] = date;
      for (const [i, text] of Object.entries(reflections ?? {})) out[`${base.id}/r/${i}`] = text;
    }
    return out;
  },
  unir: (entradas, antes) => {
    const plans = new Map<string, MyPlan>();
    for (const [k, v] of Object.entries(entradas)) if (!k.includes('/')) plans.set(k, { ...(v as MyPlan), done: {} });
    for (const [k, v] of Object.entries(entradas)) {
      const [id, kind, i] = k.split('/');
      const plan = plans.get(id);
      if (!plan || !i) continue;
      if (kind === 'd') plan.done[Number(i)] = v as string;
      if (kind === 'r') (plan.reflections ??= {})[Number(i)] = v as string;
    }
    for (const plan of plans.values()) {
      const dates = Object.values(plan.done);
      if (dates.length >= plan.readings.length) plan.finished = dates.sort().at(-1);
    }
    // Se conserva el orden que tenía el dispositivo; los planes que llegan de otro van primero.
    const order = antes.map((p) => p.id);
    return [...plans.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  },
  hora: (v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? Date.parse(v) : undefined),
});

// ——— Fechas: viven en temporadas.ts para que el servidor también las use ———

export { dateKey, nextSeason, parseDate, todayKey } from './temporadas';

// ——— Catálogo ———

/** Un plan del catálogo, o un plan propio con un libro («libro-rom»). */
export function planDef(id: string, books: Book[]): PlanDef | undefined {
  if (id.startsWith('libro-')) {
    const book = books.find((b) => b.id === id.slice(6));
    if (!book) return undefined;
    return { id, title: book.name, description: `Tu plan para leer ${book.name} completo.`, icon: '☰', icono: 'libro', spec: [[book.id]] };
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

/** Guarda (o borra, si queda vacía) la respuesta a la pregunta de un día del reto. */
export async function saveReflection(id: string, index: number, value: string) {
  await load();
  save(
    state.plans.map((p) => {
      if (p.id !== id) return p;
      const reflections = { ...p.reflections };
      if (value.trim()) reflections[index] = value.trim();
      else delete reflections[index];
      return { ...p, reflections };
    }),
  );
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
