// Función de Vercel: comentarios bíblicos en español.
// Las fuentes en inglés (Tyndale Open Study Notes, Matthew Henry, Calvino…; ver comentarioFuentes.ts) vienen por
// secciones de pipeline/build_comentarios.py (ver _comentarios.ts). Cada parte se traduce con IA la primera vez que
// alguien la abre, se guarda en la base de datos y después otra pasada de la IA la revisa contra el original. Las
// fuentes que ya están en español (con licencia, como la Biblia del Diario Vivir si llega) se sirven sin traducir.
//
// GET  ?fuente=mhc&libro=jhn&capitulo=3&versiculo=16
//      -> { secciones: [{ desde, hasta, partes }], seccion: { desde, hasta, partes, traducidas: [{ parte, texto, estado }] } }
// POST { fuente, libro, capitulo, desde, parte }  traduce esa parte y la envía por partes como NDJSON:
//      {"type":"text","text":"…"} | {"type":"done","estado":"traducido"} | {"type":"error","message":"…"}
//      Si otra persona la está traduciendo en ese momento: 409 { enCurso: true }.
// POST { reporte: { fuente, libro, capitulo, desde, parte, nota } }  avisa de un error en una traducción.
//
// Fichas de personas y lugares (pipeline/fichas.py): el artículo de STEPBible TIPNR viene en inglés y se traduce igual,
// una vez para todos. Van aquí y no en una función aparte porque el plan Hobby de Vercel admite 12 funciones.
// GET  ?ficha=h1732  -> { texto, estado } o { texto: null }
// POST { contexto: { libro, capitulo, versiculo } }  -> { texto, fuente } o { texto: null }: una línea de contexto para
//      la imagen de un versículo («Pablo lo escribe desde la cárcel»), sacada de los comentarios y guardada para todos.
// POST { ficha: 'h1732' }  traduce el artículo y lo envía por partes como NDJSON, igual que un comentario.

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

import { Section, sections } from './_comentarios';
import { waitUntil } from './_seguir';
import { ACTIVAS, Fuente } from '../src/lib/comentarioFuentes';

