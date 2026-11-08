// Audio dramatizado de un capítulo a pedido, como el pódcast grabado: la primera persona que lo pide lo prepara y
// desde ahí queda listo para todos los que leen esa versión.
//   GET  ?book=mrk&chapter=2[&version=bes] → {estado: 'listo', url, duracion, credito, tiempos} |
//        {estado: 'grabando', fase, hechas, total} | {estado: 'ninguno'} | {estado: 'error'}
//   POST {book, chapter, version}          → lo empieza (necesita cuenta) y responde como GET.
//
// Se hace en tres fases, cada una en su propia llamada a la función (Vercel corta a los 300 s):
//   1. guion: la IA escribe una hoja de dirección por escena y reparte el texto del capítulo entre el narrador y los
//      personajes, con indicaciones de voz, ritmo, pausas, el lugar (espacio), tres capas de sonido y el tono de la
//      música (src/lib/dramaGuion.ts). Para ambientarlo recibe el trasfondo del capítulo (comentarios, diccionario
//      Tyndale, fichas, momento histórico, lugares, objetos y medidas), como el estudio y el pódcast. Cada versículo
//      tiene que decir el texto exacto de la versión; el que no, lo lee el narrador tal cual.
//   2. voces: cada escena se graba en tomas de corrido con Text to Dialogue (eleven_v4), con la estabilidad de cada
//      papel y el texto vecino para que las tomas se unan sin saltos; cada sonido, con Sound Effects. Cada pieza se
//      guarda en Vercel Blob por su contenido: si la función se corta, la siguiente sigue donde quedó.
//   3. mezcla (en estéreo): cada personaje en su lugar de la escena y con el eco del sitio, el narrador cerca y en el
//      centro; la voz de Dios con su eco y su capa; el ambiente, los sonidos y los efectos; las cortinas de música del
//      tono del capítulo (public/audio/cortinas) y el fondo de pads, que se apartan cuando alguien habla. Todo queda a
//      un volumen parejo (cerca de −16 LUFS). Se suben dos MP3: la mezcla y «solo voces».
// Los personajes que vuelven (Pedro, Moisés, María…) conservan su voz en toda la Biblia (tabla drama_voz).
// Cada fase termina pidiéndose a sí misma la siguiente (un GET); y cada GET de la app, mientras espera, retoma una
// fase que quedó parada. Nadie más puede tomar una fase mientras otra llamada la trabaja (columna «trabajando»).
//
// Versiones: una grabación por versión libre (como el pódcast). Quien lee una versión con derechos escucha la
// libre de src/lib/podcastVersion.ts: su texto no se puede pasar a la IA ni convertir en audio.
// Costo: un capítulo medio son unos 4.000 caracteres de voces (con las indicaciones) más unos 3.000 créditos de sonidos
// (las cortinas de música ya están hechas y no cuestan nada al grabar). Hay un límite por
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
  type Espacio,
  type Genero,
  type Linea,
  type Plan,
  type Registro,
  type Ritmo,
  DIOS,
  JESUS,
  NARRADOR,
  revisarGuion,
  sinTags,
} from '../src/lib/dramaGuion';
import { OBJETIVO_DB, gananciasLimite, muestrasA16, nivelar, pcmAMuestras, tramosPorSilencio, volumenHabla } from '../src/lib/nivelarVoces';
import { conVersion, versionPodcast } from '../src/lib/podcastVersion';
import { diccionarioDelPasaje } from './_detalle';
import { type Book as LibroCompleto, Biblia, commentaryBlocks, fichasDe, load, RV1909 } from './_investigar';
import { codificarMp3, codificarMp3Estereo, decodificarMp3, decodificarMp3Estereo } from './_mp3';
import { mudas, reemplazar } from './podcast-grabado';
import { esCuidador } from './_senales';
import { waitUntil } from './_seguir';

const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const ELEVEN_URL = process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io';
const MODELO_VOZ = process.env.DRAMA_MODELO_VOZ ?? 'eleven_v4';
const MODELO_SONIDO = process.env.DRAMA_MODELO_SONIDO ?? 'eleven_text_to_sound_v3';
/** El modelo de sonidos de antes (se retira el 2027-03-01): si el nuevo no responde, se usa este. */
const MODELO_SONIDO_RESERVA = 'eleven_text_to_sound_v2';
const MODELO_IA = process.env.DRAMA_MODELO ?? 'claude-opus-5-5';
const PER_ACCOUNT = Number(process.env.DRAMA_LIMITE_CUENTA ?? 1);
const PER_DAY = Number(process.env.DRAMA_LIMITE_DIA ?? 3);
/** Créditos de ElevenLabs que se dejan siempre libres (para el pódcast y las grabaciones a mano). */
const RESERVA = Number(process.env.DRAMA_RESERVA ?? 10000);
/** Créditos aproximados de los ambientes, sonidos y efectos de un capítulo. */
const CREDITOS_SONIDOS = 3000;
const RATE = 24000;
/** La mezcla y «solo voces», en estéreo. */
const KBPS = 112;
const KBPS_VOCES = 80;
/** Una llamada deja de grabar piezas pasado este tiempo y pide a otra que siga (Vercel corta a los 300 s). */
const PRESUPUESTO_MS = Number(process.env.DRAMA_PRESUPUESTO_MS ?? 200_000);
/** Si una fase lleva más que esto «trabajando», la llamada se cortó y otra la puede retomar. */
const TRABAJO_MIN = 5;
/** Después de tantos fallos seguidos, la grabación queda en error y se puede volver a pedir. */
const MAX_FALLOS = 3;
const PARALELO = 4;
/** Una toma de corrido llega hasta aquí (ElevenLabs pide no pasar de 2.000 caracteres por pedido). */
const TOMA_MAX = 1500;
const TOMA_ENTRADAS = 24;
/** Estabilidad de ElevenLabs por papel: más baja, más emoción; el narrador, natural; Dios, firme. */
const est = (v: string | undefined, d: number) => Math.min(1, Math.max(0, Number(v ?? d) || d));
const EST_NARRADOR = est(process.env.DRAMA_ESTABILIDAD_NARRADOR, 0.5);
const EST_ESCENA = est(process.env.DRAMA_ESTABILIDAD_ESCENA, 0.35);
const EST_DIOS = est(process.env.DRAMA_ESTABILIDAD_DIOS, 0.6);
/** Pausas según el ritmo de la escena: entre tomas y entre escenas (sin cortina de música). */
const PAUSA_TOMA: Record<Ritmo, number> = { lento: 0.65, normal: 0.4, vivo: 0.25 };
const PAUSA_ESCENA: Record<Ritmo, number> = { lento: 2.2, normal: 1.7, vivo: 1.2 };
const AMBIENTE_S = 20;
const AMBIENTE_DB = -24;
const SONIDO_DB = -17;
const EFECTO_DB = -10;
const FONDO_DB = -28;
const MUSICA_DB = -9;
/** Cuánto se apartan el fondo y la música cuando alguien habla. */
const APARTA_FONDO_DB = -4;
const APARTA_MUSICA_DB = -11;
const MASTER_DB = -16;
const ENTRADA_S = 2.5;
/** Hasta cuántos versículos la IA escribe el guion con esfuerzo «medium». */
const ESFUERZO_HASTA = Number(process.env.DRAMA_ESFUERZO_HASTA ?? 30);
/** Lugar de cada personaje en la escena, de izquierda (−1) a derecha (1), por orden de aparición. */
const LUGARES = [-0.32, 0.32, -0.18, 0.18, -0.45, 0.45, -0.08, 0.08];
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

