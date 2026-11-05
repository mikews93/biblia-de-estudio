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
// A veces ElevenLabs entrega muda una intervención, casi siempre la última de un tramo: así se perdía la pregunta final
// a quien escucha (Juan 1: los últimos 6 s, en silencio). Cada intervención muda se graba otra vez sola y se pone en su
// lugar. Las grabaciones de antes se revisan igual la primera vez que alguien las abre (columna «revision»).
// Después (Romanos 11, 4-11) se vio que la última intervención también puede llegar casi muda o cortada, o sin dónde
// suena: se compara lo que dura con lo que debería durar su texto, y la que falta se graba con la voz sola
// (text-to-speech), que no la pierde, en vez de otra vez como diálogo.
// En 1 Reyes 21 (4-11) la pregunta final seguía muda (7 s de silencio absoluto al final): la voz sola se pedía con
// language_code, y si ElevenLabs lo rechaza no se regraba nada. Ya no se manda, un fallo al regrabar no tumba la
// grabación, y REVISION 3 vuelve a revisar las hechas. Y si el guion cambia («Preparar otra versión»), la grabación del
// guion de antes deja de servirse y se puede grabar el nuevo.

import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

import { muestrasA16, nivelar, pcmAMuestras, type Tramo, tramosPorSilencio, volumenHabla } from '../src/lib/nivelarVoces';
import { palabraAudioId, palabraPorId } from '../src/lib/palabras';
import { conVersion, versionPodcast } from '../src/lib/podcastVersion';
import { lineStarts } from '../src/lib/podcastTiempos';
import { codificarMp3, decodificarMp3 } from './_mp3';
import { esCuidador } from './_senales';
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
/** Por debajo de esto (dBFS de habla) una intervención cuenta como muda. */
const MUDA_DB = -50;
/** Cuántas veces se vuelve a pedir una intervención que llegó muda. */
const REINTENTOS = 2;
/** Caracteres por segundo de habla que se esperan (Ana y Tomás hablan a unos 14 o 16). */
const CHARS_POR_S = Number(process.env.PODCAST_CHARS_POR_S ?? 15);
/** Si una intervención suena menos que esta parte de lo esperado por su texto, se perdió (o se cortó). */
const MINIMO_ESPERADO = 0.35;
/** Silencio al final de un tramo sin tiempos que delata que su última intervención no se grabó. */
const COLA_MUDA_S = 2;
/** Modelo de la voz sola para regrabar lo que falta. */
const MODELO_SOLA = process.env.PODCAST_MODELO_SOLA ?? 'eleven_multilingual_v2';
/** Sube cuando cambia cómo se buscan las intervenciones mudas: las grabaciones con una revisión menor se revisan otra vez. */
const REVISION = 4;
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
  /** Qué pasó al grabar la intervención final (ver vozFinal). */
  diagnostico?: string[] | null;
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
    // Y algunas traen mudas intervenciones (la pregunta final): «revisado» dice si ya se buscaron y regrabaron.
    .then(() => sql!`alter table podcast_grabado add column if not exists revisado boolean not null default false,
      add column if not exists revisando timestamptz`)
    // «revisado» pasó a ser un número: con qué forma de buscarlas se revisó (REVISION).
    .then(() => sql!`alter table podcast_grabado add column if not exists revision int not null default 0`)
    // Qué pasó al grabar la intervención final (y qué falló), para saber por qué faltaría sin leer los registros.
    .then(() => sql!`alter table podcast_grabado add column if not exists diagnostico jsonb`)
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
    return {
      estado: 'listo',
      url: row.url,
      duracion: row.duracion,
      credito: row.credito,
      ...(row.tiempos ? { tiempos: row.tiempos } : {}),
      ...(row.diagnostico?.length ? { diagnostico: row.diagnostico } : {}),
    };
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
  const [row] = await s<(Row & { nivelado: boolean; revision: number; vieja: boolean })[]>`select g.estado, g.url, g.duracion,
      g.credito, g.tiempos, g.nivelado, g.revision, g.diagnostico, (h.texto is not null and g.guion is not null and g.guion <> h.texto) as vieja
    from podcast_grabado g
    left join herramientas_ia h on h.herramienta = ${where.guion.herramienta} and h.libro = ${where.guion.libro}
      and h.capitulo = ${where.guion.capitulo}
    where g.libro = ${where.book} and g.capitulo = ${where.chapter}`;
  // Con «Preparar otra versión» el guion cambió: la grabación de antes ya no es la suya y se puede grabar el nuevo.
  if (row?.estado === 'listo' && row.vieja) return json({ estado: 'ninguno' });
  if (row?.estado === 'listo' && !row.nivelado && row.url) waitUntil(renivelar(s, where, row.url));
  else if (row?.estado === 'listo' && row.revision < REVISION && row.url && row.tiempos && process.env.ELEVENLABS_API_KEY) {
    waitUntil(revisar(s, where, row.url));
  }
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

