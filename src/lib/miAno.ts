// «Mi año con la Palabra»: un resumen del año al estilo de los «Wrapped», hecho solo con lo que la app ya guarda en el
// dispositivo (y en la cuenta): días con la Palabra, versículos resaltados, notas, diario, oraciones, palabras
// originales descubiertas y versículos compartidos. Nada se manda a ningún servidor para hacerlo.

import type { Entrada } from './diario';
import type { MyNote } from './notas';
import type { Oracion } from './oraciones';
import { type Estado, semanasConMeta } from './sellos';

export type Datos = {
  progreso: { chapters: Record<string, number[]>; days: string[] };
  sellos: Pick<Estado, 'huellas' | 'ganados'>;
  resaltados: Record<string, { at: number }>;
  notas: Record<string, MyNote>;
  diario: Entrada[];
  oraciones: Oracion[];
};

export type Resumen = {
  año: number;
  dias: number;
  semanasMeta: number;
  /** Capítulos leídos en total (el progreso no guarda la fecha de cada uno). */
  capitulos: number;
  resaltados: number;
  notas: number;
  diario: number;
  oraciones: number;
  respondidas: number;
  compartidos: number;
  sellos: number;
  /** Strong de las palabras hebreas o griegas que se abrieron por primera vez este año («G26»). */
  palabras: string[];
  /** El versículo al que más se volvió: resaltado, con nota, en el diario, en una oración, compartido. */
  versiculo: { book: string; chapter: number; verse: number } | null;
  /** El libro con más de todo eso. */
  libro: string | null;
};

const delAño = (año: number) => (ms: number) => new Date(ms).getFullYear() === año;
const fechaDelAño = (año: number) => (dia: string) => dia.startsWith(`${año}-`);

/** Las huellas de un tipo cuya fecha (la primera vez) cae en el año: devuelve sus ids. */
function huellasDelAño(huellas: Record<string, string>, tipo: string, año: number) {
  const pre = `${tipo}:`;
  return Object.entries(huellas)
    .filter(([k, fecha]) => k.startsWith(pre) && fechaDelAño(año)(fecha))
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([k]) => k.slice(pre.length));
}

export function resumenDelAño(d: Datos, año = new Date().getFullYear()): Resumen {
  const enAño = delAño(año);
  const { huellas, ganados } = d.sellos;
  // Los días salen del progreso (los últimos 120) y de las huellas de días, que guardan todo el año.
  const dias = [...new Set([...d.progreso.days.filter(fechaDelAño(año)), ...huellasDelAño(huellas, 'dia', año)])];

  // Puntos por versículo y por libro: lo que más se tocó durante el año.
  const puntos = new Map<string, { n: number; at: number }>();
  const sumar = (clave: string, n: number, at: number) => {
    const [book, chapter, verse] = clave.split('.');
    if (!book || !Number(chapter) || !Number(verse)) return;
    const k = `${book}.${Number(chapter)}.${Number(verse)}`;
    const p = puntos.get(k) ?? { n: 0, at: 0 };
    puntos.set(k, { n: p.n + n, at: Math.max(p.at, at) });
  };
  const resaltados = Object.entries(d.resaltados).filter(([, v]) => enAño(v.at));
  resaltados.forEach(([k, v]) => sumar(k, 2, v.at));
  const notas = Object.entries(d.notas).filter(([, v]) => enAño(v.created) || enAño(v.updated));
  notas.forEach(([k, v]) => sumar(k, 2, v.updated));
  const diario = d.diario.filter((e) => enAño(e.created));
  diario.forEach((e) => {
    const v = e.llevar?.verse ?? e.verse;
    if (v) sumar(`${e.book}.${e.chapter}.${v}`, 1, e.created);
  });
  const oraciones = d.oraciones.filter((o) => enAño(o.created));
  d.oraciones.forEach((o) => o.versiculos.filter((v) => enAño(v.added)).forEach((v) => sumar(`${v.book}.${v.chapter}.${v.verse}`, 1, v.added)));
  const compartidos = huellasDelAño(huellas, 'compartir', año);
  compartidos.forEach((k) => sumar(k, 2, Date.parse(huellas[`compartir:${k}`])));

  const mejor = [...puntos].sort((a, b) => b[1].n - a[1].n || b[1].at - a[1].at)[0];
  const porLibro = new Map<string, number>();
  puntos.forEach((p, k) => porLibro.set(k.split('.')[0], (porLibro.get(k.split('.')[0]) ?? 0) + p.n));
  const libro = [...porLibro].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const [b, c, v] = mejor?.[0].split('.') ?? [];

  return {
    año,
    dias: dias.length,
    semanasMeta: semanasConMeta(dias).length,
    capitulos: Object.values(d.progreso.chapters).reduce((n, caps) => n + caps.length, 0),
    resaltados: resaltados.length,
    notas: notas.length,
    diario: diario.length,
    oraciones: oraciones.length,
    respondidas: d.oraciones.filter((o) => o.respondida && enAño(o.respondida.fecha)).length,
    compartidos: compartidos.length,
    sellos: Object.values(ganados).filter((g) => fechaDelAño(año)(g.fecha)).length,
    palabras: huellasDelAño(huellas, 'palabra', año),
    versiculo: mejor ? { book: b, chapter: Number(c), verse: Number(v) } : null,
    libro,
  };
}

/** Si hay algo que contar: sin días ni nada guardado, la pantalla invita a empezar en vez de mostrar ceros. */
export const hayAlgo = (r: Resumen) => r.dias + r.resaltados + r.notas + r.diario + r.oraciones + r.compartidos + r.palabras.length > 0;
