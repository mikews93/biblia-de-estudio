// «Mi actividad» en Mi diario: todo lo que la persona hizo cada día, junto. Une el registro de actividad
// (src/lib/actividad.ts: devocionales, estudios profundos, capítulos, lo escuchado) con lo que otros almacenes ya
// guardan con su fecha: resaltados, notas, oraciones y sellos. Sin dependencias de la interfaz, para probarla.

import type { Registro, TipoActividad } from './actividad';
import type { Entrada } from './diario';
import type { Oracion } from './oraciones';
import { fechaLocal } from './rachaTexto';
import { chapterHref, verseHref } from './routes';

export type TipoItem = TipoActividad | 'resaltados' | 'nota' | 'oracion' | 'respondida' | 'sello';

export type Item = {
  id: string;
  tipo: TipoItem;
  /** Hora (ms) o null si solo se sabe el día (un sello ganado). */
  t: number | null;
  titulo: string;
  detalle?: string;
  href?: string;
};

export type Dia = { fecha: string; items: Item[] };

export type Fuentes = {
  registro: Registro;
  diario: Entrada[];
  resaltados: Record<string, { at: number }>;
  notas: Record<string, { text: string; created: number; updated: number }>;
  oraciones: Oracion[];
  sellos: { id: string; titulo: string; fecha: string }[];
  /** Nombre del libro por su id («jhn» → «Juan»). */
  nombre: (book: string) => string;
};

/** Lo escuchado: el pódcast, el audio dramatizado, el hebreo o griego y la lectura en voz alta. */
export const ESCUCHADO: TipoItem[] = ['podcast', 'dramatizado', 'original', 'escuchar'];

const VERBO: Partial<Record<TipoItem, string>> = {
  profundo: 'Estudio profundo de',
  podcast: 'Escuchaste el pódcast de',
  dramatizado: 'Escuchaste dramatizado',
  original: 'Escuchaste en el original',
  escuchar: 'Escuchaste',
};

const corto = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** «jhn.3» o «jhn.3.16» → partes; el resto (una palabra «w4») se ignora. */
function partes(ref: string) {
  const [book, c, v] = ref.split('.');
  const chapter = Number(c);
  const verse = Number(v);
  return { book, chapter, verse: Number.isInteger(verse) && verse > 0 ? verse : undefined };
}

