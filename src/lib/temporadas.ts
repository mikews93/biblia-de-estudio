// Fechas del año cristiano para los retos de temporada. Sin dependencias de la app: también lo usa
// api/comunidades.ts para saber qué lectura le toca hoy a un grupo que sigue un reto.

import type { PlanDef, Season } from './planesCatalogo';

// ——— Fechas (siempre locales, «AAAA-MM-DD») ———

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const todayKey = () => dateKey(new Date());

export const daysBetween = (from: string, to: string) =>
  Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);

/** Domingo de Pascua (calendario gregoriano, algoritmo de Meeus). */
export function easter(year: number) {
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

/**
 * Fecha de cada lectura de una temporada:
 * - Cuaresma: del Miércoles de Ceniza a Pascua sin los domingos (la última lectura cae en Pascua);
 * - Semana Santa: del Domingo de Ramos al Domingo de Resurrección;
 * - Pentecostés: los diez días de espera, del viernes después de la Ascensión al domingo de Pentecostés;
 * - Adviento: del 1 al 25 de diciembre; Año nuevo: desde el 1 de enero.
 */
export function seasonDates(season: Season, year: number, count: number): string[] {
  const sunday = easter(year);
  if (season === 'cuaresma') {
    const out: string[] = [];
    let d = addDays(sunday, -46); // Miércoles de Ceniza
    while (out.length < count - 1) {
      if (d.getDay() !== 0) out.push(dateKey(d));
      d = addDays(d, 1);
    }
    return [...out, dateKey(sunday)];
  }
  const start =
    season === 'semana-santa'
      ? addDays(sunday, -7)
      : season === 'pentecostes'
        ? addDays(sunday, 49 - count + 1)
        : season === 'adviento'
          ? new Date(year, 11, 1)
          : new Date(year, 0, 1);
  return Array.from({ length: count }, (_, i) => dateKey(addDays(start, i)));
}

export type SeasonRun = {
  year: number;
  dates: string[];
  start: string;
  end: string;
  daysToStart: number;
  running: boolean;
};

/** La próxima edición de una temporada que aún no ha terminado (la en curso, o la siguiente). */
export function nextSeason(def: PlanDef, today = todayKey()): SeasonRun | null {
  const year = parseDate(today).getFullYear();
  for (const y of [year, year + 1]) {
    const run = seasonRun(def, y, today);
    if (run.end >= today) return run;
  }
  return null;
}

/** Una edición concreta («adviento-2026» → la de 2026). */
export function seasonRun(def: PlanDef, year: number, today = todayKey()): SeasonRun {
  const dates = seasonDates(def.season!, year, def.spec.length);
  const start = dates[0];
  const end = dates[dates.length - 1];
  return { year, dates, start, end, daysToStart: daysBetween(today, start), running: start <= today && today <= end };
}

/** «adviento-2026» → { def: 'adviento', year: 2026 }. */
export function parseRetoId(id: string) {
  const m = /^([a-z-]+)-(\d{4})$/.exec(id);
  return m ? { def: m[1], year: Number(m[2]) } : null;
}
