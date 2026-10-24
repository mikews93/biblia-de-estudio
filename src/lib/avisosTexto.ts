// Qué dice el recordatorio diario y cuándo toca enviarlo. Sin dependencias: lo usan el servidor
// (api/notificaciones.ts, que lo envía) y la app (la vista previa en la pantalla de notificaciones).

export type Aviso = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** El despertador: el service worker lo muestra hasta que se toque, vibra y ofrece «10 minutos más». */
  alarma?: boolean;
};

export type DiaReto = { fecha: string; dia: number; titulo?: string; lectura?: string };

/** Lo que el dispositivo cuenta al servidor para armar el recordatorio (todo vive en el teléfono). */
export type EstadoAvisos = {
  /** Último día (fecha local) en que se leyó un capítulo. */
  leido?: string;
  /** Lo que toca leer: la lectura pendiente del plan o donde se quedó. */
  lectura?: { titulo: string; url: string };
  /** Fechas de repaso de las tarjetas, ordenadas. */
  tarjetas?: string[];
  /** El desafío de temporada en curso, con sus días aún sin leer. */
  reto?: { titulo: string; icono?: string; url: string; dias: DiaReto[] };
};

export type Preferencias = { lectura: boolean; tarjetas: boolean; reto: boolean };

export const HORA_POR_DEFECTO = 7 * 60;
/** Si el aviso se retrasa más que esto (el programador falló un rato), ya no se manda ese día. */
export const MAX_RETRASO = 4 * 60;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** El recordatorio de un día, o null si no hay nada que decir (ya leyó y no tiene tarjetas ni reto). */
export function dailyMessage(estado: EstadoAvisos, prefs: Preferencias, hoy: string): Aviso | null {
  const due = prefs.tarjetas ? (estado.tarjetas ?? []).filter((d) => d <= hoy).length : 0;
  const reto = prefs.reto ? estado.reto : undefined;
  const retoHoy = reto?.dias.find((d) => d.fecha === hoy);
  const cards = due ? `${plural(due, 'tarjeta', 'tarjetas')} para repasar` : '';

  if (reto && retoHoy) {
    const parts = [retoHoy.titulo ? `«${retoHoy.titulo}».` : '', retoHoy.lectura ? `Hoy toca ${retoHoy.lectura}.` : 'Hoy hay lectura nueva.'];
    if (cards) parts.push(`Y tienes ${cards}.`);
    return {
      title: `${reto.icono ? `${reto.icono} ` : ''}${reto.titulo} · Día ${retoHoy.dia}`,
      body: parts.filter(Boolean).join(' '),
      url: reto.url,
      tag: 'diario',
    };
  }
  if (prefs.lectura && estado.leido !== hoy) {
    const first = estado.lectura ? `${estado.lectura.titulo} te espera.` : 'Unos minutos con la Palabra hacen bien al alma.';
    const second = cards ? `También tienes ${cards}.` : estado.lectura ? 'Unos minutos con la Palabra hacen bien al alma.' : '¿Abrimos la Biblia?';
    return { title: 'Tu lectura de hoy', body: `${first} ${second}`, url: estado.lectura?.url ?? '/', tag: 'diario' };
  }
  if (due) {
    return {
      title: 'Repaso de hoy',
      body: `${plural(due, 'tarjeta te espera', 'tarjetas te esperan')} para no olvidar lo que estudiaste.`,
      url: '/repaso',
      tag: 'diario',
    };
  }
  return null;
}

/** Fecha y minuto del día en una zona horaria («America/Bogota»). Zona desconocida: UTC. */
export function localNow(zona: string, now = new Date()) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    return localNow('UTC', now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { fecha: `${get('year')}-${get('month')}-${get('day')}`, minutos: Number(get('hour')) * 60 + Number(get('minute')) };
}

export const validZone = (zona: unknown): zona is string => {
  if (typeof zona !== 'string' || !zona || zona.length > 60) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

/** ¿Toca mandar hoy el recordatorio? Ya pasó la hora elegida, no hace demasiado, y no se mandó hoy. */
export function isDue(s: { zona: string; hora: number; enviado: string | null }, now = new Date()) {
  const { fecha, minutos } = localNow(s.zona, now);
  const late = minutos - s.hora;
  return { due: late >= 0 && late <= MAX_RETRASO && s.enviado !== fecha, fecha };
}

/** «7:30 a. m.» → como lo dice la gente: 7:30 de la mañana, 1:00 de la tarde, 9:00 de la noche. */
export function horaLabel(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = String(minutos % 60).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const part = h < 5 ? 'de la madrugada' : h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche';
  return { hora: `${h12}:${m}`, parte: part };
}
