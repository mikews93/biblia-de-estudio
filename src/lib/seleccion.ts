// Varios versículos elegidos a la vez en el lector: se mantiene presionado uno y se tocan los demás.
// Sin dependencias de React Native.

type Verso = [number, string, string?];

/** Ordenados y sin repetir. */
export const ordenar = (ns: number[]) => [...new Set(ns)].sort((a, b) => a - b);

/** Pone o quita un versículo de la selección. */
export const alternar = (ns: number[], n: number) => (ns.includes(n) ? ns.filter((x) => x !== n) : ordenar([...ns, n]));

/** Todos los versículos entre a y b (en cualquier orden), sumados a los que ya estaban. */
export const sumarTramo = (ns: number[], a: number, b: number) =>
  ordenar([...ns, ...Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i)]);

/** Los tramos seguidos: [16, 17, 18, 20] → [[16, 18], [20, 20]]. */
export function tramos(ns: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const n of ordenar(ns)) {
    const ultimo = out[out.length - 1];
    if (ultimo && n === ultimo[1] + 1) ultimo[1] = n;
    else out.push([n, n]);
  }
  return out;
}

/** «16», «16-18» o «16-18, 20», como en «Juan 3:16-18, 20». */
export const versiculosTexto = (ns: number[]) =>
  tramos(ns)
    .map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`))
    .join(', ');

/** La cita de la selección: «Juan 3:16-18, 20». */
export const citaDe = (libro: string, capitulo: number, ns: number[]) => `${libro} ${capitulo}:${versiculosTexto(ns)}`;

/** El texto de los versículos elegidos, de corrido; entre tramos separados, «…». */
export function textoDe(verses: Verso[], ns: number[]) {
  return tramos(ns)
    .map(([a, b]) =>
      verses
        .filter(([n]) => n >= a && n <= b)
        .map(([, t]) => t.trim())
        .join(' '),
    )
    .filter(Boolean)
    .join(' … ');
}

/** Para copiar: cada versículo con su número delante, la cita y el enlace. */
export function textoParaCopiar(verses: Verso[], ns: number[], cita: string, enlace: string) {
  const elegidos = verses.filter(([n]) => ns.includes(n));
  const cuerpo =
    elegidos.length === 1 ? `«${elegidos[0][1].trim()}»` : elegidos.map(([n, t, label]) => `${label ?? n} ${t.trim()}`).join(' ');
  return `${cuerpo}\n${cita}\n${enlace}`;
}
