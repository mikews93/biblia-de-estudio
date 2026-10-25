// «Zarza para Iglesias»: una iglesia que sostiene Zarza cada mes es «anfitriona». Un pastor o líder la postula desde
// /iglesia/postular con su cuenta; quien cuida Zarza en /cuidar revisa que exista (sitio, mapa, redes, una llamada) y
// la aprueba. Al aprobarla se crea con un código (y su QR) y quien la postuló queda como su encargado: ve cuántos
// entraron y puede cambiar el código si se filtra. Quien entra con el código tiene una lámpara diaria más grande.
// Si una iglesia junta demasiados miembros en un día (IGLESIA_TOPE_DIA), el código se pausa solo hasta revisarla:
// los que ya entraron siguen igual.
// El pago se arregla fuera de la app (en la web, ver src/lib/sostener.ts): aquí solo se activa o se pausa.
//
// El guion bajo hace que Vercel no la publique como función: sus acciones van por /api/comunidades, con la misma
// cuenta y la misma base de Neon. La lámpara (api/_cuenta.ts) lee iglesias_anfitrionas para saber el tope.

import { randomInt } from 'node:crypto';
import type postgres from 'postgres';

import { notifyUser } from './_push';
import { cuidadores } from './_senales';

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Yo = { id: string; nombre?: string };
type Ctx = { sql: Sql; body: Json; request: Request };
type Helpers = { auth: (sql: Sql, request: Request) => Promise<Yo>; fail: (message: string, status?: number) => Error };

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
/** Preguntas al día para los miembros de una iglesia anfitriona, si no se dice otra cosa al darla de alta. */
export const LAMPARA_IGLESIA = Number(process.env.LAMPARA_IGLESIA ?? 40);
/** Más miembros nuevos que esto en 24 horas pausan el código hasta que alguien lo revise. */
export const IGLESIA_TOPE_DIA = Number(process.env.IGLESIA_TOPE_DIA ?? 150);
/** Postulaciones por cuenta en 30 días: alcanza para corregir datos, no para llenar la cola. */
const POSTULACIONES_MES = 3;

export const IGLESIAS_SCHEMA = `
create table if not exists iglesias_anfitrionas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ciudad text,
  codigo text not null unique,
  lampara int not null default ${LAMPARA_IGLESIA},
  activa boolean not null default true,
  creado timestamptz not null default now()
);
create table if not exists iglesia_miembros (
  usuario_id uuid primary key references usuarios on delete cascade,
  iglesia_id uuid not null references iglesias_anfitrionas on delete cascade,
  unido timestamptz not null default now()
);
create index if not exists iglesia_miembros_iglesia on iglesia_miembros (iglesia_id);
alter table iglesias_anfitrionas add column if not exists encargado_id uuid references usuarios on delete set null;
alter table iglesias_anfitrionas add column if not exists pausa text;
alter table iglesias_anfitrionas add column if not exists revisada timestamptz;
create table if not exists iglesia_postulaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios on delete cascade,
  nombre text not null,
  ciudad text not null,
  direccion text,
  denominacion text,
  responsable text not null,
  cargo text,
  contacto text not null,
  enlace text,
  mensaje text,
  estado text not null default 'pendiente',
  motivo text,
  iglesia_id uuid references iglesias_anfitrionas on delete set null,
  creado timestamptz not null default now(),
  revisado timestamptz
);
create index if not exists iglesia_postulaciones_estado on iglesia_postulaciones (estado, creado);
create index if not exists iglesia_postulaciones_usuario on iglesia_postulaciones (usuario_id, creado);`;

export type Anfitriona = {
  id: string;
  nombre: string;
  ciudad: string | null;
  codigo: string;
  lampara: number;
  activa: boolean;
  pausa: string | null;
};

/** Lo que manda quien postula su iglesia. Los nombres de los campos son los del formulario (src/app/iglesia/postular.tsx). */
const CAMPOS = {
  nombre: { max: 80, requerido: true, que: 'el nombre de la iglesia' },
  ciudad: { max: 80, requerido: true, que: 'la ciudad y el país' },
  direccion: { max: 160, requerido: false, que: 'la dirección' },
  denominacion: { max: 80, requerido: false, que: 'la denominación' },
  responsable: { max: 80, requerido: true, que: 'tu nombre' },
  cargo: { max: 60, requerido: false, que: 'tu cargo' },
  contacto: { max: 120, requerido: true, que: 'un teléfono o correo de la iglesia' },
  enlace: { max: 200, requerido: false, que: 'el sitio o las redes' },
  mensaje: { max: 600, requerido: false, que: 'el mensaje' },
} as const;
type Campo = keyof typeof CAMPOS;

/** Avisa a quienes cuidan Zarza (los correos de CUIDADORES que tienen cuenta). Nunca lanza. */
export async function avisarCuidadores(sql: Sql, aviso: { title: string; body: string; url: string; tag: string }) {
  const correos = cuidadores();
  if (!correos.length) return;
  try {
    const rows = await sql<{ id: string }[]>`select id from usuarios where lower(correo) = any(${correos})`;
    await Promise.all(rows.map((r) => notifyUser(sql, r.id, aviso)));
  } catch (err) {
    console.error('avisar cuidadores', err);
  }
}

