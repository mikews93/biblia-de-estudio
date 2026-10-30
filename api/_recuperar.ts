// «¿Olvidaste tu contraseña?»: quien entra con correo y contraseña pide un enlace (/recuperar), le llega por correo
// (Resend) y con él elige una nueva (/recuperar/<enlace>).
//
// - La respuesta a «olvideClave» es la misma exista o no la cuenta, para no dejar averiguar qué correos están.
// - En la base solo queda el hash del enlace. Sirve una vez y vence a los ENLACE_MINUTOS.
// - Como mucho POR_HORA correos por cuenta cada hora, para que nadie llene el buzón de otro.
// - Al cambiar la contraseña se cierran las demás sesiones de la cuenta y se entra en este dispositivo.
// - Sirve también a una cuenta creada con Google o Facebook que tenga correo: así le pone contraseña.
//
// Vercel necesita RESEND_API_KEY y el dominio zarzabiblia.com verificado en Resend; RESEND_FROM cambia el remitente.
// El guion bajo hace que Vercel no la publique como función: sus acciones van por /api/comunidades.

import { createHash, randomBytes } from 'node:crypto';
import type postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Ctx = { sql: Sql; body: Json; request: Request };

export const ENLACE_MINUTOS = 60;
const POR_HORA = 3;
const SITIO = 'https://zarzabiblia.com';
const REMITENTE = 'Zarza <soporte@zarzabiblia.com>';

export const RECUPERAR_SCHEMA = `
create table if not exists recuperar_clave (
  enlace_hash text primary key,
  usuario_id uuid not null references usuarios on delete cascade,
  creado timestamptz not null default now(),
  usado boolean not null default false
);
create index if not exists recuperar_clave_usuario on recuperar_clave (usuario_id, creado desc);
`;

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** El correo con el enlace, en texto y en HTML sencillo (se ve bien en Gmail, Outlook y el correo del teléfono). */
export function correoRecuperar(nombre: string, enlace: string) {
  const saludo = `Hola, ${nombre}:`;
  const cuerpo = 'Pediste cambiar la contraseña de tu cuenta de Zarza. Toca el botón para elegir una nueva.';
  const aviso = `El enlace sirve una sola vez y vence en ${ENLACE_MINUTOS} minutos. Si no lo pediste tú, ignora este correo: tu contraseña sigue igual.`;
  const text = `${saludo}\n\n${cuerpo}\n\n${enlace}\n\n${aviso}\n\nZarza · zarzabiblia.com`;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F9F8F6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1C1B19">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="font-family:Georgia,serif;font-size:22px;font-weight:700;padding-bottom:16px">Zarza</td></tr>
<tr><td style="font-size:16px;line-height:24px;padding-bottom:8px">${esc(saludo)}</td></tr>
<tr><td style="font-size:16px;line-height:24px;padding-bottom:24px">${esc(cuerpo)}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${esc(enlace)}" style="display:inline-block;background:#2A2826;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:24px">Elegir una contraseña nueva</a></td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#625E58">${esc(aviso)}</td></tr>
</table>
<p style="font-size:12px;color:#625E58;margin-top:16px">Zarza · zarzabiblia.com</p>
</td></tr></table></body></html>`;
  return { subject: 'Tu enlace para cambiar la contraseña', text, html };
}

export function recuperarActions(deps: {
  email: (v: unknown) => string;
  password: (v: unknown) => string;
  hashPassword: (pw: string) => Promise<string>;
  newSession: (sql: Sql, userId: string) => Promise<string>;
  profile: (sql: Sql, userId: string) => Promise<unknown>;
  fail: (message: string, status?: number) => Error;
}) {
  return {
    async olvideClave({ sql, body }: Ctx) {
      const correo = deps.email(body.correo);
      const key = process.env.RESEND_API_KEY;
      if (!key) throw deps.fail('Recuperar la contraseña por correo aún no está listo. Escríbenos a soporte@zarzabiblia.com.', 503);
      const [user] = await sql<{ id: string; nombre: string }[]>`select id, nombre from usuarios where correo = ${correo}`;
      if (!user) return { enviado: true };
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n from recuperar_clave where usuario_id = ${user.id} and creado > now() - interval '1 hour'`;
      if (n >= POR_HORA) return { enviado: true };

      const enlace = randomBytes(24).toString('base64url');
      await sql`insert into recuperar_clave (enlace_hash, usuario_id) values (${hash(enlace)}, ${user.id})`;
      const { subject, text, html } = correoRecuperar(user.nombre, `${SITIO}/recuperar/${enlace}`);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.RESEND_FROM || REMITENTE, to: [correo], subject, text, html }),
      });
      if (!res.ok) {
        console.error('olvideClave: Resend respondió', res.status, (await res.text()).slice(0, 300));
        await sql`delete from recuperar_clave where enlace_hash = ${hash(enlace)}`;
        throw deps.fail('No pudimos enviar el correo. Inténtalo de nuevo en un momento.', 502);
      }
      return { enviado: true };
    },

    /** Para la pantalla del enlace: si todavía sirve, a qué correo pertenece (sin decir nada más de la cuenta). */
    async enlaceClave({ sql, body }: Ctx) {
      const [row] = await sql<{ correo: string }[]>`
        select u.correo from recuperar_clave r join usuarios u on u.id = r.usuario_id
        where r.enlace_hash = ${hash(String(body.enlace ?? ''))} and not r.usado
          and r.creado > now() - make_interval(mins => ${ENLACE_MINUTOS})`;
      if (!row) throw deps.fail('Este enlace ya se usó o venció. Pide uno nuevo.', 410);
      return { correo: row.correo };
    },

    async cambiarClave({ sql, body }: Ctx) {
      const clave = deps.password(body.clave);
      const nueva = await deps.hashPassword(clave);
      const usuario = await sql.begin(async (tx) => {
        const [row] = await tx<{ usuario_id: string }[]>`
          update recuperar_clave set usado = true
          where enlace_hash = ${hash(String(body.enlace ?? ''))} and not usado
            and creado > now() - make_interval(mins => ${ENLACE_MINUTOS})
          returning usuario_id`;
        if (!row) throw deps.fail('Este enlace ya se usó o venció. Pide uno nuevo.', 410);
        await tx`update usuarios set clave_hash = ${nueva} where id = ${row.usuario_id}`;
        await tx`delete from sesiones where usuario_id = ${row.usuario_id}`;
        await tx`delete from recuperar_clave where usuario_id = ${row.usuario_id} and not usado`;
        return row.usuario_id;
      });
      return { usuario: await deps.profile(sql, usuario), llave: await deps.newSession(sql, usuario) };
    },
  };
}
