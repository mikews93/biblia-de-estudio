// «Para ti» en Hoy: un versículo para lo que la persona está orando y uno o dos planes que le pueden ayudar.
//
// Todo se decide aquí, en el teléfono, con lo que ya está guardado: las peticiones del diario de oración, los capítulos
// leídos y los planes. No se envía nada a ningún servidor ni a la IA, no se guardan «intereses» y no hay analítica por
// tema. Lo que la persona elige en «Mis temas» pesa más que lo que se reconoce en sus oraciones, y siempre se puede
// explicar por qué sale cada cosa. Sin React Native, para probarlo en vitest.

import { dayNumber } from './daily';
import { PALABRAS_RIESGO, TEMAS, Tema, TemaId, Palabra, temaPorId } from './temas';

export type AjustesParaTi = {
  /** Encendido para todos (decisión de Mike, 2026-10-25); se apaga en «Mis temas» o en «¿Por qué veo esto?». */
  activo: boolean;
  /** Temas que la persona eligió a mano. */
  temas: TemaId[];
  /** Temas que pidió no ver, aunque aparezcan en sus oraciones. */
  ocultos: TemaId[];
  /** Fecha (AAAA-MM-DD) en que dijo «Ya tengo con quién hablar» en la tarjeta «No estás solo». */
  ayudaVista?: string;
};

export const PARA_TI_INICIAL: AjustesParaTi = { activo: true, temas: [], ocultos: [] };

/** Lo mínimo de una petición del diario (src/lib/oraciones.ts). */
export type OracionLeida = { id?: string; titulo: string; detalle?: string; created: number; respondida?: { fecha: number } };
/** Lo mínimo de un plan empezado (src/lib/planes.ts). */
export type PlanLeido = { def: string; finished?: string };

export type Motivo =
  | { tipo: 'elegido' }
  | { tipo: 'oracion'; titulo: string; id?: string }
  | { tipo: 'respondida'; titulo: string; id?: string };

export type TemaVivo = { tema: Tema; motivo: Motivo };

export type Sugerencia = { plan: string; porque: string; tema?: TemaId };

export type ParaTi = {
  temas: TemaVivo[];
  /** El versículo de hoy para uno de los temas, o null si no hay ninguno. */
  versiculo: { tema: Tema; palabra: Palabra } | null;
  planes: Sugerencia[];
  /** Una petición reciente habla de no querer vivir: primero, quién puede ayudar hoy. */
  riesgo: boolean;
};

const DIA = 86_400_000;
/** Las peticiones sin responder de los últimos seis meses dicen lo que la persona vive ahora. */
const VIGENCIA = 180 * DIA;
/** Una respuesta de Dios se celebra durante diez días. */
const CELEBRAR = 10 * DIA;
/** La tarjeta de ayuda mira las peticiones del último mes. */
const RIESGO = 30 * DIA;
/** Cuántos temas se turnan en Hoy. */
const MAXIMO = 3;

/** Minúsculas y sin tildes: «Ansiedad por el TRABAJO» → «ansiedad por el trabajo». */
export function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿Aparece alguna de las palabras al comienzo de una palabra del texto? */
export function contiene(texto: string, palabras: string[]) {
  const t = normalizar(texto);
  return palabras.some((p) => new RegExp(`(^|[^a-z0-9])${escapar(p)}`).test(t));
}

/** Los temas que se reconocen en un texto, en el orden del banco. */
export function temasDe(texto: string): Tema[] {
  return TEMAS.filter((t) => t.id !== 'gratitud' && contiene(texto, t.palabras));
}

const textoDe = (o: OracionLeida) => `${o.titulo}\n${o.detalle ?? ''}`;

export function enRiesgo(oraciones: OracionLeida[], ahora = Date.now()) {
  return oraciones.some((o) => !o.respondida && ahora - o.created <= RIESGO && contiene(textoDe(o), PALABRAS_RIESGO));
}

/** Temas vivos: primero los elegidos, después los de las oraciones (la más reciente primero), sin repetir ni ocultos. */
export function temasVivos(oraciones: OracionLeida[], ajustes: AjustesParaTi, ahora = Date.now(), maximo = MAXIMO): TemaVivo[] {
  const lista: TemaVivo[] = [];
  const ya = new Set<TemaId>(ajustes.ocultos);
  const sumar = (tema: Tema | undefined, motivo: Motivo) => {
    if (!tema || ya.has(tema.id)) return;
    ya.add(tema.id);
    lista.push({ tema, motivo });
  };
  for (const id of ajustes.temas) sumar(temaPorId(id), { tipo: 'elegido' });

  const recientes = [...oraciones].sort((a, b) => b.created - a.created);
  // Una petición respondida hace poco: unos días de gratitud
  const respondida = recientes
    .filter((o) => o.respondida && ahora - o.respondida.fecha <= CELEBRAR)
    .sort((a, b) => b.respondida!.fecha - a.respondida!.fecha)[0];
  if (respondida) sumar(temaPorId('gratitud'), { tipo: 'respondida', titulo: respondida.titulo, id: respondida.id });

  for (const o of recientes) {
    if (o.respondida || ahora - o.created > VIGENCIA) continue;
    const texto = textoDe(o);
    // Quien escribe que no quiere vivir está, como mínimo, en la tristeza
    let temas = temasDe(texto);
    // «Por la salud de mi mamá» es una petición por la salud: la familia es el contexto, no la necesidad
    if (temas.length > 1) temas = temas.filter((t) => t.id !== 'familia');
    if (contiene(texto, PALABRAS_RIESGO)) temas = [temaPorId('tristeza')!, ...temas];
    for (const t of temas) sumar(t, { tipo: 'oracion', titulo: o.titulo, id: o.id });
  }
  // Pocos temas a la vez: si se turnan demasiados, ninguno acompaña de verdad
  return lista.slice(0, maximo);
}

