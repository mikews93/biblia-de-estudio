// Función de Vercel para las notificaciones push de la web: guarda la suscripción de cada dispositivo con
// sus preferencias, y manda el recordatorio diario a la hora que cada quien eligió.
//
// Funciona sin cuenta (el recordatorio de lectura es para todos). Si la petición trae la llave de sesión,
// la suscripción queda unida a la cuenta y recibe también los avisos de la comunidad (api/comunidades.ts).
// La dirección de la suscripción (endpoint) es secreta y sirve de identificador del dispositivo.
//
// Todo va por POST con {"accion": "...", ...}. El recordatorio diario lo dispara un programador externo cada
// 15 minutos con GET /api/notificaciones?accion=enviar (o POST {"accion":"enviar"}): se puede llamar de más sin
// problema, porque cada dispositivo recibe un solo recordatorio al día.

import { createHash } from 'node:crypto';
import postgres from 'postgres';

import { dailyMessage, DiaReto, EstadoAvisos, HORA_POR_DEFECTO, horaLabel, isDue, localNow, validZone } from '../src/lib/avisosTexto';
import { PUSH_SCHEMA, sendMany, sendPush, Suscripcion, validEndpoint, vapid } from './_push';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Fila = Suscripcion & {
  zona: string;
  hora: number;
  lectura: boolean;
  tarjetas: boolean;
  reto: boolean;
  estado: EstadoAvisos;
  enviado: string | null;
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

async function db() {
  if (!DB_URL) throw new Fail('Falta conectar la base de datos en el servidor.', 503);
  sql ??= postgres(DB_URL, { max: 3, idle_timeout: 20, onnotice: () => {} });
  ready ??= sql.unsafe(PUSH_SCHEMA).catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return sql;
}

/** La cuenta de la llave de sesión, si viene y es válida (sin cuenta también se puede suscribir). */
async function accountOf(sql: Sql, request: Request): Promise<string | null> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key) return null;
  try {
    const [row] = await sql<{ usuario_id: string }[]>`
      select usuario_id from sesiones where llave_hash = ${createHash('sha256').update(key).digest('hex')}`;
    return row?.usuario_id ?? null;
  } catch {
    // Aún no existen las tablas de la comunidad: nadie tiene cuenta todavía.
    return null;
  }
}

function endpointOf(value: unknown) {
  if (!validEndpoint(value)) throw new Fail('Este navegador no dio una suscripción válida');
  return value;
}

/** Claves de la suscripción: p256dh es un punto P-256 sin comprimir (65 bytes) y auth, 16 bytes. */
function keysOf(value: unknown) {
  const k = (value ?? {}) as Json;
  const bytes = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]+=*$/.test(v) ? Buffer.from(v, 'base64url') : null);
  const p256dh = bytes(k.p256dh);
  const auth = bytes(k.auth);
  if (!p256dh || p256dh.length !== 65 || p256dh[0] !== 4 || !auth || auth.length !== 16) {
    throw new Fail('Este navegador no dio una suscripción válida');
  }
  return { p256dh: p256dh.toString('base64url'), auth: auth.toString('base64url') };
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
/** Solo rutas de la propia app («/juan/3»): el aviso no debe poder abrir otro sitio. */
const path = (v: unknown) => (typeof v === 'string' && /^\/(?!\/)[^\s\\]{0,199}$/.test(v) ? v : undefined);

/** Lo que manda el dispositivo, limpio y con tamaños acotados. */
export function cleanEstado(raw: unknown): EstadoAvisos {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Json;
  const out: EstadoAvisos = {};
  if (isDate(r.leido)) out.leido = r.leido;
  const lectura = (r.lectura ?? {}) as Json;
  const lt = str(lectura.titulo, 60);
  const lu = path(lectura.url);
  if (lt && lu) out.lectura = { titulo: lt, url: lu };
  if (Array.isArray(r.tarjetas)) out.tarjetas = r.tarjetas.filter(isDate).sort().slice(0, 500);
  const reto = (r.reto ?? null) as Json | null;
  const rt = reto && str(reto.titulo, 60);
  const ru = reto && path(reto.url);
  if (reto && rt && ru && Array.isArray(reto.dias)) {
    const dias: DiaReto[] = (reto.dias as Json[])
      .filter((d) => d && isDate(d.fecha) && Number.isInteger(d.dia) && (d.dia as number) > 0 && (d.dia as number) < 400)
      .slice(0, 60)
      .map((d) => ({ fecha: d.fecha as string, dia: d.dia as number, titulo: str(d.titulo, 80), lectura: str(d.lectura, 60) }));
    out.reto = { titulo: rt, icono: str(reto.icono, 4), url: ru, dias };
  }
  return out;
}

type Action = (ctx: { sql: Sql; body: Json; request: Request }) => Promise<Json>;

