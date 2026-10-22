// «Zarza para Iglesias»: una iglesia que sostiene Zarza cada mes es «anfitriona». Quien la cuida en /cuidar la da de
// alta y recibe un código (con su QR) para sus miembros; quien entra con él tiene una lámpara diaria más grande.
// El pago se arregla fuera de la app (en la web, ver src/lib/sostener.ts): aquí solo se activa o se pausa.
//
// El guion bajo hace que Vercel no la publique como función: sus acciones van por /api/comunidades, con la misma
// cuenta y la misma base de Neon. La lámpara (api/_cuenta.ts) lee iglesias_anfitrionas para saber el tope.

import { randomInt } from 'node:crypto';
import type postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Yo = { id: string };
type Ctx = { sql: Sql; body: Json; request: Request };
type Helpers = { auth: (sql: Sql, request: Request) => Promise<Yo>; fail: (message: string, status?: number) => Error };

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
/** Preguntas al día para los miembros de una iglesia anfitriona, si no se dice otra cosa al darla de alta. */
export const LAMPARA_IGLESIA = Number(process.env.LAMPARA_IGLESIA ?? 40);

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
create index if not exists iglesia_miembros_iglesia on iglesia_miembros (iglesia_id);`;

export type Anfitriona = { id: string; nombre: string; ciudad: string | null; codigo: string; lampara: number; activa: boolean };

export const nuevoCodigo = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
export const limpiarCodigo = (v: unknown) =>
  String(v ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

/** La iglesia anfitriona de la persona, o null. */
export async function iglesiaDe(sql: Sql, usuarioId: string) {
  const [row] = await sql<(Anfitriona & { miembros: number })[]>`
    select i.id, i.nombre, i.ciudad, i.codigo, i.lampara, i.activa,
      (select count(*)::int from iglesia_miembros x where x.iglesia_id = i.id) as miembros
    from iglesia_miembros m join iglesias_anfitrionas i on i.id = m.iglesia_id where m.usuario_id = ${usuarioId}`;
  return row ?? null;
}

/** Las acciones de los miembros, para sumarlas a las de api/comunidades.ts. */
export function iglesiaActions({ auth, fail }: Helpers): Record<string, (ctx: Ctx) => Promise<Json>> {
  async function porCodigo(sql: Sql, codigo: unknown) {
    const [row] = await sql<(Anfitriona & { miembros: number })[]>`
      select i.id, i.nombre, i.ciudad, i.codigo, i.lampara, i.activa,
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
      await sql`
        insert into iglesia_miembros (usuario_id, iglesia_id) values (${yo.id}, ${iglesia.id})
        on conflict (usuario_id) do update set iglesia_id = excluded.iglesia_id, unido = now()`;
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
  };
}
