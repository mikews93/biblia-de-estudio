// Secciones de los comentarios (pipeline/build_comentarios.py), para /api/comentario y /api/estudiar. El guion bajo
// hace que Vercel no la publique como función.
// Los comentarios libres no van dentro de las funciones, que pesarían decenas de MB en cada despliegue: son archivos
// estáticos de la web (/comentarios/…) y se piden a la misma web. Los que tienen licencia («propia») no se publican:
// pipeline/importar_comentario.py los deja en comentarios-licencia/, que sí va dentro de /api/comentario.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { Fuente } from '../src/lib/comentarioFuentes';

const PUBLIC_DIR = process.env.COMENTARIOS_DIR ?? path.join(process.cwd(), 'dist', 'comentarios');
const PRIVATE_DIR = process.env.COMENTARIOS_LICENCIA_DIR ?? path.join(process.cwd(), 'comentarios-licencia');

export type Section = { desde: number; hasta: number; titulo: string; partes: string[] };

/** Las secciones de un capítulo, o [] si la fuente no lo comenta. */
export async function sections(request: Request, fuente: Fuente, libro: string, capitulo: number): Promise<Section[]> {
  const rel = `${fuente.id}/${libro}/${capitulo}.json.gz`;
  let raw = await readFile(path.join(fuente.tipo === 'propia' ? PRIVATE_DIR : PUBLIC_DIR, rel)).catch(() => null);
  if (!raw && fuente.tipo !== 'propia') {
    // En las vistas previas protegidas de Vercel la cookie de quien pregunta abre también los archivos.
    const cookie = request.headers.get('cookie');
    const res = await fetch(new URL(`/comentarios/${rel}`, request.url), {
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (res?.ok) raw = Buffer.from(await res.arrayBuffer());
  }
  if (!raw) return [];
  try {
    // Según el servidor, el .gz llega comprimido o ya descomprimido.
    const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    return JSON.parse(text) as Section[];
  } catch {
    return [];
  }
}
