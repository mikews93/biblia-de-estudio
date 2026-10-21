// Reproductor único de la app. Todo lo que suena pasa por aquí: la lectura del capítulo (Bible Brain o LibriVox, vía
// /api/audio), el audio dramatizado, los pódcasts grabados y el pódcast leído con la voz del dispositivo. Así solo
// suena una cosa a la vez, el audio sigue al cambiar de pantalla y en segundo plano, y se controla desde la barra
// de abajo, la pantalla de bloqueo o los auriculares (Media Session en la web).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { useEffect, useSyncExternalStore } from 'react';

import { getBooks } from './data';
import { Line, SPEAKERS, chunks, pickVoices } from './podcast';
import { chapterHref } from './routes';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const VERSION_KEY = 'audio-version';

export type AudioKind = 'lectura' | 'dramatizado' | 'podcast';
export type AudioVersion = { id: string; name: string; nt: boolean; ot: boolean };
type Track = { url: string; duration: number };
/** Lo que suena desde un archivo. Los tiempos marcan dónde empieza cada versículo (o cada intervención del pódcast). */
export type ChapterAudio = {
  label: string;
  version?: { id: string; name: string };
  testament?: 'nt' | 'ot';
  tracks: Track[];
  timestamps: [number, number][];
  credit: string;
  note?: string;
};
/** El pódcast con la voz del dispositivo no tiene archivo: se lee intervención por intervención. */
export type SpeechAudio = { lines: Line[]; index: number; playing: boolean };
/** Capítulos con grabaciones propias, por tipo («mrk-1»). Lo escribe la acción de audio dramatizado. */
export type Catalog = { dramatizado: string[]; podcast: string[] };

export type AudioState = {
  open: boolean;
  kind: AudioKind;
  book: string | null;
  chapter: number;
  title: string;
  loading: boolean;
  error: string | null;
  audio: ChapterAudio | null;
  speech: SpeechAudio | null;
  track: number;
  versions: AudioVersion[];
  rate: number;
  catalog: Catalog;
};

let state: AudioState = {
  open: false,
  kind: 'lectura',
  book: null,
  chapter: 0,
  title: '',
  loading: false,
  error: null,
  audio: null,
  speech: null,
  track: 0,
  versions: [],
  rate: 1,
  catalog: { dramatizado: [], podcast: [] },
};
const listeners = new Set<() => void>();

