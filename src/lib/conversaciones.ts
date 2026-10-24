import { useEffect, useRef, useState } from 'react';

import type { Paso, Source, Turn } from './estudio';

export type Conversation = { turns: Turn[]; busy: boolean; error: string | null };

const EMPTY: Conversation = { turns: [], busy: false, error: null };

/**
 * Las conversaciones listas para guardar. La respuesta que está llegando va marcada como cortada: si la app se
 * cierra a mitad, al volver se ve lo que alcanzó a escribir y se puede continuar.
 */
export function paraGuardar(all: Partial<Record<string, Conversation>>): Record<string, Turn[]> {
  return Object.fromEntries(
    Object.entries(all).map(([k, c]) => {
      const t = c?.turns ?? [];
      const last = t[t.length - 1];
      return [k, c?.busy && last?.role === 'assistant' ? [...t.slice(0, -1), { ...last, cortada: true }] : t];
    }),
  );
}

type Ask<K> = (
  key: K,
  history: Turn[],
  onUpdate: (text: string, sources: Source[], pasos: Paso[]) => void,
  signal: AbortSignal,
) => Promise<{ text: string; sources: Source[]; pasos?: Paso[] }>;

/**
 * Varias conversaciones con la IA a la vez, una por pestaña (Devocional y Profundo, Pregúntame y
 * Sugiéreme…). Cada una sigue generando aunque se mire otra, y lo ya generado no se vuelve a pedir al
 * cambiar de pestaña. onDone recibe la conversación cada vez que termina una respuesta.
 */
export function useConversations<K extends string>(askFn: Ask<K>, onDone?: (key: K, turns: Turn[]) => void) {
  const [state, setState] = useState<Partial<Record<K, Conversation>>>({});
  const controllers = useRef(new Map<K, AbortController>());
  const histories = useRef(new Map<K, Turn[]>());
  // Las funciones de la pantalla cambian en cada render (el borrador del Taller, el pasaje): se usa la última.
  const latest = useRef({ ask: askFn, onDone });
  useEffect(() => {
    latest.current = { ask: askFn, onDone };
  });

  const patch = (key: K, change: (c: Conversation) => Partial<Conversation>) =>
    setState((s) => {
      const c = s[key] ?? EMPTY;
      return { ...s, [key]: { ...c, ...change(c) } };
    });

  const run = async (key: K, history: Turn[]) => {
    controllers.current.get(key)?.abort();
    const controller = new AbortController();
    controllers.current.set(key, controller);
    histories.current.set(key, history);
    patch(key, () => ({ turns: [...history, { role: 'assistant', text: '', sources: [] }], busy: true, error: null }));
    try {
      const answer = await latest.current.ask(
        key,
        history,
        (text, sources, pasos) =>
          !controller.signal.aborted &&
          patch(key, () => ({ turns: [...history, { role: 'assistant', text, sources, ...(pasos.length && { pasos }) }] })),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const done: Turn[] = [...history, { role: 'assistant', ...answer }];
      patch(key, () => ({ turns: done }));
      latest.current.onDone?.(key, done);
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : 'No se pudo consultar a la IA.';
      // Si falló sin escribir nada, se quita la respuesta vacía para poder reintentar; si llegó a escribir, lo
      // escrito se queda marcado como cortado.
      patch(key, (c) => {
        const last = c.turns[c.turns.length - 1];
        return { error: message, turns: last?.text ? [...c.turns.slice(0, -1), { ...last, cortada: true }] : history };
      });
    } finally {
      if (controllers.current.get(key) === controller) {
        controllers.current.delete(key);
        patch(key, () => ({ busy: false }));
      }
    }
  };

  /** Detiene la respuesta que se está generando y deja lo que ya llegó. */
  const stop = (key: K) => {
    const controller = controllers.current.get(key);
    if (!controller) return;
    controller.abort();
    controllers.current.delete(key);
    patch(key, (c) => {
      const last = c.turns[c.turns.length - 1];
      return { busy: false, turns: last?.role === 'assistant' && !last.text ? c.turns.slice(0, -1) : c.turns };
    });
  };

  /** Pone una conversación ya hecha (la guardada en el dispositivo) sin pedir nada. */
  const set = (key: K, turns: Turn[]) => {
    controllers.current.get(key)?.abort();
    controllers.current.delete(key);
    patch(key, () => ({ turns, busy: false, error: null }));
  };

  /**
   * Vuelve a pedir la última respuesta: la que falló o se quedó cortada (también la de una conversación guardada,
   * que ya no tiene historial en memoria).
   */
  const retry = (key: K) => {
    const turns = state[key]?.turns ?? [];
    const last = turns[turns.length - 1];
    if (last?.role === 'assistant' && last.cortada) return run(key, turns.slice(0, -1));
    if (last?.role === 'user') return run(key, turns);
    return run(key, histories.current.get(key) ?? []);
  };

  /**
   * Hace una pregunta nueva. Si la anterior no llegó a responderse (falló o se cortó) y es la misma, se vuelve a
   * pedir en su lugar en vez de repetirla en la conversación; si es otra, la que quedó sin respuesta se quita.
   */
  const ask = (key: K, text: string) => {
    let turns = state[key]?.turns ?? [];
    const last = turns[turns.length - 1];
    if (last?.role === 'user') turns = turns.slice(0, -1);
    else if (last?.role === 'assistant' && last.cortada && turns[turns.length - 2]?.role === 'user' && turns[turns.length - 2].text.trim() === text.trim())
      turns = turns.slice(0, -2);
    return run(key, [...turns, { role: 'user', text }]);
  };

  /** Lo olvida todo, por ejemplo al cambiar de pasaje. */
  const reset = () => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    histories.current.clear();
    setState({});
  };

  useEffect(() => {
    const all = controllers.current;
    return () => all.forEach((c) => c.abort());
  }, []);

  const get = (key: K): Conversation => state[key] ?? EMPTY;
  const started = (key: K) => !!state[key];

  return { get, started, run, stop, set, retry, ask, reset, all: state };
}
