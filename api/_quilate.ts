// Trazas hacia Quilate, la plataforma propia donde se revisa lo que responde la IA de cada app.
// Con QUILATE_KEY y QUILATE_URL cada respuesta de la IA sale como una traza (la pregunta, cada vuelta con su modelo y
// tokens, cada herramienta). Sin ellas no hace nada. Nada de lo que le pase a Quilate frena ni tumba la app.
//
// La clase es una copia de la librería de Quilate (sdk-ts/src/index.ts): cuando Quilate la publique como paquete, este
// archivo se queda solo con la parte de «Zarza» del final. No se edita aquí: se cambia en Quilate y se vuelve a copiar.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { waitUntil } from './_seguir';

export type SpanKind = 'model' | 'tool' | 'retrieval' | 'chain';
/** Un paso tal como viaja a `/v1/ingest`. */
export interface SpanPayload {
  id: string; traceId: string; parentId: string | null; kind: SpanKind; name: string; startedAt: string; endedAt: string;
  input: unknown; output: unknown; model: string | null;
  inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; error: string | null;
  sessionId: string | null; fn: string | null; appVersion: string | null; environment: string | null; promptHash: string | null;
}
/** Manda un lote y devuelve el código de respuesta. */
export type Transport = (url: string, key: string, spans: readonly SpanPayload[]) => Promise<number>;

export interface SpanOptions {
  kind: SpanKind;
  /** Solo en la raíz: para usar el id de la petición de la app como id de la traza. */
  traceId?: string;
  sessionId?: string; fn?: string; appVersion?: string; environment?: string;
  model?: string; input?: unknown; promptHash?: string;
}
export interface QuilateOptions {
  key: string | undefined; url: string | undefined; transport?: Transport;
  flushIntervalMs?: number; maxBatch?: number; maxQueue?: number; maxRetries?: number; retryDelayMs?: number;
  appVersion?: string; environment?: string;
}

const INGEST_PATH = '/v1/ingest';
const HTTP_TIMEOUT_MS = 5000;
const MAX_ERROR_CHARS = 2000;
const TOO_MANY_REQUESTS = 429;

const httpTransport: Transport = async (url, key, spans) => {
  const res = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ spans }), signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  return res.status;
};

/** Copia el valor como JSON en el momento. Lo que no es JSON se guarda como texto en vez de romper la llamada. */
function snapshot(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value, (_key, inner: unknown) => (typeof inner === 'bigint' ? inner.toString() : inner))) as unknown;
  } catch {
    return String(value);
  }
}

/** Un paso en curso. La app le pone la salida y los tokens antes de terminar. */
export class Span {
  output: unknown = null;
  error: string | null = null;
  inputTokens = 0;
  outputTokens = 0;
  cacheReadTokens = 0;
  cacheWriteTokens = 0;
  /** @internal */
  constructor(
    readonly id: string, readonly traceId: string, readonly parentId: string | null, readonly name: string, readonly kind: SpanKind,
    readonly inherited: { sessionId: string | null; fn: string | null; appVersion: string | null; environment: string | null },
    readonly model: string | null, readonly promptHash: string | null, readonly input: unknown, readonly startedAt: Date,
  ) {}
}

