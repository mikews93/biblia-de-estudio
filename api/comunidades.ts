// Función de Vercel para las comunidades: grupos privados por invitación con un plan de lectura en común,
// notas compartidas en un versículo, peticiones de oración, preguntas para la reunión sugeridas por la IA y
// guías de encuentro preparadas en el Taller.
// También la red de la pestaña Comunidad: amigos, publicaciones (lo que cada quien lee, versículos resaltados,
// imágenes de versículos y preguntas), «me gusta» y comentarios; versículos enviados a un amigo con «Amén / Gracias». Y «En pareja» (api/_pareja.ts): dos cuentas unidas
// por un código que hacen juntas un plan de devocionales.
//
// Todo va por POST con {"accion": "...", ...}. Para empezar basta un nombre: al registrarse se recibe una
// llave de sesión que la app guarda y envía como "Authorization: Bearer <llave>" (en la base solo queda su
// hash). Si la persona añade correo y contraseña, puede entrar con ellos desde otro dispositivo.
//
// El perfil (foto, unas líneas sobre la persona, su iglesia y su ciudad) usa las ayudas de api/_perfil.ts.
// Entrar con Google, Apple o Facebook (Auth.js, api/_entrar.ts) va por /api/auth, que es authRoute de este archivo.
//
// Base de datos: Postgres (Neon desde el Marketplace de Vercel), en DATABASE_URL o POSTGRES_URL.
// Las tablas se crean solas la primera vez que se usa la función.

import Anthropic from '@anthropic-ai/sdk';
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import postgres from 'postgres';

import { authJs, esProveedor, Externo, NOMBRE, paginaVuelta, Proveedor, proveedoresListos } from './_entrar';
import { downloadPhoto, imageType, MAX_PHOTO_BYTES, removePhoto, storePhoto } from './_perfil';
import { CIRCULO_SCHEMA, circuloActions } from './_circulo';
import { CUIDAR_SCHEMA, cuidarActions } from './_cuidar';
import { iglesiaActions, iglesiaDe } from './_iglesias';
import { PAREJA_SCHEMA, parejaActions } from './_pareja';
import { type Aviso, notifyUser, PUSH_SCHEMA } from './_push';
import { esCuidador } from './_senales';
import { planById } from '../src/lib/planesCatalogo';
import { parseRetoId, seasonRun } from '../src/lib/temporadas';

const MODEL = process.env.ESTUDIO_MODEL ?? 'claude-opus-5-5';
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');
const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const MAX_NAME = 40;
const MAX_BIO = 160;
const MAX_PLACE = 60;
const MAX_APODO = 24;
const PHOTOS_PER_DAY = 10;
// Lo que dura el viaje de ida y vuelta a Google, Apple o Facebook.
const VIAJE_MINUTOS = 15;
const MAX_NOTE = 1000;
const MAX_PRAYER = 500;
const MAX_GUIDE = 10000;
const AI_PER_DAY = 20;
const WEEKLY_GOAL = 5;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_POST = 1000;
const MAX_COMMENT = 500;
const POSTS_PER_HOUR = 20;
const COMMENTS_PER_HOUR = 60;
const PAGE = 30;
// Con tantos reportes una publicación deja de verse para los demás (quien la reporta deja de verla al instante).
const REPORTS_TO_HIDE = 3;
const POST_TYPES = ['resaltado', 'imagen', 'pregunta', 'reflexion'];
const HIGHLIGHTS = ['amarillo', 'verde', 'azul', 'rosa'];
// «Te envié un versículo»: cuántos se pueden mandar por hora y las respuestas posibles.
const SENT_PER_HOUR = 30;
const RESPUESTAS = ['amen', 'gracias'];

const SCHEMA = `
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  correo text unique,
  clave_hash text,
  creado timestamptz not null default now()
);
create table if not exists sesiones (
  llave_hash text primary key,
  usuario_id uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now()
);
create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  codigo text not null unique,
  plan_libro text,
  plan_inicio date,
  plan_por_dia int not null default 1,
  creado timestamptz not null default now()
);
create table if not exists miembros (
  grupo_id uuid not null references grupos on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  rol text not null default 'miembro',
  unido timestamptz not null default now(),
  primary key (grupo_id, usuario_id)
);
create index if not exists miembros_usuario on miembros (usuario_id);
create table if not exists lecturas (
  usuario_id uuid not null references usuarios on delete cascade,
  libro text not null,
  capitulo int not null,
  dia date not null,
  primary key (usuario_id, libro, capitulo, dia)
);
create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  libro text not null,
  capitulo int not null,
  versiculo int not null,
  texto text not null,
  creado timestamptz not null default now()
);
create index if not exists notas_pasaje on notas (grupo_id, libro, capitulo);
create table if not exists peticiones (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  respondida boolean not null default false,
  creado timestamptz not null default now()
);
create index if not exists peticiones_grupo on peticiones (grupo_id, creado desc);
create table if not exists orando (
  peticion_id uuid not null references peticiones on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now(),
  primary key (peticion_id, usuario_id)
);
create table if not exists preguntas (
  grupo_id uuid not null references grupos on delete cascade,
  libro text not null,
  capitulo int not null,
  texto text not null,
  creado timestamptz not null default now(),
  primary key (grupo_id, libro, capitulo)
);
create table if not exists guias (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  titulo text not null,
  pasaje text,
  texto text not null,
  creado timestamptz not null default now()
);
create index if not exists guias_grupo on guias (grupo_id, creado desc);
create table if not exists uso_ia (
  grupo_id uuid not null references grupos on delete cascade,
  dia date not null,
  n int not null default 0,
  primary key (grupo_id, dia)
);
alter table usuarios add column if not exists codigo text unique;
alter table usuarios add column if not exists compartir_lecturas boolean not null default true;
alter table grupos add column if not exists plan_reto text;
alter table usuarios add column if not exists foto text;
alter table usuarios add column if not exists bio text;
alter table usuarios add column if not exists iglesia text;
alter table usuarios add column if not exists ciudad text;
alter table usuarios add column if not exists apodo text;
alter table usuarios add column if not exists facebook_id text unique;
alter table usuarios add column if not exists facebook_nombre text;
alter table usuarios add column if not exists fotos_dia date;
alter table usuarios add column if not exists fotos_n int not null default 0;
alter table usuarios add column if not exists racha int not null default 0;
alter table usuarios add column if not exists racha_vence date;
-- Cada quien puede silenciar los avisos de un grupo sin salir de él.
alter table miembros add column if not exists avisos boolean not null default true;
create table if not exists cuentas_externas (
  proveedor text not null,
  cuenta_id text not null,
  usuario_id uuid not null references usuarios on delete cascade,
  nombre text,
  creado timestamptz not null default now(),
  primary key (proveedor, cuenta_id),
  unique (usuario_id, proveedor)
);
insert into cuentas_externas (proveedor, cuenta_id, usuario_id, nombre)
  select 'facebook', facebook_id, id, facebook_nombre from usuarios where facebook_id is not null on conflict do nothing;
update usuarios set facebook_id = null, facebook_nombre = null where facebook_id is not null;
drop table if exists facebook_viajes;
create table if not exists viajes_cuenta (
  estado_hash text primary key,
  pase_hash text unique,
  navegador_hash text unique,
  proveedor text not null,
  modo text not null,
  nativo boolean not null default false,
  usuario_id uuid references usuarios on delete cascade,
  resultado text not null default 'pendiente',
  creado timestamptz not null default now()
);
create table if not exists amistades (
  de uuid not null references usuarios on delete cascade,
  para uuid not null references usuarios on delete cascade,
  aceptada boolean not null default false,
  creado timestamptz not null default now(),
  primary key (de, para)
);
create index if not exists amistades_para on amistades (para);
create table if not exists publicaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios on delete cascade,
  tipo text not null,
  audiencia text not null default 'amigos',
  libro text,
  capitulo int,
  versiculo int,
  version text,
  cita text,
  texto text,
  datos jsonb not null default '{}',
  clave text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create unique index if not exists publicaciones_clave on publicaciones (usuario_id, clave);
create index if not exists publicaciones_recientes on publicaciones (actualizado desc);
create index if not exists publicaciones_usuario on publicaciones (usuario_id, actualizado desc);
create table if not exists me_gusta (
  publicacion_id uuid not null references publicaciones on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now(),
  primary key (publicacion_id, usuario_id)
);
create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references publicaciones on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  creado timestamptz not null default now()
);
create index if not exists comentarios_publicacion on comentarios (publicacion_id, creado);
create table if not exists reportes (
  publicacion_id uuid not null references publicaciones on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now(),
  primary key (publicacion_id, usuario_id)
);
create table if not exists bloqueos (
  de uuid not null references usuarios on delete cascade,
  a uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now(),
  primary key (de, a)
);
create table if not exists versiculos_enviados (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references usuarios on delete cascade,
  para uuid not null references usuarios on delete cascade,
  libro text not null,
  capitulo int not null,
  versiculo int not null,
  version text not null,
  cita text not null,
  datos jsonb not null default '{}',
  respuesta text,
  respondido timestamptz,
  visto boolean not null default false,
  creado timestamptz not null default now()
);
create index if not exists versiculos_enviados_para on versiculos_enviados (para, creado desc);
create index if not exists versiculos_enviados_de on versiculos_enviados (de, creado desc);`;

const QUESTIONS_SYSTEM = `Preparas preguntas para la reunión de un grupo pequeño cristiano (una célula, una familia o un grupo de la iglesia) que lee la Biblia en una app gratuita en español.

Tu papel es solo proponer preguntas: no escribes sermones, enseñanzas, devocionales ni respuestas. El líder guía la conversación y el grupo descubre el texto por sí mismo, al estilo del Estudio Bíblico de Descubrimiento.

Reglas:
- Basa cada pregunta en el pasaje que recibes. Las preguntas sobre el texto deben poder responderse leyéndolo.
- Preguntas abiertas, cortas y claras para personas sin formación teológica. Nada de preguntas de sí o no.
- Mantente dentro del cristianismo histórico (Trinidad, divinidad de Cristo, salvación por gracia). No uses enseñanzas de grupos como los Testigos de Jehová o los mormones.
- Si el pasaje es difícil o polémico, formula preguntas que lleven al texto, sin imponer una interpretación.
- Escribe en español, con este formato exacto y nada más:

## Para empezar
- (una pregunta ligera para conectar, ligada al tema del pasaje)

## Sobre el texto
- (tres o cuatro preguntas: qué dice, qué enseña sobre Dios, qué enseña sobre las personas)

## Para la vida
- (dos preguntas de aplicación)
- (una invitación a completar «Yo voy a…» esta semana)

## Para orar
- (una idea breve de por qué orar juntos, a partir del pasaje)`;