/**
 * Busca en una grabación ya lista las intervenciones mudas (por sus tiempos), las graba otra vez solas, las pone en su
 * lugar y sube el MP3 con otro nombre. Si no falta ninguna, solo se marca como revisada. Solo una a la vez.
 */
export async function revisar(s: NonNullable<typeof sql>, where: Target, url: string): Promise<void> {
  const [row] = await s<{ guion: string | null; tiempos: number[] }[]>`update podcast_grabado set revisando = now()
    where libro = ${where.book} and capitulo = ${where.chapter} and estado = 'listo' and nivelado and revision < ${REVISION}
      and url = ${url} and tiempos is not null
      and (revisando is null or revisando < now() - make_interval(mins => ${NIVELAR_MINUTES}))
    returning guion, tiempos`;
  if (!row) return;
  const marcar = (cambios: { url: string; tiempos: number[]; duracion: number } | null) =>
    cambios
      ? s`update podcast_grabado set url = ${cambios.url}, tiempos = ${s.json(cambios.tiempos)}, duracion = ${cambios.duracion},
          revisado = true, revision = ${REVISION}, revisando = null, actualizado = now()
          where libro = ${where.book} and capitulo = ${where.chapter} and url = ${url}`
      : s`update podcast_grabado set revisado = true, revision = ${REVISION}, revisando = null
          where libro = ${where.book} and capitulo = ${where.chapter} and url = ${url}`;
  try {
    const lines = row.guion ? scriptLines(row.guion) : [];
    // Sin el guion, o si no coincide con los tiempos, no se sabe qué intervención es cuál.
    if (lines.length !== row.tiempos.length) return void (await marcar(null));
    const mp3 = url.startsWith('file://')
      ? new Uint8Array(await readFile(new URL(url)))
      : new Uint8Array(await (await fetch(url)).arrayBuffer());
    const { muestras, rate } = await decodificarMp3(mp3);
    const segmentos: Segmento[] = row.tiempos.map((t, k) => ({
      start_time_seconds: t,
      end_time_seconds: row.tiempos[k + 1] ?? muestras.length / rate,
      dialogue_input_index: k,
    }));
    // Los tiempos de antes pueden ser estimados: la duración solo se mira en la última, la que se perdía.
    const diagnostico: string[] = [];
    const reparado = await repararMudas({ muestras, segmentos }, lines, rate, true, diagnostico);
    if (diagnostico.length) await s`update podcast_grabado set diagnostico = ${s.json(diagnostico)} where libro = ${where.book} and capitulo = ${where.chapter}`;
    if (!reparado) return void (await marcar(null));
    const tramos = reparado.segmentos.map((sg) => ({ desde: Math.round(sg.start_time_seconds * rate), hasta: Math.round(sg.end_time_seconds * rate) }));
    const audio = await codificarMp3(muestrasA16(nivelar(reparado.muestras, rate, tramos)), rate, KBPS);
    const nombre = path.basename(new URL(url).pathname).replace(/(-r)?\.mp3$/, '-r.mp3');
    const nueva = await store(nombre, audio);
    await marcar({
      url: nueva,
      tiempos: reparado.segmentos.map((sg) => Math.round(sg.start_time_seconds * 10) / 10),
      duracion: Math.round(reparado.muestras.length / rate),
    });
  } catch (err) {
    console.error('podcast-grabado: revisar', err);
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
type Parte = { muestras: Float32Array; segmentos: Segmento[] };

/** Segundos con voz entre `desde` y `hasta` (ventanas de 50 ms por encima de MUDA_DB). */
export function segundosConVoz(m: Float32Array, rate: number, desde: number, hasta: number): number {
  const n = Math.max(1, Math.round(0.05 * rate));
  const umbral = 10 ** (MUDA_DB / 20);
  let con = 0;
  for (let i = Math.max(0, desde); i < Math.min(m.length, hasta); i += n) {
    let s = 0;
    const fin = Math.min(hasta, m.length, i + n);
    for (let k = i; k < fin; k++) s += m[k] * m[k];
    if (Math.sqrt(s / Math.max(1, fin - i)) > umbral) con += fin - i;
  }
  return con / rate;
}

/** Lo que debería durar como mínimo una intervención por su texto. */
const minimo = (texto: string) => (texto.length / CHARS_POR_S) * MINIMO_ESPERADO;

/**
 * Las intervenciones de un tramo que faltan, por su índice: mudas, sin ubicar o (con `textos`) mucho más cortas que su
 * texto. Con `soloUltima`, la duración se mira solo en la última (cuando los tiempos son estimados).
 */
export function mudas(parte: Parte, n: number, rate = PCM_HZ, textos?: string[], soloUltima = false): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const sg = parte.segmentos.find((x) => x.dialogue_input_index === k);
    if (!sg) {
      out.push(k);
      continue;
    }
    const desde = Math.max(0, Math.round(sg.start_time_seconds * rate));
    const hasta = Math.min(parte.muestras.length, Math.round(sg.end_time_seconds * rate));
    const v = volumenHabla(parte.muestras, rate, { desde, hasta });
    const corta = textos && (!soloUltima || k === n - 1) && segundosConVoz(parte.muestras, rate, desde, hasta) < minimo(textos[k]);
    if (v === null || v < MUDA_DB || corta) out.push(k);
  }
  return out;
}

