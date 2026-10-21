// Lectura en vivo para la célula: quien guía pasa la hoja y todos la ven en su teléfono, el versículo que
// alguien toca se ilumina para todos y las dinámicas del Taller corren a la vez en cada pantalla.
// El guion bajo hace que Vercel no la publique como función: la llama api/vivo.ts, que comparte con los
// eventos de iglesia el mismo sondeo corto.
//
// Quien sigue la sala pregunta cada segundo y medio con GET /api/vivo?sala=CODIGO. La respuesta es pública
// (basta el código) y el CDN de Vercel la guarda un segundo, así que una célula entera cuesta como mucho una
// invocación por segundo. Los cambios van por POST {"accion": …} con la llave de sesión de las comunidades y
// sin caché; cada cambio sube `version`, y la app descarta cualquier respuesta con una versión más vieja.
//
// Las cuentas, grupos y miembros son los de api/comunidades.ts (la misma base de Neon).

import { createHash, randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

import { dinamica } from '../src/lib/dinamicas';
import { notifyUser } from './_push';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');
const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
// Una sala sin cambios en tantas horas se da por terminada (alguien cerró la app sin terminarla).
const STALE_HOURS = 8;
// Quien no da señales en este tiempo deja de contar como presente (la app avisa cada 20 s).
const PRESENT_SECONDS = 60;
const MAX_TITLE = 80;
const MAX_CARD_TITLE = 120;
const MAX_CARD_TEXT = 1500;
const MAX_STEPS = 12;
const MAX_STEP = 400;
const MAX_MINUTES = 60;
const MAX_ROUTE = 40;

const SCHEMA = `
create table if not exists vivo_salas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  dueno uuid not null references usuarios on delete cascade,
  guia uuid references usuarios on delete set null,
  grupo_id uuid references grupos on delete cascade,
  titulo text not null,
  estado jsonb not null default '{}',
  version int not null default 1,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  cerrada timestamptz
);
create index if not exists vivo_salas_grupo on vivo_salas (grupo_id) where cerrada is null;
create table if not exists vivo_presentes (
  sala_id uuid not null references vivo_salas on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  visto timestamptz not null default now(),
  primary key (sala_id, usuario_id)
);
create table if not exists vivo_toques (
  sala_id uuid not null references vivo_salas on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  versiculo int not null,
  creado timestamptz not null default now(),
  primary key (sala_id, usuario_id)
);`;

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Book = { id: string; name: string; chapters: number };
type User = { id: string; nombre: string };

/** Lo que se ve en pantalla: un paso de una dinámica, una pregunta o una parte del encuentro del Taller. */
export type Tarjeta = {
  tipo: 'dinamica' | 'pregunta' | 'parte';
  titulo: string;
  texto: string | null;
  pasos: string[];
  paso: number;
  /** Del catálogo de src/lib/dinamicas.ts, si la tarjeta es una dinámica. */
  dinamica: string | null;
  minutos: number | null;
  /** Cuándo termina el reloj (lo fija el servidor para que todos vean la misma cuenta atrás). */
  fin: string | null;
};
export type Estado = {
  libro: string;
  capitulo: number;
  /** El versículo que señala quien guía: se ilumina con fuerza y todos lo ven en pantalla. */
  foco: number | null;
  tarjeta: Tarjeta | null;
  /** Los capítulos que leyeron juntos, en orden («jhn.3»), para el resumen del final. */
  recorrido: string[];
};

class Fail extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

let sql: Sql | null = null;
let ready: Promise<unknown> | null = null;
let booksCache: Promise<Book[]> | null = null;

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

function books() {
  booksCache ??= readFile(path.join(DATA_DIR, 'books.json'), 'utf8').then((raw) => JSON.parse(raw) as Book[]);
  return booksCache;
}

const hash = (key: string) => createHash('sha256').update(key).digest('hex');
const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

async function auth(sql: Sql, request: Request): Promise<User> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key) throw new Fail('Necesitas una cuenta', 401);
  const [user] = await sql<User[]>`
    select u.id, u.nombre from sesiones s join usuarios u on u.id = s.usuario_id where s.llave_hash = ${hash(key)}`;
  if (!user) throw new Fail('Tu sesión terminó. Vuelve a entrar.', 401);
  return user;
}

