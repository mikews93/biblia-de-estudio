// Lo que se prepara una vez para todos (el guion del pódcast, las herramientas, el primer estudio de un pasaje) tarda
// casi un minuto. Si la persona cierra la app y vuelve a abrirla mientras tanto, la app lo pide otra vez: antes eso
// empezaba una segunda preparación (pagada otra vez) y la pantalla volvía a empezar de cero. Ahora la primera deja una
// marca en «preparando_ia» y las que llegan después esperan a que termine y reciben lo guardado.
import type postgres from 'postgres';

import { SIN_BUFFER } from './_porPartes';

type Sql = ReturnType<typeof postgres>;
type Saved = { texto: string; fuentes: object[] };

/** Si una preparación lleva más que esto, la función se cortó: la marca ya no vale. */
const VENCE_MINUTOS = 6;
/** Cada cuánto se mira si ya quedó guardado. */
const CADA_MS = 2500;
/** Hasta cuándo se espera (la función tiene 300 s). */
const ESPERA_MAX_MS = 270_000;
/** Cada cuánto se manda un latido para que la conexión no parezca muerta. */
export const LATIDO_MS = 10_000;

let lista: Promise<unknown> | null = null;

async function tabla(s: Sql) {
  lista ??= s`
    create table if not exists preparando_ia (
      clave text primary key,
      desde timestamptz not null default now()
    )`.catch((err) => {
    lista = null;
    throw err;
  });
  await lista;
}

/**
 * Pone la marca de «preparando» si no hay otra viva. true: esta petición prepara; false: otra ya lo está haciendo.
 * Si la base falla, prepara (como antes): esperar es una ayuda, no un requisito.
 */
export async function tomar(s: Sql | null, clave: string): Promise<boolean> {
  if (!s) return true;
  try {
    await tabla(s);
    const filas = await s`insert into preparando_ia (clave) values (${clave})
      on conflict (clave) do update set desde = now()
        where preparando_ia.desde < now() - make_interval(mins => ${VENCE_MINUTOS})
      returning 1`;
    return filas.length > 0;
  } catch (err) {
    console.error('preparando: tomar', err);
    return true;
  }
}

/** Quita la marca al terminar (bien o mal), para que quien espera sepa que ya no viene nada. */
export async function soltar(s: Sql | null, clave: string) {
  if (!s) return;
  await s`delete from preparando_ia where clave = ${clave}`.catch((err) => console.error('preparando: soltar', err));
}

async function sigueViva(s: Sql, clave: string) {
  const [fila] = await s<{ viva: boolean }[]>`select desde > now() - make_interval(mins => ${VENCE_MINUTOS}) as viva
    from preparando_ia where clave = ${clave}`;
  return Boolean(fila?.viva);
}

/**
 * La respuesta para quien llega mientras otra petición prepara lo mismo: latidos mientras tanto y,
 * en cuanto queda guardado, las fuentes y el texto como si se hubiera leído de la base.
 */
export function esperarOtra(s: Sql, clave: string, leer: () => Promise<Saved | null>): Response {
  const encoder = new TextEncoder();
  let abierto = true;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      abierto = false;
    },
    async start(controller) {
      const send = (e: object) => {
        if (!abierto) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
        } catch {
          abierto = false;
        }
      };
      // Sin «paso»: las apps viejas solo conocen los de investigar y fallarían con uno nuevo. Un latido lo ignoran.
      send({ type: 'latido' });
      const hasta = Date.now() + ESPERA_MAX_MS;
      let ultimoLatido = Date.now();
      try {
        while (abierto && Date.now() < hasta) {
          await new Promise((r) => setTimeout(r, CADA_MS));
          const saved = await leer();
          if (saved) {
            for (const f of saved.fuentes) send({ type: 'source', ...f });
            send({ type: 'text', text: saved.texto });
            send({ type: 'done' });
            return;
          }
          if (!(await sigueViva(s, clave).catch(() => true))) {
            send({ type: 'error', message: 'No se pudo preparar esta vez. Inténtalo de nuevo.' });
            return;
          }
          if (Date.now() - ultimoLatido >= LATIDO_MS) {
            send({ type: 'latido' });
            ultimoLatido = Date.now();
          }
        }
        send({ type: 'error', message: 'Sigue preparándose. Vuelve a intentarlo en un momento.' });
      } finally {
        if (abierto) {
          abierto = false;
          controller.close();
        }
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', ...SIN_BUFFER } });
}
