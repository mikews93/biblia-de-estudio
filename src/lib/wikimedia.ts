// Wikimedia solo sirve miniaturas en unos anchos fijos (https://w.wiki/GHai); cualquier otro responde con un
// error y la imagen no carga. Los datos ya vienen en esos anchos (pipeline/imagenes.py), pero los que se
// descargaron antes en el dispositivo podían traer miniaturas de 800 px: se corrigen al mostrarlas.

const STEPS = [250, 330, 500, 960, 1280, 1920];

/** La misma miniatura de upload.wikimedia.org en el ancho estándar más cercano por arriba. */
export function standardThumb(url: string): string {
  const m = url.match(/^(https:\/\/upload\.wikimedia\.org\/.+\/thumb\/.+\/)(\d+)(px-[^/]+)$/);
  if (!m) return url;
  const width = Number(m[2]);
  const step = STEPS.find((s) => s >= width) ?? STEPS[STEPS.length - 1];
  return `${m[1]}${step}${m[3]}`;
}
