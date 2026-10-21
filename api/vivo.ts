// Función de Vercel para seguir algo en vivo desde el teléfono. Por ahora, los eventos de iglesia: quien predica publica el bosquejo de un mensaje del Taller con
// un código corto (/evento/CODIGO) y la congregación lo sigue en el teléfono mientras avanza, punto por punto.
// El cliente es src/lib/eventos.ts; las notas de cada persona se guardan con la sincronía de su cuenta.
//
// GET ?codigo=ABC234 → el evento tal como lo ve la congregación. Es público (la app se lee sin cuenta) y el CDN
// lo guarda un par de segundos: así cientos de teléfonos preguntando a la vez cuestan una sola consulta.
// Si quien predica eligió mostrar los puntos a medida que avanza, los que vienen no se mandan hasta llegar.
//
// POST {"accion": "...", ...} con "Authorization: Bearer <llave>" (la sesión de /api/comunidades), solo para
// quien publica: publicar (crea o actualiza el evento de un mensaje), mover (punto y estado), ver, mios, borrar.

import { createHash, randomInt } from 'node:crypto';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_TITLE = 120;
const MAX_IDEA = 400;
const MAX_POINT_TITLE = 120;
const MAX_POINT_TEXT = 4000;
const MAX_POINTS = 30;
const MAX_EVENTS = 60;
const MAX_CITAS = 12;
const ESTADOS = ['pronto', 'en-vivo', 'terminado'] as const;

const SCHEMA = `
create table if not exists eventos (
  codigo text primary key,
  usuario_id uuid not null references usuarios on delete cascade,
  mensaje text not null,
  titulo text not null,
  pasaje jsonb,
  idea text,
  puntos jsonb not null,
  gradual boolean not null default true,
  estado text not null default 'pronto',
  punto int not null default -1,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  unique (usuario_id, mensaje)
);
create index if not exists eventos_usuario on eventos (usuario_id, actualizado desc);
`;

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Estado = (typeof ESTADOS)[number];
/** `citas`: las referencias del punto («Romanos 5:8»), también las que estaban en las notas que no se muestran. */
type Punto = { titulo: string; texto: string; citas: string[] };
type Pasaje = { book: string; chapter: number; from?: number; to?: number };
type Row = {
  codigo: string;
  mensaje: string;
  titulo: string;
  pasaje: Pasaje | null;
  idea: string | null;
  puntos: Punto[];
  gradual: boolean;
  estado: Estado;
  punto: number;
  autor: string;
  iglesia: string | null;
  creado: Date;
  actualizado: Date;
};

class Fail extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

let sql: Sql | null = null;
let ready: Promise<unknown> | null = null;

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

const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** El código como lo escriba la persona: «abc 234», «ABC-234» o el enlace entero. */
export function codigoDe(value: unknown) {
  const raw = typeof value === 'string' ? value : '';
  const c = (raw.match(/evento\/([^/?#\s]+)/i)?.[1] ?? raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== CODE_LENGTH || [...c].some((ch) => !CODE_ALPHABET.includes(ch))) throw new Fail('Ese código no es válido');
  return c;
}

function text(value: unknown, max: number, what: string, required = true) {
  const t = typeof value === 'string' ? value.trim().replace(/\n{3,}/g, '\n\n') : '';
  if (!t && required) throw new Fail(`Falta ${what}`);
  if (t.length > max) throw new Fail(`${what[0].toUpperCase()}${what.slice(1)} es demasiado largo (máximo ${max} caracteres)`);
  return t;
}

function pasajeDe(value: unknown): Pasaje | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Json;
  const n = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));
  const out = { book: p.book, chapter: n(p.chapter), from: n(p.from), to: n(p.to) };
  const ok = (v: number | undefined, opt: boolean) => (v === undefined ? opt : Number.isInteger(v) && v >= 1 && v <= 200);
  if (typeof out.book !== 'string' || !/^[1-3]?[a-z]{2,3}$/.test(out.book) || !ok(out.chapter, false) || !ok(out.from, true) || !ok(out.to, true)) {
    throw new Fail('Pasaje no válido');
  }
  return JSON.parse(JSON.stringify(out)) as Pasaje;
}

function citasDe(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CITAS) throw new Fail('Citas no válidas');
  return [...new Set(value.map((c) => text(c, 40, 'una cita')))];
}

