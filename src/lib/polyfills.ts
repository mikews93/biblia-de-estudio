/**
 * Lo que la app usa y los navegadores viejos no traen (Chrome antes de la 92, Safari antes del 15.4, teléfonos Android
 * con el navegador sin actualizar). Sin esto, `lista.at(-1)` rompía la pantalla con «….at is not a function».
 * Se importa primero en src/app/_layout.tsx. Solo agrega lo que falta: en un navegador al día no hace nada.
 */

export function at<T>(this: ArrayLike<T>, index: number): T | undefined {
  const n = Math.trunc(index) || 0;
  const i = n < 0 ? this.length + n : n;
  return i < 0 || i >= this.length ? undefined : this[i];
}

export function poner(objeto: object, nombre: string, valor: unknown) {
  if (!(nombre in objeto)) Object.defineProperty(objeto, nombre, { value: valor, writable: true, configurable: true, enumerable: false });
}

poner(Array.prototype, 'at', at);
poner(String.prototype, 'at', at);
const TypedArray = Object.getPrototypeOf(Int8Array.prototype) as object | null;
if (TypedArray) poner(TypedArray, 'at', at);

export function findLastIndex<T>(this: T[], fn: (v: T, i: number, a: T[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn.call(thisArg, this[i], i, this)) return i;
  return -1;
}
poner(Array.prototype, 'findLastIndex', findLastIndex);
poner(Array.prototype, 'findLast', function <T>(this: T[], fn: (v: T, i: number, a: T[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn.call(thisArg, this[i], i, this)) return this[i];
  return undefined;
});
poner(Object, 'hasOwn', (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k));

