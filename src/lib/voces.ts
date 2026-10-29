import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { useEffect, useState, useSyncExternalStore } from 'react';

// Las voces del dispositivo en español, de la más natural a la más robótica. No cuestan nada: hablan el navegador
// o el teléfono, sin servidor de voz. Lo que más cambia el sonido es qué voz se usa: Edge trae voces neuronales
// («Online (Natural)»), Safari las «Mejorada»/«Premium», Chrome las de Google y Android las «network» de su motor de
// voz. La elegida para el despertador se guarda en el dispositivo (no en la cuenta: cada teléfono tiene sus voces).

export type Calidad = 'natural' | 'buena' | 'basica';
/** Si la voz suena a mujer o a hombre; sin dato cuando ni el nombre ni el código lo dicen. */
export type Genero = 'mujer' | 'hombre';

export type Voz = {
  id: string;
  /** El nombre corto para mostrar: «Dalia», «Google», «Paulina». */
  nombre: string;
  /** «México», «Colombia», «España»… */
  acento: string;
  calidad: Calidad;
  genero?: Genero;
  puntos: number;
  /** Android tiene la misma voz en dos copias: la «local» suena sin internet; la de red suele sonar mejor. */
  sinInternet?: boolean;
};

type Bruta = Pick<Speech.Voice, 'identifier' | 'name' | 'language' | 'quality'> & { localService?: boolean };

const PAISES: Record<string, string> = {
  co: 'Colombia',
  mx: 'México',
  us: 'Estados Unidos',
  '419': 'Latinoamérica',
  ar: 'Argentina',
  cl: 'Chile',
  pe: 'Perú',
  ve: 'Venezuela',
  ec: 'Ecuador',
  uy: 'Uruguay',
  py: 'Paraguay',
  bo: 'Bolivia',
  cr: 'Costa Rica',
  pa: 'Panamá',
  gt: 'Guatemala',
  hn: 'Honduras',
  ni: 'Nicaragua',
  sv: 'El Salvador',
  do: 'República Dominicana',
  pr: 'Puerto Rico',
  cu: 'Cuba',
  es: 'España',
};

// Las voces «de juguete» de Apple y los motores viejos suenan a robot aunque sean de buena calidad técnica.
const ROBOTICAS = /espeak|compact|desktop|eddy|flo\b|grandma|grandpa|abuel|reed|rocko|sandy|shelley|bad news|bells|bubbles|jester|organ|trinoids|whisper|zarvox|albert|bahh|boing|cellos|wobble|superstar/i;

/** Cuánto suena a persona. Más es mejor; es una suma de señales del nombre, del motor y del acento. */
export function puntos(v: Bruta): number {
  const n = `${v.name} ${v.identifier}`;
  let p = 0;
  if (/natural|neural|online/i.test(n)) p += 60;
  if (/premium/i.test(n)) p += 55;
  else if (/enhanced|mejorada|siri/i.test(n) || v.quality === Speech.VoiceQuality.Enhanced) p += 42;
  if (/network/i.test(v.identifier)) p += 38;
  if (/google/i.test(n)) p += 30;
  if (v.localService === false) p += 12;
  if (ROBOTICAS.test(n)) p -= 60;
  if (/-local\b|x-.*-local/i.test(v.identifier)) p -= 4;
  // A igual calidad, acentos de aquí: Colombia, luego el resto de Latinoamérica, y España al final
  const pais = region(v.language);
  if (pais === 'co') p += 8;
  else if (pais && pais !== 'es') p += 5;
  return p;
}

const region = (lang: string) => lang.toLowerCase().split(/[-_]/)[1] ?? '';

export function calidad(p: number): Calidad {
  return p >= 38 ? 'natural' : p >= 20 ? 'buena' : 'basica';
}

