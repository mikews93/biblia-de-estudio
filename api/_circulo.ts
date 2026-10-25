// «Círculo de solteros»: los solteros adultos de una iglesia anfitriona (api/_iglesias.ts) se conocen en círculos
// pequeños (MAX_CIRCULO personas, por ejemplo por edades) que cuida un líder. Leen y responden juntos la pregunta de
// la semana; cuando dos personas que ya compartieron algunas semanas se marcan en secreto la una a la otra
// («Me gustaría conocerte»), se abre «Conocernos»: siete días con un pasaje y una pregunta que cada uno responde a
// solas (la respuesta del otro se ve cuando los dos respondieron) y una conversación entre los dos.
//
// Cuidados: solo 18+; el líder aprueba cada entrada y recibe los reportes; con REPORTES_PAUSA reportes de personas
// distintas alguien queda en pausa hasta que el líder lo revise; los líderes no leen las conversaciones; las marcas
// son secretas, tienen tope y vencen solas; los mensajes que suenan a estafa muestran un aviso a quien los recibe.
// Las reglas compartidas con la app están en src/lib/circulo.ts.
//
// El «Camino de preparación» (src/lib/camino.ts) son siete etapas cuyas respuestas se quedan en el teléfono; aquí solo
// se guarda qué etapa terminó cada persona y cuándo. Para no poner trabas a la amistad, entrar al círculo pide solo
// ser adulto, que un líder apruebe y responder «Lo que sí importa»; el camino completo se pide para usar «Me
// gustaría conocerte». «Lo que sí importa» son preguntas directas (hijos, misiones, ministerio, estudio y trabajo,
// finanzas), y en el círculo cada uno ve en qué coincide con los demás, sin porcentajes. Si dos dicen sí y no en algo
// que uno no negocia, no pueden marcarse.
//
// Un círculo puede sumar iglesias hermanas de la misma ciudad (sus líderes escriben el código de la otra iglesia): así
// el grupo es más grande y más parejo, porque en casi todas las iglesias hay menos hombres que mujeres. Al entrar se
// pregunta si es hombre o mujer, y los líderes solo ven cuántos hay de cada uno.
//
// Los círculos y sus líderes los crea quien cuida Zarza (/cuidar). El guion bajo hace que Vercel no la publique como
// función: sus acciones van por /api/comunidades, con la misma cuenta y la misma base de Neon.

import type postgres from 'postgres';

import {
  ACUERDO,
  DIAS_CONOCER,
  DIAS_MARCA,
  DIAS_TRAS_CERRAR,
  EDAD_MINIMA,
  MAX_CIRCULO,
  MAX_HERMANAS,
  MAX_MARCAS_ABIERTAS,
  MAX_MARCAS_MES,
  MOTIVOS_REPORTE,
  REPORTES_PAUSA,
  SEMANAS_EN_COMUN,
  type Etapa,
  alertaMensaje,
  diaConocer,
  edad,
  etapaDe,
  fechaValida,
  puedeEntrar,
  semanaDe,
  sexoDe,
} from '../src/lib/circulo';
import { CAMINO, ETAPAS_CAMINO, type Importa, coincidencias, importaValido, progresoCamino } from '../src/lib/camino';
import { limpiarCodigo } from './_iglesias';
import { notifyUser } from './_push';
import { esCuidador } from './_senales';

const MAX_RESPUESTA = 1200;
const MAX_MENSAJE = 1000;
const MENSAJES_HORA = 60;
const MAX_NOMBRE = 60;
/** Durante estos días los mensajes con señales de estafa muestran el aviso. */
const DIAS_ALERTA = 14;

