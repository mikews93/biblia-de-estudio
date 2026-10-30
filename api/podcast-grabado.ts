// Pódcast de un capítulo grabado con voces naturales (ElevenLabs), bajo demanda: la primera persona que lo pide
// lo graba a partir del guion guardado por /api/estudiar, y desde ahí queda listo para todos.
//   GET  ?book=jhn&chapter=3  → {estado: 'listo', url, duracion, credito} | {estado: 'grabando'} | {estado: 'ninguno'}
//   POST {book, chapter}      → lo graba (necesita cuenta) y responde como GET. Tarda uno o dos minutos.
// Con ?palabra=jesed (o {palabra} en el POST) es el pódcast de «La historia de una palabra»: se guarda con el libro
// «palabra:jesed» y el capítulo 0, y cuenta en los mismos límites diarios.
// Con &version=pdt (o {version} en el POST) es el pódcast en esa versión libre: su guion se guarda en herramientas_ia
// como «podcast:pdt» y su grabación con el libro «jhn:pdt». La RV1909 va sin sufijo, como antes. Una versión con
// derechos usa la libre de src/lib/podcastVersion.ts: su texto no se convierte en audio.
// El MP3 se guarda en Vercel Blob y su ficha en Neon (tabla podcast_grabado). Hay un límite diario por cuenta y
// otro para toda la app, para que nadie gaste los créditos de ElevenLabs abriendo capítulos.
// ElevenLabs entrega a Ana bastante más baja que a Tomás: cada intervención se lleva al mismo volumen antes de
// codificar el MP3 (src/lib/nivelarVoces.ts). Las grabaciones de antes se nivelan solas la primera vez que alguien
// las abre (por silencios, porque no traen dónde empieza cada voz) y desde ahí se sirve la versión nivelada.

import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

import { muestrasA16, nivelar, pcmAMuestras, type Tramo, tramosPorSilencio } from '../src/lib/nivelarVoces';
import { palabraAudioId, palabraPorId } from '../src/lib/palabras';
import { conVersion, versionPodcast } from '../src/lib/podcastVersion';
import { lineStarts } from '../src/lib/podcastTiempos';
import { codificarMp3, decodificarMp3 } from './_mp3';
import { waitUntil } from './_seguir';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const ELEVEN_URL = process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io';
const MODEL = process.env.PODCAST_MODELO ?? 'eleven_v4';
// Las voces que eligió Mike en la prueba de Juan 3 (biblioteca de ElevenLabs, acento latinoamericano).
const VOICES = {
  ana: process.env.PODCAST_VOZ_ANA ?? 'CaJslL1xziwefCeTNzHv',
  tomas: process.env.PODCAST_VOZ_TOMAS ?? '94zOad0g7T7K4oa7zhDq',
};
const CREDIT = 'Voces de ElevenLabs (Cristina Campos y Mauricio). Guion de Claude con las fuentes de la app.';
// Se pide el audio sin comprimir para poder nivelarlo; 24 kHz no exige plan Pro (44100 sí) y basta para la voz.
const PCM_HZ = Number(process.env.PODCAST_PCM_HZ ?? 24000);
const KBPS = 64;
const TURNS_PER_CHUNK = 8;
const PARALLEL = 3;
const PER_ACCOUNT = Number(process.env.PODCAST_LIMITE_CUENTA ?? 3);
const PER_DAY = Number(process.env.PODCAST_LIMITE_DIA ?? 15);
// Si una grabación lleva más que esto «grabando», la función se cortó: se puede volver a intentar.
const STALE_MINUTES = 6;
// Si una nivelación de una grabación vieja no terminó en este tiempo, otra visita la vuelve a intentar.
const NIVELAR_MINUTES = 10;
// Para las pruebas: guarda los MP3 en una carpeta en vez de Vercel Blob.
const STORE_DIR = process.env.PODCAST_STORE_DIR;
// Vercel nombra el token del almacén Blob según el prefijo que se elija al conectarlo: se acepta cualquiera.
const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN ??
  Object.entries(process.env).find(([k, v]) => /^BLOB.*READ_WRITE_TOKEN$/.test(k) && v)?.[1];

