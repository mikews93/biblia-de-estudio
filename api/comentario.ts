// Función de Vercel: comentarios bíblicos en español.
// Las fuentes en inglés (Matthew Henry, Jamieson-Fausset-Brown; dominio público) vienen por secciones de
// pipeline/build_comentarios.py. Cada parte se traduce con IA la primera vez que alguien la abre, se guarda en la base
// de datos y después otra pasada de la IA la revisa contra el original. Las fuentes que ya están en español (por
// ejemplo Enduring Word, si llega el permiso) se sirven tal cual, sin traducir.
//
// GET  ?fuente=mhc&libro=jhn&capitulo=3&versiculo=16
//      -> { secciones: [{ desde, hasta, partes }], seccion: { desde, hasta, partes, traducidas: [{ parte, texto, estado }] } }
// POST { fuente, libro, capitulo, desde, parte }  traduce esa parte y la envía por partes como NDJSON:
//      {"type":"text","text":"…"} | {"type":"done","estado":"traducido"} | {"type":"error","message":"…"}
//      Si otra persona la está traduciendo en ese momento: 409 { enCurso: true }.
// POST { reporte: { fuente, libro, capitulo, desde, parte, nota } }  avisa de un error en una traducción.

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import postgres from 'postgres';

import { FUENTES, Fuente } from '../src/lib/comentarioFuentes';

const MODEL = process.env.COMENTARIO_MODEL ?? 'claude-sonnet-5-5';
const REVIEW_MODEL = process.env.COMENTARIO_REVISOR ?? 'claude-opus-5-5';
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');
const SOURCES_DIR = process.env.COMENTARIOS_DIR ?? path.join(process.cwd(), 'comentarios');
const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
// Tope de partes nuevas traducidas al día entre todos (lo ya traducido no cuenta): protege la cuenta de la IA.
const PER_DAY = Number(process.env.COMENTARIO_PARTES_DIA ?? 400);
// Si una traducción lleva más de esto «en curso», se da por perdida y otra petición puede tomarla.
const LOCK_MINUTES = 4;
const MAX_NOTE = 500;

const SCHEMA = `
create table if not exists comentarios_es (
  fuente text not null,
  libro text not null,
  capitulo int not null,
  desde int not null,
  parte int not null,
  texto text,
  estado text not null default 'en_curso',
  modelo text,
  creado timestamptz not null default now(),
  revisado timestamptz,
  primary key (fuente, libro, capitulo, desde, parte)
);
create table if not exists comentarios_uso (
  dia date primary key,
  n int not null default 0
);
create table if not exists comentarios_reportes (
  id bigserial primary key,
  fuente text not null,
  libro text not null,
  capitulo int not null,
  desde int not null,
  parte int not null,
  nota text not null,
  creado timestamptz not null default now()
);
`;

const TRANSLATE = `Traduces al español comentarios bíblicos clásicos de dominio público para una app bíblica gratuita.

Reglas:
- Traduce con fidelidad todo el texto: no resumas, no omitas, no añadas explicaciones ni opiniones tuyas, no suavices ni cambies lo que el autor afirma.
- Usa un español claro y actual, neutro para Latinoamérica y España. Moderniza el inglés antiguo, pero conserva el tono pastoral del autor.
- Mantén la estructura: los mismos párrafos, la numeración del autor (I., II., 1., (1.), [1.]), las **negritas** y las *cursivas*.
- Las marcas de referencia como ⟦jhn.3.16⟧ o ⟦rom.8.1-rom.8.4⟧ van exactamente iguales, sin traducirlas ni moverlas de su frase. La app las muestra como «Juan 3:16».
- Cuando el autor cite un versículo del pasaje, usa las palabras de la Reina-Valera 1909 que se te dan. Para otras citas bíblicas, traduce la cita con naturalidad.
- Usa los términos de la tradición cristiana histórica en español: gracia, cruz, expiación, justificación, santificación, arrepentimiento, Espíritu Santo, el Señor.
- En las notas de JFB, el encabezado de cada nota («**3. Except, &c.—**») se traduce como «**3. Si no…—**» siguiendo la RV1909.
- Responde solo con la traducción, sin comentarios antes ni después.`;

