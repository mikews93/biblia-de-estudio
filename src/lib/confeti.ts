// Confeti y fuegos artificiales al cumplir algo: un sello, la meta de la semana, un plan o un reto terminado, una
// misión del Modo Jóvenes o una historia del Espacio Niños. Cualquier parte de la app lo lanza con lanzarConfeti;
// lo dibuja components/Confeti.tsx, montado una sola vez sobre toda la app. Dura un par de segundos, no tapa nada
// (no recibe toques) y no sale con «reducir movimiento».

export type Estilo = 'confeti' | 'fuegos';

export type Lanzamiento = { id: number; estilo: Estilo };

let siguienteId = 1;
let ultimo = 0;
const escuchas = new Set<(l: Lanzamiento) => void>();

/** Dos logros a la vez (un sello que llega con la meta de la semana) no se apilan: basta una fiesta. */
const ENTRE = 1500;

export function lanzarConfeti(estilo: Estilo = 'confeti') {
  const ahora = Date.now();
  if (ahora - ultimo < ENTRE) return;
  ultimo = ahora;
  const l = { id: siguienteId++, estilo };
  escuchas.forEach((f) => f(l));
}

export function alLanzar(f: (l: Lanzamiento) => void) {
  escuchas.add(f);
  return () => {
    escuchas.delete(f);
  };
}