/** Cambia el audio de la intervención `k` por `nuevo` y corre lo que viene después. */
export function reemplazar(parte: Parte, k: number, nuevo: Float32Array, rate = PCM_HZ): Parte {
  const orden = [...parte.segmentos].sort((a, b) => a.start_time_seconds - b.start_time_seconds);
  let sg = orden.find((x) => x.dialogue_input_index === k);
  if (!sg) {
    // ElevenLabs no la ubicó: va justo después de la anterior que sí está (o al final si no hay ninguna).
    const antes = orden.filter((x) => x.dialogue_input_index < k).at(-1);
    const at = antes ? antes.end_time_seconds : 0;
    const siguiente = orden.find((x) => x.dialogue_input_index > k);
    sg = { start_time_seconds: at, end_time_seconds: siguiente ? Math.max(at, siguiente.start_time_seconds) : parte.muestras.length / rate, dialogue_input_index: k };
  }
  const desde = Math.round(sg.start_time_seconds * rate);
  const hasta = Math.max(desde, Math.round(sg.end_time_seconds * rate));
  const muestras = new Float32Array(parte.muestras.length - (hasta - desde) + nuevo.length);
  muestras.set(parte.muestras.subarray(0, desde), 0);
  muestras.set(nuevo, desde);
  muestras.set(parte.muestras.subarray(hasta), desde + nuevo.length);
  const corre = (nuevo.length - (hasta - desde)) / rate;
  const segmentos = parte.segmentos
    .filter((x) => x.dialogue_input_index !== k)
    .map((x) => (x.start_time_seconds >= sg!.end_time_seconds - 1e-6
      ? { ...x, start_time_seconds: x.start_time_seconds + corre, end_time_seconds: x.end_time_seconds + corre }
      : x));
  segmentos.push({ start_time_seconds: desde / rate, end_time_seconds: (desde + nuevo.length) / rate, dialogue_input_index: k });
  segmentos.sort((a, b) => a.dialogue_input_index - b.dialogue_input_index);
  return { muestras, segmentos };
}

/**
 * Un tramo que ElevenLabs entregó sin decir dónde suena cada intervención: si termina con un silencio largo, o si todo
 * junto suena mucho menos que su texto, la última no se grabó. Se le pone un lugar (después de la última voz) para
 * cambiarla. `null` si el tramo está bien.
 */