type Book = { id: string; name: string; chapters: number };
type Version = { id: string; abbr: string };
type Verse = [number, string];
type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type User = {
  id: string;
  nombre: string;
  correo: string | null;
  foto: string | null;
  bio: string | null;
  iglesia: string | null;
  ciudad: string | null;
  /** Cómo quiere que la app la salude («Buenos días, Migue»), o null para usar su primer nombre. */
  apodo: string | null;
  /** Si tiene contraseña (una cuenta creada con Google, Apple o Facebook puede tener correo y no contraseña). */
  conClave: boolean;
  /** Las cuentas de Google, Apple o Facebook con las que puede entrar, con el nombre que tiene en cada una. */
  cuentas: { proveedor: Proveedor; nombre: string | null }[];
  /** Su racha devocional viva (0 si no hay): la foto de perfil brilla más mientras más larga. */
  racha: number;
  /** Soltero, abierto a conocer a alguien, en una relación o casado (api/_circulo.ts); solo la ve su círculo. */
  etapa: string | null;
};

// La racha devocional que la app cuenta (src/lib/rachaTexto.ts), viva hasta su último día; un día de margen por las
// zonas horarias. Se muestra como un aro de luz alrededor de la foto de perfil.
const RACHA = `case when u.racha_vence >= current_date - 1 then u.racha else 0 end`;

// Las columnas de User, para cada consulta que devuelve la cuenta a la app.
const USER_COLUMNS = `u.id, u.nombre, u.correo, u.foto, u.bio, u.iglesia, u.ciudad, u.apodo, u.clave_hash is not null as "conClave",
  coalesce((select json_agg(json_build_object('proveedor', c.proveedor, 'nombre', c.nombre) order by c.creado)
    from cuentas_externas c where c.usuario_id = u.id), '[]'::json) as cuentas,
  case when u.racha_vence >= current_date - 1 then u.racha else 0 end as racha, u.etapa`;
/** El plan del grupo: un libro a un ritmo fijo, o un reto de temporada («adviento-2026») con sus fechas. */
type Plan = { libro: string | null; inicio: string | null; porDia: number; reto: string | null };

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
let versionsCache: Promise<Version[]> | null = null;

async function db() {
  if (!DB_URL) throw new Fail('Falta conectar la base de datos de las comunidades en el servidor.', 503);
  sql ??= postgres(DB_URL, { max: 3, idle_timeout: 20, onnotice: () => {} });
  ready ??= sql.unsafe(SCHEMA + PUSH_SCHEMA + PAREJA_SCHEMA + CUIDAR_SCHEMA + CIRCULO_SCHEMA).catch((err) => {
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

/** El texto de un versículo, leído de los datos de la app (nunca el que manda el teléfono). */
async function verseText(version: unknown, book: Book, chapter: number, verse: number) {
  versionsCache ??= readFile(path.join(DATA_DIR, 'versions.json'), 'utf8').then((raw) => JSON.parse(raw) as Version[]);
  const versions = await versionsCache;
  const v = versions.find((x) => x.id === version || x.abbr === version) ?? versions.find((x) => x.id === 'rv1909')!;
  const verses = JSON.parse(
    await readFile(path.join(DATA_DIR, 'text', v.id, book.id, `${chapter}.json`), 'utf8'),
  ) as Verse[];
  const found = verses.find(([n]) => n === verse);
  if (!found) throw new Fail('Versículo no válido');
  return { version: v.abbr, cita: found[1] };
}

async function bookOf(id: unknown) {
  const book = (await books()).find((b) => b.id === id);
  if (!book) throw new Fail('Libro no válido');
  return book;
}

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await scryptAsync(pw, salt, 32)).toString('hex')}`;
}

async function checkPassword(pw: string, stored: string | null) {
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  const got = await scryptAsync(pw, Buffer.from(salt, 'hex'), 32);
  return timingSafeEqual(got, Buffer.from(expected, 'hex'));
}

function email(value: unknown) {
  const e = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) throw new Fail('Escribe un correo válido');
  return e;
}

function password(value: unknown) {
  const p = typeof value === 'string' ? value : '';
  if (p.length < 8) throw new Fail('La contraseña necesita al menos 8 caracteres');
  if (p.length > 200) throw new Fail('La contraseña es demasiado larga');
  return p;
}

async function newSession(sql: Sql, userId: string) {
  const llave = randomBytes(24).toString('base64url');
  await sql`insert into sesiones (llave_hash, usuario_id) values (${hash(llave)}, ${userId})`;
  return llave;
}

const hash = (key: string) => createHash('sha256').update(key).digest('hex');
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** Lo que guarda una imagen de versículo (fondo, letra, palabras destacadas, dedicatoria y palabra original), acotado. */
function datosDeImagen(raw: Json) {
  const corto = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
  const datos: Json = {
    estilo: corto(raw.estilo, 20),
    formato: raw.formato === 'historia' ? 'historia' : 'cuadrado',
  };
  if (raw.letra) datos.letra = corto(raw.letra, 20);
  if (Array.isArray(raw.destacadas))
    datos.destacadas = [...new Set(raw.destacadas.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 400))].slice(0, 60);
  if (raw.dedicatoria && corto(raw.dedicatoria, 40)) datos.dedicatoria = corto(raw.dedicatoria, 40);
  if (raw.contexto && corto(raw.contexto, 110)) datos.contexto = corto(raw.contexto, 110);
  const o = raw.original as Json | undefined;
  if (o && typeof o === 'object' && o.palabra && o.glosa)
    datos.original = { palabra: corto(o.palabra, 40), translit: corto(o.translit, 40), glosa: corto(o.glosa, 40) };
  return datos;
}

function text(value: unknown, max: number, what: string) {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t) throw new Fail(`Escribe ${what}`);
  if (t.length > max) throw new Fail(`Es demasiado largo (máximo ${max} caracteres)`);
  return t;
}

function int(value: unknown, what: string, min = 1, max = 10_000) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Fail(`${what} no válido`);
  return n;
}

function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new Fail('Identificador no válido');
  return value;
}

/** La fecha local de la persona («hoy» depende de su zona horaria). */
function day(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value))) {
    throw new Fail('Fecha no válida');
  }
  return value;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** Un reto de temporada válido: del catálogo y de este año o los vecinos. */
function retoOf(id: unknown) {
  const parsed = typeof id === 'string' ? parseRetoId(id) : null;
  const def = parsed && planById(parsed.def);
  const year = new Date().getFullYear();
  if (!parsed || !def?.season || Math.abs(parsed.year - year) > 1) throw new Fail('Reto no válido');
  return { id: `${def.id}-${parsed.year}`, def, run: seasonRun(def, parsed.year) };
}

/** Los capítulos que tocan hoy según el plan del grupo. */
async function todaysReading(plan: Plan, today: string) {
  if (plan.reto) return retoReading(plan.reto, today);
  if (!plan.libro || !plan.inicio) return null;
  const book = await bookOf(plan.libro);
  const elapsed = daysBetween(plan.inicio, today);
  const total = Math.ceil(book.chapters / plan.porDia);
  if (elapsed < 0) return { libro: book.id, nombre: book.name, capitulos: [] as number[], estado: 'pronto', dia: 0, total };
  const first = elapsed * plan.porDia + 1;
  if (first > book.chapters) return { libro: book.id, nombre: book.name, capitulos: [], estado: 'terminado', dia: total, total };
  const capitulos = Array.from({ length: Math.min(plan.porDia, book.chapters - first + 1) }, (_, i) => first + i);
  return { libro: book.id, nombre: book.name, capitulos, estado: 'activo', dia: elapsed + 1, total };
}

/**
 * En un reto, la lectura de hoy es la de su fecha. Antes de empezar se anuncia la primera; los días sin
 * lectura (domingos de Cuaresma) son de descanso y cuenta cualquier capítulo que se lea.
 */
async function retoReading(id: string, today: string) {
  const { def, run } = retoOf(id);
  const total = run.dates.length;
  const at = (i: number) => def.spec[i] as [string, number];
  const index = run.dates.indexOf(today);
  const passed = run.dates.filter((d) => d <= today).length;
  const pick = today < run.start ? 0 : today > run.end ? total - 1 : index >= 0 ? index : passed;
  const [libro, capitulo] = at(Math.min(pick, total - 1));
  const book = await bookOf(libro);
  const base = { libro: book.id, nombre: book.name, total, reto: id };
  // `siguiente`: el capítulo con que empieza (o sigue tras el descanso), para anunciarlo
  if (today < run.start) return { ...base, capitulos: [] as number[], estado: 'pronto', dia: 0, siguiente: capitulo };
  if (today > run.end) return { ...base, capitulos: [], estado: 'terminado', dia: total };
  if (index === -1) return { ...base, capitulos: [], estado: 'descanso', dia: passed, siguiente: capitulo };
  return { ...base, capitulos: [capitulo], estado: 'activo', dia: index + 1 };
}

async function readPlan(body: Json): Promise<Plan> {
  const plan = (body.plan ?? null) as Json | null;
  if (plan?.reto) {
    const { id, run } = retoOf(plan.reto);
    return { libro: null, inicio: run.start, porDia: 1, reto: id };
  }
  if (!plan || !plan.libro) return { libro: null, inicio: null, porDia: 1, reto: null };
  const book = await bookOf(plan.libro);
  return { libro: book.id, inicio: day(plan.inicio), porDia: int(plan.porDia ?? 1, 'Ritmo', 1, 5), reto: null };
}

async function auth(sql: Sql, request: Request): Promise<User> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key) throw new Fail('Necesitas una cuenta', 401);
  const [user] = await sql.unsafe<User[]>(
    `select ${USER_COLUMNS} from sesiones s join usuarios u on u.id = s.usuario_id where s.llave_hash = $1`,
    [hash(key)],
  );
  if (!user) throw new Fail('Tu sesión terminó. Vuelve a entrar.', 401);
  return user;
}

async function profile(sql: Sql, id: string) {
  const [user] = await sql.unsafe<User[]>(`select ${USER_COLUMNS} from usuarios u where u.id = $1`, [id]);
  return user;
}

/** Un texto opcional del perfil: vacío se guarda como null. */
function optional(value: unknown, max: number) {
  const t = typeof value === 'string' ? value.trim().replace(/\n{3,}/g, '\n\n') : '';
  if (t.length > max) throw new Fail(`Es demasiado largo (máximo ${max} caracteres)`);
  return t || null;
}

/** Cambia la foto de perfil y borra la anterior. Hay un límite diario para no llenar el almacén. */
async function setPhoto(sql: Sql, userId: string, bytes: Uint8Array, type: NonNullable<ReturnType<typeof imageType>>) {
  const [ok] = await sql`
    update usuarios set fotos_n = case when fotos_dia = current_date then fotos_n + 1 else 1 end, fotos_dia = current_date
    where id = ${userId} and (fotos_dia is distinct from current_date or fotos_n < ${PHOTOS_PER_DAY}) returning id`;
  if (!ok) throw new Fail('Ya cambiaste la foto muchas veces hoy. Inténtalo mañana.', 429);
  let url: string;
  try {
    url = await storePhoto(userId, bytes, type);
  } catch (err) {
    console.error('perfil: foto', err);
    throw new Fail('No se pudo guardar la foto. Inténtalo de nuevo.', 503);
  }
  const [old] = await sql<{ foto: string | null }[]>`
    update usuarios u set foto = ${url} from usuarios o where u.id = ${userId} and o.id = u.id returning o.foto`;
  await removePhoto(old?.foto ?? null);
}

/** La cookie que ata el viaje a Google, Apple o Facebook al navegador donde la persona lo hace. */
const VIAJE_COOKIE = 'zarza-viaje';
const cookieOf = (request: Request, name: string) =>
  request.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;

async function membership(sql: Sql, user: User, groupId: unknown) {
  const id = uuid(groupId);
  const [row] = await sql<{ rol: string }[]>`select rol from miembros where grupo_id = ${id} and usuario_id = ${user.id}`;
  if (!row) throw new Fail('No perteneces a este grupo', 403);
  return { id, admin: row.rol === 'admin' };
}

/** Quién leyó lo de hoy: los capítulos del plan (aunque los leyera antes) o, sin plan, cualquier capítulo hoy. */
async function readToday(sql: Sql, groupId: string, reading: Awaited<ReturnType<typeof todaysReading>>, today: string) {
  const rows = reading?.capitulos.length
    ? await sql<{ usuario_id: string }[]>`
        select l.usuario_id from lecturas l join miembros m on m.usuario_id = l.usuario_id and m.grupo_id = ${groupId}
        where l.libro = ${reading.libro} and l.capitulo = any(${reading.capitulos})
        group by l.usuario_id having count(distinct l.capitulo) = ${reading.capitulos.length}`
    : await sql<{ usuario_id: string }[]>`
        select distinct l.usuario_id from lecturas l join miembros m on m.usuario_id = l.usuario_id and m.grupo_id = ${groupId}
        where l.dia = ${today}`;
  return new Set(rows.map((r) => r.usuario_id));
}

/**
 * Meta de la semana en compañía: cada persona aporta hasta 5 días con lectura (la misma meta flexible
 * de la racha personal) y el grupo ve cuántos de esos días llevan entre todos. Sin rankings.
 */
async function weekMeter(sql: Sql, groupId: string, members: number, today: string) {
  const d = new Date(`${today}T00:00:00Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  const [{ dias }] = await sql<{ dias: number }[]>`
    select coalesce(sum(least(n, ${WEEKLY_GOAL})), 0)::int as dias from (
      select count(distinct l.dia) as n from lecturas l join miembros m on m.usuario_id = l.usuario_id and m.grupo_id = ${groupId}
      where l.dia between ${monday} and ${today} group by l.usuario_id) t`;
  return { dias, meta: members * WEEKLY_GOAL };
}