function puntosDe(value: unknown): Punto[] {
  if (!Array.isArray(value) || value.length === 0) throw new Fail('El bosquejo no tiene puntos');
  if (value.length > MAX_POINTS) throw new Fail(`Demasiados puntos (máximo ${MAX_POINTS})`);
  return value.map((p: Json) => ({
    titulo: text(p?.titulo, MAX_POINT_TITLE, 'el título de un punto'),
    texto: text(p?.texto, MAX_POINT_TEXT, 'el texto de un punto', false),
    citas: citasDe(p?.citas),
  }));
}

const ROW_COLUMNS = `e.codigo, e.mensaje, e.titulo, e.pasaje, e.idea, e.puntos, e.gradual, e.estado, e.punto, e.creado, e.actualizado,
  u.nombre as autor, u.iglesia`;

async function find(sql: Sql, codigo: string) {
  const [row] = await sql.unsafe<Row[]>(`select ${ROW_COLUMNS} from eventos e join usuarios u on u.id = e.usuario_id where e.codigo = $1`, [codigo]);
  if (!row) throw new Fail('No encontramos un evento con ese código. Revisa las letras.', 404);
  return row;
}

async function owned(sql: Sql, codigo: unknown, userId: string) {
  const c = codigoDe(codigo);
  const [row] = await sql.unsafe<Row[]>(
    `select ${ROW_COLUMNS} from eventos e join usuarios u on u.id = e.usuario_id where e.codigo = $1 and e.usuario_id = $2`,
    [c, userId],
  );
  if (!row) throw new Fail('Este evento no es tuyo', 403);
  return row;
}

/**
 * Lo que ve la congregación. Con «gradual», solo hasta el punto en que va quien predica (y todo al terminar).
 * `total` siempre dice cuántos hay, para mostrar cuántos faltan.
 */
export function publico(e: Row, propio = false) {
  const visibles = !propio && e.gradual && e.estado !== 'terminado' ? e.puntos.slice(0, Math.max(0, e.punto + 1)) : e.puntos;
  return {
    codigo: e.codigo,
    titulo: e.titulo,
    pasaje: e.pasaje,
    idea: e.idea,
    autor: e.autor,
    iglesia: e.iglesia,
    estado: e.estado,
    punto: e.punto,
    gradual: e.gradual,
    total: e.puntos.length,
    puntos: visibles,
    creado: new Date(e.creado).toISOString(),
    actualizado: new Date(e.actualizado).toISOString(),
    ...(propio ? { mensaje: e.mensaje } : {}),
  };
}

type Handler = (ctx: { sql: Sql; body: Json; request: Request }) => Promise<Json>;

