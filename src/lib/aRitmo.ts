// Avisos a la pantalla a un ritmo que el teléfono aguanta mientras la IA escribe.

/**
 * Envuelve un aviso que se llama con cada trozo para que la pantalla se redibuje como mucho cada «ms»: con muchas
 * palabras por segundo, redibujar el markdown en cada una traba el teléfono. El último aviso siempre llega.
 */
export function aRitmo<A extends unknown[]>(aviso: (...args: A) => void, ms = 50) {
  let ultimo = 0;
  let pendiente: A | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const soltar = () => {
    timer = null;
    if (!pendiente) return;
    const args = pendiente;
    pendiente = null;
    ultimo = Date.now();
    aviso(...args);
  };
  const avisar = (...args: A) => {
    pendiente = args;
    if (timer) return;
    const falta = ultimo + ms - Date.now();
    if (falta <= 0) soltar();
    else timer = setTimeout(soltar, falta);
  };
  /** Descarta lo pendiente (al cancelar). */
  avisar.cancelar = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendiente = null;
  };
  return avisar;
}
