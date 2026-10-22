// Cliente de /api/estudiar: pide el estudio de un pasaje o la respuesta a una pregunta y lo va recibiendo por partes.

import { aiDenied, aiHeaders, sessionKey } from './comunidad';
import { requireConnection } from './conexion';
import { getSettings } from './theme';

// En web la función vive en el mismo dominio; en el teléfono, en la web publicada.
const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type Source = { n: number; label: string; ref?: string };
/** Lo que la IA consultó para responder una pregunta (las herramientas de api/_investigar.ts). */
export type Paso = { tipo: 'leer' | 'buscar' | 'referencias' | 'comentarios' | 'original' | 'concordancia'; texto: string };
export type Turn = { role: 'user' | 'assistant'; text: string; sources?: Source[]; pasos?: Paso[] };

type Event =
  | { type: 'text'; text: string }
  | ({ type: 'source' } & Source)
  | ({ type: 'paso' } & Paso)
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
  book?: string;
  chapter?: number;
  /** La historia de una palabra del catálogo (src/lib/palabras.ts), en lugar de un pasaje */
  palabra?: string;
  verse?: number;
  word?: number;
  messages: Turn[];
  taller?: TallerRequest;
  herramienta?: Herramienta;
  enfoque?: Enfoque;
  /** Pedir otra versión de la herramienta en vez de la que ya está guardada */
  nueva?: boolean;
  /** Del sermón a tu semana: las notas del sermón para preparar cinco días (src/lib/semanas.ts). */
  semana?: { notas: string; desde?: number; hasta?: number; predicador?: string };
  /** La versión que lee la persona: la IA cita esa (o la RV1909 si es una con derechos; ver api/_investigar.ts). */
  version?: string;
};

/** Los dos modos de la pestaña de estudio: un devocional guiado o el estudio profundo del texto. */
export type Enfoque = 'devocional' | 'profundo';

/** La historia de una palabra ya preparada se lee sin cuenta: la llave va solo si hay sesión (el servidor la pide si hay que prepararla). */
async function palabraHeaders(): Promise<Record<string, string>> {
  requireConnection();
  const llave = await sessionKey();
  return { 'Content-Type': 'application/json', ...(llave && { Authorization: `Bearer ${llave}` }) };
}

/** Llama a onUpdate con el texto, las fuentes y lo consultado, acumulados, cada vez que llega algo nuevo. */
export async function askStudy(
  req: Request,
  onUpdate: (text: string, sources: Source[], pasos: Paso[]) => void,
  signal?: AbortSignal,
): Promise<{ text: string; sources: Source[]; pasos?: Paso[] }> {
  // El Espacio Niños no usa IA: la Biblia se escucha y se conversa con un adulto.
  if (getSettings().modo === 'ninos') throw new Error('En el Espacio Niños no hay IA. Pregúntale a un adulto: ¡conversen juntos!');
  const res = await fetch(`${API}/api/estudiar`, {
    method: 'POST',
    headers: req.palabra ? await palabraHeaders() : await aiHeaders(),
    // En el Modo Jóvenes la IA escribe para su edad (ver JOVENES_SYSTEM en api/estudiar.ts).
    body: JSON.stringify({
      ...req,
      messages: req.messages.map(({ role, text }) => ({ role, text })),
      ...(getSettings().modo === 'jovenes' ? { publico: 'jovenes' } : {}),
    }),
    signal,
  });
  if (res.status === 401) aiDenied();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `No se pudo generar el estudio (${res.status})`);
  }

  let text = '';
  const sources: Source[] = [];
  const pasos: Paso[] = [];
  let failure: string | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as Event;
    if (event.type === 'text') text += event.text;
    else if (event.type === 'source') sources.push({ n: event.n, label: event.label, ref: event.ref });
    else if (event.type === 'paso') pasos.push({ tipo: event.tipo, texto: event.texto });
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
      onUpdate(text, [...sources], [...pasos]);
    }
    handle(buffer);
  } else {
    // Sin lectura por partes (algunas versiones de React Native): se muestra al terminar.
    (await res.text()).split('\n').forEach(handle);
  }
  onUpdate(text, [...sources], [...pasos]);
  if (failure) throw new Error(failure);
  return { text, sources, ...(pasos.length && { pasos }) };
}
