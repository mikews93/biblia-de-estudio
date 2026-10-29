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
