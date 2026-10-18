// Cliente de /api/estudiar: pide el estudio de un pasaje o la respuesta a una pregunta y lo va recibiendo por partes.

import { aiDenied, aiHeaders } from './comunidad';

// En web la función vive en el mismo dominio; en el teléfono, en la web publicada.
const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type Source = { n: number; label: string; ref?: string };
export type Turn = { role: 'user' | 'assistant'; text: string; sources?: Source[] };

type Event =
  | { type: 'text'; text: string }
  | ({ type: 'source' } & Source)
  | { type: 'done' }
  | { type: 'error'; message: string };

export type TallerRequest = {
  modo: 'preguntar' | 'sugerir' | 'revisar';
  tipo: 'reflexion' | 'encuentro' | 'sermon';
  paso: 'pasaje' | 'idea' | 'bosquejo' | 'revisar';
  plantilla?: string;
  desde?: number;
  hasta?: number;
  borrador?: string;
};

/** Herramientas de un capítulo inspiradas en NotebookLM: resumen en audio, tarjetas de repaso y mapa mental. */
export type Herramienta = 'podcast' | 'tarjetas' | 'mapa';

type Request = {
  book: string;
  chapter: number;
  verse?: number;
  word?: number;
  messages: Turn[];
  taller?: TallerRequest;
  herramienta?: Herramienta;
};

/** Llama a onUpdate con el texto y las fuentes acumulados cada vez que llega algo nuevo. */
export async function askStudy(
  req: Request,
  onUpdate: (text: string, sources: Source[]) => void,
  signal?: AbortSignal,
): Promise<{ text: string; sources: Source[] }> {
  const res = await fetch(`${API}/api/estudiar`, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify({ ...req, messages: req.messages.map(({ role, text }) => ({ role, text })) }),
    signal,
  });
  if (res.status === 401) aiDenied();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `No se pudo generar el estudio (${res.status})`);
  }

  let text = '';
  const sources: Source[] = [];
  let failure: string | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as Event;
    if (event.type === 'text') text += event.text;
    else if (event.type === 'source') sources.push({ n: event.n, label: event.label, ref: event.ref });
    else if (event.type === 'error') failure = event.message;
  };

  const reader = res.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handle);
      onUpdate(text, [...sources]);
    }
    handle(buffer);
  } else {
    // Sin lectura por partes (algunas versiones de React Native): se muestra al terminar.
    (await res.text()).split('\n').forEach(handle);
  }
  onUpdate(text, [...sources]);
  if (failure) throw new Error(failure);
  return { text, sources };
}