export function ultimaPerdida(parte: Parte, lines: { text: string }[], rate = PCM_HZ): Parte | null {
  const tramos = tramosPorSilencio(parte.muestras, rate);
  const fin = tramos.at(-1)?.hasta ?? 0;
  const cola = (parte.muestras.length - fin) / rate;
  const total = segundosConVoz(parte.muestras, rate, 0, parte.muestras.length);
  const esperado = lines.reduce((n, l) => n + l.text.length, 0) / CHARS_POR_S;
  if (cola < COLA_MUDA_S && total >= esperado * 0.6) return null;
  const desde = Math.min(parte.muestras.length, fin + Math.round(0.1 * rate)) / rate;
  return { muestras: parte.muestras, segmentos: [{ start_time_seconds: desde, end_time_seconds: parte.muestras.length / rate, dialogue_input_index: lines.length - 1 }] };
}

/** Una intervención grabada sola con la voz de text-to-speech, sin los silencios de los bordes. */
async function sola(line: Line): Promise<Float32Array> {
  const res = await fetch(`${ELEVEN_URL}/v1/text-to-speech/${line.voice}?output_format=pcm_${PCM_HZ}`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '', 'Content-Type': 'application/json' },
    // Sin language_code: no todos los modelos lo aceptan (si no, la regrabación falla entera) y el idioma sale del texto.
    body: JSON.stringify({ text: line.text, model_id: MODELO_SOLA, seed: 7 }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const m = pcmAMuestras(new Uint8Array(await res.arrayBuffer()));
  const tramos = tramosPorSilencio(m, PCM_HZ);
  return tramos.length ? m.subarray(tramos[0].desde, tramos.at(-1)!.hasta) : m;
}

/**
 * Graba otra vez, sola, cada intervención de un tramo que falta (ver mudas y ultimaPerdida) y la pone en su lugar.
 * `null` si no faltaba ninguna. Con `soloUltima`, la duración solo se mira en la última.
 */
async function repararMudas(parte: Parte, lines: Line[], rate = PCM_HZ, soloUltima = false, diagnostico?: string[]): Promise<Parte | null> {
  let base = parte;
  let faltan: number[];
  if (parte.segmentos.length) faltan = mudas(parte, lines.length, rate, lines.map((l) => l.text), soloUltima);
  else {
    const ubicada = ultimaPerdida(parte, lines, rate);
    if (!ubicada) return null;
    base = ubicada;
    faltan = [lines.length - 1];
  }
  if (!faltan.length) return null;
  let out = base;
  for (const k of faltan) {
    // En una grabación ya hecha (soloUltima), la que falta es la final: va por todos los caminos de vozFinal.
    if (soloUltima && k === lines.length - 1 && lines.length > 1) {
      const voz = await vozFinal(lines[k], lines[k - 1], diagnostico ?? []);
      if (!voz) continue;
      const nueva = rate === PCM_HZ ? voz : remuestrear(voz, PCM_HZ, rate);
      const conPausa = new Float32Array(nueva.length + Math.round(0.35 * rate));
      conPausa.set(nueva);
      out = reemplazar(out, k, conPausa, rate);
      continue;
    }
    for (let intento = 0; intento < REINTENTOS; intento++) {
      const voz = await sola(lines[k]);
      if (segundosConVoz(voz, PCM_HZ, 0, voz.length) < minimo(lines[k].text)) continue;
      const nueva = rate === PCM_HZ ? voz : remuestrear(voz, PCM_HZ, rate);
      // Con una pausa corta al final, como entre intervenciones.
      const conPausa = new Float32Array(nueva.length + Math.round(0.35 * rate));
      conPausa.set(nueva);
      out = reemplazar(out, k, conPausa, rate);
      break;
    }
  }
  if (out === base) {
    console.error('podcast-grabado: no se pudo regrabar', faltan.map((k) => lines[k].text.slice(0, 40)));
    return null;
  }
  return out;
}

/** Cambio de frecuencia lineal (solo para grabaciones viejas que vengan a otra frecuencia que la de ElevenLabs). */
function remuestrear(m: Float32Array, de: number, a: number): Float32Array {
  const out = new Float32Array(Math.round((m.length * a) / de));
  for (let i = 0; i < out.length; i++) {
    const x = (i * de) / a;
    const j = Math.floor(x);
    out[i] = (m[j] ?? 0) + ((m[j + 1] ?? m[j] ?? 0) - (m[j] ?? 0)) * (x - j);
  }
  return out;
}

/** Un tramo grabado: el audio sin comprimir y dónde suena cada intervención. */
async function dialogue(lines: Line[]): Promise<Parte> {
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
async function record(lines: Line[]): Promise<{ audio: Uint8Array; tiempos: number[]; duracion: number; diagnostico: string[] }> {
  const diagnostico: string[] = [];
  // La intervención final (la pregunta a quien escucha) es la que ElevenLabs entrega muda una y otra vez como última
  // del diálogo (Juan 1, Romanos 11, 1 Reyes 21): se graba aparte, con la voz sola, y se pone al final.
  const cuerpo = lines.length > 1 ? lines.slice(0, -1) : lines;
  const groups: Line[][] = [];
  for (let i = 0; i < cuerpo.length; i += TURNS_PER_CHUNK) groups.push(cuerpo.slice(i, i + TURNS_PER_CHUNK));
  const parts: Parte[] = new Array(groups.length);
  let next = 0;
  const worker = async () => {
    while (next < groups.length) {
      const i = next++;
      const parte = await dialogue(groups[i]);
      // Si regrabar falla, se queda el tramo como vino: mejor una intervención muda que perder toda la grabación.
      parts[i] = (await repararMudas(parte, groups[i]).catch((err) => {
        console.error('podcast-grabado: regrabar', err);
        diagnostico.push(`tramo ${i + 1}: ${String(err).slice(0, 200)}`);
        return null;
      })) ?? parte;
    }
  };
  const final = lines.length > 1 ? grabarFinal(lines.at(-1)!, lines.at(-2)!, diagnostico) : null;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, groups.length) }, worker));
  if (final) {
    groups.push([lines.at(-1)!]);
    parts.push(await final);
  }
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
  return { audio, tiempos, duracion: todo.length / PCM_HZ, diagnostico };
}

