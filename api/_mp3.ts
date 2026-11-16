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
  return conInfo(unir(partes));
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

/** Dos canales (izquierdo y derecho) a MP3 estéreo. */
export async function codificarMp3Estereo(l: Int16Array, r: Int16Array, rate: number, kbps: number): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const enc = new Mp3Encoder(2, rate, kbps);
  const partes: Uint8Array[] = [];
  const BLOQUE = 1152 * 20;
  for (let i = 0; i < l.length; i += BLOQUE) partes.push(enc.encodeBuffer(l.subarray(i, i + BLOQUE), r.subarray(i, i + BLOQUE)));
  partes.push(enc.flush());
  return conInfo(unir(partes));
}

/** Un MP3 a sus dos canales (si es mono, los dos son el mismo). */
export async function decodificarMp3Estereo(mp3: Uint8Array): Promise<{ l: Float32Array; r: Float32Array; rate: number }> {
  const { MPEGDecoder } = await import('mpg123-decoder');
  const dec = new MPEGDecoder();
  await dec.ready;
  try {
    const { channelData, sampleRate } = dec.decode(mp3);
    if (!channelData.length || !sampleRate) throw new Error('MP3 sin audio');
    return { l: channelData[0], r: channelData[1] ?? channelData[0], rate: sampleRate };
  } finally {
    dec.free();
  }
}

function unir(partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of partes) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// Capa III: kbps según el índice del encabezado, para MPEG-1 y para MPEG-2/2.5.
const KBPS_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const KBPS_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const HZ_V1 = [44100, 48000, 32000];

type Trama = { largo: number; v1: boolean; mono: boolean };

/** Lee el encabezado de una trama MP3 (capa III) en `at`; null si ahí no empieza una. */
function trama(mp3: Uint8Array, at: number): Trama | null {
  if (at + 4 > mp3.length || mp3[at] !== 0xff || (mp3[at + 1] & 0xe0) !== 0xe0) return null;
  const version = (mp3[at + 1] >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
  if (version === 1 || ((mp3[at + 1] >> 1) & 3) !== 1) return null;
  const v1 = version === 3;
  const kbps = (v1 ? KBPS_V1 : KBPS_V2)[mp3[at + 2] >> 4];
  const hzIndex = (mp3[at + 2] >> 2) & 3;
  if (!kbps || hzIndex === 3) return null;
  const hz = HZ_V1[hzIndex] / (v1 ? 1 : version === 2 ? 2 : 4);
  const relleno = (mp3[at + 2] >> 1) & 1;
  const largo = Math.floor(((v1 ? 144000 : 72000) * kbps) / hz) + relleno;
  return { largo, v1, mono: mp3[at + 3] >> 6 === 3 };
}

/**
 * Pone delante una trama «Info» (la de LAME para archivos CBR) con cuántas tramas y bytes trae el archivo. Sin ella,
 * el reproductor de Android solo sabe la duración si el servidor manda el tamaño; si no lo sabe, trata el audio como
 * una emisión en vivo: la notificación queda sin barra de progreso, sin tiempo y sin poder adelantar.
 */
export function conInfo(mp3: Uint8Array): Uint8Array {
  const primera = trama(mp3, 0);
  if (!primera) return mp3;
  let tramas = 0;
  let t: Trama | null = primera;
  for (let at = 0; t; t = trama(mp3, at)) {
    tramas++;
    at += t.largo;
  }
  // La trama Info lleva el mismo encabezado que la primera, sin relleno ni CRC, y en silencio.
  const cabecera = [mp3[0], mp3[1] | 1, mp3[2] & ~2, mp3[3]];
  const largo = primera.largo - ((mp3[2] >> 1) & 1);
  const lado = primera.v1 ? (primera.mono ? 17 : 32) : primera.mono ? 9 : 17;
  if (largo < 4 + lado + 16) return mp3;
  const info = new Uint8Array(largo);
  info.set(cabecera, 0);
  const vista = new DataView(info.buffer);
  const at = 4 + lado;
  info.set([0x49, 0x6e, 0x66, 0x6f], at); // «Info»
  vista.setUint32(at + 4, 3); // trae tramas y bytes
  vista.setUint32(at + 8, tramas);
  vista.setUint32(at + 12, largo + mp3.length);
  return unir([info, mp3]);
}
