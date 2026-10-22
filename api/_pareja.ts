// «En pareja»: dos cuentas se unen con un código de invitación y hacen juntas los planes de src/lib/parejaPlanes.ts.
// Cada uno responde la pregunta del día por su cuenta y la respuesta del otro se ve cuando los dos respondieron;
// cada uno deja un pedido de oración y el otro marca «oré por ti». Todo es privado para los dos.
//
// El guion bajo hace que Vercel no la publique como función: sus acciones (las que empiezan por «pareja») van por
// /api/comunidades, con la misma cuenta y la misma base de Neon.
//
// La pantalla de ayuda en caso de abuso no pasa por aquí: no se registra en ningún lado.

import { randomInt } from 'node:crypto';
import type postgres from 'postgres';

import { cordon, progreso } from '../src/lib/pareja';
import { DIAS_PLAN, type Etapa, planPareja, planesPara } from '../src/lib/parejaPlanes';
import { notifyUser } from './_push';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_RESPUESTA = 1500;
const MAX_PEDIDO = 300;
const ETAPAS: Etapa[] = ['novios', 'casados'];

export const PAREJA_SCHEMA = `
create table if not exists parejas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  a uuid not null references usuarios on delete cascade,
  b uuid references usuarios on delete cascade,
  etapa text not null,
  plan text not null,
  creado timestamptz not null default now()
);
create unique index if not exists parejas_a on parejas (a);
create unique index if not exists parejas_b on parejas (b) where b is not null;
create table if not exists pareja_respuestas (
  pareja_id uuid not null references parejas on delete cascade,
  plan text not null,
  dia int not null,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  fecha date not null,
  creado timestamptz not null default now(),
  primary key (pareja_id, plan, dia, usuario_id)
);
create table if not exists pareja_pedidos (
  pareja_id uuid not null references parejas on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  creado timestamptz not null default now(),
  primary key (pareja_id, usuario_id)
);
create table if not exists pareja_orado (
  pareja_id uuid not null references parejas on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  fecha date not null,
  primary key (pareja_id, usuario_id, fecha)
);`;

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Yo = { id: string; nombre: string };
type Ctx = { sql: Sql; body: Json; request: Request };
type Helpers = { auth: (sql: Sql, request: Request) => Promise<Yo>; fail: (message: string, status?: number) => Error };
type Fila = { id: string; codigo: string | null; a: string; b: string | null; etapa: Etapa; plan: string };