/** La voz de un audio sin los silencios de los bordes, o null si casi no suena para lo largo que es su texto. */
function conVoz(m: Float32Array, texto: string): Float32Array | null {
  const tramos = tramosPorSilencio(m, PCM_HZ);
  if (!tramos.length) return null;
  const voz = m.subarray(tramos[0].desde, tramos.at(-1)!.hasta);
  return segundosConVoz(voz, PCM_HZ, 0, voz.length) < minimo(texto) ? null : voz;
}

/**
 * La intervención final, sola: primero con la voz sola (text-to-speech); si falla o llega muda, como diálogo de una
 * intervención; y si tampoco, como diálogo con la anterior, quedándose con la segunda. Lo que pasa queda en `diagnostico`.
 */
async function vozFinal(line: Line, anterior: Line, diagnostico: string[]): Promise<Float32Array | null> {
  const intentos: [string, () => Promise<Float32Array | null>][] = [
    ['voz sola', async () => conVoz(await sola(line), line.text)],
    ['voz sola', async () => conVoz(await sola(line), line.text)],
    ['diálogo solo', async () => conVoz((await dialogue([line])).muestras, line.text)],
    [
      'diálogo con la anterior',
      async () => {
        const parte = await dialogue([anterior, line]);
        const sg = parte.segmentos.find((x) => x.dialogue_input_index === 1);
        if (!sg) return null;
        return conVoz(parte.muestras.subarray(Math.round(sg.start_time_seconds * PCM_HZ), Math.round(sg.end_time_seconds * PCM_HZ)), line.text);
      },
    ],
  ];
  let voz: Float32Array | null = null;
  for (const [nombre, intento] of intentos) {
    try {
      voz = await intento();
      diagnostico.push(`final, ${nombre}: ${voz ? `bien (${(voz.length / PCM_HZ).toFixed(1)} s)` : 'muda'}`);
    } catch (err) {
      console.error('podcast-grabado: final', nombre, err);
      diagnostico.push(`final, ${nombre}: ${String(err).slice(0, 200)}`);
    }
    if (voz) break;
  }
  return voz;
}

