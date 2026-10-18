// Pódcast de un capítulo grabado con voces naturales (ElevenLabs), bajo demanda: la primera persona que lo pide
// lo graba a partir del guion guardado por /api/estudiar, y desde ahí queda listo para todos.
//   GET  ?book=jhn&chapter=3  → {estado: 'listo', url, duracion, credito} | {estado: 'grabando'} | {estado: 'ninguno'}
//   POST {book, chapter}      → lo graba (necesita cuenta) y responde como GET. Tarda uno o dos minutos.
// El MP3 se guarda en Vercel Blob y su ficha en Neon (tabla podcast_grabado). Hay un límite diario por cuenta y
// otro para toda la app, para que nadie gaste los créditos de ElevenLabs abriendo capítulos.

import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const ELEVEN_URL = process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io';
const MODEL = process.env.PODCAST_MODELO ?? 'eleven_v4';
// Las voces que eligió Mike en la prueba de Juan 3 (biblioteca de ElevenLabs, acento latinoamericano).
const VOICES = {
  ana: process.env.PODCAST_VOZ_ANA ?? 'CaJslL1xziwefCeTNzHv',
  tomas: process.env.PODCAST_VOZ_TOMAS ?? '94zOad0g7T7K4oa7zhDq',
};
const CREDIT = 'Voces de ElevenLabs (Cristina Campos y Mauricio). Guion de Claude con las fuentes de la app.';
const FORMAT = 'mp3_44100_64';
const KBPS = 64;
const TURNS_PER_CHUNK = 8;
const PARALLEL = 3;
const PER_ACCOUNT = Number(process.env.PODCAST_LIMITE_CUENTA ?? 3);
const PER_DAY = Number(process.env.PODCAST_LIMITE_DIA ?? 15);
// Si una grabación lleva más que esto «grabando», la función se cortó: se puede volver a intentar.
const STALE_MINUTES = 6;
// Para las pruebas: guarda los MP3 en una carpeta en vez de Vercel Blob.
const STORE_DIR = process.env.PODCAST_STORE_DIR;

type Row = { estado: 'grabando' | 'listo' | 'error'; url: string | null; duracion: number | null; credito: string | null };
type Line = { voice: string; text: string };

let sql: ReturnType<typeof postgres> | null = null;
let ready: Promise<unknown> | null = null;

async function db() {
  if (!DB_URL) return null;
  sql ??= postgres(DB_URL, { max: 2, idle_timeout: 20, onnotice: () => {} });
  ready ??= sql`
    create table if not exists podcast_grabado (
      libro text not null,
      capitulo int not null,
      estado text not null,
      url text,
      duracion real,
      credito text,
      guion text,
      pedido_por uuid,
      creado timestamptz not null default now(),
      actualizado timestamptz not null default now(),
      primary key (libro, capitulo)
    )`.catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return sql;
}

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function place(book: unknown, chapter: unknown): { book: string; chapter: number } | null {
  const ch = Number(chapter);
  if (typeof book !== 'string' || !/^[0-9a-z]{3}$/.test(book) || !Number.isInteger(ch) || ch < 1 || ch > 150) return null;
  return { book, chapter: ch };
}

function answer(row: Row | undefined) {
  if (row?.estado === 'listo') return { estado: 'listo', url: row.url, duracion: row.duracion, credito: row.credito };
  if (row?.estado === 'grabando') return { estado: 'grabando' };
  return { estado: 'ninguno' };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const where = place(params.get('book'), params.get('chapter'));
  if (!where) return json({ error: 'Pedido no válido' }, 400);
  const s = await db().catch(() => null);
  if (!s) return json({ estado: 'ninguno' });
  const [row] = await s<Row[]>`select estado, url, duracion, credito from podcast_grabado
    where libro = ${where.book} and capitulo = ${where.chapter}`;
  return json(answer(row));
}

async function account(s: NonNullable<typeof sql>, request: Request): Promise<string | null> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key) return null;
  const hash = createHash('sha256').update(key).digest('hex');
  const [row] = await s<{ usuario_id: string }[]>`select usuario_id from sesiones where llave_hash = ${hash}`;
  return row?.usuario_id ?? null;
}

/** El guion de /api/estudiar en intervenciones, sin las marcas de cita ⟦n⟧. */
export function scriptLines(texto: string): Line[] {
  const lines: Line[] = [];
  for (const raw of texto.split('\n')) {
    const line = raw.replace(/\*\*/g, '').replace(/⟦\d+⟧/g, '').replace(/\s+([,.;:!?»])/g, '$1').replace(/\s{2,}/g, ' ').trim();
    if (!line) continue;
    const m = line.match(/^(ANA|TOM[AÁ]S)\s*:\s*(.*)$/i);
    if (m) lines.push({ voice: m[1].toLowerCase().startsWith('ana') ? VOICES.ana : VOICES.tomas, text: m[2] });
    else if (lines.length) lines[lines.length - 1].text += ` ${line}`;
  }
  return lines.filter((l) => l.text);
}

