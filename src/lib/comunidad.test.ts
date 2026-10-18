import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { url: string; body: Record<string, unknown>; auth?: string };

/** Servidor falso: responde según la acción y guarda lo que recibió. */
function fakeServer(reply: (accion: string, call: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const call = { url, body: JSON.parse(String(init.body)), auth: headers.Authorization };
      calls.push(call);
      const { status = 200, json } = reply(String(call.body.accion), call);
      return new Response(JSON.stringify(json), { status });
    }),
  );
  return calls;
}

const usuario = { id: 'u1', nombre: 'Ana', correo: null };

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('cuenta', () => {
  it('al registrarse guarda la llave y la manda en las siguientes llamadas, con la fecha local', async () => {
    const calls = fakeServer((accion) =>
      accion === 'registrarse' ? { json: { usuario, llave: 'llave-1' } } : { json: { usuario, grupos: [] } },
    );
    const c = await import('./comunidad');
    await c.signUp('Ana', '  ');
    expect(calls.map((x) => x.body.accion)).toEqual(['registrarse', 'yo']);
    expect(calls[0]).toMatchObject({ url: '/api/comunidades', auth: undefined, body: { nombre: 'Ana' } });
    expect(calls[0].body).not.toHaveProperty('correo'); // un correo en blanco no se manda
    expect(calls[1].auth).toBe('Bearer llave-1');
    expect(calls[1].body.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.parse((await AsyncStorage.getItem('cuenta'))!)).toEqual({ llave: 'llave-1', usuario });
    expect(await c.aiHeaders()).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer llave-1' });
  });

  it('una respuesta 401 olvida la sesión del dispositivo', async () => {
    await AsyncStorage.setItem('cuenta', JSON.stringify({ llave: 'vieja', usuario }));
    fakeServer(() => ({ status: 401, json: { error: 'Tu sesión terminó. Vuelve a entrar.' } }));
    const c = await import('./comunidad');
    await expect(c.api('yo')).rejects.toMatchObject({ message: 'Tu sesión terminó. Vuelve a entrar.', status: 401 });
    expect(JSON.parse((await AsyncStorage.getItem('cuenta'))!)).toEqual({ llave: null, usuario: null });
    await expect(c.aiHeaders()).rejects.toThrow(c.NEEDS_ACCOUNT);
  });

  it('sin conexión da un error claro con estado 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    const c = await import('./comunidad');
    await expect(c.api('yo')).rejects.toMatchObject({ status: 0, message: 'No hay conexión. Las comunidades necesitan internet.' });
  });

  it('sin cuenta, reportReading no llama al servidor', async () => {
    const calls = fakeServer(() => ({ json: {} }));
    const c = await import('./comunidad');
    await c.reportReading('jhn', 3);
    expect(calls).toEqual([]);
  });

  it('signOut cierra la sesión aunque el servidor falle', async () => {
    await AsyncStorage.setItem('cuenta', JSON.stringify({ llave: 'k', usuario }));
    fakeServer(() => ({ status: 500, json: { error: 'x' } }));
    const c = await import('./comunidad');
    await c.signOut();
    expect(JSON.parse((await AsyncStorage.getItem('cuenta'))!).llave).toBeNull();
  });
});

describe('textos', () => {
  it('ago: hace cuánto, en español', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    const { ago } = await import('./comunidad');
    const before = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(ago(before(20_000))).toBe('ahora');
    expect(ago(before(5 * 60_000))).toBe('hace 5 min');
    expect(ago(before(3 * 3_600_000))).toBe('hace 3 h');
    expect(ago(before(26 * 3_600_000))).toBe('ayer');
    expect(ago(before(3 * 86_400_000))).toBe('hace 3 días');
    expect(ago(before(30 * 86_400_000))).toMatch(/18 sept?/);
  });

  it('iniciales, tipo de grupo y enlaces', async () => {
    const c = await import('./comunidad');
    expect(c.initials('  maría   josé pérez')).toBe('MJ');
    expect(c.initials('Ana')).toBe('A');
    expect(c.tipoLabel('celula')).toBe('Célula');
    expect(c.chapterHref('jhn', 3)).toBe('/juan/3');
    expect(c.chapterHref('jhn', 3, 16)).toBe('/juan/3/16');
    expect(c.inviteUrl('ABC')).toMatch(/\/unirse\/ABC$/);
  });
});