const actions: Record<string, Action> = {
  async clave({ sql }) {
    return { clave: (await vapid(sql)).publicKey };
  },

  /** Crea o cambia la suscripción de este dispositivo con sus preferencias. */
  async guardar({ sql, body, request }) {
    const sub = (body.suscripcion ?? {}) as Json;
    const endpoint = endpointOf(sub.endpoint);
    const { p256dh, auth } = keysOf(sub.keys);
    const zona = validZone(body.zona) ? body.zona : 'UTC';
    const hora = Number.isInteger(body.hora) && (body.hora as number) >= 0 && (body.hora as number) < 1440 ? (body.hora as number) : HORA_POR_DEFECTO;
    const avisos = (body.avisos ?? {}) as Json;
    const flag = (k: string) => avisos[k] !== false;
    const estado = cleanEstado(body.estado);
    const usuario = await accountOf(sql, request);
    // Si la hora elegida ya pasó hoy, el primer recordatorio llega mañana (no justo al activarlas).
    const [prev] = await sql<{ hora: number; enviado: string | null }[]>`select hora, enviado::text as enviado from suscripciones where endpoint = ${endpoint}`;
    const now = localNow(zona);
    const enviado = prev && prev.hora === hora ? prev.enviado : now.minutos >= hora ? now.fecha : null;
    await sql`
      insert into suscripciones (endpoint, p256dh, auth, usuario_id, zona, hora, lectura, tarjetas, reto, comunidad, estado, enviado)
      values (${endpoint}, ${p256dh}, ${auth}, ${usuario}, ${zona}, ${hora}, ${flag('lectura')}, ${flag('tarjetas')},
        ${flag('reto')}, ${flag('comunidad')}, ${sql.json(estado as postgres.JSONValue)}, ${enviado})
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, usuario_id = excluded.usuario_id,
        zona = excluded.zona, hora = excluded.hora, lectura = excluded.lectura, tarjetas = excluded.tarjetas,
        reto = excluded.reto, comunidad = excluded.comunidad, estado = excluded.estado, enviado = excluded.enviado,
        actualizado = now()`;
    return { cuenta: Boolean(usuario) };
  },

  /** Al leer, repasar o cambiar de plan, el dispositivo pone al día lo que sabe el servidor. */
  async estado({ sql, body }) {
    const endpoint = endpointOf(body.endpoint);
    const rows = await sql`
      update suscripciones set estado = ${sql.json(cleanEstado(body.estado) as postgres.JSONValue)}, actualizado = now()
      where endpoint = ${endpoint} returning 1`;
    return { existe: rows.length > 0 };
  },

  async quitar({ sql, body }) {
    await sql`delete from suscripciones where endpoint = ${endpointOf(body.endpoint)}`;
    return {};
  },

  async probar({ sql, body }) {
    const endpoint = endpointOf(body.endpoint);
    const [s] = await sql<Fila[]>`select endpoint, p256dh, auth, hora from suscripciones where endpoint = ${endpoint}`;
    if (!s) throw new Fail('Primero activa las notificaciones', 404);
    const { hora, parte } = horaLabel(s.hora);
    const result = await sendPush(
      s,
      { title: '¡Listo! Las notificaciones funcionan', body: `Te recordaremos tu lectura cada día a las ${hora} ${parte}.`, url: '/notificaciones', tag: 'prueba' },
      await vapid(sql),
    );
    if (result === 'caducada') {
      await sql`delete from suscripciones where endpoint = ${endpoint}`;
      throw new Fail('El navegador dio de baja este dispositivo. Vuelve a activarlas.', 410);
    }
    if (result !== 'ok') throw new Fail('No se pudo enviar la prueba. Inténtalo en un momento.', 502);
    return { enviado: true };
  },

  /** El recordatorio diario de quien ya llegó a su hora. Se puede llamar de más: uno por día y dispositivo. */
  async enviar({ sql }) {
    // Una sola ronda a la vez aunque el programador llame dos veces seguidas.
    const [turn] = await sql`
      insert into ajustes (clave, valor) values ('ultimo_envio', now()::text)
      on conflict (clave) do update set valor = now()::text where ajustes.valor::timestamptz < now() - interval '50 seconds'
      returning 1`;
    if (!turn) return { enviados: 0, pausa: true };
    // «enviado» como texto: es una fecha local y no debe moverse con la zona del servidor.
    const subs = await sql<Fila[]>`
      select endpoint, p256dh, auth, zona, hora, lectura, tarjetas, reto, estado, enviado::text as enviado
      from suscripciones where lectura or tarjetas or reto`;
    const now = new Date();
    let enviados = 0;
    for (let i = 0; i < subs.length; i += 50) {
      await Promise.all(
        subs.slice(i, i + 50).map(async (s) => {
          const { due, fecha } = isDue(s, now);
          if (!due) return;
          // Se marca antes de enviar: si algo falla, mejor un aviso de menos que uno repetido.
          await sql`update suscripciones set enviado = ${fecha} where endpoint = ${s.endpoint}`;
          const aviso = dailyMessage(s.estado ?? {}, s, fecha);
          if (!aviso) return;
          const [r] = await sendMany(sql, [s], aviso);
          if (r === 'ok') enviados++;
        }),
      );
    }
    return { enviados, revisados: subs.length };
  },
};

async function run(accion: unknown, body: Json, request: Request) {
  const action = typeof accion === 'string' && Object.hasOwn(actions, accion) ? actions[accion] : undefined;
  if (!action) return Response.json({ error: 'Acción no válida' }, { status: 400 });
  try {
    const result = await action({ sql: await db(), body, request });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof Fail) return Response.json({ error: err.message }, { status: err.status });
    console.error('notificaciones', accion, err);
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
  return run(body.accion, body, request);
}

/** Para el programador: GET /api/notificaciones?accion=enviar. */
export async function GET(request: Request) {
  const accion = new URL(request.url).searchParams.get('accion');
  if (accion !== 'enviar') return Response.json({ error: 'Acción no válida' }, { status: 400 });
  return run(accion, {}, request);
}
