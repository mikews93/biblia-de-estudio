// Carrusel para Historias: el versículo contado en 3 o 4 láminas verticales (una pregunta para enganchar, el
// versículo, la palabra original o el contexto, y «¿Qué te dice a ti?»). La investigación
// (investigacion/compartir-versiculos.md) mostró que en Instagram los carruseles se guardan y se reenvían más que una
// sola imagen, y que cerrar con una pregunta invita a responder. Se dibujan en un canvas (solo web).

import { ImageLook, IMAGE_SIZE, SANS, SERIF, VerseToShare, caption, drawVerseImage, loadSvg, wrapWords } from './compartir';
import { LETRA_DEDICATORIA } from './fondos';

export type Tipo = 'gancho' | 'versiculo' | 'fondo' | 'cierre' | 'texto';

/**
 * Una lámina del carrusel. Los textos son opcionales: sin tocar, cada lámina usa lo de siempre (la pregunta elegida,
 * el contexto del Estudio, «¿Qué te dice a ti?»); al editarla, lo escrito manda.
 */
export type Lamina = {
  id: string;
  tipo: Tipo;
  /** La línea pequeña de arriba, en mayúsculas («PARA PENSAR»). */
  titulo?: string;
  /** El texto grande. */
  texto?: string;
  /** La línea pequeña de abajo («Desliza →», «Respóndeme por mensaje»). */
  nota?: string;
};

/** Preguntas para empezar que se pueden tocar en vez de escribir. */
export const GANCHOS = ['Esto me habló hoy', '¿Te ha pasado?', 'Para ti, que lo necesitas', '¿Lo sabías?'];

/** Lo que dice cada lámina mientras no se edite. */
export const PREDETERMINADO: Record<Tipo, { titulo: string; texto: string; nota: string }> = {
  gancho: { titulo: '', texto: GANCHOS[0], nota: 'Desliza  →' },
  versiculo: { titulo: '', texto: '', nota: '' },
  fondo: { titulo: '', texto: '', nota: '' },
  cierre: { titulo: '', texto: '¿Qué te dice a ti?', nota: 'Respóndeme por mensaje' },
  texto: { titulo: 'PARA PENSAR', texto: '', nota: '' },
};

/** Cuántas láminas como máximo (Instagram deja hasta 10 por carrusel). */
export const MAX_LAMINAS = 10;

export const nombreLamina: Record<Tipo, string> = {
  gancho: 'Pregunta',
  versiculo: 'Versículo',
  fondo: 'A fondo',
  cierre: '¿Qué te dice?',
  texto: 'Texto',
};

let siguiente = 0;
export const nuevaLamina = (tipo: Tipo, textos: Partial<Omit<Lamina, 'id' | 'tipo'>> = {}): Lamina => ({ id: `l${Date.now().toString(36)}${siguiente++}`, tipo, ...textos });

/** Hay algo para la lámina «A fondo»: una palabra original o una línea de contexto. */
export const hayFondo = (look: ImageLook) => !!look.original || !!look.contexto?.trim();

/** Las láminas con que empieza el carrusel: la de «A fondo» solo si se eligió algo en el Estudio. */
export const laminasIniciales = (look: ImageLook): Lamina[] =>
  [nuevaLamina('gancho'), nuevaLamina('versiculo'), ...(hayFondo(look) ? [nuevaLamina('fondo')] : []), nuevaLamina('cierre')];

/** El texto que se ve en una lámina: lo escrito, o lo de siempre si no se ha editado. */
export function textoDe(l: Lamina, campo: 'titulo' | 'texto' | 'nota', look?: ImageLook) {
  const escrito = l[campo];
  if (escrito !== undefined) return escrito;
  if (l.tipo === 'fondo' && campo === 'texto') return look?.contexto?.trim() ?? '';
  return PREDETERMINADO[l.tipo][campo];
}