async function dialogue(lines: Line[]): Promise<Uint8Array> {
  const res = await fetch(`${ELEVEN_URL}/v1/text-to-dialogue?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: lines.map((l) => ({ text: l.text, voice_id: l.voice })),
      model_id: MODEL,
      language_code: 'es',
      seed: 7,
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Graba el guion por tramos (varios a la vez) y los une: los MP3 del mismo formato se pueden concatenar. */
async function record(lines: Line[]): Promise<Uint8Array> {
  const groups: Line[][] = [];
  for (let i = 0; i < lines.length; i += TURNS_PER_CHUNK) groups.push(lines.slice(i, i + TURNS_PER_CHUNK));
  const parts: Uint8Array[] = new Array(groups.length);
  let next = 0;
  const worker = async () => {
    while (next < groups.length) {
      const i = next++;
      parts[i] = await dialogue(groups[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, groups.length) }, worker));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function store(name: string, audio: Uint8Array): Promise<string> {
  if (STORE_DIR) {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(path.join(STORE_DIR, name), audio);
    return `file://${path.join(STORE_DIR, name)}`;
  }
  const blob = await put(`podcast/${name}`, Buffer.from(audio), {
    access: 'public',
    contentType: 'audio/mpeg',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 31536000,
  });
  return blob.url;
}

export async function POST(request: Request) {
  const s = await db().catch((err) => {
    console.error('podcast-grabado: base de datos', err);
    return null;
  });
  if (!s) return json({ error: 'Falta conectar la base de datos en el servidor.' }, 503);
  const user = await account(s, request);
  if (!user) return json({ error: 'Necesitas una cuenta', cuenta: true }, 401);

  let body: { book?: unknown; chapter?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Pedido no válido' }, 400);
  }
  const where = place(body.book, body.chapter);
  if (!where) return json({ error: 'Pedido no válido' }, 400);
  const { book, chapter } = where;

  const [current] = await s<(Row & { viejo: boolean })[]>`select estado, url, duracion, credito,
      actualizado < now() - make_interval(mins => ${STALE_MINUTES}) as viejo
    from podcast_grabado where libro = ${book} and capitulo = ${chapter}`;
  if (current?.estado === 'listo' || (current?.estado === 'grabando' && !current.viejo)) return json(answer(current));

  if (!process.env.ELEVENLABS_API_KEY || (!STORE_DIR && !process.env.BLOB_READ_WRITE_TOKEN)) {
    return json({ error: 'Las voces naturales todavía no están activadas en el servidor.' }, 503);
  }

  const [guion] = await s<{ texto: string }[]>`select texto from herramientas_ia
    where herramienta = 'podcast' and libro = ${book} and capitulo = ${chapter}`.catch(() => []);
  const lines = guion ? scriptLines(guion.texto) : [];
  if (!lines.length) return json({ error: 'Primero hay que preparar el guion del pódcast.' }, 409);

  const [{ mias, todas }] = await s<{ mias: number; todas: number }[]>`select
      count(*) filter (where pedido_por = ${user})::int as mias, count(*)::int as todas
    from podcast_grabado where creado > now() - interval '1 day'`;
  if (mias >= PER_ACCOUNT) {
    return json({ error: `Puedes grabar hasta ${PER_ACCOUNT} pódcasts al día. Vuelve mañana.` }, 429);
  }
  if (todas >= PER_DAY) {
    return json({ error: 'Por hoy ya se grabaron todos los pódcasts que permite la app. Vuelve mañana.' }, 429);
  }

  // Solo una grabación por capítulo: si otra persona empezó justo ahora, esta espera la suya.
  const [mine] = await s`insert into podcast_grabado (libro, capitulo, estado, guion, pedido_por)
    values (${book}, ${chapter}, 'grabando', ${guion.texto}, ${user})
    on conflict (libro, capitulo) do update
      set estado = 'grabando', guion = excluded.guion, pedido_por = excluded.pedido_por, creado = now(), actualizado = now()
      where podcast_grabado.estado = 'error'
        or (podcast_grabado.estado = 'grabando' and podcast_grabado.actualizado < now() - make_interval(mins => ${STALE_MINUTES}))
    returning 1`;
  if (!mine) return json({ estado: 'grabando' });

  try {
    const audio = await record(lines);
    const tag = createHash('sha256').update(guion.texto).digest('hex').slice(0, 10);
    const url = await store(`${book}-${chapter}-${tag}.mp3`, audio);
    const duracion = Math.round((audio.length * 8) / (KBPS * 1000));
    await s`update podcast_grabado set estado = 'listo', url = ${url}, duracion = ${duracion}, credito = ${CREDIT},
      actualizado = now() where libro = ${book} and capitulo = ${chapter}`;
    return json({ estado: 'listo', url, duracion, credito: CREDIT });
  } catch (err) {
    console.error('podcast-grabado: grabar', err);
    await s`update podcast_grabado set estado = 'error', actualizado = now()
      where libro = ${book} and capitulo = ${chapter}`.catch(() => {});
    return json({ error: 'No se pudo grabar el pódcast. Inténtalo de nuevo más tarde.' }, 502);
  }
}
