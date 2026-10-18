// Comprobación de la cuenta para las funciones con IA (/api/estudiar y /api/buscar). El guion bajo hace
// que Vercel no la publique como función. Las cuentas y sesiones son las de /api/comunidades: la app manda
// la misma llave de sesión como "Authorization: Bearer <llave>" y aquí solo se busca su hash.

import { createHash } from 'node:crypto';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

let sql: ReturnType<typeof postgres> | null = null;

/** Devuelve una respuesta de error si la petición no trae una sesión válida, o null si puede seguir. */
export async function needsAccount(request: Request): Promise<Response | null> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key) return Response.json({ error: 'Necesitas una cuenta', cuenta: true }, { status: 401 });
  if (!DB_URL) return Response.json({ error: 'Falta conectar la base de datos en el servidor.' }, { status: 503 });
  sql ??= postgres(DB_URL, { max: 2, idle_timeout: 20, onnotice: () => {} });
  try {
    const hash = createHash('sha256').update(key).digest('hex');
    const [row] = await sql`select 1 from sesiones where llave_hash = ${hash}`;
    if (!row) return Response.json({ error: 'Tu sesión terminó. Vuelve a entrar.', cuenta: true }, { status: 401 });
    return null;
  } catch (err) {
    console.error('cuenta', err);
    return Response.json({ error: 'No se pudo comprobar tu cuenta. Inténtalo de nuevo.' }, { status: 503 });
  }
}
