// Pedir una respuesta que llega por partes (la IA escribiendo).
// En la web el fetch del navegador ya entrega el cuerpo por partes. En la app nativa el fetch de React Native no:
// guarda todo y lo entrega al final, así que en Android y iPhone se usa el de expo/fetch (porPartes.native.ts).

/** fetch que puede leer el cuerpo mientras llega. En la web es el del navegador (se lee al llamar, para las pruebas). */
export const fetchPorPartes: typeof fetch = (input, init) => fetch(input, init);