const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** Las acciones de la pareja, para sumarlas a las de api/comunidades.ts. */
export function parejaActions({ auth, fail }: Helpers): Record<string, (ctx: Ctx) => Promise<Json>> {
  const hoyDe = (body: Json) => {
    const v = body.hoy;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) throw fail('Fecha no válida');
    return v;
  };
  const texto = (v: unknown, max: number, que: string) => {
    const t = typeof v === 'string' ? v.trim().replace(/\n{3,}/g, '\n\n') : '';
    if (!t) throw fail(`Escribe ${que}`);
    if (t.length > max) throw fail(`Es demasiado largo (máximo ${max} caracteres)`);
    return t;
  };
  const planDe = (fila: Fila, v: unknown) => {
    const plan = typeof v === 'string' ? planPareja(v) : undefined;
    if (!plan || !planesPara(fila.etapa).includes(plan)) throw fail('Plan no válido');
    return plan;
  };
  const diaDe = (v: unknown) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > DIAS_PLAN) throw fail('Día no válido');
    return n;
  };

  async function mia(sql: Sql, yo: Yo) {
    const [fila] = await sql<Fila[]>`select id, codigo, a, b, etapa, plan from parejas where a = ${yo.id} or b = ${yo.id}`;
    return fila ?? null;
  }

  /** La pareja ya unida (con las dos cuentas), o un error. */
  async function unida(sql: Sql, yo: Yo) {
    const fila = await mia(sql, yo);
    if (!fila) throw fail('Todavía no estás unido a tu pareja en la app.', 404);
    if (!fila.b) throw fail('Tu pareja todavía no aceptó la invitación.', 409);
    return { fila, otro: fila.a === yo.id ? fila.b : fila.a };
  }

  /** Fecha en que los dos terminaron cada día de un plan. */
  async function hechos(sql: Sql, parejaId: string, plan?: string) {
    const rows = await sql<{ plan: string; dia: number; fecha: string }[]>`
      select plan, dia, to_char(max(fecha), 'YYYY-MM-DD') as fecha from pareja_respuestas
      where pareja_id = ${parejaId} ${plan ? sql`and plan = ${plan}` : sql``}
      group by plan, dia having count(*) = 2`;
    return rows;
  }

  async function estado(sql: Sql, yo: Yo, hoy: string) {
    const fila = await mia(sql, yo);
    if (!fila) return { pareja: null };
    const otroId = fila.a === yo.id ? fila.b : fila.a;
    const [otro] = otroId
      ? await sql<{ nombre: string; foto: string | null }[]>`select nombre, foto from usuarios where id = ${otroId}`
      : [];
    const base = { id: fila.id, etapa: fila.etapa, plan: fila.plan, soyQuienInvito: fila.a === yo.id };
    if (!otroId || !otro) return { pareja: { ...base, codigo: fila.codigo, otro: null } };

    const todos = await hechos(sql, fila.id);
    const delPlan: Record<number, string> = {};
    const porPlan: Record<string, number> = {};
    for (const r of todos) {
      porPlan[r.plan] = (porPlan[r.plan] ?? 0) + 1;
      if (r.plan === fila.plan) delPlan[r.dia] = r.fecha;
    }
    const respondi = await sql<{ dia: number }[]>`
      select dia from pareja_respuestas where pareja_id = ${fila.id} and plan = ${fila.plan} and usuario_id = ${yo.id}`;
    const respondio = await sql<{ dia: number }[]>`
      select dia from pareja_respuestas where pareja_id = ${fila.id} and plan = ${fila.plan} and usuario_id = ${otroId}`;
    const pedidos = await sql<{ usuario_id: string; texto: string }[]>`
      select usuario_id, texto from pareja_pedidos where pareja_id = ${fila.id}`;
    const orado = await sql<{ usuario_id: string }[]>`
      select usuario_id from pareja_orado where pareja_id = ${fila.id} and fecha = ${hoy}`;
    return {
      pareja: {
        ...base,
        codigo: null,
        otro: { nombre: otro.nombre, foto: otro.foto },
        hechos: delPlan,
        progreso: progreso(delPlan, hoy),
        respondi: respondi.map((r) => r.dia),
        respondio: respondio.map((r) => r.dia),
        planes: porPlan,
        cordon: cordon(
          todos.map((r) => r.fecha),
          hoy,
        ),
        pedidos: {
          mio: pedidos.find((p) => p.usuario_id === yo.id)?.texto ?? null,
          suyo: pedidos.find((p) => p.usuario_id === otroId)?.texto ?? null,
        },
        oreHoy: orado.some((o) => o.usuario_id === yo.id),
        oroHoy: orado.some((o) => o.usuario_id === otroId),
      },
    };
  }

  return {
    async parejaEstado({ sql, body, request }) {
      const yo = await auth(sql, request);
      return estado(sql, yo, hoyDe(body));
    },

    /** Crea la invitación (o devuelve la que ya estaba esperando). */
    async parejaInvitar({ sql, body, request }) {
      const yo = await auth(sql, request);
      const etapa = ETAPAS.includes(body.etapa as Etapa) ? (body.etapa as Etapa) : null;
      if (!etapa) throw fail('Elige si son novios o casados');
      const fila = await mia(sql, yo);
      if (fila?.b) throw fail('Ya estás unido a tu pareja.', 409);
      const plan = planesPara(etapa)[0].id;
      if (fila) await sql`update parejas set etapa = ${etapa}, plan = ${plan} where id = ${fila.id}`;
      else {
        for (let intento = 0; ; intento++) {
          try {
            await sql`insert into parejas (codigo, a, etapa, plan) values (${newCode()}, ${yo.id}, ${etapa}, ${plan})`;
            break;
          } catch (err) {
            // Un código repetido (muy raro): se prueba otro.
            if (intento > 4 || (err as { code?: string }).code !== '23505') throw err;
          }
        }
      }
      return estado(sql, yo, hoyDe(body));
    },

    /** Quién invita, para mostrarlo antes de aceptar. */
    async parejaVerCodigo({ sql, body, request }) {
      const yo = await auth(sql, request);
      const codigo = typeof body.codigo === 'string' ? body.codigo.trim().toUpperCase() : '';
      const [fila] = await sql<{ a: string; nombre: string; foto: string | null; etapa: Etapa }[]>`
        select p.a, u.nombre, u.foto, p.etapa from parejas p join usuarios u on u.id = p.a where p.codigo = ${codigo} and p.b is null`;
      if (!fila) throw fail('Ese código no existe o ya se usó. Pídele a tu pareja uno nuevo.', 404);
      return { nombre: fila.nombre, foto: fila.foto, etapa: fila.etapa, esMio: fila.a === yo.id };
    },

    async parejaUnirse({ sql, body, request }) {
      const yo = await auth(sql, request);
      const codigo = typeof body.codigo === 'string' ? body.codigo.trim().toUpperCase() : '';
      const actual = await mia(sql, yo);
      if (actual?.b) throw fail('Ya estás unido a una pareja. Para unirte a otra, primero desvincúlate.', 409);
      const [fila] = await sql<Fila[]>`select id, codigo, a, b, etapa, plan from parejas where codigo = ${codigo} and b is null`;
      if (!fila) throw fail('Ese código no existe o ya se usó. Pídele a tu pareja uno nuevo.', 404);
      if (fila.a === yo.id) throw fail('Esta invitación es tuya: compártela con tu pareja.');
      await sql.begin(async (tx) => {
        // La invitación propia que estaba esperando ya no hace falta.
        if (actual) await tx`delete from parejas where id = ${actual.id}`;
        await tx`update parejas set b = ${yo.id}, codigo = null where id = ${fila.id}`;
      });
      await notifyUser(sql, fila.a, {
        title: `${yo.nombre} aceptó tu invitación`,
        body: 'Ya pueden empezar su primer plan en pareja.',
        url: '/pareja',
        tag: `pareja-${fila.id}`,
      });
      return estado(sql, yo, hoyDe(body));
    },

    async parejaPlan({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { fila } = await unida(sql, yo);
      const plan = planDe(fila, body.plan);
      await sql`update parejas set plan = ${plan.id} where id = ${fila.id}`;
      return estado(sql, yo, hoyDe(body));
    },

    async parejaEtapa({ sql, body, request }) {
      const yo = await auth(sql, request);
      const fila = await mia(sql, yo);
      if (!fila) throw fail('Todavía no estás unido a tu pareja en la app.', 404);
      const etapa = ETAPAS.includes(body.etapa as Etapa) ? (body.etapa as Etapa) : null;
      if (!etapa) throw fail('Etapa no válida');
      const plan = planesPara(etapa).some((x) => x.id === fila.plan) ? fila.plan : planesPara(etapa)[0].id;
      await sql`update parejas set etapa = ${etapa}, plan = ${plan} where id = ${fila.id}`;
      return estado(sql, yo, hoyDe(body));
    },

    /** Un día: lo que respondí y, si ya respondí, lo que respondió mi pareja. */
    async parejaDia({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { fila, otro } = await unida(sql, yo);
      const plan = planDe(fila, body.plan);
      const dia = diaDe(body.dia);
      const rows = await sql<{ usuario_id: string; texto: string; fecha: string }[]>`
        select usuario_id, texto, to_char(fecha, 'YYYY-MM-DD') as fecha from pareja_respuestas
        where pareja_id = ${fila.id} and plan = ${plan.id} and dia = ${dia}`;
      const mia_ = rows.find((r) => r.usuario_id === yo.id);
      const suya = rows.find((r) => r.usuario_id === otro);
      const delPlan: Record<number, string> = {};
      for (const r of await hechos(sql, fila.id, plan.id)) delPlan[r.dia] = r.fecha;
      const p = progreso(delPlan, hoyDe(body));
      return {
        abierto: !!delPlan[dia] || !!mia_ || (dia === p.dia && p.abierto),
        mia: mia_ ? { texto: mia_.texto, fecha: mia_.fecha } : null,
        // La respuesta del otro solo se manda a quien ya respondió.
        suya: suya && mia_ ? { texto: suya.texto, fecha: suya.fecha } : null,
        suyaEspera: !!suya && !mia_,
      };
    },

    async parejaResponder({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { fila, otro } = await unida(sql, yo);
      const plan = planDe(fila, body.plan);
      const dia = diaDe(body.dia);
      const hoy = hoyDe(body);
      const t = texto(body.texto, MAX_RESPUESTA, 'tu respuesta');
      const delPlan: Record<number, string> = {};
      for (const r of await hechos(sql, fila.id, plan.id)) delPlan[r.dia] = r.fecha;
      const p = progreso(delPlan, hoy);
      const [ya] = await sql`select 1 from pareja_respuestas where pareja_id = ${fila.id} and plan = ${plan.id} and dia = ${dia} and usuario_id = ${yo.id}`;
      if (!ya && !(dia === p.dia && p.abierto)) throw fail('Este día todavía no se abre.', 409);
      await sql`
        insert into pareja_respuestas (pareja_id, plan, dia, usuario_id, texto, fecha)
        values (${fila.id}, ${plan.id}, ${dia}, ${yo.id}, ${t}, ${hoy})
        on conflict (pareja_id, plan, dia, usuario_id) do update set texto = excluded.texto`;
      // Al responder el segundo, se avisa al primero que ya pueden ver los dos. Nunca «tu pareja respondió y tú no».
      if (!ya) {
        const [suya] = await sql`select 1 from pareja_respuestas where pareja_id = ${fila.id} and plan = ${plan.id} and dia = ${dia} and usuario_id = ${otro}`;
        if (suya) {
          await notifyUser(sql, otro, {
            title: `${yo.nombre} también respondió`,
            body: 'Ya pueden ver lo que escribió cada uno.',
            url: `/pareja/${plan.id}/${dia}`,
            tag: `pareja-dia-${plan.id}-${dia}`,
          });
        }
      }
      return {};
    },

    async parejaBorrarRespuesta({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { fila } = await unida(sql, yo);
      const plan = planDe(fila, body.plan);
      const dia = diaDe(body.dia);
      await sql`delete from pareja_respuestas where pareja_id = ${fila.id} and plan = ${plan.id} and dia = ${dia} and usuario_id = ${yo.id}`;
      return {};
    },

    /** Mi pedido de oración (uno a la vez). Vacío lo quita. */
    async parejaPedido({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { fila } = await unida(sql, yo);
      const raw = typeof body.texto === 'string' ? body.texto.trim() : '';
      if (!raw) await sql`delete from pareja_pedidos where pareja_id = ${fila.id} and usuario_id = ${yo.id}`;
      else {
        const t = texto(raw, MAX_PEDIDO, 'tu pedido');
        await sql`
          insert into pareja_pedidos (pareja_id, usuario_id, texto) values (${fila.id}, ${yo.id}, ${t})
          on conflict (pareja_id, usuario_id) do update set texto = excluded.texto, creado = now()`;
      }
      return estado(sql, yo, hoyDe(body));
    },

    /** «Oré por ti»: una vez al día, con un aviso a la pareja. */
    async parejaOre({ sql, body, request }) {
      const yo = await auth(sql, request);
      const { fila, otro } = await unida(sql, yo);
      const hoy = hoyDe(body);
      const nuevo = await sql`
        insert into pareja_orado (pareja_id, usuario_id, fecha) values (${fila.id}, ${yo.id}, ${hoy})
        on conflict do nothing returning 1`;
      if (nuevo.length) {
        await notifyUser(sql, otro, {
          title: `${yo.nombre} oró por ti hoy`,
          body: 'Abre «En pareja» para orar también.',
          url: '/pareja',
          tag: `pareja-oro-${fila.id}`,
        });
      }
      return estado(sql, yo, hoy);
    },

    /** Cancela la invitación o deshace la pareja: se borra todo lo que compartían. */
    async parejaSalir({ sql, body, request }) {
      const yo = await auth(sql, request);
      const fila = await mia(sql, yo);
      if (fila) await sql`delete from parejas where id = ${fila.id}`;
      return estado(sql, yo, hoyDe(body));
    },
  };
}
