import { describe, expect, it } from 'vitest';
import { codificarMp3, codificarMp3Estereo, decodificarMp3 } from '../../api/_mp3';

const texto = (b: Uint8Array) => String.fromCharCode(...b);

describe('trama Info al codificar', () => {
  it('lleva cuántas tramas y bytes trae el MP3 (mono, MPEG-2 como el pódcast)', async () => {
    const rate = 24000;
    const tono = new Int16Array(rate * 3).map((_, i) => Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / rate)));
    const mp3 = await codificarMp3(tono, rate, 64);
    expect(texto(mp3.subarray(4 + 9, 4 + 9 + 4))).toBe('Info');
    const vista = new DataView(mp3.buffer, mp3.byteOffset);
    const tramas = vista.getUint32(4 + 9 + 8);
    expect(vista.getUint32(4 + 9 + 12)).toBe(mp3.length);
    // 576 muestras por trama en MPEG-2: la duración que lee el reproductor
    expect(Math.abs((tramas * 576) / rate - 3)).toBeLessThan(0.2);
    // y sigue sonando igual (la trama Info no añade audio)
    const { muestras } = await decodificarMp3(mp3);
    expect(Math.abs(muestras.length / rate - 3)).toBeLessThan(0.2);
  });

  it('también en estéreo', async () => {
    const rate = 24000;
    const l = new Int16Array(rate).fill(1000);
    const mp3 = await codificarMp3Estereo(l, l, rate, 112);
    expect(texto(mp3.subarray(4 + 17, 4 + 17 + 4))).toBe('Info');
    expect(new DataView(mp3.buffer, mp3.byteOffset).getUint32(4 + 17 + 12)).toBe(mp3.length);
  });
});
