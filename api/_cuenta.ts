// Comprobación de la cuenta para las funciones con IA (/api/estudiar y /api/buscar). El guion bajo hace
// que Vercel no la publique como función. Las cuentas y sesiones son las de /api/comunidades: la app manda
// la misma llave de sesión como "Authorization: Bearer <llave>" y aquí solo se busca su hash.

import { createHash } from 'node:crypto';
import postgres from 'postgres';

import { IGLESIAS_SCHEMA } from './_iglesias';

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

/** El id de la cuenta de la sesión, o null. */
export async function usuarioDe(request: Request): Promise<string | null> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key || !DB_URL) return null;
  sql ??= postgres(DB_URL, { max: 2, idle_timeout: 20, onnotice: () => {} });
  const hash = createHash('sha256').update(key).digest('hex');
  const [row] = await sql<{ usuario_id: string }[]>`select usuario_id from sesiones where llave_hash = ${hash}`;
  return row?.usuario_id ?? null;
}

// La lámpara diaria: cuántas preguntas propias a la IA (seguimientos, Taller, semana) puede hacer cada cuenta al día.
// Lo que se guarda para todos (el primer estudio de un pasaje, las herramientas) no la gasta. El día es el del servidor.
// Los miembros de una iglesia anfitriona activa (api/_iglesias.ts) tienen el tope de su iglesia.
const LAMPARA = Number(process.env.LAMPARA_DIA ?? 15);
const lamparaVacia = (n: number, iglesia: string | null) =>
  `Tu lámpara de hoy ya dio su luz: hiciste ${n} preguntas a la IA. Mañana se vuelve a llenar. Mientras, los estudios ya preparados siguen abiertos.` +
  (iglesia ? '' : ' Si tu iglesia es anfitriona de Zarza, entra con su código y tendrás más preguntas al día.');
let lamparaLista: Promise<unknown> | null = null;

/** Suma una pregunta a la lámpara de hoy; devuelve un 429 amable si ya se gastó, o null si puede seguir. */
export async function gastarLampara(request: Request): Promise<Response | null> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key || !sql || !(LAMPARA > 0)) return null;
  try {
    lamparaLista ??= sql
      .unsafe(
        `create table if not exists lampara (
          usuario_id uuid not null references usuarios on delete cascade,
          dia date not null,
          n int not null default 0,
          primary key (usuario_id, dia)
        );` + IGLESIAS_SCHEMA,
      )
      .catch((err) => {
        lamparaLista = null;
        throw err;
      });
    await lamparaLista;
    const hash = createHash('sha256').update(key).digest('hex');
    const [row] = await sql<{ n: number; tope: number | null; iglesia: string | null }[]>`
      with yo as (select usuario_id from sesiones where llave_hash = ${hash}),
      suma as (
        insert into lampara (usuario_id, dia, n) select usuario_id, current_date, 1 from yo
        on conflict (usuario_id, dia) do update set n = lampara.n + 1
        returning usuario_id, n
      )
      select s.n, i.lampara as tope, i.nombre as iglesia from suma s
      left join iglesia_miembros m on m.usuario_id = s.usuario_id
      left join iglesias_anfitrionas i on i.id = m.iglesia_id and i.activa`;
    const tope = Math.max(LAMPARA, row?.tope ?? 0);
    if (row && row.n > tope) return Response.json({ error: lamparaVacia(tope, row.iglesia), lampara: true }, { status: 429 });
    return null;
  } catch (err) {
    // Si la cuenta de la lámpara falla, la pregunta sigue: es una ayuda para cuidar el gasto, no un requisito.
    console.error('lámpara', err);
    return null;
  }
}
