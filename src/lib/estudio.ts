// Cliente de /api/estudiar: pide el estudio de un pasaje o la respuesta a una pregunta y lo va recibiendo por partes.

import { aiDenied, aiHeaders, sessionKey } from './comunidad';
import { requireConnection } from './conexion';
import { getSettings } from './theme';
import { ordenarVueltas, recortarVueltas } from './turnos';

// En web la función vive en el mismo dominio; en el teléfono, en la web publicada.
const API = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Una fuente de la respuesta: un pasaje que se abre en la app («ref») o una obra que se lee fuera («url»). */
export type Source = { n: number; label: string; ref?: string; url?: string; nota?: string };
/** Lo que la IA consultó para responder una pregunta (las herramientas de api/_investigar.ts). */
export type Paso = {
  tipo: 'leer' | 'buscar' | 'referencias' | 'comentarios' | 'original' | 'concordancia' | 'teologia' | 'diccionario' | 'temas' | 'web' | 'personajes';
  texto: string;
};
export type Turn = {
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  pasos?: Paso[];
  /** La respuesta se quedó a medias (falló la conexión o se cerró la app mientras llegaba). */
  cortada?: boolean;
};

type Event =
  | { type: 'text'; text: string }
  /** El texto entero otra vez, con sus citas corregidas (api/_corregir.ts): sustituye a lo que llegó. */
  | { type: 'correccion'; text: string }
  | ({ type: 'source' } & Source)
  | ({ type: 'paso' } & Paso)
  | { type: 'done' }
  | { type: 'error'; message: string };

export type TallerRequest = {
  modo: 'preguntar' | 'sugerir' | 'revisar' | 'repaso' | 'ruleta' | 'maqueta' | 'corregir' | 'borrador' | 'cambiar' | 'practicar';
  tipo: 'reflexion' | 'encuentro' | 'sermon';
  paso: 'pasaje' | 'idea' | 'bosquejo' | 'revisar';
  plantilla?: string;
  desde?: number;
  hasta?: number;
  borrador?: string;
  /** Si el mensaje empezó desde un tema: lo que la persona quería tratar. */
  situacion?: string;
  /** Solo «corregir»: la revisión que las correcciones aplican. */
  revision?: string;
  /** Solo «borrador» (src/lib/borrador.ts): lo marcado de la investigación, la dirección y los minutos. */
  investigacion?: string;
  direccion?: string;
  minutos?: number;
  /** Solo «cambiar»: lo que la persona pide cambiar. */
  pedido?: string;
};

/** Herramientas de un capítulo inspiradas en NotebookLM: resumen en audio, tarjetas de repaso y mapa mental. */
export type Herramienta = 'podcast' | 'tarjetas' | 'mapa' | 'repaso' | 'quien' | 'mentira' | 'ruleta';

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
  /** El Taller desde un tema, todavía sin pasaje: lo que la persona quiere tratar (src/lib/tallerTema.ts). */
  tema?: {
    texto: string;
    tipo: 'reflexion' | 'encuentro' | 'sermon';
    preparar?: boolean;
    /** Un estudio profundo convertido en mensaje (src/lib/estudioASermon.ts). */
    estudio?: { cita: string; texto: string; preguntas: { pregunta: string; respuesta: string }[] };
  };
  /** La versión que lee la persona: la IA cita esa (o la RV1909 si es una con derechos; ver api/_investigar.ts). */
  version?: string;
  /** Una pregunta frecuente del pasaje (src/lib/senales.ts): su respuesta es la misma para todos. */
  frecuente?: number;
  /** Una pregunta libre desde el buscador (src/lib/preguntar.ts); con «preparada», una de las que muchos hacen. */
  pregunta?: { texto: string; nivel: 'sencillo' | 'fondo'; preparada?: string };
};

/** Los dos modos de la pestaña de estudio: un devocional guiado o el estudio profundo del texto. */
export type Enfoque = 'devocional' | 'profundo';

/**
 * La historia de una palabra y la respuesta a una pregunta que muchos hacen ya preparadas se leen sin cuenta: la llave
 * va solo si hay sesión (el servidor la pide si hay que prepararla).
 */
async function palabraHeaders(): Promise<Record<string, string>> {
  requireConnection();
  const llave = await sessionKey();
  return { 'Content-Type': 'application/json', ...(llave && { Authorization: `Bearer ${llave}` }) };
}

const CORTADA = 'La respuesta se cortó antes de llegar. Inténtalo de nuevo.';
// Al volver a la app, cada cuánto se pregunta por la respuesta que siguió en el servidor, y hasta cuándo (la función
// puede durar 5 minutos).
const REANUDAR_CADA_MS = 2500;
const REANUDAR_HASTA_MS = 7 * 60_000;

/** Un UUID v4 para «seguir». */
function nuevoId() {
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const esperar = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });

/** En la web, espera a que la página se vea otra vez: en segundo plano no vale la pena preguntar. */
const visible = (signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return resolve();
    const listo = () => {
      if (document.visibilityState === 'hidden') return;
      document.removeEventListener('visibilitychange', listo);
      resolve();
    };
    document.addEventListener('visibilitychange', listo);
    signal?.addEventListener('abort', () => (document.removeEventListener('visibilitychange', listo), resolve()), { once: true });
  });

type Fila = { texto: string; fuentes: Source[]; pasos: Paso[]; error: string | null; terminada: boolean };

/**
 * La conexión se cortó (la persona cambió de app o bloqueó la pantalla), pero la IA siguió en el servidor
 * (api/_reanudar.ts): se recoge lo que lleva escrito hasta que termina. Si el servidor no la tiene, falla como antes.
 */