export const CIRCULO_SCHEMA = `
alter table usuarios add column if not exists etapa text;
create table if not exists circulos (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references iglesias_anfitrionas on delete cascade,
  nombre text not null,
  edad_min int,
  edad_max int,
  creado timestamptz not null default now()
);
create table if not exists circulo_lideres (
  circulo_id uuid not null references circulos on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  primary key (circulo_id, usuario_id)
);
create table if not exists circulo_miembros (
  usuario_id uuid primary key references usuarios on delete cascade,
  circulo_id uuid not null references circulos on delete cascade,
  estado text not null default 'pendiente',
  nacimiento date not null,
  creado timestamptz not null default now()
);
create index if not exists circulo_miembros_circulo on circulo_miembros (circulo_id);
create table if not exists circulo_respuestas (
  circulo_id uuid not null references circulos on delete cascade,
  semana date not null,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  creado timestamptz not null default now(),
  primary key (circulo_id, semana, usuario_id)
);
create table if not exists circulo_marcas (
  de uuid not null references usuarios on delete cascade,
  a uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now(),
  primary key (de, a)
);
create table if not exists circulo_marcas_hechas (
  usuario_id uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now()
);
create index if not exists circulo_marcas_hechas_usuario on circulo_marcas_hechas (usuario_id, creado);
create table if not exists circulo_conocer (
  id uuid primary key default gen_random_uuid(),
  circulo_id uuid not null references circulos on delete cascade,
  a uuid not null references usuarios on delete cascade,
  b uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now(),
  acompanado timestamptz,
  terminado timestamptz
);
create index if not exists circulo_conocer_a on circulo_conocer (a);
create index if not exists circulo_conocer_b on circulo_conocer (b);
create table if not exists circulo_conocer_respuestas (
  conocer_id uuid not null references circulo_conocer on delete cascade,
  dia int not null,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  fecha date not null,
  primary key (conocer_id, dia, usuario_id)
);
create table if not exists circulo_mensajes (
  id bigserial primary key,
  conocer_id uuid not null references circulo_conocer on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  alerta text,
  creado timestamptz not null default now()
);
create index if not exists circulo_mensajes_conocer on circulo_mensajes (conocer_id, id);
create table if not exists circulo_reportes (
  id bigserial primary key,
  de uuid not null references usuarios on delete cascade,
  a uuid not null references usuarios on delete cascade,
  circulo_id uuid references circulos on delete cascade,
  motivo text not null,
  detalle text,
  revisado boolean not null default false,
  creado timestamptz not null default now()
);
create index if not exists circulo_reportes_a on circulo_reportes (a) where not revisado;
create table if not exists camino_etapas (
  usuario_id uuid not null references usuarios on delete cascade,
  etapa int not null,
  fecha date not null,
  primary key (usuario_id, etapa)
);
create table if not exists circulo_importa (
  usuario_id uuid primary key references usuarios on delete cascade,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);
create table if not exists circulo_iglesias (
  circulo_id uuid not null references circulos on delete cascade,
  iglesia_id uuid not null references iglesias_anfitrionas on delete cascade,
  creado timestamptz not null default now(),
  primary key (circulo_id, iglesia_id)
);
alter table circulo_miembros add column if not exists sexo text;`;

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Yo = { id: string; nombre: string; correo: string | null };
type Ctx = { sql: Sql; body: Json; request: Request };
type Helpers = { auth: (sql: Sql, request: Request) => Promise<Yo>; fail: (message: string, status?: number) => Error };
type Miembro = { circulo_id: string; estado: 'pendiente' | 'aprobado' | 'pausado'; nacimiento: string; nombre: string; iglesia_id: string };
type Conocer = { id: string; circulo_id: string; a: string; b: string; creado: Date; acompanado: Date | null; terminado: Date | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las acciones del círculo, para sumarlas a las de api/comunidades.ts. */
export function circuloActions({ auth, fail }: Helpers): Record<string, (ctx: Ctx) => Promise<Json>> {
  const hoyDe = (body: Json) => {
    const v = body.hoy;
    if (!fechaValida(v)) throw fail('Fecha no válida');
    return v;
  };
  const idDe = (v: unknown, que = 'Pedido no válido') => {
    if (typeof v !== 'string' || !UUID.test(v)) throw fail(que);
    return v;
  };
  const texto = (v: unknown, max: number, que: string) => {
    const t = typeof v === 'string' ? v.trim().replace(/\n{3,}/g, '\n\n') : '';
    if (!t) throw fail(`Escribe ${que}`);
    if (t.length > max) throw fail(`Es demasiado largo (máximo ${max} caracteres)`);
    return t;
  };

  async function miembroDe(sql: Sql, usuarioId: string) {
    const [m] = await sql<Miembro[]>`
      select m.circulo_id, m.estado, to_char(m.nacimiento, 'YYYY-MM-DD') as nacimiento, c.nombre, c.iglesia_id
      from circulo_miembros m join circulos c on c.id = m.circulo_id where m.usuario_id = ${usuarioId}`;
    return m ?? null;
  }

  async function aprobado(sql: Sql, yo: Yo) {
    const m = await miembroDe(sql, yo.id);
    if (!m) throw fail('Todavía no estás en un círculo.', 404);
    if (m.estado === 'pendiente') throw fail('Un líder todavía no aprueba tu entrada.', 403);
    if (m.estado === 'pausado') throw fail('Tu participación está en pausa hasta que un líder la revise.', 403);
    return m;
  }

  async function lidera(sql: Sql, yo: Yo, circuloId: string) {
    if (esCuidador(yo.correo)) return true;
    const [row] = await sql`select 1 from circulo_lideres where circulo_id = ${circuloId} and usuario_id = ${yo.id}`;
    return !!row;
  }

  async function exigirLider(sql: Sql, yo: Yo, circuloId: string) {
    if (!(await lidera(sql, yo, circuloId))) throw fail('Solo los líderes de este círculo pueden hacer esto.', 403);
  }

  /** El círculo `c` es de la iglesia `iglesia` o la sumó como hermana. */
  const deIglesia = (sql: Sql, iglesia: string) => sql`
    (c.iglesia_id = ${iglesia} or exists (select 1 from circulo_iglesias ci where ci.circulo_id = c.id and ci.iglesia_id = ${iglesia}))`;

  /** La iglesia del círculo primero y después sus hermanas. */
  async function iglesiasDe(sql: Sql, circuloId: string) {
    return sql<{ id: string; nombre: string; ciudad: string | null; propia: boolean }[]>`
      select i.id, i.nombre, i.ciudad, i.id = c.iglesia_id as propia from circulos c
        join iglesias_anfitrionas i on i.id = c.iglesia_id or i.id in (select iglesia_id from circulo_iglesias where circulo_id = c.id)
      where c.id = ${circuloId} order by (i.id = c.iglesia_id) desc, i.nombre`;
  }

  /** Cuántos hombres y mujeres hay en el círculo (sin contar pedidos). Solo números. */
  async function balanceDe(sql: Sql, circuloId: string) {
    const [b] = await sql<{ hombres: number; mujeres: number }[]>`
      select count(*) filter (where sexo = 'h')::int as hombres, count(*) filter (where sexo = 'm')::int as mujeres
      from circulo_miembros where circulo_id = ${circuloId} and estado <> 'pendiente'`;
    return b;
  }

  const bloqueo = (sql: Sql, x: string, y: string) => sql`
    exists (select 1 from bloqueos b where (b.de = ${x} and b.a = ${y}) or (b.de = ${y} and b.a = ${x}))`;

  async function conocerActivo(sql: Sql, usuarioId: string) {
    const [c] = await sql<Conocer[]>`
      select * from circulo_conocer where (a = ${usuarioId} or b = ${usuarioId}) and terminado is null order by creado desc limit 1`;
    return c ?? null;
  }

  async function avisarLideres(sql: Sql, circuloId: string, aviso: { title: string; body: string; tag: string }) {
    const lideres = await sql<{ usuario_id: string }[]>`select usuario_id from circulo_lideres where circulo_id = ${circuloId}`;
    await Promise.all(lideres.map((l) => notifyUser(sql, l.usuario_id, { ...aviso, url: `/circulo/lider/${circuloId}` })));
  }

  /** Semanas en las que las dos personas respondieron la pregunta del círculo. */
  async function enComun(sql: Sql, circuloId: string, x: string, y: string) {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from circulo_respuestas r1 join circulo_respuestas r2
        on r2.circulo_id = r1.circulo_id and r2.semana = r1.semana and r2.usuario_id = ${y}
      where r1.circulo_id = ${circuloId} and r1.usuario_id = ${x}`;
    return n;
  }

  async function marcasMias(sql: Sql, yo: string) {
    const [r] = await sql<{ abiertas: number; mes: number }[]>`
      select
        (select count(*)::int from circulo_marcas where de = ${yo} and creado > now() - make_interval(days => ${DIAS_MARCA})) as abiertas,
        (select count(*)::int from circulo_marcas_hechas where usuario_id = ${yo} and creado > now() - make_interval(days => 30)) as mes`;
    return r;
  }

  /** Termina «Conocernos» y borra las marcas que quedaran entre las dos personas. */
  async function cerrarEntre(sql: Sql, x: string, y: string) {
    await sql`update circulo_conocer set terminado = now() where terminado is null and ((a = ${x} and b = ${y}) or (a = ${y} and b = ${x}))`;
    await sql`delete from circulo_marcas where (de = ${x} and a = ${y}) or (de = ${y} and a = ${x})`;
  }

  /** Sale del círculo: se borran su etapa visible, sus marcas, las que le hicieron, y se cierra su «Conocernos». */
  async function sacar(sql: Sql, usuarioId: string) {
    await sql`delete from circulo_miembros where usuario_id = ${usuarioId}`;
    await sql`delete from circulo_marcas where de = ${usuarioId} or a = ${usuarioId}`;
    await sql`update circulo_conocer set terminado = now() where terminado is null and (a = ${usuarioId} or b = ${usuarioId})`;
  }

  async function etapasHechas(sql: Sql, usuarioId: string) {
    return sql<{ etapa: number; fecha: string }[]>`
      select etapa, to_char(fecha, 'YYYY-MM-DD') as fecha from camino_etapas where usuario_id = ${usuarioId} order by etapa`;
  }

  async function importaDe(sql: Sql, ids: string[]) {
    if (!ids.length) return new Map<string, Importa>();
    const rows = await sql<{ usuario_id: string; datos: Importa }[]>`select usuario_id, datos from circulo_importa where usuario_id in ${sql(ids)}`;
    return new Map(rows.map((r) => [r.usuario_id, r.datos]));
  }

  /** Lo que el círculo ve de «Lo que sí importa» de alguien: su propósito y dónde sirve; las respuestas, solo como coincidencias. */
  const publico = (i: Importa | undefined) => (i ? { proposito: i.proposito || null, sirvo: i.sirvo || null } : { proposito: null, sirvo: null });

  async function conocerDe(sql: Sql, yo: Yo, id: unknown) {
    const [c] = await sql<Conocer[]>`select * from circulo_conocer where id = ${idDe(id)} and (a = ${yo.id} or b = ${yo.id})`;
    if (!c) throw fail('Esa conversación no existe.', 404);
    return { c, otro: c.a === yo.id ? c.b : c.a };
  }

  async function hechosConocer(sql: Sql, id: string) {
    return sql<{ dia: number; fecha: string }[]>`
      select dia, to_char(max(fecha), 'YYYY-MM-DD') as fecha from circulo_conocer_respuestas
      where conocer_id = ${id} group by dia having count(*) = 2 order by dia`;
  }

  async function resumenConocer(sql: Sql, c: Conocer, yo: string, hoy: string) {
    const otroId = c.a === yo ? c.b : c.a;
    const [otro] = await sql<{ id: string; nombre: string; foto: string | null }[]>`select id, nombre, foto from usuarios where id = ${otroId}`;
    const hechos = await hechosConocer(sql, c.id);
    const [{ nuevos }] = await sql<{ nuevos: number }[]>`
      select count(*)::int as nuevos from circulo_mensajes where conocer_id = ${c.id} and usuario_id <> ${yo}
        and creado > coalesce((select max(creado) from circulo_mensajes where conocer_id = ${c.id} and usuario_id = ${yo}), 'epoch')`;
    return { id: c.id, otro, progreso: diaConocer(hechos, hoy), mensajesNuevos: nuevos, terminado: !!c.terminado };
  }

  return {
    /** Todo lo que necesita la pantalla del círculo para la persona. */
    async circuloEstado({ sql, body, request }) {
      const yo = await auth(sql, request);
      const hoy = hoyDe(body);
      const [{ etapa }] = await sql<{ etapa: Etapa | null }[]>`select etapa from usuarios where id = ${yo.id}`;
      const [iglesia] = await sql<{ id: string; nombre: string }[]>`
        select i.id, i.nombre from iglesia_miembros m join iglesias_anfitrionas i on i.id = m.iglesia_id
        where m.usuario_id = ${yo.id} and i.activa`;
      const lidero = await sql<{ id: string; nombre: string; iglesia: string; pendientes: number; reportes: number }[]>`
        select c.id, c.nombre, i.nombre as iglesia,
          (select count(*)::int from circulo_miembros m where m.circulo_id = c.id and m.estado = 'pendiente') as pendientes,
          (select count(*)::int from circulo_reportes r where r.circulo_id = c.id and not r.revisado) as reportes
        from circulo_lideres l join circulos c on c.id = l.circulo_id join iglesias_anfitrionas i on i.id = c.iglesia_id
        where l.usuario_id = ${yo.id} order by c.nombre`;
      const m = await miembroDe(sql, yo.id);
      const importa = (await importaDe(sql, [yo.id])).get(yo.id) ?? null;
      const base = {
        etapa,
        iglesia: iglesia ? { nombre: iglesia.nombre } : null,
        lidero,
        acuerdo: ACUERDO,
        camino: progresoCamino(await etapasHechas(sql, yo.id), hoy),
        importa,
      };

      if (!m) {
        const circulos = iglesia
          ? await sql<{ id: string; nombre: string; edadMin: number | null; edadMax: number | null; miembros: number; hermanas: string[] }[]>`
              select c.id, c.nombre, c.edad_min as "edadMin", c.edad_max as "edadMax",
                (select count(*)::int from circulo_miembros m where m.circulo_id = c.id and m.estado <> 'pendiente') as miembros,
                array(
                  select i.nombre from iglesias_anfitrionas i
                  where i.id <> ${iglesia.id} and (i.id = c.iglesia_id or i.id in (select iglesia_id from circulo_iglesias where circulo_id = c.id))
                  order by i.nombre
                ) as hermanas
              from circulos c where ${deIglesia(sql, iglesia.id)} order by c.edad_min nulls first, c.nombre`
          : [];
        return { ...base, miembro: null, circulos: circulos.map((c) => ({ ...c, lleno: c.miembros >= MAX_CIRCULO })) };
      }

      const iglesias = await iglesiasDe(sql, m.circulo_id);
      const miembro = {
        circulo: { id: m.circulo_id, nombre: m.nombre, iglesias: iglesias.map((i) => i.nombre) },
        estado: m.estado,
        edad: edad(m.nacimiento, hoy),
      };
      if (m.estado !== 'aprobado') return { ...base, miembro };

      const semana = semanaDe(hoy);
      const respuestas = await sql<{ id: string; nombre: string; foto: string | null; texto: string }[]>`
        select u.id, u.nombre, u.foto, r.texto from circulo_respuestas r join usuarios u on u.id = r.usuario_id
        where r.circulo_id = ${m.circulo_id} and r.semana = ${semana.clave}
          and not exists (select 1 from bloqueos b where (b.de = ${yo.id} and b.a = u.id) or (b.de = u.id and b.a = ${yo.id}))
        order by r.creado`;
      const lideres = await sql<{ id: string; nombre: string; foto: string | null }[]>`
        select u.id, u.nombre, u.foto from circulo_lideres l join usuarios u on u.id = l.usuario_id
        where l.circulo_id = ${m.circulo_id} order by u.nombre`;
      // En un círculo con iglesias hermanas, cada persona lleva el nombre de la suya.
      const gente = await sql<{ id: string; nombre: string; foto: string | null; bio: string | null; etapa: Etapa | null; iglesia: string | null }[]>`
        select u.id, u.nombre, u.foto, u.bio, u.etapa,
          ${iglesias.length > 1 ? sql`(select i.nombre from iglesia_miembros im join iglesias_anfitrionas i on i.id = im.iglesia_id where im.usuario_id = u.id limit 1)` : sql`null`} as iglesia
        from circulo_miembros x join usuarios u on u.id = x.usuario_id
        where x.circulo_id = ${m.circulo_id} and x.estado = 'aprobado' and u.id <> ${yo.id}
          and not exists (select 1 from bloqueos b where (b.de = ${yo.id} and b.a = u.id) or (b.de = u.id and b.a = ${yo.id}))
        order by u.nombre`;
      const marcadas = new Set(
        (await sql<{ a: string }[]>`
          select a from circulo_marcas where de = ${yo.id} and creado > now() - make_interval(days => ${DIAS_MARCA})`).map((r) => r.a),
      );
      const activo = await conocerActivo(sql, yo.id);
      const ocupados = new Set(
        (await sql<{ u: string }[]>`
          select a as u from circulo_conocer where terminado is null union select b from circulo_conocer where terminado is null`).map((r) => r.u),
      );
      const cerradosHace = new Set(
        (await sql<{ u: string }[]>`
          select case when a = ${yo.id} then b else a end as u from circulo_conocer
          where (a = ${yo.id} or b = ${yo.id}) and terminado > now() - make_interval(days => ${DIAS_TRAS_CERRAR})`).map((r) => r.u),
      );
      const cuenta = await marcasMias(sql, yo.id);
      const puedoMarcarAlguien =
        etapa === 'abierto' && base.camino.completo && !importa?.solteria && !activo && cuenta.abiertas < MAX_MARCAS_ABIERTAS && cuenta.mes < MAX_MARCAS_MES;
      const suyos = await importaDe(sql, gente.map((g) => g.id));
      const personas = await Promise.all(
        gente.map(async (g) => {
          const comun = await enComun(sql, m.circulo_id, yo.id, g.id);
          const marcada = marcadas.has(g.id);
          const suyo = suyos.get(g.id);
          // Las coincidencias solo entre dos personas abiertas a conocer a alguien.
          const co = importa && suyo && etapa === 'abierto' && g.etapa === 'abierto' && !importa.solteria && !suyo.solteria ? coincidencias(importa, suyo) : null;
          return {
            ...g,
            ...publico(suyo),
            enComun: comun,
            coincidencias: co,
            marcada,
            puedoMarcar:
              !marcada &&
              puedoMarcarAlguien &&
              g.etapa === 'abierto' &&
              !!co &&
              !co.choca &&
              comun >= SEMANAS_EN_COMUN &&
              !ocupados.has(g.id) &&
              !cerradosHace.has(g.id),
          };
        }),
      );
      return {
        ...base,
        miembro,
        lideres,
        semana: {
          ...semana,
          respondi: respuestas.some((r) => r.id === yo.id),
          respuestas: respuestas.map((r) => ({ usuario: { id: r.id, nombre: r.nombre, foto: r.foto }, texto: r.texto, mia: r.id === yo.id })),
        },
        personas,
        marcas: { ...cuenta, maxAbiertas: MAX_MARCAS_ABIERTAS, maxMes: MAX_MARCAS_MES, semanasEnComun: SEMANAS_EN_COMUN, dias: DIAS_MARCA },
        conocer: activo ? await resumenConocer(sql, activo, yo.id, hoy) : null,
      };
    },

    /** Dónde va la persona en el camino de preparación. Lo que escribió no está aquí: vive en su teléfono. */
    async caminoEstado({ sql, body, request }) {
      const yo = await auth(sql, request);
      const hechas = await etapasHechas(sql, yo.id);
      return { hechas, progreso: progresoCamino(hechas, hoyDe(body)), importa: (await importaDe(sql, [yo.id])).get(yo.id) ?? null };
    },

    /** Terminar la etapa que sigue. Las etapas van en orden y con unos días entre una y otra. */
    async caminoTerminar({ sql, body, request }) {
      const yo = await auth(sql, request);
      const hoy = hoyDe(body);
      const etapa = Number(body.etapa);
      if (!CAMINO.some((e) => e.n === etapa)) throw fail('Etapa no válida');
      const hechas = await etapasHechas(sql, yo.id);
      if (hechas.some((h) => h.etapa === etapa)) return { progreso: progresoCamino(hechas, hoy) };
      const prog = progresoCamino(hechas, hoy);
      if (prog.siguiente !== etapa) throw fail('Primero termina las etapas anteriores.');
      if (!prog.abierta) throw fail('Esta etapa todavía no se abre. Tómate estos días para meditar en la anterior.');
      await sql`insert into camino_etapas (usuario_id, etapa, fecha) values (${yo.id}, ${etapa}, ${hoy}) on conflict do nothing`;
      return { progreso: progresoCamino([...hechas, { etapa, fecha: hoy }], hoy) };
    },

    /**
     * «Lo que sí importa». Si la persona dice que se siente llamada a la soltería, queda solo para amistades; si una
     * respuesta nueva choca con alguien que había marcado, esa marca se retira sin que nadie lo sepa.
     */
    async circuloImporta({ sql, body, request }) {
      const yo = await auth(sql, request);
      const importa = importaValido(body.importa);
      if (!importa) throw fail('Responde todas las preguntas.');
      await sql`
        insert into circulo_importa (usuario_id, datos) values (${yo.id}, ${sql.json(importa)})
        on conflict (usuario_id) do update set datos = excluded.datos, actualizado = now()`;
      if (importa.solteria) {
        await sql`update usuarios set etapa = 'soltero' where id = ${yo.id} and etapa = 'abierto'`;
        await sql`delete from circulo_marcas where de = ${yo.id} or a = ${yo.id}`;
      } else {
        const marcas = await sql<{ de: string; a: string }[]>`select de, a from circulo_marcas where de = ${yo.id} or a = ${yo.id}`;
        const otros = await importaDe(sql, marcas.map((x) => (x.de === yo.id ? x.a : x.de)));
        for (const x of marcas) {
          const suyo = otros.get(x.de === yo.id ? x.a : x.de);
          if (!suyo || coincidencias(importa, suyo).choca) await sql`delete from circulo_marcas where de = ${x.de} and a = ${x.a}`;
        }
      }
      return { importa };
    },

    /** La etapa del perfil. Solo la ven los miembros del círculo de la persona. */
    async circuloEtapa({ sql, body, request }) {
      const yo = await auth(sql, request);
      const etapa = body.etapa === null ? null : etapaDe(body.etapa);
      if (body.etapa !== null && !etapa) throw fail('Etapa no válida');
      if (etapa === 'abierto' && (await importaDe(sql, [yo.id])).get(yo.id)?.solteria) {
        throw fail('En «Lo que sí importa» dice que te sientes llamado a la soltería en esta etapa. Cámbialo ahí primero.');
      }
      await sql`update usuarios set etapa = ${etapa} where id = ${yo.id}`;
      // Quien deja de estar abierto o abierta retira sus marcas: nadie llega a saber que existieron.
      if (etapa !== 'abierto') await sql`delete from circulo_marcas where de = ${yo.id}`;
      return { etapa };
    },

    async circuloPedir({ sql, body, request }) {
      const yo = await auth(sql, request);
      const hoy = hoyDe(body);
      const circuloId = idDe(body.circulo, 'Elige un círculo');
      const etapa = etapaDe(body.etapa);
      if (!puedeEntrar(etapa)) throw fail('El círculo es para personas solteras.');
      if (body.acepto !== true) throw fail('Para entrar hay que aceptar el acuerdo del círculo.');
      if (!fechaValida(body.nacimiento)) throw fail('Escribe tu fecha de nacimiento');
      const sexo = sexoDe(body.sexo);
      if (!sexo) throw fail('Elige si eres hombre o mujer');
      const anios = edad(body.nacimiento, hoy);
      if (anios < EDAD_MINIMA) throw fail(`El círculo es solo para mayores de ${EDAD_MINIMA} años.`, 403);
      if (anios > 120) throw fail('Revisa tu fecha de nacimiento');
      const [c] = await sql<{ id: string; nombre: string; edad_min: number | null; edad_max: number | null }[]>`
        select c.id, c.nombre, c.edad_min, c.edad_max from circulos c
          join iglesia_miembros im on im.usuario_id = ${yo.id}
          join iglesias_anfitrionas i on i.id = im.iglesia_id and i.activa
        where c.id = ${circuloId}
          and (c.iglesia_id = im.iglesia_id or exists (select 1 from circulo_iglesias ci where ci.circulo_id = c.id and ci.iglesia_id = im.iglesia_id))`;
      if (!c) throw fail('Ese círculo no es de tu iglesia.', 404);
      if ((c.edad_min && anios < c.edad_min) || (c.edad_max && anios > c.edad_max)) throw fail('Ese círculo es para otra edad. Elige el tuyo.');
      if (await miembroDe(sql, yo.id)) throw fail('Ya estás en un círculo. Sal de él para pedir otro.', 409);
      const mio = (await importaDe(sql, [yo.id])).get(yo.id);
      if (!mio) throw fail('Antes de entrar, responde «Lo que sí importa».', 403);
      if (mio.solteria && etapa === 'abierto') throw fail('Dijiste que te sientes llamado a la soltería en esta etapa: entra solo para hacer amistades.');
      await sql`update usuarios set etapa = ${etapa} where id = ${yo.id}`;
      await sql`insert into circulo_miembros (usuario_id, circulo_id, nacimiento, sexo) values (${yo.id}, ${c.id}, ${body.nacimiento}, ${sexo})`;
      await avisarLideres(sql, c.id, {
        title: `${yo.nombre} quiere entrar a ${c.nombre}`,
        body: 'Revisa su pedido: tú decides si entra al círculo.',
        tag: `circulo-pedido-${c.id}`,
      });
      return {};
    },

    async circuloSalir({ sql, request }) {
      const yo = await auth(sql, request);
      await sacar(sql, yo.id);
      return {};
    },

    async circuloResponder({ sql, body, request }) {
      const yo = await auth(sql, request);
      const m = await aprobado(sql, yo);
      const { clave } = semanaDe(hoyDe(body));
      const t = texto(body.texto, MAX_RESPUESTA, 'tu respuesta');
      await sql`
        insert into circulo_respuestas (circulo_id, semana, usuario_id, texto) values (${m.circulo_id}, ${clave}, ${yo.id}, ${t})
        on conflict (circulo_id, semana, usuario_id) do update set texto = excluded.texto`;
      return {};
    },

    async circuloBorrarRespuesta({ sql, body, request }) {
      const yo = await auth(sql, request);
      const m = await aprobado(sql, yo);
      const { clave } = semanaDe(hoyDe(body));
      await sql`delete from circulo_respuestas where circulo_id = ${m.circulo_id} and semana = ${clave} and usuario_id = ${yo.id}`;
      return {};
    },

    /**
     * «Me gustaría conocerte»: secreto. Si la otra persona ya había marcado a quien marca, se abre «Conocernos» y
     * se avisa a las dos; si no, nadie se entera y la marca vence sola a los DIAS_MARCA días.
     */
    async circuloMarcar({ sql, body, request }) {
      const yo = await auth(sql, request);
      const m = await aprobado(sql, yo);
      const otro = idDe(body.usuario);
      if (otro === yo.id) throw fail('Pedido no válido');
      const [{ etapa }] = await sql<{ etapa: Etapa | null }[]>`select etapa from usuarios where id = ${yo.id}`;
      if (etapa !== 'abierto') throw fail('Para usar «Me gustaría conocerte», marca en tu perfil que estás abierto o abierta a conocer a alguien.');
      const [el] = await sql<{ etapa: Etapa | null; bloqueado: boolean }[]>`
        select u.etapa, ${bloqueo(sql, yo.id, otro)} as bloqueado from circulo_miembros x join usuarios u on u.id = x.usuario_id
        where x.usuario_id = ${otro} and x.circulo_id = ${m.circulo_id} and x.estado = 'aprobado'`;
      if (await conocerActivo(sql, yo.id)) throw fail('Ya estás en «Conocernos» con alguien. Termínalo antes de marcar a otra persona.');
      if (!el || el.bloqueado) throw fail('Esa persona ya no está en tu círculo.', 404);
      if (el.etapa !== 'abierto') throw fail('Esa persona no está abierta a conocer a alguien ahora.');
      if (await conocerActivo(sql, otro)) throw fail('Esa persona no está disponible ahora.');
      const [cerrado] = await sql`
        select 1 from circulo_conocer where ((a = ${yo.id} and b = ${otro}) or (a = ${otro} and b = ${yo.id}))
          and terminado > now() - make_interval(days => ${DIAS_TRAS_CERRAR})`;
      if (cerrado) throw fail('Hace poco cerraron «Conocernos». Denle tiempo.');
      const ambos = await importaDe(sql, [yo.id, otro]);
      const mio = ambos.get(yo.id);
      const suyo = ambos.get(otro);
      if (!progresoCamino(await etapasHechas(sql, yo.id), hoyDe(body)).completo) {
        throw fail(`Para usar «Me gustaría conocerte», termina primero las ${ETAPAS_CAMINO} etapas del camino de preparación.`, 403);
      }
      if (!mio || !suyo || mio.solteria || suyo.solteria) throw fail('Esa persona no está abierta a conocer a alguien ahora.');
      if (coincidencias(mio, suyo).choca) throw fail('Van hacia lugares distintos en algo que uno de los dos no negocia.');
      if ((await enComun(sql, m.circulo_id, yo.id, otro)) < SEMANAS_EN_COMUN) {
        throw fail(`Primero conózcanse en el círculo: respondan los dos al menos ${SEMANAS_EN_COMUN} preguntas de la semana.`);
      }
      await sql`delete from circulo_marcas where creado < now() - make_interval(days => ${DIAS_MARCA})`;
      const [ya] = await sql`select 1 from circulo_marcas where de = ${yo.id} and a = ${otro}`;
      if (ya) return { mutuo: null };
      const cuenta = await marcasMias(sql, yo.id);
      if (cuenta.abiertas >= MAX_MARCAS_ABIERTAS) throw fail(`Puedes tener hasta ${MAX_MARCAS_ABIERTAS} marcas abiertas a la vez. Quita una o espera a que venza.`);
      if (cuenta.mes >= MAX_MARCAS_MES) throw fail(`Ya marcaste a ${MAX_MARCAS_MES} personas este mes. Espera unos días.`);

      const [suya] = await sql`select 1 from circulo_marcas where de = ${otro} and a = ${yo.id}`;
      await sql`insert into circulo_marcas_hechas (usuario_id) values (${yo.id})`;
      if (!suya) {
        await sql`insert into circulo_marcas (de, a) values (${yo.id}, ${otro})`;
        return { mutuo: null };
      }
      // Es mutuo: las dos marcas se vuelven «Conocernos» y las demás marcas de los dos se retiran en silencio.
      const [c] = await sql<{ id: string }[]>`
        insert into circulo_conocer (circulo_id, a, b) values (${m.circulo_id}, ${otro}, ${yo.id}) returning id`;
      await sql`delete from circulo_marcas where de in (${yo.id}, ${otro})`;
      const [{ nombre: suNombre }] = await sql<{ nombre: string }[]>`select nombre from usuarios where id = ${otro}`;
      const aviso = (quien: string) => ({
        title: 'Es mutuo',
        body: `${quien} también quiere conocerte. Empiecen «Conocernos»: siete días con la Palabra.`,
        url: `/circulo/conocer/${c.id}`,
        tag: `conocer-${c.id}`,
      });
      await notifyUser(sql, otro, aviso(yo.nombre.split(' ')[0]));
      await notifyUser(sql, yo.id, aviso(suNombre.split(' ')[0]));
      return { mutuo: c.id };
    },

    async circuloDesmarcar({ sql, body, request }) {
      const yo = await auth(sql, request);
      await sql`delete from circulo_marcas where de = ${yo.id} and a = ${idDe(body.usuario)}`;
      return {};
    },

    async circuloConocer({ sql, body, request }) {
      const yo = await auth(sql, request);
      const hoy = hoyDe(body);
      const { c, otro } = await conocerDe(sql, yo, body.id);
      const resp = await sql<{ dia: number; usuario_id: string; texto: string }[]>`
        select dia, usuario_id, texto from circulo_conocer_respuestas where conocer_id = ${c.id} order by dia`;
      const dias = Array.from({ length: DIAS_CONOCER }, (_, i) => {
        const dia = i + 1;
        const mia = resp.find((r) => r.dia === dia && r.usuario_id === yo.id)?.texto ?? null;
        const suyaRow = resp.find((r) => r.dia === dia && r.usuario_id === otro);
        return { dia, mia, suya: mia && suyaRow ? suyaRow.texto : null, suyaEspera: !!suyaRow && !mia };
      });
      const mensajes = await sql<{ id: number; texto: string; alerta: string | null; mio: boolean; creado: string }[]>`
        select id::int, texto, alerta, usuario_id = ${yo.id} as mio, creado from circulo_mensajes
        where conocer_id = ${c.id} order by id desc limit 200`;
      return {
        conocer: {
          ...(await resumenConocer(sql, c, yo.id, hoy)),
          acompanado: !!c.acompanado,
          dias,
          // Quien recibe un mensaje con señales de estafa ve el aviso; quien lo escribe, no.
          mensajes: mensajes.reverse().map((x) => ({ ...x, alerta: x.mio ? null : x.alerta })),
        },
      };
    },

    async circuloConocerResponder({ sql, body, request }) {
      const yo = await auth(sql, request);
      const hoy = hoyDe(body);
      const { c } = await conocerDe(sql, yo, body.id);
      if (c.terminado) throw fail('«Conocernos» ya terminó.');
      const dia = Number(body.dia);
      if (!Number.isInteger(dia) || dia < 1 || dia > DIAS_CONOCER) throw fail('Día no válido');
      const prog = diaConocer(await hechosConocer(sql, c.id), hoy);
      const [mia] = await sql`select 1 from circulo_conocer_respuestas where conocer_id = ${c.id} and dia = ${dia} and usuario_id = ${yo.id}`;
      if (!mia && (dia !== prog.dia || !prog.abierto)) throw fail('Ese día todavía no se abre.');
      const t = texto(body.texto, MAX_RESPUESTA, 'tu respuesta');
      await sql`
        insert into circulo_conocer_respuestas (conocer_id, dia, usuario_id, texto, fecha) values (${c.id}, ${dia}, ${yo.id}, ${t}, ${hoy})
        on conflict (conocer_id, dia, usuario_id) do update set texto = excluded.texto`;
      return {};
    },

    async circuloMensaje({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { c, otro } = await conocerDe(sql, yo, body.id);
      if (c.terminado) throw fail('Esta conversación ya terminó.');
      const t = texto(body.texto, MAX_MENSAJE, 'un mensaje');
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n from circulo_mensajes where usuario_id = ${yo.id} and creado > now() - interval '1 hour'`;
      if (n >= MENSAJES_HORA) throw fail('Has enviado muchos mensajes seguidos. Espera un rato.', 429);
      const reciente = Date.now() - new Date(c.creado).getTime() < DIAS_ALERTA * 86_400_000;
      const alerta = reciente ? alertaMensaje(t) : null;
      await sql`insert into circulo_mensajes (conocer_id, usuario_id, texto, alerta) values (${c.id}, ${yo.id}, ${t}, ${alerta})`;
      await notifyUser(sql, otro, {
        title: yo.nombre.split(' ')[0],
        body: t.slice(0, 120),
        url: `/circulo/conocer/${c.id}`,
        tag: `conocer-msg-${c.id}`,
      });
      return {};
    },

    /** Cerrar «Conocernos» con libertad: se avisa con delicadeza y no pueden volver a marcarse por un tiempo. */
    async circuloCerrar({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { c, otro } = await conocerDe(sql, yo, body.id);
      if (c.terminado) return {};
      await cerrarEntre(sql, yo.id, otro);
      await notifyUser(sql, otro, {
        title: '«Conocernos» terminó',
        body: 'La otra persona decidió cerrarlo. Un no es normal: pueden seguir siendo hermanos y amigos en el círculo.',
        url: '/circulo',
        tag: `conocer-${c.id}`,
      });
      return {};
    },

    /** Pedir que un líder del círculo los acompañe (para verse con el grupo o conversar). No le muestra los mensajes. */
    async circuloAcompanar({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { c, otro } = await conocerDe(sql, yo, body.id);
      if (c.terminado) throw fail('«Conocernos» ya terminó.');
      await sql`update circulo_conocer set acompanado = now() where id = ${c.id}`;
      const [{ nombre }] = await sql<{ nombre: string }[]>`select nombre from usuarios where id = ${otro}`;
      await avisarLideres(sql, c.circulo_id, {
        title: 'Piden acompañamiento',
        body: `${yo.nombre} y ${nombre} se están conociendo y quieren que un líder los acompañe.`,
        tag: `acompanar-${c.id}`,
      });
      return {};
    },

    async circuloReportar({ sql, body, request }) {
      const yo = await auth(sql, request);
      const otro = idDe(body.usuario);
      if (otro === yo.id) throw fail('Pedido no válido');
      const motivo = typeof body.motivo === 'string' && MOTIVOS_REPORTE.includes(body.motivo) ? body.motivo : null;
      if (!motivo) throw fail('Elige un motivo');
      const detalle = typeof body.detalle === 'string' && body.detalle.trim() ? body.detalle.trim().slice(0, 500) : null;
      const suyo = await miembroDe(sql, otro);
      await sql`insert into circulo_reportes (de, a, circulo_id, motivo, detalle) values (${yo.id}, ${otro}, ${suyo?.circulo_id ?? null}, ${motivo}, ${detalle})`;
      if (body.bloquear === true) {
        await sql`insert into bloqueos (de, a) values (${yo.id}, ${otro}) on conflict do nothing`;
        await sql`delete from amistades where (de = ${yo.id} and para = ${otro}) or (de = ${otro} and para = ${yo.id})`;
        await cerrarEntre(sql, yo.id, otro);
      }
      if (suyo) {
        const [{ n }] = await sql<{ n: number }[]>`
          select count(distinct de)::int as n from circulo_reportes where a = ${otro} and not revisado`;
        if (n >= REPORTES_PAUSA && suyo.estado === 'aprobado') {
          await sql`update circulo_miembros set estado = 'pausado' where usuario_id = ${otro}`;
          await sql`update circulo_conocer set terminado = now() where terminado is null and (a = ${otro} or b = ${otro})`;
        }
        await avisarLideres(sql, suyo.circulo_id, {
          title: 'Un reporte en el círculo',
          body: n >= REPORTES_PAUSA ? 'Una persona quedó en pausa hasta que la revises.' : `Motivo: ${motivo}`,
          tag: `circulo-reporte-${suyo.circulo_id}`,
        });
      }
      return {};
    },

    /** Lo que ve un líder de su círculo: pedidos, miembros y reportes. Nunca las conversaciones. */
    async circuloLider({ sql, body, request }) {
      const yo = await auth(sql, request);
      const id = idDe(body.circulo);
      const hoy = hoyDe(body);
      await exigirLider(sql, yo, id);
      const [c] = await sql<{ id: string; nombre: string; iglesia: string; edadMin: number | null; edadMax: number | null }[]>`
        select c.id, c.nombre, i.nombre as iglesia, c.edad_min as "edadMin", c.edad_max as "edadMax"
        from circulos c join iglesias_anfitrionas i on i.id = c.iglesia_id where c.id = ${id}`;
      if (!c) throw fail('Ese círculo no existe.', 404);
      const iglesias = await iglesiasDe(sql, id);
      const gente = await sql<{ id: string; nombre: string; foto: string | null; bio: string | null; correo: string | null; etapa: Etapa | null; estado: string; nacimiento: string; iglesia: string | null }[]>`
        select u.id, u.nombre, u.foto, u.bio, u.correo, u.etapa, m.estado, to_char(m.nacimiento, 'YYYY-MM-DD') as nacimiento,
          (select i.nombre from iglesia_miembros im join iglesias_anfitrionas i on i.id = im.iglesia_id where im.usuario_id = u.id limit 1) as iglesia
        from circulo_miembros m join usuarios u on u.id = m.usuario_id where m.circulo_id = ${id} order by m.creado`;
      const reportes = await sql<{ id: number; motivo: string; detalle: string | null; creado: string; de: string; a: string; aId: string }[]>`
        select r.id::int, r.motivo, r.detalle, r.creado, d.nombre as de, x.nombre as a, x.id as "aId"
        from circulo_reportes r join usuarios d on d.id = r.de join usuarios x on x.id = r.a
        where r.circulo_id = ${id} and not r.revisado order by r.creado desc`;
      const [{ conociendose }] = await sql<{ conociendose: number }[]>`
        select count(*)::int as conociendose from circulo_conocer where circulo_id = ${id} and terminado is null`;
      const importas = await importaDe(sql, gente.map((g) => g.id));
      const terminaron = new Map(
        (gente.length
          ? await sql<{ usuario_id: string; fecha: string }[]>`
              select usuario_id, to_char(max(fecha), 'YYYY-MM-DD') as fecha from camino_etapas
              where usuario_id in ${sql(gente.map((g) => g.id))} group by usuario_id having count(*) >= ${ETAPAS_CAMINO}`
          : []
        ).map((r) => [r.usuario_id, r.fecha]),
      );
      // Para las iglesias del círculo, solo números: cuántas personas van en cada etapa del camino. Nunca quiénes ni qué
      // escribieron.
      const porEtapa = await sql<{ hechas: number; n: number }[]>`
        select e.hechas, count(*)::int as n from (
          select ce.usuario_id, count(*)::int as hechas from camino_etapas ce
            join iglesia_miembros im on im.usuario_id = ce.usuario_id and im.iglesia_id in ${sql(iglesias.map((i) => i.id))}
          group by ce.usuario_id
        ) e group by e.hechas`;
      const camino = Array.from({ length: ETAPAS_CAMINO }, (_, i) => porEtapa.find((r) => r.hechas === i + 1)?.n ?? 0);
      const persona = (g: (typeof gente)[number]) => ({
        id: g.id, nombre: g.nombre, foto: g.foto, bio: g.bio, correo: g.correo, etapa: g.etapa, edad: edad(g.nacimiento, hoy),
        ...publico(importas.get(g.id)),
        solteria: !!importas.get(g.id)?.solteria,
        caminoTerminado: terminaron.get(g.id) ?? null,
        iglesia: iglesias.length > 1 ? g.iglesia : null,
      });
      return {
        circulo: { ...c, max: MAX_CIRCULO },
        pendientes: gente.filter((g) => g.estado === 'pendiente').map(persona),
        miembros: gente.filter((g) => g.estado !== 'pendiente').map((g) => ({ ...persona(g), pausado: g.estado === 'pausado' })),
        reportes,
        conociendose,
        camino,
        iglesias: iglesias.map(({ id: iid, nombre, ciudad, propia }) => ({ id: iid, nombre, ciudad, propia })),
        maxHermanas: MAX_HERMANAS,
        balance: await balanceDe(sql, id),
      };
    },

    /**
     * Sumar una iglesia hermana al círculo con el código de esa iglesia (quien lo tiene es parte de ella), o quitarla.
     * Quienes ya entraron desde ella se quedan; solo deja de aceptar pedidos nuevos de esa iglesia.
     */
    async circuloHermana({ sql, body, request }) {
      const yo = await auth(sql, request);
      const id = idDe(body.circulo);
      await exigirLider(sql, yo, id);
      if (body.quitar === true) {
        await sql`delete from circulo_iglesias where circulo_id = ${id} and iglesia_id = ${idDe(body.iglesia)}`;
        return {};
      }
      const codigo = limpiarCodigo(body.codigo);
      if (!codigo) throw fail('Escribe el código de la otra iglesia');
      const [i] = await sql<{ id: string; nombre: string; activa: boolean }[]>`select id, nombre, activa from iglesias_anfitrionas where codigo = ${codigo}`;
      if (!i || !i.activa) throw fail('No hay ninguna iglesia activa con ese código.', 404);
      const iglesias = await iglesiasDe(sql, id);
      if (iglesias.some((x) => x.id === i.id)) throw fail(`${i.nombre} ya está en este círculo.`);
      if (iglesias.length - 1 >= MAX_HERMANAS) throw fail(`Un círculo puede sumar hasta ${MAX_HERMANAS} iglesias hermanas.`);
      await sql`insert into circulo_iglesias (circulo_id, iglesia_id) values (${id}, ${i.id}) on conflict do nothing`;
      return { iglesia: { id: i.id, nombre: i.nombre } };
    },

    async circuloAprobar({ sql, body, request }) {
      const yo = await auth(sql, request);
      const usuario = idDe(body.usuario);
      const m = await miembroDe(sql, usuario);
      if (!m || m.estado !== 'pendiente') throw fail('Ese pedido ya no está.', 404);
      await exigirLider(sql, yo, m.circulo_id);
      if (body.si === true) {
        const [{ n }] = await sql<{ n: number }[]>`
          select count(*)::int as n from circulo_miembros where circulo_id = ${m.circulo_id} and estado <> 'pendiente'`;
        if (n >= MAX_CIRCULO) throw fail(`El círculo ya tiene ${MAX_CIRCULO} personas. Pide a quien cuida Zarza que abra otro.`);
        await sql`update circulo_miembros set estado = 'aprobado' where usuario_id = ${usuario}`;
        await notifyUser(sql, usuario, {
          title: `Bienvenido a ${m.nombre}`,
          body: 'Tu entrada al círculo fue aprobada. Lee la pregunta de esta semana.',
          url: '/circulo',
          tag: 'circulo-aprobado',
        });
      } else {
        await sql`delete from circulo_miembros where usuario_id = ${usuario}`;
        await notifyUser(sql, usuario, {
          title: 'Tu pedido al círculo',
          body: 'Esta vez no fue aprobado. Si quieres saber por qué, habla con un líder de tu iglesia.',
          url: '/circulo',
          tag: 'circulo-aprobado',
        });
      }
      return {};
    },

    /** Reactivar a alguien en pausa (los reportes quedan revisados), pausarlo o quitarlo del círculo. */
    async circuloRevisar({ sql, body, request }) {
      const yo = await auth(sql, request);
      const usuario = idDe(body.usuario);
      const m = await miembroDe(sql, usuario);
      if (!m) throw fail('Esa persona ya no está en el círculo.', 404);
      await exigirLider(sql, yo, m.circulo_id);
      if (body.que === 'reactivar') {
        await sql`update circulo_miembros set estado = 'aprobado' where usuario_id = ${usuario}`;
        await sql`update circulo_reportes set revisado = true where a = ${usuario}`;
      } else if (body.que === 'pausar') {
        await sql`update circulo_miembros set estado = 'pausado' where usuario_id = ${usuario}`;
        await sql`update circulo_conocer set terminado = now() where terminado is null and (a = ${usuario} or b = ${usuario})`;
      } else if (body.que === 'quitar') {
        await sacar(sql, usuario);
        await sql`update circulo_reportes set revisado = true where a = ${usuario}`;
      } else if (body.que === 'revisado') {
        await sql`update circulo_reportes set revisado = true where a = ${usuario} and circulo_id = ${m.circulo_id}`;
      } else throw fail('Pedido no válido');
      return {};
    },

    // --- Para quien cuida Zarza (/cuidar): crear círculos en una iglesia anfitriona y nombrar a sus líderes. ---

    async cuidarCirculos({ sql, body, request }) {
      const yo = await auth(sql, request);
      if (!esCuidador(yo.correo)) throw fail('Solo quienes cuidan Zarza pueden ver esto.', 403);
      const iglesia = idDe(body.iglesia);
      const circulos = await sql<
        { id: string; nombre: string; edadMin: number | null; edadMax: number | null; miembros: number; pendientes: number; hombres: number; mujeres: number; hermanas: string[] }[]
      >`
        select c.id, c.nombre, c.edad_min as "edadMin", c.edad_max as "edadMax",
          (select count(*)::int from circulo_miembros m where m.circulo_id = c.id and m.estado <> 'pendiente') as miembros,
          (select count(*)::int from circulo_miembros m where m.circulo_id = c.id and m.estado = 'pendiente') as pendientes,
          (select count(*)::int from circulo_miembros m where m.circulo_id = c.id and m.estado <> 'pendiente' and m.sexo = 'h') as hombres,
          (select count(*)::int from circulo_miembros m where m.circulo_id = c.id and m.estado <> 'pendiente' and m.sexo = 'm') as mujeres,
          array(select i.nombre from circulo_iglesias ci join iglesias_anfitrionas i on i.id = ci.iglesia_id where ci.circulo_id = c.id order by i.nombre) as hermanas
        from circulos c where c.iglesia_id = ${iglesia} order by c.edad_min nulls first, c.nombre`;
      const lideres = await sql<{ circulo_id: string; id: string; nombre: string; correo: string | null }[]>`
        select l.circulo_id, u.id, u.nombre, u.correo from circulo_lideres l join usuarios u on u.id = l.usuario_id
        join circulos c on c.id = l.circulo_id where c.iglesia_id = ${iglesia} order by u.nombre`;
      return {
        circulos: circulos.map((c) => ({
          ...c,
          max: MAX_CIRCULO,
          lideres: lideres.filter((l) => l.circulo_id === c.id).map(({ id, nombre, correo }) => ({ id, nombre, correo })),
        })),
      };
    },

    async cuidarNuevoCirculo({ sql, body, request }) {
      const yo = await auth(sql, request);
      if (!esCuidador(yo.correo)) throw fail('Solo quienes cuidan Zarza pueden hacer esto.', 403);
      const iglesia = idDe(body.iglesia);
      const nombre = texto(body.nombre, MAX_NOMBRE, 'el nombre del círculo');
      const edadDe = (v: unknown) => {
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < EDAD_MINIMA || n > 120) throw fail(`Las edades van de ${EDAD_MINIMA} en adelante`);
        return n;
      };
      const min = edadDe(body.edadMin);
      const max = edadDe(body.edadMax);
      if (min && max && min > max) throw fail('La edad mínima es mayor que la máxima');
      const [ok] = await sql`select 1 from iglesias_anfitrionas where id = ${iglesia}`;
      if (!ok) throw fail('Esa iglesia no existe', 404);
      const [c] = await sql<{ id: string }[]>`
        insert into circulos (iglesia_id, nombre, edad_min, edad_max) values (${iglesia}, ${nombre}, ${min}, ${max}) returning id`;
      return { id: c.id };
    },

    async cuidarLiderCirculo({ sql, body, request }) {
      const yo = await auth(sql, request);
      if (!esCuidador(yo.correo)) throw fail('Solo quienes cuidan Zarza pueden hacer esto.', 403);
      const circulo = idDe(body.circulo);
      if (body.quitar === true) {
        await sql`delete from circulo_lideres where circulo_id = ${circulo} and usuario_id = ${idDe(body.usuario)}`;
        return {};
      }
      const correo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : '';
      if (!correo) throw fail('Escribe el correo del líder');
      const [u] = await sql<{ id: string; nombre: string }[]>`select id, nombre from usuarios where lower(correo) = ${correo}`;
      if (!u) throw fail('No hay ninguna cuenta con ese correo. Pídele que se registre primero.', 404);
      await sql`insert into circulo_lideres (circulo_id, usuario_id) values (${circulo}, ${u.id}) on conflict do nothing`;
      await notifyUser(sql, u.id, {
        title: 'Ahora eres líder de un círculo',
        body: 'Aprueba a quienes pidan entrar y acompaña al grupo.',
        url: `/circulo/lider/${circulo}`,
        tag: `circulo-lider-${circulo}`,
      });
      return {};
    },

    async cuidarBorrarCirculo({ sql, body, request }) {
      const yo = await auth(sql, request);
      if (!esCuidador(yo.correo)) throw fail('Solo quienes cuidan Zarza pueden hacer esto.', 403);
      await sql`delete from circulos where id = ${idDe(body.circulo)}`;
      return {};
    },
  };
}
