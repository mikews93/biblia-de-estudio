import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Una llamada (WhatsApp) tiene el foco de audio: con «doNotMix» el reproductor queda cargado y quieto, sin error.
let mezclar = false;
let llamada = true;
let reloj: ReturnType<typeof setInterval>;
const fake = {
  currentTime: 0,
  playing: false,
  isLoaded: true,
  isBuffering: false,
  play() {
    if (!llamada || mezclar) this.playing = true;
  },
  pause() {
    this.playing = false;
  },
  replace() {
    this.currentTime = 0;
  },
  seekTo(s: number) {
    this.currentTime = s;
  },
  setPlaybackRate() {},
  addListener() {},
  setActiveForLockScreen() {},
  clearLockScreenControls() {},
};

vi.mocked(createAudioPlayer).mockImplementation((() => fake) as never);
vi.mocked(setAudioModeAsync).mockImplementation(async (m) => {
  mezclar = m.interruptionMode === 'mixWithOthers';
});

const audio = await import('./audio');
const remote = { url: 'https://zarza/podcast.mp3', duracion: 300, credito: '' };

describe('audio con una llamada abierta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    llamada = true;
    mezclar = false;
    fake.playing = false;
    reloj = setInterval(() => {
      if (fake.playing) fake.currentTime += 0.25;
    }, 250);
  });

  afterEach(() => {
    clearInterval(reloj);
    audio.closeAudio();
    vi.useRealTimers();
    (Platform as { OS: string }).OS = 'web';
  });

  it('en la app suena mezclado con la llamada y lo avisa', async () => {
    (Platform as { OS: string }).OS = 'android';
    await audio.playRecordedPodcast('jhn', 3, 'Juan 3', { remote });
    expect(fake.playing).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(setAudioModeAsync).toHaveBeenLastCalledWith(expect.objectContaining({ interruptionMode: 'mixWithOthers' }));
    expect(fake.playing).toBe(true);
    expect(audio.avisoSonidoAhora()).toBe('mezclado');
  });

  it('un audio nuevo vuelve a pedir el foco y, sin llamada, no avisa nada', async () => {
    (Platform as { OS: string }).OS = 'android';
    llamada = false;
    await audio.playRecordedPodcast('jhn', 4, 'Juan 4', { remote });
    expect(setAudioModeAsync).toHaveBeenLastCalledWith(expect.objectContaining({ interruptionMode: 'doNotMix' }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(fake.playing).toBe(true);
    expect(audio.avisoSonidoAhora()).toBe(null);
  });

  it('en el navegador no se puede mezclar: avisa por qué no suena', async () => {
    await audio.playRecordedPodcast('jhn', 5, 'Juan 5', { remote });
    await vi.advanceTimersByTimeAsync(2000);
    expect(fake.playing).toBe(false);
    expect(audio.avisoSonidoAhora()).toBe('bloqueado');
  });

  it('si la persona pausa mientras carga, no se cambia nada', async () => {
    (Platform as { OS: string }).OS = 'android';
    await audio.playRecordedPodcast('jhn', 6, 'Juan 6', { remote });
    audio.pauseAudio();
    await vi.advanceTimersByTimeAsync(3000);
    expect(audio.avisoSonidoAhora()).toBe(null);
  });
});