/** Todo lo hecho, por día, del más reciente al más antiguo. */
export function construirActividad(f: Fuentes): Dia[] {
  const items: (Item & { fecha: string })[] = [];
  const nombreCap = (book: string, chapter: number) => `${f.nombre(book)} ${chapter}`;
  const conDiario = new Set(f.diario.map((e) => `${fechaLocal(e.created)}|${e.book}.${e.chapter}${e.verse ? `.${e.verse}` : ''}`));

  // Capítulos leídos: uno por día, con todos los capítulos de ese día.
  const capitulos = new Map<string, { t: number; refs: string[] }>();

  for (const [k, e] of Object.entries(f.registro)) {
    const [fecha, , ref] = k.split('|');
    if (e.tipo === 'capitulo') {
      const dia = capitulos.get(fecha) ?? { t: 0, refs: [] };
      dia.t = Math.max(dia.t, e.t);
      dia.refs.push(ref);
      capitulos.set(fecha, dia);
      continue;
    }
    // El devocional con entrada en el diario se muestra con lo que la persona escribió (más abajo).
    if (e.tipo === 'devocional' && conDiario.has(`${fecha}|${ref}`)) continue;
    const { book, chapter } = partes(ref);
    const titulo = e.titulo || (chapter ? nombreCap(book, chapter) : ref);
    items.push({
      id: k,
      fecha,
      tipo: e.tipo,
      t: e.t,
      titulo: e.tipo === 'devocional' ? `Devocional en ${titulo}` : `${VERBO[e.tipo] ?? ''} ${titulo}`.trim(),
      href: e.href ?? (chapter ? chapterHref(book, chapter) : undefined),
    });
  }

  for (const [fecha, { t, refs }] of capitulos) {
    const orden = [...new Set(refs)].map(partes).sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter);
    const nombres = orden.map((p) => nombreCap(p.book, p.chapter));
    items.push({
      id: `${fecha}|capitulos`,
      fecha,
      tipo: 'capitulo',
      t,
      titulo: nombres.length === 1 ? `Leíste ${nombres[0]}` : `Leíste ${nombres.length} capítulos`,
      detalle: nombres.length > 1 ? nombres.join(' · ') : undefined,
      href: chapterHref(orden[orden.length - 1].book, orden[orden.length - 1].chapter),
    });
  }

  for (const e of f.diario) {
    items.push({
      id: `diario:${e.id}`,
      fecha: fechaLocal(e.created),
      tipo: 'devocional',
      t: e.created,
      titulo: `Devocional en ${e.reference}`,
      detalle: e.palabra ? corto(e.palabra) : e.paso ? `Mi paso: ${corto(e.paso)}` : undefined,
      href: '/diario?vista=devocionales',
    });
  }

  // Resaltados: los de un mismo capítulo y día, juntos.
  const resaltados = new Map<string, { t: number; book: string; chapter: number; verses: number[] }>();
  for (const [k, h] of Object.entries(f.resaltados)) {
    const { book, chapter, verse } = partes(k);
    if (!chapter || !verse || !h?.at) continue;
    const id = `${fechaLocal(h.at)}|${book}.${chapter}`;
    const g = resaltados.get(id) ?? { t: 0, book, chapter, verses: [] };
    g.t = Math.max(g.t, h.at);
    g.verses.push(verse);
    resaltados.set(id, g);
  }
  for (const [id, g] of resaltados) {
    const verses = g.verses.sort((a, b) => a - b);
    items.push({
      id: `resaltados:${id}`,
      fecha: id.slice(0, 10),
      tipo: 'resaltados',
      t: g.t,
      titulo:
        verses.length === 1
          ? `Resaltaste ${nombreCap(g.book, g.chapter)}:${verses[0]}`
          : `Resaltaste ${verses.length} versículos en ${nombreCap(g.book, g.chapter)}`,
      detalle: verses.length > 1 ? `Versículos ${verses.join(', ')}` : undefined,
      href: verseHref(g.book, g.chapter, verses[0]),
    });
  }

  for (const [k, n] of Object.entries(f.notas)) {
    const { book, chapter, verse } = partes(k);
    if (!chapter || !verse || !n?.updated) continue;
    items.push({
      id: `nota:${k}`,
      fecha: fechaLocal(n.updated),
      tipo: 'nota',
      t: n.updated,
      titulo: `${n.updated - n.created > 60_000 ? 'Editaste tu nota' : 'Escribiste una nota'} en ${nombreCap(book, chapter)}:${verse}`,
      detalle: corto(n.text),
      href: verseHref(book, chapter, verse),
    });
  }

  for (const o of f.oraciones) {
    items.push({
      id: `oracion:${o.id}`,
      fecha: fechaLocal(o.created),
      tipo: 'oracion',
      t: o.created,
      titulo: `Empezaste a orar por «${corto(o.titulo, 60)}»`,
      href: '/diario?vista=oraciones',
    });
    if (o.respondida) {
      items.push({
        id: `respondida:${o.id}`,
        fecha: fechaLocal(o.respondida.fecha),
        tipo: 'respondida',
        t: o.respondida.fecha,
        titulo: `Dios respondió: «${corto(o.titulo, 60)}»`,
        detalle: o.respondida.nota ? corto(o.respondida.nota) : undefined,
        href: '/diario?vista=oraciones',
      });
    }
  }

  for (const s of f.sellos) {
    items.push({ id: `sello:${s.id}`, fecha: s.fecha, tipo: 'sello', t: null, titulo: `Ganaste el sello «${s.titulo}»`, href: `/sellos?sello=${s.id}` });
  }

  const dias = new Map<string, Item[]>();
  for (const { fecha, ...item } of items) {
    const lista = dias.get(fecha) ?? [];
    lista.push(item);
    dias.set(fecha, lista);
  }
  return [...dias]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, lista]) => ({ fecha, items: lista.sort((a, b) => (b.t ?? 0) - (a.t ?? 0)) }));
}

export type ResumenDia = { devocional: boolean; profundo: boolean; lectura: boolean; escuchado: boolean; total: number };

/** Lo que se hizo un día, para la lista de «Hoy». */
export function resumenDe(dia: Dia | undefined): ResumenDia {
  const tipos = new Set(dia?.items.map((i) => i.tipo));
  return {
    devocional: tipos.has('devocional'),
    profundo: tipos.has('profundo'),
    lectura: tipos.has('capitulo'),
    escuchado: ESCUCHADO.some((t) => tipos.has(t)),
    total: dia?.items.length ?? 0,
  };
}
