// Cliente de la lectura en vivo (api/vivo.ts y api/_celula.ts). Cada teléfono pregunta por la sala cada
// segundo y medio con un GET que el CDN comparte entre toda la célula; los cambios van por POST y su respuesta
// se aplica al instante. Como las respuestas pueden llegar desordenadas, siempre gana la versión más alta.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { sessionKey } from './comunidad';
import type { ModoRepaso, PreguntaRepaso } from './repaso';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const POLL_MS = 1500;
const HEARTBEAT_MS = 20_000;
export const CODE_LENGTH = 6;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type Fuente = { n: number; label: string; ref?: string; url?: string };
export type Tarjeta = {
  /** «estudio»: una sección del estudio o su respuesta a una duda; «ronda»: una pregunta que todos responden en secreto. */
  tipo: 'dinamica' | 'pregunta' | 'parte' | 'estudio' | 'ronda' | 'repaso';
  id?: string;
  titulo: string;
  texto: string | null;
  pasos: string[];
  paso: number;
  dinamica: string | null;
  minutos: number | null;
  fin: string | null;
  fuentes?: Fuente[];
  pregunta?: string | null;
  anonima?: boolean;
  revelada?: boolean;
  /** Repaso: «correcta» es -1 hasta que se revela cada pregunta. */
  preguntas?: PreguntaRepaso[];
  reveladas?: number[];
  desdes?: (string | null)[];
  modo?: ModoRepaso;
  equipos?: Record<string, number>;
};
export type EstadoSala = { libro: string; capitulo: number; foco: number | null; tarjeta: Tarjeta | null; recorrido: string[] };
export type Persona = { id: string; nombre: string; foto: string | null };
export type Toque = { usuario: string; nombre: string; versiculo: number };
/** Una duda del tablero de la sala; «apoyos» son quienes tocaron «yo también». */
export type PreguntaSala = { id: string; texto: string; autor: string; nombre: string; apoyos: string[]; respondida: boolean };
/** La ronda en pantalla: quiénes respondieron y, ya reveladas, las respuestas (sin nombre si es anónima). */
export type Respuestas = {
  ronda: string;
  quienes: string[];
  lista: { texto: string; usuario?: string; nombre?: string }[] | null;
  /** Repaso: cuántos eligieron cada opción en las preguntas reveladas, y el marcador si se juega con puntos o equipos. */
  votos?: Record<number, number[]>;
  marcador?: { usuario: string; nombre: string; puntos: number; aciertos: number; equipo?: number | null }[];
};
export type Sala = {
  sala: {
    codigo: string;
    titulo: string;
    grupo: { id: string; nombre: string } | null;
    enVivo: boolean;
    dueno: { id: string; nombre: string };
    guia: { id: string; nombre: string };
  };
  version: number;
  ahora: string;
  estado: EstadoSala;
  presentes: Persona[];
  toques: Toque[];
  preguntas: PreguntaSala[];
  respuestas: Respuestas | null;
};
/** Lo que muestra la pantalla del grupo cuando hay una lectura abierta. */
export type SalaDelGrupo = { codigo: string; titulo: string; estado: EstadoSala; guia: string; presentes: number };

/** El código como lo escribe la persona, limpio: mayúsculas, sin espacios ni letras que no existen en los códigos. */
export function cleanCode(input: string) {
  return [...input.toUpperCase()].filter((ch) => CODE_ALPHABET.includes(ch)).join('').slice(0, CODE_LENGTH);
}

/** El código en dos bloques de tres, más fácil de dictar en voz alta: «K7M QWE». */
export const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

export function liveUrl(codigo: string) {
  const origin = typeof location !== 'undefined' ? location.origin : API || 'https://biblia.migueblanco.com';
  return `${origin}/vivo/${codigo}`;
}

/** Entre lo que ya hay y lo que llega, se queda con la versión más nueva (las respuestas pueden cruzarse). */
export const newest = (prev: Sala | null, next: Sala) => (prev && prev.version > next.version ? prev : next);

/** Segundos que le quedan al reloj de la tarjeta, con la hora del servidor corregida. null si no corre. */
export function secondsLeft(fin: string | null, skewMs: number, now = Date.now()) {
  if (!fin) return null;
  return Math.max(0, Math.ceil((Date.parse(fin) - (now + skewMs)) / 1000));
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Los tonos de las personas: cada quien ilumina siempre con el mismo color, en claro y en oscuro. */
export const TONOS = [
  { light: '#F6E3B4', dark: '#5A4A1F', ink: '#8A6417' },
  { light: '#CFE6D6', dark: '#24412F', ink: '#2F6B45' },
  { light: '#D5E2F2', dark: '#26364C', ink: '#35577F' },
  { light: '#F2D6DD', dark: '#4B2A33', ink: '#934257' },
  { light: '#E3D9F0', dark: '#382E4A', ink: '#634A8A' },
  { light: '#F4DCCB', dark: '#4A3224', ink: '#9A5630' },
];
export function toneOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
}

/** Agrupa los versículos iluminados: quién tocó cada uno. */
export function touchesByVerse(toques: Toque[]) {
  const map = new Map<number, Toque[]>();
  for (const t of toques) map.set(t.versiculo, [...(map.get(t.versiculo) ?? []), t]);
  return map;
}