/** Dibuja una lámina vertical de 1080 × 1920. */
export async function drawLamina(l: Lamina, v: VerseToShare, look: ImageLook, todas: Lamina[] = [l]): Promise<Blob> {
  // El versículo es la imagen de siempre en formato historia; si hay lámina «A fondo», lo de estudio se va allí.
  if (l.tipo === 'versiculo') {
    const separado = todas.some((x) => x.tipo === 'fondo');
    return drawVerseImage(v, 'historia', separado ? { ...look, original: undefined, contexto: undefined } : look);
  }
  const kind = l.tipo;
  const titulo = textoDe(l, 'titulo', look).trim();
  const nota = textoDe(l, 'nota', look).trim();
  const { fondo, letra } = look;
  const { width, height } = IMAGE_SIZE.historia;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const family = letra.family ? `"${letra.family}", ${SERIF}` : SERIF;
  const dedic = look.dedicatoria?.trim();
  await Promise.all([
    document.fonts?.load(`60px "${letra.family ?? 'Georgia'}"`),
    dedic ? document.fonts?.load(`60px "${LETRA_DEDICATORIA}"`) : null,
  ]).catch(() => {});
  await document.fonts?.ready;

  ctx.fillStyle = fondo.background;
  ctx.fillRect(0, 0, width, height);
  if (fondo.svg) ctx.drawImage(await loadSvg(fondo.svg(width, height)), 0, 0, width, height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  if (fondo.sombra) {
    ctx.shadowColor = fondo.sombra;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 2;
  }

  /** Texto partido en líneas y centrado; devuelve lo que ocupó. */
  const parrafo = (texto: string, font: string, size: number, interlinea: number, ancho: number, y: number, color: string, medir = false) => {
    ctx.font = font;
    const ws = texto.split(/\s+/).filter(Boolean);
    const lineas = wrapWords((t) => ctx.measureText(t).width, ws, ancho);
    if (!medir) {
      ctx.fillStyle = color;
      lineas.forEach((l, i) => ctx.fillText(l.map((j) => ws[j]).join(' '), width / 2, y + i * size * interlinea));
    }
    return lineas.length * size * interlinea;
  };
  const tamañoQueCabe = (texto: string, base: number, ancho: number, alto: number) => {
    let size = base;
    for (; size > 40; size -= 4) if (parrafo(texto, `${size}px ${family}`, size, letra.interlinea, ancho, 0, '', true) <= alto) break;
    return size;
  };
  const barra = (y: number) => {
    ctx.fillStyle = fondo.accent;
    ctx.fillRect(width / 2 - 36, y, 72, 4);
  };
  const kicker = (t: string, y: number) => {
    ctx.fillStyle = fondo.accent;
    ctx.font = `800 34px ${SANS}`;
    ctx.fillText(t.split('').join(String.fromCharCode(8202)), width / 2, y);
  };

  const mayus = (t: string) => (letra.mayusculas ? t.toLocaleUpperCase('es') : t);

  if (kind === 'gancho') {
    const texto = textoDe(l, 'texto').trim();
    const texto2 = letra.mayusculas ? texto.toLocaleUpperCase('es') : texto;
    const size = tamañoQueCabe(texto2, Math.round(110 * letra.escala), 840, 700);
    const alto = texto2 ? parrafo(texto2, `${size}px ${family}`, size, letra.interlinea, 840, 0, '', true) : 0;
    const dedicH = dedic ? 64 * 1.2 + 40 : 0;
    const tituloH = titulo ? 34 + 40 : 0;
    let y = (height - (dedicH + tituloH + 50 + alto + 90 + 40)) / 2 - 40;
    if (dedic) {
      ctx.fillStyle = fondo.accent;
      ctx.font = `64px "${LETRA_DEDICATORIA}", ${SERIF}`;
      ctx.fillText(dedic, width / 2, y);
      y += dedicH;
    }
    if (titulo) {
      kicker(titulo.toLocaleUpperCase('es'), y);
      y += tituloH;
    }
    barra(y);
    y += 50;
    if (texto2) parrafo(texto2, `${size}px ${family}`, size, letra.interlinea, 840, y, fondo.text);
    y += alto + 90;
    ctx.fillStyle = fondo.muted;
    ctx.font = `600 38px ${SANS}`;
    if (nota) ctx.fillText(nota, width / 2, y);
  } else if (kind === 'fondo') {
    const { original } = look;
    const contexto = textoDe(l, 'texto', look).trim();
    const altoOriginal = original ? 34 + 50 + 170 + 70 + 90 : 0;
    const sizeCtx = original ? 46 : 64;
    const altoContexto = contexto ? 34 + 50 + parrafo(contexto, `italic ${sizeCtx}px ${SERIF}`, sizeCtx, 1.4, 820, 0, '', true) : 0;
    const sep = original && contexto ? 110 : 0;
    let y = (height - (altoOriginal + sep + altoContexto)) / 2 - 40;
    if (original) {
      kicker('EN EL ORIGINAL', y);
      y += 34 + 50;
      ctx.fillStyle = fondo.text;
      ctx.font = `150px ${SERIF}`;
      ctx.fillText(original.palabra, width / 2, y);
      y += 170;
      ctx.fillStyle = fondo.muted;
      ctx.font = `italic 52px ${SERIF}`;
      ctx.fillText(original.translit, width / 2, y);
      y += 70;
      ctx.fillStyle = fondo.accent;
      ctx.font = `${Math.round(68 * letra.escala)}px ${family}`;
      ctx.fillText(`«${original.glosa}»`, width / 2, y);
      y += 90;
    }
    if (original && contexto) {
      y += sep / 2 - 2;
      barra(y);
      y += sep / 2;
    }
    if (contexto) {
      kicker((titulo || (original ? 'CONTEXTO' : 'PARA ENTENDERLO')).toLocaleUpperCase('es'), y);
      y += 34 + 50;
      parrafo(contexto, `italic ${sizeCtx}px ${SERIF}`, sizeCtx, 1.4, 820, y, fondo.text);
    }
  } else {
    // «¿Qué te dice a ti?» y las láminas de texto libre: una línea arriba, el texto grande y una nota abajo.
    const texto = mayus(textoDe(l, 'texto').trim());
    const cierre = kind === 'cierre';
    const base = Math.round((cierre ? 120 : texto.length > 120 ? 70 : 92) * letra.escala);
    const size = texto ? tamañoQueCabe(texto, base, 860, 900) : base;
    const alto = texto ? parrafo(texto, `${size}px ${family}`, size, letra.interlinea, 860, 0, '', true) : 0;
    const tituloH = titulo ? 34 + 40 : 0;
    const notaH = nota ? 60 + 44 : 0;
    const refH = cierre ? 70 + 44 : 0;
    let y = (height - (tituloH + 50 + alto + notaH + refH)) / 2 - 40;
    if (titulo) {
      kicker(titulo.toLocaleUpperCase('es'), y);
      y += tituloH;
    }
    barra(y);
    y += 50;
    if (texto) parrafo(texto, `${size}px ${family}`, size, letra.interlinea, 860, y, fondo.text);
    y += alto;
    if (nota) {
      y += 60;
      parrafo(nota, `40px ${SANS}`, 40, 1.3, 860, y, fondo.muted);
      y += 44;
    }
    if (cierre) {
      y += 70;
      ctx.fillStyle = fondo.accent;
      ctx.font = `700 40px ${SANS}`;
      ctx.fillText(caption(v), width / 2, y);
    }
  }

  // La marca, por encima de la barra de Instagram (que ya muestra en qué lámina se va).
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fondo.muted;
  ctx.font = `28px ${SANS}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('zarzabiblia.com', width / 2, height - 250);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la lámina'))), 'image/png'));
}

/** Todas las láminas del carrusel, en orden. */
export function drawLaminas(v: VerseToShare, look: ImageLook, laminas: Lamina[]) {
  return Promise.all(laminas.map((l) => drawLamina(l, v, look, laminas)));
}

const archivo = (v: VerseToShare, i: number) =>
  `${v.reference.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase()}-${i + 1}.png`;

/** Comparte las láminas juntas si el navegador lo permite; si no, las descarga una por una. */
export async function compartirLaminas(blobs: Blob[], v: VerseToShare, descargar = false): Promise<'compartidas' | 'descargadas'> {
  const files = blobs.map((b, i) => new File([b], archivo(v, i), { type: 'image/png' }));
  if (!descargar && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err;
    }
    return 'compartidas';
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await new Promise((r) => setTimeout(r, 250));
  }
  return 'descargadas';
}