type GroupRow = {
  id: string;
  nombre: string;
  tipo: string;
  codigo: string;
  plan_libro: string | null;
  plan_inicio: string | null;
  plan_por_dia: number;
  plan_reto: string | null;
};

const planOf = (g: GroupRow): Plan => ({ libro: g.plan_libro, inicio: g.plan_inicio, porDia: g.plan_por_dia, reto: g.plan_reto });

async function summary(sql: Sql, g: GroupRow, today: string) {
  const reading = await todaysReading(planOf(g), today);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from miembros where grupo_id = ${g.id}`;
  const read = await readToday(sql, g.id, reading, today);
  return { id: g.id, nombre: g.nombre, tipo: g.tipo, miembros: n, leyeronHoy: read.size, lectura: reading };
}

const GROUP_COLUMNS = 'g.id, g.nombre, g.tipo, g.codigo, g.plan_libro, to_char(g.plan_inicio, \'YYYY-MM-DD\') as plan_inicio, g.plan_por_dia, g.plan_reto';

async function getGroup(sql: Sql, id: string) {
  const [g] = await sql.unsafe<GroupRow[]>(`select ${GROUP_COLUMNS} from grupos g where g.id = $1`, [id]);
  if (!g) throw new Fail('El grupo ya no existe', 404);
  return g;
}

async function insertGroupWithCode(sql: Sql, fields: Omit<GroupRow, 'id' | 'codigo'>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await sql<{ id: string }[]>`
      insert into grupos (nombre, tipo, codigo, plan_libro, plan_inicio, plan_por_dia, plan_reto)
      values (${fields.nombre}, ${fields.tipo}, ${newCode()}, ${fields.plan_libro}, ${fields.plan_inicio}, ${fields.plan_por_dia}, ${fields.plan_reto})
      on conflict (codigo) do nothing returning id`;
    if (row) return row.id;
  }
  throw new Fail('No se pudo crear el grupo, inténtalo de nuevo', 500);
}

async function passageText(book: Book, chapter: number) {
  const verses = JSON.parse(
    await readFile(path.join(DATA_DIR, 'text', 'rv1909', book.id, `${chapter}.json`), 'utf8'),
  ) as Verse[];
  return verses.map(([n, t]) => `${n} ${t}`).join('\n');
}

let anthropic: Anthropic | null = null;

async function suggestQuestions(book: Book, chapter: number) {
  anthropic ??= new Anthropic();
  const passage = await passageText(book, chapter);
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: QUESTIONS_SYSTEM,
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: `Pasaje para la reunión: ${book.name} ${chapter} (Reina-Valera 1909)\n\n${passage}\n\nPropón las preguntas.`,
      },
    ],
  });
  if (response.stop_reason === 'refusal') throw new Fail('No se pudieron sugerir preguntas para este pasaje.', 502);
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

// --- Comunidad: amigos y publicaciones ---

type Relation = 'yo' | 'amigos' | 'enviada' | 'recibida' | 'bloqueada' | null;

/** Hay un bloqueo entre las dos personas, en cualquier dirección (`other` es un id o una columna de la consulta). */
const blocked = (sql: Sql, me: string, other: Fragment | string) => sql`
  exists (select 1 from bloqueos b where (b.de = ${me} and b.a = ${other}) or (b.de = ${other} and b.a = ${me}))`;

/** Ids de los amigos de la persona (amistades aceptadas, en cualquier dirección). */
const friendIds = (sql: Sql, me: string) => sql`
  select case when de = ${me} then para else de end from amistades where aceptada and (de = ${me} or para = ${me})`;

/** Lo que una persona puede ver: lo suyo, lo de sus amigos y lo público que no se ha reportado de más. */
const visible = (sql: Sql, me: string) => sql`
  (p.usuario_id = ${me}
    or p.usuario_id in (${friendIds(sql, me)})
    or (p.audiencia = 'todos' and (select count(*) from reportes r where r.publicacion_id = p.id) < ${REPORTS_TO_HIDE}))
  and not exists (select 1 from reportes r where r.publicacion_id = p.id and r.usuario_id = ${me})
  and not ${blocked(sql, me, sql`p.usuario_id`)}`;

type PostRow = { id: string; libro: string | null; mia: boolean } & Json;
type Fragment = postgres.PendingQuery<postgres.Row[]>;

async function posts(sql: Sql, me: string, where: Fragment, limit = PAGE) {
  const rows = await sql<PostRow[]>`
    select p.id, p.tipo, p.audiencia, p.libro, p.capitulo, p.versiculo, p.version, p.cita, p.texto, p.datos,
      p.creado, p.actualizado, u.id as "autorId", u.nombre as autor, u.foto as "autorFoto", ${sql.unsafe(RACHA)} as "autorRacha", p.usuario_id = ${me} as mia,
      (select count(*)::int from me_gusta g where g.publicacion_id = p.id) as "meGusta",
      exists (select 1 from me_gusta g where g.publicacion_id = p.id and g.usuario_id = ${me}) as "yoMeGusta",
      (select count(*)::int from comentarios c where c.publicacion_id = p.id) as comentarios
    from publicaciones p join usuarios u on u.id = p.usuario_id
    where ${visible(sql, me)} and ${where}
    order by p.actualizado desc limit ${limit}`;
  const all = await books();
  return rows.map((r) => ({ ...r, libroNombre: all.find((b) => b.id === r.libro)?.name ?? null }));
}

async function visiblePost(sql: Sql, me: string, id: unknown) {
  const [post] = await posts(sql, me, sql`p.id = ${uuid(id)}`, 1);
  if (!post) throw new Fail('Esta publicación ya no existe', 404);
  return post;
}

async function relation(sql: Sql, me: string, other: string): Promise<Relation> {
  if (me === other) return 'yo';
  const [block] = await sql`select 1 from bloqueos where de = ${me} and a = ${other}`;
  if (block) return 'bloqueada';
  const rows = await sql<{ de: string; aceptada: boolean }[]>`
    select de, aceptada from amistades where (de = ${me} and para = ${other}) or (de = ${other} and para = ${me})`;
  if (rows.some((r) => r.aceptada)) return 'amigos';
  if (rows.some((r) => r.de === me)) return 'enviada';
  if (rows.length) return 'recibida';
  return null;
}

/** El código para que otros te agreguen como amigo; se crea la primera vez que se pide. */
async function friendCode(sql: Sql, userId: string) {
  const [row] = await sql<{ codigo: string | null }[]>`select codigo from usuarios where id = ${userId}`;
  if (row?.codigo) return row.codigo;
  for (let attempt = 0; attempt < 5; attempt++) {
    const codigo = newCode();
    const rows = await sql`
      update usuarios set codigo = ${codigo} where id = ${userId} and codigo is null
      and not exists (select 1 from usuarios where codigo = ${codigo}) returning id`;
    if (rows.length) return codigo;
  }
  throw new Fail('No se pudo crear tu código, inténtalo de nuevo', 500);
}

async function personByCode(sql: Sql, code: unknown) {
  const clean = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const [p] = await sql<{ id: string; nombre: string; foto: string | null }[]>`select id, nombre, foto from usuarios where codigo = ${clean}`;
  if (!p) throw new Fail('Ese código de amistad no existe', 404);
  return p;
}

/** Freno para que nadie llene la comunidad de mensajes. */
async function tooMany(sql: Sql, table: 'publicaciones' | 'comentarios', userId: string, max: number) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from ${sql(table)} where usuario_id = ${userId} and creado > now() - interval '1 hour'`;
  if (n >= max) throw new Fail('Has publicado mucho en poco tiempo. Vuelve a intentarlo en un rato.', 429);
}

/** Lo que se leyó hoy aparece en el muro de los amigos: una publicación por libro y día que va sumando capítulos. */
async function shareReading(sql: Sql, userId: string, book: Book, chapter: number, today: string) {
  const [{ compartir }] = await sql<{ compartir: boolean }[]>`
    select compartir_lecturas as compartir from usuarios where id = ${userId}`;
  if (!compartir) return;
  const key = `lectura:${today}:${book.id}`;
  const [row] = await sql<{ id: string; datos: { capitulos?: number[] } }[]>`
    select id, datos from publicaciones where usuario_id = ${userId} and clave = ${key}`;
  if (!row) {
    await sql`
      insert into publicaciones (usuario_id, tipo, audiencia, libro, datos, clave)
      values (${userId}, 'lectura', 'amigos', ${book.id}, ${sql.json({ capitulos: [chapter] })}, ${key})
      on conflict (usuario_id, clave) do nothing`;
    return;
  }
  const chapters = row.datos.capitulos ?? [];
  if (chapters.includes(chapter)) return;
  const capitulos = [...chapters, chapter].sort((a, b) => a - b);
  await sql`update publicaciones set datos = ${sql.json({ capitulos })}, actualizado = now() where id = ${row.id}`;
}

const GROUP_TYPES = ['iglesia', 'celula', 'familia', 'amigos'];

