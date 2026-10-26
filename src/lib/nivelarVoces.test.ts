import { describe, expect, it } from 'vitest';

import { muestrasA16, nivelar, OBJETIVO_DB, pcmAMuestras, tramosPorSilencio, volumenHabla } from './nivelarVoces';

const RATE = 16000;
/** `seg` segundos de tono a cierta amplitud seguidos de `pausa` de silencio. */
function voz(amplitud: number, seg: number, pausa: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < seg * RATE; i++) out.push(amplitud * Math.sin((2 * Math.PI * 200 * i) / RATE));
  for (let i = 0; i < pausa * RATE; i++) out.push(0);
  return out;
}
const tramo = (desde: number, hasta: number) => ({ desde: Math.round(desde * RATE), hasta: Math.round(hasta * RATE) });

describe('nivelar voces', () => {
  // Ana baja, Tomás fuerte, Ana otra vez.
  const audio = Float32Array.from([...voz(0.05, 1, 0.5), ...voz(0.5, 1, 0.5), ...voz(0.05, 1, 0.5)]);

  it('encuentra cada intervención por los silencios', () => {
    const t = tramosPorSilencio(audio, RATE);
    expect(t).toHaveLength(3);
    expect(t[1].desde / RATE).toBeCloseTo(1.5, 1);
    expect(t[1].hasta / RATE).toBeCloseTo(2.5, 1);
  });

  it('deja todas las intervenciones al mismo volumen', () => {
    const antes = volumenHabla(audio, RATE, tramo(1.6, 2.4))! - volumenHabla(audio, RATE, tramo(0.1, 0.9))!;
    expect(antes).toBeCloseTo(20, 0);
    const out = nivelar(audio, RATE, tramosPorSilencio(audio, RATE));
    for (const desde of [0, 1.5, 3]) {
      expect(volumenHabla(out, RATE, tramo(desde + 0.1, desde + 0.9))).toBeCloseTo(OBJETIVO_DB, 0);
    }
  });

  it('ningún pico pasa del techo, aunque haya que subir mucho', () => {
    const out = nivelar(audio, RATE, tramosPorSilencio(audio, RATE), -3);
    expect(Math.max(...out.map(Math.abs))).toBeLessThanOrEqual(0.8 + 1e-6);
  });

  it('un tramo en silencio no se dispara', () => {
    const callado = new Float32Array(RATE);
    expect(volumenHabla(callado, RATE, tramo(0, 1))).toBeNull();
    expect(nivelar(callado, RATE, [tramo(0, 1)]).every((x) => x === 0)).toBe(true);
  });

  it('pasa de PCM de 16 bits a muestras y de vuelta', () => {
    const m = Float32Array.from([0, 0.5, -0.5, 0.25]);
    const bytes = new Uint8Array(muestrasA16(m).buffer);
    expect([...pcmAMuestras(bytes)].map((x) => Math.round(x * 100) / 100)).toEqual([0, 0.5, -0.5, 0.25]);
  });
});