export class Quilate {
  readonly enabled: boolean;
  /** Pasos que no llegaron a Quilate: cola llena, cliente cerrado o Quilate caído tras los reintentos. */
  dropped = 0;
  private readonly key: string;
  private readonly url: string;
  private readonly transport: Transport;
  private readonly flushIntervalMs: number;
  private readonly maxBatch: number;
  private readonly maxQueue: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly defaults: { appVersion: string | null; environment: string | null };
  private readonly current = new AsyncLocalStorage<Span>();
  private queue: SpanPayload[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sending: Promise<void> = Promise.resolve();
  private closing = false;
  private lastStart = 0;

  constructor(options: QuilateOptions) {
    this.enabled = Boolean(options.key && options.url);
    this.key = options.key ?? '';
    this.url = (options.url ?? '').replace(/\/+$/, '') + INGEST_PATH;
    this.transport = options.transport ?? httpTransport;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;
    this.maxBatch = options.maxBatch ?? 100;
    this.maxQueue = options.maxQueue ?? 10_000;
    this.maxRetries = options.maxRetries ?? 4;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.defaults = { appVersion: options.appVersion ?? null, environment: options.environment ?? null };
  }

  /** Lee QUILATE_KEY y QUILATE_URL. Si falta alguna, el cliente queda apagado y no hace nada. */
  static fromEnv(options: Omit<QuilateOptions, 'key' | 'url'> = {}, env: Record<string, string | undefined> = process.env): Quilate {
    return new Quilate({ ...options, key: env.QUILATE_KEY, url: env.QUILATE_URL });
  }

  /** Corre `work` como un paso. Los pasos que se abran adentro quedan como sus hijos. El error de `work` sigue su camino. */
  async span<T>(name: string, options: SpanOptions, work: (span: Span) => T | Promise<T>): Promise<T> {
    const parent = this.current.getStore() ?? null;
    const span = new Span(
      randomUUID().replaceAll('-', ''), options.traceId ?? parent?.traceId ?? randomUUID().replaceAll('-', ''), parent?.id ?? null, name, options.kind,
      {
        sessionId: options.sessionId ?? parent?.inherited.sessionId ?? null, fn: options.fn ?? parent?.inherited.fn ?? null,
        appVersion: options.appVersion ?? parent?.inherited.appVersion ?? this.defaults.appVersion,
        environment: options.environment ?? parent?.inherited.environment ?? this.defaults.environment,
      },
      options.model ?? null, options.promptHash ?? null, this.enabled ? snapshot(options.input) : null, this.nextStart(),
    );
    const clock = performance.now();
    try {
      return await this.current.run(span, () => work(span));
    } catch (error) {
      if (span.error === null) span.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      throw error;
    } finally {
      // El final sale del reloj monótono: nunca queda antes del comienzo aunque cambie la hora del sistema.
      this.record(span, new Date(span.startedAt.getTime() + Math.max(0, Math.round(performance.now() - clock))));
    }
  }

  /** Manda lo pendiente y deja de aceptar pasos. Llamarlo al apagar la app. */
  async close(): Promise<void> {
    this.closing = true;
    await this.flush();
  }

  /** Manda lo pendiente sin cerrar. En una función sin servidor el temporizador no llega a correr: llamarlo al terminar cada petición. */
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.drain();
    await this.sending;
  }

  /** Quilate ordena los pasos por su inicio, al milisegundo: dos seguidos en el mismo milisegundo perderían su orden. */
  private nextStart(): Date {
    this.lastStart = Math.max(Date.now(), this.lastStart + 1);
    return new Date(this.lastStart);
  }

  // Lo que sigue no debe lanzar nunca hacia la app.

  private record(span: Span, endedAt: Date): void {
    if (!this.enabled) return;
    try {
      if (this.closing || this.queue.length >= this.maxQueue) { this.dropped += 1; return; }
      this.queue.push({
        id: span.id, traceId: span.traceId, parentId: span.parentId, kind: span.kind, name: span.name,
        startedAt: span.startedAt.toISOString(), endedAt: endedAt.toISOString(),
        input: span.input, output: snapshot(span.output), model: span.model,
        inputTokens: Math.trunc(span.inputTokens || 0), outputTokens: Math.trunc(span.outputTokens || 0),
        cacheReadTokens: Math.trunc(span.cacheReadTokens || 0), cacheWriteTokens: Math.trunc(span.cacheWriteTokens || 0),
        error: span.error ? span.error.slice(0, MAX_ERROR_CHARS) : null, ...span.inherited, promptHash: span.promptHash,
      });
      if (this.queue.length >= this.maxBatch) this.drain();
      else if (!this.timer) {
        this.timer = setTimeout(() => { this.timer = null; this.drain(); }, this.flushIntervalMs);
        // El temporizador no mantiene viva la app: si termina, lo pendiente sale con `close()`.
        (this.timer as { unref?: () => void }).unref?.();
      }
    } catch {
      this.dropped += 1;
    }
  }

  /** Saca la cola en lotes, uno tras otro, para que lleguen en orden. */
  private drain(): void {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxBatch);
      this.sending = this.sending.then(() => this.send(batch));
    }
  }

  private async send(batch: SpanPayload[]): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let status = 0; // sin red: se reintenta
      try { status = await this.transport(this.url, this.key, batch); } catch { /* se reintenta */ }
      if (status >= 200 && status < 300) return;
      // Una llave mala o un lote mal formado no mejoran al reintentar; una caída o un «más despacio», sí.
      if (!(status === 0 || status === TOO_MANY_REQUESTS || status >= 500) || attempt === this.maxRetries) break;
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * 2 ** attempt));
    }
    this.dropped += batch.length;
  }
}

