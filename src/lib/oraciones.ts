import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Entrada } from './diario';
import { cambio, registrar } from './sincronia';

// Diario de oración: lo que la persona pide a Dios, los versículos que la acompañaron mientras oraba y, cuando
// llega, cómo respondió. Privado: se guarda en el dispositivo y, si hay cuenta, en ella (como el diario).

export type Acompana = {
  book: string;
  chapter: number;
  verse: number;
  /** «Salmo 23:1», para mostrarla sin cargar los libros. */
  reference: string;
  text: string;
  /** Cuándo lo unió a la oración. */
  added: number;
};

export type Oracion = {
  id: string;
  /** Lo que pide, en pocas palabras: «Trabajo para papá». */
  titulo: string;
  detalle?: string;
  created: number;
  versiculos: Acompana[];
  /** Cuándo y cómo respondió Dios. */
  respondida?: { fecha: number; nota: string };
  /** Si la pidió a un grupo de la comunidad: allí la ven y le envían ánimo (src/lib/pedirOracion.ts). */
  compartida?: Compartida;
};

export type Compartida = { grupo: string; nombre: string; peticion: string; fecha: number };

const KEY = 'oraciones';

let state: Oracion[] = [];
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

function write(next: Oracion[]) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

function save(next: Oracion[]) {
  write(next);
  cambio();
}

registrar<Oracion[]>({
  nombre: 'oraciones',
  leer: () => load().then(() => state),
  escribir: write,
  partir: (s) => Object.fromEntries(s.map((o) => [o.id, o])),
  unir: (entradas) => (Object.values(entradas) as Oracion[]).sort((a, b) => b.created - a.created),
  hora: (v) => (v as Oracion).created,
});

const nuevoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Crea una petición (con un versículo si viene del lector) y devuelve su id. */
export async function nuevaOracion(titulo: string, detalle = '', versiculo?: Omit<Acompana, 'added'>) {
  await load();
  const created = Date.now();
  const oracion: Oracion = {
    id: nuevoId(),
    titulo: titulo.trim(),
    ...(detalle.trim() ? { detalle: detalle.trim() } : {}),
    created,
    versiculos: versiculo ? [{ ...versiculo, added: created }] : [],
  };
  save([oracion, ...state]);
  return oracion.id;
}

export async function editarOracion(id: string, titulo: string, detalle: string) {
  await load();
  save(
    state.map((o) => {
      if (o.id !== id) return o;
      const { detalle: _, ...rest } = o;
      return { ...rest, titulo: titulo.trim(), ...(detalle.trim() ? { detalle: detalle.trim() } : {}) };
    }),
  );
}

/** Une un versículo a la oración (si ya estaba, no lo repite). */
export async function acompanar(id: string, versiculo: Omit<Acompana, 'added'>) {
  await load();
  save(
    state.map((o) =>
      o.id !== id || o.versiculos.some((v) => sameVerse(v, versiculo))
        ? o
        : { ...o, versiculos: [...o.versiculos, { ...versiculo, added: Date.now() }] },
    ),
  );
}

export async function quitarVersiculo(id: string, versiculo: Pick<Acompana, 'book' | 'chapter' | 'verse'>) {
  await load();
  save(state.map((o) => (o.id === id ? { ...o, versiculos: o.versiculos.filter((v) => !sameVerse(v, versiculo)) } : o)));
}

/** Marca la oración como respondida, con lo que la persona quiera recordar. */
export async function responder(id: string, nota: string, fecha = Date.now()) {
  await load();
  save(state.map((o) => (o.id === id ? { ...o, respondida: { fecha, nota: nota.trim() } } : o)));
}

/** Vuelve a dejarla «en oración». */
export async function seguirOrando(id: string) {
  await load();
  save(
    state.map((o) => {
      if (o.id !== id) return o;
      const { respondida: _, ...rest } = o;
      return rest;
    }),
  );
}

/** Recuerda a qué grupo se pidió oración, para llevar a la persona a los ánimos. */
export async function marcarCompartida(id: string, compartida: Compartida) {
  await load();
  save(state.map((o) => (o.id === id ? { ...o, compartida } : o)));
}

export async function borrarOracion(id: string) {
  await load();
  save(state.filter((o) => o.id !== id));
}