type Handler = (ctx: { sql: Sql; body: Json; request: Request }) => Promise<Json>;

const actions: Record<string, Handler> = {
  async registrarse({ sql, body }) {
    const nombre = text(body.nombre, MAX_NAME, 'tu nombre');
    // El correo y la contraseña son opcionales: sin ellos la cuenta vive solo en este dispositivo.
    const correo = body.correo ? email(body.correo) : null;
    const clave = correo ? await hashPassword(password(body.clave)) : null;
    if (correo) {
      const [taken] = await sql`select 1 from usuarios where correo = ${correo}`;
      if (taken) throw new Fail('Ese correo ya tiene una cuenta. Entra con él.', 409);
    }
    const [{ id }] = await sql<{ id: string }[]>`
      insert into usuarios (nombre, correo, clave_hash) values (${nombre}, ${correo}, ${clave}) returning id`;
    return { usuario: await profile(sql, id), llave: await newSession(sql, id) };
  },

  async protegerCuenta({ sql, body, request }) {
    const user = await auth(sql, request);
    const correo = email(body.correo);
    const clave = password(body.clave);
    const [taken] = await sql`select 1 from usuarios where correo = ${correo} and id <> ${user.id}`;
    if (taken) throw new Fail('Ese correo ya tiene una cuenta. Entra con él desde «Ya tengo cuenta».', 409);
    await sql`update usuarios set correo = ${correo}, clave_hash = ${await hashPassword(clave)} where id = ${user.id}`;
    return { usuario: { ...user, correo, conClave: true } };
  },

  async entrar({ sql, body }) {
    const correo = email(body.correo);
    const [row] = await sql<{ id: string; clave_hash: string | null; proveedor: Proveedor | null }[]>`
      select u.id, u.clave_hash, (select proveedor from cuentas_externas c where c.usuario_id = u.id order by creado limit 1) as proveedor
      from usuarios u where u.correo = ${correo}`;
    const ok = row ? await checkPassword(String(body.clave ?? ''), row.clave_hash) : false;
    if (!row || !ok) {
      await new Promise((r) => setTimeout(r, 400));
      if (row && !row.clave_hash && row.proveedor) {
        throw new Fail(`Esta cuenta entra con ${NOMBRE[row.proveedor]}: toca «Continuar con ${NOMBRE[row.proveedor]}».`, 401);
      }
      throw new Fail('El correo o la contraseña no son correctos', 401);
    }
    return { usuario: await profile(sql, row.id), llave: await newSession(sql, row.id) };
  },

  async salirCuenta({ sql, request }) {
    const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (key) await sql`delete from sesiones where llave_hash = ${hash(key)}`;
    return {};
  },

  async yo({ sql, body, request }) {
    const user = await auth(sql, request);
    const today = day(body.hoy);
    const groups = await sql.unsafe<(GroupRow & { rol: string; avisos: boolean })[]>(
      `select ${GROUP_COLUMNS}, m.rol, m.avisos from grupos g join miembros m on m.grupo_id = g.id
       where m.usuario_id = $1 order by m.unido`,
      [user.id],
    );
    const anfitriona = await iglesiaDe(sql, user.id);
    return {
      usuario: user,
      grupos: await Promise.all(
        groups.map(async (g) => ({ ...(await summary(sql, g, today)), soyAdmin: g.rol === 'admin', avisos: g.avisos })),
      ),
      // La iglesia anfitriona (api/_iglesias.ts) y si la persona cuida Zarza (/cuidar).
      iglesia: anfitriona?.activa ? { nombre: anfitriona.nombre, codigo: anfitriona.codigo, lampara: anfitriona.lampara } : null,
      cuidador: esCuidador(user.correo),
    };
  },

  async renombrarme({ sql, body, request }) {
    const user = await auth(sql, request);
    const nombre = text(body.nombre, MAX_NAME, 'tu nombre');
    await sql`update usuarios set nombre = ${nombre} where id = ${user.id}`;
    return { usuario: { ...user, nombre } };
  },

  async guardarPerfil({ sql, body, request }) {
    const user = await auth(sql, request);
    const nombre = text(body.nombre, MAX_NAME, 'tu nombre');
    const bio = optional(body.bio, MAX_BIO);
    const iglesia = optional(body.iglesia, MAX_PLACE);
    const ciudad = optional(body.ciudad, MAX_PLACE);
    // Una app vieja no manda el apodo: entonces se queda el que había.
    const apodo = body.apodo === undefined ? user.apodo : optional(body.apodo, MAX_APODO);
    await sql`update usuarios set nombre = ${nombre}, bio = ${bio}, iglesia = ${iglesia}, ciudad = ${ciudad}, apodo = ${apodo} where id = ${user.id}`;
    return { usuario: { ...user, nombre, bio, iglesia, ciudad, apodo } };
  },

  async subirFoto({ sql, body, request }) {
    const user = await auth(sql, request);
    const raw = typeof body.imagen === 'string' ? body.imagen.replace(/^data:[^,]*,/, '') : '';
    const bytes = new Uint8Array(Buffer.from(raw, 'base64'));
    if (bytes.length > MAX_PHOTO_BYTES) throw new Fail('La foto es demasiado grande');
    const type = bytes.length ? imageType(bytes) : null;
    if (!type) throw new Fail('Elige una foto (JPG, PNG o WebP)');
    await setPhoto(sql, user.id, bytes, type);
    return { usuario: await profile(sql, user.id) };
  },

  async quitarFoto({ sql, request }) {
    const user = await auth(sql, request);
    await sql`update usuarios set foto = null where id = ${user.id}`;
    await removePhoto(user.foto);
    return { usuario: { ...user, foto: null } };
  },

  /** Con qué proveedores se puede entrar (los que tienen sus claves en el servidor). */
  async proveedores() {
    return proveedoresListos();
  },

  /**
   * Empieza el viaje a Google, Apple o Facebook: modo «entrar» (sin cuenta, o para crear una) o «conectar» (desde el
   * perfil). Devuelve la dirección que abre la app (lleva un pase de un solo uso) y el estado, que solo conoce la app,
   * con el que pregunta después por proveedorResultado. Así funciona igual en la web y en la app nativa.
   */
  async proveedorInicio({ sql, body, request }) {
    const proveedor = body.proveedor;
    if (!esProveedor(proveedor) || !proveedoresListos()[proveedor]) throw new Fail('Esa forma de entrar todavía no está disponible.', 503);
    const modo = body.modo === 'conectar' ? 'conectar' : 'entrar';
    const user = modo === 'conectar' ? await auth(sql, request) : null;
    const estado = randomBytes(24).toString('base64url');
    const pase = randomBytes(24).toString('base64url');
    await sql`delete from viajes_cuenta where creado < now() - make_interval(mins => ${VIAJE_MINUTOS})`;
    await sql`
      insert into viajes_cuenta (estado_hash, pase_hash, proveedor, modo, nativo, usuario_id)
      values (${hash(estado)}, ${hash(pase)}, ${proveedor}, ${modo}, ${body.nativo === true}, ${user?.id ?? null})`;
    return { url: new URL(`/api/auth/ir?pase=${pase}`, request.url).toString(), estado };
  },

  /** Lo que pasó en el proveedor: pendiente mientras la persona sigue allí; al entrar, la llave de la sesión nueva. */
  async proveedorResultado({ sql, body }) {
    const estado = typeof body.estado === 'string' ? body.estado : '';
    if (!estado) throw new Fail('Vuelve a intentarlo desde este dispositivo.', 403);
    const [trip] = await sql<{ proveedor: Proveedor; modo: string; usuario_id: string | null; resultado: string }[]>`
      select proveedor, modo, usuario_id, resultado from viajes_cuenta
      where estado_hash = ${hash(estado)} and creado > now() - make_interval(mins => ${VIAJE_MINUTOS})`;
    if (!trip) throw new Fail('Pasó demasiado tiempo. Vuelve a intentarlo.', 410);
    if (trip.resultado === 'pendiente') return { pendiente: true };
    await sql`delete from viajes_cuenta where estado_hash = ${hash(estado)}`;
    const error = mensajeViaje(trip.proveedor, trip.resultado);
    if (error) throw new Fail(error, 409);
    const usuario = await profile(sql, trip.usuario_id!);
    if (!usuario) throw new Fail('Esa cuenta ya no existe', 404);
    return trip.modo === 'entrar' ? { usuario, llave: await newSession(sql, usuario.id) } : { usuario };
  },

  async desconectarProveedor({ sql, body, request }) {
    const user = await auth(sql, request);
    const proveedor = body.proveedor;
    if (!esProveedor(proveedor)) throw new Fail('Proveedor no válido');
    // Siempre debe quedar una forma de volver a entrar.
    if (!user.conClave && user.cuentas.filter((c) => c.proveedor !== proveedor).length === 0) {
      throw new Fail(`Antes de desconectar ${NOMBRE[proveedor]}, añade un correo y una contraseña o conecta otra cuenta para poder volver a entrar.`, 409);
    }
    await sql`delete from cuentas_externas where usuario_id = ${user.id} and proveedor = ${proveedor}`;
    return { usuario: { ...user, cuentas: user.cuentas.filter((c) => c.proveedor !== proveedor) } };
  },

  async borrarCuenta({ sql, request }) {
    const user = await auth(sql, request);
    await removePhoto(user.foto);
    const groups = await sql<{ grupo_id: string }[]>`select grupo_id from miembros where usuario_id = ${user.id}`;
    for (const { grupo_id } of groups) await leave(sql, grupo_id, user.id);
    await sql`update suscripciones set usuario_id = null where usuario_id = ${user.id}`;
    await sql`delete from usuarios where id = ${user.id}`;
    return {};
  },

  /** La app cuenta la racha devocional y la pone al día aquí, para el aro de luz de la foto de perfil. */
  async racha({ sql, body, request }) {
    const user = await auth(sql, request);
    const dias = Number.isInteger(body.dias) && (body.dias as number) >= 0 ? Math.min(body.dias as number, 100_000) : 0;
    const vence = typeof body.vence === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.vence) && !isNaN(Date.parse(body.vence)) ? body.vence : null;
    await sql`update usuarios set racha = ${vence ? dias : 0}, racha_vence = ${vence} where id = ${user.id}`;
    return {};
  },

  async leido({ sql, body, request }) {
    const user = await auth(sql, request);
    const book = await bookOf(body.libro);
    const chapter = int(body.capitulo, 'Capítulo', 1, book.chapters);
    const today = day(body.hoy);
    await sql`
      insert into lecturas (usuario_id, libro, capitulo, dia) values (${user.id}, ${book.id}, ${chapter}, ${today})
      on conflict do nothing`;
    await shareReading(sql, user.id, book, chapter, today);
    return {};
  },

  async crearGrupo({ sql, body, request }) {
    const user = await auth(sql, request);
    const nombre = text(body.nombre, 60, 'el nombre del grupo');
    const tipo = GROUP_TYPES.includes(body.tipo as string) ? (body.tipo as string) : 'amigos';
    const plan = await readPlan(body);
    const id = await insertGroupWithCode(sql, {
      nombre,
      tipo,
      plan_libro: plan.libro,
      plan_inicio: plan.inicio,
      plan_por_dia: plan.porDia,
      plan_reto: plan.reto,
    });
    await sql`insert into miembros (grupo_id, usuario_id, rol) values (${id}, ${user.id}, 'admin')`;
    return { id };
  },

  async verInvitacion({ sql, body }) {
    const code = String(body.codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const [g] = await sql<{ id: string; nombre: string; tipo: string; miembros: number }[]>`
      select g.id, g.nombre, g.tipo, (select count(*)::int from miembros m where m.grupo_id = g.id) as miembros
      from grupos g where g.codigo = ${code}`;
    if (!g) throw new Fail('Ese código de invitación no existe o ya cambió', 404);
    return { grupo: { nombre: g.nombre, tipo: g.tipo, miembros: g.miembros } };
  },

  async unirse({ sql, body, request }) {
    const user = await auth(sql, request);
    const code = String(body.codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const [g] = await sql<{ id: string }[]>`select id from grupos where codigo = ${code}`;
    if (!g) throw new Fail('Ese código de invitación no existe o ya cambió', 404);
    const joined = await sql`
      insert into miembros (grupo_id, usuario_id) values (${g.id}, ${user.id}) on conflict do nothing returning 1`;
    if (joined.length) await avisarUnion(sql, g.id, user);
    return { id: g.id };
  },

  async grupo({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id, admin } = await membership(sql, user, body.grupo);
    const today = day(body.hoy);
    const g = await getGroup(sql, id);
    const reading = await todaysReading(planOf(g), today);
    const read = await readToday(sql, id, reading, today);
    const members = await sql<{ id: string; nombre: string; foto: string | null; rol: string }[]>`
      select u.id, u.nombre, u.foto, ${sql.unsafe(RACHA)} as racha, m.rol from miembros m join usuarios u on u.id = m.usuario_id
      where m.grupo_id = ${id} order by m.rol = 'admin' desc, m.unido`;
    return {
      grupo: {
        id,
        nombre: g.nombre,
        tipo: g.tipo,
        codigo: g.codigo,
        plan: planOf(g),
        lectura: reading,
        soyAdmin: admin,
        avisos: await groupAlerts(sql, id, user.id),
        semana: await weekMeter(sql, id, members.length, today),
        miembros: members.map((m) => ({ ...m, leyoHoy: read.has(m.id), soyYo: m.id === user.id })),
      },
    };
  },

  async editarGrupo({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id, admin } = await membership(sql, user, body.grupo);
    if (!admin) throw new Fail('Solo quien administra el grupo puede cambiarlo', 403);
    const nombre = text(body.nombre, 60, 'el nombre del grupo');
    const tipo = GROUP_TYPES.includes(body.tipo as string) ? (body.tipo as string) : 'amigos';
    const plan = await readPlan(body);
    await sql`
      update grupos set nombre = ${nombre}, tipo = ${tipo}, plan_libro = ${plan.libro},
        plan_inicio = ${plan.inicio}, plan_por_dia = ${plan.porDia}, plan_reto = ${plan.reto}
      where id = ${id}`;
    return {};
  },

  async nuevoCodigo({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id, admin } = await membership(sql, user, body.grupo);
    if (!admin) throw new Fail('Solo quien administra el grupo puede cambiar la invitación', 403);
    for (let attempt = 0; attempt < 5; attempt++) {
      const codigo = newCode();
      const rows = await sql`
        update grupos set codigo = ${codigo} where id = ${id}
        and not exists (select 1 from grupos where codigo = ${codigo}) returning id`;
      if (rows.length) return { codigo };
    }
    throw new Fail('No se pudo cambiar el código, inténtalo de nuevo', 500);
  },

  async salir({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id, admin } = await membership(sql, user, body.grupo);
    const target = body.usuario ? uuid(body.usuario) : user.id;
    if (target !== user.id && !admin) throw new Fail('Solo quien administra el grupo puede quitar a alguien', 403);
    await leave(sql, id, target);
    return {};
  },

  /** Silencia o vuelve a encender los avisos de un grupo para esta persona (sigue dentro del grupo). */
  async avisosGrupo({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id } = await membership(sql, user, body.grupo);
    await sql`update miembros set avisos = ${body.si !== false} where grupo_id = ${id} and usuario_id = ${user.id}`;
    return { avisos: body.si !== false };
  },

  async hacerAdmin({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id, admin } = await membership(sql, user, body.grupo);
    if (!admin) throw new Fail('Solo quien administra el grupo puede hacerlo', 403);
    await sql`update miembros set rol = 'admin' where grupo_id = ${id} and usuario_id = ${uuid(body.usuario)}`;
    return {};
  },

  async notas({ sql, body, request }) {
    const user = await auth(sql, request);
    const ids = body.grupo
      ? [(await membership(sql, user, body.grupo)).id]
      : (await sql<{ grupo_id: string }[]>`select grupo_id from miembros where usuario_id = ${user.id}`).map(
          (r) => r.grupo_id,
        );
    const book = body.libro ? await bookOf(body.libro) : null;
    const chapter = book ? int(body.capitulo, 'Capítulo', 1, book.chapters) : null;
    const verse = book && body.versiculo ? int(body.versiculo, 'Versículo', 1, 200) : null;
    const notes = await sql`
      select n.id, n.grupo_id as grupo, g.nombre as "grupoNombre", n.libro, n.capitulo, n.versiculo, n.texto, n.creado,
        u.nombre as autor, n.usuario_id = ${user.id} as mia
      from notas n join usuarios u on u.id = n.usuario_id join grupos g on g.id = n.grupo_id
      where n.grupo_id = any(${ids})
        ${book ? sql`and n.libro = ${book.id} and n.capitulo = ${chapter}` : sql``}
        ${verse ? sql`and n.versiculo = ${verse}` : sql``}
      order by n.creado desc limit 100`;
    return { notas: notes };
  },

  async nuevaNota({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id } = await membership(sql, user, body.grupo);
    const book = await bookOf(body.libro);
    const chapter = int(body.capitulo, 'Capítulo', 1, book.chapters);
    const verse = int(body.versiculo, 'Versículo', 1, 200);
    const texto = text(body.texto, MAX_NOTE, 'la nota');
    const [row] = await sql<{ id: string }[]>`
      insert into notas (grupo_id, usuario_id, libro, capitulo, versiculo, texto)
      values (${id}, ${user.id}, ${book.id}, ${chapter}, ${verse}, ${texto}) returning id`;
    await avisarGrupo(sql, id, user, (grupo) => ({
      title: `${user.nombre} dejó una nota en ${book.name} ${chapter}:${verse}`,
      body: `${grupo} · ${texto.slice(0, 120)}`,
      url: `/grupos/${id}?tab=notas`,
      tag: `grupo-notas-${id}`,
    }));
    return { id: row.id };
  },

  async borrarNota({ sql, body, request }) {
    const user = await auth(sql, request);
    const [note] = await sql<{ grupo_id: string; usuario_id: string }[]>`
      select grupo_id, usuario_id from notas where id = ${uuid(body.nota)}`;
    if (!note) return {};
    const { admin } = await membership(sql, user, note.grupo_id);
    if (note.usuario_id !== user.id && !admin) throw new Fail('Solo puedes borrar tus notas', 403);
    await sql`delete from notas where id = ${uuid(body.nota)}`;
    return {};
  },

  async peticiones({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id } = await membership(sql, user, body.grupo);
    const rows = await sql`
      select p.id, p.texto, p.respondida, p.creado, u.nombre as autor, p.usuario_id = ${user.id} as mia,
        (select count(*)::int from orando o where o.peticion_id = p.id) as orando,
        exists (select 1 from orando o where o.peticion_id = p.id and o.usuario_id = ${user.id}) as "yoOrando"
      from peticiones p join usuarios u on u.id = p.usuario_id
      where p.grupo_id = ${id}
      order by p.respondida, p.creado desc limit 100`;
    return { peticiones: rows };
  },

  async nuevaPeticion({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id } = await membership(sql, user, body.grupo);
    const texto = text(body.texto, MAX_PRAYER, 'la petición');
    const [row] = await sql<{ id: string }[]>`
      insert into peticiones (grupo_id, usuario_id, texto) values (${id}, ${user.id}, ${texto}) returning id`;
    await avisarGrupo(sql, id, user, (grupo) => ({
      title: `${user.nombre} pidió oración en ${grupo}`,
      body: texto.slice(0, 140),
      url: `/grupos/${id}?tab=oracion`,
      tag: `grupo-oracion-${id}`,
    }));
    return { id: row.id };
  },

  async orar({ sql, body, request }) {
    const user = await auth(sql, request);
    const petitionId = uuid(body.peticion);
    const [p] = await sql<{ grupo_id: string }[]>`select grupo_id from peticiones where id = ${petitionId}`;
    if (!p) throw new Fail('La petición ya no existe', 404);
    await membership(sql, user, p.grupo_id);
    if (body.orando === false) {
      await sql`delete from orando where peticion_id = ${petitionId} and usuario_id = ${user.id}`;
    } else {
      await sql`insert into orando (peticion_id, usuario_id) values (${petitionId}, ${user.id}) on conflict do nothing`;
    }
    return {};
  },

  async editarPeticion({ sql, body, request }) {
    const user = await auth(sql, request);
    const petitionId = uuid(body.peticion);
    const [p] = await sql<{ grupo_id: string; usuario_id: string }[]>`
      select grupo_id, usuario_id from peticiones where id = ${petitionId}`;
    if (!p) return {};
    const { admin } = await membership(sql, user, p.grupo_id);
    if (p.usuario_id !== user.id && !admin) throw new Fail('Solo quien la compartió puede cambiarla', 403);
    if (body.borrar) await sql`delete from peticiones where id = ${petitionId}`;
    else await sql`update peticiones set respondida = ${Boolean(body.respondida)} where id = ${petitionId}`;
    return {};
  },

  // Hoja del participante de un encuentro preparado en el Taller (sin las notas del líder).
  async compartirGuia({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id } = await membership(sql, user, body.grupo);
    const titulo = text(body.titulo, 120, 'el título');
    const texto = text(body.texto, MAX_GUIDE, 'la guía');
    const pasaje = typeof body.pasaje === 'string' ? body.pasaje.trim().slice(0, 60) || null : null;
    const [row] = await sql<{ id: string }[]>`
      insert into guias (grupo_id, usuario_id, titulo, pasaje, texto)
      values (${id}, ${user.id}, ${titulo}, ${pasaje}, ${texto}) returning id`;
    await avisarGrupo(sql, id, user, (grupo) => ({
      title: `${user.nombre} compartió «${titulo}» con ${grupo}`,
      body: pasaje ? `${pasaje} · Ábrelo para prepararte para la reunión.` : 'Ábrelo para prepararte para la reunión.',
      url: `/grupos/${id}?tab=reunion`,
      tag: `grupo-guia-${id}`,
    }));
    return { id: row.id };
  },

  async guias({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id } = await membership(sql, user, body.grupo);
    const rows = await sql`
      select g.id, g.titulo, g.pasaje, g.texto, g.creado, u.nombre as autor, g.usuario_id = ${user.id} as mia
      from guias g join usuarios u on u.id = g.usuario_id
      where g.grupo_id = ${id} order by g.creado desc limit 20`;
    return { guias: rows };
  },

  async borrarGuia({ sql, body, request }) {
    const user = await auth(sql, request);
    const guideId = uuid(body.guia);
    const [g] = await sql<{ grupo_id: string; usuario_id: string }[]>`select grupo_id, usuario_id from guias where id = ${guideId}`;
    if (!g) return {};
    const { admin } = await membership(sql, user, g.grupo_id);
    if (g.usuario_id !== user.id && !admin) throw new Fail('Solo quien la compartió puede borrarla', 403);
    await sql`delete from guias where id = ${guideId}`;
    return {};
  },

  async preguntas({ sql, body, request }) {
    const user = await auth(sql, request);
    const { id } = await membership(sql, user, body.grupo);
    const book = await bookOf(body.libro);
    const chapter = int(body.capitulo, 'Capítulo', 1, book.chapters);
    if (!body.nuevas) {
      const [cached] = await sql<{ texto: string }[]>`
        select texto from preguntas where grupo_id = ${id} and libro = ${book.id} and capitulo = ${chapter}`;
      if (cached) return { texto: cached.texto };
    }
    const [{ n }] = await sql<{ n: number }[]>`
      insert into uso_ia (grupo_id, dia, n) values (${id}, ${day(body.hoy)}, 1)
      on conflict (grupo_id, dia) do update set n = uso_ia.n + 1 returning n`;
    if (n > AI_PER_DAY) throw new Fail('El grupo ya pidió muchas preguntas hoy. Vuelve a intentarlo mañana.', 429);
    const texto = await suggestQuestions(book, chapter);
    await sql`
      insert into preguntas (grupo_id, libro, capitulo, texto) values (${id}, ${book.id}, ${chapter}, ${texto})
      on conflict (grupo_id, libro, capitulo) do update set texto = excluded.texto, creado = now()`;
    return { texto };
  },
  // --- Comunidad ---

  async muro({ sql, body, request }) {
    const user = await auth(sql, request);
    const where: Fragment = body.filtro === 'todos' ? sql`true` : sql`(p.usuario_id = ${user.id} or p.usuario_id in (${friendIds(sql, user.id)}))`;
    const before = typeof body.antes === 'string' && !isNaN(Date.parse(body.antes)) ? body.antes : null;
    return { publicaciones: await posts(sql, user.id, before ? sql`${where} and p.actualizado < ${before}` : where) };
  },

  async publicacion({ sql, body, request }) {
    const user = await auth(sql, request);
    const post = await visiblePost(sql, user.id, body.id);
    const comentarios = await sql`
      select c.id, c.texto, c.creado, u.id as "autorId", u.nombre as autor, u.foto as "autorFoto", ${sql.unsafe(RACHA)} as "autorRacha",
        c.usuario_id = ${user.id} as mio
      from comentarios c join usuarios u on u.id = c.usuario_id
      where c.publicacion_id = ${post.id} and not ${blocked(sql, user.id, sql`c.usuario_id`)}
      order by c.creado limit 200`;
    return { publicacion: post, comentarios };
  },

  async publicar({ sql, body, request }) {
    const user = await auth(sql, request);
    const tipo = String(body.tipo);
    if (!POST_TYPES.includes(tipo)) throw new Fail('Tipo de publicación no válido');
    const audiencia = body.audiencia === 'todos' ? 'todos' : 'amigos';
    const needsVerse = tipo === 'resaltado' || tipo === 'imagen';
    const book = body.libro || needsVerse ? await bookOf(body.libro) : null;
    const chapter = book ? int(body.capitulo, 'Capítulo', 1, book.chapters) : null;
    const verse = book ? int(body.versiculo, 'Versículo', 1, 200) : null;
    const quote = book ? await verseText(body.version, book, chapter!, verse!) : null;
    const texto = needsVerse
      ? body.texto && String(body.texto).trim()
        ? text(body.texto, MAX_POST, 'lo que quieres decir')
        : null
      : text(body.texto, MAX_POST, tipo === 'pregunta' ? 'tu pregunta' : 'lo que quieres compartir');
    const raw = (body.datos ?? {}) as Json;
    const datos =
      tipo === 'resaltado'
        ? { color: HIGHLIGHTS.includes(raw.color as string) ? raw.color : 'amarillo' }
        : tipo === 'imagen'
          ? datosDeImagen(raw)
          : {};
    await tooMany(sql, 'publicaciones', user.id, POSTS_PER_HOUR);
    const [row] = await sql<{ id: string }[]>`
      insert into publicaciones (usuario_id, tipo, audiencia, libro, capitulo, versiculo, version, cita, texto, datos)
      values (${user.id}, ${tipo}, ${audiencia}, ${book?.id ?? null}, ${chapter}, ${verse}, ${quote?.version ?? null},
        ${quote?.cita ?? null}, ${texto}, ${sql.json(datos as postgres.JSONValue)})
      returning id`;
    return { id: row.id };
  },

  async borrarPublicacion({ sql, body, request }) {
    const user = await auth(sql, request);
    await sql`delete from publicaciones where id = ${uuid(body.id)} and usuario_id = ${user.id}`;
    return {};
  },

  async meGusta({ sql, body, request }) {
    const user = await auth(sql, request);
    const post = await visiblePost(sql, user.id, body.id);
    if (body.si === false) {
      await sql`delete from me_gusta where publicacion_id = ${post.id} and usuario_id = ${user.id}`;
    } else {
      const added = await sql`
        insert into me_gusta (publicacion_id, usuario_id) values (${post.id}, ${user.id}) on conflict do nothing returning 1`;
      if (added.length && !post.mia) await avisarMeGusta(sql, post, user);
    }
    return {};
  },

  async comentar({ sql, body, request }) {
    const user = await auth(sql, request);
    const post = await visiblePost(sql, user.id, body.id);
    const texto = text(body.texto, MAX_COMMENT, 'tu comentario');
    await tooMany(sql, 'comentarios', user.id, COMMENTS_PER_HOUR);
    const [row] = await sql<{ id: string }[]>`
      insert into comentarios (publicacion_id, usuario_id, texto) values (${post.id}, ${user.id}, ${texto}) returning id`;
    if (!post.mia) {
      await notifyUser(sql, (post as Json).autorId as string, {
        title: `${user.nombre} comentó tu publicación`,
        body: texto.length > 140 ? `${texto.slice(0, 139)}…` : texto,
        url: `/comunidades/publicacion/${post.id}`,
        tag: `comentario-${post.id}`,
      });
    }
    return { id: row.id };
  },

  async borrarComentario({ sql, body, request }) {
    const user = await auth(sql, request);
    // Cada quien borra sus comentarios, y quien publicó puede borrar los de su publicación.
    await sql`
      delete from comentarios c using publicaciones p
      where c.id = ${uuid(body.id)} and p.id = c.publicacion_id and (c.usuario_id = ${user.id} or p.usuario_id = ${user.id})`;
    return {};
  },

  async reportar({ sql, body, request }) {
    const user = await auth(sql, request);
    const post = await visiblePost(sql, user.id, body.id);
    if (post.mia) throw new Fail('No puedes reportar tu propia publicación');
    await sql`insert into reportes (publicacion_id, usuario_id) values (${post.id}, ${user.id}) on conflict do nothing`;
    return {};
  },

  async amigos({ sql, request }) {
    const user = await auth(sql, request);
    const codigo = await friendCode(sql, user.id);
    const [{ compartir }] = await sql<{ compartir: boolean }[]>`
      select compartir_lecturas as compartir from usuarios where id = ${user.id}`;
    const links = await sql<{ id: string; nombre: string; foto: string | null; racha: number; estado: string }[]>`
      select u.id, u.nombre, u.foto, ${sql.unsafe(RACHA)} as racha, case when a.aceptada then 'amigos' when a.de = ${user.id} then 'enviada' else 'recibida' end as estado
      from amistades a join usuarios u on u.id = case when a.de = ${user.id} then a.para else a.de end
      where a.de = ${user.id} or a.para = ${user.id}
      order by u.nombre`;
    // Sugerencias: gente de tus grupos con la que aún no tienes amistad.
    const sugerencias = await sql`
      select distinct on (u.id) u.id, u.nombre, u.foto, ${sql.unsafe(RACHA)} as racha, g.nombre as grupo
      from miembros mine join miembros other on other.grupo_id = mine.grupo_id and other.usuario_id <> ${user.id}
      join usuarios u on u.id = other.usuario_id join grupos g on g.id = mine.grupo_id
      where mine.usuario_id = ${user.id} and not ${blocked(sql, user.id, sql`u.id`)}
        and not exists (select 1 from amistades a where (a.de = ${user.id} and a.para = u.id) or (a.de = u.id and a.para = ${user.id}))
      order by u.id limit 30`;
    const bloqueadas = await sql`
      select u.id, u.nombre, u.foto from bloqueos b join usuarios u on u.id = b.a where b.de = ${user.id} order by u.nombre`;
    const pick = (estado: string) =>
      links.filter((l) => l.estado === estado).map(({ id, nombre, foto, racha }) => ({ id, nombre, foto, racha }));
    const [{ nuevos }] = await sql<{ nuevos: number }[]>`
      select count(*)::int as nuevos from versiculos_enviados v
      where v.para = ${user.id} and not v.visto and not ${blocked(sql, user.id, sql`v.de`)}`;
    return {
      codigo,
      versiculosNuevos: nuevos,
      bloqueadas,
      compartirLecturas: compartir,
      amigos: pick('amigos'),
      recibidas: pick('recibida'),
      enviadas: pick('enviada'),
      sugerencias,
    };
  },

  async verCodigoAmigo({ sql, body }) {
    const p = await personByCode(sql, body.codigo);
    return { persona: { id: p.id, nombre: p.nombre, foto: p.foto } };
  },

  async pedirAmistad({ sql, body, request }) {
    const user = await auth(sql, request);
    const target = body.codigo ? (await personByCode(sql, body.codigo)).id : uuid(body.usuario);
    if (target === user.id) throw new Fail('Ese es tu propio código');
    const [exists] = await sql`select 1 from usuarios where id = ${target} and not ${blocked(sql, user.id, target)}`;
    if (!exists) throw new Fail('Esa persona ya no está en la comunidad', 404);
    // Si la otra persona ya te había invitado, pedirle amistad es aceptarla.
    const accepted = await sql`update amistades set aceptada = true where de = ${target} and para = ${user.id} returning de`;
    if (accepted.length) await avisarAmistadAceptada(sql, target, user);
    else {
      const sent = await sql`insert into amistades (de, para) values (${user.id}, ${target}) on conflict do nothing returning 1`;
      if (sent.length) {
        await notifyUser(sql, target, {
          title: `${user.nombre} quiere ser tu amigo`,
          body: 'Acepta su invitación para ver lo que lee y comparte en la comunidad.',
          url: '/comunidades/amigos',
          tag: `amistad-${user.id}`,
        });
      }
    }
    return { id: target, relacion: await relation(sql, user.id, target) };
  },

  async responderAmistad({ sql, body, request }) {
    const user = await auth(sql, request);
    const other = uuid(body.usuario);
    if (body.aceptar === false) await sql`delete from amistades where de = ${other} and para = ${user.id} and not aceptada`;
    else {
      const accepted = await sql`update amistades set aceptada = true where de = ${other} and para = ${user.id} and not aceptada returning 1`;
      if (accepted.length) await avisarAmistadAceptada(sql, other, user);
    }
    return { relacion: await relation(sql, user.id, other) };
  },

  async quitarAmigo({ sql, body, request }) {
    const user = await auth(sql, request);
    const other = uuid(body.usuario);
    await sql`delete from amistades where (de = ${user.id} and para = ${other}) or (de = ${other} and para = ${user.id})`;
    return {};
  },

  // «Te envié un versículo»: la imagen de un versículo va directo a un amigo, con un aviso, y quien la recibe
  // responde «Amén» o «Gracias» con un toque (le llega un aviso a quien la mandó).
  async enviarVersiculo({ sql, body, request }) {
    const user = await auth(sql, request);
    const para = uuid(body.para);
    const [amigo] = await sql<{ nombre: string }[]>`
      select u.nombre from usuarios u where u.id = ${para} and u.id in (${friendIds(sql, user.id)}) and not ${blocked(sql, user.id, para)}`;
    if (!amigo) throw new Fail('Solo puedes enviar versículos a tus amigos', 403);
    const book = await bookOf(body.libro);
    const chapter = int(body.capitulo, 'Capítulo', 1, book.chapters);
    const verse = int(body.versiculo, 'Versículo', 1, 200);
    const quote = await verseText(body.version, book, chapter, verse);
    const datos = datosDeImagen((body.datos ?? {}) as Json);
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from versiculos_enviados where de = ${user.id} and creado > now() - interval '1 hour'`;
    if (n >= SENT_PER_HOUR) throw new Fail('Has enviado muchos versículos en poco tiempo. Vuelve a intentarlo en un rato.', 429);
    const [row] = await sql<{ id: string }[]>`
      insert into versiculos_enviados (de, para, libro, capitulo, versiculo, version, cita, datos)
      values (${user.id}, ${para}, ${book.id}, ${chapter}, ${verse}, ${quote.version}, ${quote.cita}, ${sql.json(datos as postgres.JSONValue)})
      returning id`;
    const dedicatoria = typeof datos.dedicatoria === 'string' ? `${datos.dedicatoria}: ` : '';
    await notifyUser(sql, para, {
      title: `${user.nombre} te envió un versículo`,
      body: `${dedicatoria}${book.name} ${chapter}:${verse}. «${quote.cita.slice(0, 100)}${quote.cita.length > 100 ? '…' : ''}»`,
      url: '/recibidos',
      tag: `versiculo-${row.id}`,
    });
    return { id: row.id, para: amigo.nombre };
  },

  async versiculosRecibidos({ sql, request }) {
    const user = await auth(sql, request);
    const recibidos = await sql`
      select v.id, v.libro, v.capitulo, v.versiculo, v.version, v.cita, v.datos, v.respuesta, v.visto, v.creado,
        u.id as "deId", u.nombre as "deNombre", u.foto as "deFoto"
      from versiculos_enviados v join usuarios u on u.id = v.de
      where v.para = ${user.id} and not ${blocked(sql, user.id, sql`v.de`)}
      order by v.creado desc limit 60`;
    const enviados = await sql`
      select v.id, v.libro, v.capitulo, v.versiculo, v.version, v.cita, v.datos, v.respuesta, v.creado,
        u.id as "paraId", u.nombre as "paraNombre", u.foto as "paraFoto"
      from versiculos_enviados v join usuarios u on u.id = v.para
      where v.de = ${user.id}
      order by v.creado desc limit 60`;
    // Abrir la lista los marca como vistos.
    await sql`update versiculos_enviados set visto = true where para = ${user.id} and not visto`;
    return { recibidos, enviados };
  },

  async responderVersiculo({ sql, body, request }) {
    const user = await auth(sql, request);
    const respuesta = String(body.respuesta);
    if (!RESPUESTAS.includes(respuesta)) throw new Fail('Respuesta no válida');
    const [row] = await sql<{ de: string; libro: string; capitulo: number; versiculo: number }[]>`
      update versiculos_enviados set respuesta = ${respuesta}, respondido = now()
      where id = ${uuid(body.id)} and para = ${user.id} and respuesta is null
      returning de, libro, capitulo, versiculo`;
    if (row) {
      const book = await bookOf(row.libro);
      await notifyUser(sql, row.de, {
        title: respuesta === 'amen' ? `${user.nombre} dijo «Amén»` : `${user.nombre} te dio las gracias`,
        body: `Por el versículo que le enviaste: ${book.name} ${row.capitulo}:${row.versiculo}.`,
        url: '/recibidos?ver=enviados',
        tag: `versiculo-respuesta-${uuid(body.id)}`,
      });
    }
    return { respuesta };
  },

  // Bloquear: dejan de verse (publicaciones, comentarios, solicitudes y sugerencias) y la amistad se quita.
  async bloquear({ sql, body, request }) {
    const user = await auth(sql, request);
    const other = uuid(body.usuario);
    if (other === user.id) throw new Fail('No puedes bloquearte a ti mismo');
    await sql`insert into bloqueos (de, a) values (${user.id}, ${other}) on conflict do nothing`;
    await sql`delete from amistades where (de = ${user.id} and para = ${other}) or (de = ${other} and para = ${user.id})`;
    return { relacion: 'bloqueada' };
  },

  async desbloquear({ sql, body, request }) {
    const user = await auth(sql, request);
    const other = uuid(body.usuario);
    await sql`delete from bloqueos where de = ${user.id} and a = ${other}`;
    return { relacion: await relation(sql, user.id, other) };
  },

  async compartirLecturas({ sql, body, request }) {
    const user = await auth(sql, request);
    await sql`update usuarios set compartir_lecturas = ${Boolean(body.si)} where id = ${user.id}`;
    return {};
  },

  async persona({ sql, body, request }) {
    const user = await auth(sql, request);
    const id = uuid(body.usuario);
    const [p] = await sql<{ id: string; nombre: string; foto: string | null; amigos: number }[]>`
      select u.id, u.nombre, u.foto, u.bio, u.iglesia, u.ciudad, ${sql.unsafe(RACHA)} as racha,
        (select count(*)::int from amistades a where a.aceptada and (a.de = u.id or a.para = u.id)) as amigos
      from usuarios u where u.id = ${id}`;
    if (!p) throw new Fail('Esa persona ya no está en la comunidad', 404);
    // Quien te bloqueó desaparece para ti, como si no estuviera.
    const [theyBlocked] = await sql`select 1 from bloqueos where de = ${id} and a = ${user.id}`;
    if (theyBlocked) throw new Fail('Esa persona ya no está en la comunidad', 404);
    // Los grupos en común (o todos los tuyos, si es tu perfil): los demás grupos de alguien son privados.
    const grupos = await sql<{ id: string; nombre: string; tipo: string; miembros: number }[]>`
      select g.id, g.nombre, g.tipo, (select count(*)::int from miembros x where x.grupo_id = g.id) as miembros
      from grupos g join miembros a on a.grupo_id = g.id and a.usuario_id = ${id}
      join miembros b on b.grupo_id = g.id and b.usuario_id = ${user.id}
      order by g.nombre`;
    return {
      persona: { ...p, relacion: await relation(sql, user.id, id), grupos },
      publicaciones: await posts(sql, user.id, sql`p.usuario_id = ${id}`),
    };
  },
};

// «En pareja» (api/_pareja.ts): sus acciones empiezan por «pareja» y usan la misma cuenta.
Object.assign(actions, parejaActions({ auth, fail: (message, status) => new Fail(message, status) }));
// «Zarza para Iglesias» (api/_iglesias.ts) y «Cuidar Zarza» (api/_cuidar.ts), con la misma cuenta.
Object.assign(actions, iglesiaActions({ auth, fail: (message, status) => new Fail(message, status) }));
Object.assign(actions, cuidarActions({ auth, fail: (message, status) => new Fail(message, status), books }));
// «Círculo de solteros» (api/_circulo.ts): sus acciones empiezan por «circulo» (y las de /cuidar, por «cuidar»).
Object.assign(actions, circuloActions({ auth, fail: (message, status) => new Fail(message, status) }));

// --- Avisos push de la comunidad (api/_push.ts). Solo llegan a quien los activó en la pantalla de notificaciones. ---

async function avisarMeGusta(sql: Sql, post: PostRow, user: User) {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from me_gusta where publicacion_id = ${post.id}`;
  const otros = n - 1;
  const quien = otros > 0 ? `A ${user.nombre} y ${otros === 1 ? 'otra persona' : `${otros} personas más`} les gusta` : `A ${user.nombre} le gusta`;
  const que = post.tipo === 'pregunta' ? 'tu pregunta' : post.tipo === 'lectura' ? 'tu lectura' : 'tu publicación';
  const cita = post.libroNombre && post.capitulo ? ` de ${post.libroNombre} ${post.capitulo}${post.versiculo ? `:${post.versiculo}` : ''}` : '';
  await notifyUser(sql, post.autorId as string, {
    title: `${quien} ${que}${cita}`,
    body: typeof post.texto === 'string' && post.texto ? post.texto.slice(0, 120) : typeof post.cita === 'string' ? `«${post.cita.slice(0, 118)}»` : 'Ábrela en la comunidad.',
    url: `/comunidades/publicacion/${post.id}`,
    // Un solo aviso por publicación: cada nuevo «me gusta» reemplaza al anterior.
    tag: `megusta-${post.id}`,
  });
}

async function avisarAmistadAceptada(sql: Sql, to: string, user: User) {
  await notifyUser(sql, to, {
    title: `${user.nombre} aceptó tu amistad`,
    body: 'Ahora verán lo que cada uno lee y comparte.',
    url: `/comunidades/persona/${user.id}`,
    tag: `amistad-${user.id}`,
  });
}

async function avisarUnion(sql: Sql, groupId: string, user: User) {
  const admins = await sql<{ usuario_id: string; nombre: string }[]>`
    select m.usuario_id, g.nombre from miembros m join grupos g on g.id = m.grupo_id
    where m.grupo_id = ${groupId} and m.rol = 'admin' and m.usuario_id <> ${user.id} and m.avisos`;
  await Promise.all(
    admins.map((a) =>
      notifyUser(sql, a.usuario_id, {
        title: `${user.nombre} se unió a ${a.nombre}`,
        body: 'Aceptó tu invitación. Ya puede leer el plan con el grupo.',
        url: `/grupos/${groupId}`,
        tag: `grupo-${groupId}`,
      }),
    ),
  );
}

/** Avisa a quienes están en el grupo (menos a quien lo hizo y a quien silenció el grupo). */
async function avisarGrupo(sql: Sql, groupId: string, user: User, aviso: (grupo: string) => Aviso) {
  const rows = await sql<{ usuario_id: string; nombre: string }[]>`
    select m.usuario_id, g.nombre from miembros m join grupos g on g.id = m.grupo_id
    where m.grupo_id = ${groupId} and m.usuario_id <> ${user.id} and m.avisos
      and not exists (select 1 from bloqueos b where (b.de = m.usuario_id and b.a = ${user.id}) or (b.de = ${user.id} and b.a = m.usuario_id))`;
  await Promise.all(rows.map((r) => notifyUser(sql, r.usuario_id, aviso(r.nombre))));
}

async function groupAlerts(sql: Sql, groupId: string, userId: string) {
  const [row] = await sql<{ avisos: boolean }[]>`select avisos from miembros where grupo_id = ${groupId} and usuario_id = ${userId}`;
  return row?.avisos ?? true;
}

/** Sale del grupo; si se va el último administrador, pasa a serlo quien lleva más tiempo, y sin nadie el grupo se borra. */
async function leave(sql: Sql, groupId: string, userId: string) {
  await sql.begin(async (tx) => {
    await tx`delete from miembros where grupo_id = ${groupId} and usuario_id = ${userId}`;
    const [left] = await tx<{ admins: number; total: number }[]>`
      select count(*) filter (where rol = 'admin')::int as admins, count(*)::int as total from miembros where grupo_id = ${groupId}`;
    if (left.total === 0) await tx`delete from grupos where id = ${groupId}`;
    else if (left.admins === 0) {
      await tx`
        update miembros set rol = 'admin' where grupo_id = ${groupId} and usuario_id =
          (select usuario_id from miembros where grupo_id = ${groupId} order by unido limit 1)`;
    }
  });
}

export async function POST(request: Request) {
  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return Response.json({ error: 'JSON no válido' }, { status: 400 });
  }
  const action = typeof body.accion === 'string' ? actions[body.accion] : undefined;
  if (!action || !Object.hasOwn(actions, body.accion as string)) {
    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  }
  try {
    const result = await action({ sql: await db(), body, request });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof Fail) return Response.json({ error: err.message }, { status: err.status });
    console.error('comunidades', body.accion, err);
    const message =
      err instanceof Anthropic.RateLimitError
        ? 'Hay muchas consultas ahora mismo. Inténtalo en un momento.'
        : 'Algo falló en el servidor. Inténtalo de nuevo.';
    return Response.json({ error: message }, { status: 500 });
  }
}


