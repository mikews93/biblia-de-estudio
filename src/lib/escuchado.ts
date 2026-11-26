// Escuchar un capítulo también es avanzar en la lectura. Mike pasaba de capítulo con ⏭ desde el pódcast (Apocalipsis 5,
// 6, 7…) y al día siguiente ni el progreso los contaba ni «Leer» abría el último: lo llevaba a donde había abierto el
// lector por última vez. Ahora:
// - al empezar a sonar algo de un capítulo (pódcast, lectura, dramatizado, audio original), ese pasa a ser la última
//   lectura: «Leer» y «Seguir leyendo» en Hoy llevan ahí;
// - al escucharlo casi entero, cuenta como capítulo leído (progreso, racha, planes, grupos), como «Terminé» en el lector.
import { alEmpezar, alTerminar } from './audio';
import { markChapterRead } from './progress';
import { saveLastRead } from './theme';

/** Solo capítulos de verdad: el pódcast de una palabra va con «palabra:jesed» y capítulo 0. */
export const esCapitulo = (book: string | null, chapter: number): book is string => !!book && !book.includes(':') && chapter >= 1;

let instalado = false;
const contados = new Set<string>();

/** Se llama una vez al abrir la app (src/app/_layout.tsx). */
export function instalarEscuchado() {
  if (instalado) return;
  instalado = true;
  alEmpezar(({ book, chapter }) => {
    if (esCapitulo(book, chapter)) saveLastRead(book, chapter);
  });
  alTerminar(({ book, chapter }) => {
    if (!esCapitulo(book, chapter)) return;
    // Una vez por capítulo mientras la app está abierta (pasar de la voz del teléfono a la grabación no lo cuenta dos veces).
    const clave = `${book}.${chapter}`;
    if (contados.has(clave)) return;
    contados.add(clave);
    markChapterRead(book, chapter).catch(() => {});
  });
}
