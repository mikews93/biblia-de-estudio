// «Despertar con la Biblia»: la música de amanecer que sube de a poco y los ajustes del despertador.
//
// La música (public/audio/ambiente/amanecer.mp3, la misma de la música de ambiente) va en su propio reproductor,
// aparte del de la app (src/lib/audio.ts): así puede seguir sonando, más bajita, debajo del versículo leído o del
// capítulo. En la web suena con un <audio> para saber si el navegador dejó empezar sin un toque.
//
// El despertador en sí: en la web lo manda el servidor por push a su hora (api/notificaciones.ts); en la app
// nativa es una alarma del teléfono (src/lib/alarma.native.ts).

import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { activar, cambiar, useAvisos } from './avisos';
import { ALARMA_NATIVA, permisoAlarma, programarAlarma } from './alarma';
import { Despertador } from './despertarTexto';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
export const MUSICA_URL = `${API}/audio/ambiente/amanecer.mp3`;

/** Volumen de la música sola, y debajo de una voz. */
export const VOLUMEN = 0.7;
export const VOLUMEN_BAJO = 0.16;

type Fuente = { play(): Promise<void>; pause(): void; volume: number };

let fuente: Fuente | null = null;
let nativo: AudioPlayer | null = null;
let rampa: ReturnType<typeof setInterval> | null = null;
let sonando = false;
const listeners = new Set<() => void>();

function setSonando(v: boolean) {
  sonando = v;
  listeners.forEach((l) => l());
}

function crear(): Fuente {
  if (Platform.OS === 'web') {
    const el = new Audio(MUSICA_URL);
    el.loop = true;
    el.preload = 'auto';
    return el;
  }
  nativo = createAudioPlayer({ uri: MUSICA_URL });
  nativo.loop = true;
  const p = nativo;
  return {
    play: async () => p.play(),
    pause: () => p.pause(),
    get volume() {
      return p.volume;
    },
    set volume(v: number) {
      p.volume = v;
    },
  };
}

/** Lleva el volumen a `meta` en `segundos`, con una curva suave. */
function llevar(meta: number, segundos: number, alTerminar?: () => void) {
  if (rampa) clearInterval(rampa);
  rampa = null;
  const f = fuente;
  if (!f) return;
  const desde = f.volume;
  const pasos = Math.max(1, Math.round(segundos * 10));
  let i = 0;
  rampa = setInterval(() => {
    i++;
    const t = i / pasos;
    f.volume = Math.min(1, Math.max(0, desde + (meta - desde) * (t * t * (3 - 2 * t))));
    if (i >= pasos) {
      clearInterval(rampa!);
      rampa = null;
      alTerminar?.();
    }
  }, 100);
}

/**
 * Empieza la música desde el silencio y la sube en `segundos`. Devuelve false si el navegador no dejó sonar
 * sin un toque (entonces la pantalla muestra «Toca para empezar»).
 */
export async function empezarMusica(segundos = 25): Promise<boolean> {
  fuente ??= crear();
  if (sonando) return true;
  fuente.volume = 0;
  try {
    await fuente.play();
  } catch {
    return false;
  }
  setSonando(true);
  llevar(VOLUMEN, segundos);
  return true;
}

/** Baja o sube la música (debajo de una voz, por ejemplo). */
export const volumenMusica = (v: number, segundos = 1.5) => sonando && llevar(v, segundos);

export function pararMusica(segundos = 2) {
  if (!fuente || !sonando) return;
  setSonando(false);
  const f = fuente;
  llevar(0, segundos, () => f.pause());
}

export function useMusicaSonando() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sonando,
    () => false,
  );
}

// ——— Ajustes ———

export function useDespertador() {
  const avisos = useAvisos();
  return { ...avisos.despertar, ready: avisos.ready, endpoint: avisos.endpoint };
}

/**
 * Guarda el despertador. En la web hace falta que las notificaciones estén activas en este dispositivo (si no, las
 * activa: el navegador pide permiso). En la app nativa programa las alarmas del teléfono.
 */
export async function guardarDespertador(patch: Partial<Despertador>, ajustes: { endpoint: string | null; despertar: Despertador }, lectura?: string) {
  const all = { ...ajustes.despertar, ...patch };
  const next: Despertador = { activo: all.activo, hora: all.hora, dias: all.dias, modo: all.modo };
  if (ALARMA_NATIVA) {
    if (next.activo && !(await permisoAlarma())) throw new Error('Para que suene el despertador, permite las notificaciones de Zarza en los ajustes del teléfono.');
    await cambiar({ despertar: next });
    await programarAlarma(next, lectura);
    return;
  }
  if (next.activo && !ajustes.endpoint) await activar();
  await cambiar({ despertar: next });
}