/** El mensaje para la app cuando el viaje no terminó en una cuenta abierta o conectada, o null si terminó bien. */
function mensajeViaje(proveedor: Proveedor, resultado: string) {
  const p = NOMBRE[proveedor];
  const errors: Record<string, string> = {
    cancelado: `No se conectó con ${p}.`,
    ocupada: `Esa cuenta de ${p} ya está conectada a otra cuenta de Zarza.`,
    correo: `Ya tienes una cuenta con el correo de tu ${p}. Entra como siempre y conecta ${p} desde tu perfil.`,
    error: `${p} no respondió. Inténtalo de nuevo.`,
  };
  return errors[resultado] ?? null;
}

/** Lo que ve la persona en la página de vuelta, según cómo terminó el viaje. */
function textoVuelta(proveedor: Proveedor, resultado: string): [boolean, string, string] {
  const p = NOMBRE[proveedor];
  if (resultado === 'conectado') return [true, `${p} quedó conectado`, `Desde ahora puedes entrar a Zarza con ${p} en cualquier dispositivo.`];
  if (resultado === 'creada') return [true, 'Bienvenido a Zarza', 'Tu cuenta quedó creada. Ya puedes volver a la app.'];
  if (resultado === 'listo') return [true, 'Qué bueno verte', 'Ya entraste. Puedes volver a la app.'];
  return [false, 'No se pudo entrar', mensajeViaje(proveedor, resultado) ?? 'Vuelve a la app e inténtalo de nuevo.'];
}

