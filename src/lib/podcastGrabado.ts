// Cliente de /api/podcast-grabado: el pódcast del capítulo con voces naturales. La primera persona que lo pide lo
// graba (uno o dos minutos) y desde ahí está listo para todos.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { aiDenied, aiHeaders } from './comunidad';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const POLL_MS = 8000;
/** Lo más que se espera una consulta corta (¿ya está grabado?) antes de darla por perdida. */
const CONSULTA_MS = 12_000;
/** Una grabación tarda uno o dos minutos; si pasan más de estos sin terminar, se cortó y se ofrece volver a intentarlo. */
const GRABAR_MAX_MS = 7 * 60_000;
/** Al empezar, el servidor tarda un instante en anotar que se está grabando: antes de esto un «ninguno» no es un corte. */
const GRACIA_MS = 20_000;

export type Grabacion = { url: string; duracion: number; credito: string; tiempos?: number[] };
export type EstadoGrabacion =
  | { estado: 'cargando' }
  | { estado: 'ninguno' }
  /** «desde»: cuándo empezó a esperarla este teléfono (para enseñar cuánto lleva). */
  | { estado: 'grabando'; desde: number }
  | ({ estado: 'listo' } & Grabacion)
  | { estado: 'error'; error: string };

type Answer = { estado: 'ninguno' } | { estado: 'grabando' } | ({ estado: 'listo' } & Grabacion);

// Un capítulo, o con «palabra» el pódcast de «La historia de una palabra»; cada versión tiene su grabación.
type Target = { book: string; chapter: number; palabra?: string; version?: string };

/**
 * Una señal que se corta sola a los «ms» (o con «signal»). Al volver a la app con la red dormida, un fetch podía quedarse
 * esperando para siempre y la pantalla del pódcast, girando.
 */
export function conLimite(ms: number, signal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

async function check({ book, chapter, palabra, version }: Target, signal?: AbortSignal): Promise<Answer> {
  const query = (palabra ? `palabra=${palabra}` : `book=${book}&chapter=${chapter}`) + (version && version !== 'rv1909' ? `&version=${version}` : '');
  const res = await fetch(`${API}/api/podcast-grabado?${query}`, { signal: conLimite(CONSULTA_MS, signal) });
  if (!res.ok) throw new Error(`No se pudo consultar la grabación (${res.status})`);
  return res.json();
}

async function request({ book, chapter, palabra, version }: Target): Promise<Answer> {
  const res = await fetch(`${API}/api/podcast-grabado`, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify({ ...(palabra ? { palabra } : { book, chapter }), ...(version && version !== 'rv1909' && { version }) }),
  });
  if (res.status === 401) aiDenied();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `No se pudo grabar el pódcast (${res.status})`);
  return body;
}

/** Las versiones libres en que el capítulo ya tiene su pódcast grabado (ver elegirVersionPodcast). */
export async function versionesGrabadas(book: string, chapter: number, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(`${API}/api/podcast-grabado?grabadas=1&book=${book}&chapter=${chapter}`, { signal: conLimite(CONSULTA_MS, signal) });
  if (!res.ok) throw new Error(`No se pudo consultar la grabación (${res.status})`);
  const body = (await res.json()) as { versiones?: unknown };
  return Array.isArray(body.versiones) ? body.versiones.filter((v): v is string => typeof v === 'string') : [];
}

/** El estado de la grabación al preguntar al servidor; «grabando» empieza a contar desde ahora. */
const desdeRespuesta = (a: Answer, desde = Date.now()): EstadoGrabacion =>
  a.estado === 'grabando' ? { estado: 'grabando', desde } : a.estado === 'ninguno' ? { estado: 'ninguno' } : a;

/** `guion`: el texto del guion ya terminado. Si cambia («Preparar otra versión»), se vuelve a preguntar: la grabación del
 * guion de antes ya no vale y el servidor deja grabar el nuevo. */
export function usePodcastGrabado(book: string, chapter: number, palabra?: string, version?: string, guion?: string) {
  const [state, setState] = useState<EstadoGrabacion>({ estado: 'cargando' });
  const alive = useRef(true);
  const actual = useRef(state);
  useEffect(() => {
    actual.current = state;
  });

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setState({ estado: 'cargando' });
    check({ book, chapter, palabra, version }, controller.signal)
      .then((a) => alive.current && !controller.signal.aborted && setState(desdeRespuesta(a)))
      // Sin conexión con el servidor (o si no contesta a tiempo), la tarjeta no aparece: queda la voz del dispositivo.
      .catch(() => alive.current && !controller.signal.aborted && setState({ estado: 'ninguno' }));
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [book, chapter, palabra, version, guion]);

  // Mientras se graba (aquí, en otra pantalla o en otro teléfono) se pregunta cada pocos segundos, y al volver a la app
  // en seguida: el servidor sigue grabando aunque se cierre la app, y al volver solo hay que recogerla.
  const grabando = state.estado === 'grabando';
  useEffect(() => {
    if (!grabando) return;
    const mirar = () => {
      const ahora = actual.current;
      if (ahora.estado !== 'grabando') return;
      check({ book, chapter, palabra, version })
        .then((a) => {
          if (!alive.current || actual.current.estado !== 'grabando') return;
          const lleva = Date.now() - ahora.desde;
          if (a.estado === 'listo') setState(a);
          // El servidor ya no la está grabando y no quedó lista: se cortó.
          else if (a.estado === 'ninguno' && lleva > GRACIA_MS) setState({ estado: 'error', error: CORTADA });
          else if (lleva > GRABAR_MAX_MS) setState({ estado: 'error', error: CORTADA });
        })
        .catch(() => {});
    };
    const timer = setInterval(mirar, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && mirar());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [grabando, book, chapter, palabra, version]);

  const record = useCallback(async () => {
    const desde = Date.now();
    setState({ estado: 'grabando', desde });
    try {
      const a = await request({ book, chapter, palabra, version });
      if (alive.current) setState(desdeRespuesta(a, desde));
    } catch (e) {
      if (!alive.current) return;
      // Un «no» del servidor (el límite del día, sin cuenta…) se enseña. Si solo se cortó la conexión (fetch lanza
      // TypeError: la app pasó a segundo plano o cambió la red), el servidor sigue grabando: se queda en «grabando» y la consulta de cada pocos segundos la recoge.
      if (!(e instanceof TypeError)) setState({ estado: 'error', error: e instanceof Error ? e.message : 'No se pudo grabar.' });
    }
  }, [book, chapter, palabra, version]);

  return { ...state, record };
}

const CORTADA = 'La grabación no terminó. Inténtalo otra vez.';
