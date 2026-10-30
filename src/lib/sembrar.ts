import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { Recuerdo } from './sembrarTexto';
import { todayKey } from './temporadas';

// Lo que este dispositivo recuerda de la invitación a sembrar (src/lib/sembrarTexto.ts): desde cuándo abre
// Zarza, cuándo respondió la última invitación y si volvió de Stripe a la pantalla de gracias.

const KEY = 'sembrar';

let state: Recuerdo = {};
let loaded: Promise<void> | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = { ...state, ...(JSON.parse(raw) as Recuerdo) };
    })
    .catch(() => {})
    .then(() => {
      isLoaded = true;
      if (!state.desde) set({ desde: todayKey() });
      listeners.forEach((l) => l());
    });
  return loaded;
}

function set(patch: Partial<Recuerdo>) {
  state = { ...state, ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

/** «Quiero sembrar» o «Ahora no»: la tarjeta no vuelve en un año. */
export const responderInvitacion = () => load().then(() => set({ respondida: todayKey() }));

/** Volvió de Stripe: a quien aporta no se le vuelve a invitar. */
export const marcarAporta = () => load().then(() => set({ aporta: true, respondida: todayKey() }));

export function useSembrar() {
  const [, render] = useState(0);
  useEffect(() => {
    const l = () => render((n) => n + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { ...state, ready: isLoaded };
}