type Ref = { book: string; chapter: number; verse: number };

/** El versículo de hoy: los temas se turnan día a día, y dentro de cada uno sus versículos. */
export function versiculoDeHoy(temas: TemaVivo[], fecha = new Date(), comun?: Ref) {
  if (!temas.length) return null;
  const n = dayNumber(fecha);
  const tema = temas[n % temas.length].tema;
  const vs = tema.versiculos;
  let i = Math.floor(n / temas.length) % vs.length;
  const igual = ([b, c, v]: Palabra['ref']) => comun && b === comun.book && c === comun.chapter && v === comun.verse;
  // Si coincide con el versículo de todos, el siguiente: no se repite el mismo dos veces en Hoy
  if (igual(vs[i].ref)) i = (i + 1) % vs.length;
  return { tema, palabra: vs[i] };
}

/** Siguientes pasos según lo leído: de un evangelio a otro libro que ayuda a conocer a Jesús. */
const PASOS: { si: (leidos: (b: string) => number) => boolean; plan: string; porque: string }[] = [
  { si: (l) => l('jhn') >= 15, plan: 'romanos', porque: 'Leíste casi todo Juan. Romanos explica qué hizo Jesús por ti y qué significa creer.' },
  { si: (l) => l('mrk') >= 10 || l('mat') >= 15 || l('luk') >= 15, plan: 'juan', porque: 'Después de los otros evangelios, Juan te lleva más cerca de quién es Jesús.' },
  { si: (l) => l('rom') >= 10, plan: 'nt', porque: 'Después de Romanos, el Nuevo Testamento completo, a tu ritmo.' },
  { si: (l) => l('psa') >= 15, plan: 'proverbios', porque: 'Después de los Salmos, los Proverbios: sabiduría para cada día.' },
  { si: (l) => l('gen') >= 15, plan: 'marcos', porque: 'Del principio de todo al principio del evangelio: la vida de Jesús en Marcos.' },
];

export function planesParaTi(temas: TemaVivo[], capitulos: Record<string, number[]>, planes: PlanLeido[]): Sugerencia[] {
  const empezado = (id: string) => planes.some((p) => p.def === id);
  const out: Sugerencia[] = [];
  const porTema = temas.find((t) => t.tema.plan && !empezado(t.tema.plan));
  if (porTema)
    out.push({ plan: porTema.tema.plan!, tema: porTema.tema.id, porque: `Un plan corto, un capítulo al día, para ${porTema.tema.tuyo}.` });

  // Un siguiente paso solo si no hay ya un plan «a tu ritmo» en curso: no se trata de llenar la agenda
  const enCurso = planes.some((p) => !p.finished && !temaDePlan(p.def));
  if (!enCurso) {
    const leidos = (b: string) => capitulos[b]?.length ?? 0;
    const total = Object.values(capitulos).reduce((s, c) => s + c.length, 0);
    const paso =
      total === 0 && !planes.length
        ? { plan: 'juan', porque: 'Un buen primer paso: conocer a Jesús de cerca en el Evangelio de Juan.' }
        : PASOS.find((p) => p.si(leidos) && !empezado(p.plan));
    if (paso && !empezado(paso.plan)) out.push({ plan: paso.plan, porque: paso.porque });
  }
  return out.slice(0, 2);
}

const temaDePlan = (planId: string) => TEMAS.find((t) => t.plan === planId);

export function paraTi(entrada: {
  oraciones: OracionLeida[];
  capitulos: Record<string, number[]>;
  planes: PlanLeido[];
  ajustes: AjustesParaTi;
  fecha?: Date;
  comun?: Ref;
}): ParaTi {
  const fecha = entrada.fecha ?? new Date();
  const ahora = fecha.getTime();
  if (!entrada.ajustes.activo) return { temas: [], versiculo: null, planes: [], riesgo: enRiesgo(entrada.oraciones, ahora) };
  const temas = temasVivos(entrada.oraciones, entrada.ajustes, ahora);
  return {
    temas,
    versiculo: versiculoDeHoy(temas, fecha, entrada.comun),
    planes: planesParaTi(temas, entrada.capitulos, entrada.planes),
    riesgo: enRiesgo(entrada.oraciones, ahora),
  };
}
