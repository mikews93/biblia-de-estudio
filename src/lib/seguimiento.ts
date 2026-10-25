import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Paso } from './acompanar';

// Las respuestas a «¿cómo sigues?» de «Para ti» (src/lib/acompanar.ts). Se quedan solo en este dispositivo: no se
// registran en la sincronización con la cuenta, porque dicen cómo está alguien por dentro.

const KEY = 'para-ti-seguimiento';
/** Lo justo para saber cómo viene cada petición. */
const MAXIMO = 60;

let state: Paso[] = [];
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

export async function anotar(paso: Paso) {
  await load();
  state = [...state, paso].slice(-MAXIMO);
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

/** Cambia el último paso de una petición (por ejemplo, para anotar que ya habló con alguien). */
export async function completar(oracion: string, cambio: Partial<Paso>) {
  await load();
  const i = state.findLastIndex((p) => p.oracion === oracion);
  if (i === -1) return;
  state = state.map((p, j) => (j === i ? { ...p, ...cambio } : p));
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

export function useSeguimiento(): Paso[] | null {
  const [s, setS] = useState<Paso[] | null>(null);
  useEffect(() => {
    const l = () => setS(state);
    listeners.add(l);
    load().then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}
