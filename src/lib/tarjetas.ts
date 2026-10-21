import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { Source } from './estudio';
import { splitCites } from './herramientas';
import { dateKey } from './planes';
import { cambio, registrar } from './sincronia';

// Tarjetas de repaso con repetición espaciada, guardadas en el dispositivo (y en la cuenta, si hay una).
// Hay dos tipos: las que la IA prepara de un capítulo (pregunta y respuesta con su cita) y los
// versículos que la persona elige memorizar. El calendario sigue una versión sencilla de SM-2
// (el algoritmo de Anki): cada acierto alarga el intervalo según la facilidad de la tarjeta.

export type Grade = 'otra' | 'dificil' | 'bien' | 'facil';

export type Card = {
  id: string;
  kind: 'pregunta' | 'versiculo';
  book: string;
  chapter: number;
  /** Versículo al que remite la respuesta, si se sabe */
  verse?: number;
  front: string;
  back: string;
  /** Referencia legible («Juan 3:16») para mostrar en la tarjeta */
  label: string;
  created: number;
  due: string;
  /** Días hasta el próximo repaso (0: aún en aprendizaje) */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
};

const KEY = 'tarjetas';
const MIN_EASE = 1.3;
export const SESSION_SIZE = 20;

let state: Record<string, Card> = {};
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = JSON.parse(raw);
    })
    .catch(() => {})
    .then(() => listeners.forEach((l) => l()));
  return loaded;
}

function write(next: Record<string, Card>) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

function save(next: Record<string, Card>) {
  write(next);
  cambio();
}

registrar<Record<string, Card>>({
  nombre: 'tarjetas',
  leer: () => load().then(() => state),
  escribir: write,
  partir: (s) => s,
  unir: (entradas) => entradas as Record<string, Card>,
  hora: (v) => (v as Card).created,
});

export function useCards(): Record<string, Card> {
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

const today = () => dateKey(new Date());
const addDays = (days: number) => dateKey(new Date(Date.now() + days * 86_400_000));

export type NewCard = Pick<Card, 'kind' | 'book' | 'chapter' | 'verse' | 'front' | 'back' | 'label'>;

export const verseCardId = (book: string, chapter: number, verse: number) => `v.${book}.${chapter}.${verse}`;

/** Añade tarjetas nuevas (para repasar hoy mismo); las que ya existen conservan su calendario. */
export async function addCards(cards: (NewCard & { id: string })[]) {
  await load();
  const next = { ...state };
  for (const c of cards) {
    if (next[c.id]) continue;
    next[c.id] = { ...c, created: Date.now(), due: today(), interval: 0, ease: 2.5, reps: 0, lapses: 0 };
  }
  save(next);
}

export async function removeCards(ids: string[]) {
  await load();
  const next = { ...state };
  ids.forEach((id) => delete next[id]);
  save(next);
}

/** Próximo intervalo en días para cada respuesta posible (0: se vuelve a ver en esta sesión). */
export function schedule(card: Card, grade: Grade): Pick<Card, 'interval' | 'ease' | 'reps' | 'lapses'> {
  const { interval, ease, reps, lapses } = card;
  if (grade === 'otra') return { interval: 0, ease: Math.max(MIN_EASE, ease - 0.2), reps: 0, lapses: reps > 0 ? lapses + 1 : lapses };
  if (grade === 'dificil') return { interval: Math.max(1, Math.round(interval * 1.2)), ease: Math.max(MIN_EASE, ease - 0.15), reps: reps + 1, lapses };
  if (grade === 'bien') {
    const next = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
    return { interval: Math.max(next, interval + 1), ease, reps: reps + 1, lapses };
  }
  const next = reps === 0 ? 4 : Math.round(Math.max(interval, 1) * ease * 1.3);
  return { interval: Math.max(next, interval + 2), ease: ease + 0.15, reps: reps + 1, lapses };
}

export async function grade(id: string, g: Grade) {
  await load();
  const card = state[id];
  if (!card) return;
  const s = schedule(card, g);
  save({ ...state, [id]: { ...card, ...s, due: s.interval === 0 ? today() : addDays(s.interval) } });
}

/** Tarjetas para repasar hoy: primero las atrasadas, luego las nuevas. */
export function dueCards(cards: Record<string, Card>, book?: string, chapter?: number): Card[] {
  const t = today();
  return Object.values(cards)
    .filter((c) => c.due <= t && (!book || (c.book === book && c.chapter === chapter)))
    .sort((a, b) => Number(a.reps === 0) - Number(b.reps === 0) || a.due.localeCompare(b.due) || a.created - b.created);
}

/** «hoy», «1 día», «3 días», «2 meses»… */
export function intervalLabel(days: number): string {
  if (days <= 0) return 'hoy';
  if (days === 1) return '1 día';
  if (days < 30) return `${days} días`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 mes' : `${months} meses`;
}

/** Lee las tarjetas que escribió la IA («P: …» / «R: …») y les pone el versículo de su cita. */
export function parseCards(text: string, sources: Source[], book: string, chapter: number): NewCard[] {
  const out: NewCard[] = [];
  let q: string | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\*\*/g, '').trim();
    const p = line.match(/^(?:\d+[.)]\s*)?P\s*[:.]\s*(.+)$/i);
    const r = line.match(/^R\s*[:.]\s*(.+)$/i);
    if (p) q = splitCites(p[1]).text;
    else if (r && q) {
      const { text: back, cites } = splitCites(r[1]);
      const source = cites.map((n) => sources.find((s) => s.n === n)).find((s) => s?.ref?.startsWith(`${book}.${chapter}.`));
      const any = cites.map((n) => sources.find((s) => s.n === n)).find(Boolean);
      const verse = source?.ref ? Number(source.ref.split('.')[2]) : undefined;
      // La etiqueta solo hace falta si la cita es de otro pasaje; las del capítulo se nombran por su versículo.
      out.push({ kind: 'pregunta', book, chapter, verse, front: q, back, label: source ? '' : (any?.label ?? '') });
      q = null;
    } else if (line && out.length && !q && /⟦\d+⟧/.test(line)) {
      // Marcas de cita sueltas al final de una respuesta
      const last = out[out.length - 1];
      const cited = splitCites(line).cites.map((n) => sources.find((s) => s.n === n)).find((s) => s?.ref);
      if (!last.verse && cited?.ref?.startsWith(`${book}.${chapter}.`)) {
        out[out.length - 1] = { ...last, verse: Number(cited.ref.split('.')[2]), label: '' };
      }
    }
  }
  return out;
}

/** Identificador estable de una tarjeta de la IA, para no duplicarla si se guarda dos veces. */
export function questionCardId(book: string, chapter: number, front: string) {
  let h = 0;
  for (const ch of front.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `p.${book}.${chapter}.${(h >>> 0).toString(36)}`;
}
