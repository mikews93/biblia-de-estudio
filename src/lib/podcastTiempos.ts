// Dónde empieza cada intervención en un pódcast grabado. ElevenLabs no devuelve los tiempos, así que se reparten
// por la longitud de cada texto, con una pausa fija por cambio de voz. Lo usan el servidor al grabar (por tramos,
// cuya duración sí se conoce) y la app para las grabaciones que no traen tiempos guardados.

/** Caracteres que «vale» la pausa entre una intervención y la siguiente. */
const PAUSA = 18;

/** Segundo en que empieza cada texto, si todos juntos duran `duracion` segundos y empiezan en `desde`. */
export function lineStarts(texts: string[], duracion: number, desde = 0): number[] {
  const pesos = texts.map((t) => t.length + PAUSA);
  const total = pesos.reduce((s, p) => s + p, 0) || 1;
  const out: number[] = [];
  let at = desde;
  for (const p of pesos) {
    out.push(Math.round(at * 10) / 10);
    at += (p / total) * duracion;
  }
  return out;
}
