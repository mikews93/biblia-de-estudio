// Cliente de /api/dramatizado: el capítulo dramatizado a pedido. La primera persona que lo pide lo prepara (unos
// minutos: guion, voces y mezcla) y desde ahí está listo para todos los que leen esa versión.
import { useCallback, useEffect, useRef, useState } from 'react';

import { aiDenied, aiHeaders } from './comunidad';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const POLL_MS = 6000;

export type Dramatizado = { url: string; duracion: number; credito: string; tiempos: [number, number][] };
export type FaseDrama = 'guion' | 'voces' | 'mezcla';
export type EstadoDrama =
  | { estado: 'cargando' }
  | { estado: 'ninguno' }
  | { estado: 'grabando'; fase: FaseDrama; hechas: number; total: number }
  // «inicial»: ya estaba listo al preguntar por primera vez (no se preparó mientras se miraba).
  | ({ estado: 'listo'; inicial?: boolean } & Dramatizado)
  | { estado: 'error'; error: string };

type Answer = Exclude<EstadoDrama, { estado: 'cargando' }>;

const query = (book: string, chapter: number, version?: string) =>
  `book=${book}&chapter=${chapter}${version && version !== 'rv1909' ? `&version=${encodeURIComponent(version)}` : ''}`;

export async function consultarDrama(book: string, chapter: number, version?: string, signal?: AbortSignal): Promise<Answer> {
  const res = await fetch(`${API}/api/dramatizado?${query(book, chapter, version)}`, { signal });
  if (!res.ok) throw new Error(`No se pudo consultar el dramatizado (${res.status})`);
  const body = await res.json();
  // Una grabación que falló del todo se puede volver a pedir: para quien llega es como si no existiera.
  return body.estado === 'error' ? { estado: 'ninguno' } : body;
}

async function pedir(book: string, chapter: number, version?: string): Promise<Answer> {
  const res = await fetch(`${API}/api/dramatizado`, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify({ book, chapter, ...(version && version !== 'rv1909' && { version }) }),
  });
  if (res.status === 401) aiDenied();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `No se pudo dramatizar el capítulo (${res.status})`);
  return body;
}

/** El estado del dramatizado de un capítulo; mientras se prepara se pregunta cada pocos segundos. */
export function useDramaGrabado(book: string, chapter: number, version?: string) {
  const [state, setState] = useState<EstadoDrama>({ estado: 'cargando' });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setState({ estado: 'cargando' });
    consultarDrama(book, chapter, version, controller.signal)
      .then((a) => alive.current && setState(a.estado === 'listo' ? { ...a, inicial: true } : a))
      .catch(() => alive.current && setState({ estado: 'error', error: 'Sin conexión con el servidor. Inténtalo de nuevo con internet.' }));
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [book, chapter, version]);

  const grabando = state.estado === 'grabando';
  useEffect(() => {
    if (!grabando) return;
    const timer = setInterval(() => {
      consultarDrama(book, chapter, version)
        .then((a) => alive.current && setState(a))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [grabando, book, chapter, version]);

  const record = useCallback(async () => {
    setState({ estado: 'grabando', fase: 'guion', hechas: 0, total: 0 });
    try {
      const a = await pedir(book, chapter, version);
      if (alive.current) setState(a);
    } catch (e) {
      if (alive.current) setState({ estado: 'error', error: e instanceof Error ? e.message : 'No se pudo dramatizar.' });
    }
  }, [book, chapter, version]);

  return { ...state, record } as EstadoDrama & { record: () => Promise<void> };
}
