import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { fechaLocal } from './rachaTexto';
import { cambio, registrar } from './sincronia';

// Registro de actividad para «Mi diario»: lo que la persona hizo cada día y que no queda guardado en otra parte
// con su fecha (un capítulo leído, un estudio profundo, un pódcast escuchado, un devocional terminado…). Lo que ya
// tiene fecha (resaltados, notas, oraciones, sellos) se lee de su propio almacén (src/lib/miActividad.ts).
//
// Una entrada por cosa y día: leer Juan 3 dos veces el mismo día es una sola. Se guarda en el dispositivo y en la
// cuenta (almacén «actividad»), así la racha devocional y el diario son los mismos en todos los dispositivos.

export type TipoActividad =
  | 'devocional' // un devocional terminado (Amén · Guardar)
  | 'profundo' // un estudio profundo leído
  | 'capitulo' // un capítulo leído hasta el final
  | 'podcast' // el pódcast de un capítulo
  | 'dramatizado' // el audio dramatizado
  | 'original' // el capítulo en hebreo o griego
  | 'escuchar'; // la lectura en voz alta del capítulo

export type Evento = { tipo: TipoActividad; t: number; titulo: string; href?: string };

/** «AAAA-MM-DD|tipo|ref» → evento. */
export type Registro = Record<string, Evento>;

const KEY = 'actividad';
/** Lo que se conserva: algo más de un año, y nunca más de 4000 entradas. */
const DIAS_GUARDADOS = 400;
const MAXIMO = 4000;

let state: Registro = {};
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

function write(next: Registro) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

/** Quita lo más antiguo: lo de hace más de 400 días y, si aún sobra, lo que pase de 4000 entradas. */
export function recortar(r: Registro, ahora = Date.now()): Registro {
  const desde = ahora - DIAS_GUARDADOS * 86_400_000;
  const vivas = Object.entries(r).filter(([, e]) => e.t >= desde);
  if (vivas.length > MAXIMO) vivas.sort((a, b) => b[1].t - a[1].t).splice(MAXIMO);
  return vivas.length === Object.keys(r).length ? r : Object.fromEntries(vivas);
}

/**
 * Anota algo hecho hoy. `ref` distingue una cosa de otra del mismo tipo («jhn.3»); lo mismo el mismo día no se
 * repite. Devuelve si era nuevo.
 */
export async function anotar(tipo: TipoActividad, ref: string, titulo: string, href?: string) {
  await load();
  const ahora = Date.now();
  const k = `${fechaLocal(ahora)}|${tipo}|${ref}`.slice(0, 180);
  if (state[k]) return false;
  write(recortar({ ...state, [k]: { tipo, t: ahora, titulo, ...(href ? { href } : {}) } }, ahora));
  cambio();
  return true;
}

/** La fecha local de una entrada, sacada de su clave. */
export const fechaDeClave = (k: string) => k.slice(0, 10);

/** Los días («AAAA-MM-DD») con alguna actividad de ese tipo. */
export function diasCon(r: Registro, tipo: TipoActividad) {
  const out = new Set<string>();
  for (const [k, e] of Object.entries(r)) if (e.tipo === tipo) out.add(fechaDeClave(k));
  return out;
}

registrar<Registro>({
  nombre: 'actividad',
  leer: () => load().then(() => state),
  escribir: write,
  partir: (s) => s,
  unir: (entradas) => entradas as Registro,
  hora: (v) => (v as Evento).t,
});

export function useActividad(): Registro {
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