const MODEL = process.env.COMENTARIO_MODEL ?? 'claude-sonnet-5-5';
const REVIEW_MODEL = process.env.COMENTARIO_REVISOR ?? 'claude-opus-5-5';
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');
const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
// Tope de partes nuevas traducidas al día entre todos (lo ya traducido no cuenta): protege la cuenta de la IA.
const PER_DAY = Number(process.env.COMENTARIO_PARTES_DIA ?? 400);
// Si una traducción lleva más de esto «en curso», se da por perdida y otra petición puede tomarla.
const LOCK_MINUTES = 4;
const MAX_NOTE = 500;
// Tope de fichas nuevas traducidas al día entre todos.
const FICHAS_PER_DAY = Number(process.env.FICHAS_DIA ?? 300);
const FICHA_ID = /^[gh]\d{4}[a-z]?$/;

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
create table if not exists fichas_es (
  id text primary key,
  texto text,
  estado text not null default 'en_curso',
  modelo text,
  creado timestamptz not null default now()
);
create table if not exists fichas_uso (
  dia date primary key,
  n int not null default 0
);
create table if not exists contexto_es (
  libro text not null,
  capitulo int not null,
  versiculo int not null,
  texto text not null,
  fuente text not null,
  creado timestamptz not null default now(),
  primary key (libro, capitulo, versiculo)
);
create table if not exists contexto_uso (
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

const TRANSLATE_FICHA = `Traduces al español las fichas de personas y lugares de la Biblia de STEPBible (Tyndale House) para una app bíblica gratuita.

Reglas:
- Traduce con fidelidad todo el texto: no resumas, no omitas, no añadas datos ni opiniones tuyas.
- Usa un español claro y actual, neutro para Latinoamérica y España.
- Escribe los nombres como la Reina-Valera 1909: usa los del glosario que se te da (Jesse → Isaí). Para los demás nombres bíblicos, la forma habitual en las Biblias españolas.
- Las marcas de referencia como ⟦jhn.3.16⟧ o ⟦rom.8.1-rom.8.4⟧ van exactamente iguales, sin traducirlas ni moverlas de su frase. Las citas sin marca («Génesis 35:19; 48:7») se traducen con los nombres de los libros en español.
- Usa los términos de la tradición cristiana histórica en español: gracia, cruz, expiación, justificación, arrepentimiento, Espíritu Santo, el Señor.
- Mantén los mismos párrafos, separados por una línea en blanco.
- Responde solo con la traducción, sin comentarios antes ni después.`;

const CONTEXTO = `Escribes una línea de contexto para la imagen de un versículo que alguien va a compartir en sus redes, en una app bíblica gratuita.

Reglas:
- Una sola frase en español, de 90 caracteres como mucho, sin comillas y sin punto final.
- Solo el contexto histórico o literario del versículo: quién habla o escribe, a quién, dónde o en qué situación. Por ejemplo: «Pablo lo escribe desde la cárcel a la iglesia de Filipos».
- Sácalo de las notas del comentario que se te dan. No inventes datos ni fechas que no estén ahí.
- No apliques el versículo, no prediques, no expliques su significado teológico, no opines.
- Escribe los nombres como la Reina-Valera 1909.
- Responde solo con la frase.`;

// Fuentes para la línea de contexto, en orden: notas modernas primero, después los clásicos.
const FUENTES_CONTEXTO = ['tosn', 'jfb', 'mhc'];
const CONTEXTO_DIA = Number(process.env.CONTEXTO_DIA ?? 300);
const MAX_CONTEXTO = 110;

type Book = { id: string; name: string; chapters: number };
type Verse = [number, string];
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

/** Valida fuente, libro y capítulo, y devuelve las secciones del capítulo. */
async function chapter(request: Request, q: { fuente?: unknown; libro?: unknown; capitulo?: unknown }) {
  const fuente = ACTIVAS.find((f) => f.id === q.fuente && f.tipo !== 'enlace');
  const libro = (await books()).find((b) => b.id === q.libro);
  const capitulo = Number(q.capitulo);
  if (!fuente || !libro || !Number.isInteger(capitulo) || capitulo < 1 || capitulo > libro.chapters) {
    throw new Fail('Comentario no válido');
  }
  return { fuente, libro, capitulo, secciones: await sections(request, fuente, libro.id, capitulo) };
}

async function key(request: Request, body: Record<string, unknown>): Promise<Key> {
  const { fuente, libro, capitulo, secciones } = await chapter(request, body);
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
  if (q.ficha) return getFicha(q.ficha);
  const { fuente, libro, capitulo, secciones } = await chapter(request, q);
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

async function translate(request: Request, body: Record<string, unknown>) {
  const k = await key(request, body);
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

type FichaSource = { id: string; nombre: string; en: string; glosario?: Record<string, string> };

/** El artículo en inglés de la ficha, de los archivos de la web (como los comentarios libres, ver _comentarios.ts). */
async function fichaSource(request: Request, id: unknown): Promise<FichaSource> {
  if (typeof id !== 'string' || !FICHA_ID.test(id)) throw new Fail('Ficha no válida');
  const rel = `fichas/f/${id}.json`;
  const local = await readFile(path.join(DATA_DIR, rel), 'utf8').catch(() => null);
  if (local) return JSON.parse(local) as FichaSource;
  const cookie = request.headers.get('cookie');
  const res = await fetch(new URL(`/data/${rel}`, request.url), {
    headers: cookie ? { cookie } : {},
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) throw new Fail('Ficha no encontrada', 404);
  return (await res.json()) as FichaSource;
}

async function getFicha(id: string) {
  if (!FICHA_ID.test(id)) throw new Fail('Ficha no válida');
  const sql = await db();
  const [row] = await sql<{ texto: string; estado: string }[]>`
    select texto, estado from fichas_es where id = ${id} and texto is not null`;
  return Response.json(row ?? { texto: null }, { headers: { 'Cache-Control': 'no-store' } });
}

async function translateFicha(request: Request, id: unknown) {
  const ficha = await fichaSource(request, id);
  if (!ficha.en) throw new Fail('Esta ficha no tiene descripción');
  const sql = await db();
  const [done] = await sql<{ texto: string; estado: string }[]>`
    select texto, estado from fichas_es where id = ${ficha.id} and texto is not null`;
  const ndjson = { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' };
  if (done) {
    const lines = [{ type: 'text', text: done.texto }, { type: 'done', estado: done.estado }];
    return new Response(lines.map((l) => JSON.stringify(l) + '\n').join(''), { headers: ndjson });
  }
  const [usage] = await sql`select n from fichas_uso where dia = current_date`;
  if (usage && usage.n >= FICHAS_PER_DAY) {
    throw new Fail('Hoy ya se tradujeron muchas fichas nuevas. Vuelve mañana para leer esta descripción.', 429);
  }
  // Reserva: si otra petición la está traduciendo, 409 y el cliente espera.
  const inserted = await sql`insert into fichas_es (id) values (${ficha.id}) on conflict do nothing returning 1`;
  if (!inserted.length) {
    const stale = await sql`update fichas_es set creado = now()
      where id = ${ficha.id} and texto is null and creado < now() - make_interval(mins => ${LOCK_MINUTES}) returning 1`;
    if (!stale.length) return Response.json({ enCurso: true }, { status: 409 });
  }

  const glosario = Object.entries(ficha.glosario ?? {})
    .map(([en, es]) => `${en} → ${es}`)
    .join('\n');
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      let saved = false;
      try {
        const response = client.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          system: TRANSLATE_FICHA,
          messages: [
            {
              role: 'user',
              content: `Ficha: ${ficha.nombre}.\n\nGlosario de nombres (inglés → Reina-Valera 1909):\n${glosario}\n\nTraduce:\n\n${ficha.en}`,
            },
          ],
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
        await sql`update fichas_es set texto = ${texto}, estado = 'traducido', modelo = ${MODEL}, creado = now()
          where id = ${ficha.id}`;
        await sql`insert into fichas_uso (dia, n) values (current_date, 1)
          on conflict (dia) do update set n = fichas_uso.n + 1`;
        saved = true;
        send({ type: 'done', estado: 'traducido' });
      } catch (err) {
        console.error('ficha', err);
        send({
          type: 'error',
          message:
            err instanceof Anthropic.RateLimitError
              ? 'Hay muchas consultas ahora mismo. Inténtalo en un momento.'
              : 'No se pudo traducir la descripción. Inténtalo de nuevo.',
        });
      } finally {
        if (!saved) await sql`delete from fichas_es where id = ${ficha.id} and texto is null`.catch(() => {});
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: ndjson });
}

/**
 * Una línea de contexto para la imagen de un versículo, sacada de los comentarios. Se escribe una vez con IA y queda
 * guardada para todos.
 */
async function contexto(request: Request, body: Record<string, unknown>) {
  const libro = (await books()).find((b) => b.id === body.libro);
  const capitulo = Number(body.capitulo);
  const versiculo = Number(body.versiculo);
  if (!libro || !Number.isInteger(capitulo) || capitulo < 1 || capitulo > libro.chapters || !Number.isInteger(versiculo) || versiculo < 1) {
    throw new Fail('Versículo no válido');
  }
  const sql = await db();
  const [hecho] = await sql<{ texto: string; fuente: string }[]>`
    select texto, fuente from contexto_es where libro = ${libro.id} and capitulo = ${capitulo} and versiculo = ${versiculo}`;
  if (hecho) return Response.json(hecho);

  let notas = '';
  let fuente: Fuente | undefined;
  for (const id of FUENTES_CONTEXTO) {
    const f = ACTIVAS.find((x) => x.id === id);
    if (!f) continue;
    const seccion = (await sections(request, f, libro.id, capitulo)).find((x) => x.desde > 0 && x.desde <= versiculo && versiculo <= x.hasta);
    if (!seccion) continue;
    notas = `${seccion.titulo ? `## ${seccion.titulo}\n\n` : ''}${seccion.partes.join('\n\n')}`.slice(0, 6000);
    fuente = f;
    break;
  }
  if (!fuente) return Response.json({ texto: null });

  const [uso] = await sql`select n from contexto_uso where dia = current_date`;
  if (uso && uso.n >= CONTEXTO_DIA) throw new Fail('Hoy ya se escribieron muchas líneas de contexto. Vuelve mañana o escribe la tuya.', 429);
  await sql`insert into contexto_uso (dia, n) values (current_date, 1) on conflict (dia) do update set n = contexto_uso.n + 1`;

  const verses = JSON.parse(await readFile(path.join(DATA_DIR, 'text', 'rv1909', libro.id, `${capitulo}.json`), 'utf8')) as Verse[];
  const texto = verses.find(([n]) => n === versiculo)?.[1] ?? '';
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: CONTEXTO,
    messages: [
      {
        role: 'user',
        content: `Versículo: ${libro.name} ${capitulo}:${versiculo} (Reina-Valera 1909): ${texto}\n\nNotas de ${fuente.obra}, de ${fuente.autor}:\n${notas}`,
      },
    ],
  });
  const linea = res.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join(' ')
    .replace(/^[«"“\s]+|[»"”.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_CONTEXTO);
  if (!linea) return Response.json({ texto: null });
  await sql`insert into contexto_es (libro, capitulo, versiculo, texto, fuente)
    values (${libro.id}, ${capitulo}, ${versiculo}, ${linea}, ${fuente.id}) on conflict do nothing`;
  return Response.json({ texto: linea, fuente: fuente.id });
}

async function report(request: Request, body: Record<string, unknown>) {
  const k = await key(request, body);
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
    if (body.reporte && typeof body.reporte === 'object') return await report(request, body.reporte as Record<string, unknown>);
    if (body.ficha !== undefined) return await translateFicha(request, body.ficha);
    if (body.contexto && typeof body.contexto === 'object') return await contexto(request, body.contexto as Record<string, unknown>);
    return await translate(request, body);
  } catch (err) {
    return failure(err);
  }
}
