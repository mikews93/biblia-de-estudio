// Compartir un versículo: como texto con enlace, o como imagen para redes (cuadrada o de historia).
// En web la imagen se dibuja en un canvas; en el teléfono VerseImage captura su vista previa.

import { Share } from 'react-native';

import { FONDOS, Fondo, LETRA_DEDICATORIA, Letra, fondoPorNombre, letraPorId, palabras } from './fondos';
import { verseHref } from './routes';

const SITE = 'https://zarzabiblia.com';

export type VerseToShare = { book: string; chapter: number; verse: number; text: string; reference: string; version?: string };

export type ImageFormat = 'cuadrado' | 'historia';
export type ImageStyle = Fondo;

/** Los fondos para elegir (ilustraciones y colores, en src/lib/fondos.ts). */
export const IMAGE_STYLES = FONDOS;

/** Cómo se ve la imagen: fondo, letra, palabras destacadas y una dedicatoria opcional («Oré por ti hoy»). */
export type ImageLook = {
  fondo: Fondo;
  letra: Letra;
  destacadas?: number[];
  dedicatoria?: string;
  original?: PalabraOriginal;
  /** Una línea de contexto al pie («Pablo lo escribe desde la cárcel»), para que el versículo no viaje solo. */
  contexto?: string;
};

/** Una palabra hebrea o griega del versículo, al pie de la imagen: «ἀγάπη · agápē · amor». */
export type PalabraOriginal = { palabra: string; translit: string; glosa: string };

/** Alto de la palabra original al pie (en la imagen de 1080 px), con su separación. */
export const ORIGINAL_SIZE = 58;
const ORIGINAL_HEIGHT = 48 + ORIGINAL_SIZE * 1.25 + 34 * 1.3;

/** La línea de contexto: letra, interlineado, separación y ancho en la imagen de 1080 px. */
export const CONTEXTO = { size: 32, interlinea: 1.35, margen: 26, ancho: 760 };
export const MAX_CONTEXTO = 110;

/** Lo que guarda una publicación de imagen en Comunidad para dibujarse igual en el muro. */
export type DatosImagen = {
  estilo?: string;
  formato?: ImageFormat;
  letra?: string;
  destacadas?: number[];
  dedicatoria?: string;
  original?: PalabraOriginal;
  contexto?: string;
};

export function datosDeImagen(format: ImageFormat, look: ImageLook): DatosImagen {
  const dedic = look.dedicatoria?.trim();
  return {
    estilo: look.fondo.name,
    formato: format,
    letra: look.letra.id,
    ...(look.destacadas?.length ? { destacadas: look.destacadas } : {}),
    ...(dedic ? { dedicatoria: dedic } : {}),
    ...(look.original ? { original: look.original } : {}),
    ...(look.contexto?.trim() ? { contexto: look.contexto.trim() } : {}),
  };
}

/** El aspecto de una imagen del muro a partir de lo que guardó. Las publicaciones de antes solo tienen el estilo. */
export const lookDeDatos = (d: DatosImagen): ImageLook => ({
  fondo: fondoPorNombre(d.estilo),
  letra: letraPorId(d.letra),
  destacadas: d.destacadas,
  dedicatoria: d.dedicatoria,
  original: d.original,
  contexto: d.contexto,
});

/** Distancia de la marca del sitio al borde de abajo: en las historias queda fuera de la barra de Instagram. */
export const siteBottom = (format: ImageFormat) => (format === 'historia' ? 250 : 90);

export const IMAGE_SIZE: Record<ImageFormat, { width: number; height: number }> = {
  cuadrado: { width: 1080, height: 1080 },
  historia: { width: 1080, height: 1920 },
};

/** Tamaño de letra del versículo en la imagen de 1080 px de ancho, según su largo. */
export function verseFontSize(text: string, format: ImageFormat) {
  const n = text.length;
  const base = n < 80 ? 70 : n < 160 ? 60 : n < 260 ? 50 : n < 400 ? 42 : n < 600 ? 36 : 30;
  return format === 'historia' ? Math.round(base * 1.3) : base;
}

export const verseUrl = (v: VerseToShare) => `${SITE}${verseHref(v.book, v.chapter, v.verse)}`;

export const caption = (v: VerseToShare) => `${v.reference}${v.version ? ` (${v.version})` : ''}`;

/**
 * Comparte un texto que ya lleva su enlace dentro. No se pasa `url` aparte: el navegador (y iOS) lo
 * añaden al final del texto, y WhatsApp y otras apps mostraban el enlace dos veces.
 */
export function shareMessage(message: string) {
  return Share.share({ message }).catch(() => {});
}

/** Comparte el versículo como texto con su enlace. */
export function shareVerse(v: VerseToShare) {
  return shareMessage(`«${v.text}» ${caption(v)}\n\n${verseUrl(v)}`);
}

/** Parte las palabras en líneas que caben en `maxWidth`. Devuelve los índices de las palabras de cada línea. */
export function wrapWords(measure: (t: string) => number, words: string[], maxWidth: number) {
  const lines: number[][] = [];
  let line: number[] = [];
  let text = '';
  words.forEach((word, i) => {
    const next = text ? `${text} ${word}` : word;
    if (measure(next) > maxWidth && line.length) {
      lines.push(line);
      line = [i];
      text = word;
    } else {
      line.push(i);
      text = next;
    }
  });
  if (line.length) lines.push(line);
  return lines;
}

export const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** El tamaño de la dedicatoria en la imagen de 1080 px. */
export const DEDICATORIA_SIZE = 64;

