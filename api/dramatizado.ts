// Audio dramatizado de un capítulo a pedido, como el pódcast grabado: la primera persona que lo pide lo prepara y
// desde ahí queda listo para todos los que leen esa versión.
//   GET  ?book=mrk&chapter=2[&version=bes] → {estado: 'listo', url, duracion, credito, tiempos} |
//        {estado: 'grabando', fase, hechas, total} | {estado: 'ninguno'} | {estado: 'error'}
//   POST {book, chapter, version}          → lo empieza (necesita cuenta) y responde como GET.
//
// Se hace en tres fases, cada una en su propia llamada a la función (Vercel corta a los 300 s):
//   1. guion: la IA reparte el texto del capítulo entre el narrador y los personajes, con indicaciones de voz,
//      ambientes y efectos (src/lib/dramaGuion.ts). Cada versículo tiene que decir el texto exacto de la versión; el
//      que no, lo lee el narrador tal cual.
//   2. voces: cada versículo se graba con Text to Dialogue (eleven_v4) y cada sonido con Sound Effects. Cada pieza
//      se guarda en Vercel Blob por su contenido: si la función se corta, la siguiente sigue donde quedó.
//   3. mezcla: une las piezas con pausas, el eco y la capa de la voz de Dios, los ambientes de cada escena y un fondo
//      de pads propios (public/audio/ambiente), y sube el MP3.
// Cada fase termina pidiéndose a sí misma la siguiente (un GET); y cada GET de la app, mientras espera, retoma una
// fase que quedó parada. Nadie más puede tomar una fase mientras otra llamada la trabaja (columna «trabajando»).
//
// Versiones: una grabación por versión libre (como el pódcast). Quien lee una versión con derechos escucha la
// libre de src/lib/podcastVersion.ts: su texto no se puede pasar a la IA ni convertir en audio.
// Costo: un capítulo medio son unos 3.500 caracteres de voces más unos 1.500 créditos de sonidos. Hay un límite por
// cuenta y otro para toda la app, y antes de empezar se mira que en ElevenLabs queden créditos con margen para el
// pódcast (DRAMA_RESERVA).
// Las grabaciones hechas a mano (pipeline/audio_dramatizado, public/audio/index.json) siguen teniendo prioridad.

import Anthropic from '@anthropic-ai/sdk';
import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

import {
  type Escena,
  type Genero,
  type Linea,
  type Plan,
  type Registro,
  DIOS,
  JESUS,
  NARRADOR,
  revisarGuion,
} from '../src/lib/dramaGuion';
import { OBJETIVO_DB, muestrasA16, pcmAMuestras, tramosPorSilencio, volumenHabla } from '../src/lib/nivelarVoces';
import { conVersion, versionPodcast } from '../src/lib/podcastVersion';
import { load } from './_investigar';
import { codificarMp3, decodificarMp3 } from './_mp3';
import { esCuidador } from './_senales';
import { waitUntil } from './_seguir';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const ELEVEN_URL = process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io';
const MODELO_VOZ = process.env.DRAMA_MODELO_VOZ ?? 'eleven_v4';
const MODELO_SONIDO = process.env.DRAMA_MODELO_SONIDO ?? 'eleven_text_to_sound_v2';
const MODELO_IA = process.env.DRAMA_MODELO ?? 'claude-opus-5-5';
const PER_ACCOUNT = Number(process.env.DRAMA_LIMITE_CUENTA ?? 1);
const PER_DAY = Number(process.env.DRAMA_LIMITE_DIA ?? 3);
/** Créditos de ElevenLabs que se dejan siempre libres (para el pódcast y las grabaciones a mano). */
const RESERVA = Number(process.env.DRAMA_RESERVA ?? 10000);
/** Créditos aproximados de los ambientes y efectos de un capítulo. */
const CREDITOS_SONIDOS = 1500;
const RATE = 24000;
const KBPS = 80;
/** Una llamada deja de grabar piezas pasado este tiempo y pide a otra que siga (Vercel corta a los 300 s). */
const PRESUPUESTO_MS = Number(process.env.DRAMA_PRESUPUESTO_MS ?? 200_000);
/** Si una fase lleva más que esto «trabajando», la llamada se cortó y otra la puede retomar. */
const TRABAJO_MIN = 5;
/** Después de tantos fallos seguidos, la grabación queda en error y se puede volver a pedir. */
const MAX_FALLOS = 3;
const PARALELO = 4;
const GAP = 0.35;
const ENTRE_ESCENAS = 1.6;
const AMBIENTE_DB = -24;
const EFECTO_DB = -10;
const FONDO_DB = -27;
const ENTRADA_S = 2.5;
const STORE_DIR = process.env.DRAMA_STORE_DIR;
const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN ??
  Object.entries(process.env).find(([k, v]) => /^BLOB.*READ_WRITE_TOKEN$/.test(k) && v)?.[1];
const ROOT = process.cwd();
const CREDITO = (version: string) =>
  `Audio dramatizado a pedido en la ${version.toUpperCase()}. Guion de Claude con el texto exacto de la versión; voces y efectos de ElevenLabs; fondo musical de Zarza.`;

// ---------------------------------------------------------------- voces

