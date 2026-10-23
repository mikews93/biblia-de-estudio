// Compartir un versículo: como texto con enlace, o como imagen para redes (cuadrada o de historia).
// En web la imagen se dibuja en un canvas; en el teléfono VerseImage captura su vista previa.

import { Share } from 'react-native';

import { verseHref } from './routes';

const SITE = 'https://biblia.migueblanco.com';

export type VerseToShare = { book: string; chapter: number; verse: number; text: string; reference: string; version?: string };

export type ImageFormat = 'cuadrado' | 'historia';
export type ImageStyle = { name: string; background: string; text: string; accent: string; muted: string };

export const IMAGE_STYLES: ImageStyle[] = [
  { name: 'Pergamino', background: '#F4ECD8', text: '#3B2F22', accent: '#8A4B2A', muted: '#7A6A55' },
  { name: 'Noche', background: '#151311', text: '#EDE7DE', accent: '#E0A07A', muted: '#A39A8E' },
  { name: 'Terracota', background: '#8A4B2A', text: '#FBF5E6', accent: '#F3E6DC', muted: '#EADBC0' },
  { name: 'Azul', background: '#2F4A6B', text: '#F4F1EA', accent: '#E8C99A', muted: '#C9D3DF' },
];

export const IMAGE_SIZE: Record<ImageFormat, { width: number; height: number }> = {
  cuadrado: { width: 1080, height: 1080 },
  historia: { width: 1080, height: 1920 },
};

/** Tamaño de letra del versículo en la imagen de 1080 px de ancho, según su largo. */
export function verseFontSize(text: string, format: ImageFormat) {
  const n = text.length;
  const base = n < 80 ? 70 : n < 160 ? 60 : n < 260 ? 50 : n < 400 ? 42 : n < 600 ? 36 : 30;
  return format === 'historia' ? Math.round(base * 1.15) : base;
}

export const verseUrl = (v: VerseToShare) => `${SITE}${verseHref(v.book, v.chapter, v.verse)}`;

const caption = (v: VerseToShare) => `${v.reference}${v.version ? ` (${v.version})` : ''}`;

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

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Dibuja la imagen del versículo (solo web). */
export async function drawVerseImage(v: VerseToShare, format: ImageFormat, style: ImageStyle): Promise<Blob> {
  const { width, height } = IMAGE_SIZE[format];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready;

  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, width, height);

  const pad = 110;
  let size = verseFontSize(v.text, format);
  let lines: string[] = [];
  // Si aun así no cabe, se reduce hasta que quepa.
  for (; size >= 22; size -= 2) {
    ctx.font = `${size}px ${SERIF}`;
    lines = wrap(ctx, `«${v.text}»`, width - pad * 2);
    if (lines.length * size * 1.4 < height - 420) break;
  }
  const lineHeight = size * 1.4;
  const blockHeight = lines.length * lineHeight + 60 + 44;
  let y = (height - blockHeight) / 2;

  ctx.fillStyle = style.accent;
  ctx.fillRect(width / 2 - 36, y - 60, 72, 4);

  ctx.fillStyle = style.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `${size}px ${SERIF}`;
  for (const line of lines) {
    ctx.fillText(line, width / 2, y);
    y += lineHeight;
  }

  y += 60;
  ctx.fillStyle = style.accent;
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText(caption(v), width / 2, y);

  ctx.fillStyle = style.muted;
  ctx.font = `28px ${SANS}`;
  ctx.fillText('biblia.migueblanco.com', width / 2, height - 90);

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