/** «Microsoft Dalia Online (Natural) - Spanish (Mexico)» → «Dalia»; «Google español de Estados Unidos» → «Google». */
export function nombreCorto(name: string): string {
  const limpio = name
    .replace(/\(.*$/, ' ')
    .replace(/\s+-\s+.*$/, ' ')
    .replace(/\b(microsoft|apple|online|natural|neural|enhanced|premium|mejorada|compact|desktop)\b/gi, ' ')
    .replace(/\b(español|espanol|spanish)\b.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^google/i.test(name)) return 'Google';
  // «Android Speech Recognition and Synthesis from Google es-us-x-esd-network» (Firefox en Android): solo código
  if (/\b[a-z]{2}[-_][a-z0-9]{2,3}[-_]x[-_]/i.test(name)) return '';
  // Android nombra sus voces con códigos («es-us-x-esf-network»): se les da nombre al listar (ordenar)
  if (!limpio || /^[a-z]{2}[-_]/i.test(limpio)) return '';
  return limpio;
}

// Android (y algunos navegadores) nombran sus voces con códigos («es-us-x-esf-network») o solo con «Google». Para
// poder decir «me gusta Esteban» se les da un nombre propio, siempre el mismo para el mismo código en cualquier
// teléfono, de mujer o de hombre según cómo suena la voz. Si no se sabe, «Voz 1», «Voz 2»: un nombre de persona que no
// coincide con la voz confunde (una «Guadalupe» que habla con voz de hombre). No se usan Ana ni Tomás, los del pódcast.
const NOMBRES: Record<Genero, string[]> = {
  mujer: ['Sara', 'Rut', 'Lidia', 'Débora', 'Ester', 'Miriam', 'Marta', 'Priscila', 'Noemí', 'Raquel', 'Abigail', 'Elisa'],
  hombre: ['Pablo', 'Pedro', 'Andrés', 'Felipe', 'Esteban', 'Samuel', 'Daniel', 'Gabriel', 'Timoteo', 'Lucas', 'Mateo', 'Simón'],
};

// Las voces de Google en Android (y en Chrome de Android y ChromeOS, que las nombran «Google español 3 (Natural)»).
// Fuente: readium/speech, json/es.json.
const CODIGOS: Record<string, Genero> = {
  'es-es-eea': 'mujer',
  'es-es-eec': 'mujer',
  'es-es-eee': 'mujer',
  'es-es-eed': 'hombre',
  'es-es-eef': 'hombre',
  'es-us-esc': 'mujer',
  'es-us-sfb': 'mujer',
  'es-us-esd': 'hombre',
  'es-us-esf': 'hombre',
};
const GOOGLE_NUMERADA: Record<string, Genero> = {
  'español 1': 'mujer',
  'español 2': 'mujer',
  'español 4': 'mujer',
  'español 3': 'hombre',
  'español 5': 'hombre',
  'español de estados unidos 1': 'mujer',
  'español de estados unidos 2': 'mujer',
  'español de estados unidos 3': 'hombre',
  'español de estados unidos 4': 'hombre',
};

// Nombres de las voces de Apple, Microsoft (Edge y Windows) y otras. «male» no se busca suelto: está dentro de «female».
const MUJER =
  /\b(paulina|m[oó]nica|marisol|ang[eé]lica|isabela|francisca|soledad|jimena|ximena|helena|laura|sabina|elvira|dalia|salom[eé]|paloma|elena|sof[ií]a|catalina|mar[ií]a|belkys|andrea|lorena|marta|teresa|karla|yolanda|margarita|tania|camila|karina|ramona|valentina|paola|beatriz|candela|carlota|larissa|marina|nuria|renata|abril|estrella|irene|laia|l[ií]a|triana|vera|luc[ií]a|esperanza|female|woman|mujer|femenin[ao])\b/i;
const HOMBRE =
  /\b(jorge|juan|diego|carlos|pablo|ra[uú]l|[aá]lvaro|tom[aá]s|marcelo|lorenzo|gonzalo|manuel|luis|rodrigo|alonso|andr[eé]s|javier|federico|roberto|mario|alex|v[ií]ctor|emilio|mateo|sebasti[aá]n|cecilio|gerardo|liberto|luciano|pelayo|yago|arnau|dar[ií]o|el[ií]as|nil|sa[uú]l|teo|enrique|jos[eé]|male|man|hombre|masculin[ao])\b/i;

/** Mujer u hombre, por el código de Android, la voz de Google o el nombre; sin dato si no se puede saber. */
export function generoDeVoz(name: string, identifier: string): Genero | undefined {
  const porCodigo = CODIGOS[codigoVoz(identifier)] ?? CODIGOS[codigoVoz(name)];
  if (porCodigo) return porCodigo;
  const google = name.match(/^google\s+(.*?)\s*(?:\(.*)?$/i)?.[1]?.toLowerCase();
  if (google !== undefined) {
    // En Chrome de escritorio «Google español» es de hombre y «Google español de Estados Unidos», de mujer
    if (google === 'español') return 'hombre';
    if (google === 'español de estados unidos') return 'mujer';
    return GOOGLE_NUMERADA[google];
  }
  const texto = `${name} ${identifier}`;
  const m = MUJER.test(texto);
  const h = HOMBRE.test(texto);
  return m === h ? undefined : m ? 'mujer' : 'hombre';
}

/** La parte que distingue una voz de otra: «es-us-x-esf-network» → «es-us-esf» (la local y la de red son la misma). */
export const codigoVoz = (id: string) => {
  const m = id.toLowerCase().match(/\b([a-z]{2})[-_]([a-z0-9]{2,3})[-_]x[-_]([a-z0-9]+)/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : id.toLowerCase();
};

const semilla = (texto: string) => [...texto].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Un nombre para cada código sin repetir en este dispositivo, de mujer o de hombre según la voz; el mismo código
 * siempre pide primero el mismo. Las voces que no se sabe cómo suenan quedan «Voz 1», «Voz 2»…
 */
export function nombresParaCodigos(codigos: string[], generos: Map<string, Genero | undefined> = new Map()): Map<string, string> {
  const out = new Map<string, string>();
  const usados = new Set<string>();
  let sinGenero = 0;
  for (const c of [...new Set(codigos)].sort()) {
    const genero = generos.get(c);
    if (!genero) {
      out.set(c, `Voz ${++sinGenero}`);
      continue;
    }
    const lista = NOMBRES[genero];
    let i = semilla(c) % lista.length;
    for (let k = 0; k < lista.length && usados.has(lista[i]); k++) i = (i + 1) % lista.length;
    const nombre = usados.has(lista[i]) ? `${lista[i]} ${usados.size + 1}` : lista[i];
    usados.add(lista[i]);
    out.set(c, nombre);
  }
  return out;
}

/** Ordena y etiqueta las voces en español; las que solo tienen código reciben un nombre propio. */
export function ordenar(todas: Bruta[]): Voz[] {
  const es = todas.filter((v) => v.language?.toLowerCase().startsWith('es'));
  const genero = new Map(es.map((v) => [v.identifier, generoDeVoz(v.name, v.identifier)]));
  // Las de Google se llaman todas «Google» en Chrome de Android: también reciben un nombre propio
  const sinNombre = es.filter((v) => !nombreCorto(v.name) || nombreCorto(v.name) === 'Google');
  const nombres = nombresParaCodigos(
    sinNombre.map((v) => codigoVoz(v.identifier)),
    new Map(sinNombre.map((v) => [codigoVoz(v.identifier), genero.get(v.identifier)])),
  );
  return es
    .map((v) => ({ v, p: puntos(v) }))
    .sort((a, b) => b.p - a.p)
    .map(({ v, p }) => ({
      id: v.identifier,
      nombre: nombres.get(codigoVoz(v.identifier)) || nombreCorto(v.name) || 'Voz',
      acento: PAISES[region(v.language)] ?? 'Español',
      calidad: calidad(p),
      genero: genero.get(v.identifier),
      puntos: p,
      sinInternet: /-local$/i.test(v.identifier),
    }));
}

let lista: Promise<Voz[]> | null = null;

/** Las voces en español del dispositivo, la más natural primero. */
export function vocesEspanol(): Promise<Voz[]> {
  // En la web la lista llega con «voiceschanged»; si el navegador no tiene voces, ese aviso no llega nunca.
  const timeout = new Promise<Speech.Voice[]>((resolve) => setTimeout(() => resolve([]), 1500));
  lista ??= Promise.race([Speech.getAvailableVoicesAsync(), timeout])
    .catch(() => [] as Speech.Voice[])
    .then((all) => {
      const voces = ordenar(all);
      if (!voces.length) lista = null;
      return voces;
    });
  return lista;
}

export function useVoces() {
  const [voces, setVoces] = useState<Voz[] | null>(null);
  useEffect(() => {
    vocesEspanol().then(setVoces);
  }, []);
  return voces;
}

// ---------------------------------------------------------------- las voces elegidas

/** Para qué se eligió la voz: el despertador, y Ana y Tomás en el pódcast leído con la voz del dispositivo. */
export type Papel = 'despertar' | 'ana' | 'tomas';

const KEYS: Record<Papel, string> = { despertar: 'voz-despertar', ana: 'voz-ana', tomas: 'voz-tomas' };
/** null: automática (la más natural que haya). */
const elegidas: Record<Papel, string | null> = { despertar: null, ana: null, tomas: null };
let cargadas: Promise<void> | null = null;
const listeners = new Set<() => void>();

const cargar = () =>
  (cargadas ??= Promise.all(
    (Object.keys(KEYS) as Papel[]).map((papel) =>
      AsyncStorage.getItem(KEYS[papel])
        .then((v) => {
          elegidas[papel] = v || null;
        })
        .catch(() => {}),
    ),
  ).then(() => listeners.forEach((l) => l())));

export function elegirVoz(papel: Papel, id: string | null) {
  elegidas[papel] = id;
  listeners.forEach((l) => l());
  (id ? AsyncStorage.setItem(KEYS[papel], id) : AsyncStorage.removeItem(KEYS[papel])).catch(() => {});
}

export function useVozElegida(papel: Papel) {
  useEffect(() => void cargar(), []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => elegidas[papel],
    () => elegidas[papel],
  );
}

/** La voz elegida para ese papel, si este dispositivo aún la tiene. */
export async function vozElegida(papel: Papel): Promise<Voz | undefined> {
  await cargar();
  const id = elegidas[papel];
  return id ? (await vocesEspanol()).find((v) => v.id === id) : undefined;
}

/** La voz con que habla el despertador: la elegida; si no, la más natural. */
export async function vozDespertar(): Promise<Voz | undefined> {
  return (await vozElegida('despertar')) ?? (await vocesEspanol())[0];
}

/** Más calmado que una lectura normal: es lo primero que se oye en el día. */
export const RITMO_DESPERTAR = 0.94;

/** «Juan 3:16» dicho como lo diría una persona; «3:16» lo leen muchas voces como «tres dos puntos dieciséis». */
export const citaHablada = (libro: string, capitulo: number, versiculo: number) =>
  `${libro}, capítulo ${capitulo}, versículo ${versiculo}`;

/**
 * Lo que lee una voz del dispositivo, con las citas dichas como las diría una persona: «Juan 3:16» → «Juan capítulo
 * 3, versículo 16» y «Salmo 23:1-3» → «Salmo capítulo 23, versículos 1 al 3».
 */
export const paraHablar = (texto: string) =>
  texto
    .replace(/\b(\d{1,3}):(\d{1,3})\s*[-–]\s*(\d{1,3})\b/g, 'capítulo $1, versículos $2 al $3')
    .replace(/\b(\d{1,3}):(\d{1,3})\b/g, 'capítulo $1, versículo $2');