describe('askStudy (cliente de /api/estudiar)', () => {
  const ndjson = (chunks: string[], status = 200) =>
    vi.fn(async () => {
      const enc = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          chunks.forEach((c) => controller.enqueue(enc.encode(c)));
          controller.close();
        },
      });
      return new Response(body, { status });
    });

  it('junta el texto y las fuentes aunque una línea llegue partida en dos trozos', async () => {
    await AsyncStorage.setItem('cuenta', JSON.stringify({ llave: 'k', usuario }));
    vi.stubGlobal(
      'fetch',
      ndjson([
        '{"type":"text","text":"Dios "}\n{"type":"so',
        'urce","n":1,"label":"Juan 3:16","ref":"jhn.3.16"}\n{"type":"text","text":"amó ⟦1⟧"}\n',
        '{"type":"done"}',
      ]),
    );
    const { askStudy } = await import('./estudio');
    const updates: string[] = [];
    const answer = await askStudy({ book: 'jhn', chapter: 3, messages: [{ role: 'assistant', text: 'x', sources: [] }] }, (t) =>
      updates.push(t),
    );
    expect(answer).toEqual({ text: 'Dios amó ⟦1⟧', sources: [{ n: 1, label: 'Juan 3:16', ref: 'jhn.3.16' }] });
    expect(updates.at(-1)).toBe('Dios amó ⟦1⟧');
    const sent = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
    expect(sent.messages).toEqual([{ role: 'assistant', text: 'x' }]); // sin las fuentes
  });

  it('un evento de error termina en excepción con su mensaje', async () => {
    await AsyncStorage.setItem('cuenta', JSON.stringify({ llave: 'k', usuario }));
    vi.stubGlobal('fetch', ndjson(['{"type":"text","text":"a"}\n{"type":"error","message":"Hay muchas consultas"}\n']));
    const { askStudy } = await import('./estudio');
    await expect(askStudy({ book: 'jhn', chapter: 3, messages: [] }, () => {})).rejects.toThrow('Hay muchas consultas');
  });

  it('sin cuenta no llama al servidor; con 401 olvida la sesión', async () => {
    vi.stubGlobal('fetch', vi.fn());
    let m = await import('./estudio');
    await expect(m.askStudy({ book: 'jhn', chapter: 3, messages: [] }, () => {})).rejects.toThrow('Para usar la IA necesitas una cuenta gratuita.');
    expect(fetch).not.toHaveBeenCalled();

    vi.resetModules();
    await AsyncStorage.setItem('cuenta', JSON.stringify({ llave: 'k', usuario }));
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Tu sesión terminó.' }, { status: 401 })));
    m = await import('./estudio');
    await expect(m.askStudy({ book: 'jhn', chapter: 3, messages: [] }, () => {})).rejects.toThrow('Para usar la IA necesitas una cuenta gratuita.');
    expect(JSON.parse((await AsyncStorage.getItem('cuenta'))!).llave).toBeNull();
  });

  it('otros errores muestran el mensaje del servidor', async () => {
    await AsyncStorage.setItem('cuenta', JSON.stringify({ llave: 'k', usuario }));
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Libro o capítulo no válido' }, { status: 400 })));
    const { askStudy } = await import('./estudio');
    await expect(askStudy({ book: 'xyz', chapter: 1, messages: [] }, () => {})).rejects.toThrow('Libro o capítulo no válido');
  });
});