type Row = {
  estado: 'grabando' | 'listo' | 'error';
  url: string | null;
  duracion: number | null;
  credito: string | null;
  tiempos: number[] | null;
};
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
    )`
    // Las grabaciones anteriores no guardaban dónde empieza cada intervención.
    .then(() => sql!`alter table podcast_grabado add column if not exists tiempos jsonb`)
    // Las de antes tampoco tenían las voces al mismo volumen: «nivelado» dice si ya se corrigió.
    .then(() => sql!`alter table podcast_grabado add column if not exists nivelado boolean not null default false,
      add column if not exists nivelando timestamptz`)
    .catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return sql;
}

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Dónde se guarda la grabación (libro y capítulo) y de dónde sale su guion (la fila de herramientas_ia). */
type Target = { book: string; chapter: number; guion: { herramienta: string; libro: string; capitulo: number } };

function place(book: unknown, chapter: unknown, palabra?: unknown, pedida?: unknown): Target | null {
  if (pedida !== undefined && pedida !== null && (typeof pedida !== 'string' || !/^[a-z0-9]{2,12}$/.test(pedida))) return null;
  const version = versionPodcast((pedida as string | null | undefined) ?? undefined);
  if (palabra !== undefined && palabra !== null) {
    const p = typeof palabra === 'string' ? palabraPorId(palabra) : null;
    if (!p || book !== undefined || chapter !== undefined) return null;
    return {
      book: conVersion(palabraAudioId(p.id), version),
      chapter: 0,
      guion: { herramienta: conVersion('palabra-podcast', version), libro: p.id, capitulo: 0 },
    };
  }
  const ch = Number(chapter);
  if (typeof book !== 'string' || !/^[0-9a-z]{3}$/.test(book) || !Number.isInteger(ch) || ch < 1 || ch > 150) return null;
  return { book: conVersion(book, version), chapter: ch, guion: { herramienta: conVersion('podcast', version), libro: book, capitulo: ch } };
}

function answer(row: Row | undefined) {
  if (row?.estado === 'listo') {
    return { estado: 'listo', url: row.url, duracion: row.duracion, credito: row.credito, ...(row.tiempos ? { tiempos: row.tiempos } : {}) };
  }
  if (row?.estado === 'grabando') return { estado: 'grabando' };
  return { estado: 'ninguno' };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const where = place(params.get('book') ?? undefined, params.get('chapter') ?? undefined, params.get('palabra'), params.get('version'));
  if (!where) return json({ error: 'Pedido no válido' }, 400);
  const s = await db().catch(() => null);
  if (!s) return json({ estado: 'ninguno' });
  const [row] = await s<(Row & { nivelado: boolean })[]>`select estado, url, duracion, credito, tiempos, nivelado
    from podcast_grabado where libro = ${where.book} and capitulo = ${where.chapter}`;
  if (row?.estado === 'listo' && !row.nivelado && row.url) waitUntil(renivelar(s, where, row.url));
  return json(answer(row));
}

/**
 * Nivela una grabación hecha antes de igualar las voces: la baja, la nivela por trozos de voz y la sube con otro
 * nombre (el MP3 viejo se guarda en caché un año). Mientras tanto se sigue sirviendo la de antes. Solo una a la vez.
 */
export async function renivelar(s: NonNullable<typeof sql>, where: Target, url: string): Promise<void> {
  const [mine] = await s`update podcast_grabado set nivelando = now()
    where libro = ${where.book} and capitulo = ${where.chapter} and estado = 'listo' and not nivelado and url = ${url}
      and (nivelando is null or nivelando < now() - make_interval(mins => ${NIVELAR_MINUTES}))
    returning 1`;
  if (!mine) return;
  try {
    const mp3 = url.startsWith('file://')
      ? new Uint8Array(await readFile(new URL(url)))
      : new Uint8Array(await (await fetch(url)).arrayBuffer());
    const { muestras, rate } = await decodificarMp3(mp3);
    const audio = await codificarMp3(muestrasA16(nivelar(muestras, rate, tramosPorSilencio(muestras, rate))), rate, KBPS);
    const nombre = path.basename(new URL(url).pathname).replace(/(-n)?\.mp3$/, '-n.mp3');
    const nueva = await store(nombre, audio);
    await s`update podcast_grabado set url = ${nueva}, nivelado = true, nivelando = null, actualizado = now()
      where libro = ${where.book} and capitulo = ${where.chapter} and url = ${url}`;
  } catch (err) {
    console.error('podcast-grabado: nivelar', err);
  }
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

type Segmento = { start_time_seconds: number; end_time_seconds: number; dialogue_input_index: number };

/** Un tramo grabado: el audio sin comprimir y dónde suena cada intervención. */
async function dialogue(lines: Line[]): Promise<{ muestras: Float32Array; segmentos: Segmento[] }> {
  const res = await fetch(`${ELEVEN_URL}/v1/text-to-dialogue/with-timestamps?output_format=pcm_${PCM_HZ}`, {
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
  const body = (await res.json()) as { audio_base64: string; voice_segments?: Segmento[] };
  return { muestras: pcmAMuestras(Buffer.from(body.audio_base64, 'base64')), segmentos: body.voice_segments ?? [] };
}

/**
 * Graba el guion por tramos (varios a la vez) y los une. ElevenLabs dice dónde suena cada intervención: con eso se
 * lleva cada una al mismo volumen y la app sigue el texto. Si no lo dijera, se reparte por la longitud del texto y
 * se nivela por silencios.
 */
async function record(lines: Line[]): Promise<{ audio: Uint8Array; tiempos: number[]; duracion: number }> {
  const groups: Line[][] = [];
  for (let i = 0; i < lines.length; i += TURNS_PER_CHUNK) groups.push(lines.slice(i, i + TURNS_PER_CHUNK));
  const parts: Awaited<ReturnType<typeof dialogue>>[] = new Array(groups.length);
  let next = 0;
  const worker = async () => {
    while (next < groups.length) {
      const i = next++;
      parts[i] = await dialogue(groups[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, groups.length) }, worker));
  const todo = new Float32Array(parts.reduce((n, p) => n + p.muestras.length, 0));
  const tiempos: number[] = [];
  const tramos: Tramo[] = [];
  let at = 0;
  parts.forEach(({ muestras, segmentos }, i) => {
    todo.set(muestras, at);
    const desde = at / PCM_HZ;
    const inicios = groups[i].map((_, k) => segmentos.find((sg) => sg.dialogue_input_index === k)?.start_time_seconds);
    if (inicios.every((t) => t !== undefined)) {
      tiempos.push(...inicios.map((t) => Math.round((desde + t!) * 10) / 10));
      for (const sg of segmentos) {
        tramos.push({ desde: at + Math.round(sg.start_time_seconds * PCM_HZ), hasta: at + Math.round(sg.end_time_seconds * PCM_HZ) });
      }
    } else {
      tiempos.push(...lineStarts(groups[i].map((l) => l.text), muestras.length / PCM_HZ, desde));
      tramos.push(...tramosPorSilencio(muestras, PCM_HZ).map((t) => ({ desde: at + t.desde, hasta: at + t.hasta })));
    }
    at += muestras.length;
  });
  const audio = await codificarMp3(muestrasA16(nivelar(todo, PCM_HZ, tramos)), PCM_HZ, KBPS);
  return { audio, tiempos, duracion: todo.length / PCM_HZ };
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
    token: BLOB_TOKEN,
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

  let body: { book?: unknown; chapter?: unknown; palabra?: unknown; version?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Pedido no válido' }, 400);
  }
  const where = place(body.book, body.chapter, body.palabra, body.version);
  if (!where) return json({ error: 'Pedido no válido' }, 400);
  const { book, chapter } = where;

  const [current] = await s<(Row & { viejo: boolean })[]>`select estado, url, duracion, credito, tiempos,
      actualizado < now() - make_interval(mins => ${STALE_MINUTES}) as viejo
    from podcast_grabado where libro = ${book} and capitulo = ${chapter}`;
  if (current?.estado === 'listo' || (current?.estado === 'grabando' && !current.viejo)) return json(answer(current));

  if (!process.env.ELEVENLABS_API_KEY || (!STORE_DIR && !BLOB_TOKEN)) {
    return json({ error: 'Las voces naturales todavía no están activadas en el servidor.' }, 503);
  }

  const [guion] = await s<{ texto: string }[]>`select texto from herramientas_ia
    where herramienta = ${where.guion.herramienta} and libro = ${where.guion.libro} and capitulo = ${where.guion.capitulo}`.catch(
    () => [],
  );
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
    const { audio, tiempos, duracion: largo } = await record(lines);
    const tag = createHash('sha256').update(guion.texto).digest('hex').slice(0, 10);
    const url = await store(`${(chapter ? `${book}-${chapter}` : book).replaceAll(':', '-')}-${tag}.mp3`, audio);
    const duracion = Math.round(largo);
    await s`update podcast_grabado set estado = 'listo', url = ${url}, duracion = ${duracion}, credito = ${CREDIT},
      tiempos = ${s.json(tiempos)}, nivelado = true, nivelando = null, actualizado = now() where libro = ${book} and capitulo = ${chapter}`;
    return json({ estado: 'listo', url, duracion, credito: CREDIT, tiempos });
  } catch (err) {
    console.error('podcast-grabado: grabar', err);
    await s`update podcast_grabado set estado = 'error', actualizado = now()
      where libro = ${book} and capitulo = ${chapter}`.catch(() => {});
    return json({ error: 'No se pudo grabar el pódcast. Inténtalo de nuevo más tarde.' }, 502);
  }
}
