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

import { anotar } from './actividad';
import { getBooks } from './data';
import { Line, SPEAKERS, chunks, pickVoices } from './podcast';
import { lineStarts } from './podcastTiempos';
import { chapterHref } from './routes';
import { huella } from './sellos';
import { paraHablar } from './voces';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const VERSION_KEY = 'audio-version';

export type AudioKind = 'lectura' | 'dramatizado' | 'podcast' | 'original';
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
  /** Lectura en hebreo o griego: [inicio, fin] de cada palabra del interlineal, por versículo (null si no se lee). */
  words?: Record<string, ([number, number] | null)[]>;
  language?: 'hebreo' | 'griego';
  /** Pódcast grabado: las intervenciones del guion (los tiempos marcan dónde empieza cada una). */
  lines?: Line[];
};
/** El pódcast con la voz del dispositivo no tiene archivo: se lee intervención por intervención. */
export type SpeechAudio = { lines: Line[]; index: number; playing: boolean };
/** Capítulos con grabaciones propias, por tipo («mrk-1»). Lo escriben las acciones de audio dramatizado y original. */
export type Catalog = { dramatizado: string[]; podcast: string[]; original: string[] };

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
  catalog: { dramatizado: [], podcast: [], original: [] },
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

/** Una parte del estado del reproductor (un número o un booleano): así solo se vuelve a dibujar cuando esa parte cambia. */
export function useAudioSelect<T>(select: (s: AudioState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
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
        if (body) set({ catalog: { dramatizado: body.dramatizado ?? [], podcast: body.podcast ?? [], original: body.original ?? [] } });
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
      { title: state.title, artist: state.audio?.label ?? '', albumTitle: 'Zarza' },
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
  followWords(kind === 'original');
  return id;
}

/** Carga y reproduce un archivo; `at` dice desde qué segundo, ya con los tiempos cargados. */
async function playFile(id: number, load: () => Promise<ChapterAudio>, at?: (audio: ChapterAudio) => number) {
  try {
    const audio = await load();
    if (id !== request) return;
    set({ audio, loading: false });
    playTrack(0, at?.(audio) ?? 0);
  } catch (e) {
    if (id !== request) return;
    set({ loading: false, error: e instanceof Error ? e.message : String(e) });
  }
}

type LecturaResponse = Omit<ChapterAudio, 'label'> & { version: { id: string; name: string } };

/** Lectura del capítulo con la versión elegida (Bible Brain, o LibriVox si no hay clave). */
export function playChapter(book: string, chapter: number, title: string, versionId?: string) {
  anotar('escuchar', `${book}.${chapter}`, title);
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
  anotar(kind, `${book}.${chapter}`, title);
  const id = start(kind, book, chapter, title);
  const base = `${API}/audio/${kind}/${recordingId(book, chapter)}`;
  return playFile(id, async () => {
    const meta = await fetchJson<Recording>(`${base}.json`);
    return { label, tracks: [{ url: `${base}.mp3`, duration: meta.duracion }], timestamps: meta.timestamps ?? [], credit: meta.credito };
  });
}

export const playDramatized = (book: string, chapter: number, title: string) =>
  playRecording('dramatizado', book, chapter, title, 'Audio dramatizado');

/** Lo que guarda la acción de audio original junto a cada capítulo (pipeline/audio_original/alinear.py). */
type OriginalTimings = {
  idioma: 'hebreo' | 'griego';
  src: string;
  duracion: number;
  lector: string;
  credito: string;
  timestamps: [number, number][];
  palabras: Record<string, ([number, number] | null)[]>;
};

/** El capítulo leído en hebreo o en griego, con los tiempos de cada palabra para resaltar el interlineal. */
export function playOriginal(book: string, chapter: number, title: string) {
  huella('original', `${book}.${chapter}`);
  anotar('original', `${book}.${chapter}`, title);
  const id = start('original', book, chapter, title);
  return playFile(id, async () => {
    const meta = await fetchJson<OriginalTimings>(`${API}/audio/original/${recordingId(book, chapter)}.json`);
    return {
      label: `En ${meta.idioma} · ${meta.lector}`,
      tracks: [{ url: meta.src, duration: meta.duracion }],
      timestamps: meta.timestamps,
      credit: meta.credito,
      words: meta.palabras,
      language: meta.idioma,
    };
  });
}

// La palabra que suena se consulta varias veces por segundo (el estado del reproductor llega cada 250 ms, poco para
// seguir palabras cortas). Va aparte del estado general para que solo se vuelva a dibujar la palabra que cambia.
type Spoken = { verse: number; index: number } | null;
let spoken: Spoken = null;
let ticker: ReturnType<typeof setInterval> | null = null;
const wordListeners = new Set<() => void>();

function setSpoken(next: Spoken) {
  if (next?.verse === spoken?.verse && next?.index === spoken?.index) return;
  spoken = next;
  wordListeners.forEach((l) => l());
}

function followWords(on: boolean) {
  if (ticker) clearInterval(ticker);
  ticker = null;
  setSpoken(null);
  if (on) ticker = setInterval(() => player && setSpoken(wordAt(chapterTime(player.currentTime))), 80);
}

/** Lo que el componente necesita de la palabra que suena (un número o un booleano, para no dibujar de más). */
export function useSpoken<T>(select: (w: Spoken) => T): T {
  return useSyncExternalStore(
    (l) => {
      wordListeners.add(l);
      return () => {
        wordListeners.delete(l);
      };
    },
    () => select(spoken),
    () => select(null),
  );
}

/** Palabra del interlineal que suena ahora en la lectura original (null si no suena ninguna). */
export function wordAt(seconds: number): { verse: number; index: number } | null {
  const words = state.kind === 'original' ? state.audio?.words : undefined;
  const verse = words ? currentVerse(seconds) : null;
  if (!words || verse === null) return null;
  const row = words[String(verse)] ?? [];
  let found = -1;
  for (let i = 0; i < row.length; i++) {
    const t = row[i];
    if (t && t[0] <= seconds + 0.05) found = i;
    else if (t && t[0] > seconds) break;
  }
  return found < 0 ? null : { verse, index: found };
}

/** Salta a una palabra de la lectura original (al tocarla en el interlineal). */
export function seekWord(verse: number, index: number): boolean {
  const t = state.kind === 'original' ? state.audio?.words?.[String(verse)]?.[index] : null;
  if (!t) return false;
  seekChapter(t[0]);
  if (!getPlayer().playing) getPlayer().play();
  return true;
}

/** Una grabación que no está en /audio (por ejemplo, un pódcast grabado bajo demanda). */
export type RemoteRecording = { url: string; duracion: number; credito: string; tiempos?: number[] };

/**
 * El pódcast con voces naturales: el que viene con la app (/audio/podcast) o uno grabado bajo demanda. Con el guion
 * (`lines`), cada intervención lleva su tiempo para que la pantalla siga el texto; `from` empieza en una intervención.
 */
export function playRecordedPodcast(
  book: string,
  chapter: number,
  title: string,
  { remote, lines = [], from = 0 }: { remote?: RemoteRecording; lines?: Line[]; from?: number } = {},
) {
  anotar('podcast', `${book}.${chapter}`, title);
  const id = start('podcast', book, chapter, title);
  const base = `${API}/audio/podcast/${recordingId(book, chapter)}`;
  return playFile(
    id,
    async () => {
      const src: RemoteRecording =
        remote ?? (await fetchJson<Recording>(`${base}.json`).then((m) => ({ url: `${base}.mp3`, duracion: m.duracion, credito: m.credito })));
      // Los tiempos del servidor sirven si son del mismo guion; si no, se reparten por la longitud de cada intervención.
      const starts =
        src.tiempos?.length === lines.length ? src.tiempos : lineStarts(lines.map((l) => l.text), src.duracion);
      return {
        label: 'Pódcast · Ana y Tomás',
        tracks: [{ url: src.url, duration: src.duracion }],
        timestamps: starts.map((t, i) => [i, t] as [number, number]),
        credit: src.credito,
        lines,
      };
    },
    (audio) => audio.timestamps[from]?.[1] ?? 0,
  );
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
    anotar('podcast', `${book}.${chapter}`, title);
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
  const parts = chunks(paraHablar(line.text));
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
/** Si suena algo del reproductor (para que la música de ambiente se aparte). No crea el reproductor. */
export const mainPlaying = () => !!player?.playing || !!state.speech?.playing;

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
  followWords(false);
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
