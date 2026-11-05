import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { type Funcion, catalogo } from './todo';

// Los accesos de Hoy se ordenan solos según lo que la persona más usa. Se cuenta solo en su dispositivo (nunca se
// envía): cada vez que abre una función de «Todo en Zarza» suma un punto, y los puntos pierden la mitad de su peso
// cada dos semanas, así lo que dejó de usar baja poco a poco. Sin uso, sale el orden de siempre.

/** Lo que no va en los accesos de Hoy porque ya tiene su lugar fijo (la barra de abajo o la misma pantalla Hoy). */
export const EN_OTRO_LUGAR = new Set([
  'planes', // pestaña Planes
  'taller', // pestaña Taller
  'comunidad', // pestaña Comunidad
  'grupos', // dentro de Comunidad
  'preguntar', // el buscador de Hoy ya responde preguntas
  'sellos', // tarjeta «Tu semana»
  'notificaciones', // la campana
  'cuenta', // el avatar
  'instalar', // enlace al pie de Hoy
  'acerca', // pie de Hoy
  'reportar',
  'privacidad',
  'sostener', // tiene su invitación propia en Hoy
  'mis-temas',
  'modo',
]);

/** El orden de siempre, para quien aún no ha usado nada: el primero va en grande. */
export const POR_DEFECTO = ['estudiar', 'libros', 'notas', 'diario', 'despertador', 'comparar', 'podcast', 'semana'];

/** Nombres cortos para las tarjetas pequeñas (el catálogo usa el nombre largo). */
export const CORTO: Record<string, string> = {
  notas: 'Mis notas',
  podcast: 'Pódcast',
  comparar: 'Comparar',
  semana: 'Del sermón',
  palabras: 'Palabras',
  repaso: 'Repaso',
  promesas: 'Promesas',
  herejias: 'Herejías',
  historia: 'Línea de tiempo',
  lugares: 'Lugares',
  'mapa-mental': 'Mapa mental',
  exportar: 'Llévate lo tuyo',
  recibidos: 'Recibidos',
  ocasiones: 'Para alguien',
  invitar: 'Invitar',
  iglesia: 'Mi iglesia',
  vivo: 'En vivo',
};

const VIDA_MEDIA = 14 * 86_400_000;

export type Uso = Record<string, { p: number; t: number }>;

/** Los puntos de hoy de una función, con el desgaste del tiempo. */
export const puntos = (u: Uso[string] | undefined, ahora = Date.now()) => (u ? u.p * 0.5 ** ((ahora - u.t) / VIDA_MEDIA) : 0);

/** Suma un uso. */
export function sumar(uso: Uso, id: string, ahora = Date.now()): Uso {
  return { ...uso, [id]: { p: puntos(uso[id], ahora) + 1, t: ahora } };
}

/**
 * Las funciones para los accesos, de la más usada a la menos. Las del orden de siempre llevan una pizca de puntos
 * (menos de uno) para que basten dos o tres usos de otra cosa para subirla, y para desempatar entre sí.
 */
export function ordenar(funciones: Funcion[], uso: Uso, ahora = Date.now()): Funcion[] {
  const base = (id: string) => {
    const i = POR_DEFECTO.indexOf(id);
    return i < 0 ? 0 : (POR_DEFECTO.length - i) / (POR_DEFECTO.length + 1);
  };
  return funciones
    .filter((f) => !EN_OTRO_LUGAR.has(f.id))
    .map((f) => ({ f, s: puntos(uso[f.id], ahora) + base(f.id) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.f);
}

// Las rutas de cada función, con el libro y el capítulo como comodines («/comparar/*/*»).
const COMODIN = '*';
let rutas: { id: string; partes: string[] }[] | null = null;
const partesDe = (ruta: string) => ruta.split('?')[0].split('/').filter(Boolean);

/** Qué función del catálogo es una ruta («/comparar/jhn/3» → comparar). La lectura, Hoy y lo desconocido no cuentan. */
export function funcionDeRuta(ruta: string): string | null {
  rutas ??= catalogo({ book: COMODIN, chapter: 0 })
    .flatMap((g) => g.funciones)
    .filter((f) => f.id !== 'estudiar') // abre la lectura: se cuenta al abrir el estudio (StudyPanel)
    .map((f) => ({ id: f.id, partes: partesDe(f.href).map((x) => (x === COMODIN || x === '0' ? COMODIN : x)) }));
  const partes = partesDe(ruta);
  if (!partes.length) return null;
  // La que coincide en más tramos fijos: «/taller/dinamicas» gana a «/taller».
  let mejor: { id: string; n: number } | null = null;
  for (const r of rutas) {
    if (r.partes.length > partes.length) continue;
    if (!r.partes.every((x, i) => x === COMODIN || x === partes[i])) continue;
    const n = r.partes.filter((x) => x !== COMODIN).length;
    if (!mejor || n > mejor.n) mejor = { id: r.id, n };
  }
  return mejor?.id ?? null;
}

const KEY = 'uso-funciones';
let state: Uso = {};
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

/** Anota que se usó una función (por su id del catálogo). */
export async function usar(id: string) {
  await load();
  state = sumar(state, id);
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

/** Anota la función de una ruta, si la ruta es de una. */
export function usarRuta(ruta: string) {
  const id = funcionDeRuta(ruta);
  if (id) usar(id).catch(() => {});
}

export function useUso() {
  const [uso, setUso] = useState<Uso>(state);
  useEffect(() => {
    const l = () => setUso(state);
    listeners.add(l);
    load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return uso;
}
