// Música de fondo del pódcast (Mike, 31-10): una pista suave de la música de ambiente (src/lib/ambiente.ts) suena
// debajo de Ana y Tomás mientras el pódcast suena, y se va cuando se pausa o termina. Sirve igual para la voz del
// dispositivo y para las grabaciones (también las que ya estaban hechas), sin volver a grabar nada. El ambiente ya
// baja solo mientras suena el reproductor, así que aquí solo se enciende y se apaga. Se puede apagar o cambiar de pista
// desde la página del pódcast; la elección se guarda en el dispositivo.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { PISTAS, playAmbiente, stopAmbiente, useAmbiente } from './ambiente';
import { mainPlaying, podcastAbierto } from './audio';

const KEY = 'musica-podcast';
/** La pista que suena si nadie eligió otra: piano tranquilo, que no compite con las voces. */
export const PISTA_PODCAST = 'piano';
/** Una pausa más corta que esto (entre dos intervenciones de la voz del dispositivo) no apaga la música. */
export const PAUSA_MS = 2500;
const TICK = 400;

export type MusicaPodcast = { encendida: boolean; pista: string };

let state: MusicaPodcast = { encendida: true, pista: PISTA_PODCAST };
const listeners = new Set<() => void>();

function set(patch: Partial<MusicaPodcast>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

let loaded: Promise<void> | null = null;
function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const saved = raw ? (JSON.parse(raw) as Partial<MusicaPodcast>) : {};
      state = {
        encendida: typeof saved.encendida === 'boolean' ? saved.encendida : state.encendida,
        pista: PISTAS.some((p) => p.id === saved.pista) ? saved.pista! : state.pista,
      };
      listeners.forEach((l) => l());
    })
    .catch(() => {});
  return loaded;
}

export type Paso = 'poner' | 'quitar' | null;

/**
 * Qué hacer en cada vuelta: poner la música cuando el pódcast suena y no hay otra, y quitarla (solo si la puso el
 * pódcast) cuando lleva un rato en pausa o la persona la apagó. Si suena otra pista de ambiente, no se toca.
 */
export function decidir(o: { sonando: boolean; encendida: boolean; nuestra: boolean; ambiente: string | null; quietoMs: number }): Paso {
  if (o.sonando && o.encendida && !o.ambiente) return 'poner';
  if (o.nuestra && o.ambiente && (!o.encendida || (!o.sonando && o.quietoMs >= PAUSA_MS))) return 'quitar';
  return null;
}

let timer: ReturnType<typeof setInterval> | null = null;
let nuestra = false;
let desde = 0;
let ambiente: string | null = null;

function tick() {
  const abierto = podcastAbierto();
  const sonando = abierto && mainPlaying();
  const now = Date.now();
  if (sonando) desde = now;
  const paso = decidir({ sonando, encendida: state.encendida, nuestra, ambiente, quietoMs: now - desde });
  if (paso === 'poner') {
    nuestra = true;
    playAmbiente(state.pista);
  } else if (paso === 'quitar') {
    nuestra = false;
    stopAmbiente();
  }
  // Con el reproductor cerrado o en otra cosa ya no hay nada que seguir.
  if (!abierto && !nuestra && timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** La página del pódcast la enciende: desde ahí sigue al reproductor aunque se cambie de pantalla. */
export function useMusicaPodcast(): MusicaPodcast & { cambiar: (pista: string) => void; alternar: () => void } {
  const amb = useAmbiente();
  useEffect(() => {
    load();
    desde = Date.now();
    timer ??= setInterval(tick, TICK);
  }, []);
  ambiente = amb.sonando;
  // Si la persona elige otra pista en la hoja mientras suena la del pódcast, esa queda para el pódcast.
  useEffect(() => {
    if (nuestra && amb.sonando && amb.sonando !== state.pista) set({ pista: amb.sonando });
    if (nuestra && !amb.sonando && state.encendida && mainPlaying()) {
      // La apagó desde la hoja con el pódcast sonando: que no vuelva sola.
      nuestra = false;
      set({ encendida: false });
    }
  }, [amb.sonando]);
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
    () => state,
  );
  return {
    ...s,
    cambiar: (pista: string) => {
      set({ pista, encendida: true });
      if (nuestra || mainPlaying()) {
        nuestra = true;
        playAmbiente(pista);
      }
    },
    alternar: () => {
      const encendida = !state.encendida;
      set({ encendida });
      if (encendida && podcastAbierto() && mainPlaying()) {
        nuestra = true;
        playAmbiente(state.pista);
      } else if (!encendida && nuestra) {
        nuestra = false;
        stopAmbiente();
      }
    },
  };
}
