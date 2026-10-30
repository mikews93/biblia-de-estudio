// «Fallos de la app»: cuando algo se rompe en el teléfono o en la web de alguien, la app manda un aviso corto
// (src/lib/errores.ts) y quienes cuidan Zarza lo ven en /cuidar. Sin esto, si a un tester se le cierra la app, nadie
// se entera.
//
// - No va ligado a ninguna cuenta: solo el mensaje, las primeras líneas de la pila, la pantalla, la versión y la
//   plataforma. Antes de guardar se quitan correos, teléfonos y números largos.
// - Los avisos iguales (misma plataforma, mensaje y primera línea de la pila) se juntan en una fila que cuenta las veces.
//   Si un fallo que se marcó como resuelto vuelve en otra versión, se abre otra vez.
// - Cuando aparece un fallo nuevo se avisa a quienes cuidan Zarza, como mucho AVISOS_DIA veces al día.
//
// El guion bajo hace que Vercel no la publique como función: sus acciones van por /api/comunidades («errorApp» sin
// cuenta, y las de /cuidar con la cuenta de quien cuida).

import { createHash } from 'node:crypto';
import type postgres from 'postgres';

import { notifyUser } from './_push';
import { cuidadores } from './_senales';

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Ctx = { sql: Sql; body: Json; request: Request };

const MAX_MENSAJE = 300;
const MAX_PILA = 2000;
const MAX_RUTA = 120;
const MAX_VERSION = 60;
/** Filas que se guardan como mucho: al pasar, se borran primero las resueltas y luego las más viejas. */
const MAX_FILAS = 400;
const AVISOS_DIA = 5;
export const PLATAFORMAS = ['web', 'android', 'ios'] as const;
export const ORIGENES = ['pantalla', 'global', 'promesa'] as const;

export const ERRORES_SCHEMA = `
create table if not exists errores_app (
  firma text primary key,
  plataforma text not null,
  origen text not null,
  mensaje text not null,
  pila text,
  ruta text,
  version text,
  fatal boolean not null default false,
  veces int not null default 1,
  primera timestamptz not null default now(),
  ultima timestamptz not null default now(),
  resuelto boolean not null default false
);
create index if not exists errores_app_ultima on errores_app (resuelto, ultima desc);
`;

/** Quita lo que podría decir quién es la persona: correos, teléfonos, números largos y códigos de enlaces. */
export function limpiar(texto: string) {
  return texto
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[correo]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[número]')
    .replace(/([?&](?:codigo|llave|token|key|clave)=)[^&\s]+/gi, '$1[…]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]');
}

const corto = (v: unknown, max: number) => (typeof v === 'string' ? limpiar(v.trim()).slice(0, max) : '');

/** Las rutas con datos de una persona se cortan: /amigo/AB12 → /amigo/…, /taller/abc/presentar → /taller/…/presentar. */
export function rutaLimpia(ruta: string) {
  return ruta
    .split('?')[0]
    .replace(/^\/(amigo|i|unirse|vivo|evento|iglesia|grupos|taller|semana|circulo\/conocer|circulo\/lider|comunidades\/persona|comunidades\/publicacion|pareja\/unirse)\/[^/]+/, '/$1/…')
    .slice(0, MAX_RUTA);
}

/** La firma que junta avisos del mismo fallo: plataforma, mensaje sin números y la primera línea útil de la pila. */
export function firmaDe(plataforma: string, mensaje: string, pila: string) {
  const linea = pila
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith(mensaje.slice(0, 20)) && /\bat\b|@|\.js|\.tsx?/.test(l));
  const base = `${plataforma}|${mensaje.replace(/\d+/g, '#')}|${(linea ?? '').replace(/:\d+(:\d+)?/g, '')}`;
  return createHash('sha256').update(base).digest('hex').slice(0, 32);
}

export function erroresActions({
  cuidador,
  fail,
}: {
  cuidador: (sql: Sql, request: Request) => Promise<unknown>;
  fail: (message: string, status?: number) => Error;
}): Record<string, (ctx: Ctx) => Promise<Json>> {
  return {
    /** Lo manda la app al romperse algo. No pide cuenta ni dice nada de la persona. */
    async errorApp({ sql, body }) {
      const plataforma = PLATAFORMAS.find((p) => p === body.plataforma);
      const origen = ORIGENES.find((o) => o === body.origen) ?? 'global';
      const mensaje = corto(body.mensaje, MAX_MENSAJE);
      if (!plataforma || !mensaje) throw fail('Aviso no válido');
      const pila = corto(body.pila, MAX_PILA);
      const ruta = rutaLimpia(corto(body.ruta, MAX_RUTA * 2));
      const version = corto(body.version, MAX_VERSION);
      const fatal = body.fatal === true;
      const firma = firmaDe(plataforma, mensaje, pila);

      const [fila] = await sql<{ nuevo: boolean }[]>`
        insert into errores_app (firma, plataforma, origen, mensaje, pila, ruta, version, fatal)
        values (${firma}, ${plataforma}, ${origen}, ${mensaje}, ${pila || null}, ${ruta || null}, ${version || null}, ${fatal})
        on conflict (firma) do update set
          veces = errores_app.veces + 1,
          ultima = now(),
          ruta = coalesce(excluded.ruta, errores_app.ruta),
          fatal = errores_app.fatal or excluded.fatal,
          -- Si volvió en otra versión después de marcarlo como resuelto, el arreglo no bastó.
          resuelto = errores_app.resuelto and errores_app.version is not distinct from excluded.version,
          version = coalesce(excluded.version, errores_app.version)
        returning (xmax = 0) as nuevo`;

      if (fila?.nuevo) {
        const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from errores_app`;
        if (total > MAX_FILAS) {
          await sql`
            delete from errores_app where firma in (
              select firma from errores_app order by resuelto desc, ultima asc limit ${total - MAX_FILAS})`;
        }
        await avisarCuidadores(sql, plataforma, mensaje);
      }
      return { ok: true };
    },

    async cuidarErrores({ sql, request }) {
      await cuidador(sql, request);
      const errores = await sql<Json[]>`
        select firma, plataforma, origen, mensaje, pila, ruta, version, fatal, veces,
          primera::text, ultima::text, resuelto
        from errores_app order by resuelto, ultima desc limit 100`;
      return { errores };
    },

    async cuidarErrorResuelto({ sql, body, request }) {
      await cuidador(sql, request);
      if (typeof body.firma !== 'string') throw fail('Fallo no válido');
      await sql`update errores_app set resuelto = ${body.resuelto !== false} where firma = ${body.firma}`;
      return { ok: true };
    },
  };
}

const NOMBRE = { web: 'la web', android: 'Android', ios: 'iPhone' } as Record<string, string>;

/** Un aviso a quienes cuidan Zarza por cada fallo nuevo, sin pasar de AVISOS_DIA al día. Nunca hace fallar el aviso. */
async function avisarCuidadores(sql: Sql, plataforma: string, mensaje: string) {
  const correos = cuidadores();
  if (!correos.length) return;
  try {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from errores_app where primera > now() - interval '1 day'`;
    if (n > AVISOS_DIA) return;
    const ids = await sql<{ id: string }[]>`select id from usuarios where lower(correo) = any(${correos})`;
    await Promise.all(
      ids.map(({ id }) =>
        notifyUser(sql, id, {
          title: `Un fallo nuevo en ${NOMBRE[plataforma] ?? plataforma}`,
          body: mensaje.slice(0, 140),
          url: '/cuidar?tab=fallos',
          tag: 'cuidar-fallos',
        }),
      ),
    );
  } catch (err) {
    console.error('errores: aviso', err);
  }
}