/** Clave de la voz de un personaje en toda la Biblia: el mismo personaje a la misma edad suena igual. */
const vozFija = (p: { id: string; edad: string }) => `${p.id}|${p.edad}`;
/** Los papeles de un grupo o sin nombre (GENTE_1, SOLDADO, CRIADO…) cambian de voz en cada capítulo. */
const GENERICO =
  /^(GENTE|MULTITUD|PUEBLO|TODOS|VOZ|VOCES|UNO|OTRO|OTROS|ALGUNOS|SOLDADO|GUARDIA|CRIAD|SIERV|ESCLAV|DISCIPULO|FARISEO|SADUCEO|SACERDOTE|ESCRIBA|ANCIANO|HOMBRE|MUJER|NINO|NINA|JOVEN|MUCHACH|MENSAJERO|ANGEL|DEMONIO|ESPIRITU|ENDEMONIADO|CIEGO|LEPROSO|PARALITICO|CENTURION|PROFETA|REY|REINA|PRINCIPE|JUDIO|SAMARITAN|MAESTRO|VIUDA|PADRE|MADRE|HIJO|HIJA|HERMAN|ESPOSA|ESPOSO|PASTOR|PESCADOR|LADRON|MALHECHOR|TESTIGO|PORTERA|PORTERO|SIRVIENTA)/;
export const persistente = (id: string) => !/_\d+$/.test(id) && !GENERICO.test(id);

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
export function repartir(plan: Plan, disponibles: Voz[], semilla: string, fijas: Record<string, string> = {}): Record<string, string[]> {
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
  // Primero los que ya tienen voz de otros capítulos (si esa voz sigue en el reparto y es de su género).
  for (const p of plan.personajes) {
    const fija = pool.find((v) => v.id === fijas[vozFija(p)] && v.genero === p.genero);
    if (fija && !usos.has(fija.id)) {
      usos.set(fija.id, 1);
      voces[p.id] = [fija.id];
    }
  }
  for (const p of plan.personajes) voces[p.id] ??= [tomar(p.genero, p.edad, new Set())];
  const habla = new Set(plan.escenas.flatMap((e) => e.pasos.flatMap((p) => ('v' in p ? p.lineas.map((l) => l.voz) : []))));
  if (habla.has(DIOS)) {
    const evitar = new Set(Object.values(voces).flat());
    // Coro de tres edades para la voz desde el cielo; las otras formas usan la primera.
    voces[DIOS] = (['mayor', 'adulto', 'joven'] as const).map((edad) => tomar('hombre', edad, evitar));
  }
  return voces;
}

// ---------------------------------------------------------------- piezas

type Entrada = { text: string; voice_id: string };
/**
 * Lo que se graba: una toma de voces seguidas o un sonido. Su clave es el hash de lo que se le pide a ElevenLabs. Una
 * toma lleva la estabilidad de su papel (más baja, más emoción) y el texto de antes y de después (100 caracteres), para
 * que se una sin saltos con sus vecinas.
 */
export type Pieza =
  | { tipo: 'voz'; clave: string; inputs: Entrada[]; estabilidad: number; previo?: string; sigue?: string }
  | { tipo: 'sonido'; clave: string; prompt: string; dur: number; loop: boolean };
type PiezaVoz = Extract<Pieza, { tipo: 'voz' }>;
type PiezaSonido = Extract<Pieza, { tipo: 'sonido' }>;

const texto = (l: Linea) => {
  const tag = l.tag ?? (l.registro ? REGISTRO[l.registro].tag : '');
  return `${tag} ${l.texto}`.trim();
};

const estabilidad = (roles: string[]) =>
  roles.includes(DIOS) ? EST_DIOS : roles.every((r) => r === NARRADOR) ? EST_NARRADOR : EST_ESCENA;

function vozPieza(inputs: Entrada[], roles: string[], previo?: string, sigue?: string): PiezaVoz {
  const est = estabilidad(roles);
  const pv = previo ? previo.slice(-100) : undefined;
  const sg = sigue ? sigue.slice(0, 100) : undefined;
  return {
    tipo: 'voz',
    clave: hash(JSON.stringify(['voz', MODELO_VOZ, inputs, est, pv ?? '', sg ?? ''])).slice(0, 24),
    inputs,
    estabilidad: est,
    ...(pv ? { previo: pv } : {}),
    ...(sg ? { sigue: sg } : {}),
  };
}
function sonidoPieza(prompt: string, dur: number, loop: boolean): PiezaSonido {
  return { tipo: 'sonido', clave: hash(JSON.stringify(['sonido', MODELO_SONIDO, prompt, dur, loop])).slice(0, 24), prompt, dur, loop };
}

/** Lo que suena en una escena, en orden. */
export type Bloque =
  /** Una toma de corrido: varias líneas (y versículos) seguidas; `versos` y `roles` dicen de quién es cada entrada. */
  | { tipo: 'toma'; pieza: PiezaVoz; versos: number[]; roles: string[]; sonidos: { pieza: PiezaSonido; en: number }[] }
  | { tipo: 'dios'; piezas: PiezaVoz[]; registro: Registro; v: number }
  | { tipo: 'efecto'; pieza: PiezaSonido }
  | { tipo: 'pausa'; s: number };

/**
 * Una escena en tomas de corrido: las líneas seguidas del narrador y los personajes van en un solo pedido de diálogo
 * (hasta TOMA_MAX caracteres), así el ritmo y la emoción pasan de un versículo al siguiente. La voz de Dios, los
 * efectos y las pausas cortan la toma. Los SONIDO no la cortan: suenan debajo de la entrada que sigue.
 */