/** El código tal como lo escribe la persona: sin espacios ni guiones y en mayúsculas. */
export function codeOf(value: unknown) {
  const c = typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : '';
  if (c.length !== CODE_LENGTH || [...c].some((ch) => !CODE_ALPHABET.includes(ch))) throw new Fail('Ese código no es válido');
  return c;
}

function str(value: unknown, max: number, what: string, optional = false) {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t) {
    if (optional) return null;
    throw new Fail(`Falta ${what}`);
  }
  if (t.length > max) throw new Fail(`${what[0].toUpperCase()}${what.slice(1)} es demasiado largo`);
  return t;
}

function int(value: unknown, what: string, min: number, max: number) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Fail(`${what} no válido`);
  return n;
}

function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new Fail('Identificador no válido');
  return value;
}

async function passage(libro: unknown, capitulo: unknown) {
  const book = (await books()).find((b) => b.id === libro);
  if (!book) throw new Fail('Libro no válido');
  return { libro: book.id, capitulo: int(capitulo, 'Capítulo', 1, book.chapters) };
}

/** Una tarjeta que manda quien guía. Las dinámicas del catálogo se toman del catálogo, no del teléfono. */
function card(value: unknown): Tarjeta | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object') throw new Fail('Tarjeta no válida');
  const v = value as Json;
  const tipo = v.tipo;
  if (tipo !== 'dinamica' && tipo !== 'pregunta' && tipo !== 'parte') throw new Fail('Tarjeta no válida');
  const minutos = v.minutos == null || v.minutos === 0 ? null : int(v.minutos, 'Tiempo', 1, MAX_MINUTES);
  const d = typeof v.dinamica === 'string' ? dinamica(v.dinamica) : undefined;
  if (tipo === 'dinamica' && !d) throw new Fail('Dinámica no válida');
  const pasos = d
    ? d.pasos
    : Array.isArray(v.pasos)
      ? v.pasos.slice(0, MAX_STEPS).map((p) => str(p, MAX_STEP, 'el paso')!)
      : [];
  return {
    tipo,
    titulo: tipo === 'dinamica' ? d!.nombre : str(v.titulo, MAX_CARD_TITLE, 'el título')!,
    texto: str(v.texto, MAX_CARD_TEXT, 'el texto', true),
    pasos,
    paso: 0,
    dinamica: d?.id ?? null,
    minutos: minutos ?? (tipo === 'dinamica' && v.minutos === undefined ? d!.minutos : null),
    fin: null,
  };
}

const later = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const isLive = (s: { cerrada: Date | null; actualizado: Date }) =>
  !s.cerrada && Date.now() - s.actualizado.getTime() < STALE_HOURS * 3_600_000;

type SalaRow = {
  id: string;
  codigo: string;
  titulo: string;
  dueno: string;
  dueno_nombre: string;
  guia: string | null;
  guia_nombre: string | null;
  grupo_id: string | null;
  grupo_nombre: string | null;
  estado: Estado;
  version: number;
  actualizado: Date;
  cerrada: Date | null;
};

async function salaByCode(sql: Sql, codigo: string) {
  const [row] = await sql<SalaRow[]>`
    select s.id, s.codigo, s.titulo, s.dueno, d.nombre as dueno_nombre, s.guia, g.nombre as guia_nombre, s.grupo_id,
      gr.nombre as grupo_nombre, s.estado, s.version, s.actualizado, s.cerrada
    from vivo_salas s join usuarios d on d.id = s.dueno left join usuarios g on g.id = s.guia
      left join grupos gr on gr.id = s.grupo_id
    where s.codigo = ${codigo}`;
  if (!row) throw new Fail('No encontramos esa lectura en vivo. Revisa el código.', 404);
  return row;
}

