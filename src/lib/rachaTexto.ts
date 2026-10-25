// La racha devocional: cuántos días seguidos lleva la persona haciendo su devocional. Sin dependencias: la usan la
// app (src/lib/racha.ts, Mi diario, Hoy) y el servidor (api/notificaciones.ts, que avisa antes de perderla).
//
// La racha perdona: hay un día libre por semana. Si un día no se pudo, la racha sigue, siempre que no se haya usado
// otro día libre en los seis días anteriores. Dos días seguidos sin devocional la reinician. Los días libres no
// suman a la cuenta: solo se cuentan los días con devocional.

import type { Aviso } from './avisosTexto';

export type Racha = {
  /** Días con devocional en la racha que sigue viva (0 si no hay). */
  actual: number;
  /** La racha más larga de todas. */
  mejor: number;
  hoyHecho: boolean;
  /**
   * Último día («AAAA-MM-DD») en que un devocional mantiene viva la racha: hoy si hoy es el último, mañana si hoy
   * puede ser el día libre… null sin racha.
   */
  vence: string | null;
  /** Días libres que la racha usó (ya pasados). */
  descansos: string[];
  /** Hoy (si aún no hay devocional) o mañana (si ya lo hay) puede ser día libre sin perder la racha. */
  descansoDisponible: boolean;
  /**
   * sin: no hay racha · hecha: hoy ya hubo devocional · libre: hoy aún no, pero hoy puede ser el día libre ·
   * riesgo: hoy es el último día para no perderla.
   */
  estado: 'sin' | 'hecha' | 'libre' | 'riesgo';
};

/** Días entre dos usos del día libre: uno por semana. */
export const SEMANA = 7;

/** Las metas de la racha, con su sello (src/lib/racha.ts). */
export const HITOS = [3, 7, 21, 40, 100, 365, 2555] as const;

const DIA = 86_400_000;
const num = (fecha: string) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DIA);
};
const fechaDe = (n: number) => new Date(n * DIA).toISOString().slice(0, 10);

/** Fecha local («AAAA-MM-DD») de un momento. */
export function fechaLocal(t: number | Date = Date.now()) {
  const d = typeof t === 'number' ? new Date(t) : t;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sumarDias(fecha: string, n: number) {
  return fechaDe(num(fecha) + n);
}

/** La racha a partir de los días con devocional (fechas locales «AAAA-MM-DD», en cualquier orden y con repetidos). */
export function calcularRacha(dias: Iterable<string>, hoy: string): Racha {
  const h = num(hoy);
  const hechos = new Set<number>();
  for (const d of dias) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && num(d) <= h) hechos.add(num(d));
  const vacia: Racha = { actual: 0, mejor: 0, hoyHecho: false, vence: null, descansos: [], descansoDisponible: false, estado: 'sin' };
  if (!hechos.size) return vacia;

  let actual = 0;
  let mejor = 0;
  let ultimoLibre = -Infinity;
  let descansos: number[] = [];
  // Del primer devocional hasta ayer: hoy aún puede llegar.
  for (let d = Math.min(...hechos); d < h; d++) {
    if (hechos.has(d)) {
      actual++;
      mejor = Math.max(mejor, actual);
    } else if (actual > 0 && d - ultimoLibre >= SEMANA) {
      ultimoLibre = d;
      descansos.push(d);
    } else {
      actual = 0;
      ultimoLibre = -Infinity;
      descansos = [];
    }
  }
  const hoyHecho = hechos.has(h);
  if (hoyHecho) {
    actual++;
    mejor = Math.max(mejor, actual);
  }
  if (!actual) return { ...vacia, mejor };

  // Si hoy ya hubo devocional, mañana puede ser el día libre; si no, hoy.
  const libre = hoyHecho ? h + 1 : h;
  const descansoDisponible = libre - ultimoLibre >= SEMANA;
  const vence = hoyHecho ? (descansoDisponible ? h + 2 : h + 1) : descansoDisponible ? h + 1 : h;
  return {
    actual,
    mejor,
    hoyHecho,
    vence: fechaDe(vence),
    descansos: descansos.map(fechaDe),
    descansoDisponible,
    estado: hoyHecho ? 'hecha' : descansoDisponible ? 'libre' : 'riesgo',
  };
}

/** La siguiente meta de la racha (null pasados los 365 días). */
export const siguienteHito = (dias: number) => HITOS.find((h) => h > dias) ?? null;

export const diasLabel = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

// ——— El aviso para no perderla ———

/** Hora local (minutos) del aviso de la racha: por la noche, cuando aún hay tiempo para el devocional. */
export const HORA_RACHA = 20 * 60;
/** Desde cuántos días se avisa: una racha de un día aún no es algo que perder. */
export const RACHA_MINIMA = 2;

/** Lo que el dispositivo cuenta al servidor sobre la racha. */
export type EstadoRacha = { dias: number; vence: string };

export function rachaParaAvisos(r: Racha): EstadoRacha | undefined {
  return r.actual >= RACHA_MINIMA && r.vence ? { dias: r.actual, vence: r.vence } : undefined;
}

/** ¿Toca avisar hoy? Es el último día de la racha, ya pasó la hora del aviso (sin pasarse de 4 horas) y no se avisó hoy. */
export function rachaDue(racha: EstadoRacha | undefined, local: { fecha: string; minutos: number }, enviado: string | null) {
  if (!racha || racha.dias < RACHA_MINIMA || racha.vence !== local.fecha || enviado === local.fecha) return false;
  const tarde = local.minutos - HORA_RACHA;
  return tarde >= 0 && tarde <= 4 * 60;
}

/** El aviso de la noche en que la racha está por perderse. */
export function rachaMessage(dias: number): Aviso {
  const meta = siguienteHito(dias);
  const falta = meta ? meta - dias : 0;
  const cerca = meta && falta <= 2 ? ` Te ${falta === 1 ? 'falta un día' : `faltan ${falta} días`} para los ${meta}.` : '';
  return {
    title: `Tu racha de ${diasLabel(dias)} te espera`,
    body: `Hoy es el último día para no perderla. Diez minutos con la Palabra bastan.${cerca}`,
    url: '/diario?hoy=1',
    tag: 'racha',
  };
}