async function recoger(
  id: string,
  headers: Record<string, string>,
  onUpdate: (text: string, sources: Source[], pasos: Paso[]) => void,
  signal: AbortSignal | undefined,
  original: unknown,
): Promise<{ text: string; sources: Source[]; pasos?: Paso[] }> {
  const hasta = Date.now() + REANUDAR_HASTA_MS;
  let faltas = 0;
  let fila: Fila | null = null;
  while (Date.now() < hasta && !signal?.aborted) {
    await visible(signal);
    if (signal?.aborted) break;
    let res: Response;
    try {
      res = await fetch(`${API}/api/estudiar`, { method: 'POST', headers, body: JSON.stringify({ reanudar: id }), signal });
    } catch {
      // Todavía sin red al volver: se intenta otra vez.
      await esperar(REANUDAR_CADA_MS, signal);
      continue;
    }
    if (res.status === 401) aiDenied();
    if (res.status === 404) {
      // La pregunta no llegó al servidor (o la base falló): no hay nada que recoger.
      if (++faltas >= 3) break;
    } else if (res.ok) {
      fila = (await res.json().catch(() => null)) as Fila | null;
      if (fila) {
        onUpdate(fila.texto, fila.fuentes ?? [], fila.pasos ?? []);
        if (fila.terminada) {
          if (fila.error) throw new Error(fila.error);
          if (!fila.texto.trim()) throw new Error(CORTADA);
          return { text: fila.texto, sources: fila.fuentes ?? [], ...(fila.pasos?.length && { pasos: fila.pasos }) };
        }
      }
    }
    await esperar(REANUDAR_CADA_MS, signal);
  }
  if (signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  // No terminó a tiempo: si llegó algo, la app lo deja marcado como cortado.
  throw fila?.texto.trim() || !(original instanceof Error) ? new Error(CORTADA) : original;
}

/** Llama a onUpdate con el texto, las fuentes y lo consultado, acumulados, cada vez que llega algo nuevo. */
export async function askStudy(
  req: Request,
  onUpdate: (text: string, sources: Source[], pasos: Paso[]) => void,
  signal?: AbortSignal,
): Promise<{ text: string; sources: Source[]; pasos?: Paso[] }> {
  // El Espacio Niños no usa IA: la Biblia se escucha y se conversa con un adulto.
  if (getSettings().modo === 'ninos') throw new Error('En el Espacio Niños no hay IA. Pregúntale a un adulto: ¡conversen juntos!');
  const headers = req.palabra || (req.pregunta?.preparada && !req.messages.length) ? await palabraHeaders() : await aiHeaders();
  // Con cuenta, la respuesta sigue en el servidor aunque se corte la conexión, y se recoge al volver.
  const seguir = headers.Authorization && !req.palabra ? nuevoId() : undefined;
  // Si la persona la detiene (o cierra el estudio), también se detiene en el servidor.
  if (seguir) {
    signal?.addEventListener(
      'abort',
      () => {
        fetch(`${API}/api/estudiar`, { method: 'POST', headers, body: JSON.stringify({ detener: seguir }), keepalive: true }).catch(() => {});
      },
      { once: true },
    );
  }
  let res: Response;
  try {
    res = await fetch(`${API}/api/estudiar`, {
      method: 'POST',
      headers,
      // En el Modo Jóvenes la IA escribe para su edad (ver JOVENES_SYSTEM en api/estudiar.ts).
      body: JSON.stringify({
        ...req,
        // Alternadas y sin pasarse del máximo, aunque lo guardado en el dispositivo venga de una versión vieja.
        messages: recortarVueltas(ordenarVueltas(req.messages) ?? req.messages).map(({ role, text }) => ({ role, text })),
        ...(seguir && { seguir }),
        ...(getSettings().modo === 'jovenes' ? { publico: 'jovenes' } : {}),
        // Las preguntas sobre el pasaje pueden ayudar a otros, limpias y sin nombre. Nunca en el Modo Jóvenes.
        ...(getSettings().modo === 'general' && getSettings().compartirPreguntas && req.messages.length > 0 && !req.taller && !req.semana && !req.tema && !req.pregunta
          ? { compartir: true }
          : {}),
      }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted || !seguir) throw e;
    return recoger(seguir, headers, onUpdate, signal, e);
  }
  if (res.status === 401) aiDenied();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `No se pudo generar el estudio (${res.status})`);
  }

  let text = '';
  const sources: Source[] = [];
  const pasos: Paso[] = [];
  let failure: string | null = null;
  let terminada = false;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as Event;
    if (event.type === 'text') text += event.text;
    else if (event.type === 'correccion') text = event.text;
    else if (event.type === 'source') sources.push({ n: event.n, label: event.label, ref: event.ref, url: event.url, nota: event.nota });
    else if (event.type === 'paso') pasos.push({ tipo: event.tipo, texto: event.texto });
    else if (event.type === 'error') failure = event.message;
    if (event.type === 'done' || event.type === 'error') terminada = true;
  };

  try {
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
  } catch (e) {
    // Se cortó a mitad (en el teléfono, al cambiar de app): la IA siguió en el servidor.
    if (signal?.aborted || !seguir) throw e;
    return recoger(seguir, headers, onUpdate, signal, e);
  }
  // La conexión se cerró sin «done» (el servidor llegó a su tiempo máximo, un proxy la cortó): se busca lo guardado.
  if (!terminada && seguir && !signal?.aborted) return recoger(seguir, headers, onUpdate, signal, new Error(CORTADA));
  onUpdate(text, [...sources], [...pasos]);
  if (failure) throw new Error(failure);
  // La conexión se cerró sin decir nada: no es una respuesta. Sin esto quedaba una respuesta vacía guardada en la
  // conversación y las preguntas siguientes fallaban.
  if (!text.trim()) throw new Error(CORTADA);
  return { text, sources, ...(pasos.length && { pasos }) };
}