/** La cuenta de Zarza para quien vuelve del proveedor: la conecta, entra en la suya o la crea. Devuelve el resultado. */
async function vincular(sql: Sql, trip: { modo: string; usuario_id: string | null }, ext: Externo) {
  const copyPhoto = async (userId: string) => {
    const pic = ext.foto ? await downloadPhoto(ext.foto) : null;
    if (pic) await setPhoto(sql, userId, pic.bytes, pic.type).catch((err) => console.error('entrar: foto', err));
  };
  const [owner] = await sql<{ usuario_id: string }[]>`
    select usuario_id from cuentas_externas where proveedor = ${ext.proveedor} and cuenta_id = ${ext.id}`;
  const nombre = ext.nombre || null;

  if (trip.modo === 'conectar') {
    if (owner && owner.usuario_id !== trip.usuario_id) return { resultado: 'ocupada', usuario: trip.usuario_id };
    await sql`delete from cuentas_externas where usuario_id = ${trip.usuario_id} and proveedor = ${ext.proveedor} and cuenta_id <> ${ext.id}`;
    await sql`
      insert into cuentas_externas (proveedor, cuenta_id, usuario_id, nombre) values (${ext.proveedor}, ${ext.id}, ${trip.usuario_id}, ${nombre})
      on conflict (proveedor, cuenta_id) do update set nombre = coalesce(excluded.nombre, cuentas_externas.nombre)`;
    const [me] = await sql<{ foto: string | null }[]>`select foto from usuarios where id = ${trip.usuario_id}`;
    if (me && !me.foto) await copyPhoto(trip.usuario_id!);
    return { resultado: 'conectado', usuario: trip.usuario_id };
  }
  if (owner) {
    if (nombre) await sql`update cuentas_externas set nombre = ${nombre} where proveedor = ${ext.proveedor} and cuenta_id = ${ext.id}`;
    return { resultado: 'listo', usuario: owner.usuario_id };
  }
  // Nunca se une a una cuenta existente solo por el correo: quien la tenga debe entrar y conectar el proveedor él mismo.
  if (ext.correo) {
    const [taken] = await sql`select 1 from usuarios where correo = ${ext.correo}`;
    if (taken) return { resultado: 'correo', usuario: null };
  }
  const id = await sql.begin(async (tx) => {
    const [created] = await tx<{ id: string }[]>`
      insert into usuarios (nombre, correo) values (${nombre ?? ext.correo?.split('@')[0]?.slice(0, MAX_NAME) ?? 'Amigo'}, ${ext.correo})
      returning id`;
    await tx`insert into cuentas_externas (proveedor, cuenta_id, usuario_id, nombre) values (${ext.proveedor}, ${ext.id}, ${created.id}, ${nombre})`;
    return created.id;
  });
  await copyPhoto(id);
  return { resultado: 'creada', usuario: id };
}

