// Las imágenes del estudio (objetos, lugares y mapas) y las fotos de las fichas son de Wikimedia Commons.
//
// - Wikimedia solo sirve miniaturas en unos anchos fijos (https://w.wiki/GHai); cualquier otro responde con un error.
//   Los datos ya vienen en esos anchos (pipeline/imagenes.py), pero los que se descargaron antes en el dispositivo
//   podían traer miniaturas de 800 px: se corrigen al mostrarlas.
// - Desde noviembre de 2026 la API de Wikipedia da las miniaturas en thumb.wikimedia.org con ?utm_… al final: se
//   vuelven a la dirección de siempre en upload.wikimedia.org, que es el mismo archivo.
// - La app no las pide a Wikimedia desde el teléfono: las pide a su propio servidor (api/biblia.ts?imagen=…), que las
//   trae una vez y las deja en la caché de Vercel. Así cargan aunque Wikimedia rechace o limite al teléfono o a su red
//   (pasaba en Android: «Imagen no disponible» en todas), y la app instalada las guarda para verlas sin conexión.

const STEPS = [250, 330, 500, 960, 1280, 1920];
const HOST = 'https://upload.wikimedia.org/';

/** La dirección de siempre: upload.wikimedia.org, sin parámetros de seguimiento. */
export function normalize(url: string): string {
  const m = url.match(/^https:\/\/(?:upload|thumb)\.wikimedia\.org\/([^?#]+)/);
  return m ? HOST + m[1] : url;
}

/** La misma miniatura de upload.wikimedia.org en el ancho estándar más cercano por arriba. */
export function standardThumb(url: string): string {
  const clean = normalize(url);
  const m = clean.match(/^(https:\/\/upload\.wikimedia\.org\/.+\/thumb\/.+\/)(\d+)(px-[^/]+)$/);
  if (!m) return clean;
  const width = Number(m[2]);
  const step = STEPS.find((s) => s >= width) ?? STEPS[STEPS.length - 1];
  return `${m[1]}${step}${m[3]}`;
}

/**
 * Una versión más liviana para las tarjetas: la miniatura en `width` (un ancho estándar) si la imagen es más ancha.
 * `original` es el ancho de la imagen que traen los datos; si no se sabe o es menor, se deja como está.
 */
export function sized(url: string, width: number, original?: number): string {
  const clean = standardThumb(url);
  if (!original || original <= width) return clean;
  const thumb = clean.match(/^(https:\/\/upload\.wikimedia\.org\/.+\/thumb\/.+\/)\d+(px-[^/]+)$/);
  if (thumb) return `${thumb[1]}${width}${thumb[2]}`;
  // Un archivo original (JPG o PNG): su miniatura vive en /thumb/<ruta>/<ancho>px-<nombre>.
  const file = clean.match(/^https:\/\/upload\.wikimedia\.org\/(wikipedia\/commons)\/(\w\/\w\w)\/([^/]+\.(?:jpe?g|png))$/i);
  return file ? `${HOST}${file[1]}/thumb/${file[2]}/${file[3]}/${width}px-${file[3]}` : clean;
}

/** ¿Es una imagen de Wikimedia Commons que el servidor de la app puede traer? */
export const isCommons = (url: string) => /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^?#]+$/.test(url);

/**
 * La imagen a través del servidor de la app. `origin` es '' en la web (mismo sitio) y https://zarzabiblia.com en la
 * app nativa. Lo que no es de Wikimedia Commons se deja como está.
 */
export function viaApp(url: string, origin = ''): string {
  const clean = standardThumb(url);
  return isCommons(clean) ? `${origin}/api/biblia?imagen=${encodeURIComponent(clean)}` : clean;
}
