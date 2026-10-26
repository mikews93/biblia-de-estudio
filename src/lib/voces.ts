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
  // Android nombra sus voces con códigos («es-us-x-esf-network»): se numeran al listar
  if (!limpio || /^[a-z]{2}[-_]/i.test(limpio)) return '';
  return limpio;
}

/** Ordena y etiqueta las voces en español; las de nombre en código quedan como «Voz 1», «Voz 2»… */
export function ordenar(todas: Bruta[]): Voz[] {
  let sinNombre = 0;
  return todas
    .filter((v) => v.language?.toLowerCase().startsWith('es'))
    .map((v) => ({ v, p: puntos(v) }))
    .sort((a, b) => b.p - a.p)
    .map(({ v, p }) => ({
      id: v.identifier,
      nombre: nombreCorto(v.name) || `Voz ${++sinNombre}`,
      acento: PAISES[region(v.language)] ?? 'Español',
      calidad: calidad(p),
      puntos: p,
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

// ---------------------------------------------------------------- la voz del despertador

const KEY = 'voz-despertar';
/** null: automática (la más natural que haya). */
let elegida: string | null = null;
let cargada: Promise<void> | null = null;
const listeners = new Set<() => void>();

const cargar = () =>
  (cargada ??= AsyncStorage.getItem(KEY)
    .then((v) => {
      elegida = v || null;
      listeners.forEach((l) => l());
    })
    .catch(() => {}));

export function elegirVozDespertar(id: string | null) {
  elegida = id;
  listeners.forEach((l) => l());
  (id ? AsyncStorage.setItem(KEY, id) : AsyncStorage.removeItem(KEY)).catch(() => {});
}

export function useVozDespertar() {
  useEffect(() => void cargar(), []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => elegida,
    () => elegida,
  );
}

/** La voz con que habla el despertador: la elegida si este dispositivo aún la tiene; si no, la más natural. */
export async function vozDespertar(): Promise<Voz | undefined> {
  await cargar();
  const voces = await vocesEspanol();
  return voces.find((v) => v.id === elegida) ?? voces[0];
}

/** Más calmado que una lectura normal: es lo primero que se oye en el día. */
export const RITMO_DESPERTAR = 0.94;

/** «Juan 3:16» dicho como lo diría una persona; «3:16» lo leen muchas voces como «tres dos puntos dieciséis». */
export const citaHablada = (libro: string, capitulo: number, versiculo: number) =>
  `${libro}, capítulo ${capitulo}, versículo ${versiculo}`;