/**
 * Todo /api/auth (vercel.json lo reescribe a /api/auth?ruta=…):
 * - ir?pase=…: la app abre esta dirección; gasta el pase, ata el viaje a este navegador con una cookie y manda al proveedor.
 * - callback/<proveedor>: la vuelta del proveedor, que resuelve Auth.js (api/_entrar.ts).
 * - listo: la página final; anota el viaje como cancelado si el proveedor volvió con un error.
 */
export async function authRoute(request: Request) {
  const url = new URL(request.url);
  const ruta = (url.searchParams.get('ruta') ?? url.pathname.replace(/^\/api\/auth\/?/, '')).replace(/^\/+|\/+$/g, '');
  url.searchParams.delete('ruta');
  const origin = url.origin;
  const volver = (modo?: string) => (modo === 'conectar' ? '/cuenta' : '/entrar');
  let sql: Sql;
  try {
    sql = await db();
  } catch {
    return paginaVuelta(false, 'No se pudo entrar', 'Vuelve a la app e inténtalo de nuevo.', '/entrar');
  }
  const navegador = cookieOf(request, VIAJE_COOKIE);
  const tripOf = async () =>
    navegador
      ? (
          await sql<{ estado_hash: string; proveedor: Proveedor; modo: string; nativo: boolean; usuario_id: string | null; resultado: string }[]>`
            select estado_hash, proveedor, modo, nativo, usuario_id, resultado from viajes_cuenta
            where navegador_hash = ${hash(navegador)} and creado > now() - make_interval(mins => ${VIAJE_MINUTOS})`
        )[0]
      : undefined;

  if (ruta === 'ir') {
    const pase = url.searchParams.get('pase') ?? '';
    const nuevo = randomBytes(24).toString('base64url');
    const [trip] = pase
      ? await sql<{ proveedor: Proveedor; modo: string; nativo: boolean }[]>`
          update viajes_cuenta set pase_hash = null, navegador_hash = ${hash(nuevo)}
          where pase_hash = ${hash(pase)} and resultado = 'pendiente' and creado > now() - make_interval(mins => ${VIAJE_MINUTOS})
          returning proveedor, modo, nativo`
      : [];
    if (!trip || !proveedoresListos()[trip.proveedor]) {
      return paginaVuelta(false, 'Este enlace ya se usó', 'Vuelve a la app y toca otra vez el botón para entrar.', volver(trip?.modo), trip?.nativo);
    }
    const res = await authJs(
      new Request(`${origin}/api/auth/signin/${trip.proveedor}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: request.headers.get('cookie') ?? '' },
        body: new URLSearchParams({ callbackUrl: `${origin}/api/auth/listo` }),
      }),
      async () => `${origin}/api/auth/listo`,
    );
    const headers = new Headers(res.headers);
    headers.append('Set-Cookie', `${VIAJE_COOKIE}=${nuevo}; Path=/api/auth; Max-Age=${VIAJE_MINUTOS * 60}; HttpOnly; Secure; SameSite=None`);
    headers.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers });
  }

  if (ruta === 'listo') {
    const trip = await tripOf();
    if (!trip) return paginaVuelta(false, 'No se pudo entrar', 'Empieza otra vez desde la app, en este mismo dispositivo.', '/entrar');
    let resultado = trip.resultado;
    if (resultado === 'pendiente') {
      // El proveedor volvió con un error (la persona canceló) o Auth.js no pudo terminar.
      const error = url.searchParams.get('error');
      resultado = !error || error === 'OAuthCallbackError' || error === 'AccessDenied' ? 'cancelado' : 'error';
      await sql`update viajes_cuenta set resultado = ${resultado} where estado_hash = ${trip.estado_hash} and resultado = 'pendiente'`;
    }
    const [ok, titulo, texto] = textoVuelta(trip.proveedor, resultado);
    return paginaVuelta(ok, titulo, texto, volver(trip.modo), trip.nativo);
  }

  if (!ruta.startsWith('callback/')) return new Response('No encontrado', { status: 404 });
  url.pathname = `/api/auth/${ruta}`;
  const body = request.method === 'POST' ? await request.text() : undefined;
  return authJs(new Request(url, { method: request.method, headers: request.headers, body }), async (ext) => {
    const trip = await tripOf();
    if (!trip || trip.resultado !== 'pendiente' || trip.proveedor !== ext.proveedor) return `${origin}/api/auth/listo?error=Viaje`;
    let done: { resultado: string; usuario: string | null };
    try {
      done = await vincular(sql, trip, ext);
    } catch (err) {
      console.error('entrar', err);
      done = { resultado: 'error', usuario: trip.usuario_id };
    }
    await sql`update viajes_cuenta set resultado = ${done.resultado}, usuario_id = ${done.usuario} where estado_hash = ${trip.estado_hash}`;
    return `${origin}/api/auth/listo`;
  });
}
