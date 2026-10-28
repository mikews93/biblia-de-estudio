import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { useEffect, useState, useSyncExternalStore } from 'react';

// Las voces del dispositivo en español, de la más natural a la más robótica. No cuestan nada: hablan el navegador
// o el teléfono, sin servidor de voz. Lo que más cambia el sonido es qué voz se usa: Edge trae voces neuronales
// («Online (Natural)»), Safari las «Mejorada»/«Premium», Chrome las de Google y Android las «network» de su motor de
// voz. La elegida para el despertador se guarda en el dispositivo (no en la cuenta: cada teléfono tiene sus voces).

export type Calidad = 'natural' | 'buena' | 'basica';

export type Voz = {
  id: string;
  /** El nombre corto para mostrar: «Dalia», «Google», «Paulina». */
  nombre: string;
  /** «México», «Colombia», «España»… */
  acento: string;
  calidad: Calidad;
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
  // Android nombra sus voces con códigos («es-us-x-esf-network»): se les da nombre al listar (ordenar)
  if (!limpio || /^[a-z]{2}[-_]/i.test(limpio)) return '';
  return limpio;
}

// Android (y algunos navegadores) nombran sus voces con códigos («es-us-x-esf-network»). Para poder decir «me gusta
// Ariel» se les da un nombre propio, siempre el mismo para el mismo código en cualquier teléfono. Son nombres que
// sirven para hombre o mujer: el código no dice cómo suena la voz.
const NOMBRES = ['Ariel', 'Alex', 'Dani', 'Sasha', 'Noa', 'René', 'Cruz', 'Paz', 'Fran', 'Reyes', 'Guadalupe', 'Trini'];

/** La parte que distingue una voz de otra: «es-us-x-esf-network» → «es-us-esf» (la local y la de red son la misma). */
export const codigoVoz = (id: string) => {
  const m = id.toLowerCase().match(/^([a-z]{2})[-_]([a-z0-9]{2,3})[-_]x[-_]([a-z0-9]+)/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : id.toLowerCase();
};

const semilla = (texto: string) => [...texto].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Un nombre para cada código sin repetir en este dispositivo; el mismo código siempre pide primero el mismo. */
export function nombresParaCodigos(codigos: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const usados = new Set<string>();
  for (const c of [...new Set(codigos)].sort()) {
    let i = semilla(c) % NOMBRES.length;
    for (let k = 0; k < NOMBRES.length && usados.has(NOMBRES[i]); k++) i = (i + 1) % NOMBRES.length;
    const nombre = usados.has(NOMBRES[i]) ? `${NOMBRES[i]} ${usados.size + 1}` : NOMBRES[i];
    usados.add(NOMBRES[i]);
    out.set(c, nombre);
  }
  return out;
}

/** Ordena y etiqueta las voces en español; las que solo tienen código reciben un nombre propio. */
export function ordenar(todas: Bruta[]): Voz[] {
  const es = todas.filter((v) => v.language?.toLowerCase().startsWith('es'));
  const sinNombre = nombresParaCodigos(es.filter((v) => !nombreCorto(v.name)).map((v) => codigoVoz(v.identifier)));
  return es
    .map((v) => ({ v, p: puntos(v) }))
    .sort((a, b) => b.p - a.p)
    .map(({ v, p }) => ({
      id: v.identifier,
      nombre: nombreCorto(v.name) || sinNombre.get(codigoVoz(v.identifier)) || 'Voz',
      acento: PAISES[region(v.language)] ?? 'Español',
      calidad: calidad(p),
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
