// Codificar y decodificar MP3 dentro de la función, sin ffmpeg (Vercel no lo trae). Los dos paquetes son solo-ES:
// se cargan con import() al usarlos, no al nivel del módulo (ver la caída de /api/comunidades del Lote 15).

/** Muestras mono entre −1 y 1 a MP3 mono. */
export async function codificarMp3(muestras: Int16Array, rate: number, kbps: number): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const enc = new Mp3Encoder(1, rate, kbps);
  const partes: Uint8Array[] = [];
  const BLOQUE = 1152 * 20;
  for (let i = 0; i < muestras.length; i += BLOQUE) partes.push(enc.encodeBuffer(muestras.subarray(i, i + BLOQUE)));
  partes.push(enc.flush());
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of partes) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Un MP3 a muestras mono (si trae dos canales, se promedian). */
export async function decodificarMp3(mp3: Uint8Array): Promise<{ muestras: Float32Array; rate: number }> {
  const { MPEGDecoder } = await import('mpg123-decoder');
  const dec = new MPEGDecoder();
  await dec.ready;
  try {
    const { channelData, sampleRate } = dec.decode(mp3);
    if (!channelData.length || !sampleRate) throw new Error('MP3 sin audio');
    if (channelData.length === 1) return { muestras: channelData[0], rate: sampleRate };
    const [a, b] = channelData;
    const muestras = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) muestras[i] = (a[i] + b[i]) / 2;
    return { muestras, rate: sampleRate };
  } finally {
    dec.free();
  }
}
