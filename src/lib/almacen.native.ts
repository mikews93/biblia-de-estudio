import { Directory, File, Paths } from 'expo-file-system';

import type { Index, Store } from './descargas';

// Descargas en el teléfono: cada archivo de datos se guarda tal cual en Documentos/biblia-descargas/<ruta>
// (text/rv1909/jhn/3.json…) y la lista de libros descargados en indice.json. En Documentos y no en la caché,
// porque el sistema vacía la caché cuando le falta espacio. data.ts lee de aquí antes de ir a la red.

const DIR = 'biblia-descargas';
const INDEX = '__indice.json';

const root = () => new Directory(Paths.document, DIR);
const fileOf = (path: string) => new File(root(), ...path.split('/'));

async function write(path: string, content: string) {
  const f = fileOf(path);
  f.create({ intermediates: true, overwrite: true });
  await f.write(content);
}

export const nativeStore: Store | null = {
  has: async (path) => fileOf(path).exists,
  put: async (path, res) => write(path, await res.text()),
  remove: async (paths) => {
    for (const p of paths) {
      const f = fileOf(p);
      if (f.exists) f.delete();
    }
  },
  readIndex: async () => {
    const f = fileOf(INDEX);
    return f.exists ? (JSON.parse(await f.text()) as Index) : {};
  },
  writeIndex: (index) => write(INDEX, JSON.stringify(index)),
  clear: async () => {
    const d = root();
    if (d.exists) d.delete();
  },
  free: async () => Paths.availableDiskSpace,
};

export async function readDownloaded(path: string): Promise<string | null> {
  try {
    const f = fileOf(path);
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

export async function refreshDownloaded(path: string, res: Response) {
  if (fileOf(path).exists) await write(path, await res.text());
}
