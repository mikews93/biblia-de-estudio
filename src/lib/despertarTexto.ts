// El despertador («Despertar con la Biblia»): cuándo suena y qué dice el aviso. Sin dependencias: lo usan el
// servidor (api/notificaciones.ts, que lo manda por push en la web) y la app (ajustes y alarma nativa).

import { Aviso, localNow } from './avisosTexto';

/** Qué suena al abrir la pantalla de despertar, siempre sobre la música de amanecer. */
export type ModoDespertar = 'versiculo' | 'lectura' | 'musica';

export type Despertador = {
  activo: boolean;
  /** Minutos desde la medianoche (6:00 → 360). */
  hora: number;
  /** Días en que suena, como bits: 1 << 0 es domingo … 1 << 6 es sábado (Date.getDay()). */
  dias: number;
  modo: ModoDespertar;
};

export const TODOS_LOS_DIAS = 0b1111111;
export const ENTRE_SEMANA = 0b0111110;

export const DESPERTADOR_POR_DEFECTO: Despertador = { activo: false, hora: 6 * 60, dias: TODOS_LOS_DIAS, modo: 'versiculo' };

/** Si el aviso se retrasa más que esto, ya no suena ese día: un despertador tarde no sirve. */
export const MAX_RETRASO_DESPERTAR = 30;
/** «10 minutos más». */
export const POSPONER_MINUTOS = 10;

/** Lunes primero, como en un calendario en español. */
export const DIAS: { bit: number; corto: string; nombre: string }[] = [
  { bit: 1, corto: 'L', nombre: 'lunes' },
  { bit: 2, corto: 'M', nombre: 'martes' },
  { bit: 3, corto: 'X', nombre: 'miércoles' },
  { bit: 4, corto: 'J', nombre: 'jueves' },
  { bit: 5, corto: 'V', nombre: 'viernes' },
  { bit: 6, corto: 'S', nombre: 'sábado' },
  { bit: 0, corto: 'D', nombre: 'domingo' },
];

export const validDias = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= TODOS_LOS_DIAS;

/** Día de la semana (0 = domingo) de una fecha local «2026-10-24». */
export const weekday = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/** «Todos los días», «De lunes a viernes», «Fines de semana» o la lista («Lunes, miércoles y viernes»). */
export function diasLabel(dias: number) {
  if (dias === TODOS_LOS_DIAS) return 'Todos los días';
  if (dias === ENTRE_SEMANA) return 'De lunes a viernes';
  if (dias === 0b1000001) return 'Fines de semana';
  const names = DIAS.filter((d) => dias & (1 << d.bit)).map((d) => d.nombre);
  if (!names.length) return 'Ningún día';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
  return list[0].toUpperCase() + list.slice(1);
}

/**
 * ¿Toca sonar ahora? Hoy está entre sus días, ya llegó la hora (hace menos de media hora) y no sonó hoy.
 * También suena si la persona lo pospuso y ya pasaron los minutos.
 */
export function despertarDue(
  s: { zona: string; despertar: number | null; despertar_dias: number; despertar_enviado: string | null; pospuesto: Date | string | null },
  now = new Date(),
) {
  const { fecha, minutos } = localNow(s.zona, now);
  if (s.pospuesto && new Date(s.pospuesto).getTime() <= now.getTime()) return { due: true, fecha, pospuesto: true };
  if (s.despertar == null || !(s.despertar_dias & (1 << weekday(fecha)))) return { due: false, fecha, pospuesto: false };
  const late = minutos - s.despertar;
  return { due: late >= 0 && late <= MAX_RETRASO_DESPERTAR && s.despertar_enviado !== fecha, fecha, pospuesto: false };
}

/** El aviso del despertador. «lectura» es lo que toca leer hoy, si la app lo sabe. */
export function despertarMessage(opts: { lectura?: string; pospuesto?: boolean } = {}): Aviso {
  const body = opts.pospuesto
    ? 'Ya pasaron tus diez minutos. La música suave y la Palabra te esperan.'
    : opts.lectura
      ? `Música suave, el versículo del día y ${opts.lectura} te esperan. Toca para empezar el día con la Palabra.`
      : 'Música suave y el versículo del día te esperan. Toca para empezar el día con la Palabra.';
  return { title: 'Buenos días ☀', body, url: '/despertar?alarma=1', tag: 'despertar', alarma: true };
}
