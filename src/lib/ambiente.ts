// Música de ambiente para estudiar (Mike, 24-10): pads suaves que suenan debajo del devocional, el estudio profundo
// y el modo presentar del Taller. Van aparte del reproductor de la app (audio.ts), así se pueden oír a la vez que la
// lectura del capítulo; cuando la lectura suena, el ambiente se aparta y baja solo.
//
// Los archivos (public/audio/ambiente/<id>.mp3, de pipeline/ambiente/pads.py) duran el bucle más COLA segundos
// iguales al principio. Al llegar al final del bucle empieza la vuelta siguiente en el otro reproductor y los dos se
// cruzan: así no se oye el hueco que deja el MP3 al repetirse.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { useEffect, useSyncExternalStore } from 'react';

import { mainPlaying } from './audio';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const KEY = 'ambiente';

export type Pista = { id: string; nombre: string; detalle: string; bucle: number };

/** Las pistas, con la duración del bucle en segundos (sin la cola). */
export const PISTAS: Pista[] = [
  { id: 'quietud', nombre: 'Quietud', detalle: 'Cálido y sereno', bucle: 64 },
  { id: 'amanecer', nombre: 'Amanecer', detalle: 'Claro, con campanas', bucle: 60 },
  { id: 'noche', nombre: 'Noche', detalle: 'Grave, para concentrarse', bucle: 72 },
  { id: 'presencia', nombre: 'Presencia', detalle: 'Casi quieto, bajo la voz', bucle: 64 },
  // La única que no es sintetizada: un loop de piano CC0 de Freesound (pipeline/ambiente/piano.json). La que suena
  // por defecto debajo del pódcast (src/lib/musicaPodcast.ts).
  { id: 'piano', nombre: 'Piano', detalle: 'Piano lento, para el pódcast', bucle: 109 },
];

/** Segundos que se cruzan dos vueltas, y lo que tarda en entrar o salir. */
export const CRUCE = 4;
const ENTRADA = 2.5;
const SALIDA = 1.5;
/** Cuánto baja el ambiente mientras suena la lectura o el pódcast. */
export const APARTE = 0.4;
const TICK = 100;

export type AmbienteState = {
  /** Lo que suena ahora, o null. */
  sonando: string | null;
  /** La última pista elegida: la que suena al tocar el botón. */
  elegida: string;
  /** 0 a 1. */
  volumen: number;
};

let state: AmbienteState = { sonando: null, elegida: 'quietud', volumen: 0.5 };
const listeners = new Set<() => void>();

function set(patch: Partial<AmbienteState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

let loaded: Promise<void> | null = null;
function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const saved = raw ? (JSON.parse(raw) as Partial<AmbienteState>) : {};
      set({
        elegida: PISTAS.some((p) => p.id === saved.elegida) ? saved.elegida! : state.elegida,
        volumen: typeof saved.volumen === 'number' ? clamp(saved.volumen) : state.volumen,
      });
    })
    .catch(() => {});
  return loaded;
}

const save = () => AsyncStorage.setItem(KEY, JSON.stringify({ elegida: state.elegida, volumen: state.volumen })).catch(() => {});

export function useAmbiente(): AmbienteState {
  useEffect(() => {
    load();
  }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Acerca una ganancia a su meta: `fade` segundos para recorrer de 0 a 1. */
export function paso(gain: number, target: number, dt: number, fade: number): number {
  const d = dt / fade;
  return gain < target ? Math.min(target, gain + d) : Math.max(target, gain - d);
}

/** El volumen que se le da al reproductor: el elegido, en curva (el oído oye en escala de potencia), por la ganancia. */
export function volumenReal(volumen: number, gain: number, aparte: boolean): number {
  return clamp(volumen * volumen * gain * (aparte ? APARTE : 1));
}

// Dos reproductores que se turnan para cada vuelta.
type Voz = { player: AudioPlayer; gain: number; target: number; fade: number };
let voces: Voz[] = [];
let activa = 0;
let pista: Pista | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

const url = (id: string) => `${API}/audio/ambiente/${id}.mp3`;

function soltar() {
  if (timer) clearInterval(timer);
  timer = null;
  for (const v of voces) {
    try {
      v.player.pause();
      v.player.remove();
    } catch {
      // ya estaba suelto
    }
  }
  voces = [];
  pista = null;
}

function tick() {
  if (!pista) return;
  const aparte = mainPlaying();
  const cur = voces[activa];
  // Al final del bucle: la otra voz empieza desde el principio y las dos se cruzan.
  if (cur && cur.target > 0 && cur.player.currentTime >= pista.bucle) {
    const otra = voces[1 - activa];
    otra.player.seekTo(0);
    otra.player.play();
    otra.gain = 0;
    otra.target = 1;
    otra.fade = CRUCE;
    cur.target = 0;
    cur.fade = CRUCE;
    activa = 1 - activa;
  }
  let viva = false;
  for (const v of voces) {
    v.gain = paso(v.gain, v.target, TICK / 1000, v.fade);
    try {
      v.player.volume = volumenReal(state.volumen, v.gain, aparte);
      if (v.gain === 0 && v.target === 0 && v.player.playing) v.player.pause();
    } catch {
      // el reproductor se soltó mientras tanto
    }
    if (v.gain > 0 || v.target > 0) viva = true;
  }
  if (!viva && !state.sonando) soltar();
}

/** Pone una pista (o la elegida) con una entrada suave. Si ya sonaba otra, se cruzan. */
export async function playAmbiente(id?: string) {
  await load();
  const next = PISTAS.find((p) => p.id === (id ?? state.elegida)) ?? PISTAS[0];
  if (state.sonando === next.id && pista?.id === next.id) return;
  if (pista && pista.id !== next.id) soltar();
  if (!voces.length) {
    voces = [0, 1].map(() => ({ player: createAudioPlayer({ uri: url(next.id) }, { updateInterval: 500 }), gain: 0, target: 0, fade: ENTRADA }));
    activa = 0;
  }
  pista = next;
  const v = voces[activa];
  v.target = 1;
  v.fade = ENTRADA;
  v.player.volume = volumenReal(state.volumen, v.gain, mainPlaying());
  v.player.play();
  set({ sonando: next.id, elegida: next.id });
  save();
  timer ??= setInterval(tick, TICK);
}

/** Apaga el ambiente con una salida suave. */
export function stopAmbiente() {
  if (!state.sonando) return;
  for (const v of voces) {
    v.target = 0;
    v.fade = SALIDA;
  }
  set({ sonando: null });
}

export function toggleAmbiente() {
  if (state.sonando) stopAmbiente();
  else playAmbiente();
}

export function setVolumen(v: number) {
  set({ volumen: clamp(v) });
  // Mientras se arrastra no hay que esperar al siguiente paso para oírlo.
  const aparte = mainPlaying();
  for (const voz of voces) {
    try {
      voz.player.volume = volumenReal(state.volumen, voz.gain, aparte);
    } catch {
      // soltado
    }
  }
}

export const saveVolumen = save;

/** El ambiente es de la pantalla donde se estudia: al salir de ella se apaga solo. */
export function useAmbienteEnPantalla() {
  useEffect(() => () => stopAmbiente(), []);
}