const REVIEW = `Revisas traducciones al español de comentarios bíblicos clásicos (dominio público) para una app bíblica gratuita.

Compara la traducción con el original en inglés y corrígela:
- Nada omitido, añadido ni resumido; el sentido teológico del autor intacto.
- Términos de la tradición cristiana histórica bien traducidos; citas del pasaje con las palabras de la Reina-Valera 1909 que se te dan.
- Las marcas ⟦…⟧ idénticas al original; la numeración, las negritas y las cursivas en su sitio.
- Español natural y correcto (ortografía, concordancia, falsos amigos).

Responde solo con la traducción corregida completa, sin comentarios. Si no hace falta ningún cambio, responde exactamente SIN CAMBIOS.`;

type Book = { id: string; name: string; chapters: number };
type Verse = [number, string];
type Section = { desde: number; hasta: number; titulo: string; partes: string[] };
type Sql = ReturnType<typeof postgres>;
type Key = { fuente: Fuente; libro: Book; capitulo: number; seccion: Section; parte: number };

class Fail extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const client = new Anthropic();
let sql: Sql | null = null;
let ready: Promise<unknown> | null = null;
let booksCache: Promise<Book[]> | null = null;

async function db() {
  if (!DB_URL) throw new Fail('Falta conectar la base de datos en el servidor.', 503);
  sql ??= postgres(DB_URL, { max: 3, idle_timeout: 20, onnotice: () => {} });
  ready ??= sql.unsafe(SCHEMA).catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return sql;
}

function books() {
  booksCache ??= readFile(path.join(DATA_DIR, 'books.json'), 'utf8').then((raw) => JSON.parse(raw) as Book[]);
  return booksCache;
}

async function sections(fuente: Fuente, libro: string, capitulo: number): Promise<Section[]> {
  try {
    const raw = await readFile(path.join(SOURCES_DIR, fuente.id, libro, `${capitulo}.json.gz`));
    return JSON.parse(gunzipSync(raw).toString('utf8')) as Section[];
  } catch {
    return [];
  }
}

/** Valida fuente, libro y capítulo, y devuelve las secciones del capítulo. */
async function chapter(q: { fuente?: unknown; libro?: unknown; capitulo?: unknown }) {
  const fuente = FUENTES.find((f) => f.id === q.fuente && f.tipo !== 'enlace');
  const libro = (await books()).find((b) => b.id === q.libro);
  const capitulo = Number(q.capitulo);
  if (!fuente || !libro || !Number.isInteger(capitulo) || capitulo < 1 || capitulo > libro.chapters) {
    throw new Fail('Comentario no válido');
  }
  return { fuente, libro, capitulo, secciones: await sections(fuente, libro.id, capitulo) };
}

async function key(body: Record<string, unknown>): Promise<Key> {
  const { fuente, libro, capitulo, secciones } = await chapter(body);
  const seccion = secciones.find((s) => s.desde === body.desde);
  const parte = Number(body.parte);
  if (!seccion || !Number.isInteger(parte) || parte < 0 || parte >= seccion.partes.length) {
    throw new Fail('Parte del comentario no válida');
  }
  return { fuente, libro, capitulo, seccion, parte };
}

function source(k: Key) {
  const text = k.seccion.partes[k.parte];
  // El título de la sección va con la primera parte, como encabezado.
  return k.parte === 0 && k.seccion.titulo ? `## ${k.seccion.titulo}\n\n${text}` : text;
}

/** El pasaje en la RV1909, para que las citas del autor usen esas palabras. */
async function passage(k: Key) {
  const verses = JSON.parse(
    await readFile(path.join(DATA_DIR, 'text', 'rv1909', k.libro.id, `${k.capitulo}.json`), 'utf8'),
  ) as Verse[];
  const from = Math.max(1, k.seccion.desde);
  const to = k.seccion.desde === 0 ? verses.length : k.seccion.hasta;
  return verses
    .filter(([n]) => n >= from && n <= to)
    .map(([n, t]) => `${n} ${t}`)
    .join('\n');
}

