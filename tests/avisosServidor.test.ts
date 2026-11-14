// servidor/avisos.ts: la ronda de avisos (/api/notificaciones?accion=enviar) servida desde Cloud Run para que la
// llamada de cada minuto no gaste la CPU del plan gratis de Vercel. Aquí se prueba solo el servidor: la ronda en sí
// tiene sus pruebas en tests/api/notificaciones.test.ts.
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const llamadas = vi.hoisted(() => [] as string[]);
vi.mock('../api/notificaciones', () => ({
  GET: async (req: Request) => {
    llamadas.push(req.url);
    return Response.json({ enviados: 2 }, { headers: { 'Cache-Control': 'no-store' } });
  },
}));

let server: Server;
let base: string;

beforeAll(async () => {
  const { crearServidor } = await import('../servidor/avisos');
  server = crearServidor();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server?.close());
beforeEach(() => void (llamadas.length = 0));

describe('servidor de avisos para Cloud Run', () => {
  it('POST / hace la ronda de envío y devuelve lo que respondió', async () => {
    const res = await fetch(`${base}/`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enviados: 2 });
    expect(llamadas).toHaveLength(1);
    expect(new URL(llamadas[0]).searchParams.get('accion')).toBe('enviar');
  });

  it('GET / también hace la ronda (Cloud Scheduler puede usar cualquiera de los dos)', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(llamadas).toHaveLength(1);
  });

  it('las rondas seguidas usan la misma instancia del módulo (la agenda en memoria sigue valiendo)', async () => {
    await fetch(`${base}/`, { method: 'POST' });
    await fetch(`${base}/`, { method: 'POST' });
    expect(llamadas).toHaveLength(2);
  });

  it('cualquier otra ruta da 404 y no envía nada', async () => {
    for (const ruta of ['/api/notificaciones', '/guardar', '/favicon.ico']) {
      expect((await fetch(`${base}${ruta}`, { method: 'POST' })).status).toBe(404);
    }
    expect(llamadas).toHaveLength(0);
  });

  it('otros métodos dan 405', async () => {
    expect((await fetch(`${base}/`, { method: 'DELETE' })).status).toBe(405);
    expect(llamadas).toHaveLength(0);
  });
});