async function grabarFinal(line: Line, anterior: Line, diagnostico: string[]): Promise<Parte> {
  const voz = await vozFinal(line, anterior, diagnostico);
  // Si nada sonó, queda su lugar en silencio (como antes), pero la grabación no se pierde.
  const cuerpo = voz ?? new Float32Array(Math.round(1 * PCM_HZ));
  const antes = Math.round(0.25 * PCM_HZ);
  const muestras = new Float32Array(antes + cuerpo.length + Math.round(0.6 * PCM_HZ));
  muestras.set(cuerpo, antes);
  return { muestras, segmentos: [{ start_time_seconds: antes / PCM_HZ, end_time_seconds: (antes + cuerpo.length) / PCM_HZ, dialogue_input_index: 0 }] };
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

  const [guion] = await s<{ texto: string }[]>`select texto from herramientas_ia
    where herramienta = ${where.guion.herramienta} and libro = ${where.guion.libro} and capitulo = ${where.guion.capitulo}`.catch(
    () => [],
  );
  const [current] = await s<(Row & { viejo: boolean; guion: string | null })[]>`select estado, url, duracion, credito, tiempos,
      diagnostico, guion, actualizado < now() - make_interval(mins => ${STALE_MINUTES}) as viejo
    from podcast_grabado where libro = ${book} and capitulo = ${chapter}`;
  const vieja = current?.estado === 'listo' && !!guion && current.guion !== null && current.guion !== guion.texto;
  if ((current?.estado === 'listo' && !vieja) || (current?.estado === 'grabando' && !current.viejo)) return json(answer(current));

  if (!process.env.ELEVENLABS_API_KEY || (!STORE_DIR && !BLOB_TOKEN)) {
    return json({ error: 'Las voces naturales todavía no están activadas en el servidor.' }, 503);
  }
  const lines = guion ? scriptLines(guion.texto) : [];
  if (!lines.length) return json({ error: 'Primero hay que preparar el guion del pódcast.' }, 409);

  const [{ mias, todas, correo }] = await s<{ mias: number; todas: number; correo: string | null }[]>`select
      count(*) filter (where pedido_por = ${user})::int as mias, count(*)::int as todas,
      (select correo from usuarios where id = ${user}) as correo
    from podcast_grabado where creado > now() - interval '1 day'`;
  // Quienes cuidan Zarza (CUIDADORES en Vercel) pagan las voces: sin tope, para poder volver a grabar lo que haga falta.
  const cuida = esCuidador(correo);
  if (!cuida && mias >= PER_ACCOUNT) {
    return json({ error: `Puedes grabar hasta ${PER_ACCOUNT} pódcasts al día. Vuelve mañana.` }, 429);
  }
  if (!cuida && todas >= PER_DAY) {
    return json({ error: 'Por hoy ya se grabaron todos los pódcasts que permite la app. Vuelve mañana.' }, 429);
  }

  // Solo una grabación por capítulo: si otra persona empezó justo ahora, esta espera la suya.
  const [mine] = await s`insert into podcast_grabado (libro, capitulo, estado, guion, pedido_por)
    values (${book}, ${chapter}, 'grabando', ${guion.texto}, ${user})
    on conflict (libro, capitulo) do update
      set estado = 'grabando', guion = excluded.guion, pedido_por = excluded.pedido_por, creado = now(), actualizado = now()
      where podcast_grabado.estado = 'error'
        or (podcast_grabado.estado = 'listo' and podcast_grabado.guion is not null and podcast_grabado.guion <> excluded.guion)
        or (podcast_grabado.estado = 'grabando' and podcast_grabado.actualizado < now() - make_interval(mins => ${STALE_MINUTES}))
    returning 1`;
  if (!mine) return json({ estado: 'grabando' });

  try {
    const { audio, tiempos, duracion: largo, diagnostico } = await record(lines);
    const tag = createHash('sha256').update(guion.texto).digest('hex').slice(0, 10);
    const url = await store(`${(chapter ? `${book}-${chapter}` : book).replaceAll(':', '-')}-${tag}.mp3`, audio);
    const duracion = Math.round(largo);
    await s`update podcast_grabado set estado = 'listo', url = ${url}, duracion = ${duracion}, credito = ${CREDIT},
      tiempos = ${s.json(tiempos)}, diagnostico = ${s.json(diagnostico)}, nivelado = true, nivelando = null, revisado = true, revision = ${REVISION}, revisando = null, actualizado = now() where libro = ${book} and capitulo = ${chapter}`;
    return json({ estado: 'listo', url, duracion, credito: CREDIT, tiempos, ...(diagnostico.length ? { diagnostico } : {}) });
  } catch (err) {
    console.error('podcast-grabado: grabar', err);
    await s`update podcast_grabado set estado = 'error', actualizado = now()
      where libro = ${book} and capitulo = ${chapter}`.catch(() => {});
    return json({ error: 'No se pudo grabar el pódcast. Inténtalo de nuevo más tarde.' }, 502);
  }
}
