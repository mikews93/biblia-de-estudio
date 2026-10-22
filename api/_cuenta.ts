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

// La lámpara diaria: cuántas preguntas propias a la IA (seguimientos, Taller, semana) puede hacer cada cuenta al día.
// Lo que se guarda para todos (el primer estudio de un pasaje, las herramientas) no la gasta. El día es el del servidor.
const LAMPARA = Number(process.env.LAMPARA_DIA ?? 15);
export const LAMPARA_VACIA = `Tu lámpara de hoy ya dio su luz: hiciste ${LAMPARA} preguntas a la IA. Mañana se vuelve a llenar. Mientras, los estudios ya preparados siguen abiertos.`;
let lamparaLista: Promise<unknown> | null = null;

/** Suma una pregunta a la lámpara de hoy; devuelve un 429 amable si ya se gastó, o null si puede seguir. */
export async function gastarLampara(request: Request): Promise<Response | null> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key || !sql || !(LAMPARA > 0)) return null;
  try {
    lamparaLista ??= sql`
      create table if not exists lampara (
        usuario_id uuid not null references usuarios on delete cascade,
        dia date not null,
        n int not null default 0,
        primary key (usuario_id, dia)
      )`.catch((err) => {
      lamparaLista = null;
      throw err;
    });
    await lamparaLista;
    const hash = createHash('sha256').update(key).digest('hex');
    const [row] = await sql<{ n: number }[]>`
      insert into lampara (usuario_id, dia, n)
      select usuario_id, current_date, 1 from sesiones where llave_hash = ${hash}
      on conflict (usuario_id, dia) do update set n = lampara.n + 1
      returning n`;
    if (row && row.n > LAMPARA) return Response.json({ error: LAMPARA_VACIA, lampara: true }, { status: 429 });
    return null;
  } catch (err) {
    // Si la cuenta de la lámpara falla, la pregunta sigue: es una ayuda para cuidar el gasto, no un requisito.
    console.error('lámpara', err);
    return null;
  }
}