export const nuevoCodigo = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
export const limpiarCodigo = (v: unknown) =>
  String(v ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

/** La iglesia anfitriona de la persona, o null. */
export async function iglesiaDe(sql: Sql, usuarioId: string) {
  const [row] = await sql<(Anfitriona & { miembros: number })[]>`
    select i.id, i.nombre, i.ciudad, i.codigo, i.lampara, i.activa, i.pausa,
      (select count(*)::int from iglesia_miembros x where x.iglesia_id = i.id) as miembros
    from iglesia_miembros m join iglesias_anfitrionas i on i.id = m.iglesia_id where m.usuario_id = ${usuarioId}`;
  return row ?? null;
}

/** Las acciones de los miembros, para sumarlas a las de api/comunidades.ts. */
export function iglesiaActions({ auth, fail }: Helpers): Record<string, (ctx: Ctx) => Promise<Json>> {
  async function porCodigo(sql: Sql, codigo: unknown) {
    const [row] = await sql<(Anfitriona & { miembros: number })[]>`
      select i.id, i.nombre, i.ciudad, i.codigo, i.lampara, i.activa, i.pausa,
        (select count(*)::int from iglesia_miembros x where x.iglesia_id = i.id) as miembros
      from iglesias_anfitrionas i where i.codigo = ${limpiarCodigo(codigo)}`;
    if (!row || !row.activa) throw fail('Ese código de iglesia no existe o ya no está activo.', 404);
    return row;
  }
  const publica = (i: Anfitriona & { miembros: number }) => ({
    nombre: i.nombre,
    ciudad: i.ciudad,
    codigo: i.codigo,
    lampara: i.lampara,
    miembros: i.miembros,
  });

  return {
    /** Lo que ve quien abre el enlace o el QR de la iglesia, con o sin cuenta. */
    async iglesiaVer({ sql, body, request }) {
      const iglesia = await porCodigo(sql, body.codigo);
      const hasKey = !!request.headers.get('authorization');
      const yo = hasKey ? await auth(sql, request).catch(() => null) : null;
      const mia = yo ? await iglesiaDe(sql, yo.id) : null;
      return { iglesia: publica(iglesia), soyMiembro: mia?.id === iglesia.id, otra: mia && mia.id !== iglesia.id ? mia.nombre : null };
    },

    async iglesiaUnirme({ sql, body, request }) {
      const yo = await auth(sql, request);
      const iglesia = await porCodigo(sql, body.codigo);
      const mia = await iglesiaDe(sql, yo.id);
      if (mia?.id === iglesia.id) return { iglesia: publica(iglesia) };
      if (iglesia.pausa) throw fail('Esta iglesia está en revisión. Inténtalo en unos días.', 423);
      await sql`
        insert into iglesia_miembros (usuario_id, iglesia_id) values (${yo.id}, ${iglesia.id})
        on conflict (usuario_id) do update set iglesia_id = excluded.iglesia_id, unido = now()`;
      // Un código que circula fuera de la iglesia se nota en un salto de miembros nuevos: se pausa hasta revisarla.
      // Al reanudarla se cuenta desde ese momento, para que no se vuelva a pausar con los mismos.
      const [{ nuevos }] = await sql<{ nuevos: number }[]>`
        select count(*)::int as nuevos from iglesia_miembros m join iglesias_anfitrionas i on i.id = m.iglesia_id
        where m.iglesia_id = ${iglesia.id} and m.unido > greatest(now() - interval '24 hours', coalesce(i.revisada, '-infinity'))`;
      if (nuevos > IGLESIA_TOPE_DIA) {
        const [pausada] = await sql`
          update iglesias_anfitrionas set pausa = ${`Más de ${IGLESIA_TOPE_DIA} miembros nuevos en un día`}
          where id = ${iglesia.id} and pausa is null returning 1`;
        if (pausada) {
          void avisarCuidadores(sql, {
            title: 'Una iglesia se pausó sola',
            body: `${iglesia.nombre}: más de ${IGLESIA_TOPE_DIA} miembros nuevos en un día. Revísala en Cuidar Zarza.`,
            url: '/cuidar',
            tag: `iglesia-pausa-${iglesia.id}`,
          });
        }
      }
      return { iglesia: publica(await porCodigo(sql, iglesia.codigo)) };
    },

    async iglesiaMia({ sql, request }) {
      const yo = await auth(sql, request);
      const mia = await iglesiaDe(sql, yo.id);
      return { iglesia: mia && mia.activa ? publica(mia) : null };
    },

    async iglesiaSalir({ sql, request }) {
      const yo = await auth(sql, request);
      await sql`delete from iglesia_miembros where usuario_id = ${yo.id}`;
      return {};
    },

    /** Un pastor o líder postula su iglesia. Queda pendiente hasta que alguien de Cuidar Zarza la revise. */
    async iglesiaPostular({ sql, body, request }) {
      const yo = await auth(sql, request);
      if (body.fe !== true) throw fail('Para postular hace falta estar de acuerdo con la declaración de fe.');
      const datos = {} as Record<Campo, string | null>;
      for (const [campo, c] of Object.entries(CAMPOS) as [Campo, (typeof CAMPOS)[Campo]][]) {
        const v = typeof body[campo] === 'string' ? (body[campo] as string).trim().replace(/[ \t]+/g, ' ') : '';
        if (!v && c.requerido) throw fail(`Escribe ${c.que}`);
        if (v.length > c.max) throw fail(`${c.que[0].toUpperCase()}${c.que.slice(1)} es demasiado largo (máximo ${c.max} caracteres)`);
        datos[campo] = v || null;
      }
      if (datos.enlace && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(datos.enlace)) {
        if (/^[^\s]+\.[^\s]+$/.test(datos.enlace)) datos.enlace = `https://${datos.enlace}`;
        else throw fail('El sitio o las redes deben ser una dirección web (por ejemplo, facebook.com/tu-iglesia).');
      }
      const [pendiente] = await sql`select 1 from iglesia_postulaciones where usuario_id = ${yo.id} and estado = 'pendiente'`;
      if (pendiente) throw fail('Ya tienes una postulación en revisión. Te avisaremos cuando la revisemos.', 409);
      const [encargada] = await sql`select 1 from iglesias_anfitrionas where encargado_id = ${yo.id}`;
      if (encargada) throw fail('Ya eres encargado de una iglesia anfitriona.', 409);
      const [{ recientes }] = await sql<{ recientes: number }[]>`
        select count(*)::int as recientes from iglesia_postulaciones where usuario_id = ${yo.id} and creado > now() - interval '30 days'`;
      if (recientes >= POSTULACIONES_MES) throw fail('Ya enviaste varias postulaciones este mes. Escríbenos si necesitas ayuda.', 429);
      const [row] = await sql<{ id: string }[]>`
        insert into iglesia_postulaciones (usuario_id, nombre, ciudad, direccion, denominacion, responsable, cargo, contacto, enlace, mensaje)
        values (${yo.id}, ${datos.nombre}, ${datos.ciudad}, ${datos.direccion}, ${datos.denominacion}, ${datos.responsable},
          ${datos.cargo}, ${datos.contacto}, ${datos.enlace}, ${datos.mensaje})
        returning id`;
      void avisarCuidadores(sql, {
        title: 'Una iglesia quiere ser anfitriona',
        body: `${datos.nombre} (${datos.ciudad}). Revísala en Cuidar Zarza.`,
        url: '/cuidar',
        tag: 'iglesia-postulacion',
      });
      return { postulacion: { id: row.id, nombre: datos.nombre, estado: 'pendiente', motivo: null } };
    },

    /** La última postulación de la persona y, si ya es encargado, el estado de su iglesia. */
    async iglesiaEncargo({ sql, request }) {
      const yo = await auth(sql, request);
      const [postulacion] = await sql<{ id: string; nombre: string; estado: string; motivo: string | null; creado: string }[]>`
        select id, nombre, estado, motivo, creado::text from iglesia_postulaciones where usuario_id = ${yo.id}
        order by creado desc limit 1`;
      const [iglesia] = await sql<(Anfitriona & { miembros: number; semana: number })[]>`
        select i.id, i.nombre, i.ciudad, i.codigo, i.lampara, i.activa, i.pausa,
          (select count(*)::int from iglesia_miembros m where m.iglesia_id = i.id) as miembros,
          (select count(*)::int from iglesia_miembros m where m.iglesia_id = i.id and m.unido > now() - interval '7 days') as semana
        from iglesias_anfitrionas i where i.encargado_id = ${yo.id}`;
      return {
        postulacion: postulacion ?? null,
        iglesia: iglesia ? { ...publica(iglesia), activa: iglesia.activa, pausa: iglesia.pausa, semana: iglesia.semana } : null,
      };
    },

    /** El encargado cambia el código si se filtró. Quienes ya entraron siguen siendo miembros. */
    async iglesiaNuevoCodigo({ sql, request }) {
      const yo = await auth(sql, request);
      for (let intento = 0; intento < 5; intento++) {
        const [row] = await sql<{ codigo: string }[]>`
          update iglesias_anfitrionas set codigo = ${nuevoCodigo()} where encargado_id = ${yo.id}
          returning codigo`.catch((err) => {
          if ((err as { code?: string }).code === '23505') return [] as { codigo: string }[];
          throw err;
        });
        if (row) return { codigo: row.codigo };
        const [encargada] = await sql`select 1 from iglesias_anfitrionas where encargado_id = ${yo.id}`;
        if (!encargada) throw fail('Solo quien está encargado de una iglesia puede cambiar su código.', 403);
      }
      throw fail('No se pudo crear el código, inténtalo de nuevo', 500);
    },
  };
}
