import { afterEach, describe, expect, it, vi } from 'vitest';

import { askStudy } from './estudio';

vi.mock('./comunidad', () => ({
  aiHeaders: async () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer llave' }),
  aiDenied: () => {
    throw new Error('Necesitas una cuenta');
  },
  sessionKey: async () => 'llave',
}));
vi.mock('./conexion', () => ({ requireConnection: () => {} }));

type Body = Record<string, unknown>;

/** Servidor falso: «pregunta» responde a la pregunta, «reanudar» a cada intento de recogerla. */
function servidor(pregunta: (body: Body) => Response | Promise<Response>, reanudar: (n: number) => Response) {
  const bodies: Body[] = [];
  let n = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Body;
      bodies.push(body);
      if (body.reanudar) return reanudar(n++);
      if (body.detener) return new Response(null, { status: 204 });
      return pregunta(body);
    }),
  );
  return bodies;
}

const ndjson = (events: object[]) => new Response(events.map((e) => JSON.stringify(e) + '\n').join(''));
/** Un stream que manda un trozo y luego se corta, como al cambiar de app en el teléfono. */
const cortado = (events: object[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(events.map((e) => JSON.stringify(e) + '\n').join('')));
        c.error(new TypeError('Load failed'));
      },
    }),
  );
const pedido = { book: '1ki', chapter: 21, messages: [{ role: 'assistant' as const, text: 'Estudio' }, { role: 'user' as const, text: '¿Quién era Acab?' }] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('askStudy', () => {
  it('manda un id para seguir y devuelve la respuesta entera', async () => {
    const bodies = servidor(() => ndjson([{ type: 'text', text: 'Acab fue rey' }, { type: 'done' }]), () => new Response('', { status: 404 }));
    const r = await askStudy(pedido, () => {});
    expect(r.text).toBe('Acab fue rey');
    expect(bodies[0].seguir).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('si la conexión se corta, recoge del servidor la respuesta que siguió', async () => {
    vi.useFakeTimers();
    const bodies = servidor(
      () => cortado([{ type: 'text', text: 'Acab' }]),
      (n) =>
        Response.json(
          n === 0
            ? { texto: 'Acab fue', fuentes: [], pasos: [], error: null, terminada: false }
            : { texto: 'Acab fue rey de Israel.', fuentes: [{ n: 1, label: 'JFB' }], pasos: [], error: null, terminada: true },
        ),
    );
    const vistos: string[] = [];
    const p = askStudy(pedido, (t) => vistos.push(t));
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.text).toBe('Acab fue rey de Israel.');
    expect(r.sources).toEqual([{ n: 1, label: 'JFB' }]);
    expect(vistos).toContain('Acab fue');
    expect(bodies.filter((b) => b.reanudar).every((b) => b.reanudar === bodies[0].seguir)).toBe(true);
  });

  it('si el servidor no la tiene, falla como antes', async () => {
    vi.useFakeTimers();
    servidor(() => cortado([]), () => new Response('{}', { status: 404 }));
    const p = askStudy(pedido, () => {});
    const fallo = expect(p).rejects.toThrow('Load failed');
    await vi.runAllTimersAsync();
    await fallo;
  });

  it('una respuesta vacía cuenta como fallo', async () => {
    servidor(() => ndjson([{ type: 'done' }]), () => new Response('', { status: 404 }));
    await expect(askStudy(pedido, () => {})).rejects.toThrow('se cortó');
  });

  it('al detenerla avisa al servidor', async () => {
    const control = new AbortController();
    const bodies = servidor(
      () =>
        new Promise<Response>((_, reject) =>
          control.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))),
        ),
      () => new Response('', { status: 404 }),
    );
    const p = askStudy(pedido, () => {}, control.signal);
    await new Promise((r) => setTimeout(r, 0));
    control.abort();
    await expect(p).rejects.toThrow('Aborted');
    expect(bodies.some((b) => b.detener === bodies[0].seguir)).toBe(true);
  });
});