export function bloquesDe(escena: Escena, voces: Record<string, string[]>): Bloque[] {
  type Abierta = { inputs: Entrada[]; versos: number[]; roles: string[]; sonidos: { pieza: PiezaSonido; en: number }[] };
  const crudos: (Abierta | Exclude<Bloque, { tipo: 'toma' }>)[] = [];
  let cur: Abierta | null = null;
  let pendientes: PiezaSonido[] = [];
  const cerrar = () => {
    if (cur?.inputs.length) crudos.push(cur);
    cur = null;
  };
  const largo = (a: Abierta) => a.inputs.reduce((n, x) => n + x.text.length, 0);
  for (const paso of escena.pasos) {
    if ('efecto' in paso) {
      cerrar();
      crudos.push({ tipo: 'efecto', pieza: sonidoPieza(paso.efecto, paso.dur, false) });
    } else if ('sonido' in paso) {
      pendientes.push(sonidoPieza(paso.sonido, paso.dur, false));
    } else if ('pausa' in paso) {
      cerrar();
      crudos.push({ tipo: 'pausa', s: paso.pausa });
    } else {
      for (const l of paso.lineas) {
        const ids = voces[l.voz] ?? voces[NARRADOR];
        if (l.voz === DIOS) {
          cerrar();
          const coro = l.registro === 'aprobacion' ? ids : ids.slice(0, 1);
          crudos.push({ tipo: 'dios', piezas: coro.map((id) => vozPieza([{ text: texto(l), voice_id: id }], [DIOS])), registro: l.registro ?? 'llamado', v: paso.v });
          continue;
        }
        const entrada = { text: texto(l), voice_id: ids[0] };
        const otraVoz = cur && !cur.inputs.some((x) => x.voice_id === entrada.voice_id);
        const distintas = cur ? new Set(cur.inputs.map((x) => x.voice_id)).size : 0;
        if (cur && (largo(cur) + entrada.text.length > TOMA_MAX || cur.inputs.length >= TOMA_ENTRADAS || (otraVoz && distintas >= 9))) cerrar();
        cur ??= { inputs: [], versos: [], roles: [], sonidos: [] };
        for (const pieza of pendientes) cur.sonidos.push({ pieza, en: cur.inputs.length });
        pendientes = [];
        cur.inputs.push(entrada);
        cur.versos.push(paso.v);
        cur.roles.push(l.voz);
      }
    }
  }
  cerrar();
  // Lo que se dice justo antes y justo después de cada toma, para que ElevenLabs la una con sus vecinas.
  const dicho = (b: (typeof crudos)[number]) =>
    'inputs' in b ? sinTags(b.inputs.map((x) => x.text).join(' ')) : b.tipo === 'dios' ? sinTags(b.piezas[0].inputs[0].text) : '';
  return crudos.map((b, k) => {
    if (!('inputs' in b)) return b;
    const antes = crudos[k - 1] && dicho(crudos[k - 1]);
    const despues = crudos[k + 1] && dicho(crudos[k + 1]);
    return { tipo: 'toma', pieza: vozPieza(b.inputs, b.roles, antes || undefined, despues || undefined), versos: b.versos, roles: b.roles, sonidos: b.sonidos };
  });
}

