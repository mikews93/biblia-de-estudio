// «Pregúntale a la Biblia»: una pregunta libre escrita o dictada en el buscador. La IA investiga con las mismas
// herramientas del Estudio (api/_investigar.ts) y responde en partes cortas: En corto, Lo que dice la Biblia, Cómo lo han
// entendido y Para pensar. Las «Preguntas que muchos hacen» se responden una vez y se guardan para todos: se leen sin
// cuenta (api/estudiar.ts, preguntaPost).

import { useCallback, useSyncExternalStore } from 'react';

import { askStudy, type Paso, type Source, type Turn } from './estudio';
import { MAX_PREGUNTA, preparadaDe, sinAcentos } from './preguntarTexto';
import { getSettings } from './theme';

export type Nivel = 'sencillo' | 'fondo';
export { CATEGORIAS, PREPARADAS, type Categoria, type Preparada } from './preguntasPreparadas';
export { MAX_PREGUNTA, enCorto, esPregunta, preparadaDe, separar } from './preguntarTexto';
export type Estado = { turns: Turn[]; working: boolean; error: string | null };

/**
 * Una conversación de preguntas. Vive fuera de las pantallas para que la tarjeta del buscador y la pantalla
 * /preguntar compartan la misma respuesta mientras llega: abrir la respuesta completa no la vuelve a pedir.
 */
class Conversacion {
  estado: Estado = { turns: [], working: false, error: null };
  private oyentes = new Set<(e: Estado) => void>();
  private abort: AbortController | null = null;

  constructor(
    readonly texto: string,
    readonly nivel: Nivel,
    readonly preparada?: string,
  ) {}

  oir(fn: (e: Estado) => void) {
    this.oyentes.add(fn);
    return () => {
      this.oyentes.delete(fn);
    };
  }

  private poner(e: Partial<Estado>) {
    this.estado = { ...this.estado, ...e };
    this.oyentes.forEach((fn) => fn(this.estado));
  }

  /** La primera respuesta, o la de una pregunta de seguimiento. Sin texto, vuelve a intentar la última. */
  async preguntar(siguiente?: string) {
    if (this.estado.working) return;
    let turns = this.estado.turns;
    // Una respuesta que falló a medias se quita para volver a pedirla.
    if (turns.length && turns[turns.length - 1].role === 'assistant' && turns[turns.length - 1].cortada) turns = turns.slice(0, -1);
    if (siguiente) turns = [...turns, { role: 'user', text: siguiente }];
    const pedido: Turn[] = [...turns, { role: 'assistant', text: '' }];
    this.poner({ turns: pedido, working: true, error: null });
    const controller = new AbortController();
    this.abort = controller;
    const update = (text: string, sources: Source[], pasos: Paso[]) =>
      this.poner({ turns: [...turns, { role: 'assistant', text, sources, pasos }] });
    try {
      await askStudy(
        {
          pregunta: { texto: this.texto, nivel: this.nivel, ...(this.preparada && { preparada: this.preparada }) },
          // La primera pregunta va aparte: al servidor solo le llega la conversación que la sigue.
          messages: turns,
          version: getSettings().version,
        },
        update,
        controller.signal,
      );
      this.poner({ working: false });
    } catch (e) {
      if (controller.signal.aborted) return;
      const last = this.estado.turns[this.estado.turns.length - 1];
      const algo = last?.role === 'assistant' && last.text.trim();
      this.poner({
        turns: algo ? [...turns, { ...last, cortada: true }] : turns,
        working: false,
        error: e instanceof Error ? e.message : 'No se pudo responder. Inténtalo de nuevo.',
      });
    }
  }

  detener() {
    this.abort?.abort();
    const last = this.estado.turns[this.estado.turns.length - 1];
    if (last?.role === 'assistant' && !last.text.trim()) {
      this.poner({ turns: this.estado.turns.slice(0, -1), working: false });
    } else {
      this.poner({ working: false });
    }
  }
}

const abiertas = new Map<string, Conversacion>();

/** La conversación de esta pregunta y este nivel; la primera vez se crea y empieza a preguntar. */
export function conversacion(texto: string, nivel: Nivel): Conversacion {
  const limpio = texto.trim().slice(0, MAX_PREGUNTA);
  const preparada = preparadaDe(limpio)?.id;
  const llave = `${nivel}|${sinAcentos(limpio)}|${getSettings().version}|${getSettings().modo}`;
  let c = abiertas.get(llave);
  // Una que se quedó sin respuesta por un error se vuelve a intentar al abrirla de nuevo.
  if (c && !c.estado.working && c.estado.error && c.estado.turns.length === 0) c = undefined;
  if (!c) {
    c = new Conversacion(limpio, nivel, preparada);
    abiertas.set(llave, c);
    // No se guardan más de unas pocas: son de esta visita.
    if (abiertas.size > 12) abiertas.delete(abiertas.keys().next().value!);
    c.preguntar();
  }
  return c;
}

export function useConversacion(c: Conversacion | null): Estado | null {
  const oir = useCallback((fn: () => void) => (c ? c.oir(fn) : () => {}), [c]);
  return useSyncExternalStore(
    oir,
    () => c?.estado ?? null,
    () => c?.estado ?? null,
  );
}

export type { Conversacion };
