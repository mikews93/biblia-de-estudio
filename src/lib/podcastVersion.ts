import { LICENSED } from './licenciadas';

// En qué versión se escribe y se graba el pódcast de un capítulo. Con una versión libre, la que lee la persona: cada
// una tiene su guion y su grabación, guardados para todos los que la leen. Las versiones con derechos (NBLA, NVI…) no
// se pueden pasar a la IA ni convertir en audio (ver src/lib/licenciadas.ts): para quien las lee, el pódcast cita
// una versión libre de lenguaje actual.

/** La versión libre del pódcast para quien lee una versión con derechos. */
export const PODCAST_LIBRE = 'pdt';

/** La versión del pódcast para quien lee «version» (sin ella, la RV1909). */
export function versionPodcast(version: string | undefined): string {
  if (!version) return 'rv1909';
  return LICENSED.some((l) => l.id === version) ? PODCAST_LIBRE : version;
}

/** Cómo se guarda en herramientas_ia y podcast_grabado: la RV1909 sin sufijo, como antes; las demás con «:pdt». */
export const conVersion = (clave: string, version: string) => (version === 'rv1909' ? clave : `${clave}:${version}`);

/**
 * Un solo pódcast grabado por capítulo: grabarlo con voces naturales cuesta, así que si ya está grabado en otra versión
 * libre se escucha ese (con su guion) en vez de grabar otro. Primero la versión de quien lee, luego la PDT (la de
 * quienes leen versiones con derechos), luego la RV1909 y luego cualquiera. Sin ninguna grabada, la de quien lee.
 */
export function elegirVersionPodcast(preferida: string, grabadas: readonly string[]): string {
  for (const v of [preferida, PODCAST_LIBRE, 'rv1909']) if (grabadas.includes(v)) return v;
  return grabadas.find((v) => !LICENSED.some((l) => l.id === v)) ?? preferida;
}