/** El tablero: primero las que esperan, las más apoyadas arriba; las ya vistas al final. */
export function ordenPreguntas(list: PreguntaSala[]) {
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => Number(a.p.respondida) - Number(b.p.respondida) || b.p.apoyos.length - a.p.apoyos.length || a.i - b.i)
    .map(({ p }) => p);
}

/**
 * Parte el estudio Profundo en sus secciones («## Panorama»). Cada una lleva su título sin el «##», su texto y
 * las fuentes que cita (⟦n⟧), para que en cada teléfono los números se puedan abrir.
 */
export function seccionesDelEstudio(text: string, fuentes: Fuente[] = []) {
  return text
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const [first, ...rest] = part.split('\n');
      // «## Panorama: de qué trata…» o «## Panorama» con el texto debajo
      const [title, ...inline] = first.split(/:\s+/);
      const body = [inline.join(': '), ...rest].join('\n').trim();
      const cited = new Set([...body.matchAll(/⟦(\d+)⟧/g)].map((m) => Number(m[1])));
      return { titulo: title.replace(/[:.]\s*$/, '').trim(), texto: body, fuentes: fuentes.filter((f) => cited.has(f.n)) };
    })
    .filter((s) => s.titulo && s.texto);
}

/** Las preguntas de una sección («Para aplicar»): cada línea de la lista que es una pregunta, sin citas ni negritas. */
export function preguntasDe(texto: string) {
  return texto
    .split('\n')
    .filter((l) => /^\s*[-*] /.test(l))
    .map((l) => l.replace(/^\s*[-*] /, '').replace(/\s*⟦\d+⟧/g, '').replace(/\*\*/g, '').trim())
    .filter((l) => l.endsWith('?') && l.length <= 280);
}

export class VivoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function vivoApi<T = Sala>(accion: string, body: Record<string, unknown> = {}): Promise<T> {
  const llave = await sessionKey();
  let res: Response;
  try {
    res = await fetch(`${API}/api/vivo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(llave ? { Authorization: `Bearer ${llave}` } : {}) },
      body: JSON.stringify({ accion, ...body }),
    });
  } catch {
    throw new VivoError('No hay conexión. La lectura en vivo necesita internet.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new VivoError(json.error ?? `Algo falló (${res.status})`, res.status);
  return json as T;
}

async function fetchSala(codigo: string, signal: AbortSignal) {
  const res = await fetch(`${API}/api/vivo?sala=${codigo}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new VivoError(json.error ?? `Algo falló (${res.status})`, res.status);
  return json as Sala;
}

function useVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const on = () => setVisible(document.visibilityState !== 'hidden');
      document.addEventListener('visibilitychange', on);
      return () => document.removeEventListener('visibilitychange', on);
    }
    const sub = AppState.addEventListener('change', (s) => setVisible(s === 'active'));
    return () => sub.remove();
  }, []);
  return visible;
}

/**
 * Sigue una sala: la pide cada segundo y medio mientras la pantalla está a la vista, y con cuenta avisa
 * cada 20 s que la persona sigue ahí. `apply` mete la respuesta de un cambio propio sin esperar al siguiente
 * sondeo. `skew` es la diferencia entre el reloj del servidor y el del teléfono, para la cuenta atrás.
 */
export function useSala(codigo: string, conCuenta: boolean) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState<VivoError | null>(null);
  const [skew, setSkew] = useState(0);
  const visible = useVisible();
  const latest = useRef<Sala | null>(null);

  const apply = useCallback((next: Sala) => {
    const keep = newest(latest.current, next);
    if (keep !== latest.current) {
      latest.current = keep;
      setSala(keep);
      setSkew(Date.parse(keep.ahora) - Date.now());
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const tick = async () => {
      try {
        apply(await fetchSala(codigo, controller.signal));
        setError(null);
        failures = 0;
        if (latest.current && !latest.current.sala.enVivo) return; // terminó: ya no hay nada que seguir
      } catch (e) {
        if (controller.signal.aborted) return;
        const err = e instanceof VivoError ? e : new VivoError('Se perdió la conexión. Reintentando…', 0);
        setError(err);
        if (err.status === 404 || err.status === 400) return;
        failures++;
      }
      timer = setTimeout(tick, Math.min(POLL_MS * 2 ** failures, 15_000));
    };
    tick();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [codigo, visible, apply]);

  // Con cuenta: entra al abrir, avisa que sigue ahí y sale al cerrar la pantalla.
  useEffect(() => {
    if (!conCuenta || !visible) return;
    let gone = false;
    vivoApi('unirseSala', { sala: codigo })
      .then((s) => !gone && apply(s))
      .catch(() => {});
    const beat = setInterval(() => vivoApi('presente', { sala: codigo }).catch(() => {}), HEARTBEAT_MS);
    return () => {
      gone = true;
      clearInterval(beat);
    };
  }, [codigo, conCuenta, visible, apply]);

  useEffect(
    () => () => {
      if (conCuenta && latest.current?.sala.enVivo) vivoApi('salirSala', { sala: codigo }).catch(() => {});
    },
    [codigo, conCuenta],
  );

  return { sala, error, skew, apply };
}

/** La cuenta atrás de la tarjeta, que se actualiza cada segundo mientras corre. */
export function useCountdown(fin: string | null | undefined, skew: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!fin) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [fin]);
  return secondsLeft(fin ?? null, skew, now);
}
