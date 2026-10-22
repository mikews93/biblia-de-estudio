// Señales de un toque sobre los estudios guardados para todos y las preguntas frecuentes de cada pasaje.
// El guion bajo hace que Vercel no la publique como función: va por /api/estudiar, con la misma cuenta.
//
// - «Me ayudó»: ordena lo bueno y no da trabajo de moderación. Una por persona y estudio.
// - «Algo suena raro»: un motivo y una nota corta. Cuando un estudio junta RAROS_AVISO personas, se avisa a quienes
//   cuidan Zarza (CUIDADORES) para que lo revisen en /cuidar y, si hace falta, lo preparen de nuevo.
// - Preguntas frecuentes: las que alguien que cuida Zarza aprobó en /cuidar a partir de las preguntas anónimas
//   (api/_preguntas.ts). Su respuesta se prepara una vez y se guarda para todos, como el estudio.

import type postgres from 'postgres';

import { notifyUser } from './_push';

type Sql = ReturnType<typeof postgres>;

export const RAROS_AVISO = Number(process.env.RAROS_AVISO ?? 3);
export const MOTIVOS = ['texto', 'doctrina', 'dato', 'otro'] as const;
export type Motivo = (typeof MOTIVOS)[number];
const MAX_NOTA = 300;

export const SENALES_SCHEMA = `
create table if not exists estudios_senales (
  clave text not null,
  usuario_id uuid not null references usuarios on delete cascade,
  tipo text not null,
  motivo text,
  nota text,
  creado timestamptz not null default now(),
  primary key (clave, usuario_id, tipo)
);
create index if not exists estudios_senales_tipo on estudios_senales (tipo, clave);
create table if not exists preguntas_frecuentes (
  id bigserial primary key,
  libro text not null,
  capitulo int not null,
  versiculo int,
  texto text not null,
  personas int not null default 0,
  creado timestamptz not null default now()
);
create index if not exists preguntas_frecuentes_pasaje on preguntas_frecuentes (libro, capitulo);
create table if not exists preguntas_revisadas (
  libro text not null,
  capitulo int not null,
  hasta bigint not null,
  primary key (libro, capitulo)
);`;

/** Quienes cuidan Zarza: los correos de CUIDADORES (separados por comas), sin distinguir mayúsculas. */
export const cuidadores = () =>
  (process.env.CUIDADORES ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

export const esCuidador = (correo: string | null | undefined) => !!correo && cuidadores().includes(correo.toLowerCase());

export type Frecuente = { id: number; texto: string; versiculo: number | null };

/** Lo que la app muestra bajo un estudio: cuántos dicen que les ayudó, lo que marcó la persona y las preguntas frecuentes. */
export async function senalesDe(sql: Sql, usuarioId: string, clave: string, libro: string, capitulo: number, versiculo?: number) {
  const [{ ayudo }] = await sql<{ ayudo: number }[]>`
    select count(*)::int as ayudo from estudios_senales where clave = ${clave} and tipo = 'ayudo'`;
  const mias = await sql<{ tipo: string }[]>`
    select tipo from estudios_senales where clave = ${clave} and usuario_id = ${usuarioId}`;
  // En un versículo: las de ese versículo y las del capítulo entero. En el capítulo: todas.
  const frecuentes = await sql<Frecuente[]>`
    select id::int, texto, versiculo from preguntas_frecuentes
    where libro = ${libro} and capitulo = ${capitulo}
      ${versiculo ? sql`and (versiculo is null or versiculo = ${versiculo})` : sql``}
    order by personas desc, id`;
  return {
    ayudo,
    mio: { ayudo: mias.some((m) => m.tipo === 'ayudo'), raro: mias.some((m) => m.tipo === 'raro') },
    frecuentes,
  };
}

/** Marca o quita una señal. Devuelve un mensaje de error si el pedido no es válido. */
export async function marcar(
  sql: Sql,
  usuarioId: string,
  clave: string,
  pasaje: string,
  senal: { tipo?: unknown; quitar?: unknown; motivo?: unknown; nota?: unknown },
): Promise<string | null> {
  if (senal.tipo !== 'ayudo' && senal.tipo !== 'raro') return 'Señal no válida';
  if (senal.quitar === true) {
    await sql`delete from estudios_senales where clave = ${clave} and usuario_id = ${usuarioId} and tipo = ${senal.tipo}`;
    return null;
  }
  if (senal.tipo === 'ayudo') {
    await sql`insert into estudios_senales (clave, usuario_id, tipo) values (${clave}, ${usuarioId}, 'ayudo') on conflict do nothing`;
    return null;
  }
  const motivo = MOTIVOS.includes(senal.motivo as Motivo) ? (senal.motivo as Motivo) : null;
  if (!motivo) return 'Elige qué suena raro';
  const nota = typeof senal.nota === 'string' ? senal.nota.trim().slice(0, MAX_NOTA) || null : null;
  const [nuevo] = await sql`
    insert into estudios_senales (clave, usuario_id, tipo, motivo, nota) values (${clave}, ${usuarioId}, 'raro', ${motivo}, ${nota})
    on conflict (clave, usuario_id, tipo) do update set motivo = excluded.motivo, nota = excluded.nota
    returning (xmax = 0) as nuevo`;
  if (nuevo?.nuevo) {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from estudios_senales where clave = ${clave} and tipo = 'raro'`;
    if (n === RAROS_AVISO) await avisarCuidadores(sql, pasaje, n);
  }
  return null;
}

/** Un aviso a quienes cuidan Zarza (si activaron las notificaciones). Nunca hace fallar la señal. */
async function avisarCuidadores(sql: Sql, pasaje: string, n: number) {
  const correos = cuidadores();
  if (!correos.length) return;
  try {
    const ids = await sql<{ id: string }[]>`select id from usuarios where lower(correo) = any(${correos})`;
    await Promise.all(
      ids.map(({ id }) =>
        notifyUser(sql, id, {
          title: `${n} personas dicen que algo suena raro en ${pasaje}`,
          body: 'Revísalo en «Cuidar Zarza» y, si hace falta, prepara el estudio de nuevo.',
          url: '/cuidar',
          tag: 'cuidar-raros',
        }),
      ),
    );
  } catch (err) {
    console.error('señales: aviso', err);
  }
}
