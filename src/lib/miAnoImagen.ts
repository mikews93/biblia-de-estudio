// La tarjeta de «Mi año con la Palabra»: lo que se muestra (cargado de los datos de la app) y la imagen vertical
// para compartir en Historias, dibujada en un canvas (solo web). La pantalla la dibuja igual con vistas
// (src/components/MiAnoTarjeta.tsx).

import { IMAGE_SIZE, SANS, SERIF, loadSvg, wrapWords } from './compartir';
import { glossKey, normalizeStrong } from './concordancia';
import { getBooks, getChapter, getConcordance } from './data';
import { fondoPorNombre, letraPorId } from './fondos';
import type { Resumen } from './miAno';

export const FONDO_AÑO = fondoPorNombre('Estrellas');
export const LETRA_AÑO = letraPorId('elegante');

export type Tarjeta = {
  resumen: Resumen;
  versiculo: { texto: string; referencia: string } | null;
  palabra: { lemma: string; translit: string; glosa: string } | null;
  libro: string | null;
};

/** Las cuatro cifras de la tarjeta, con su nombre en singular o plural. */
export function cifras(r: Resumen) {
  const c = (n: number, uno: string, varios: string) => ({ n, label: n === 1 ? uno : varios });
  return [
    c(r.capitulos, 'capítulo leído', 'capítulos leídos'),
    c(r.resaltados, 'versículo resaltado', 'versículos resaltados'),
    r.respondidas ? c(r.respondidas, 'oración respondida', 'oraciones respondidas') : c(r.oraciones, 'oración', 'oraciones'),
    c(r.palabras.length, 'palabra en el original', 'palabras en el original'),
  ];
}

/**
 * El texto del versículo del año (en la versión que se lee, o la RV1909 si no carga), el nombre del libro y la última
 * palabra original que se descubrió.
 */
export async function tarjetaDe(r: Resumen, version = 'rv1909'): Promise<Tarjeta> {
  const books = await getBooks().catch(() => []);
  const nombre = (id: string) => books.find((b) => b.id === id)?.name ?? id;
  let versiculo: Tarjeta['versiculo'] = null;
  if (r.versiculo) {
    const { book, chapter, verse } = r.versiculo;
    const leer = (v: string) => getChapter(book, chapter, v).then((vs) => vs.find(([n]) => n === verse)?.[1]);
    const texto = (await leer(version).catch(() => undefined)) ?? (await leer('rv1909').catch(() => undefined));
    if (texto) versiculo = { texto, referencia: `${nombre(book)} ${chapter}:${verse}` };
  }
  let palabra: Tarjeta['palabra'] = null;
  const strong = r.palabras.length ? normalizeStrong(r.palabras[r.palabras.length - 1]) : null;
  if (strong) {
    const c = await getConcordance(strong).catch(() => null);
    if (c?.lemma) {
      const glosas = new Map<string, number>();
      for (const [, , g] of c.uses) {
        const k = glossKey(g);
        if (k) glosas.set(k, (glosas.get(k) ?? 0) + 1);
      }
      const glosa = [...glosas].sort((a, b) => b[1] - a[1])[0]?.[0] ?? c.meaning;
      palabra = { lemma: c.lemma, translit: c.translit, glosa };
    }
  }
  return { resumen: r, versiculo, palabra, libro: r.libro ? nombre(r.libro) : null };
}

const MAX_LINEAS_VERSICULO = 5;

/** Dibuja la tarjeta vertical (1080 × 1920) para compartir. */
export async function drawMiAno(t: Tarjeta): Promise<Blob> {
  const fondo = FONDO_AÑO;
  const { width, height } = IMAGE_SIZE.historia;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const family = `"${LETRA_AÑO.family}", ${SERIF}`;
  await document.fonts?.load(`60px "${LETRA_AÑO.family}"`).catch(() => {});
  await document.fonts?.ready;

  ctx.fillStyle = fondo.background;
  ctx.fillRect(0, 0, width, height);
  if (fondo.svg) ctx.drawImage(await loadSvg(fondo.svg(width, height)), 0, 0, width, height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.shadowColor = fondo.sombra ?? 'transparent';
  ctx.shadowBlur = 18;
  const cx = width / 2;
  const kicker = (texto: string, y: number) => {
    ctx.fillStyle = fondo.accent;
    ctx.font = `800 32px ${SANS}`;
    ctx.fillText(texto.split('').join(String.fromCharCode(8202)), cx, y);
  };

  const r = t.resumen;
  let y = 150;
  kicker('MI AÑO CON LA PALABRA', y);
  y += 56;
  ctx.fillStyle = fondo.text;
  ctx.font = `150px ${family}`;
  ctx.fillText(String(r.año), cx, y);
  y += 200;
  ctx.fillStyle = fondo.accent;
  ctx.font = `170px ${family}`;
  ctx.fillText(String(r.dias), cx, y);
  y += 190;
  ctx.fillStyle = fondo.text;
  ctx.font = `500 44px ${SANS}`;
  ctx.fillText(r.dias === 1 ? 'día con la Palabra' : 'días con la Palabra', cx, y);
  y += 100;

  // Las cuatro cifras en dos filas
  cifras(r).forEach((c, i) => {
    const x = i % 2 ? cx + 230 : cx - 230;
    const fy = y + Math.floor(i / 2) * 150;
    ctx.fillStyle = fondo.text;
    ctx.font = `76px ${family}`;
    ctx.fillText(String(c.n), x, fy);
    ctx.fillStyle = fondo.muted;
    ctx.font = `30px ${SANS}`;
    ctx.fillText(c.label, x, fy + 92);
  });
  y += 320;

  if (t.versiculo) {
    kicker('MI VERSÍCULO DEL AÑO', y);
    y += 56;
    ctx.font = `italic 44px ${SERIF}`;
    const ws = `«${t.versiculo.texto}»`.split(/\s+/);
    let lineas = wrapWords((s) => ctx.measureText(s).width, ws, 860);
    const cortado = lineas.length > MAX_LINEAS_VERSICULO;
    lineas = lineas.slice(0, MAX_LINEAS_VERSICULO);
    ctx.fillStyle = fondo.text;
    lineas.forEach((l, i) => {
      const txt = l.map((j) => ws[j]).join(' ');
      ctx.fillText(cortado && i === lineas.length - 1 ? `${txt}…»` : txt, cx, y + i * 58);
    });
    y += lineas.length * 58 + 16;
    ctx.fillStyle = fondo.accent;
    ctx.font = `700 34px ${SANS}`;
    ctx.fillText(t.versiculo.referencia, cx, y);
    y += 90;
  }

  if (t.palabra) {
    kicker('UNA PALABRA QUE DESCUBRÍ', y);
    y += 52;
    ctx.fillStyle = fondo.text;
    ctx.font = `72px ${SERIF}`;
    ctx.fillText(t.palabra.lemma, cx, y);
    y += 92;
    ctx.fillStyle = fondo.muted;
    ctx.font = `italic 36px ${SERIF}`;
    ctx.fillText(`${t.palabra.translit} · ${t.palabra.glosa}`, cx, y);
  }

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fondo.muted;
  ctx.font = `28px ${SANS}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('biblia.migueblanco.com', cx, height - 250);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}
