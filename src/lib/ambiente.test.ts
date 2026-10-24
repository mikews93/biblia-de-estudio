import { createAudioPlayer } from 'expo-audio';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APARTE, CRUCE, PISTAS, paso, playAmbiente, stopAmbiente, volumenReal } from './ambiente';

type Fake = { uri: string; volume: number; currentTime: number; playing: boolean; play: () => void; pause: () => void; seekTo: (s: number) => void; remove: () => void };
let fakes: Fake[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  fakes = [];
  vi.mocked(createAudioPlayer).mockImplementation(((src: { uri: string }) => {
    const f: Fake = {
      uri: src.uri,
      volume: 1,
      currentTime: 0,
      playing: false,
      play() {
        this.playing = true;
      },
      pause() {
        this.playing = false;
      },
      seekTo(s: number) {
        this.currentTime = s;
      },
      remove: vi.fn(),
    };
    fakes.push(f);
    return f;
  }) as never);
});

afterEach(async () => {
  stopAmbiente();
  await vi.advanceTimersByTimeAsync(5000);
  vi.useRealTimers();
});

describe('paso y volumen', () => {
  it('acerca la ganancia a la meta sin pasarse', () => {
    expect(paso(0, 1, 0.5, 2)).toBeCloseTo(0.25);
    expect(paso(0.9, 1, 0.5, 2)).toBe(1);
    expect(paso(0.1, 0, 0.5, 2)).toBe(0);
  });

  it('usa una curva y se aparta si suena la lectura', () => {
    expect(volumenReal(0.5, 1, false)).toBeCloseTo(0.25);
    expect(volumenReal(0.5, 1, true)).toBeCloseTo(0.25 * APARTE);
    expect(volumenReal(1, 0, false)).toBe(0);
  });
});

describe('reproductor de ambiente', () => {
  it('entra suave, cruza las vueltas y se suelta al apagar', async () => {
    await playAmbiente('noche');
    expect(fakes).toHaveLength(2);
    expect(fakes[0].uri).toBe('/audio/ambiente/noche.mp3');
    expect(fakes[0].playing).toBe(true);
    expect(fakes[0].volume).toBe(0);

    await vi.advanceTimersByTimeAsync(3000);
    expect(fakes[0].volume).toBeCloseTo(volumenReal(0.5, 1, false));

    // Al final del bucle empieza la otra voz y se cruzan.
    fakes[0].currentTime = PISTAS.find((p) => p.id === 'noche')!.bucle;
    await vi.advanceTimersByTimeAsync(200);
    expect(fakes[1].playing).toBe(true);
    await vi.advanceTimersByTimeAsync(CRUCE * 1000 + 200);
    expect(fakes[1].volume).toBeCloseTo(volumenReal(0.5, 1, false));
    expect(fakes[0].playing).toBe(false);

    stopAmbiente();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fakes.every((f) => !f.playing)).toBe(true);
    expect(fakes[0].remove).toHaveBeenCalled();
  });

  it('recuerda la última pista elegida', async () => {
    await playAmbiente('amanecer');
    stopAmbiente();
    await vi.advanceTimersByTimeAsync(2000);
    await playAmbiente();
    expect(fakes.at(-1)!.uri).toBe('/audio/ambiente/amanecer.mp3');
  });
});