/** Voces probadas en Marcos 1 y en el pódcast (biblioteca de ElevenLabs, español latinoamericano). */
type Voz = { id: string; genero: Genero; edad: 'joven' | 'adulto' | 'mayor' };
const NARRADOR_VOZ = process.env.DRAMA_VOZ_NARRADOR ?? '452WrNT9o8dphaYW5YGU'; // Abel, elegido por Mike
const JESUS_VOZ = process.env.DRAMA_VOZ_JESUS ?? 'qRUgOhnxGASxirG4fKjv'; // Jesús sereno de Marcos 1
const CONOCIDAS: Voz[] = [
  { id: 'WOY6pnQ1WCg0mrOZ54lM', genero: 'hombre', edad: 'joven' },
  { id: 'ByVRQtaK1WDOvTmP1PKO', genero: 'hombre', edad: 'adulto' },
  { id: 'CE9m1PQE2E76CKUkNL7C', genero: 'hombre', edad: 'adulto' },
  { id: '94zOad0g7T7K4oa7zhDq', genero: 'hombre', edad: 'adulto' },
  { id: 'Yb8JGzcZyW5YYzenhRCm', genero: 'hombre', edad: 'mayor' },
  { id: 'wfTWLJ20rcMqvU8gIiAB', genero: 'hombre', edad: 'mayor' },
  { id: 'iBGVhgcEZS6A5gTOjqSJ', genero: 'mujer', edad: 'adulto' },
  { id: 'CaJslL1xziwefCeTNzHv', genero: 'mujer', edad: 'adulto' },
];

/** Cómo suena la voz de Dios en cada registro (pipeline/audio_dramatizado/voz-de-dios.md). */
const REGISTRO: Record<Registro, { tag: string; eco: [number, number][]; capa: string; capaDb: number }> = {
  aprobacion: { tag: '[warm, majestic, slow]', eco: [[0.09, 0.35], [0.18, 0.2]], capa: 'very distant low rolling thunder, soft and deep, no rain', capaDb: -24 },
  llamado: { tag: '[gentle, calm]', eco: [], capa: 'soft gentle breeze, quiet', capaDb: -28 },
  poder: { tag: '[powerful, solemn]', eco: [[0.12, 0.4], [0.24, 0.25]], capa: 'deep thunder rolling over mountains', capaDb: -20 },
  gloria: { tag: '[majestic, awe]', eco: [[0.09, 0.35], [0.18, 0.2]], capa: 'great rushing waters, powerful river current', capaDb: -22 },
};

