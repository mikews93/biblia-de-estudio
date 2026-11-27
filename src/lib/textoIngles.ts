// Frases en inglés que se cuelan en una respuesta de la IA. Los comentarios libres, las teologías y los índices le
// llegan en su inglés original, y a veces la IA copia una frase tal cual en vez de decirla en español. En 2 Reyes 2
// (pódcast del 2026-11-27) la voz leyó «Each time, Elisha refused with a solemn vow…» en medio del español.
// api/_corregir.ts las traduce antes de guardar y de grabar.

import type { Reemplazo } from './corregirCitas';

// Palabras gramaticales del inglés que no son palabras del español (por eso no están «a», «no», «he», «me», «son»).
const INGLES = new Set(
  (
    'the of and with his her hers its was were which that this these those from would him they them their been be is it ' +
    'for by not to are has had have who whom whose what when where an or on as at but into upon shall will should could ' +
    'there than then such any every each our we you your my i do does did being after before also only'
  ).split(' '),
);
// Y las del español, para no marcar una frase española que lleva un nombre o un título en inglés.
const ESPANOL = new Set(
  (
    'de la el que y en los las por con una un se del su sus es lo al como para más pero le les ya fue este esta ' +
    'esto ese esa son entre cuando muy sin sobre también porque hay era dice dijo nos te mi tu qué cómo dios señor'
  ).split(' '),
);

/** Los trozos de `texto` (frases o partes de frase) que están en inglés, tal cual aparecen, sin repetir. */
export function fragmentosEnIngles(texto: string): string[] {
  const hallados = new Set<string>();
  // Se corta por signos que cierran una idea; las comas no, porque una frase inglesa las lleva por dentro.
  for (const parte of texto.split(/[.;:!?¿¡«»“”"()[\]⟦⟧\n—]+/)) {
    const trozo = parte.replace(/\d+/g, ' ').trim();
    const palabras = trozo.toLowerCase().match(/[a-záéíóúüñ']+/g) ?? [];
    if (palabras.length < 4) continue;
    const ingles = new Set(palabras.filter((p) => INGLES.has(p)));
    const espanol = palabras.filter((p) => ESPANOL.has(p) || /[áéíóúüñ]/.test(p)).length;
    const enIngles = palabras.filter((p) => INGLES.has(p)).length;
    if (ingles.size < 2 || enIngles <= espanol) continue;
    hallados.add(recortar(parte.trim()));
  }
  return [...hallados].filter((f) => f && texto.includes(f));
}

/**
 * Una parte puede empezar en español y seguir en inglés («Las notas de estudio explican que Each time, Elisha…»):
 * se queda desde la primera palabra inglesa de la parte inglesa, para no pedir que se traduzca lo que ya está bien.
 */
function recortar(parte: string): string {
  const palabras = [...parte.matchAll(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+/g)];
  // La parte inglesa empieza donde, desde ahí hasta el final, ya no hay palabras del español.
  let desde = 0;
  palabras.forEach((m, i) => {
    const p = m[0].toLowerCase();
    if (ESPANOL.has(p) || /[áéíóúüñ]/.test(p)) desde = i + 1;
  });
  const inicio = palabras[desde]?.index ?? 0;
  return parte.slice(inicio).trim();
}

/** Aplica los cambios de la IA: cada «de» tiene que estar tal cual y una sola vez. */
export function aplicarCambios(texto: string, cambios: Reemplazo[]): string {
  let nuevo = texto;
  for (const { de, a } of cambios) {
    if (!de || de === a) continue;
    const at = nuevo.indexOf(de);
    if (at < 0 || nuevo.indexOf(de, at + 1) >= 0) continue;
    nuevo = nuevo.slice(0, at) + a + nuevo.slice(at + de.length);
  }
  return nuevo;
}
