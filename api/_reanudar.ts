// Respuestas que siguen aunque la persona cambie de app (api/estudiar.ts). Al salir de la app o bloquear la
// pantalla, el teléfono corta la conexión (Safari en iPhone siempre, Chrome en Android a menudo). Con «seguir» (un id
// que pone la app en cada pregunta) la IA termina igual, lo que va escribiendo se guarda aquí y la app lo recoge al
// volver con «reanudar» (o la para con «detener»). Solo lo puede leer la misma sesión que preguntó. Se borra al día siguiente.

import { createHash } from 'node:crypto';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
// Cada cuánto se guarda lo escrito mientras la IA sigue (para enseñar lo que lleva al volver).
const CADA_MS = 3000;

let sql: ReturnType<typeof postgres> | null = null;
let lista: Promise<unknown> | null = null;

async function db() {
  if (!DB_URL) return null;
  sql ??= postgres(DB_URL, { max: 2, idle_timeout: 20, onnotice: () => {} });
  lista ??= sql`
    create table if not exists respuestas_seguir (
      id text primary key,
      dueno text not null,
      texto text not null default '',
      fuentes jsonb not null default '[]',
      pasos jsonb not null default '[]',
      error text,
      terminada boolean not null default false,
      detener boolean not null default false,
      creado timestamptz not null default now()
    )`.catch((err) => {
    lista = null;
    throw err;
  });
  await lista;
  return sql;
}

/** El id que manda la app: un UUID, para que nadie pueda adivinar el de otra persona. */
export function idValido(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function duenoDe(request: Request) {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return key ? createHash('sha256').update(key).digest('hex') : null;
}

type Fuente = { n: number; label: string; ref?: string; url?: string; nota?: string };
type Paso = { tipo: string; texto: string };

/**
 * Lo que la IA va enviando, guardado en la base. «anotar» recibe cada evento del stream; «cerrar» guarda el final.
 * Si la base falla, la respuesta sigue igual: esto es una ayuda, no un requisito.
 */
export class Registro {
  private texto = '';
  private fuentes: Fuente[] = [];
  private pasos: Paso[] = [];
  private error: string | null = null;
  private terminada = false;
  private ultimo = 0;
  private escribiendo: Promise<void> = Promise.resolve();
  private creada: Promise<boolean>;
  /** Se dispara si la persona pulsó detener (o cerró el estudio): la IA deja de escribir. */
  readonly corte = new AbortController();

  private constructor(
    private id: string,
    private dueno: string,
  ) {
    this.creada = (async () => {
      const s = await db();
      if (!s) return false;
      await s`delete from respuestas_seguir where creado < now() - interval '1 day'`;
      await s`insert into respuestas_seguir (id, dueno) values (${id}, ${dueno}) on conflict (id) do nothing`;
      return true;
    })().catch((err) => {
      console.error('estudiar: reanudar', err);
      return false;
    });
  }

  static de(request: Request, id: unknown): Registro | null {
    const dueno = duenoDe(request);
    return dueno && idValido(id) && DB_URL ? new Registro(id, dueno) : null;
  }

  anotar(event: { type?: string } & Record<string, unknown>) {
    if (event.type === 'text') this.texto += String(event.text ?? '');
    else if (event.type === 'correccion') this.texto = String(event.text ?? '');
    else if (event.type === 'source') {
      const { type: _t, ...fuente } = event;
      this.fuentes.push(fuente as unknown as Fuente);
    } else if (event.type === 'paso') this.pasos.push({ tipo: String(event.tipo), texto: String(event.texto) });
    else if (event.type === 'error') this.error = String(event.message ?? 'No se pudo generar la respuesta.');
    if (event.type === 'error' || event.type === 'done') this.terminada = true;
    if (Date.now() - this.ultimo >= CADA_MS) this.guardar();
  }

  /** Guarda lo último. Si el stream acabó sin «done» ni error, queda como terminada con lo que haya. */
  async cerrar() {
    this.terminada = true;
    this.guardar();
    await this.escribiendo;
  }

  private guardar() {
    this.ultimo = Date.now();
    const fila = { texto: this.texto, fuentes: [...this.fuentes], pasos: [...this.pasos], error: this.error, terminada: this.terminada };
    this.escribiendo = this.escribiendo.then(async () => {
      try {
        if (!(await this.creada)) return;
        const [row] = await sql!<{ detener: boolean }[]>`update respuestas_seguir set texto = ${fila.texto},
          fuentes = ${sql!.json(fila.fuentes)}, pasos = ${sql!.json(fila.pasos)}, error = ${fila.error},
          terminada = ${fila.terminada} where id = ${this.id} and dueno = ${this.dueno} returning detener`;
        if (row?.detener && !fila.terminada) this.corte.abort();
      } catch (err) {
        console.error('estudiar: reanudar', err);
      }
    });
  }
}

/** «reanudar»: lo que lleva escrito (o la respuesta entera) una pregunta cuya conexión se cortó. */
export async function reanudar(request: Request, id: unknown) {
  const dueno = duenoDe(request);
  if (!dueno || !idValido(id)) return Response.json({ error: 'Pedido no válido' }, { status: 400 });
  try {
    const s = await db();
    if (!s) return Response.json({ error: 'No se pudo recuperar la respuesta.' }, { status: 503 });
    const [row] = await s<{ texto: string; fuentes: Fuente[]; pasos: Paso[]; error: string | null; terminada: boolean }[]>`
      select texto, fuentes, pasos, error, terminada from respuestas_seguir where id = ${id} and dueno = ${dueno}`;
    if (!row) return Response.json({ error: 'Esa respuesta no está' }, { status: 404 });
    return Response.json(row, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('estudiar: reanudar', err);
    return Response.json({ error: 'No se pudo recuperar la respuesta.' }, { status: 503 });
  }
}

/** «detener»: la persona pulsó detener o cerró el estudio; la IA para en cuanto se guarde lo siguiente que escriba. */
export async function detener(request: Request, id: unknown) {
  const dueno = duenoDe(request);
  if (!dueno || !idValido(id)) return Response.json({ error: 'Pedido no válido' }, { status: 400 });
  try {
    const s = await db();
    if (s) await s`update respuestas_seguir set detener = true where id = ${id} and dueno = ${dueno}`;
  } catch (err) {
    console.error('estudiar: detener', err);
  }
  return new Response(null, { status: 204 });
}