const actions: Record<string, Handler> = {
  /** Crea el evento de un mensaje del Taller, o lo actualiza si ya existe (conserva el código, el punto y el estado). */
  async publicar({ sql, body, request }) {
    const yo = await usuario(sql, request);
    const mensaje = text(body.mensaje, 80, 'el mensaje');
    const titulo = text(body.titulo, MAX_TITLE, 'el título');
    const idea = text(body.idea, MAX_IDEA, 'la idea central', false) || null;
    const pasaje = pasajeDe(body.pasaje);
    const puntos = puntosDe(body.puntos);
    const gradual = body.gradual !== false;
    const [existing] = await sql<{ codigo: string }[]>`select codigo from eventos where usuario_id = ${yo} and mensaje = ${mensaje}`;
    if (existing) {
      await sql`
        update eventos set titulo = ${titulo}, idea = ${idea}, pasaje = ${pasaje ? sql.json(pasaje) : null}, puntos = ${sql.json(puntos)},
          gradual = ${gradual}, punto = least(punto, ${puntos.length - 1}), actualizado = now()
        where codigo = ${existing.codigo}`;
      return { evento: publico(await find(sql, existing.codigo), true) };
    }
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from eventos where usuario_id = ${yo}`;
    if (n >= MAX_EVENTS) throw new Fail(`Ya tienes ${MAX_EVENTS} eventos. Borra alguno de los antiguos para publicar otro.`, 409);
    for (let attempt = 0; attempt < 6; attempt++) {
      const [row] = await sql<{ codigo: string }[]>`
        insert into eventos (codigo, usuario_id, mensaje, titulo, idea, pasaje, puntos, gradual)
        values (${newCode()}, ${yo}, ${mensaje}, ${titulo}, ${idea}, ${pasaje ? sql.json(pasaje) : null}, ${sql.json(puntos)}, ${gradual})
        on conflict do nothing returning codigo`;
      if (row) return { evento: publico(await find(sql, row.codigo), true) };
    }
    throw new Fail('No se pudo crear el evento. Inténtalo de nuevo.', 500);
  },

  /** Quien predica avanza: el punto en que va (−1 es la portada) y el estado del evento. */
  async mover({ sql, body, request }) {
    const yo = await usuario(sql, request);
    const e = await owned(sql, body.codigo, yo);
    const estado = body.estado === undefined ? e.estado : (body.estado as Estado);
    if (!ESTADOS.includes(estado)) throw new Fail('Estado no válido');
    const punto = body.punto === undefined ? e.punto : Number(body.punto);
    if (!Number.isInteger(punto) || punto < -1 || punto >= e.puntos.length) throw new Fail('Punto no válido');
    await sql`update eventos set estado = ${estado}, punto = ${punto}, actualizado = now() where codigo = ${e.codigo}`;
    return { evento: publico({ ...e, estado, punto, actualizado: new Date() }, true) };
  },

  /** El evento completo para quien lo publicó (sin la caché del CDN). */
  async ver({ sql, body, request }) {
    const yo = await usuario(sql, request);
    return { evento: publico(await owned(sql, body.codigo, yo), true) };
  },

  async mios({ sql, request }) {
    const yo = await usuario(sql, request);
    const rows = await sql.unsafe<Row[]>(
      `select ${ROW_COLUMNS} from eventos e join usuarios u on u.id = e.usuario_id where e.usuario_id = $1 order by e.actualizado desc`,
      [yo],
    );
    return { eventos: rows.map((e) => publico(e, true)) };
  },

  async borrar({ sql, body, request }) {
    const yo = await usuario(sql, request);
    const e = await owned(sql, body.codigo, yo);
    await sql`delete from eventos where codigo = ${e.codigo}`;
    return {};
  },
};

export async function GET(request: Request) {
  try {
    const codigo = codigoDe(new URL(request.url).searchParams.get('codigo'));
    const evento = publico(await find(await db(), codigo));
    return Response.json(
      { evento },
      {
        headers: {
          // El navegador pregunta siempre; el CDN de Vercel responde por todos durante dos segundos.
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'CDN-Cache-Control': 'public, s-maxage=2, stale-while-revalidate=3',
        },
      },
    );
  } catch (err) {
    if (err instanceof Fail) return Response.json({ error: err.message }, { status: err.status, headers: { 'Cache-Control': 'no-store' } });
    console.error('eventos', err);
    return Response.json({ error: 'Algo falló en el servidor. Inténtalo de nuevo.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return Response.json({ error: 'JSON no válido' }, { status: 400 });
  }
  const accion = typeof body.accion === 'string' ? body.accion : '';
  if (!Object.hasOwn(actions, accion)) return Response.json({ error: 'Acción no válida' }, { status: 400 });
  try {
    const result = await actions[accion]({ sql: await db(), body, request });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof Fail) return Response.json({ error: err.message }, { status: err.status });
    console.error('eventos', accion, err);
    return Response.json({ error: 'Algo falló en el servidor. Inténtalo de nuevo.' }, { status: 500 });
  }
}
