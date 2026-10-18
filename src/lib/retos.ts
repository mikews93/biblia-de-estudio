// Retos de temporada: lo que se ve de cada uno (su color del año cristiano, el calendario, los hitos)
// sobre los planes de temporada de planes.ts. Gamificación suave: nada se pierde por un día sin leer,
// los hitos celebran la constancia y las preguntas invitan a leer despacio.

import type { MyPlan } from './planes';
import type { PlanDef, Season } from './planesCatalogo';
import { addDays, dateKey, parseDate, todayKey, type SeasonRun } from './temporadas';
import type { Colors } from './theme';

export type Tint = { accent: string; soft: string; name: string; meaning: string };

// Los colores litúrgicos de cada tiempo, ajustados para leerse bien en claro y en oscuro.
const TINTS: Record<Season, { light: [string, string]; dark: [string, string]; name: string; meaning: string }> = {
  adviento: {
    light: ['#5E3F8F', '#EEE7F7'],
    dark: ['#C3AEE8', '#2A2340'],
    name: 'Adviento',
    meaning: 'El morado del Adviento habla de espera y preparación.',
  },
  cuaresma: {
    light: ['#6B3A6E', '#F3E6F1'],
    dark: ['#DDB0DA', '#33212F'],
    name: 'Cuaresma',
    meaning: 'El morado de la Cuaresma habla de arrepentimiento y vuelta a Dios.',
  },
  'semana-santa': {
    light: ['#8E2F2F', '#F6E3E0'],
    dark: ['#EBA196', '#3A1F1C'],
    name: 'Semana Santa',
    meaning: 'El rojo de la Semana Santa recuerda la sangre de Cristo y su amor hasta el fin.',
  },
  pentecostes: {
    light: ['#B0461C', '#FBE8DB'],
    dark: ['#F2A97F', '#3D2418'],
    name: 'Pentecostés',
    meaning: 'El rojo de Pentecostés recuerda las lenguas de fuego del Espíritu Santo.',
  },
  'anio-nuevo': {
    light: ['#86650F', '#F7EED2'],
    dark: ['#E5C673', '#352D17'],
    name: 'Año nuevo',
    meaning: 'El dorado del año nuevo: empezar con fundamentos firmes.',
  },
};

/** El color del reto; `dark` según el tema de la app. */
export function seasonTint(season: Season, colors: Pick<Colors, 'background'>): Tint {
  const t = TINTS[season];
  // El fondo oscuro de la app es casi negro; con eso basta para elegir la variante
  const dark = parseInt(colors.background.slice(1, 3), 16) < 0x60;
  const [accent, soft] = dark ? t.dark : t.light;
  return { accent, soft, name: t.name, meaning: t.meaning };
}

export const seasonName = (season: Season) => TINTS[season].name;

// ——— Calendario ———

export type CalendarCell = {
  date: string;
  /** Índice de la lectura de ese día, o null en un día de descanso (los domingos de Cuaresma). */
  index: number | null;
  /** Fuera de las fechas del reto (relleno de la primera y la última semana). */
  outside: boolean;
};

/** Las semanas del reto, de lunes a domingo, con la lectura de cada día. */
export function calendarWeeks(dates: string[]): CalendarCell[][] {
  if (!dates.length) return [];
  const byDate = new Map(dates.map((d, i) => [d, i]));
  const first = parseDate(dates[0]);
  const last = dates[dates.length - 1];
  let d = addDays(first, -((first.getDay() + 6) % 7));
  const weeks: CalendarCell[][] = [];
  while (dateKey(d) <= last) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const key = dateKey(d);
      week.push({ date: key, index: byDate.get(key) ?? null, outside: key < dates[0] || key > last });
      d = addDays(d, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// ——— Avance e hitos ———

export type DayState = 'hecho' | 'hoy' | 'pendiente' | 'futuro';

export type Milestone = { at: number; label: string; reached: boolean };

/** Los hitos de un reto según su largo: el primer día, una semana, la mitad y el final. */
export function milestones(total: number, done: number): Milestone[] {
  const marks: [number, string][] = [[1, 'Primer paso']];
  if (total >= 14) marks.push([7, 'Una semana en camino']);
  const half = Math.ceil(total / 2);
  if (!marks.some(([n]) => n === half)) marks.push([half, 'Mitad del camino']);
  marks.push([total, 'Reto completo']);
  return marks.map(([at, label]) => ({ at, label, reached: done >= at }));
}

/** Palabras para celebrar cada hito, con un versículo (RV1909). */
export const CELEBRATIONS: Record<string, { text: string; verse: string; ref: string }> = {
  'Primer paso': {
    text: 'Empezaste. Lo importante no es correr, sino caminar con Él cada día.',
    verse: 'Lámpara es á mis pies tu palabra, y lumbrera á mi camino.',
    ref: 'Salmos 119:105',
  },
  'Una semana en camino': {
    text: 'Siete lecturas con la Palabra. Gracias por darle este tiempo.',
    verse: 'Gustad, y ved que es bueno Jehová.',
    ref: 'Salmos 34:8',
  },
  'Mitad del camino': {
    text: 'Llegaste a la mitad. Lo que has leído sigue obrando en ti.',
    verse: 'El que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo.',
    ref: 'Filipenses 1:6',
  },
  'Reto completo': {
    text: 'Terminaste el reto. Que lo leído se quede contigo mucho después de hoy.',
    verse: 'Sécase la hierba, cáese la flor: mas la palabra del Dios nuestro permanece para siempre.',
    ref: 'Isaías 40:8',
  },
};

/** Dónde va la persona en el reto. Ningún día se pierde: lo pendiente solo espera. */
export function retoProgress(plan: MyPlan, run: Pick<SeasonRun, 'dates'>, today = todayKey()) {
  const total = run.dates.length;
  const isDone = (i: number) => !!plan.done[i];
  const state = (i: number): DayState =>
    isDone(i) ? 'hecho' : run.dates[i] === today ? 'hoy' : run.dates[i] < today ? 'pendiente' : 'futuro';
  const done = run.dates.filter((_, i) => isDone(i)).length;
  const todayIndex = run.dates.indexOf(today);
  const next = run.dates.findIndex((_, i) => !isDone(i));
  const behind = run.dates.filter((d, i) => d < today && !isDone(i)).length;
  const marks = milestones(total, done);
  // Se celebra el hito recién alcanzado hasta la siguiente lectura
  const celebrate = marks.find((m) => m.at === done && done > 0)?.label ?? null;
  const reflections = Object.values(plan.reflections ?? {}).filter((r) => r.trim()).length;
  const started = run.dates[0] <= today;
  const ended = run.dates[total - 1] < today;
  return { total, done, todayIndex: todayIndex === -1 ? null : todayIndex, next: next === -1 ? null : next, behind, marks, celebrate, reflections, state, started, ended };
}

/** El día que se abre al entrar: el de hoy, o el primero pendiente, o el primero. */
export function focusDay(progress: ReturnType<typeof retoProgress>) {
  if (progress.todayIndex !== null && progress.state(progress.todayIndex) !== 'hecho') return progress.todayIndex;
  if (!progress.started) return 0;
  return progress.next ?? progress.total - 1;
}

/** La pregunta del reto para un capítulo recién leído (para el cierre del capítulo). */
export function questionFor(plan: MyPlan, def: PlanDef | undefined, book: string, chapter: number) {
  if (!def?.season || !def.questions) return null;
  const i = plan.readings.findIndex(([b, c]) => b === book && c === chapter);
  if (i === -1) return null;
  return { index: i, title: def.days?.[i], question: def.questions[i], answered: !!plan.reflections?.[i] };
}