/** Todas las piezas del plan, sin repetir. */
export function piezasDe(plan: Plan, voces: Record<string, string[]>): Pieza[] {
  const todas = new Map<string, Pieza>();
  const add = (p: Pieza) => todas.set(p.clave, p);
  for (const e of plan.escenas) {
    if (e.ambiente) add(sonidoPieza(e.ambiente, AMBIENTE_S, true));
    for (const b of bloquesDe(e, voces)) {
      if (b.tipo === 'toma') {
        add(b.pieza);
        b.sonidos.forEach((x) => add(x.pieza));
      } else if (b.tipo === 'dios') {
        b.piezas.forEach(add);
        add(sonidoPieza(REGISTRO[b.registro].capa, 6, false));
      } else if (b.tipo === 'efecto') add(b.pieza);
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

/** Sin los silencios de los bordes (ElevenLabs deja un poco antes y después). `desde`: dónde empieza lo que queda. */
function recortar(m: Float32Array): { m: Float32Array; desde: number } {
  const tramos = tramosPorSilencio(m, RATE);
  if (!tramos.length) return { m, desde: 0 };
  const desde = Math.max(0, tramos[0].desde - Math.round(0.03 * RATE));
  return { m: m.subarray(desde, Math.min(m.length, tramos.at(-1)!.hasta + Math.round(0.08 * RATE))), desde };
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

/** El mismo sonido empezado por la mitad: en el otro canal suena distinto y el fondo se abre a los lados. */
const girar = (m: Float32Array) => {
  const k = m.length >> 1;
  const out = new Float32Array(m.length);
  out.set(m.subarray(k), 0);
  out.set(m.subarray(0, k), m.length - k);
  return out;
};

/** RMS de todo el sonido llevado a −20 dBFS (los sonidos de ElevenLabs llegan a volúmenes muy distintos). */
function aRms(m: Float32Array, db = -20): Float32Array {
  let s = 0;
  for (const x of m) s += x * x;
  const rms = Math.sqrt(s / Math.max(1, m.length));
  if (rms < 1e-5) return m;
  const g = lineal(db) / rms;
  return m.map((x) => x * g);
}

/** Paneo de potencia constante: −1 izquierda, 0 centro (igual que mono), 1 derecha. */
const paneo = (p: number): [number, number] => {
  const a = ((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4;
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
};

/** El eco del lugar de cada escena (un reverb sencillo de peines y pasa-todos, distinto en cada canal). */
const SALA: Record<Espacio | 'cielo', { tam: number; decae: number; envio: number; antes: number }> = {
  abierto: { tam: 0.55, decae: 0.45, envio: 0.07, antes: 0.004 },
  interior: { tam: 0.75, decae: 0.68, envio: 0.13, antes: 0.008 },
  grande: { tam: 1.25, decae: 0.84, envio: 0.22, antes: 0.018 },
  cueva: { tam: 1.0, decae: 0.86, envio: 0.27, antes: 0.012 },
  cielo: { tam: 1.4, decae: 0.86, envio: 0.18, antes: 0.025 },
};
const PEINES = [1116, 1188, 1277, 1356];
const PASATODOS = [556, 441];

/** Lo que el lugar le añade a una voz (solo el eco, en estéreo), con su cola. */
export function reverbe(m: Float32Array, espacio: keyof typeof SALA): { l: Float32Array; r: Float32Array } {
  const sala = SALA[espacio];
  const escala = (RATE / 44100) * sala.tam;
  const largoPeine = Math.round(Math.max(...PEINES) * escala);
  const cola = Math.min(Math.round(3 * RATE), Math.round((largoPeine * Math.log(0.001)) / Math.log(sala.decae)));
  const antes = Math.round(sala.antes * RATE);
  const n = m.length + cola + antes;
  const canal = (spread: number) => {
    const out = new Float32Array(n);
    for (const base of PEINES) {
      const d = Math.max(1, Math.round((base + spread) * escala));
      const buf = new Float32Array(d);
      let k = 0;
      let filtro = 0;
      for (let i = 0; i < n; i++) {
        const x = i >= antes && i - antes < m.length ? m[i - antes] : 0;
        const y = buf[k];
        filtro = y * 0.7 + filtro * 0.3; // un poco de amortiguación: los agudos se apagan antes
        buf[k] = x + filtro * sala.decae;
        out[i] += y;
        k = (k + 1) % d;
      }
    }
    for (const base of PASATODOS) {
      const d = Math.max(1, Math.round((base + spread) * escala));
      const buf = new Float32Array(d);
      let k = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[k];
        const x = out[i];
        buf[k] = x + b * 0.5;
        out[i] = b - x;
        k = (k + 1) % d;
      }
    }
    const g = sala.envio / PEINES.length;
    for (let i = 0; i < n; i++) out[i] *= g;
    return out;
  };
  return { l: canal(0), r: canal(23) };
}

function sumar(dst: Float32Array, src: Float32Array, at: number, gain = 1) {
  for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * gain;
}

/** Suma con una ganancia que cambia en el tiempo (el fondo que se aparta cuando alguien habla). */
function sumarCon(dst: Float32Array, src: Float32Array, at: number, gain: number, curva: Float32Array) {
  for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * gain * curva[at + i];
}

/**
 * Cuánto se aparta el fondo en cada muestra: 1 en silencio y `lineal(db)` mientras suena una voz, con una bajada
 * rápida y una subida lenta para que no «respire» entre palabras.
 */
export function apartar(vozL: Float32Array, vozR: Float32Array, db: number): Float32Array {
  const n = vozL.length;
  const out = new Float32Array(n);
  const ventana = Math.round(0.02 * RATE);
  const umbral = lineal(-42);
  const baja = 1 - Math.exp(-1 / (0.12 * RATE));
  const sube = 1 - Math.exp(-1 / (0.7 * RATE));
  const minimo = lineal(db);
  let e = 0;
  for (let i = 0; i < n; i += ventana) {
    let s = 0;
    const fin = Math.min(n, i + ventana);
    for (let k = i; k < fin; k++) s += vozL[k] * vozL[k] + vozR[k] * vozR[k];
    const hay = Math.sqrt(s / (2 * Math.max(1, fin - i))) > umbral ? 1 : 0;
    for (let k = i; k < fin; k++) {
      e += (hay - e) * (hay > e ? baja : sube);
      out[k] = 1 - e * (1 - minimo);
    }
  }
  return out;
}

/** Lleva los dos canales a un volumen de habla parejo (cerca de −16 LUFS) y les pone un techo de −1 dBFS. */
export function masterizar(l: Float32Array, r: Float32Array, objetivo = MASTER_DB) {
  const mono = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) mono[i] = (l[i] + r[i]) / 2;
  const v = volumenHabla(mono, RATE, { desde: 0, hasta: mono.length });
  const g = v === null ? 1 : lineal(Math.max(-12, Math.min(12, objetivo - v)));
  const pico = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) {
    l[i] *= g;
    r[i] *= g;
    pico[i] = Math.max(Math.abs(l[i]), Math.abs(r[i]));
  }
  const lim = gananciasLimite(pico, Math.max(1, Math.round(0.005 * RATE)), 0.89);
  for (let i = 0; i < l.length; i++) {
    l[i] *= lim[i];
    r[i] *= lim[i];
  }
}

// ---------------------------------------------------------------- ElevenLabs

const xi = () => ({ 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '', 'Content-Type': 'application/json' });

type Segmento = { start_time_seconds: number; end_time_seconds: number; dialogue_input_index: number };
type Toma = { muestras: Float32Array; segmentos: Segmento[] };

/** Si ElevenLabs rechaza la estabilidad o la continuidad (no todos los modelos las aceptan), se graba sin ellas. */
let sinExtras = false;

async function grabarVoz(p: Pick<PiezaVoz, 'inputs' | 'estabilidad' | 'previo' | 'sigue'>): Promise<Toma> {
  const pedir = (extras: boolean) =>
    fetch(`${ELEVEN_URL}/v1/text-to-dialogue/with-timestamps?output_format=pcm_${RATE}`, {
      method: 'POST',
      headers: xi(),
      body: JSON.stringify({
        inputs: p.inputs,
        model_id: MODELO_VOZ,
        language_code: 'es',
        seed: 7,
        ...(extras
          ? { settings: { stability: p.estabilidad }, ...(p.previo ? { previous_text: p.previo } : {}), ...(p.sigue ? { future_text: p.sigue } : {}) }
          : {}),
      }),
    });
  let res = await pedir(!sinExtras);
  if (!res.ok && !sinExtras && (res.status === 400 || res.status === 422)) {
    const error = await res.text();
    if (!/settings|stability|previous_text|future_text/i.test(error)) throw new Error(`ElevenLabs ${res.status}: ${error.slice(0, 300)}`);
    console.error('dramatizado: ElevenLabs no acepta los ajustes de la toma; sigue sin ellos', error.slice(0, 200));
    sinExtras = true;
    res = await pedir(false);
  }
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { audio_base64: string; voice_segments?: Segmento[] };
  return { muestras: pcmAMuestras(Buffer.from(body.audio_base64, 'base64')), segmentos: body.voice_segments ?? [] };
}

/** Dónde empieza cada entrada: lo que dice ElevenLabs o, si no lo dice, repartido por la longitud de cada texto. */
function inicios(toma: Toma, textos: string[]): number[] {
  const porIndice = new Map<number, Segmento>();
  for (const s of toma.segmentos) if (!porIndice.has(s.dialogue_input_index)) porIndice.set(s.dialogue_input_index, s);
  if (textos.every((_, k) => porIndice.has(k))) return textos.map((_, k) => porIndice.get(k)!.start_time_seconds);
  const tramos = tramosPorSilencio(toma.muestras, RATE);
  const desde = (tramos[0]?.desde ?? 0) / RATE;
  const hasta = (tramos.at(-1)?.hasta ?? toma.muestras.length) / RATE;
  const total = textos.reduce((n, t) => n + Math.max(1, t.length), 0);
  let acc = 0;
  return textos.map((t) => {
    const at = desde + ((hasta - desde) * acc) / total;
    acc += Math.max(1, t.length);
    return at;
  });
}

/**
 * Graba una toma entera. Si alguna entrada llega muda o cortada (le pasa a ElevenLabs, casi siempre a la última), se
 * graba sola y se pone en su lugar. Cada entrada se lleva al mismo volumen de habla, y se guardan los inicios.
 */
async function grabarToma(p: PiezaVoz): Promise<{ muestras: Float32Array; inicios: number[] }> {
  let toma = await grabarVoz(p);
  const textos = p.inputs.map((x) => sinTags(x.text));
  if (toma.segmentos.length) {
    for (const k of mudas(toma, p.inputs.length, RATE, textos).slice(0, 3)) {
      try {
        const sola = await grabarVoz({ inputs: [p.inputs[k]], estabilidad: p.estabilidad });
        toma = reemplazar(toma, k, recortar(sola.muestras).m, RATE);
      } catch (err) {
        console.error('dramatizado: regrabar entrada', k, err);
      }
    }
  }
  const at = inicios(toma, textos);
  const tramos = at.map((a, k) => ({ desde: Math.round(a * RATE), hasta: Math.round((at[k + 1] ?? toma.muestras.length / RATE) * RATE) }));
  const nivelada = nivelar(toma.muestras, RATE, tramos);
  const { m, desde } = recortar(nivelada);
  return { muestras: m, inicios: at.map((a) => Math.max(0, Math.round((a - desde / RATE) * 100) / 100)) };
}

/** Si el modelo nuevo de sonidos no está (o se retiró), se piden con el anterior. */
let modeloSonido = MODELO_SONIDO;

async function grabarSonido(p: PiezaSonido): Promise<Float32Array> {
  const pedir = (model_id: string) =>
    fetch(`${ELEVEN_URL}/v1/sound-generation?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: xi(),
      body: JSON.stringify({ text: p.prompt, duration_seconds: p.dur, prompt_influence: 0.5, loop: p.loop, model_id }),
    });
  let res = await pedir(modeloSonido);
  if (!res.ok && modeloSonido !== MODELO_SONIDO_RESERVA && (res.status === 400 || res.status === 404 || res.status === 422)) {
    console.error('dramatizado: modelo de sonidos', modeloSonido, res.status, (await res.text()).slice(0, 200));
    modeloSonido = MODELO_SONIDO_RESERVA;
    res = await pedir(modeloSonido);
  }
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
  url_voces: string | null;
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
    )`
    .then(() => sql!`alter table drama_grabado add column if not exists url_voces text`)
    .then(
      () => sql!`create table if not exists drama_voz (
        personaje text not null,
        edad text not null,
        genero text not null,
        voz text not null,
        creado timestamptz not null default now(),
        primary key (personaje, edad)
      )`,
    )
    .catch((err) => {
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
  if (row?.estado === 'listo') {
    return {
      estado: 'listo',
      url: row.url,
      duracion: row.duracion,
      credito: row.credito,
      tiempos: row.tiempos ?? [],
      ...(row.url_voces ? { soloVoces: row.url_voces } : {}),
    };
  }
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

/** Palabras de cada fuente del trasfondo: lo justo para ambientar, sin pasarse del tiempo de la función. */
const TRASFONDO = { comentarios: 1400, fichas: 90 };

type Lugar = { kind: string; title: string; caption: string; verses: number[] };
type ContextoCap = { medidas?: { name: string; kind: string; value: string; note: string; verses: number[] }[]; imagenes?: Lugar[] };

/**
 * Lo que la app sabe del capítulo para ambientarlo, como en el estudio profundo y el pódcast: comentarios, el
 * diccionario Tyndale, las fichas de personas y lugares con el momento histórico, y los lugares, objetos y medidas.
 * Cada fuente que falta o falla se deja fuera: el guion se escribe igual con el texto.
 */
export async function trasfondo(where: Target, ctx: { origen: string; cookie: string | null }): Promise<string> {
  const books = await load<LibroCompleto[]>('books.json', []);
  const book = books.find((b) => b.id === where.book);
  if (!book) return '';
  const request = new Request(new URL('/api/dramatizado', ctx.origen), { headers: ctx.cookie ? { cookie: ctx.cookie } : {} });
  const biblia = new Biblia(request, RV1909, books);
  const plano = (t: string) => t.replace(/\s+/g, ' ').trim();
  const seccion = (titulo: string, lineas: string[]) => (lineas.length ? `## ${titulo}\n${lineas.map((l) => `- ${plano(l)}`).join('\n')}` : '');
  const nada = (err: unknown) => {
    console.error('dramatizado: trasfondo', where.book, where.chapter, err);
    return null;
  };
  const [comentarios, diccionario, fichas, contexto] = await Promise.all([
    commentaryBlocks(request, book, where.chapter, undefined, books, TRASFONDO.comentarios).catch(nada),
    diccionarioDelPasaje(biblia, book, where.chapter).catch(nada),
    fichasDe(biblia, { book, chapter: where.chapter }, '', 6, TRASFONDO.fichas).catch(nada),
    load<ContextoCap | null>(`contexto/${book.id}/${where.chapter}.json`, null).catch(nada),
  ]);
  const partes = [
    seccion('Comentarios (costumbres, escena, quiénes son)', (comentarios ?? []).flatMap((c) => c.blocks.map((b) => `[${b.meta.label}] ${b.text}`))),
    // Sin el índice de los artículos largos («Sumário», «• Contexto», «## Contexto»): solo el texto.
    seccion(
      'Diccionario bíblico Tyndale',
      (diccionario?.blocks ?? []).filter((b) => !/^(•|#)|: Sum[áa]rio$/.test(b.text.trim())).map((b) => `[${b.meta.label}] ${b.text}`),
    ),
    seccion('Personas, lugares y momento histórico (fichas de la app; descripciones en inglés)', (fichas ?? []).flatMap((f) => f.blocks.map((b) => `[${b.meta.label}] ${b.text}`))),
    seccion('Lugares, objetos y medidas del capítulo', [
      ...(contexto?.imagenes ?? []).map((i) => `${i.title} (${i.kind}, v. ${i.verses.join(', ')}): ${i.caption}`),
      ...(contexto?.medidas ?? []).map((m) => `${m.name} (v. ${m.verses.join(', ')}): ${m.value}. ${m.note}`),
    ]),
  ].filter(Boolean);
  return partes.join('\n\n');
}

async function fichas(): Promise<string> {
  const leer = (f: string) => readFile(path.join(ROOT, 'pipeline', 'audio_dramatizado', f), 'utf8').catch(() => '');
  const [personajes, dios] = await Promise.all([leer('personajes.md'), leer('voz-de-dios.md')]);
  return [personajes, dios].filter(Boolean).join('\n\n---\n\n');
}

const SYSTEM = `Escribes el guion de un capítulo dramatizado de la Biblia para una app gratuita. Lo graban voces de ElevenLabs (eleven_v4): un narrador, los personajes que hablan en el texto y, cuando el texto lo dice, la voz de Dios. Tu libertad es poca: no añades ni quitas palabras de la Biblia. Tu arte está en la dirección: quién dice qué, con qué ánimo, con qué ritmo, en qué lugar y con qué sonidos.

Reglas del texto:
- Cada versículo se dice entero y tal cual está en la versión que recibes: mismas palabras y en el mismo orden. Solo lo repartes entre voces: el narrador dice lo que no es diálogo («Y les dijo:») y cada personaje dice sus propias palabras. Si dudas, déjalo entero al narrador.
- Cuando Dios habla por medio de un profeta o de Jesús, lo dice esa persona (He 1:1-2). Usa DIOS solo cuando el texto dice que la voz viene de Dios mismo (del cielo, la nube, la zarza, el monte, la tormenta, una visión), con uno de estos registros: aprobacion (la voz desde el cielo o la nube sobre el Hijo), llamado (Dios llama a alguien por su nombre o le habla a solas), poder (fuego, monte, tormenta, juicio), gloria (visiones de gloria). Las palabras de Jesús las dice JESUS.

Personajes:
- Se declaran arriba con PERSONAJE, en mayúsculas sin tildes, con su género y la edad que tienen en ese momento según la Biblia y los comentarios (las fichas de abajo ayudan).
- Un personaje con nombre que aparece en otros libros lleva siempre el mismo ID, para que suene con la misma voz en toda la Biblia: PEDRO, JUAN_APOSTOL, JUAN_BAUTISTA, SANTIAGO_ZEBEDEO, MARIA_MADRE, MARIA_MAGDALENA, MARTA, LAZARO, PABLO, MOISES, AARON, DAVID, ELIAS, ABRAHAM, SARA… (el nombre más conocido, sin títulos). Un grupo o alguien sin nombre lleva número: GENTE_1, SOLDADO_1, CRIADA_1, FARISEO_1.

Hoja de dirección:
- Divide el capítulo en 1 a 4 escenas según cambian el lugar o el momento. Cada ESCENA lleva:
  - ambiente: el sonido de fondo del lugar, en inglés, concreto y tranquilo, que el texto o el trasfondo justifiquen (murmuring crowd in a stone temple courtyard, distant sheep; calm lake shore at dawn, gentle waves, fishing boats creaking). Sin música; pájaros solo al aire libre de día; «-» si no hace falta.
  - espacio: abierto (campo, camino, mar, desierto), interior (una casa, una barca techada), grande (templo, sinagoga, palacio, salón) o cueva (cueva, sepulcro, cárcel, cisterna). Da el eco del lugar.
  - ritmo: lento (solemne, duelo, revelación, oración), normal o vivo (discusión, prisa, persecución, milagro en medio de la gente).
- Debajo de cada ESCENA, una línea DIRECCION en español: qué está en juego, el ánimo de cada uno y cómo cuenta el narrador. Piénsala antes de escribir las líneas de esa escena y escríbelas según ella.
- El narrador cuenta como un buen narrador de historias: cálido y cercano, sin leer; baja la voz en lo íntimo, da peso a lo grande y deja que lo importante respire.
- TONO del capítulo (una vez, arriba): paz, esperanza, tension, duelo o gloria. Elige la música de entrada, de paso entre escenas y de cierre.

Indicaciones de voz (en inglés, entre corchetes):
- Una al empezar la línea cuando ayuda, con el ánimo y la manera de decirlo: [slow, solemn], [whispers], [warm, tender], [urgent, breathless], [low, steady voice], [crying out], [trembling], [firm, then gentle], [amazed].
- Dentro del texto, como mucho dos por línea, para un cambio a mitad de frase o para respirar: [short pause], [long pause], [sighs], [inhales deeply], [voice breaking]. Van entre palabras, sin tocar las palabras.
- Solo lo que se oye en la voz. Nada de gestos ni movimientos ([smiling], [nods], [walks away], [looks up]): no se oyen y se quitan. Pocas: una línea sin indicación también está bien.
- Jesús sereno, con autoridad tranquila, sin sonar teatral: nada de risas, gritos ni sollozos para él (cuando el texto dice que clamó a gran voz, [loud, clear voice]). Dios no lleva indicaciones: su registro ya dice cómo suena.
- Una interrupción (alguien corta a otro) se marca terminando la línea cortada con «-».

Ritmo y sonido:
- PAUSA <segundos> (0,5 a 4) entre versículos, para un silencio que importa: después de una revelación, antes de una respuesta difícil, al cambiar de momento dentro de la escena. Como mucho 8 en el capítulo.
- Tres capas de sonido: el ambiente de la escena (siempre de fondo); SONIDO <en inglés> | <segundos>: detalles que suenan debajo de la voz siguiente sin pararla (oars in water, a crowd gasping, sandals on stone; hasta 6 en el capítulo, de 1 a 8 segundos); y EFECTO <en inglés> | <segundos>: un golpe dramático para lo que el texto nombra, la narración espera a que suene (a stone rolled away, a storm wind hitting the boat; hasta 3, de 1 a 6 segundos). Con el detalle que da el trasfondo. Nunca un sonido o efecto para Dios (no se oye un cuerpo: Dt 4:12).
- Trasfondo: junto al capítulo recibes lo que dicen los comentarios, el diccionario, las fichas de personas y lugares, el momento histórico y los objetos y medidas. Úsalo para ambientar: dónde y cuándo ocurre cada escena (hora, clima, campo, ciudad, templo, mar), cómo suena ese lugar, qué edad y oficio tiene cada personaje y con qué ánimo habla. Nunca para añadir palabras al texto ni hechos que el trasfondo no diga; si las fuentes no coinciden, elige lo más sobrio.

Formato (una cosa por línea, sin nada más):
TONO <paz|esperanza|tension|duelo|gloria>
PERSONAJE <ID> | <hombre|mujer> | <niño|joven|adulto|mayor> | <nombre>
ESCENA <título corto> | ambiente: <sonido en inglés o -> | espacio: <abierto|interior|grande|cueva> | ritmo: <lento|normal|vivo>
DIRECCION <la hoja de dirección de la escena>
SONIDO <sonido en inglés> | <segundos>
EFECTO <sonido en inglés> | <segundos>
PAUSA <segundos>
<versículo> <VOZ> [indicación]: <texto, con hasta dos [indicaciones] dentro>
<versículo> DIOS <registro>: <texto>

Ejemplo:
TONO esperanza
PERSONAJE JUAN_BAUTISTA | hombre | joven | Juan el Bautista
ESCENA El desierto y el Jordán | ambiente: dry desert wind, open wilderness, no birds | espacio: abierto | ritmo: lento
DIRECCION Juan clama con fuerza ante la multitud que bajó al río; el narrador abre la historia con asombro contenido, despacio.
1 NARRADOR [slow, warm]: Las primeras palabras de las buenas nuevas de Jesucristo, el Hijo de Dios.
3 NARRADOR: Voz del que clama en el desierto:
SONIDO a large crowd murmuring by a river | 5
3 JUAN_BAUTISTA [proclaiming, loud]: “Preparen el camino del Señor, [short pause] enderecen sus caminos.”
EFECTO a person being immersed in a river and coming up out of the water, splashing | 3
PAUSA 1.5
11 DIOS aprobacion: Tú eres mi Hijo amado; en ti me deleito.

Escribe todos los versículos del capítulo, en orden.`;

async function escribirGuion(where: Target, versos: [number, string][], fondoTexto: string): Promise<string> {
  const [books, versions] = await Promise.all([load<Book[]>('books.json', []), load<Version[]>('versions.json', [])]);
  const libro = books.find((b) => b.id === where.book)?.name ?? where.book;
  const version = versions.find((v) => v.id === where.version) ?? { abbr: where.version.toUpperCase(), name: where.version };
  const client = new Anthropic({ maxRetries: 1, timeout: 260_000 });
  const fichasTexto = await fichas();
  const message = await client.messages
    .stream({
      model: MODELO_IA,
      max_tokens: 32000,
      // Un capítulo corto se piensa más (la hoja de dirección); uno largo, con menos, para no pasarse del tiempo.
      output_config: { effort: versos.length <= ESFUERZO_HASTA ? 'medium' : 'low' },
      system: [
        { type: 'text', text: SYSTEM + (fichasTexto ? `\n\nFichas de personajes y de la voz de Dios:\n\n${fichasTexto}` : ''), cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        {
          role: 'user',
          content:
            (fondoTexto ? `Trasfondo de ${libro} ${where.chapter} para ambientarlo (no se lee en voz alta):\n\n${fondoTexto}\n\n---\n\n` : '') +
            `Capítulo: ${libro} ${where.chapter} (${version.name}, ${version.abbr}).\n\n${versos.map(([n, t]) => `${n} ${t}`).join('\n')}`,
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
  const guion = fallos >= MAX_FALLOS - 1 ? '' : await escribirGuion(where, versos, await trasfondo(where, ctx).catch(() => ''));
  const { plan, corregidos } = revisarGuion(guion, versos);
  const fijas = Object.fromEntries(
    (await s<{ personaje: string; edad: string; voz: string }[]>`select personaje, edad, voz from drama_voz
      where personaje in ${s(plan.personajes.map((p) => p.id).concat(['-']))}`).map((r) => [vozFija({ id: r.personaje, edad: r.edad }), r.voz]),
  );
  const voces = repartir(plan, await vocesDeCuenta(), `${where.clave}:${where.chapter}`, fijas);
  // Los personajes con nombre guardan su voz para los capítulos que vengan.
  const nuevos = plan.personajes.filter((p) => persistente(p.id) && !fijas[vozFija(p)] && voces[p.id]?.[0]);
  for (const p of nuevos) {
    await s`insert into drama_voz (personaje, edad, genero, voz) values (${p.id}, ${p.edad}, ${p.genero}, ${voces[p.id][0]})
      on conflict do nothing`;
  }
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
        // De una toma se guardan también dónde empieza cada entrada (clave#t), para los tiempos y el lugar de cada voz.
        const extra: Record<string, string> = {};
        let m: Float32Array;
        if (p.tipo === 'voz') {
          const toma = await grabarToma(p);
          m = toma.muestras;
          extra[`${p.clave}#t`] = JSON.stringify(toma.inicios);
        } else m = await grabarSonido(p);
        const url = await guardar(`piezas/${p.clave}.mp3`, await codificarMp3(muestrasA16(m), RATE, 96));
        await s`update drama_grabado set piezas = piezas || ${s.json({ [p.clave]: url, ...extra })}, hechas = hechas + 1,
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

type Estereo = { l: Float32Array; r: Float32Array };

async function leerEstereo(file: string): Promise<Estereo | null> {
  try {
    const { l, r, rate } = await decodificarMp3Estereo(new Uint8Array(await readFile(file)));
    return { l: remuestrear(l, rate, RATE), r: remuestrear(r, rate, RATE) };
  } catch {
    return null;
  }
}

/** El fondo de pads propios de la app (el mismo de la música de ambiente al estudiar). */
async function fondo(): Promise<Estereo | null> {
  const pad = await leerEstereo(path.join(ROOT, 'public', 'audio', 'ambiente', process.env.DRAMA_FONDO ?? 'quietud.mp3'));
  if (!pad) console.error('dramatizado: sin fondo');
  return pad;
}

/** Las cortinas de música de un tono: la entrada, el paso entre escenas y el cierre. Las que falten no suenan. */
export type Cortinas = { entrada: Estereo | null; paso: Estereo | null; cierre: Estereo | null };
async function cortinas(tono: string | undefined): Promise<Cortinas> {
  const dir = process.env.DRAMA_CORTINAS_DIR ?? path.join(ROOT, 'public', 'audio', 'cortinas');
  const t = tono ?? 'paz';
  const [entrada, paso, cierre] = await Promise.all(['entrada', 'paso', 'cierre'].map((k) => leerEstereo(path.join(dir, `${t}-${k}.mp3`))));
  return { entrada, paso, cierre };
}
const SIN_CORTINAS: Cortinas = { entrada: null, paso: null, cierre: null };

/**
 * Arma el capítulo en estéreo: las tomas en orden con las pausas de su ritmo, cada personaje en su lugar y con el eco
 * del sitio, la voz de Dios con eco y capa, ambientes, sonidos, efectos, cortinas y el fondo. Devuelve también solo
 * las voces (para «Solo voces»), en los mismos tiempos.
 */
export async function mezclar(
  plan: Plan,
  voces: Record<string, string[]>,
  piezas: Record<string, string>,
  pad: Estereo | null,
  musica: Cortinas = SIN_CORTINAS,
) {
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
  type Voz = { at: number; m: Float32Array; pan: number; sala?: keyof typeof SALA };
  type Clip = { at: number; m: Float32Array | Estereo; gain: number; bus: 'fondo' | 'musica' | 'efectos' };
  const vozClips: Voz[] = [];
  const clips: Clip[] = [];
  const tiempos: [number, number][] = [];
  const dichos = new Set<number>();
  const marcar = (v: number, at: number) => {
    if (dichos.has(v)) return;
    dichos.add(v);
    tiempos.push([v, Math.round((at / RATE) * 100) / 100]);
  };
  const lugar = new Map(plan.personajes.map((p, i) => [p.id, LUGARES[i % LUGARES.length]]));
  const s = (seg: number) => Math.round(seg * RATE);

  const entrada = musica.entrada;
  if (entrada) clips.push({ at: 0, m: entrada, gain: lineal(MUSICA_DB), bus: 'musica' });
  let t = s(Math.max(ENTRADA_S, entrada ? entrada.l.length / RATE - 1.5 : 0));
  for (const [ie, e] of plan.escenas.entries()) {
    const ritmo = e.ritmo ?? 'normal';
    const sala: Espacio = e.espacio ?? 'abierto';
    const desde = t;
    for (const b of bloquesDe(e, voces)) {
      if (b.tipo === 'pausa') {
        t += s(b.s);
      } else if (b.tipo === 'efecto') {
        const m = await audio(b.pieza);
        if (m) {
          clips.push({ at: Math.max(0, t - s(0.15)), m: aRms(m), gain: lineal(EFECTO_DB), bus: 'efectos' });
          t += Math.max(0, m.length - s(0.3));
        }
      } else if (b.tipo === 'dios') {
        const tomas = (await Promise.all(b.piezas.map(audio))).filter((m): m is Float32Array => !!m);
        if (!tomas.length) continue;
        const r = REGISTRO[b.registro];
        const m = eco(aVolumen(tomas.length > 1 ? juntar(tomas) : tomas[0]), r.eco);
        const capa = await audio(sonidoPieza(r.capa, 6, false));
        if (capa) clips.push({ at: Math.max(0, t - s(0.5)), m: cama(aRms(capa), m.length + RATE, 0.6), gain: lineal(r.capaDb), bus: 'efectos' });
        marcar(b.v, t);
        vozClips.push({ at: t, m, pan: 0, sala: 'cielo' });
        t += m.length + s(PAUSA_TOMA[ritmo]);
      } else {
        const m = await audio(b.pieza);
        if (!m) continue;
        const guardados = piezas[`${b.pieza.clave}#t`];
        const at: number[] = guardados ? JSON.parse(guardados) : b.roles.map((_, k) => (k * m.length) / RATE / b.roles.length);
        // Cada entrada en su lugar: el narrador cerca y al centro; los personajes, a los lados y con el eco del sitio.
        b.roles.forEach((rol, k) => {
          const de = Math.min(m.length, s(at[k] ?? 0));
          const hasta = k + 1 < b.roles.length ? Math.min(m.length, s(at[k + 1] ?? 0)) : m.length;
          if (hasta > de) {
            vozClips.push({ at: t + de, m: m.subarray(de, hasta), pan: rol === NARRADOR || rol === JESUS ? 0 : (lugar.get(rol) ?? 0), ...(rol === NARRADOR ? {} : { sala }) });
          }
          marcar(b.versos[k], t + de);
        });
        for (const x of b.sonidos) {
          const sm = await audio(x.pieza);
          if (sm) clips.push({ at: t + s(at[x.en] ?? 0) - s(0.3), m: aRms(sm), gain: lineal(SONIDO_DB), bus: 'efectos' });
        }
        t += m.length + s(PAUSA_TOMA[ritmo]);
      }
    }
    if (e.ambiente) {
      const amb = await audio(sonidoPieza(e.ambiente, AMBIENTE_S, true));
      if (amb) {
        const at = Math.max(0, desde - s(0.8));
        const largo = t - at + s(1.5);
        const base = aRms(amb);
        clips.push({ at, m: { l: cama(base, largo), r: cama(girar(base), largo) }, gain: lineal(AMBIENTE_DB), bus: 'fondo' });
      }
    }
    const ultima = ie === plan.escenas.length - 1;
    if (!ultima && musica.paso) {
      clips.push({ at: t, m: musica.paso, gain: lineal(MUSICA_DB), bus: 'musica' });
      t += Math.max(s(PAUSA_ESCENA[ritmo]), musica.paso.l.length - s(0.8));
    } else if (!ultima) t += s(PAUSA_ESCENA[ritmo]);
  }
  if (musica.cierre) {
    clips.push({ at: t, m: musica.cierre, gain: lineal(MUSICA_DB), bus: 'musica' });
    t += musica.cierre.l.length;
  }
  const total = t + s(1.5);

  // Primero las voces (con su lugar y su eco): de ellas sale cuándo se apartan el fondo y la música.
  const vozL = new Float32Array(total);
  const vozR = new Float32Array(total);
  for (const c of vozClips) {
    const [gl, gr] = paneo(c.pan);
    sumar(vozL, c.m, c.at, gl);
    sumar(vozR, c.m, c.at, gr);
    if (c.sala) {
      const wet = reverbe(c.m, c.sala);
      // El eco sale del mismo lado que la voz, pero se abre un poco hacia el otro.
      sumar(vozL, wet.l, c.at, (gl + 1) / 2);
      sumar(vozR, wet.r, c.at, (gr + 1) / 2);
    }
  }
  const apartaFondo = apartar(vozL, vozR, APARTA_FONDO_DB);
  const apartaMusica = apartar(vozL, vozR, APARTA_MUSICA_DB);
  const l = Float32Array.from(vozL);
  const r = Float32Array.from(vozR);
  if (pad) {
    const base = { l: cama(aRms(pad.l), total, 6), r: cama(aRms(pad.r), total, 6) };
    sumarCon(l, base.l, 0, lineal(FONDO_DB), apartaFondo);
    sumarCon(r, base.r, 0, lineal(FONDO_DB), apartaFondo);
  }
  for (const c of clips) {
    const st = c.m instanceof Float32Array ? { l: c.m, r: c.m } : c.m;
    if (c.bus === 'efectos') {
      sumar(l, st.l, c.at, c.gain);
      sumar(r, st.r, c.at, c.gain);
    } else {
      const curva = c.bus === 'musica' ? apartaMusica : apartaFondo;
      sumarCon(l, st.l, c.at, c.gain, curva);
      sumarCon(r, st.r, c.at, c.gain, curva);
    }
  }
  masterizar(l, r);
  masterizar(vozL, vozR);
  return { l, r, vozL, vozR, tiempos, duracion: total / RATE };
}

async function faseMezcla(s: Sql, where: Target, plan: Plan, voces: Record<string, string[]>, piezas: Record<string, string>) {
  const [pad, musica] = await Promise.all([fondo(), cortinas(plan.tono)]);
  const { l, r, vozL, vozR, tiempos, duracion } = await mezclar(plan, voces, piezas, pad, musica);
  const mp3 = await codificarMp3Estereo(muestrasA16(l), muestrasA16(r), RATE, KBPS);
  const soloVoces = await codificarMp3Estereo(muestrasA16(vozL), muestrasA16(vozR), RATE, KBPS_VOCES);
  const tag = hash(JSON.stringify(plan)).slice(0, 10);
  const base = `${where.clave.replace(':', '-')}-${where.chapter}-${tag}`;
  const [url, urlVoces] = await Promise.all([guardar(`${base}.mp3`, mp3), guardar(`${base}-voces.mp3`, soloVoces)]);
  await s`update drama_grabado set estado = 'listo', url = ${url}, url_voces = ${urlVoces}, tiempos = ${s.json(tiempos)},
      duracion = ${Math.round(duracion)}, credito = ${CREDITO(where.version)}, trabajando = null, fallos = 0, error = null,
      actualizado = now()
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
  const [row] = await s<(Row & { libre: boolean })[]>`select estado, fase, hechas, total, url, duracion, credito, tiempos, url_voces,
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

  const [current] = await s<Row[]>`select estado, fase, hechas, total, url, duracion, credito, tiempos, url_voces
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
  // El texto, sus indicaciones y lo que se vuelve a grabar de vez en cuando (una entrada muda).
  const necesita = Math.round(versos.reduce((n, [, t]) => n + t.length, 0) * 1.4) + CREDITOS_SONIDOS;
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
    const [row] = await s<Row[]>`select estado, fase, hechas, total, url, duracion, credito, tiempos, url_voces
      from drama_grabado where libro = ${where.clave} and capitulo = ${where.chapter}`;
    return json(answer(row));
  }
  waitUntil(avanzar(s, where, contexto(request)));
  return json({ estado: 'grabando', fase: 'guion', hechas: 0, total: 0 });
}