function set(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useAudio(): AudioState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const recordingId = (book: string, chapter: number) => `${book}-${chapter}`;

let catalogLoad: Promise<void> | null = null;

/** Qué capítulos tienen audio dramatizado o pódcast grabado. Se pide una vez por sesión. */
export function useCatalog(): Catalog {
  // Solo el catálogo: así el lector no se vuelve a dibujar cada vez que cambia el reproductor.
  const catalog = useSyncExternalStore(subscribe, () => state.catalog, () => state.catalog);
  useEffect(() => {
    catalogLoad ??= fetch(`${API}/audio/index.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Partial<Catalog> | null) => {
        if (body) set({ catalog: { dramatizado: body.dramatizado ?? [], podcast: body.podcast ?? [] } });
      })
      .catch(() => {
        // sin catálogo solo se pierden los botones de las grabaciones
        catalogLoad = null;
      });
  }, []);
  return catalog;
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
  if (state.track + 1 < state.audio.tracks.length) playTrack(state.track + 1, 0);
  else if (state.kind === 'lectura') playNextChapter();
}

function playTrack(index: number, at: number) {
  const p = getPlayer();
  const track = state.audio!.tracks[index];
  set({ track: index });
  p.replace({ uri: track.url });
  p.setPlaybackRate(state.rate);
  if (at > 0) p.seekTo(at);
  p.play();
  showOnLockScreen(p);
}

/** Título y controles en la pantalla de bloqueo, la notificación de Android y, en la web, la Media Session. */
function showOnLockScreen(p: AudioPlayer) {
  try {
    p.setActiveForLockScreen(
      true,
      { title: state.title, artist: state.audio?.label ?? '', albumTitle: 'Biblia de estudio' },
      { showSeekBackward: true, showSeekForward: true },
    );
  } catch {
    // la pantalla de bloqueo no está en todas las plataformas
  }
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaSession) return;
  // expo-audio solo pasa de pista en sus listas; en la lectura, «siguiente» y «anterior» cambian de capítulo.
  const chapters = state.kind === 'lectura';
  try {
    navigator.mediaSession.setActionHandler('nexttrack', chapters ? () => playNextChapter() : null);
    navigator.mediaSession.setActionHandler('previoustrack', chapters ? () => playPreviousChapter() : null);
  } catch {
    // navegadores sin esas acciones
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

/** Abre la barra para algo nuevo y para lo que estuviera sonando antes. Devuelve el turno de esta petición. */
function start(kind: AudioKind, book: string, chapter: number, title: string): number {
  const id = ++request;
  stopSpeech();
  getPlayer().pause();
  set({ open: true, kind, book, chapter, title, loading: true, error: null, audio: null, speech: null, track: 0 });
  return id;
}

async function playFile(id: number, load: () => Promise<ChapterAudio>) {
  try {
    const audio = await load();
    if (id !== request) return;
    set({ audio, loading: false });
    playTrack(0, 0);
  } catch (e) {
    if (id !== request) return;
    set({ loading: false, error: e instanceof Error ? e.message : String(e) });
  }
}

type LecturaResponse = Omit<ChapterAudio, 'label'> & { version: { id: string; name: string } };

/** Lectura del capítulo con la versión elegida (Bible Brain, o LibriVox si no hay clave). */
export function playChapter(book: string, chapter: number, title: string, versionId?: string) {
  const id = start('lectura', book, chapter, title);
  loadVersions();
  return playFile(id, async () => {
    const bible = versionId ?? (await AsyncStorage.getItem(VERSION_KEY).catch(() => null)) ?? '';
    const res = await fetchJson<LecturaResponse>(
      `${API}/api/audio?book=${book}&chapter=${chapter}${bible ? `&bible=${encodeURIComponent(bible)}` : ''}`,
    );
    return { ...res, label: res.version.name };
  });
}

/** Lo que guarda la acción de grabación junto a cada MP3 (pipeline/audio_dramatizado). */
type Recording = { titulo: string; duracion: number; timestamps: [number, number][]; credito: string };

function playRecording(kind: 'dramatizado' | 'podcast', book: string, chapter: number, title: string, label: string) {
  const id = start(kind, book, chapter, title);
  const base = `${API}/audio/${kind}/${recordingId(book, chapter)}`;
  return playFile(id, async () => {
    const meta = await fetchJson<Recording>(`${base}.json`);
    return { label, tracks: [{ url: `${base}.mp3`, duration: meta.duracion }], timestamps: meta.timestamps ?? [], credit: meta.credito };
  });
}

export const playDramatized = (book: string, chapter: number, title: string) =>
  playRecording('dramatizado', book, chapter, title, 'Audio dramatizado');

/** Una grabación que no está en /audio (por ejemplo, un pódcast grabado bajo demanda). */
export type RemoteRecording = { url: string; duracion: number; credito: string };

export function playRecordedPodcast(book: string, chapter: number, title: string, remote?: RemoteRecording) {
  const label = 'Pódcast · Ana y Tomás';
  if (!remote) return playRecording('podcast', book, chapter, title, label);
  const id = start('podcast', book, chapter, title);
  return playFile(id, async () => ({ label, tracks: [{ url: remote.url, duration: remote.duracion }], timestamps: [], credit: remote.credito }));
}

// ---------------------------------------------------------------- pódcast con la voz del dispositivo

let speechToken = 0;

function stopSpeech() {
  speechToken++;
  Speech.stop();
}

/** Lee el guion del pódcast desde una intervención. Reanudar repite la intervención en la que se pausó. */
export function playSpeech(book: string, chapter: number, title: string, lines: Line[], from = 0) {
  const same = state.kind === 'podcast' && state.speech && state.book === book && state.chapter === chapter;
  if (!same) {
    start('podcast', book, chapter, title);
    set({ loading: false, audio: null, speech: { lines, index: 0, playing: false } });
  } else {
    set({ speech: { ...state.speech!, lines } });
  }
  speakFrom(from);
}

async function speakFrom(index: number) {
  stopSpeech();
  const my = speechToken;
  const speech = state.speech;
  if (!speech) return;
  if (index >= speech.lines.length) {
    set({ speech: { ...speech, index: 0, playing: false } });
    return;
  }
  set({ speech: { ...speech, index, playing: true } });
  const voices = await pickVoices();
  const line = speech.lines[index];
  const parts = chunks(line.text);
  const voice = voices[line.speaker];
  const speakPart = (i: number) => {
    if (my !== speechToken) return;
    if (i >= parts.length) {
      speakFrom(index + 1);
      return;
    }
    Speech.speak(parts[i], {
      language: 'es',
      voice: voice.voice,
      pitch: voice.pitch,
      rate: state.rate,
      onDone: () => speakPart(i + 1),
      onError: () => {
        if (my === speechToken && state.speech) set({ speech: { ...state.speech, playing: false } });
      },
    });
  };
  speakPart(0);
}

/** Quién habla ahora en el pódcast leído, para la barra. */
export const speakerNow = (speech: SpeechAudio) => SPEAKERS[speech.lines[speech.index]?.speaker ?? 'ana'];

// ---------------------------------------------------------------- controles

/** Pausa lo que esté sonando (por ejemplo, al grabar una nota de voz). */
export function pauseAudio() {
  if (player?.playing) player.pause();
  if (state.speech?.playing) {
    stopSpeech();
    set({ speech: { ...state.speech, playing: false } });
  }
}

export function toggle() {
  if (state.speech) {
    if (state.speech.playing) pauseAudio();
    else speakFrom(state.speech.index);
    return;
  }
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

/** Atrás o adelante: segundos en un archivo, intervenciones en el pódcast leído. */
export function seekBy(delta: number) {
  if (state.speech) {
    const { index, lines } = state.speech;
    speakFrom(Math.max(0, Math.min(lines.length - 1, index + Math.sign(delta))));
    return;
  }
  seekChapter(Math.max(0, chapterTime(getPlayer().currentTime) + delta));
}

/** Salta a una intervención del pódcast leído. */
export const speakLine = (index: number) => speakFrom(index);

/** Versículo (o intervención) que suena ahora, según los tiempos del audio (null si no hay tiempos). */
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
  if (state.speech?.playing) speakFrom(state.speech.index);
}

export async function setVersion(id: string) {
  await AsyncStorage.setItem(VERSION_KEY, id).catch(() => {});
  if (state.book) playChapter(state.book, state.chapter, state.title, id);
}

/** El capítulo vecino, cruzando de libro si hace falta. */
async function neighbour(step: 1 | -1) {
  if (!state.book) return null;
  const books = await getBooks();
  const i = books.findIndex((b) => b.id === state.book);
  const book = books[i];
  if (!book) return null;
  const chapter = state.chapter + step;
  if (chapter >= 1 && chapter <= book.chapters) return { from: book, to: book, chapter };
  const other = books[i + step];
  if (!other) return null;
  return { from: book, to: other, chapter: step > 0 ? 1 : other.chapters };
}

async function playChapterAt(step: 1 | -1) {
  const next = await neighbour(step);
  if (!next) return;
  // Si se está leyendo el capítulo que suena, la pantalla lo acompaña.
  const here = chapterHref(next.from.id, state.chapter);
  if (location === here || location.startsWith(`${here}/`)) router.replace(chapterHref(next.to.id, next.chapter));
  // También el mapa que sigue la lectura (/recorrido/hechos/13)
  else if (location.split('?')[0] === `/recorrido${here}`) router.replace(`/recorrido${chapterHref(next.to.id, next.chapter)}` as never);
  playChapter(next.to.id, next.chapter, `${next.to.name} ${next.chapter}`, state.audio?.version?.id);
}

const playNextChapter = () => playChapterAt(1);
const playPreviousChapter = () => playChapterAt(-1);

export function closeAudio() {
  request++;
  stopSpeech();
  if (player) {
    player.pause();
    try {
      player.clearLockScreenControls();
    } catch {
      // igual que arriba
    }
  }
  set({ open: false, audio: null, speech: null, loading: false, error: null });
}