/** Peticiones, de la más reciente a la más antigua. */
export function useOraciones(): Oracion[] {
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

const sameVerse = (a: Pick<Acompana, 'book' | 'chapter' | 'verse'>, b: Pick<Acompana, 'book' | 'chapter' | 'verse'>) =>
  a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

const DIA = 86_400_000;

/** Cuánto tiempo se oró, en palabras: «el mismo día», «después de 3 semanas», «después de un año y 2 meses». */
export function cuantoTiempo(desde: number, hasta: number) {
  const dias = Math.round((hasta - desde) / DIA);
  if (dias < 1) return 'el mismo día';
  if (dias < 14) return `después de ${dias === 1 ? 'un día' : `${dias} días`}`;
  if (dias < 60) return `después de ${Math.round(dias / 7)} semanas`;
  const meses = Math.round(dias / 30.44);
  if (meses < 12) return `después de ${meses} meses`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos === 1 ? 'un año' : `${anos} años`;
  return `después de ${a}${resto ? ` y ${resto === 1 ? 'un mes' : `${resto} meses`}` : ''}`;
}

// «Mi camino»: los momentos de la persona (devocionales, peticiones y respuestas) con el versículo que la
// acompañó en cada uno, agrupados por año y mes.

export type Momento = {
  id: string;
  fecha: number;
  tipo: 'devocional' | 'peticion' | 'respuesta';
  /** Lo que pasó: la petición, o la frase del devocional. */
  titulo: string;
  nota?: string;
  versiculos: { book: string; chapter: number; verse?: number; reference: string; text?: string }[];
};

export type Ano = { ano: number; meses: { mes: number; momentos: Momento[] }[]; versiculos: number; respondidas: number };

export function momentos(entradas: Entrada[], oraciones: Oracion[]): Momento[] {
  const lista: Momento[] = [];
  for (const e of entradas) {
    lista.push({
      id: `d-${e.id}`,
      fecha: e.created,
      tipo: 'devocional',
      titulo: e.palabra || e.paso || 'Devocional',
      versiculos: [
        {
          book: e.book,
          chapter: e.chapter,
          verse: e.llevar?.verse ?? e.verse,
          reference: e.llevar ? withVerse(e.reference, e.llevar.verse) : e.reference,
          text: e.llevar?.text,
        },
      ],
    });
  }
  for (const o of oraciones) {
    const versos = o.versiculos.map(({ book, chapter, verse, reference, text }) => ({ book, chapter, verse, reference, text }));
    lista.push({ id: `p-${o.id}`, fecha: o.created, tipo: 'peticion', titulo: o.titulo, nota: o.detalle, versiculos: versos });
    if (o.respondida) {
      lista.push({
        id: `r-${o.id}`,
        fecha: o.respondida.fecha,
        tipo: 'respuesta',
        titulo: o.titulo,
        nota: o.respondida.nota || undefined,
        // Los versículos que la sostuvieron hasta la respuesta.
        versiculos: versos,
      });
    }
  }
  return lista.sort((a, b) => b.fecha - a.fecha);
}

/** «Juan 3» o «Juan 3:16» con el versículo para llevar: «Juan 3:17». */
function withVerse(reference: string, verse: number) {
  return `${reference.replace(/:\d+(-\d+)?$/, '')}:${verse}`;
}

/** Los momentos por año (el más reciente primero) y, dentro, por mes. */
export function porAno(lista: Momento[]): Ano[] {
  const anos = new Map<number, Ano>();
  for (const m of lista) {
    const d = new Date(m.fecha);
    const ano = anos.get(d.getFullYear()) ?? { ano: d.getFullYear(), meses: [], versiculos: 0, respondidas: 0 };
    anos.set(ano.ano, ano);
    let mes = ano.meses.find((x) => x.mes === d.getMonth());
    if (!mes) ano.meses.push((mes = { mes: d.getMonth(), momentos: [] }));
    mes.momentos.push(m);
    if (m.tipo === 'respuesta') ano.respondidas++;
  }
  for (const ano of anos.values()) {
    const vistos = new Set<string>();
    for (const mes of ano.meses) for (const m of mes.momentos) for (const v of m.versiculos) vistos.add(`${v.book}.${v.chapter}.${v.verse ?? ''}`);
    ano.versiculos = vistos.size;
    ano.meses.sort((a, b) => b.mes - a.mes);
    for (const mes of ano.meses) mes.momentos.sort((a, b) => b.fecha - a.fecha);
  }
  return [...anos.values()].sort((a, b) => b.ano - a.ano);
}

/** Un momento de hace un año o más, cerca de esta misma fecha (una semana antes o después), para recordarlo. */
export function unDiaComoHoy(lista: Momento[], hoy = Date.now()): { momento: Momento; anos: number } | null {
  const h = new Date(hoy);
  for (const m of [...lista].sort((a, b) => a.fecha - b.fecha)) {
    const d = new Date(m.fecha);
    const anos = h.getFullYear() - d.getFullYear();
    if (anos < 1 || !m.versiculos.length) continue;
    const mismaFecha = new Date(h.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (Math.abs(mismaFecha - new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime()) <= 7 * DIA) return { momento: m, anos };
  }
  return null;
}
