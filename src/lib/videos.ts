// Videos de YouTube como fuente al preparar un mensaje (Mike, 2026-11-07). La IA no puede ver un video: usa su
// transcripción, que la persona copia desde YouTube («Mostrar transcripción») y pega en la app.

/** Hasta cuántos videos y cuánto texto de cada transcripción se mandan a la IA (un sermón de una hora cabe). */
export const MAX_VIDEOS = 3;
export const MAX_TRANSCRIPCION = 60_000;

export type Video = { url: string; transcripcion?: string };

const ID = /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/;

/** El id de un enlace de YouTube («https://youtu.be/abc…», «…/watch?v=abc…», shorts, live), o null. */
export function idDeYoutube(url: string): string | null {
  return ID.exec(url)?.[1] ?? null;
}

/** Los enlaces de YouTube de un texto, sin repetir el mismo video, en el orden en que aparecen. */
export function enlacesDeYoutube(texto: string): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const m of texto.matchAll(/https?:\/\/[^\s<>«»"]+/g)) {
    const url = m[0].replace(/[.,;:)\]]+$/, '');
    const id = idDeYoutube(url);
    if (id && !vistos.has(id)) {
      vistos.add(id);
      out.push(url);
    }
  }
  return out.slice(0, MAX_VIDEOS);
}

/** La miniatura del video, para reconocerlo en la app. */
export const miniatura = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/**
 * La transcripción copiada de YouTube, en párrafos: sin las marcas de tiempo («0:00», «12:34», «1:02:03»), ni el
 * título «Transcripción», ni líneas repetidas, con las frases unidas en párrafos de unas 90 palabras.
 */
export function parrafosDeTranscripcion(texto: string, palabras = 90): string[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}\s*/, '').trim())
    .filter((l) => l && !/^(transcripci[oó]n|transcript)$/i.test(l) && !/^\d+ (?:segundos?|minutos?|horas?)(?:,? \d+ (?:segundos?|minutos?))*$/i.test(l));
  const out: string[] = [];
  let actual: string[] = [];
  for (const l of lineas) {
    if (actual.at(-1) === l) continue;
    actual.push(l);
    if (actual.join(' ').split(/\s+/).length >= palabras && /[.!?…»"]$/.test(l)) {
      out.push(actual.join(' '));
      actual = [];
    } else if (actual.join(' ').split(/\s+/).length >= palabras * 2) {
      out.push(actual.join(' '));
      actual = [];
    }
  }
  if (actual.length) out.push(actual.join(' '));
  return out;
}
