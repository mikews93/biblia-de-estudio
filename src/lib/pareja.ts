// Las reglas de «En pareja» que comparten la app y el servidor (api/_pareja.ts): qué día toca, el cordón de los
// dos y las líneas de ayuda. Sin React Native.
//
// Gamificación suave, según la investigación (/mnt/project-files/investigacion/devocionales-parejas.md): una sola
// cuenta de los dos, nunca dos contadores que se comparen; se cuentan semanas y no días, y una semana floja no
// rompe nada.

import { DIAS_PLAN } from './parejaPlanes';

/** Días en que los dos respondieron, en una semana, para que la semana cuente en el cordón. */
export const DIAS_SEMANA = 3;

const lunes = (dia: string) => {
  const [y, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
  return f.toISOString().slice(0, 10);
};

const semanaAntes = (lun: string) => {
  const f = new Date(`${lun}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() - 7);
  return f.toISOString().slice(0, 10);
};

export type Cordon = {
  /** Días hechos juntos, en total: cada uno es un nudo del cordón. */
  nudos: number;
  /** Semanas seguidas con al menos DIAS_SEMANA días juntos (la semana en curso suma si ya llegó). */
  semanas: number;
  /** Días juntos en la semana en curso. */
  estaSemana: number;
  /** Si la racha sigue gracias a una semana de gracia. */
  gracia: boolean;
};

/**
 * El cordón de los dos a partir de los días hechos juntos («AAAA-MM-DD»). Una semana sin llegar a la meta se
 * perdona si la anterior sí llegó: hacen falta dos semanas flojas seguidas para que la racha vuelva a empezar.
 * La semana en curso nunca rompe la racha: todavía hay tiempo.
 */
export function cordon(dias: string[], hoy: string): Cordon {
  const porSemana = new Map<string, number>();
  for (const d of new Set(dias)) porSemana.set(lunes(d), (porSemana.get(lunes(d)) ?? 0) + 1);
  const actual = lunes(hoy);
  const estaSemana = porSemana.get(actual) ?? 0;
  const llega = (lun: string) => (porSemana.get(lun) ?? 0) >= DIAS_SEMANA;
  let semanas = llega(actual) ? 1 : 0;
  let gracia = false;
  let lun = semanaAntes(actual);
  const primera = [...porSemana.keys()].sort()[0];
  while (primera && lun >= primera) {
    if (llega(lun)) semanas++;
    else if (!gracia && llega(semanaAntes(lun)) && (semanas > 0 || lun === semanaAntes(actual))) gracia = true;
    else break;
    lun = semanaAntes(lun);
  }
  return { nudos: new Set(dias).size, semanas, estaSemana, gracia };
}

export type Progreso = {
  /** El día que toca (1 a DIAS_PLAN), o DIAS_PLAN + 1 si terminaron el plan. */
  dia: number;
  /** Si el día que toca ya se puede hacer hoy (uno nuevo se abre al día siguiente de terminar el anterior). */
  abierto: boolean;
  terminado: boolean;
};

/**
 * Qué día del plan toca. `hechos[n]` es la fecha en que los dos terminaron el día n (1 a 7). Un día nuevo se abre
 * cuando los dos respondieron el anterior y ya es otro día: un ritmo diario, sin atrasos que pesen.
 */
export function progreso(hechos: Record<number, string>, hoy: string): Progreso {
  let dia = 1;
  while (dia <= DIAS_PLAN && hechos[dia]) dia++;
  if (dia > DIAS_PLAN) return { dia, abierto: false, terminado: true };
  const antes = hechos[dia - 1];
  return { dia, abierto: dia === 1 || (!!antes && antes < hoy), terminado: false };
}

/** Un día se puede abrir si ya se hizo o si es el que toca y está abierto. */
export const diaAbierto = (n: number, p: Progreso, hechos: Record<number, string>) => !!hechos[n] || (n === p.dia && p.abierto);

// ——— Ayuda en caso de abuso ———

export type LineaAyuda = { pais: string; nombre: string; linea: string; tel: string; nota?: string };

/**
 * Líneas gratuitas por país (la mayoría atienden las 24 horas), de Mujeres Libres de Violencia en Iberoamérica
 * (https://mujereslibresdeviolenciaeniberoamerica.org/en/contactos-de-emergencia/), El Tiempo y el Gobierno del
 * Estado de México. Cambian con el tiempo: hay que confirmarlas en la fuente oficial de cada país antes de publicar.
 */
export const LINEAS_AYUDA: LineaAyuda[] = [
  { pais: 'AR', nombre: 'Argentina', linea: 'Línea 144', tel: '144' },
  { pais: 'BO', nombre: 'Bolivia', linea: 'Línea gratuita', tel: '800102414' },
  { pais: 'CL', nombre: 'Chile', linea: 'Fono 1455', tel: '1455' },
  { pais: 'CO', nombre: 'Colombia', linea: 'Línea 155', tel: '155' },
  { pais: 'CR', nombre: 'Costa Rica', linea: 'Emergencias', tel: '911' },
  { pais: 'EC', nombre: 'Ecuador', linea: 'Emergencias', tel: '911' },
  { pais: 'SV', nombre: 'El Salvador', linea: 'Línea 126', tel: '126' },
  { pais: 'ES', nombre: 'España', linea: '016', tel: '016', nota: 'No queda en la factura del teléfono.' },
  { pais: 'US', nombre: 'Estados Unidos', linea: 'Línea Nacional sobre la Violencia Doméstica', tel: '18007997233', nota: 'Atienden en español.' },
  { pais: 'GT', nombre: 'Guatemala', linea: 'Línea 110', tel: '110', nota: 'También el 1555.' },
  { pais: 'HN', nombre: 'Honduras', linea: 'Emergencias', tel: '911' },
  { pais: 'MX', nombre: 'México', linea: 'Emergencias', tel: '911' },
  { pais: 'NI', nombre: 'Nicaragua', linea: 'Línea 118', tel: '118' },
  { pais: 'PA', nombre: 'Panamá', linea: 'Línea 311', tel: '311' },
  { pais: 'PY', nombre: 'Paraguay', linea: 'Línea 137', tel: '137' },
  { pais: 'PE', nombre: 'Perú', linea: 'Línea 100', tel: '100' },
  { pais: 'DO', nombre: 'República Dominicana', linea: 'Línea 212', tel: '212' },
  { pais: 'UY', nombre: 'Uruguay', linea: 'Línea gratuita', tel: '08004141', nota: 'Desde un celular, *4141.' },
  { pais: 'VE', nombre: 'Venezuela', linea: 'Línea gratuita', tel: '08006853737' },
];

/** El número de emergencias del país (112 en España, 911 en casi toda América). */
export const emergencias = (pais: string) => (pais === 'ES' ? '112' : '911');

/** El país de la persona a partir del idioma del teléfono («es-CO» → «CO»), o null si no se sabe. */
export function paisDe(locale: string | undefined | null): string | null {
  const m = /[-_]([A-Za-z]{2})\b/.exec(locale ?? '');
  const pais = m?.[1].toUpperCase() ?? null;
  return pais && LINEAS_AYUDA.some((l) => l.pais === pais) ? pais : null;
}

/** Cómo se muestra un número: «1-800-799-7233», «0800 4141»… */
export function telefonoBonito(tel: string) {
  if (tel.length === 11 && tel.startsWith('1800')) return `1-800-${tel.slice(4, 7)}-${tel.slice(7)}`;
  if (tel.startsWith('0800')) return `0800 ${tel.slice(4).replace(/(\d{3})(\d{4})$/, '$1 $2')}`;
  if (tel.startsWith('800') && tel.length > 6) return `800 ${tel.slice(3, 5)} ${tel.slice(5)}`;
  return tel;
}
