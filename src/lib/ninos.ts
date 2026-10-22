import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { HISTORIAS, MEMORIA, type Historia, type Memoria } from './ninosHistorias';
import { lanzarConfeti } from './confeti';
import { markStudyDay } from './progress';
import { definirSellos, huellasDe, type Sello, type Tipo } from './sellos';
import { cambio, registrar } from './sincronia';
import { daysBetween, todayKey } from './temporadas';

// Espacio Niños: el progreso de las historias (src/lib/ninosHistorias.ts), los versículos de memoria y sus sellos
// en el álbum de la app.
//
// Cada historia da hasta tres estrellas: escucharla, responder sus dos preguntas (con todos los intentos que hagan
// falta) y conversarla en familia, que marca un adulto. Las historias se abren en orden, como un camino. Nada se
// pierde ni caduca, y no hay rankings: el álbum celebra lo hecho, nunca la velocidad.

export type RegistroHistoria = {
  /** Día en que se escuchó y respondió. */
  fecha: string;
  /** Día en que se conversó en familia. */
  familia?: string;
};

type Estado = {
  historias: Record<string, RegistroHistoria>;
  /** Versículo → día en que se dijo de memoria (el segundo nivel del juego). */
  memoria: Record<string, string>;
};

const KEY = 'ninos';
const vacio = (): Estado => ({ historias: {}, memoria: {} });

let state: Estado = vacio();
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') state = { ...vacio(), ...parsed };
    })
    .catch(() => {})
    .then(() => {
      listeners.forEach((l) => l());
      return sembrar(state);
    });
  return loaded;
}

function write(next: Estado) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

// En la cuenta va una entrada por historia («h.david») y por versículo («m.pastor»).
registrar<Estado>({
  nombre: 'ninos',
  leer: () => load().then(() => state),
  escribir: (s) => {
    write(s);
    sembrar(s);
  },
  partir: (s) => {
    const out: Record<string, unknown> = {};
    for (const [id, r] of Object.entries(s.historias)) out[`h.${id}`] = r;
    for (const [id, f] of Object.entries(s.memoria)) out[`m.${id}`] = f;
    return out;
  },
  unir: (entradas) => {
    const s = vacio();
    for (const [k, v] of Object.entries(entradas)) {
      if (k.startsWith('h.')) s.historias[k.slice(2)] = v as RegistroHistoria;
      else if (k.startsWith('m.') && typeof v === 'string') s.memoria[k.slice(2)] = v;
    }
    return s;
  },
});

export const buscarHistoria = (id: string): { historia: Historia; indice: number } | null => {
  const indice = HISTORIAS.findIndex((h) => h.id === id);
  return indice >= 0 ? { historia: HISTORIAS[indice], indice } : null;
};

/** 0 a 3: escuchó, respondió (las dos llegan juntas al terminar) y conversó en familia. */
export const estrellasHistoria = (r: RegistroHistoria | undefined) => (r ? 2 + (r.familia ? 1 : 0) : 0);

/** La primera historia sin escuchar; null cuando ya se escucharon todas. */
export function siguienteHistoria(s: Estado): number | null {
  const i = HISTORIAS.findIndex((h) => !s.historias[h.id]);
  return i < 0 ? null : i;
}

export const historiaAbierta = (indice: number, s: Estado) => indice === 0 || !!s.historias[HISTORIAS[indice - 1].id];

export const totalEstrellas = (s: Estado) => Object.values(s.historias).reduce((n, r) => n + estrellasHistoria(r), 0);

/** La historia escuchada más reciente que aún no se conversó en familia (dentro de la semana), para Hoy. */
export function charlaPendiente(s: Estado, hoy = todayKey()): Historia | null {
  const [id] =
    Object.entries(s.historias)
      .filter(([, r]) => !r.familia && daysBetween(r.fecha, hoy) < 7)
      .sort((a, b) => b[1].fecha.localeCompare(a[1].fecha))[0] ?? [];
  return id ? (buscarHistoria(id)?.historia ?? null) : null;
}

/** El versículo de la semana: cambia cada lunes y da la vuelta a la lista. */
export function versoDeLaSemana(hoy = todayKey()): Memoria {
  const semanas = Math.floor(daysBetween('2026-01-05', hoy) / 7);
  return MEMORIA[((semanas % MEMORIA.length) + MEMORIA.length) % MEMORIA.length];
}

// --- Sellos ---
// Viven en el álbum de toda la app («Mis sellos») con el público «ninos». Versículos en la RV1909 (dominio
// público), como el resto del álbum.
const v = (ref: string, book: string, chapter: number, verse: number, texto: string) => ({ ref, book, chapter, verse, texto });

export const FAMILIA_NINOS = 'ninos';

const sello = (s: Omit<Sello, 'familia' | 'publico'>): Sello => ({ ...s, familia: FAMILIA_NINOS, publico: 'ninos' });

