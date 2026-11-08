// /api/biblia?imagen=…: las imágenes de Wikimedia Commons del estudio y de las fichas, servidas desde la app para
// que carguen aunque Wikimedia rechace al teléfono (src/lib/wikimedia.ts).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let GET: (r: Request) => Promise<Response>;
const IMG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Arca.jpg/500px-Arca.jpg';
const pedir = (url: string) => GET(new Request(`https://zarzabiblia.com/api/biblia?imagen=${encodeURIComponent(url)}`));

beforeAll(async () => {
  ({ GET } = await import('../../api/biblia'));
});

afterEach(() => vi.unstubAllGlobals());

describe('imágenes de Wikimedia a través de la app', () => {
  it('trae la imagen con un agente que se identifica y la deja un año en caché', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } }));
    vi.stubGlobal('fetch', fetch);
    const res = await pedir(IMG);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toContain('max-age=31536000');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(IMG);
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^Zarza\//);
  });

  it('no sirve de proxy para otras direcciones', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const url of ['https://example.com/x.jpg', 'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg?x=1', 'http://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg']) {
      expect((await pedir(url)).status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('si Wikimedia falla o no devuelve una imagen, responde con error y caché corta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 429, headers: { 'content-type': 'text/html' } })));
    const res = await pedir(IMG);
    expect(res.status).toBe(502);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
  });
});