function context(k: Key, rv: string) {
  const ref = `${k.libro.name} ${k.capitulo}${k.seccion.desde ? `:${k.seccion.desde}-${k.seccion.hasta}` : ''}`;
  return `Comentario: ${k.fuente.obra}, de ${k.fuente.autor}. Pasaje: ${ref}.\n\nReina-Valera 1909:\n${rv}`;
}

const marks = (s: string) => (s.match(/⟦[^⟧]*⟧/g) ?? []).sort().join(' ');

async function getHandler(request: Request) {
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const { fuente, libro, capitulo, secciones } = await chapter(q);
  const verse = Number(q.versiculo ?? 0);
  const seccion =
    secciones.find((s) => s.desde <= verse && verse <= s.hasta && (verse > 0 || s.desde === 0)) ??
    secciones.find((s) => s.desde > verse) ??
    null;
  let traducidas: { parte: number; texto: string; estado: string }[] = [];
  if (seccion) {
    if (fuente.idioma === 'es') {
      traducidas = seccion.partes.map((texto, parte) => ({ parte, texto, estado: 'original' }));
    } else {
      const sql = await db();
      traducidas = await sql<{ parte: number; texto: string; estado: string }[]>`
        select parte, texto, estado from comentarios_es
        where fuente = ${fuente.id} and libro = ${libro.id} and capitulo = ${capitulo} and desde = ${seccion.desde}
          and texto is not null
        order by parte`;
    }
  }
  return Response.json(
    {
      secciones: secciones.map((s) => ({ desde: s.desde, hasta: s.hasta, partes: s.partes.length })),
      seccion: seccion && { desde: seccion.desde, hasta: seccion.hasta, partes: seccion.partes.length, traducidas },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Reserva la parte para traducirla. Devuelve false si otra petición la está traduciendo. */
async function claim(sql: Sql, k: Key) {
  const where = sql`fuente = ${k.fuente.id} and libro = ${k.libro.id} and capitulo = ${k.capitulo}
    and desde = ${k.seccion.desde} and parte = ${k.parte}`;
  const [done] = await sql`select texto, estado from comentarios_es where ${where} and texto is not null`;
  if (done) return done as { texto: string; estado: string };
  const [usage] = await sql`select n from comentarios_uso where dia = current_date`;
  if (usage && usage.n >= PER_DAY) {
    throw new Fail('Hoy ya se tradujeron muchos comentarios nuevos. Vuelve mañana o lee este pasaje en Enduring Word.', 429);
  }
  const inserted = await sql`
    insert into comentarios_es (fuente, libro, capitulo, desde, parte)
    values (${k.fuente.id}, ${k.libro.id}, ${k.capitulo}, ${k.seccion.desde}, ${k.parte})
    on conflict do nothing returning 1`;
  if (inserted.length) return null;
  const stale = await sql`
    update comentarios_es set creado = now()
    where ${where} and texto is null and creado < now() - make_interval(mins => ${LOCK_MINUTES}) returning 1`;
  if (stale.length) return null;
  return false;
}

async function release(sql: Sql, k: Key) {
  await sql`delete from comentarios_es where fuente = ${k.fuente.id} and libro = ${k.libro.id}
    and capitulo = ${k.capitulo} and desde = ${k.seccion.desde} and parte = ${k.parte} and texto is null`;
}

/** Segunda pasada: otra IA compara con el original y corrige. Se ejecuta después de responder. */
async function review(sql: Sql, k: Key, original: string, draft: string, ctx: string) {
  try {
    const res = await client.messages.create({
      model: REVIEW_MODEL,
      max_tokens: 16000,
      system: REVIEW,
      messages: [
        {
          role: 'user',
          content: `${ctx}\n\n<original>\n${original}\n</original>\n\n<traduccion>\n${draft}\n</traduccion>`,
        },
      ],
    });
    const out = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    if (res.stop_reason !== 'end_turn' || !out) return;
    const texto = out === 'SIN CAMBIOS' ? draft : out;
    // Si la revisión pierde referencias o recorta el texto, se queda la primera traducción.
    if (marks(texto) !== marks(original) || texto.length < draft.length * 0.8) return;
    await sql`update comentarios_es set texto = ${texto}, estado = 'revisado', revisado = now()
      where fuente = ${k.fuente.id} and libro = ${k.libro.id} and capitulo = ${k.capitulo}
        and desde = ${k.seccion.desde} and parte = ${k.parte} and estado = 'traducido'`;
  } catch (err) {
    console.error('comentario: revisión', err);
  }
}

// Vercel deja terminar trabajo después de la respuesta con waitUntil (lo mismo que hace @vercel/functions).
function waitUntil(promise: Promise<unknown>) {
  const ctx = (globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } }>)[
    Symbol.for('@vercel/request-context')
  ]?.get?.();
  if (ctx?.waitUntil) ctx.waitUntil(promise);
}

async function translate(body: Record<string, unknown>) {
  const k = await key(body);
  if (k.fuente.idioma === 'es') throw new Fail('Este comentario ya está en español');
  const sql = await db();
  const claimed = await claim(sql, k);
  if (claimed === false) return Response.json({ enCurso: true }, { status: 409 });

  const encoder = new TextEncoder();
  if (claimed) {
    // Ya estaba traducida: se envía de una vez.
    const lines = [{ type: 'text', text: claimed.texto }, { type: 'done', estado: claimed.estado }];
    return new Response(lines.map((l) => JSON.stringify(l) + '\n').join(''), {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const original = source(k);
  const ctx = context(k, await passage(k));
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      let saved = false;
      try {
        const response = client.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          system: TRANSLATE,
          messages: [{ role: 'user', content: `${ctx}\n\nTraduce:\n\n${original}` }],
        });
        let texto = '';
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            texto += event.delta.text;
            send({ type: 'text', text: event.delta.text });
          }
        }
        const final = await response.finalMessage();
        texto = texto.trim();
        if (final.stop_reason !== 'end_turn' || !texto) throw new Error(`traducción incompleta: ${final.stop_reason}`);
        await sql`update comentarios_es set texto = ${texto}, estado = 'traducido', modelo = ${MODEL}, creado = now()
          where fuente = ${k.fuente.id} and libro = ${k.libro.id} and capitulo = ${k.capitulo}
            and desde = ${k.seccion.desde} and parte = ${k.parte}`;
        await sql`insert into comentarios_uso (dia, n) values (current_date, 1)
          on conflict (dia) do update set n = comentarios_uso.n + 1`;
        saved = true;
        send({ type: 'done', estado: 'traducido' });
        waitUntil(review(sql, k, original, texto, ctx));
      } catch (err) {
        console.error('comentario', err);
        const message =
          err instanceof Anthropic.RateLimitError
            ? 'Hay muchas consultas ahora mismo. Inténtalo en un momento.'
            : err instanceof Anthropic.AuthenticationError
              ? 'Falta configurar la clave de la IA en el servidor.'
              : 'No se pudo traducir el comentario. Inténtalo de nuevo.';
        send({ type: 'error', message });
      } finally {
        if (!saved) await release(sql, k).catch(() => {});
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function report(body: Record<string, unknown>) {
  const k = await key(body);
  const nota = typeof body.nota === 'string' ? body.nota.trim().slice(0, MAX_NOTE) : '';
  if (!nota) throw new Fail('Escribe qué está mal');
  const sql = await db();
  await sql`insert into comentarios_reportes (fuente, libro, capitulo, desde, parte, nota)
    values (${k.fuente.id}, ${k.libro.id}, ${k.capitulo}, ${k.seccion.desde}, ${k.parte}, ${nota})`;
  return Response.json({ ok: true });
}

function failure(err: unknown) {
  if (err instanceof Fail) return Response.json({ error: err.message }, { status: err.status });
  console.error('comentario', err);
  return Response.json({ error: 'Algo salió mal. Inténtalo de nuevo.' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    return await getHandler(request);
  } catch (err) {
    return failure(err);
  }
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new Fail('JSON no válido');
    }
    if (body.reporte && typeof body.reporte === 'object') return await report(body.reporte as Record<string, unknown>);
    return await translate(body);
  } catch (err) {
    return failure(err);
  }
}
