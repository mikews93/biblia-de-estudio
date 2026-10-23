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
//
// Estudio en grupo: quien guía manda a todas las pantallas una sección del estudio Profundo o la respuesta del
// estudio a una pregunta (tarjeta «estudio»), y lanza preguntas que cada uno responde en secreto hasta que las
// revela (tarjeta «ronda», tabla vivo_respuestas). Cualquiera con cuenta deja sus dudas en el tablero de la sala
// y apoya las de otros con «yo también» (tabla vivo_preguntas).

import { createHash, randomInt, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

import { dinamica } from '../src/lib/dinamicas';
import {
  JUEGOS,
  type Juego,
  LETRAS,
  MAX_PREGUNTAS,
  type ModoRepaso,
  type PreguntaRepaso,
  conSolucion,
  equipoPara,
  marcador,
  mismaRespuesta,
} from '../src/lib/repaso';
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
// Una sección del estudio o una respuesta de la IA es más larga que una tarjeta del Taller.
const MAX_STUDY_TEXT = 8000;
const MAX_SOURCES = 24;
const MAX_QUESTION = 280;
const MAX_ANSWER = 600;
// Las dudas abiertas de cada persona en el tablero, para que nadie lo llene.
const MAX_OPEN_QUESTIONS = 5;

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
);
create table if not exists vivo_preguntas (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references vivo_salas on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  apoyos uuid[] not null default '{}',
  respondida boolean not null default false,
  creado timestamptz not null default now()
);
create index if not exists vivo_preguntas_sala on vivo_preguntas (sala_id);
create table if not exists vivo_respuestas (
  sala_id uuid not null references vivo_salas on delete cascade,
  ronda text not null,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  creado timestamptz not null default now(),
  primary key (sala_id, ronda, usuario_id)
);`;

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Book = { id: string; name: string; chapters: number };
type User = { id: string; nombre: string };

/** Una fuente de una tarjeta del estudio, para que los números ⟦n⟧ del texto se puedan abrir. */
type Fuente = { n: number; label: string; ref?: string; url?: string };

/**
 * Lo que se ve en pantalla: un paso de una dinámica, una pregunta o una parte del encuentro del Taller; una
 * sección del estudio («estudio»), o una pregunta que todos responden en secreto («ronda»).
 */
export type Tarjeta = {
  tipo: 'dinamica' | 'pregunta' | 'parte' | 'estudio' | 'ronda' | 'repaso';
  /** Distingue una tarjeta de otra igual: las respuestas de una ronda van con este id. */
  id?: string;
  titulo: string;
  texto: string | null;
  pasos: string[];
  paso: number;
  /** Del catálogo de src/lib/dinamicas.ts, si la tarjeta es una dinámica. */
  dinamica: string | null;
  minutos: number | null;
  /** Cuándo termina el reloj (lo fija el servidor para que todos vean la misma cuenta atrás). */
  fin: string | null;
  /** Estudio: las fuentes del texto, y la duda del tablero a la que responde, si es una. */
  fuentes?: Fuente[];
  pregunta?: string | null;
  /** Ronda: sin nombres al revelar, y si ya se revelaron las respuestas. */
  anonima?: boolean;
  revelada?: boolean;
  /** Repaso: las preguntas (la correcta solo sale al revelar cada una), cuáles se revelaron y cuándo empezó cada una. */
  preguntas?: PreguntaRepaso[];
  reveladas?: number[];
  desdes?: (string | null)[];
  modo?: ModoRepaso;
  juego?: Juego;
  /** Con equipos: el equipo (0 o 1) de cada persona. */
  equipos?: Record<string, number>;
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
  if (tipo === 'estudio' || tipo === 'ronda') return studyCard(tipo, v);
  if (tipo === 'repaso') return quizCard(v);
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
    id: randomUUID(),
    titulo: tipo === 'dinamica' ? d!.nombre : str(v.titulo, MAX_CARD_TITLE, 'el título')!,
    texto: str(v.texto, MAX_CARD_TEXT, 'el texto', true),
    pasos,
    paso: 0,
    dinamica: d?.id ?? null,
    minutos: minutos ?? (tipo === 'dinamica' && v.minutos === undefined ? d!.minutos : null),
    fin: null,
  };
}

function sources(value: unknown): Fuente[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SOURCES).flatMap((f) => {
    if (!f || typeof f !== 'object') return [];
    const { n, label, ref, url } = f as Json;
    if (!Number.isInteger(n) || typeof label !== 'string' || !label.trim()) return [];
    return [
      {
        n: n as number,
        label: label.trim().slice(0, 200),
        ...(typeof ref === 'string' && ref.length <= 40 && { ref }),
        ...(typeof url === 'string' && /^https:\/\//.test(url) && url.length <= 400 && { url }),
      },
    ];
  });
}

/** Una sección del estudio o una pregunta para que todos respondan. Cada una lleva un id nuevo. */
function studyCard(tipo: 'estudio' | 'ronda', v: Json): Tarjeta {
  const base = { tipo, id: randomUUID(), pasos: [], paso: 0, dinamica: null, minutos: null, fin: null };
  if (tipo === 'ronda') {
    return { ...base, titulo: str(v.titulo, MAX_QUESTION, 'la pregunta')!, texto: null, anonima: v.anonima === true, revelada: false };
  }
  return {
    ...base,
    titulo: str(v.titulo, MAX_QUESTION, 'el título')!,
    texto: str(v.texto, MAX_STUDY_TEXT, 'el texto')!,
    fuentes: sources(v.fuentes),
    pregunta: typeof v.pregunta === 'string' ? uuid(v.pregunta) : null,
  };
}

/** El repaso relámpago: preguntas de opción múltiple que todos responden a la vez (src/lib/repaso.ts). */
function quizCard(v: Json): Tarjeta {
  const juego: Juego = JUEGOS.some((j) => j.id === v.juego) ? (v.juego as Juego) : 'repaso';
  const preguntas = (Array.isArray(v.preguntas) ? v.preguntas : []).slice(0, MAX_PREGUNTAS).map((q): PreguntaRepaso => {
    const x = (q ?? {}) as Json;
    const opciones = Array.isArray(x.opciones) ? x.opciones.slice(0, 24).map((o) => str(o, 120, 'la opción')!) : [];
    const texto = str(x.texto, MAX_QUESTION, 'la pregunta')!;
    const cita = str(x.cita, 60, 'la cita', true);
    // Ordena y espada: se acierta si la respuesta es la solución (las palabras en orden, el número del versículo).
    if (conSolucion(juego)) {
      const solucion = str(x.solucion, 600, 'la solución')!;
      const versiculos = juego === 'espada' ? int(x.versiculos, 'Versículos', 1, 200) : undefined;
      if (juego === 'ordena' && opciones.join(' ').length > 600) throw new Fail('Versículo demasiado largo');
      return { texto, opciones, correcta: 0, cita, solucion, ...(versiculos && { versiculos }) };
    }
    const cuantas = juego === 'mentira' ? 3 : LETRAS.length;
    if (opciones.length !== cuantas) throw new Fail(`Cada pregunta lleva ${cuantas} opciones`);
    return { texto, opciones, correcta: int(x.correcta, 'Respuesta correcta', 0, cuantas - 1), cita };
  });
  if (!preguntas.length) throw new Fail('El repaso no tiene preguntas');
  const modo: ModoRepaso = v.modo === 'puntos' || v.modo === 'equipos' ? v.modo : 'grupo';
  return {
    tipo: 'repaso',
    id: randomUUID(),
    titulo: str(v.titulo, MAX_CARD_TITLE, 'el título', true) ?? JUEGOS.find((j) => j.id === juego)!.nombre,
    texto: null,
    pasos: preguntas.map((q) => q.texto),
    paso: 0,
    dinamica: null,
    minutos: null,
    fin: null,
    preguntas,
    reveladas: [],
    desdes: preguntas.map((_, i) => (i === 0 ? new Date().toISOString() : null)),
    modo,
    juego,
    ...(modo === 'equipos' && { equipos: {} }),
  };
}

/** Lo que se publica del repaso: la respuesta correcta de cada pregunta solo cuando ya se reveló. */
function publicCard(t: Tarjeta | null): Tarjeta | null {
  if (t?.tipo !== 'repaso' || !t.preguntas) return t;
  return {
    ...t,
    preguntas: t.preguntas.map((q, i) => {
      if (t.reveladas?.includes(i)) return q;
      // Antes de revelar no va la respuesta, ni la cita (en la espada bíblica sería la respuesta).
      const { solucion: _s, ...rest } = q;
      return { ...rest, correcta: -1, cita: null };
    }),
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
  const ronda = s.estado.tarjeta?.tipo === 'ronda' ? s.estado.tarjeta : null;
  const repaso = s.estado.tarjeta?.tipo === 'repaso' ? s.estado.tarjeta : null;
  const [presentes, toques, preguntas, respuestas] = live
    ? await Promise.all([
        sql<{ id: string; nombre: string; foto: string | null }[]>`
          select u.id, u.nombre, u.foto from vivo_presentes p join usuarios u on u.id = p.usuario_id
          where p.sala_id = ${s.id} and p.visto > now() - make_interval(secs => ${PRESENT_SECONDS})
          order by p.visto`,
        sql<{ usuario: string; nombre: string; versiculo: number }[]>`
          select t.usuario_id as usuario, u.nombre, t.versiculo from vivo_toques t join usuarios u on u.id = t.usuario_id
          where t.sala_id = ${s.id} order by t.creado`,
        sql<{ id: string; texto: string; autor: string; nombre: string; apoyos: string[]; respondida: boolean }[]>`
          select p.id, p.texto, p.usuario_id as autor, u.nombre, p.apoyos, p.respondida
          from vivo_preguntas p join usuarios u on u.id = p.usuario_id
          where p.sala_id = ${s.id} order by p.creado`,
        ronda?.id
          ? sql<{ usuario: string; nombre: string; texto: string }[]>`
              select r.usuario_id as usuario, u.nombre, r.texto from vivo_respuestas r join usuarios u on u.id = r.usuario_id
              where r.sala_id = ${s.id} and r.ronda = ${ronda.id} order by r.creado`
          : repaso?.id
            ? sql<{ usuario: string; nombre: string; texto: string; ronda: string; creado: Date }[]>`
                select r.usuario_id as usuario, u.nombre, r.texto, r.ronda, r.creado from vivo_respuestas r
                join usuarios u on u.id = r.usuario_id
                where r.sala_id = ${s.id} and r.ronda like ${repaso.id + ':%'} order by r.creado`
            : Promise.resolve([]),
      ])
    : [[], [], [], []];
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
    estado: { ...s.estado, tarjeta: publicCard(s.estado.tarjeta) },
    presentes,
    toques,
    preguntas,
    // Lo que ve todo el mundo: antes de revelar, solo quiénes ya respondieron, sin lo que escribieron.
    respuestas: ronda
      ? {
          ronda: ronda.id,
          quienes: respuestas.map((r) => r.usuario),
          lista: ronda.revelada
            ? respuestas.map((r) => ({ texto: r.texto, ...(ronda.anonima ? {} : { usuario: r.usuario, nombre: r.nombre }) }))
            : null,
        }
      : repaso
        ? quizView(repaso, respuestas as { usuario: string; nombre: string; texto: string; ronda: string; creado: Date }[])
        : null,
  };
}

/** Del repaso: quiénes respondieron la pregunta de ahora, los votos de las reveladas y, si se juega, el marcador. */
function quizView(t: Tarjeta, rows: { usuario: string; nombre: string; texto: string; ronda: string; creado: Date }[]) {
  const all = rows.map((r) => ({
    usuario: r.usuario,
    nombre: r.nombre,
    paso: Number(r.ronda.split(':')[1]),
    opcion: Number(r.texto),
    creado: new Date(r.creado).toISOString(),
  }));
  const reveladas = t.reveladas ?? [];
  const votos: Record<number, number[]> = {};
  for (const p of reveladas) votos[p] = LETRAS.map((_, i) => all.filter((r) => r.paso === p && r.opcion === i).length);
  const tabla = t.modo === 'grupo' ? null : marcador(all, t.preguntas ?? [], t.desdes ?? [], reveladas);
  return {
    ronda: `${t.id}:${t.paso}`,
    quienes: all.filter((r) => r.paso === t.paso).map((r) => r.usuario),
    lista: null,
    votos,
    ...(tabla && { marcador: tabla.map((f) => ({ ...f, ...(t.equipos && { equipo: t.equipos[f.usuario] ?? null }) })) }),
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

/** Una respuesta del repaso: la primera vale (cuenta la rapidez) y se cierra al revelar la pregunta. */
async function answerQuiz(sql: Sql, s: SalaRow, t: Tarjeta, user: User, body: Json) {
  const ronda = `${t.id}:${t.paso}`;
  if (body.ronda !== ronda) throw new Fail('Esa pregunta ya pasó', 409);
  if (t.reveladas?.includes(t.paso)) throw new Fail('Esta pregunta ya se reveló');
  const q = t.preguntas?.[t.paso];
  // En ordena y espada se guarda 0 si acertó y 1 si no: así los votos y el marcador son los de siempre.
  const opcion =
    conSolucion(t.juego) && q?.solucion
      ? typeof body.respuesta === 'string' && body.respuesta.length <= 600 && mismaRespuesta(body.respuesta, q.solucion)
        ? 0
        : 1
      : int(body.opcion, 'Opción', 0, (q?.opciones.length ?? LETRAS.length) - 1);
  await sql`
    insert into vivo_respuestas (sala_id, ronda, usuario_id, texto) values (${s.id}, ${ronda}, ${user.id}, ${String(opcion)})
    on conflict (sala_id, ronda, usuario_id) do nothing`;
  let estado = s.estado;
  // Con equipos, quien responde por primera vez entra al equipo con menos gente.
  if (t.equipos && t.equipos[user.id] === undefined) {
    estado = { ...estado, tarjeta: { ...t, equipos: { ...t.equipos, [user.id]: equipoPara(t.equipos) } } };
  }
  await present(sql, s.id, user.id);
  await bump(sql, s.id, estado === s.estado ? undefined : estado);
  return view(sql, { ...s, estado, version: s.version + 1 });
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
      // La respuesta del estudio a una duda del tablero la marca como vista.
      if (estado.tarjeta?.pregunta) {
        await sql`update vivo_preguntas set respondida = true where id = ${estado.tarjeta.pregunta} and sala_id = ${s.id}`;
      }
      if (estado.tarjeta?.minutos && body.reloj !== 'parar') estado.tarjeta.fin = later(estado.tarjeta.minutos);
    }
    if (estado.tarjeta && body.paso !== undefined) {
      const paso = int(body.paso, 'Paso', 0, Math.max(0, estado.tarjeta.pasos.length - 1));
      estado.tarjeta = { ...estado.tarjeta, paso };
      // En el repaso, la rapidez se cuenta desde que la pregunta aparece por primera vez.
      if (estado.tarjeta.desdes && !estado.tarjeta.desdes[paso]) {
        estado.tarjeta.desdes = estado.tarjeta.desdes.map((d, i) => (i === paso ? new Date().toISOString() : d));
      }
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
    if (body.revelar !== undefined && estado.tarjeta?.tipo === 'ronda') {
      estado.tarjeta = { ...estado.tarjeta, revelada: body.revelar === true };
    }
    if (body.revelar === true && estado.tarjeta?.tipo === 'repaso' && !estado.tarjeta.reveladas?.includes(estado.tarjeta.paso)) {
      estado.tarjeta = { ...estado.tarjeta, reveladas: [...(estado.tarjeta.reveladas ?? []), estado.tarjeta.paso] };
    }
    await bump(sql, s.id, estado);
    return view(sql, { ...s, estado, version: s.version + 1 });
  },

  /** Deja una duda en el tablero de la sala para estudiarla con el grupo. */
  async preguntarSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    const texto = str(body.texto, MAX_QUESTION, 'la pregunta')!;
    const [{ abiertas }] = await sql<{ abiertas: number }[]>`
      select count(*)::int as abiertas from vivo_preguntas where sala_id = ${s.id} and usuario_id = ${user.id} and not respondida`;
    if (abiertas >= MAX_OPEN_QUESTIONS) throw new Fail(`Ya tienes ${MAX_OPEN_QUESTIONS} preguntas esperando. Espera a que el grupo vea alguna.`);
    await sql`insert into vivo_preguntas (sala_id, usuario_id, texto) values (${s.id}, ${user.id}, ${texto})`;
    await present(sql, s.id, user.id);
    await bump(sql, s.id);
    return view(sql, { ...s, version: s.version + 1 });
  },

  /** «Yo también»: apoya una duda de otra persona; tocar otra vez lo quita. */
  async apoyarSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    const id = uuid(body.pregunta);
    const [row] = await sql`
      update vivo_preguntas set apoyos = case when ${user.id}::uuid = any(apoyos) then array_remove(apoyos, ${user.id}::uuid)
        else array_append(apoyos, ${user.id}::uuid) end
      where id = ${id} and sala_id = ${s.id} and usuario_id <> ${user.id} returning id`;
    if (!row) throw new Fail('Esa pregunta ya no está', 404);
    await bump(sql, s.id);
    return view(sql, { ...s, version: s.version + 1 });
  },

  /** Quita una duda del tablero: quien la hizo o quien guía. */
  async quitarPreguntaSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    const id = uuid(body.pregunta);
    const [row] = await sql`
      delete from vivo_preguntas where id = ${id} and sala_id = ${s.id} and (${leads(s, user)} or usuario_id = ${user.id}) returning id`;
    if (!row) throw new Fail('No puedes quitar esa pregunta', 403);
    await bump(sql, s.id);
    return view(sql, { ...s, version: s.version + 1 });
  },

  /** La respuesta de cada uno a la ronda en pantalla. Se puede cambiar hasta que quien guía las revela. */
  async responderSala({ sql, body, request }) {
    const user = await auth(sql, request);
    const s = await liveSala(sql, body.sala);
    const t = s.estado.tarjeta;
    if (t?.tipo === 'repaso') return answerQuiz(sql, s, t, user, body);
    if (t?.tipo !== 'ronda' || !t.id || body.ronda !== t.id) throw new Fail('Esa pregunta ya no está en pantalla', 409);
    if (t.revelada) throw new Fail('Las respuestas ya se revelaron');
    const texto = str(body.texto, MAX_ANSWER, 'la respuesta')!;
    await sql`
      insert into vivo_respuestas (sala_id, ronda, usuario_id, texto) values (${s.id}, ${t.id}, ${user.id}, ${texto})
      on conflict (sala_id, ronda, usuario_id) do update set texto = excluded.texto`;
    await present(sql, s.id, user.id);
    await bump(sql, s.id);
    return view(sql, { ...s, version: s.version + 1 });
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