/** Todo lo que ve quien sigue la sala. `ahora` deja a cada teléfono corregir su reloj para la cuenta atrás. */
async function view(sql: Sql, s: SalaRow) {
  const live = isLive(s);
  const [presentes, toques] = live
    ? await Promise.all([
        sql<{ id: string; nombre: string; foto: string | null }[]>`
          select u.id, u.nombre, u.foto from vivo_presentes p join usuarios u on u.id = p.usuario_id
          where p.sala_id = ${s.id} and p.visto > now() - make_interval(secs => ${PRESENT_SECONDS})
          order by p.visto`,
        sql<{ usuario: string; nombre: string; versiculo: number }[]>`
          select t.usuario_id as usuario, u.nombre, t.versiculo from vivo_toques t join usuarios u on u.id = t.usuario_id
          where t.sala_id = ${s.id} order by t.creado`,
      ])
    : [[], []];
  const guia = s.guia ?? s.dueno;
  return {
    sala: {
      codigo: s.codigo,
      titulo: s.titulo,
      grupo: s.grupo_id ? { id: s.grupo_id, nombre: s.grupo_nombre } : null,
      enVivo: live,
      dueno: { id: s.dueno, nombre: s.dueno_nombre },
      guia: { id: guia, nombre: s.guia ? s.guia_nombre : s.dueno_nombre },
    },
    version: s.version,
    ahora: new Date().toISOString(),
    estado: s.estado,
    presentes,
    toques,
  };
}

/** Cambia la sala y sube la versión en una sola consulta. */
async function bump(sql: Sql, id: string, estado?: Estado) {
  if (estado) await sql`update vivo_salas set estado = ${sql.json(estado)}, version = version + 1, actualizado = now() where id = ${id}`;
  else await sql`update vivo_salas set version = version + 1, actualizado = now() where id = ${id}`;
}

async function liveSala(sql: Sql, value: unknown) {
  const s = await salaByCode(sql, codeOf(value));
  if (!isLive(s)) throw new Fail('Esta lectura en vivo ya terminó.', 410);
  return s;
}

const leads = (s: SalaRow, user: User) => user.id === s.dueno || user.id === (s.guia ?? s.dueno);

async function present(sql: Sql, salaId: string, userId: string) {
  // «nuevo» si no estaba o se había ido: entonces los demás deben verlo llegar (sube la versión).
  const [row] = await sql<{ nuevo: boolean }[]>`
    with antes as (select visto from vivo_presentes where sala_id = ${salaId} and usuario_id = ${userId})
    insert into vivo_presentes (sala_id, usuario_id) values (${salaId}, ${userId})
    on conflict (sala_id, usuario_id) do update set visto = now()
    returning (select coalesce(bool_or(visto < now() - make_interval(secs => ${PRESENT_SECONDS})), true) from antes) as nuevo`;
  return row.nuevo;
}

type Handler = (ctx: { sql: Sql; body: Json; request: Request }) => Promise<Json>;

