// Iguala el volumen de las voces de un pódcast grabado. ElevenLabs entrega a Ana (Cristina Campos) unos 8 dB más
// baja que a Tomás (Mauricio): al cambiar de voz, quien escucha tenía que subir y bajar el volumen. Aquí cada tramo
// (una intervención, o un trozo de voz entre silencios) se lleva al mismo volumen de habla, con rampas cortas para que
// no se noten los saltos, y un limitador suave evita que los picos se rompan.

/** Un trozo del audio, en muestras: [desde, hasta). */
export type Tramo = { desde: number; hasta: number };

/** Volumen de habla al que se lleva cada tramo (RMS de los momentos con voz, en dBFS). Queda cerca de −16 LUFS. */
export const OBJETIVO_DB = -15.5;
/** Cuánto se puede subir o bajar un tramo como mucho: un tramo casi mudo no se dispara. */
const MAX_SUBIR_DB = 15;
const MAX_BAJAR_DB = 12;
/** Ventana para medir y separar voz de silencio. */
const VENTANA_S = 0.05;
/** Una ventana cuenta como voz si suena a menos de esto por debajo de la más fuerte del tramo. */
const RANGO_VOZ_DB = 30;
const RAMPA_S = 0.03;
/** Ningún pico pasa de aquí (−2 dBFS): el MP3 añade algo encima y así no satura. */
const TECHO = 0.8;
/** El limitador mira este tiempo por delante y por detrás de cada pico para bajar la ganancia sin chasquidos. */
const LIMITE_S = 0.005;

const db = (x: number) => 20 * Math.log10(x + 1e-12);
const lineal = (d: number) => 10 ** (d / 20);

/** RMS de cada ventana entre `desde` y `hasta`. */
function ventanas(m: Float32Array, rate: number, desde: number, hasta: number): number[] {
  const n = Math.max(1, Math.round(VENTANA_S * rate));
  const out: number[] = [];
  for (let i = desde; i < hasta; i += n) {
    const fin = Math.min(hasta, i + n);
    let s = 0;
    for (let k = i; k < fin; k++) s += m[k] * m[k];
    out.push(Math.sqrt(s / Math.max(1, fin - i)));
  }
  return out;
}

/** Volumen de habla de un tramo (dBFS), sin contar los silencios. `null` si el tramo es silencio. */
export function volumenHabla(m: Float32Array, rate: number, t: Tramo): number | null {
  const v = ventanas(m, rate, t.desde, t.hasta);
  const max = Math.max(...v, 0);
  if (db(max) < -60) return null;
  const voz = v.filter((x) => db(x) > db(max) - RANGO_VOZ_DB);
  return db(Math.sqrt(voz.reduce((s, x) => s + x * x, 0) / voz.length));
}

/**
 * Trozos de voz separados por silencios de al menos `silencioS` segundos. Sirve para las grabaciones que no traen
 * dónde empieza cada intervención: en el pódcast, cada cambio de voz deja una pausa.
 */
export function tramosPorSilencio(m: Float32Array, rate: number, silencioS = 0.3): Tramo[] {
  const n = Math.max(1, Math.round(VENTANA_S * rate));
  const v = ventanas(m, rate, 0, m.length);
  const max = Math.max(...v, 0);
  const pausa = Math.ceil(silencioS / VENTANA_S);
  const tramos: Tramo[] = [];
  let inicio = -1;
  let callado = 0;
  v.forEach((x, i) => {
    if (db(x) > db(max) - 40) {
      if (inicio < 0) inicio = i;
      callado = 0;
    } else if (inicio >= 0 && ++callado >= pausa) {
      tramos.push({ desde: inicio * n, hasta: Math.min(m.length, (i - callado + 1) * n) });
      inicio = -1;
      callado = 0;
    }
  });
  if (inicio >= 0) tramos.push({ desde: inicio * n, hasta: m.length });
  return tramos;
}

/**
 * Devuelve el audio con cada tramo al mismo volumen de habla. Entre tramos la ganancia pasa de uno a otro en el
 * silencio, con una rampa corta; fuera de los tramos se usa la del tramo más cercano.
 */
export function nivelar(m: Float32Array, rate: number, tramos: Tramo[], objetivo = OBJETIVO_DB): Float32Array {
  const orden = tramos.filter((t) => t.hasta > t.desde).sort((a, b) => a.desde - b.desde);
  const ganancias = orden.map((t) => {
    const v = volumenHabla(m, rate, t);
    return v === null ? 1 : lineal(Math.max(-MAX_BAJAR_DB, Math.min(MAX_SUBIR_DB, objetivo - v)));
  });
  const out = new Float32Array(m.length);
  if (!orden.length) {
    out.set(m);
    return out;
  }
  const rampa = Math.max(1, Math.round(RAMPA_S * rate));
  // La ganancia de cada muestra: la de su tramo; entre dos tramos cambia en el medio del silencio.
  const g = new Float32Array(m.length);
  let j = 0;
  for (let i = 0; i < m.length; i++) {
    while (j + 1 < orden.length && i >= (orden[j].hasta + orden[j + 1].desde) / 2) j++;
    g[i] = ganancias[j];
  }
  // Suaviza los escalones con una media móvil del largo de la rampa.
  let suma = 0;
  const media = new Float32Array(m.length);
  for (let i = 0; i < m.length; i++) {
    suma += g[i];
    if (i >= rampa) suma -= g[i - rampa];
    media[i] = suma / Math.min(i + 1, rampa);
  }
  const mitad = rampa >> 1;
  for (let i = 0; i < m.length; i++) out[i] = m[i] * media[Math.min(m.length - 1, i + mitad)];
  limitar(out, Math.max(1, Math.round(LIMITE_S * rate)));
  return out;
}

/**
 * Limitador con anticipación: la ganancia de cada muestra es la menor que necesita cualquier pico a menos de `w`
 * muestras, suavizada con una media del mismo largo. Así baja antes del pico y vuelve después, sin recortar la onda.
 */
function limitar(m: Float32Array, w: number) {
  const n = m.length;
  const minimo = new Float32Array(n);
  // Mínimo en la ventana [i − w, i + w] con una cola monótona: O(n).
  const cola = new Int32Array(n);
  let ini = 0;
  let fin = 0;
  const pide = (k: number) => Math.min(1, TECHO / (Math.abs(m[k]) || 1e-9));
  for (let i = 0, k = 0; i < n; i++) {
    for (; k < n && k <= i + w; k++) {
      while (fin > ini && pide(cola[fin - 1]) >= pide(k)) fin--;
      cola[fin++] = k;
    }
    while (cola[ini] < i - w) ini++;
    minimo[i] = pide(cola[ini]);
  }
  // La media de w muestras centrada nunca supera el mínimo de la ventana de 2w: el pico queda bajo el techo.
  let suma = 0;
  const g = new Float32Array(n);
  for (let i = 0; i < n + (w >> 1); i++) {
    if (i < n) suma += minimo[i];
    if (i >= w) suma -= minimo[i - w];
    const c = i - (w >> 1);
    if (c >= 0 && c < n) g[c] = suma / Math.min(i + 1, w, n - (i - w + 1));
  }
  for (let i = 0; i < n; i++) m[i] *= g[i];
}

/** PCM de 16 bits (little endian), como lo entrega ElevenLabs, a muestras entre −1 y 1. */
export function pcmAMuestras(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(bytes.byteLength >> 1);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

/** Muestras entre −1 y 1 a enteros de 16 bits, para el codificador MP3. */
export function muestrasA16(m: Float32Array): Int16Array {
  const out = new Int16Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(m[i] * 32767)));
  return out;
}