/** Las voces en español de la cuenta de ElevenLabs (las que Mike vaya añadiendo amplían el reparto). */
async function vocesDeCuenta(): Promise<Voz[]> {
  try {
    const res = await fetch(`${ELEVEN_URL}/v2/voices?page_size=100`, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { voices?: { voice_id: string; labels?: Record<string, string> }[] };
    return (body.voices ?? []).flatMap((v) => {
      const l = v.labels ?? {};
      const espanol = /^es/i.test(l.language ?? '') || /latin|mexic|colombia|argentin|spanish|español/i.test(l.accent ?? '');
      if (!espanol || v.voice_id === NARRADOR_VOZ || v.voice_id === JESUS_VOZ) return [];
      const genero: Genero = /female|mujer/i.test(l.gender ?? '') ? 'mujer' : 'hombre';
      const edad = /old|mayor/i.test(l.age ?? '') ? 'mayor' : /young|joven/i.test(l.age ?? '') ? 'joven' : 'adulto';
      return [{ id: v.voice_id, genero, edad } as Voz];
    });
  } catch {
    return [];
  }
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** Un orden fijo por capítulo: así cada capítulo reparte distinto, sobre todo la voz de Dios. */
function barajar<T>(xs: T[], semilla: string): T[] {
  return xs
    .map((x, i) => ({ x, k: hash(`${semilla}:${i}`) }))
    .sort((a, b) => (a.k < b.k ? -1 : 1))
    .map((p) => p.x);
}

/**
 * Qué voz dice cada papel. El narrador es siempre Abel y Jesús siempre la misma voz serena; los personajes, la que
 * mejor encaje por género y edad sin repetir; Dios, voces que no use nadie más en el capítulo, distintas según el
 * capítulo (voz-de-dios.md: no hay «una voz de Dios»). Si no alcanzan, se repite la menos usada del mismo género.
 */
export function repartir(plan: Plan, disponibles: Voz[], semilla: string): Record<string, string[]> {
  const pool = barajar(
    [...new Map([...CONOCIDAS, ...disponibles].map((v) => [v.id, v])).values()].filter((v) => v.id !== NARRADOR_VOZ && v.id !== JESUS_VOZ),
    semilla,
  );
  const usos = new Map<string, number>();
  const tomar = (genero: Genero, edad: string, evitar: Set<string>) => {
    const del = pool.filter((v) => v.genero === genero);
    const opciones = del.length ? del : pool;
    const libre = opciones.filter((v) => !usos.has(v.id) && !evitar.has(v.id));
    const elegida =
      libre.find((v) => v.edad === edad) ??
      libre.find((v) => (edad === 'niño' ? v.edad === 'joven' : false)) ??
      libre[0] ??
      [...opciones].sort((a, b) => (usos.get(a.id) ?? 0) - (usos.get(b.id) ?? 0))[0];
    usos.set(elegida.id, (usos.get(elegida.id) ?? 0) + 1);
    return elegida.id;
  };
  const voces: Record<string, string[]> = { [NARRADOR]: [NARRADOR_VOZ], [JESUS]: [JESUS_VOZ] };
  for (const p of plan.personajes) voces[p.id] = [tomar(p.genero, p.edad, new Set())];
  const habla = new Set(plan.escenas.flatMap((e) => e.pasos.flatMap((p) => ('v' in p ? p.lineas.map((l) => l.voz) : []))));
  if (habla.has(DIOS)) {
    const evitar = new Set(Object.values(voces).flat());
    // Coro de tres edades para la voz desde el cielo; las otras formas usan la primera.
    voces[DIOS] = (['mayor', 'adulto', 'joven'] as const).map((edad) => tomar('hombre', edad, evitar));
  }
  return voces;
}

// ---------------------------------------------------------------- piezas

/** Lo que se graba: un tramo de voces seguidas o un sonido. Su clave es el hash de lo que se le pide a ElevenLabs. */
export type Pieza =
  | { tipo: 'voz'; clave: string; inputs: { text: string; voice_id: string }[] }
  | { tipo: 'sonido'; clave: string; prompt: string; dur: number; loop: boolean };

const texto = (l: Linea) => {
  const tag = l.tag ?? (l.registro ? REGISTRO[l.registro].tag : '');
  return `${tag} ${l.texto}`.trim();
};

function vozPieza(inputs: { text: string; voice_id: string }[]): Pieza {
  return { tipo: 'voz', clave: hash(JSON.stringify(['voz', MODELO_VOZ, inputs])).slice(0, 24), inputs };
}
function sonidoPieza(prompt: string, dur: number, loop: boolean): Pieza {
  return { tipo: 'sonido', clave: hash(JSON.stringify(['sonido', MODELO_SONIDO, prompt, dur, loop])).slice(0, 24), prompt, dur, loop };
}

/** Un versículo en partes: las líneas seguidas van juntas en un diálogo (suena más natural); la voz de Dios, aparte. */
export function partesDe(lineas: Linea[], voces: Record<string, string[]>) {
  const partes: { pieza: Pieza[]; registro?: Registro }[] = [];
  let seguidas: { text: string; voice_id: string }[] = [];
  const cerrar = () => {
    if (seguidas.length) partes.push({ pieza: [vozPieza(seguidas)] });
    seguidas = [];
  };
  for (const l of lineas) {
    const ids = voces[l.voz] ?? voces[NARRADOR];
    if (l.voz !== DIOS) {
      seguidas.push({ text: texto(l), voice_id: ids[0] });
      continue;
    }
    cerrar();
    const coro = l.registro === 'aprobacion' ? ids : ids.slice(0, 1);
    partes.push({ pieza: coro.map((id) => vozPieza([{ text: texto(l), voice_id: id }])), registro: l.registro ?? 'llamado' });
  }
  cerrar();
  return partes;
}

/** Todas las piezas del plan, sin repetir. */
export function piezasDe(plan: Plan, voces: Record<string, string[]>): Pieza[] {
  const todas = new Map<string, Pieza>();
  const add = (p: Pieza) => todas.set(p.clave, p);
  for (const e of plan.escenas) {
    if (e.ambiente) add(sonidoPieza(e.ambiente, 12, true));
    for (const p of e.pasos) {
      if ('efecto' in p) add(sonidoPieza(p.efecto, p.dur, false));
      else
        for (const parte of partesDe(p.lineas, voces)) {
          parte.pieza.forEach(add);
          if (parte.registro) add(sonidoPieza(REGISTRO[parte.registro].capa, 6, false));
        }
    }
  }
  return [...todas.values()];
}

// ---------------------------------------------------------------- audio

const lineal = (d: number) => 10 ** (d / 20);

function remuestrear(m: Float32Array, de: number, a: number): Float32Array {
  if (de === a) return m;
  const out = new Float32Array(Math.round((m.length * a) / de));
  for (let i = 0; i < out.length; i++) {
    const x = (i * de) / a;
    const j = Math.floor(x);
    out[i] = (m[j] ?? 0) + ((m[j + 1] ?? m[j] ?? 0) - (m[j] ?? 0)) * (x - j);
  }
  return out;
}

/** Sin los silencios de los bordes (ElevenLabs deja un poco antes y después). */
function recortar(m: Float32Array): Float32Array {
  const tramos = tramosPorSilencio(m, RATE);
  if (!tramos.length) return m;
  return m.subarray(Math.max(0, tramos[0].desde - Math.round(0.03 * RATE)), Math.min(m.length, tramos.at(-1)!.hasta + Math.round(0.08 * RATE)));
}

/** Lleva la voz al volumen de habla de la app (el mismo que el pódcast). */
function aVolumen(m: Float32Array, objetivo = OBJETIVO_DB): Float32Array {
  const v = volumenHabla(m, RATE, { desde: 0, hasta: m.length });
  if (v === null) return m;
  const g = lineal(Math.max(-12, Math.min(15, objetivo - v)));
  return m.map((x) => x * g);
}

/** Eco como el de grabar.py (aecho): copias más bajas a 90 y 180 ms, con cola. */
function eco(m: Float32Array, taps: [number, number][]): Float32Array {
  if (!taps.length) return m;
  const cola = Math.round(Math.max(...taps.map(([s]) => s)) * RATE * 2);
  const out = new Float32Array(m.length + cola);
  for (let i = 0; i < m.length; i++) out[i] += m[i] * 0.8;
  for (const [s, g] of taps) {
    const d = Math.round(s * RATE);
    for (let i = 0; i < m.length; i++) out[i + d] += m[i] * 0.8 * g;
  }
  return out;
}

/** Suma pistas de igual largo (el coro). */
function juntar(ms: Float32Array[]): Float32Array {
  const out = new Float32Array(Math.max(...ms.map((m) => m.length)));
  for (const m of ms) for (let i = 0; i < m.length; i++) out[i] += m[i] / Math.sqrt(ms.length);
  return out;
}

/** Repite un sonido hasta cubrir `largo` muestras, con fundidos cruzados y entrada y salida suaves. */
function cama(src: Float32Array, largo: number, fundido = 1.5): Float32Array {
  const out = new Float32Array(Math.max(0, largo));
  if (!src.length || !largo) return out;
  const cruce = Math.min(Math.round(fundido * RATE), Math.floor(src.length / 3));
  let at = 0;
  while (at < largo) {
    for (let i = 0; i < src.length && at + i < largo; i++) {
      const entra = at > 0 && i < cruce ? i / cruce : 1;
      const sale = i >= src.length - cruce ? (src.length - i) / cruce : 1;
      out[at + i] += src[i] * Math.min(entra, at + src.length < largo ? sale : 1);
    }
    at += src.length - cruce;
  }
  const f = Math.min(Math.round(fundido * RATE), Math.floor(largo / 3));
  for (let i = 0; i < f; i++) {
    out[i] *= i / f;
    out[largo - 1 - i] *= i / f;
  }
  return out;
}

/** RMS de todo el sonido llevado a −20 dBFS (los sonidos de ElevenLabs llegan a volúmenes muy distintos). */
function aRms(m: Float32Array, db = -20): Float32Array {
  let s = 0;
  for (const x of m) s += x * x;
  const rms = Math.sqrt(s / Math.max(1, m.length));
  if (rms < 1e-5) return m;
  const g = lineal(db) / rms;
  return m.map((x) => x * g);
}

function sumar(dst: Float32Array, src: Float32Array, at: number, gain = 1) {
  for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * gain;
}

// ---------------------------------------------------------------- ElevenLabs

const xi = () => ({ 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '', 'Content-Type': 'application/json' });

async function grabarVoz(inputs: { text: string; voice_id: string }[]): Promise<Float32Array> {
  const res = await fetch(`${ELEVEN_URL}/v1/text-to-dialogue/with-timestamps?output_format=pcm_${RATE}`, {
    method: 'POST',
    headers: xi(),
    body: JSON.stringify({ inputs, model_id: MODELO_VOZ, language_code: 'es', seed: 7 }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { audio_base64: string };
  return pcmAMuestras(Buffer.from(body.audio_base64, 'base64'));
}

async function grabarSonido(p: Extract<Pieza, { tipo: 'sonido' }>): Promise<Float32Array> {
  const res = await fetch(`${ELEVEN_URL}/v1/sound-generation?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: xi(),
    body: JSON.stringify({ text: p.prompt, duration_seconds: p.dur, prompt_influence: 0.5, loop: p.loop, model_id: MODELO_SONIDO }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { muestras, rate } = await decodificarMp3(new Uint8Array(await res.arrayBuffer()));
  return remuestrear(muestras, rate, RATE);
}

/** Créditos que le quedan a la cuenta, o null si no se pudo saber (no detiene nada). */
async function creditos(): Promise<number | null> {
  try {
    const res = await fetch(`${ELEVEN_URL}/v1/user/subscription`, { headers: xi(), signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const b = (await res.json()) as { character_limit?: number; character_count?: number };
    return typeof b.character_limit === 'number' ? b.character_limit - (b.character_count ?? 0) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- almacén

async function guardar(nombre: string, audio: Uint8Array): Promise<string> {
  if (STORE_DIR) {
    const file = path.join(STORE_DIR, nombre);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, audio);
    return `file://${file}`;
  }
  const blob = await put(`dramatizado/${nombre}`, Buffer.from(audio), {
    access: 'public',
    contentType: 'audio/mpeg',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 31536000,
    token: BLOB_TOKEN,
  });
  return blob.url;
}

async function bajar(url: string): Promise<Float32Array> {
  const mp3 = url.startsWith('file://') ? new Uint8Array(await readFile(new URL(url))) : new Uint8Array(await (await fetch(url)).arrayBuffer());
  const { muestras, rate } = await decodificarMp3(mp3);
  return remuestrear(muestras, rate, RATE);
}

// ---------------------------------------------------------------- base de datos

type Fase = 'guion' | 'voces' | 'mezcla';
type Row = {
  estado: 'grabando' | 'listo' | 'error';
  fase: Fase;
  hechas: number;
  total: number;
  url: string | null;
  duracion: number | null;
  credito: string | null;
  tiempos: [number, number][] | null;
};

let sql: ReturnType<typeof postgres> | null = null;
let ready: Promise<unknown> | null = null;

async function db() {
  if (!DB_URL) return null;
  sql ??= postgres(DB_URL, { max: 2, idle_timeout: 20, onnotice: () => {} });
  ready ??= sql`
    create table if not exists drama_grabado (
      libro text not null,
      capitulo int not null,
      version text not null,
      estado text not null,
      fase text not null default 'guion',
      hechas int not null default 0,
      total int not null default 0,
      guion text,
      plan jsonb,
      voces jsonb,
      piezas jsonb not null default '{}'::jsonb,
      corregidos jsonb,
      url text,
      duracion real,
      tiempos jsonb,
      credito text,
      pedido_por uuid,
      trabajando timestamptz,
      fallos int not null default 0,
      error text,
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
type Sql = ReturnType<typeof postgres>;

const json = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

type Target = { book: string; chapter: number; version: string; clave: string };

function place(book: unknown, chapter: unknown, pedida: unknown): Target | null {
  if (pedida !== undefined && pedida !== null && (typeof pedida !== 'string' || !/^[a-z0-9]{2,12}$/.test(pedida))) return null;
  const ch = Number(chapter);
  if (typeof book !== 'string' || !/^[0-9a-z]{3}$/.test(book) || !Number.isInteger(ch) || ch < 1 || ch > 150) return null;
  const version = versionPodcast((pedida as string | null | undefined) ?? undefined);
  return { book, chapter: ch, version, clave: conVersion(book, version) };
}

function answer(row: Row | undefined) {
  if (row?.estado === 'listo') return { estado: 'listo', url: row.url, duracion: row.duracion, credito: row.credito, tiempos: row.tiempos ?? [] };
  if (row?.estado === 'grabando') return { estado: 'grabando', fase: row.fase, hechas: row.hechas, total: row.total };
  if (row?.estado === 'error') return { estado: 'error' };
  return { estado: 'ninguno' };
}

async function account(s: Sql, request: Request): Promise<string | null> {
  const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!key) return null;
  const [row] = await s<{ usuario_id: string }[]>`select usuario_id from sesiones where llave_hash = ${hash(key)}`;
  return row?.usuario_id ?? null;
}

// ---------------------------------------------------------------- el texto y el guion

type Version = { id: string; abbr: string; name: string };
type Book = { id: string; name: string; chapters: number };

/** Los versículos del capítulo en la versión: dentro de la función o, si no van en ella, de la web. */
async function versiculos(where: Target, origen: string, cookie: string | null): Promise<[number, string][]> {
  const key = `${where.version}/${where.book}/${where.chapter}`;
  const local = await load<[number, string][] | null>(`text/${key}.json`, null);
  if (local) return local;
  const res = await fetch(new URL(`/data/text/${key}.json`, origen), { headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`No se pudo leer ${key}`);
  return (await res.json()) as [number, string][];
}

async function fichas(): Promise<string> {
  const leer = (f: string) => readFile(path.join(ROOT, 'pipeline', 'audio_dramatizado', f), 'utf8').catch(() => '');
  const [personajes, dios] = await Promise.all([leer('personajes.md'), leer('voz-de-dios.md')]);
  return [personajes, dios].filter(Boolean).join('\n\n---\n\n');
}

const SYSTEM = `Escribes el guion de un capítulo dramatizado de la Biblia para una app gratuita. Lo graban voces de ElevenLabs (eleven_v4): un narrador, los personajes que hablan en el texto y, cuando el texto lo dice, la voz de Dios. Tu libertad es poca: no añades ni quitas palabras de la Biblia.

Reglas del guion dramatizado:
- Cada versículo se dice entero y tal cual está en la versión que recibes: mismas palabras y en el mismo orden. Solo lo repartes entre voces: el narrador dice lo que no es diálogo («Y les dijo:») y cada personaje dice sus propias palabras. Si dudas, déjalo entero al narrador.
- Cuando Dios habla por medio de un profeta o de Jesús, lo dice esa persona (He 1:1-2). Usa DIOS solo cuando el texto dice que la voz viene de Dios mismo (del cielo, la nube, la zarza, el monte, la tormenta, una visión), con uno de estos registros: aprobacion (la voz desde el cielo o la nube sobre el Hijo), llamado (Dios llama a alguien por su nombre o le habla a solas), poder (fuego, monte, tormenta, juicio), gloria (visiones de gloria). Las palabras de Jesús las dice JESUS.
- Los demás personajes se declaran arriba con PERSONAJE, en mayúsculas sin tildes (PEDRO, MARIA, GENTE_1), con su género y edad según la Biblia y los comentarios (las fichas de abajo ayudan). Una multitud o un grupo es un personaje (GENTE_1).
- Indicaciones de voz: entre corchetes, en inglés y cortas, antes del texto, solo cuando ayudan: [slow, solemn], [whispering], [firm, then humble], [crying out]. Jesús sereno, sin sonar teatral. Nada de risas ni ruidos de boca para Dios.
- Escenas: divide el capítulo en 1 a 4 escenas según cambian el lugar o el momento. Cada escena puede llevar un ambiente de fondo en inglés que el texto justifique (dry desert wind, open wilderness; calm lake shore, gentle waves). Sin música ni pájaros si el texto no lo pide.
- Efectos: como mucho 3 en el capítulo, cortos, en inglés y solo si el texto los nombra (a person being immersed in a river, splashing | 3). La cifra son segundos (1 a 6). Nunca un efecto para Dios (no se oye un cuerpo: Dt 4:12).

Formato (una cosa por línea, sin nada más):
PERSONAJE <ID> | <hombre|mujer> | <niño|joven|adulto|mayor> | <nombre>
ESCENA <título corto> | ambiente: <sonido en inglés o ->
EFECTO <sonido en inglés> | <segundos>
<versículo> <VOZ> [indicación]: <texto>
<versículo> DIOS <registro>: <texto>

Ejemplo:
PERSONAJE JUAN | hombre | joven | Juan el Bautista
ESCENA El desierto y el Jordán | ambiente: dry desert wind, open wilderness, no birds
1 NARRADOR [slow, solemn]: Las primeras palabras de las buenas nuevas de Jesucristo, el Hijo de Dios.
3 NARRADOR: Voz del que clama en el desierto:
3 JUAN [proclaiming, loud]: “Preparen el camino del Señor, enderecen sus caminos.”
EFECTO a person being immersed in a river and coming up out of the water, splashing | 3
11 DIOS aprobacion: Tú eres mi Hijo amado; en ti me deleito.

Escribe todos los versículos del capítulo, en orden.`;

async function escribirGuion(where: Target, versos: [number, string][]): Promise<string> {
  const [books, versions] = await Promise.all([load<Book[]>('books.json', []), load<Version[]>('versions.json', [])]);
  const libro = books.find((b) => b.id === where.book)?.name ?? where.book;
  const version = versions.find((v) => v.id === where.version) ?? { abbr: where.version.toUpperCase(), name: where.version };
  const client = new Anthropic({ maxRetries: 1, timeout: 260_000 });
  const fichasTexto = await fichas();
  const message = await client.messages
    .stream({
      model: MODELO_IA,
      max_tokens: 32000,
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM + (fichasTexto ? `\n\nFichas de personajes y de la voz de Dios:\n\n${fichasTexto}` : ''), cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        {
          role: 'user',
          content: `Capítulo: ${libro} ${where.chapter} (${version.name}, ${version.abbr}).\n\n${versos.map(([n, t]) => `${n} ${t}`).join('\n')}`,
        },
      ],
    })
    .finalMessage();
  return message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
}

// ---------------------------------------------------------------- las fases

type Contexto = { origen: string; cookie: string | null };

async function fallo(s: Sql, where: Target, err: unknown) {
  console.error('dramatizado:', where.clave, where.chapter, err);
  await s`update drama_grabado set fallos = fallos + 1, trabajando = null, error = ${String(err).slice(0, 300)},
      estado = case when fallos + 1 >= ${MAX_FALLOS} then 'error' else estado end, actualizado = now()
    where libro = ${where.clave} and capitulo = ${where.chapter}`.catch(() => {});
}

async function faseGuion(s: Sql, where: Target, ctx: Contexto, fallos: number) {
  const versos = await versiculos(where, ctx.origen, ctx.cookie);
  if (!versos.length) throw new Error('Capítulo sin texto');
  // Si la IA falló dos veces, el capítulo se graba igual, leído entero por el narrador con su fondo.
  const guion = fallos >= MAX_FALLOS - 1 ? '' : await escribirGuion(where, versos);
  const { plan, corregidos } = revisarGuion(guion, versos);
  const voces = repartir(plan, await vocesDeCuenta(), `${where.clave}:${where.chapter}`);
  const total = piezasDe(plan, voces).length;
  await s`update drama_grabado set guion = ${guion}, plan = ${s.json(plan)}, voces = ${s.json(voces)},
      corregidos = ${s.json(corregidos)}, fase = 'voces', hechas = 0, total = ${total}, fallos = 0, trabajando = null,
      actualizado = now()
    where libro = ${where.clave} and capitulo = ${where.chapter}`;
}

async function faseVoces(s: Sql, where: Target, plan: Plan, voces: Record<string, string[]>, hechas: Record<string, string>) {
  const inicio = Date.now();
  const faltan = piezasDe(plan, voces).filter((p) => !hechas[p.clave]);
  let next = 0;
  const worker = async () => {
    while (next < faltan.length && Date.now() - inicio < PRESUPUESTO_MS) {
      const p = faltan[next++];
      try {
        const m = p.tipo === 'voz' ? recortar(await grabarVoz(p.inputs)) : await grabarSonido(p);
        const url = await guardar(`piezas/${p.clave}.mp3`, await codificarMp3(muestrasA16(m), RATE, 96));
        await s`update drama_grabado set piezas = piezas || ${s.json({ [p.clave]: url })}, hechas = hechas + 1,
            trabajando = now(), actualizado = now()
          where libro = ${where.clave} and capitulo = ${where.chapter}`;
      } catch (err) {
        // Un sonido que no sale no detiene el capítulo: se mezcla sin él. Una voz sí hace falta.
        if (p.tipo === 'sonido') {
          console.error('dramatizado: sonido', p.prompt, err);
          await s`update drama_grabado set piezas = piezas || ${s.json({ [p.clave]: '' })}, hechas = hechas + 1
            where libro = ${where.clave} and capitulo = ${where.chapter}`;
        } else throw err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALELO, faltan.length) }, worker));
  // Si se acabó el tiempo antes de grabarlas todas, queda en «voces» y la siguiente llamada sigue con las que faltan.
  const [row] = await s<{ piezas: Record<string, string> }[]>`select piezas from drama_grabado
    where libro = ${where.clave} and capitulo = ${where.chapter}`;
  const completas = piezasDe(plan, voces).every((p) => row?.piezas[p.clave] !== undefined);
  await s`update drama_grabado set fase = ${completas ? 'mezcla' : 'voces'}, trabajando = null, fallos = 0, actualizado = now()
    where libro = ${where.clave} and capitulo = ${where.chapter}`;
}

/** El fondo de pads propios de la app (el mismo de la música de ambiente al estudiar). */
async function fondo(): Promise<Float32Array | null> {
  try {
    const mp3 = new Uint8Array(await readFile(path.join(ROOT, 'public', 'audio', 'ambiente', process.env.DRAMA_FONDO ?? 'quietud.mp3')));
    const { muestras, rate } = await decodificarMp3(mp3);
    return remuestrear(muestras, rate, RATE);
  } catch (err) {
    console.error('dramatizado: fondo', err);
    return null;
  }
}

/** Arma el capítulo: voces en orden con sus pausas, la voz de Dios con eco y capa, ambientes, efectos y el fondo. */
export async function mezclar(plan: Plan, voces: Record<string, string[]>, piezas: Record<string, string>, pad: Float32Array | null) {
  const cache = new Map<string, Promise<Float32Array | null>>();
  const audio = (p: Pieza) => {
    let a = cache.get(p.clave);
    if (!a) {
      const url = piezas[p.clave];
      a = url ? bajar(url) : Promise.resolve(null);
      cache.set(p.clave, a);
    }
    return a;
  };
  type Clip = { at: number; m: Float32Array; gain: number };
  const clips: Clip[] = [];
  const tiempos: [number, number][] = [];
  let t = Math.round(ENTRADA_S * RATE);
  const escenas: Escena[] = plan.escenas;
  for (const e of escenas) {
    const desde = t;
    for (const paso of e.pasos) {
      if ('efecto' in paso) {
        const m = await audio(sonidoPieza(paso.efecto, paso.dur, false));
        if (m) {
          clips.push({ at: Math.max(0, t - Math.round(0.15 * RATE)), m: aRms(m), gain: lineal(EFECTO_DB) });
          t += Math.max(0, m.length - Math.round(0.3 * RATE));
        }
        continue;
      }
      tiempos.push([paso.v, Math.round((t / RATE) * 100) / 100]);
      for (const parte of partesDe(paso.lineas, voces)) {
        const tomas = (await Promise.all(parte.pieza.map(audio))).filter((m): m is Float32Array => !!m);
        if (!tomas.length) continue;
        let m = aVolumen(tomas.length > 1 ? juntar(tomas) : tomas[0]);
        if (parte.registro) {
          const r = REGISTRO[parte.registro];
          m = eco(m, r.eco);
          const capa = await audio(sonidoPieza(r.capa, 6, false));
          if (capa) clips.push({ at: Math.max(0, t - Math.round(0.5 * RATE)), m: cama(aRms(capa), m.length + RATE, 0.6), gain: lineal(r.capaDb) });
        }
        clips.push({ at: t, m, gain: 1 });
        t += m.length + Math.round(0.12 * RATE);
      }
      t += Math.round(GAP * RATE);
    }
    if (e.ambiente) {
      const amb = await audio(sonidoPieza(e.ambiente, 12, true));
      if (amb) {
        const at = Math.max(0, desde - Math.round(0.5 * RATE));
        clips.push({ at, m: cama(aRms(amb), t - at + Math.round(1.5 * RATE)), gain: lineal(AMBIENTE_DB) });
      }
    }
    t += Math.round(ENTRE_ESCENAS * RATE);
  }
  const total = t + Math.round(1.5 * RATE);
  const out = new Float32Array(total);
  if (pad) sumar(out, cama(aRms(pad), total, 6), 0, lineal(FONDO_DB));
  for (const c of clips) sumar(out, c.m, c.at, c.gain);
  // Un techo suave: si algo pasa de −1 dBFS, baja todo un poco (los picos vienen de sumar sonidos).
  let pico = 0;
  for (const x of out) pico = Math.max(pico, Math.abs(x));
  if (pico > 0.89) for (let i = 0; i < out.length; i++) out[i] *= 0.89 / pico;
  return { muestras: out, tiempos, duracion: total / RATE };
}

async function faseMezcla(s: Sql, where: Target, plan: Plan, voces: Record<string, string[]>, piezas: Record<string, string>) {
  const { muestras, tiempos, duracion } = await mezclar(plan, voces, piezas, await fondo());
  const mp3 = await codificarMp3(muestrasA16(muestras), RATE, KBPS);
  const tag = hash(JSON.stringify(plan)).slice(0, 10);
  const url = await guardar(`${where.clave.replace(':', '-')}-${where.chapter}-${tag}.mp3`, mp3);
  await s`update drama_grabado set estado = 'listo', url = ${url}, tiempos = ${s.json(tiempos)}, duracion = ${Math.round(duracion)},
      credito = ${CREDITO(where.version)}, trabajando = null, fallos = 0, error = null, actualizado = now()
    where libro = ${where.clave} and capitulo = ${where.chapter}`;
}

/**
 * Toma la fase pendiente de una grabación (si nadie la está trabajando), la hace y pide la siguiente. Devuelve
 * cuando termina esa fase.
 */
export async function avanzar(s: Sql, where: Target, ctx: Contexto): Promise<void> {
  const [row] = await s<{ fase: Fase; plan: Plan | null; voces: Record<string, string[]> | null; piezas: Record<string, string>; fallos: number }[]>`
    update drama_grabado set trabajando = now()
    where libro = ${where.clave} and capitulo = ${where.chapter} and estado = 'grabando'
      and (trabajando is null or trabajando < now() - make_interval(mins => ${TRABAJO_MIN}))
    returning fase, plan, voces, piezas, fallos`;
  if (!row) return;
  try {
    if (row.fase === 'guion' || !row.plan || !row.voces) await faseGuion(s, where, ctx, row.fallos);
    else if (row.fase === 'voces') await faseVoces(s, where, row.plan, row.voces, row.piezas);
    else await faseMezcla(s, where, row.plan, row.voces, row.piezas);
  } catch (err) {
    await fallo(s, where, err);
  }
  const [after] = await s<{ estado: string }[]>`select estado from drama_grabado where libro = ${where.clave} and capitulo = ${where.chapter}`;
  if (after?.estado === 'grabando') await seguir(where, ctx);
}

/** Pide la siguiente fase en otra llamada a la función (la de ahora ya gastó su tiempo). */
async function seguir(where: Target, ctx: Contexto) {
  if (process.env.DRAMA_SIN_SEGUIR) return;
  const url = new URL('/api/dramatizado', ctx.origen);
  url.searchParams.set('book', where.book);
  url.searchParams.set('chapter', String(where.chapter));
  if (where.version !== 'rv1909') url.searchParams.set('version', where.version);
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  await fetch(url, {
    headers: { ...(ctx.cookie ? { cookie: ctx.cookie } : {}), ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {});
}

const contexto = (request: Request): Contexto => ({ origen: new URL(request.url).origin, cookie: request.headers.get('cookie') });

// ---------------------------------------------------------------- la función

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const where = place(params.get('book') ?? undefined, params.get('chapter') ?? undefined, params.get('version'));
  if (!where) return json({ error: 'Pedido no válido' }, 400);
  const s = await db().catch(() => null);
  if (!s) return json({ estado: 'ninguno' });
  const [row] = await s<(Row & { libre: boolean })[]>`select estado, fase, hechas, total, url, duracion, credito, tiempos,
      (trabajando is null or trabajando < now() - make_interval(mins => ${TRABAJO_MIN})) as libre
    from drama_grabado where libro = ${where.clave} and capitulo = ${where.chapter}`;
  // Una fase sin nadie que la trabaje (la llamada anterior se cortó o terminó): esta la retoma.
  if (row?.estado === 'grabando' && row.libre && process.env.ELEVENLABS_API_KEY) waitUntil(avanzar(s, where, contexto(request)));
  return json(answer(row));
}

export async function POST(request: Request) {
  const s = await db().catch((err) => {
    console.error('dramatizado: base de datos', err);
    return null;
  });
  if (!s) return json({ error: 'Falta conectar la base de datos en el servidor.' }, 503);
  const user = await account(s, request);
  if (!user) return json({ error: 'Necesitas una cuenta', cuenta: true }, 401);
  let body: { book?: unknown; chapter?: unknown; version?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Pedido no válido' }, 400);
  }
  const where = place(body.book, body.chapter, body.version);
  if (!where) return json({ error: 'Pedido no válido' }, 400);

  const [current] = await s<Row[]>`select estado, fase, hechas, total, url, duracion, credito, tiempos
    from drama_grabado where libro = ${where.clave} and capitulo = ${where.chapter}`;
  if (current && current.estado !== 'error') return json(answer(current));
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ANTHROPIC_API_KEY || (!STORE_DIR && !BLOB_TOKEN)) {
    return json({ error: 'El audio dramatizado todavía no está activado en el servidor.' }, 503);
  }

  const [{ mias, todas, correo }] = await s<{ mias: number; todas: number; correo: string | null }[]>`select
      count(*) filter (where pedido_por = ${user})::int as mias, count(*)::int as todas,
      (select correo from usuarios where id = ${user}) as correo
    from drama_grabado where creado > now() - interval '1 day'`;
  const cuida = esCuidador(correo);
  if (!cuida && mias >= PER_ACCOUNT) {
    return json({ error: PER_ACCOUNT === 1 ? 'Puedes dramatizar un capítulo al día. Vuelve mañana.' : `Puedes dramatizar hasta ${PER_ACCOUNT} capítulos al día. Vuelve mañana.` }, 429);
  }
  if (!cuida && todas >= PER_DAY) return json({ error: 'Por hoy ya se dramatizaron todos los capítulos que permite la app. Vuelve mañana.' }, 429);

  // Antes de gastar: que en ElevenLabs quede lo que pide el capítulo y el margen para el pódcast.
  const versos = await versiculos(where, new URL(request.url).origin, request.headers.get('cookie')).catch(() => null);
  if (!versos?.length) return json({ error: 'No se encontró el texto de este capítulo.' }, 404);
  const quedan = await creditos();
  const necesita = Math.round(versos.reduce((n, [, t]) => n + t.length, 0) * 1.25) + CREDITOS_SONIDOS;
  if (quedan !== null && quedan < necesita + RESERVA) {
    return json({ error: 'Por ahora no quedan voces para dramatizar más capítulos. Vuelve en unos días.' }, 429);
  }

  const [mine] = await s`insert into drama_grabado (libro, capitulo, version, estado, fase, pedido_por, trabajando)
    values (${where.clave}, ${where.chapter}, ${where.version}, 'grabando', 'guion', ${user}, null)
    on conflict (libro, capitulo) do update
      set estado = 'grabando', fase = 'guion', hechas = 0, total = 0, fallos = 0, error = null, trabajando = null,
        pedido_por = excluded.pedido_por, creado = now(), actualizado = now()
      where drama_grabado.estado = 'error'
    returning 1`;
  if (!mine) {
    const [row] = await s<Row[]>`select estado, fase, hechas, total, url, duracion, credito, tiempos
      from drama_grabado where libro = ${where.clave} and capitulo = ${where.chapter}`;
    return json(answer(row));
  }
  waitUntil(avanzar(s, where, contexto(request)));
  return json({ estado: 'grabando', fase: 'guion', hechas: 0, total: 0 });
}