export const SELLOS_NINOS: Sello[] = [
  sello({
    id: 'ninos-primera',
    titulo: 'Primera historia',
    como: 'Escucha tu primera historia.',
    logro: 'Escuchaste tu primera historia de la Biblia.',
    tipo: 'cuento',
    meta: 1,
    dibujo: 'arcoiris',
    versiculo: v('Mateo 19:14', 'mat', 19, 14, 'Y Jesús dijo: Dejad a los niños, y no les impidáis de venir a mí; porque de los tales es el reino de los cielos.'),
    ir: { label: 'Ir a las historias', href: '/ninos' },
  }),
  sello({
    id: 'ninos-seis',
    titulo: 'Buen oidor',
    como: 'Escucha 6 historias.',
    logro: 'Escuchaste 6 historias.',
    tipo: 'cuento',
    meta: 6,
    dibujo: 'oido',
    versiculo: v('Lucas 11:28', 'luk', 11, 28, 'Y él dijo: Antes bienaventurados los que oyen la palabra de Dios, y la guardan.'),
    ir: { label: 'Ir a las historias', href: '/ninos' },
  }),
  sello({
    id: 'ninos-todas',
    titulo: 'Amigo de la Biblia',
    como: 'Escucha las 12 historias.',
    logro: 'Escuchaste las 12 historias.',
    tipo: 'cuento',
    meta: HISTORIAS.length,
    dibujo: 'oveja',
    versiculo: v('Juan 10:14', 'jhn', 10, 14, 'Yo soy el buen pastor; y conozco mis ovejas, y las mías me conocen.'),
    ir: { label: 'Ir a las historias', href: '/ninos' },
  }),
  sello({
    id: 'ninos-familia',
    titulo: 'En familia',
    como: 'Conversa 3 historias en familia.',
    logro: 'Conversaron 3 historias en familia.',
    tipo: 'charla',
    meta: 3,
    dibujo: 'familia',
    versiculo: v('Josué 24:15', 'jos', 24, 15, '…que yo y mi casa serviremos a Jehová.'),
    ir: { label: 'Ir a las historias', href: '/ninos' },
  }),
  sello({
    id: 'ninos-verso',
    titulo: 'En mi corazón',
    como: 'Di un versículo de memoria.',
    logro: 'Dijiste un versículo de memoria.',
    tipo: 'memoria',
    meta: 1,
    dibujo: 'corazon',
    versiculo: v('Salmos 119:11', 'psa', 119, 11, 'En mi corazón he guardado tus dichos, para no pecar contra ti.'),
    ir: { label: 'Al versículo de la semana', href: '/ninos/memoria' },
  }),
  sello({
    id: 'ninos-versos',
    titulo: 'Tesoro escondido',
    como: 'Di 4 versículos de memoria.',
    logro: 'Guardaste 4 versículos en tu corazón.',
    tipo: 'memoria',
    meta: 4,
    dibujo: 'tesoro',
    versiculo: v('Salmos 19:10', 'psa', 19, 10, 'Deseables son más que el oro, y más que mucho oro afinado; y dulces más que miel, y que la que destila del panal.'),
    ir: { label: 'Al versículo de la semana', href: '/ninos/memoria' },
  }),
];

definirSellos(SELLOS_NINOS, [{ id: FAMILIA_NINOS, titulo: 'Historias', subtitulo: 'Del Espacio Niños' }]);

/** Las huellas que corresponden a lo hecho, por tipo. */
export function huellasNinos(s: Estado): Record<'cuento' | 'charla' | 'memoria', string[]> {
  const historias = Object.entries(s.historias).filter(([id]) => buscarHistoria(id));
  return {
    cuento: historias.map(([id]) => id),
    charla: historias.filter(([, r]) => r.familia).map(([id]) => id),
    memoria: Object.keys(s.memoria).filter((id) => MEMORIA.some((m) => m.id === id)),
  };
}

/** Deja en el álbum las huellas de lo hecho. La pantalla lo pide al terminar, para que un sello no interrumpa. */
export const celebrarNinos = () => load().then(() => sembrar(state));

async function sembrar(s: Estado) {
  for (const [tipo, ids] of Object.entries(huellasNinos(s))) if (ids.length) await huellasDe(tipo as Tipo, ids);
}

export async function terminarHistoria(id: string) {
  await load();
  if (state.historias[id]) return;
  write({ ...state, historias: { ...state.historias, [id]: { fecha: todayKey() } } });
  cambio();
  markStudyDay();
  lanzarConfeti('confeti');
}

export async function conversada(id: string, si: boolean) {
  await load();
  const r = state.historias[id];
  if (!r) return;
  write({ ...state, historias: { ...state.historias, [id]: { ...r, familia: si ? todayKey() : undefined } } });
  cambio();
  await sembrar(state);
}

export async function memorizado(id: string) {
  await load();
  if (state.memoria[id]) return;
  write({ ...state, memoria: { ...state.memoria, [id]: todayKey() } });
  cambio();
  markStudyDay();
  lanzarConfeti('fuegos');
}

export function useNinos() {
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

// --- Para salir del Espacio Niños ---
// Si no hay PIN (src/lib/jovenes.ts), una pregunta de adultos: una multiplicación que un niño pequeño no resuelve
// solo. No es una cerradura: evita que el modo se cambie sin querer.
export function preguntaAdulto(semilla = Date.now()): { q: string; r: number } {
  const a = 6 + (semilla % 4);
  const b = 7 + (Math.floor(semilla / 7) % 3);
  return { q: `¿Cuánto es ${a} × ${b}?`, r: a * b };
}
