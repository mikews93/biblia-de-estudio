// Función de Vercel que guarda en la cuenta lo que cada persona tiene en el dispositivo (ajustes, lo leído,
// planes, notas, resaltados, diario, tarjetas, Taller…) para que no se pierda y aparezca en sus otros
// dispositivos. El cliente es src/lib/sincronia.ts.
//
// POST {"desde": cursor, "cambios": [{a, k, v, t}]} con "Authorization: Bearer <llave>" (la misma sesión de
// /api/comunidades). Cada entrada es (almacén, clave) → valor JSON, o null si se borró, con la hora del cambio en
// el dispositivo: se queda la más reciente. Responde las entradas que cambiaron desde el cursor (de este o de otros
// dispositivos) y las que se mandaron, por si en la cuenta había una más nueva: {filas, cursor, mas}.
//
// Todo es privado: solo la persona dueña de la cuenta lee y escribe sus entradas. Al borrar la cuenta se borran.

import { createHash } from 'node:crypto';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

/** Los almacenes que se guardan (src/lib/sincronia.ts → registrar). */
const ALMACENES = new Set(['ajustes', 'ultima-lectura', 'progreso', 'resaltados', 'notas', 'planes', 'diario', 'tarjetas', 'taller', 'taller-ia', 'preguntas', 'oraciones', 'semanas', 'eventos', 'sellos', 'jovenes', 'ninos', 'actividad']);
const MAX_CAMBIOS = 400;
const MAX_CLAVE = 200;
/** Bytes del JSON de una entrada (un mensaje largo del Taller cabe de sobra). */
const MAX_VALOR = 200_000;
const MAX_ENTRADAS = 40_000;
const PAGINA = 1000;

const SCHEMA = `
create sequence if not exists datos_seq;
create table if not exists datos (
  usuario_id uuid not null references usuarios on delete cascade,
  almacen text not null,
  clave text not null,
  valor jsonb,
  t bigint not null,
  seq bigint not null default nextval('datos_seq'),
  primary key (usuario_id, almacen, clave)
);
create index if not exists datos_seq_usuario on datos (usuario_id, seq);
`;

type Sql = ReturnType<typeof postgres>;
type Fila = { a: string; k: string; v: unknown; t: number };

let sql: Sql | null = null;
let ready: Promise<unknown> | null = null;

class Fail extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function db() {
  if (!DB_URL) throw new Fail('Falta conectar la base de datos en el servidor.', 503);
  sql ??= postgres(DB_URL, { max: 3, idle_timeout: 20, onnotice: () => {} });
  ready ??= sql.unsafe(SCHEMA).catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return sql;
}

async function usuario(sql: Sql, request: Request) {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key) throw new Fail('Necesitas una cuenta', 401);
  const hash = createHash('sha256').update(key).digest('hex');
  const [row] = await sql<{ id: string }[]>`select usuario_id as id from sesiones where llave_hash = ${hash}`;
  if (!row) throw new Fail('Tu sesión terminó. Vuelve a entrar.', 401);
  return row.id;
}

function leerCambios(raw: unknown): Fila[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Fail('Cambios no válidos', 400);
  if (raw.length > MAX_CAMBIOS) throw new Fail('Demasiados cambios de una vez', 400);
  const vistos = new Map<string, Fila>();
  for (const c of raw as Record<string, unknown>[]) {
    const { a, k, v, t } = c ?? {};
    if (typeof a !== 'string' || !ALMACENES.has(a)) throw new Fail('Almacén no válido', 400);
    if (typeof k !== 'string' || !k || k.length > MAX_CLAVE) throw new Fail('Clave no válida', 400);
    if (typeof t !== 'number' || !Number.isSafeInteger(t) || t < 0) throw new Fail('Hora no válida', 400);
    if (v === undefined) throw new Fail('Falta el valor', 400);
    if (v !== null && JSON.stringify(v).length > MAX_VALOR) throw new Fail('Una entrada es demasiado grande', 413);
    // Si la misma entrada viene dos veces, vale la más nueva.
    const id = `${a}\u0000${k}`;
    if (!vistos.has(id) || vistos.get(id)!.t < t) vistos.set(id, { a, k, v, t });
  }
  return [...vistos.values()];
}

async function sincronizar(sql: Sql, request: Request, body: Record<string, unknown>) {
  const yo = await usuario(sql, request);
  const desde = Number(body.desde ?? 0);
  if (!Number.isSafeInteger(desde) || desde < 0) throw new Fail('Cursor no válido', 400);
  const cambios = leerCambios(body.cambios);

  return sql.begin(async (tx) => {
    // Una sincronización a la vez por cuenta: así los números de secuencia se ven en orden y nada se salta.
    await tx`select pg_advisory_xact_lock(hashtext(${yo}))`;
    if (cambios.length) {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from datos where usuario_id = ${yo}`;
      if (n + cambios.length > MAX_ENTRADAS) throw new Fail('Tu cuenta llegó al límite de datos guardados.', 413);
      await tx`
        insert into datos (usuario_id, almacen, clave, valor, t)
        select ${yo}::uuid, c.a, c.k, c.v, c.t
        from jsonb_to_recordset(${tx.json(cambios as never)}::jsonb) as c(a text, k text, v jsonb, t bigint)
        on conflict (usuario_id, almacen, clave) do update
          set valor = excluded.valor, t = excluded.t, seq = nextval('datos_seq')
          where datos.t < excluded.t`;
    }
    const nuevas = await tx<{ a: string; k: string; v: unknown; t: string; seq: string }[]>`
      select almacen as a, clave as k, valor as v, t, seq from datos
      where usuario_id = ${yo} and seq > ${desde}
      order by seq limit ${PAGINA + 1}`;
    const mas = nuevas.length > PAGINA;
    const pagina = nuevas.slice(0, PAGINA);
    const cursor = pagina.length ? Number(pagina[pagina.length - 1].seq) : desde;
    // Lo que se mandó y no ganó (en la cuenta había algo más nuevo) vuelve también, para que el dispositivo lo vea.
    const dadas = new Set(pagina.map((f) => `${f.a}\u0000${f.k}`));
    const faltan = cambios.filter((c) => !dadas.has(`${c.a}\u0000${c.k}`));
    const actuales = faltan.length
      ? await tx<{ a: string; k: string; v: unknown; t: string }[]>`
          select almacen as a, clave as k, valor as v, t from datos d
          join jsonb_to_recordset(${tx.json(faltan.map(({ a, k }) => ({ a, k })) as never)}::jsonb) as c(a text, k text)
            on d.almacen = c.a and d.clave = c.k
          where d.usuario_id = ${yo} and d.seq <= ${desde}`
      : [];
    const filas = [...pagina, ...actuales].map(({ a, k, v, t }) => ({ a, k, v, t: Number(t) }));
    return { filas, cursor, mas };
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'JSON no válido' }, { status: 400 });
  }
  try {
    const result = await sincronizar(await db(), request, body);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof Fail) return Response.json({ error: err.message }, { status: err.status });
    console.error('sincronizar', err);
    return Response.json({ error: 'Algo falló en el servidor. Inténtalo de nuevo.' }, { status: 500 });
  }
}
