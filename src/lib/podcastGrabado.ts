// Cliente de /api/podcast-grabado: el pódcast del capítulo con voces naturales. La primera persona que lo pide lo
// graba (uno o dos minutos) y desde ahí está listo para todos.
import { useCallback, useEffect, useRef, useState } from 'react';

import { aiDenied, aiHeaders } from './comunidad';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const POLL_MS = 8000;

export type Grabacion = { url: string; duracion: number; credito: string };
export type EstadoGrabacion =
  | { estado: 'cargando' }
  | { estado: 'ninguno' }
  | { estado: 'grabando' }
  | ({ estado: 'listo' } & Grabacion)
  | { estado: 'error'; error: string };

type Answer = { estado: 'ninguno' | 'grabando' } | ({ estado: 'listo' } & Grabacion);

// Un capítulo, o con «palabra» el pódcast de «La historia de una palabra».
type Target = { book: string; chapter: number; palabra?: string };

async function check({ book, chapter, palabra }: Target, signal?: AbortSignal): Promise<Answer> {
  const query = palabra ? `palabra=${palabra}` : `book=${book}&chapter=${chapter}`;
  const res = await fetch(`${API}/api/podcast-grabado?${query}`, { signal });
  if (!res.ok) throw new Error(`No se pudo consultar la grabación (${res.status})`);
  return res.json();
}

async function request({ book, chapter, palabra }: Target): Promise<Answer> {
  const res = await fetch(`${API}/api/podcast-grabado`, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify(palabra ? { palabra } : { book, chapter }),
  });
  if (res.status === 401) aiDenied();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `No se pudo grabar el pódcast (${res.status})`);
  return body;
}

export function usePodcastGrabado(book: string, chapter: number, palabra?: string) {
  const [state, setState] = useState<EstadoGrabacion>({ estado: 'cargando' });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setState({ estado: 'cargando' });
    check({ book, chapter, palabra }, controller.signal)
      .then((a) => alive.current && setState(a))
      // Sin conexión con el servidor, la tarjeta no aparece: queda la voz del dispositivo.
      .catch(() => alive.current && setState({ estado: 'ninguno' }));
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [book, chapter, palabra]);

  // Mientras otra persona (o esta, en otra pantalla) lo graba, se pregunta cada pocos segundos.
  useEffect(() => {
    if (state.estado !== 'grabando') return;
    const timer = setInterval(() => {
      check({ book, chapter, palabra })
        .then((a) => alive.current && a.estado !== 'grabando' && setState(a))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state.estado, book, chapter, palabra]);

  const record = useCallback(async () => {
    setState({ estado: 'grabando' });
    try {
      const a = await request({ book, chapter, palabra });
      if (alive.current) setState(a);
    } catch (e) {
      if (alive.current) setState({ estado: 'error', error: e instanceof Error ? e.message : 'No se pudo grabar.' });
    }
  }, [book, chapter, palabra]);

  return { ...state, record };
}
