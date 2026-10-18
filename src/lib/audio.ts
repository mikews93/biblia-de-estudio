// Lectura en audio de un capítulo (Bible Brain, vía /api/audio). Hay un solo reproductor para toda la app,
// así el audio sigue sonando al cambiar de pantalla y pasa solo al capítulo siguiente.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { getBooks } from './data';
import { chapterHref } from './routes';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const VERSION_KEY = 'audio-version';

export type AudioVersion = { id: string; name: string; nt: boolean; ot: boolean };
type Track = { url: string; duration: number; verseStart: number };
type ChapterAudio = {
  version: { id: string; name: string };
  testament: 'nt' | 'ot';
  tracks: Track[];
  timestamps: [number, number][];
  credit: string;
};

export type AudioState = {
  open: boolean;
  book: string | null;
  chapter: number;
  title: string;
  loading: boolean;
  error: string | null;
  audio: ChapterAudio | null;
  track: number;
  versions: AudioVersion[];
  rate: number;
};

let state: AudioState = {
  open: false,
  book: null,
  chapter: 0,
  title: '',
  loading: false,
  error: null,
  audio: null,
  track: 0,
  versions: [],
  rate: 1,
};
const listeners = new Set<() => void>();

function set(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useAudio(): AudioState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

let player: AudioPlayer | null = null;
let request = 0;
let location = '';

/** La barra del reproductor avisa de la pantalla abierta: solo se pasa de página si se está leyendo ese capítulo. */
export function setLocation(path: string) {
  location = decodeURIComponent(path);
}

export function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 250 });
    player.addListener('playbackStatusUpdate', onStatus);
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(
      () => {},
    );
  }
  return player;
}

function onStatus(status: AudioStatus) {
  if (!status.didJustFinish || !state.audio) return;
  if (state.track + 1 < state.audio.tracks.length) {
    playTrack(state.track + 1, 0);
  } else {
    playNextChapter();
  }
}

function playTrack(index: number, at: number) {
  const p = getPlayer();
  const track = state.audio!.tracks[index];
  set({ track: index });
  p.replace({ uri: track.url });
  p.setPlaybackRate(state.rate);
  if (at > 0) p.seekTo(at);
  p.play();
  try {
    p.setActiveForLockScreen(true, { title: state.title, artist: state.audio!.version.name, albumTitle: 'Biblia de estudio' });
  } catch {
    // la pantalla de bloqueo no está en todas las plataformas
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `No se pudo cargar el audio (${res.status})`);
  return body as T;
}

async function loadVersions() {
  if (state.versions.length) return;
  try {
    const { versions } = await fetchJson<{ versions: AudioVersion[] }>(`${API}/api/audio?versiones=1`);
    set({ versions });
  } catch {
    // sin lista solo se pierde la opción de cambiar de versión
  }
}

/** Abre el reproductor y empieza a leer el capítulo. */
export async function playChapter(book: string, chapter: number, title: string, versionId?: string) {
  const id = ++request;
  getPlayer().pause();
  set({ open: true, book, chapter, title, loading: true, error: null, audio: null, track: 0 });
  loadVersions();
  try {
    const bible = versionId ?? (await AsyncStorage.getItem(VERSION_KEY).catch(() => null)) ?? '';
    const audio = await fetchJson<ChapterAudio>(
      `${API}/api/audio?book=${book}&chapter=${chapter}${bible ? `&bible=${encodeURIComponent(bible)}` : ''}`,
    );
    if (id !== request) return;
    set({ audio, loading: false });
    playTrack(0, 0);
  } catch (e) {
    if (id !== request) return;
    set({ loading: false, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Pausa la lectura dramatizada (por ejemplo, al empezar el resumen en audio). */
export function pauseAudio() {
  if (player?.playing) player.pause();
}

export function toggle() {
  const p = getPlayer();
  if (!state.audio) return;
  if (p.playing) p.pause();
  else p.play();
}

/** Tiempo de inicio de cada pista dentro del capítulo (si viene en varias partes). */
function offsets(): number[] {
  const out: number[] = [];
  let sum = 0;
  for (const t of state.audio?.tracks ?? []) {
    out.push(sum);
    sum += t.duration;
  }
  return out;
}

/** Posición en segundos dentro del capítulo entero. */
export function chapterTime(current: number): number {
  return (offsets()[state.track] ?? 0) + current;
}

export function chapterDuration(currentTrackDuration: number): number {
  const tracks = state.audio?.tracks ?? [];
  if (tracks.length === 1) return currentTrackDuration || tracks[0].duration;
  return tracks.reduce((s, t) => s + t.duration, 0);
}

export function seekChapter(seconds: number) {
  if (!state.audio) return;
  const starts = offsets();
  let i = starts.length - 1;
  while (i > 0 && starts[i] > seconds) i--;
  const at = Math.max(0, seconds - starts[i]);
  if (i === state.track) getPlayer().seekTo(at);
  else playTrack(i, at);
}

export function seekBy(delta: number) {
  seekChapter(Math.max(0, chapterTime(getPlayer().currentTime) + delta));
}

/** Versículo que suena ahora, según los tiempos de Bible Brain (null si no hay tiempos). */
export function currentVerse(seconds: number): number | null {
  const stamps = state.audio?.timestamps ?? [];
  if (!stamps.length) return null;
  let verse = stamps[0][0];
  for (const [v, t] of stamps) {
    if (t <= seconds) verse = v;
    else break;
  }
  return verse;
}

export function setRate(rate: number) {
  set({ rate });
  getPlayer().setPlaybackRate(rate);
}

export async function setVersion(id: string) {
  await AsyncStorage.setItem(VERSION_KEY, id).catch(() => {});
  if (state.book) playChapter(state.book, state.chapter, state.title, id);
}

async function playNextChapter() {
  if (!state.book) return;
  const books = await getBooks();
  const i = books.findIndex((b) => b.id === state.book);
  const book = books[i];
  if (!book) return;
  const next = state.chapter < book.chapters ? { b: book, c: state.chapter + 1 } : books[i + 1] && { b: books[i + 1], c: 1 };
  if (!next) return;
  const here = chapterHref(book.id, state.chapter);
  if (location === here || location.startsWith(`${here}/`)) router.replace(chapterHref(next.b.id, next.c));
  playChapter(next.b.id, next.c, `${next.b.name} ${next.c}`, state.audio?.version.id);
}

export function closeAudio() {
  request++;
  if (player) {
    player.pause();
    try {
      player.clearLockScreenControls();
    } catch {
      // igual que arriba
    }
  }
  set({ open: false, audio: null, loading: false, error: null });
}