// ── Zarza ──

/** El cliente de todas las funciones. En Vercel el temporizador no llega a correr: cada función llama a `enviarTrazas()` al terminar. */
export const quilate = Quilate.fromEnv({ environment: process.env.VERCEL_ENV, appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7), maxRetries: 2 });

/** Manda lo pendiente después de responder, sin hacer esperar a la persona. */
export const enviarTrazas = () => waitUntil(quilate.flush());

/** Lo más largo que se guarda de un texto: un encargo o una respuesta caben de sobra. */
export const MAX_TEXTO_TRAZA = 12_000;

/** Texto corto para la traza: lo escrito, sin los documentos del pasaje (son siempre los mismos y pesan cientos de KB). */
export function textoDe(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, MAX_TEXTO_TRAZA);
  if (!Array.isArray(content)) return '';
  return content
    .filter((bloque): bloque is { type: 'text'; text: string } => !!bloque && typeof bloque === 'object' && (bloque as { type?: unknown }).type === 'text' && typeof (bloque as { text?: unknown }).text === 'string')
    .map((bloque) => bloque.text)
    .join('')
    .slice(0, MAX_TEXTO_TRAZA);
}

/** Lo que una llamada a la IA deja en su traza: lo que respondió y los tokens que contó el proveedor. */
export interface Uso {
  salida: unknown;
  entrada?: number | null;
  salidaTokens?: number | null;
  cacheLeido?: number | null;
  cacheEscrito?: number | null;
}

/** Recorta un texto para la traza; lo demás va tal cual. */
const corto = (valor: unknown) => (typeof valor === 'string' ? valor.slice(0, MAX_TEXTO_TRAZA) : valor);

/**
 * Una llamada a la IA como un paso de tipo «model». Si no hay una traza abierta, es una traza sola y sale al terminar;
 * si la hay (una respuesta de /api/estudiar, una búsqueda), queda dentro de ella.
 */
export async function trazarIA<R>(
  nombre: string,
  pedido: { fn: string; model: string; input: unknown },
  llamar: () => Promise<R>,
  leer: (respuesta: R) => Uso,
): Promise<R> {
  try {
    return await quilate.span(nombre, { kind: 'model', fn: pedido.fn, model: pedido.model, input: corto(pedido.input) }, async (paso) => {
      const respuesta = await llamar();
      const uso = leer(respuesta);
      paso.output = corto(uso.salida);
      paso.inputTokens = uso.entrada ?? 0;
      paso.outputTokens = uso.salidaTokens ?? 0;
      paso.cacheReadTokens = uso.cacheLeido ?? 0;
      paso.cacheWriteTokens = uso.cacheEscrito ?? 0;
      return respuesta;
    });
  } finally {
    enviarTrazas();
  }
}

/** Lo que importa de un mensaje de Claude, venga de `messages.create`, de `beta.messages.create` o de un stream. */
export interface MensajeClaude {
  content: readonly { type: string; text?: string; name?: string; input?: unknown }[];
  usage?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  } | null;
}

/** El texto que escribió Claude; si respondió con herramientas, lo que le pasó a cada una. */
export function usoDeClaude(mensaje: MensajeClaude): Uso {
  const herramientas = mensaje.content.filter((bloque) => bloque.type === 'tool_use');
  return {
    salida: herramientas.length ? Object.fromEntries(herramientas.map((bloque) => [bloque.name, bloque.input])) : textoDe(mensaje.content),
    entrada: mensaje.usage?.input_tokens,
    salidaTokens: mensaje.usage?.output_tokens,
    cacheLeido: mensaje.usage?.cache_read_input_tokens,
    cacheEscrito: mensaje.usage?.cache_creation_input_tokens,
  };
}

/** Una llamada a Claude con su traza. `llamar` devuelve el mensaje final (en un stream, `finalMessage()`). */
export const conClaude = <R extends MensajeClaude>(nombre: string, pedido: { fn: string; model: string; input: unknown }, llamar: () => Promise<R>) =>
  trazarIA(nombre, pedido, llamar, usoDeClaude);
