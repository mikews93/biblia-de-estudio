// Preguntar mientras se escucha el pódcast de Ana y Tomás: el reproductor se pausa, la persona pregunta y la misma IA
// del Estudio (api/estudiar.ts, «herramienta: 'podcast'» con conversación) responde con el capítulo, sus fuentes y el
// guion del pódcast como primera respuesta. La conversación vive fuera de la pantalla, así que cerrar la hoja para
// seguir escuchando no corta la respuesta que está llegando; y se guarda como «Tus preguntas» del estudio
// (src/lib/misPreguntas.ts): solo la ve la persona.

import { useCallback, useSyncExternalStore } from 'react';

import { askStudy, type Paso, type Source, type Turn } from './estudio';
import { conversationKey, saveConversation, savedConversation } from './misPreguntas';
import { type Line, SPEAKERS } from './podcast';
import { versionPodcast } from './podcastVersion';
import { getSettings } from './theme';

/** Lo que se manda como «momento»: no más largo que lo que acepta el servidor. */
const MAX_MOMENTO = 900;

export type Estado = { turns: Turn[]; working: boolean; error: string | null };

/** El guion tal como lo escribió la IA («ANA: …» / «TOMÁS: …»): es la primera respuesta de la conversación. */
export function guionDe(lines: Line[]): string {
  return lines.map((l) => `${l.speaker === 'ana' ? 'ANA' : 'TOMÁS'}: ${l.text}`).join('\n');
}

/** La intervención que sonaba al pausar, con quién la decía («Tomás: …»). */
export function momentoDe(lines: Line[], index: number | null | undefined): string | undefined {
  const line = index == null ? undefined : lines[index];
  if (!line?.text.trim()) return undefined;
  const texto = `${SPEAKERS[line.speaker]}: ${line.text.trim()}`;
  return texto.length > MAX_MOMENTO ? `${texto.slice(0, MAX_MOMENTO - 1)}…` : texto;
}

const clave = (book: string, chapter: number, version: string) =>
  conversationKey('podcast', book, chapter) + (version === 'rv1909' ? '' : `:${version}`);

class Conversacion {
  estado: Estado = { turns: [], working: false, error: null };
  private oyentes = new Set<() => void>();
  private abort: AbortController | null = null;
  private cargada: Promise<void>;

  constructor(
    readonly book: string,
    readonly chapter: number,
    readonly version: string,
  ) {
    // Lo que preguntó antes en este pódcast, para verlo al volver a abrir la hoja.
    this.cargada = savedConversation(clave(book, chapter, version)).then(
      (turns) => {
        if (turns && !this.estado.turns.length) this.poner({ turns });
      },
      () => {},
    );
  }

  oir(fn: () => void) {
    this.oyentes.add(fn);
    return () => {
      this.oyentes.delete(fn);
    };
  }

  private poner(e: Partial<Estado>) {
    this.estado = { ...this.estado, ...e };
    this.oyentes.forEach((fn) => fn());
  }

  /** Una pregunta nueva (o, sin texto, otra vez la última que falló). El guion actual va siempre primero. */
  async preguntar(lines: Line[], texto: string | null, momento?: string) {
    if (this.estado.working) return;
    await this.cargada;
    let previas = this.estado.turns.slice(1);
    // Una pregunta que se quedó sin respuesta (o a medias) se quita: la nueva, o la misma otra vez, va en su lugar.
    const ultima = previas[previas.length - 1];
    if (ultima?.role === 'assistant' && ultima.cortada) previas = previas.slice(0, -1);
    const pendiente = previas[previas.length - 1]?.role === 'user' ? previas.pop() : undefined;
    const pregunta = texto?.trim() || pendiente?.text;
    if (!pregunta) return;
    const historia: Turn[] = [{ role: 'assistant', text: guionDe(lines) }, ...previas, { role: 'user', text: pregunta }];
    this.poner({ turns: [...historia, { role: 'assistant', text: '' }], working: true, error: null });
    const controller = new AbortController();
    this.abort = controller;
    try {
      const r = await askStudy(
        { book: this.book, chapter: this.chapter, herramienta: 'podcast', messages: historia, version: this.version, ...(momento && { momento }) },
        (text: string, sources: Source[], pasos: Paso[]) =>
          !controller.signal.aborted && this.poner({ turns: [...historia, { role: 'assistant', text, sources, ...(pasos.length && { pasos }) }] }),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const turns: Turn[] = [...historia, { role: 'assistant', ...r }];
      this.poner({ turns, working: false });
      saveConversation(clave(this.book, this.chapter, this.version), turns).catch(() => {});
    } catch (e) {
      if (controller.signal.aborted) return;
      const last = this.estado.turns[this.estado.turns.length - 1];
      const algo = last?.role === 'assistant' && last.text.trim();
      this.poner({
        turns: algo ? [...historia, { ...last, cortada: true }] : historia,
        working: false,
        error: e instanceof Error ? e.message : 'No se pudo responder. Inténtalo de nuevo.',
      });
    } finally {
      if (this.abort === controller) this.abort = null;
    }
  }

  /** Detiene la respuesta y deja lo que alcanzó a escribir. */
  detener() {
    this.abort?.abort();
    this.abort = null;
    const t = this.estado.turns;
    const last = t[t.length - 1];
    this.poner({ working: false, turns: last?.role === 'assistant' && !last.text.trim() ? t.slice(0, -1) : t });
  }

  /** Borra lo que preguntó en este pódcast. */
  borrar() {
    this.detener();
    this.poner({ turns: [], error: null });
    saveConversation(clave(this.book, this.chapter, this.version), []).catch(() => {});
  }
}

const abiertas = new Map<string, Conversacion>();

/** La conversación del pódcast de este capítulo, en la versión del pódcast de quien lee. */
export function conversacionPodcast(book: string, chapter: number): Conversacion {
  const version = versionPodcast(getSettings().version);
  const k = clave(book, chapter, version);
  let c = abiertas.get(k);
  if (!c) {
    c = new Conversacion(book, chapter, version);
    abiertas.set(k, c);
    if (abiertas.size > 8) abiertas.delete(abiertas.keys().next().value!);
  }
  return c;
}

const VACIO: Estado = { turns: [], working: false, error: null };

export function usePreguntasPodcast(c: Conversacion | null): Estado {
  const oir = useCallback((fn: () => void) => (c ? c.oir(fn) : () => {}), [c]);
  return useSyncExternalStore(
    oir,
    () => c?.estado ?? VACIO,
    () => c?.estado ?? VACIO,
  );
}

export type { Conversacion };