export const celulaActions: Record<string, Handler> = {
  /** Empieza una lectura en vivo, sola o de un grupo. Si el grupo ya tiene una abierta, entra en ella. */
  async crearSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const { libro, capitulo } = await passage(body.libro, body.capitulo);
    let grupo: { id: string; nombre: string } | null = null;
    if (body.grupo) {
      const id = uuid(body.grupo);
      [grupo = null] = await sql<{ id: string; nombre: string }[]>`
        select g.id, g.nombre from grupos g join miembros m on m.grupo_id = g.id where g.id = ${id} and m.usuario_id = ${user.id}`;
      if (!grupo) throw new Fail('No perteneces a este grupo', 403);
      const [open] = await sql<{ codigo: string }[]>`
        select codigo from vivo_salas where grupo_id = ${grupo.id} and cerrada is null
          and actualizado > now() - make_interval(hours => ${STALE_HOURS})
        order by creado desc limit 1`;
      if (open) {
        const s = await salaByCode(sql, open.codigo);
        await present(sql, s.id, user.id);
        return { ...(await view(sql, s)), existente: true };
      }
    }
    const titulo = str(body.titulo, MAX_TITLE, 'el título', true) ?? grupo?.nombre ?? 'Lectura en vivo';
    const estado: Estado = { libro, capitulo, foco: null, tarjeta: null, recorrido: [`${libro}.${capitulo}`] };
    let codigo = '';
    for (let i = 0; i < 5 && !codigo; i++) {
      const [row] = await sql<{ codigo: string }[]>`
        insert into vivo_salas (codigo, dueno, grupo_id, titulo, estado) values (${newCode()}, ${user.id}, ${grupo?.id ?? null},
          ${titulo}, ${sql.json(estado)})
        on conflict (codigo) do nothing returning codigo`;
      codigo = row?.codigo ?? '';
    }
    if (!codigo) throw new Fail('No se pudo crear la sala. Inténtalo de nuevo.', 500);
    const s = await salaByCode(sql, codigo);
    await present(sql, s.id, user.id);
    if (grupo) {
      const book = (await books()).find((b) => b.id === libro)!;
      const others = await sql<{ usuario_id: string }[]>`
        select usuario_id from miembros where grupo_id = ${grupo.id} and usuario_id <> ${user.id}`;
      await Promise.all(
        others.map((m) =>
          notifyUser(sql, m.usuario_id, {
            title: `${user.nombre} empezó la lectura en vivo`,
            body: `${grupo!.nombre} · ${book.name} ${capitulo}. Toca para leer con el grupo.`,
            url: `/vivo/${codigo}`,
            tag: `vivo-${grupo!.id}`,
          }),
        ),
      );
    }
    return view(sql, s);
  },

  /** Entra con el código: cuenta como presente y devuelve la sala. */
  async unirseSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    if (await present(sql, s.id, user.id)) {
      await bump(sql, s.id);
      s.version++;
    }
    return view(sql, s);
  },

  /** La sala abierta de un grupo, para mostrar «En vivo ahora» en la pantalla del grupo. */
  async salaDelGrupo({ sql, body, request }) {
    const user = await auth(sql, request);
    const id = uuid(body.grupo);
    const [member] = await sql`select 1 from miembros where grupo_id = ${id} and usuario_id = ${user.id}`;
    if (!member) throw new Fail('No perteneces a este grupo', 403);
    const [open] = await sql<{ codigo: string; titulo: string; estado: Estado; guia: string; presentes: number }[]>`
      select s.codigo, s.titulo, s.estado, coalesce(gu.nombre, d.nombre) as guia,
        (select count(*)::int from vivo_presentes p where p.sala_id = s.id
          and p.visto > now() - make_interval(secs => ${PRESENT_SECONDS})) as presentes
      from vivo_salas s join usuarios d on d.id = s.dueno left join usuarios gu on gu.id = s.guia
      where s.grupo_id = ${id} and s.cerrada is null and s.actualizado > now() - make_interval(hours => ${STALE_HOURS})
      order by s.creado desc limit 1`;
    return { sala: open ?? null };
  },

  /** Sigue contando como presente (la app lo manda cada 20 s mientras la sala está abierta). */
  async presente({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    if (await present(sql, s.id, user.id)) await bump(sql, s.id);
    return { ok: true };
  },

  /** Sale de la sala: deja de contar como presente y se apaga su versículo. */
  async salirSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await salaByCode(sql, codeOf(body.sala));
    await sql`delete from vivo_presentes where sala_id = ${s.id} and usuario_id = ${user.id}`;
    await sql`delete from vivo_toques where sala_id = ${s.id} and usuario_id = ${user.id}`;
    if (isLive(s)) await bump(sql, s.id);
    return { ok: true };
  },

  /**
   * Quien guía pasa la hoja, señala un versículo o pone una tarjeta. Solo cambia lo que trae:
   * libro y capítulo, foco (número o null), tarjeta (objeto o null), paso de la tarjeta, reloj («iniciar» o «parar»).
   */
  async moverSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    if (!leads(s, user)) throw new Fail('Solo quien guía puede pasar la hoja', 403);
    const estado: Estado = { ...s.estado };
    if (body.libro !== undefined || body.capitulo !== undefined) {
      const { libro, capitulo } = await passage(body.libro ?? estado.libro, body.capitulo);
      if (libro !== estado.libro || capitulo !== estado.capitulo) {
        estado.libro = libro;
        estado.capitulo = capitulo;
        estado.foco = null;
        const key = `${libro}.${capitulo}`;
        if (estado.recorrido.at(-1) !== key) estado.recorrido = [...estado.recorrido, key].slice(-MAX_ROUTE);
        // Los versículos iluminados eran de la hoja anterior.
        await sql`delete from vivo_toques where sala_id = ${s.id}`;
      }
    }
    if (body.foco !== undefined) estado.foco = body.foco === null ? null : int(body.foco, 'Versículo', 1, 200);
    if (body.tarjeta !== undefined) {
      estado.tarjeta = card(body.tarjeta);
      if (estado.tarjeta?.minutos && body.reloj !== 'parar') estado.tarjeta.fin = later(estado.tarjeta.minutos);
    }
    if (estado.tarjeta && body.paso !== undefined) {
      estado.tarjeta = { ...estado.tarjeta, paso: int(body.paso, 'Paso', 0, Math.max(0, estado.tarjeta.pasos.length - 1)) };
    }
    if (estado.tarjeta && body.reloj !== undefined && body.tarjeta === undefined) {
      if (body.reloj === 'iniciar') estado.tarjeta = { ...estado.tarjeta, minutos: estado.tarjeta.minutos ?? 5 };
      const minutos = body.minutos != null ? int(body.minutos, 'Tiempo', 1, MAX_MINUTES) : estado.tarjeta.minutos;
      estado.tarjeta = {
        ...estado.tarjeta,
        minutos,
        fin: body.reloj === 'iniciar' && minutos ? later(minutos) : null,
      };
    }
    await bump(sql, s.id, estado);
    return view(sql, { ...s, estado, version: s.version + 1 });
  },

  /** Ilumina un versículo para todos; tocar el mismo otra vez lo apaga. Cada persona tiene uno a la vez. */
  async tocar({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    const versiculo = int(body.versiculo, 'Versículo', 1, 200);
    const [had] = await sql<{ versiculo: number }[]>`
      select versiculo from vivo_toques where sala_id = ${s.id} and usuario_id = ${user.id}`;
    if (had?.versiculo === versiculo) {
      await sql`delete from vivo_toques where sala_id = ${s.id} and usuario_id = ${user.id}`;
    } else {
      await sql`
        insert into vivo_toques (sala_id, usuario_id, versiculo) values (${s.id}, ${user.id}, ${versiculo})
        on conflict (sala_id, usuario_id) do update set versiculo = excluded.versiculo, creado = now()`;
    }
    await present(sql, s.id, user.id);
    await bump(sql, s.id);
    return view(sql, { ...s, version: s.version + 1 });
  },

  /** Quien empezó la sala le pasa la guía a otra persona presente (los co-líderes de cada parte), o la recupera. */
  async cederGuia({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    if (user.id !== s.dueno && user.id !== (s.guia ?? s.dueno)) throw new Fail('Solo quien guía puede pasar la guía', 403);
    const to = uuid(body.usuario);
    if (to !== s.dueno) {
      const [here] = await sql`select 1 from vivo_presentes where sala_id = ${s.id} and usuario_id = ${to}`;
      if (!here) throw new Fail('Esa persona no está en la sala');
    }
    await sql`update vivo_salas set guia = ${to === s.dueno ? null : to}, version = version + 1, actualizado = now() where id = ${s.id}`;
    return view(sql, await salaByCode(sql, s.codigo));
  },

  /** Termina la lectura para todos. */
  async cerrarSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await salaByCode(sql, codeOf(body.sala));
    if (user.id !== s.dueno) throw new Fail('Solo quien empezó la lectura puede terminarla', 403);
    await sql`update vivo_salas set cerrada = now(), version = version + 1 where id = ${s.id} and cerrada is null`;
    await sql`delete from vivo_toques where sala_id = ${s.id}`;
    return view(sql, await salaByCode(sql, s.codigo));
  },
};

function failResponse(err: unknown, accion: string) {
  if (err instanceof Fail) return Response.json({ error: err.message }, { status: err.status, headers: { 'Cache-Control': 'no-store' } });
  console.error('vivo', accion, err);
  return Response.json({ error: 'Algo falló en el servidor. Inténtalo de nuevo.' }, { status: 500 });
}

/** POST /api/vivo con una acción de la célula. */
export async function celulaPOST(body: Json, request: Request) {
  const accion = body.accion as string;
  try {
    const result = await celulaActions[accion]({ sql: await db(), body, request });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return failResponse(err, accion);
  }
}

export const isCelulaAction = (accion: unknown) => typeof accion === 'string' && Object.hasOwn(celulaActions, accion);

/** GET /api/vivo?sala=CODIGO: lo que ve quien sigue. El CDN la guarda un segundo para toda la célula. */
export async function celulaGET(url: URL) {
  try {
    const s = await salaByCode(await db(), codeOf(url.searchParams.get('sala')));
    return Response.json(await view(await db(), s), {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, s-maxage=1, stale-while-revalidate=1',
      },
    });
  } catch (err) {
    return failResponse(err, 'ver');
  }
}
