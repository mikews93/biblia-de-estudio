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
//
// Mientras está en vivo, quien predica puede lanzar una interacción (interactuar): una pregunta abierta que la
// congregación responde y se ve en un muro, o un repaso de opción múltiple sobre el mensaje. Se responde sin
// cuenta (responderEvento), con un identificador que cada teléfono inventa; el GET publica solo cuántos
// respondieron hasta que quien predica revela. Quien predica puede ocultar respuestas del muro (ocultarRespuesta).
//
// La lectura en vivo de la célula comparte la función para no gastar otra de Vercel: GET ?sala=CODIGO y sus
// acciones (crearSala, moverSala, tocar…) están en api/_celula.ts.

import { createHash, randomInt, randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { CATEGORIAS, GIROS, LETRAS, MAX_CITA, MAX_OPCION, MAX_PREGUNTAS, MAX_TEXTO_PREGUNTA, type PreguntaRepaso, equipoDe, girarRuleta, puntajeRuleta } from '../src/lib/repaso';
import { celulaGET, celulaPOST, isCelulaAction } from './_celula';

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
const MAX_RESPUESTA = 280;
const MAX_MURO = 80;
/** Respuestas por interacción y paso: una iglesia grande cabe, un ataque con miles de identificadores no. */
const MAX_RESPUESTAS = 3000;

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
alter table eventos add column if not exists interaccion jsonb;
create table if not exists evento_respuestas (
  id bigint generated always as identity,
  codigo text not null references eventos on delete cascade,
  interaccion text not null,
  paso int not null,
  participante text not null,
  texto text not null,
  oculta boolean not null default false,
  creado timestamptz not null default now(),
  primary key (codigo, interaccion, paso, participante)
);
`;

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Estado = (typeof ESTADOS)[number];
/** `citas`: las referencias del punto («Romanos 5:8»), también las que estaban en las notas que no se muestran. */
type Punto = { titulo: string; texto: string; citas: string[] };
type Pasaje = { book: string; chapter: number; from?: number; to?: number };
/**
 * Lo que quien predica puso para que la congregación responda. «pregunta»: abierta, con muro al revelar.
 * «repaso»: opción múltiple, una pregunta a la vez (`paso`); `reveladas` son las que ya mostraron la correcta.
 */
type Interaccion = {
  id: string;
  tipo: 'pregunta' | 'repaso';
  titulo: string;
  preguntas?: PreguntaRepaso[];
  paso: number;
  reveladas: number[];
  /** La ruleta del mensaje: se juega en grupo o por equipos; `casillas` dice dónde cayó cada pregunta que salió. */
  juego?: 'ruleta';
  modo?: 'grupo' | 'equipos';
  casillas?: Record<string, number>;
  giro?: number;
};
type Row = {
  codigo: string;
  interaccion: Interaccion | null;
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

const ROW_COLUMNS = `e.codigo, e.interaccion, e.mensaje, e.titulo, e.pasaje, e.idea, e.puntos, e.gradual, e.estado, e.punto, e.creado, e.actualizado,
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

/** La interacción sin la respuesta correcta de las preguntas que no se han revelado. */
function interaccionPublica(i: Interaccion | null) {
  if (!i) return null;
  return {
    ...i,
    preguntas: i.preguntas?.map((q, n) => (i.reveladas.includes(n) ? q : { ...q, correcta: -1 })),
  };
}

type Muro = { id: number; texto: string; oculta: boolean }[];
/**
 * Cómo va la interacción: cuántos respondieron la pregunta de ahora, los votos de las preguntas reveladas del
 * repaso y, en una pregunta abierta, el muro de respuestas (para quien predica siempre, para los demás al revelar).
 */
async function resultados(sql: Sql, e: Row, propio: boolean) {
  const i = e.interaccion;
  if (!i) return null;
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from evento_respuestas where codigo = ${e.codigo} and interaccion = ${i.id} and paso = ${i.paso}`;
  if (i.tipo === 'repaso') {
    const rows = i.reveladas.length
      ? await sql<{ paso: number; texto: string; n: number }[]>`
          select paso, texto, count(*)::int as n from evento_respuestas
          where codigo = ${e.codigo} and interaccion = ${i.id} and paso = any(${i.reveladas}::int[]) group by paso, texto`
      : [];
    const votos: Record<number, number[]> = {};
    for (const p of i.reveladas) votos[p] = [0, 0, 0, 0];
    for (const r of rows) {
      const o = LETRAS.indexOf(r.texto);
      if (o >= 0 && votos[r.paso]) votos[r.paso][o] = r.n;
    }
    if (i.juego !== 'ruleta') return { respondieron: n, votos };
    // La ruleta: cada pregunta vale su casilla; los equipos salen del identificador de cada teléfono.
    const todas = i.reveladas.length
      ? await sql<{ paso: number; participante: string; texto: string }[]>`
          select paso, participante, texto from evento_respuestas
          where codigo = ${e.codigo} and interaccion = ${i.id} and paso = any(${i.reveladas}::int[])`
      : [];
    const puntaje = puntajeRuleta(
      todas.map((r) => ({ usuario: r.participante, paso: r.paso, opcion: LETRAS.indexOf(r.texto), equipo: equipoDe(r.participante) })),
      i.preguntas ?? [],
      Object.fromEntries(Object.entries(i.casillas ?? {}).map(([k, v]) => [Number(k), v])),
      i.reveladas,
    );
    return { respondieron: n, votos, puntaje: { grupo: puntaje.grupo, equipos: puntaje.equipos } };
  }
  if (!propio && !i.reveladas.includes(0)) return { respondieron: n };
  const muro = await sql<Muro>`
    select id::int as id, texto, oculta from evento_respuestas
    where codigo = ${e.codigo} and interaccion = ${i.id} and paso = 0 ${propio ? sql`` : sql`and not oculta`}
    order by creado desc limit ${MAX_MURO}`;
  return { respondieron: n, muro: propio ? muro : muro.map(({ id, texto }) => ({ id, texto, oculta: false })) };
}

async function conResultados(sql: Sql, e: Row, propio: boolean) {
  return { ...publico(e, propio), resultados: await resultados(sql, e, propio) };
}

function preguntasDe(value: unknown): PreguntaRepaso[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PREGUNTAS) throw new Fail('Preguntas no válidas');
  return value.map((q: Json) => {
    const opciones = Array.isArray(q?.opciones) ? q.opciones.map((o) => text(o, MAX_OPCION, 'una opción')) : [];
    const correcta = Number(q?.correcta);
    if (opciones.length !== 4 || !Number.isInteger(correcta) || correcta < 0 || correcta > 3) throw new Fail('Pregunta no válida');
    const categoria = CATEGORIAS.find((c) => c.id === q?.categoria)?.id;
    const nivel = Number(q?.nivel);
    return {
      texto: text(q?.texto, MAX_TEXTO_PREGUNTA, 'la pregunta'),
      opciones,
      correcta,
      cita: text(q?.cita, MAX_CITA, 'la cita', false) || null,
      ...(categoria && { categoria }),
      ...(nivel >= 1 && nivel <= 3 && { nivel }),
    };
  });
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
    interaccion: interaccionPublica(e.interaccion),
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
    // La hora de la base de datos, la misma que devuelve «ver»: el cliente nunca vuelve a una respuesta más vieja.
    const [{ actualizado }] = await sql<{ actualizado: Date }[]>`
      update eventos set estado = ${estado}, punto = ${punto}, actualizado = now() where codigo = ${e.codigo} returning actualizado`;
    return { evento: await conResultados(sql, { ...e, estado, punto, actualizado }, true) };
  },

  /** El evento completo para quien lo publicó (sin la caché del CDN). */
  async ver({ sql, body, request }) {
    const yo = await usuario(sql, request);
    return { evento: await conResultados(sql, await owned(sql, body.codigo, yo), true) };
  },

  /**
   * Quien predica lanza una interacción (`nueva`: {tipo, titulo, preguntas?}), revela la de ahora (`revelar`),
   * pasa a otra pregunta del repaso (`paso`) o la quita de las pantallas (`quitar`).
   */
  async interactuar({ sql, body, request }) {
    const yo = await usuario(sql, request);
    const e = await owned(sql, body.codigo, yo);
    let i = e.interaccion;
    if (body.quitar === true) i = null;
    else if (body.nueva !== undefined) {
      const n = (body.nueva ?? {}) as Json;
      if (n.tipo !== 'pregunta' && n.tipo !== 'repaso') throw new Fail('Interacción no válida');
      const ruleta = n.tipo === 'repaso' && n.juego === 'ruleta';
      i = {
        id: randomUUID(),
        tipo: n.tipo,
        titulo: text(n.titulo, MAX_POINT_TITLE * 2, n.tipo === 'pregunta' ? 'la pregunta' : 'el título'),
        ...(n.tipo === 'repaso' ? { preguntas: preguntasDe(n.preguntas) } : {}),
        // La ruleta empieza sin pregunta: sale la primera al girar.
        paso: ruleta ? -1 : 0,
        reveladas: [],
        ...(ruleta && { juego: 'ruleta' as const, modo: n.modo === 'equipos' ? ('equipos' as const) : ('grupo' as const), casillas: {}, giro: 0 }),
      };
    } else {
      if (!i) throw new Fail('No hay nada para responder');
      if (body.girar === true) {
        if (i.juego !== 'ruleta') throw new Fail('Esto no es una ruleta');
        if (i.paso >= 0 && !i.reveladas.includes(i.paso)) throw new Fail('Primero revela la respuesta');
        const casillas = i.casillas ?? {};
        const giro = (i.giro ?? 0) >= GIROS ? null : girarRuleta(i.preguntas ?? [], Object.keys(casillas).map(Number));
        if (!giro) throw new Fail('La ruleta ya terminó');
        i = { ...i, paso: giro.paso, casillas: { ...casillas, [giro.paso]: giro.casilla }, giro: (i.giro ?? 0) + 1 };
      }
      if (body.revelar === true && i.paso >= 0 && !i.reveladas.includes(i.paso)) i = { ...i, reveladas: [...i.reveladas, i.paso] };
      if (body.paso !== undefined) {
        const paso = Number(body.paso);
        if (i.tipo !== 'repaso' || !Number.isInteger(paso) || paso < 0 || paso >= (i.preguntas?.length ?? 0)) throw new Fail('Pregunta no válida');
        i = { ...i, paso };
      }
    }
    const [{ actualizado }] = await sql<{ actualizado: Date }[]>`
      update eventos set interaccion = ${i ? sql.json(i) : null}, actualizado = now() where codigo = ${e.codigo} returning actualizado`;
    // Las respuestas de una interacción que ya no está no se guardan.
    await sql`delete from evento_respuestas where codigo = ${e.codigo} and interaccion <> ${i?.id ?? ''}`;
    return { evento: await conResultados(sql, { ...e, interaccion: i, actualizado }, true) };
  },

  /** Oculta (o vuelve a mostrar) una respuesta del muro. */
  async ocultarRespuesta({ sql, body, request }) {
    const yo = await usuario(sql, request);
    const e = await owned(sql, body.codigo, yo);
    const id = Number(body.id);
    if (!Number.isInteger(id)) throw new Fail('Respuesta no válida');
    await sql`update evento_respuestas set oculta = ${body.oculta !== false} where codigo = ${e.codigo} and id = ${id}`;
    return { evento: await conResultados(sql, e, true) };
  },

  async mios({ sql, request }) {
    const yo = await usuario(sql, request);
    const rows = await sql.unsafe<Row[]>(
      `select ${ROW_COLUMNS} from eventos e join usuarios u on u.id = e.usuario_id where e.usuario_id = $1 order by e.actualizado desc`,
      [yo],
    );
    return { eventos: rows.map((e) => publico(e, true)) };
  },

  /**
   * Alguien de la congregación responde, sin cuenta: `participante` es el identificador que inventó su teléfono.
   * La pregunta abierta se puede cambiar hasta que se revele; en el repaso vale la primera respuesta.
   */
  async responderEvento({ sql, body }) {
    const e = await find(sql, codigoDe(body.codigo));
    const i = e.interaccion;
    if (e.estado !== 'en-vivo' || !i || body.interaccion !== i.id) throw new Fail('Esta pregunta ya se cerró', 409);
    const participante = typeof body.participante === 'string' ? body.participante : '';
    if (!/^[a-z0-9-]{16,40}$/i.test(participante)) throw new Fail('Participante no válido');
    const paso = i.paso;
    if (paso < 0) throw new Fail('Todavía no hay pregunta', 409);
    if (i.reveladas.includes(paso)) throw new Fail('Esta pregunta ya se reveló', 409);
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from evento_respuestas where codigo = ${e.codigo} and interaccion = ${i.id} and paso = ${paso}`;
    if (n >= MAX_RESPUESTAS) throw new Fail('Ya respondió mucha gente a esta pregunta', 429);
    if (i.tipo === 'repaso') {
      const opcion = Number(body.opcion);
      if (!Number.isInteger(opcion) || opcion < 0 || opcion > 3) throw new Fail('Opción no válida');
      await sql`
        insert into evento_respuestas (codigo, interaccion, paso, participante, texto)
        values (${e.codigo}, ${i.id}, ${paso}, ${participante}, ${LETRAS[opcion]}) on conflict do nothing`;
    } else {
      const texto = text(body.texto, MAX_RESPUESTA, 'tu respuesta');
      await sql`
        insert into evento_respuestas (codigo, interaccion, paso, participante, texto)
        values (${e.codigo}, ${i.id}, ${paso}, ${participante}, ${texto})
        on conflict (codigo, interaccion, paso, participante) do update set texto = excluded.texto, creado = now()`;
    }
    return { ok: true };
  },

  async borrar({ sql, body, request }) {
    const yo = await usuario(sql, request);
    const e = await owned(sql, body.codigo, yo);
    await sql`delete from eventos where codigo = ${e.codigo}`;
    return {};
  },
};

export async function GET(request: Request) {
  // La lectura en vivo de la célula (api/_celula.ts) va con ?sala=.
  const url = new URL(request.url);
  if (url.searchParams.has('sala')) return celulaGET(url);
  try {
    const codigo = codigoDe(new URL(request.url).searchParams.get('codigo'));
    const sql = await db();
    const evento = await conResultados(sql, await find(sql, codigo), false);
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
  if (isCelulaAction(accion)) return celulaPOST(body, request);
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
