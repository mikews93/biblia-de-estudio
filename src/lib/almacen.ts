import type { Store } from './descargas';

// Dónde guarda las descargas la app del teléfono (almacen.native.ts, con expo-file-system). En la web las
// descargas van a Cache Storage (descargas.ts) y el service worker las sirve, así que aquí no hay nada.

export const nativeStore: Store | null = null;

/** El contenido de un archivo descargado (books.json, text/rv1909/jhn/3.json…), o null si no está. */
export const readDownloaded = async (_path: string): Promise<string | null> => null;

/** Pone al día un archivo que ya estaba descargado. */
export const refreshDownloaded = async (_path: string, _res: Response): Promise<void> => {};