export function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo dibujar el fondo'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Dibuja la imagen del versículo (solo web). */
export async function drawVerseImage(v: VerseToShare, format: ImageFormat, look: ImageLook): Promise<Blob> {
  const { fondo, letra, destacadas = [], dedicatoria, original } = look;
  const contexto = look.contexto?.trim();
  const { width, height } = IMAGE_SIZE[format];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const family = letra.family ? `"${letra.family}", ${SERIF}` : SERIF;
  const dedic = dedicatoria?.trim();
  await Promise.all([
    document.fonts?.load(`60px "${letra.family ?? 'Georgia'}"`),
    dedic ? document.fonts?.load(`60px "${LETRA_DEDICATORIA}"`) : null,
  ]).catch(() => {});
  await document.fonts?.ready;

  ctx.fillStyle = fondo.background;
  ctx.fillRect(0, 0, width, height);
  if (fondo.svg) ctx.drawImage(await loadSvg(fondo.svg(width, height)), 0, 0, width, height);

  const pad = 110;
  const words = palabras(v.text).map((w) => (letra.mayusculas ? w.toLocaleUpperCase('es') : w));
  const dedicHeight = dedic ? DEDICATORIA_SIZE * 1.2 + 36 : 0;
  ctx.font = `italic ${CONTEXTO.size}px ${SERIF}`;
  const lineasContexto = contexto ? wrapWords((t) => ctx.measureText(t).width, contexto.split(/\s+/), CONTEXTO.ancho) : [];
  const contextoHeight = lineasContexto.length ? CONTEXTO.margen + lineasContexto.length * CONTEXTO.size * CONTEXTO.interlinea : 0;
  const extra = dedicHeight + contextoHeight + (original ? ORIGINAL_HEIGHT : 0);
  let size = Math.round(verseFontSize(v.text, format) * letra.escala);
  let lines: number[][] = [];
  // Si aun así no cabe, se reduce hasta que quepa.
  for (; size >= 22; size -= 2) {
    ctx.font = `${size}px ${family}`;
    lines = wrapWords((t) => ctx.measureText(t).width, words, width - pad * 2);
    if (lines.length * size * letra.interlinea < height - 420 - extra) break;
  }
  const lineHeight = size * letra.interlinea;
  const blockHeight = extra + 60 + lines.length * lineHeight + 60 + 44;
  let y = (height - blockHeight) / 2;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  if (fondo.sombra) {
    ctx.shadowColor = fondo.sombra;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 2;
  }
  if (dedic) {
    ctx.fillStyle = fondo.accent;
    ctx.font = `${DEDICATORIA_SIZE}px "${LETRA_DEDICATORIA}", ${SERIF}`;
    ctx.fillText(dedic, width / 2, y);
    y += dedicHeight;
  }

  ctx.fillStyle = fondo.accent;
  ctx.fillRect(width / 2 - 36, y, 72, 4);
  y += 60;

  ctx.font = `${size}px ${family}`;
  ctx.textAlign = 'left';
  const space = ctx.measureText(' ').width;
  for (const line of lines) {
    const total = ctx.measureText(line.map((i) => words[i]).join(' ')).width;
    let x = width / 2 - total / 2;
    for (const i of line) {
      ctx.fillStyle = destacadas.includes(i) ? fondo.accent : fondo.text;
      ctx.fillText(words[i], x, y + (lineHeight - size) / 2);
      x += ctx.measureText(words[i]).width + space;
    }
    y += lineHeight;
  }

  y += 60;
  ctx.textAlign = 'center';
  ctx.fillStyle = fondo.accent;
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText(caption(v), width / 2, y);
  y += 44;

  if (lineasContexto.length) {
    y += CONTEXTO.margen;
    ctx.fillStyle = fondo.muted;
    ctx.font = `italic ${CONTEXTO.size}px ${SERIF}`;
    const ws = contexto!.split(/\s+/);
    for (const linea of lineasContexto) {
      ctx.fillText(linea.map((i) => ws[i]).join(' '), width / 2, y);
      y += CONTEXTO.size * CONTEXTO.interlinea;
    }
  }

  if (original) {
    y += 48;
    ctx.fillStyle = fondo.text;
    ctx.font = `${ORIGINAL_SIZE}px ${SERIF}`;
    ctx.fillText(original.palabra, width / 2, y);
    y += ORIGINAL_SIZE * 1.25;
    ctx.fillStyle = fondo.muted;
    ctx.font = `italic 34px ${SERIF}`;
    ctx.fillText(`${original.translit} · ${original.glosa}`, width / 2, y);
  }

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fondo.muted;
  ctx.font = `28px ${SANS}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('zarzabiblia.com', width / 2, height - siteBottom(format));

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'),
  );
}

export const imageFileName = (v: VerseToShare) =>
  `${v.reference.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase()}.png`;

/** Web: abre el menú de compartir con la imagen si el navegador lo permite; si no, la descarga. */
export async function shareImageOnWeb(blob: Blob, v: VerseToShare): Promise<'compartida' | 'descargada'> {
  const file = new File([blob], imageFileName(v), { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${caption(v)} · ${verseUrl(v)}` });
    } catch (err) {
      // Cerrar el menú de compartir no es un error.
      if ((err as Error).name !== 'AbortError') throw err;
    }
    return 'compartida';
  }
  downloadImage(blob, v);
  return 'descargada';
}

export function downloadImage(blob: Blob, v: VerseToShare) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = imageFileName(v);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
