// Cuándo Zarza pide una reseña en Google Play (hilo «Pedir reseñas de Zarza en Google Play», 2026-11-12).
// Se usa la ventana propia de Google (In-App Review): la reseña se escribe sin salir de la app. Google pide no
// preguntar antes «¿te gusta la app?» ni ponerla detrás de un botón, y limita por su cuenta cuántas veces aparece,
// así que aquí solo se elige el momento: justo después de terminar un capítulo, cuando la persona ya conoce Zarza.

export type RecuerdoResena = {
  /** Los días en que se abrió la ventana de reseña, del más viejo al más nuevo. */
  pedidas?: string[];
};

export type ContextoResena = RecuerdoResena & {
  /** Hoy, «2026-11-12». */
  hoy: string;
  /** El primer día que esta persona abrió Hoy en este dispositivo (src/lib/sembrar.ts). */
  desde?: string;
  plataforma: 'android' | 'ios' | 'web';
  modo: 'general' | 'jovenes' | 'ninos';
  tranquila: boolean;
  /** Capítulos terminados en total y días distintos con lectura. */
  capitulos: number;
  dias: number;
};

/** Solo en Android mientras la app de iPhone no esté en el App Store. */
export const PLATAFORMAS: ContextoResena['plataforma'][] = ['android'];
/** No se pide a quien llegó hace menos de una semana… */
export const DIAS_DE_GRACIA = 7;
/** …ni a quien todavía no ha terminado unos cuantos capítulos en días distintos. */
export const MIN_CAPITULOS = 5;
export const MIN_DIAS = 3;
/** Entre una vez y la siguiente, y cuántas veces como mucho en la vida de la app. */
export const DIAS_ENTRE_PEDIDAS = 120;
export const MAX_PEDIDAS = 3;

/** Días entre dos fechas «AAAA-MM-DD». */
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Si al terminar este capítulo toca abrir la ventana de reseña. */
export function tocaPedirResena(c: ContextoResena): boolean {
  if (!PLATAFORMAS.includes(c.plataforma)) return false;
  // Niños y adolescentes no reciben pedidos de la tienda, y «Lectura tranquila» es justamente para que nada interrumpa.
  if (c.modo !== 'general' || c.tranquila) return false;
  if (!c.desde || diasEntre(c.desde, c.hoy) < DIAS_DE_GRACIA) return false;
  if (c.capitulos < MIN_CAPITULOS || c.dias < MIN_DIAS) return false;
  const pedidas = c.pedidas ?? [];
  if (pedidas.length >= MAX_PEDIDAS) return false;
  const ultima = pedidas[pedidas.length - 1];
  if (ultima && diasEntre(ultima, c.hoy) < DIAS_ENTRE_PEDIDAS) return false;
  return true;
}
