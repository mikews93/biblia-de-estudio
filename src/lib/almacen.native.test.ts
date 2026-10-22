import { beforeEach, describe, expect, it, vi } from 'vitest';

// expo-file-system en memoria: un Map de ruta → texto; los directorios existen si algo vive debajo.
const disk = vi.hoisted(() => new Map<string, string>());

vi.mock('expo-file-system', () => {
  const join = (parts: (string | { uri: string })[]) => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(parts);
    }
    get exists() {
      return disk.has(this.uri);
    }
    create() {
      disk.set(this.uri, '');
    }
    async write(content: string) {
      disk.set(this.uri, content);
    }
    async text() {
      return disk.get(this.uri)!;
    }
    delete() {
      disk.delete(this.uri);
    }
  }
  class Directory extends File {
    get exists() {
      return [...disk.keys()].some((k) => k.startsWith(`${this.uri}/`));
    }
    delete() {
      for (const k of [...disk.keys()]) if (k.startsWith(`${this.uri}/`)) disk.delete(k);
    }
  }
  return { File, Directory, Paths: { document: { uri: 'doc' }, availableDiskSpace: 3e9 } };
});

describe('almacén de descargas en el teléfono', () => {
  beforeEach(() => disk.clear());

  it('guarda cada archivo con su ruta, el índice aparte, y lo borra', async () => {
    const { nativeStore, readDownloaded } = await import('./almacen.native');
    const s = nativeStore!;
    await s.put('text/rv1909/jhn/3.json', Response.json([[16, 'Porque de tal manera…']]));
    expect(disk.has('doc/biblia-descargas/text/rv1909/jhn/3.json')).toBe(true);
    expect(await s.has('text/rv1909/jhn/3.json')).toBe(true);
    expect(JSON.parse((await readDownloaded('text/rv1909/jhn/3.json'))!)).toEqual([[16, 'Porque de tal manera…']]);
    expect(await readDownloaded('text/rv1909/jhn/4.json')).toBeNull();

    expect(await s.readIndex()).toEqual({});
    await s.writeIndex({ 'texto:rv1909': ['jhn'] });
    expect(await s.readIndex()).toEqual({ 'texto:rv1909': ['jhn'] });

    await s.remove(['text/rv1909/jhn/3.json', 'no/existe.json']);
    expect(await s.has('text/rv1909/jhn/3.json')).toBe(false);
    expect(await s.free!()).toBe(3e9);
    await s.clear();
    expect(disk.size).toBe(0);
  });

  it('refreshDownloaded solo pone al día lo que ya estaba descargado', async () => {
    const { nativeStore, refreshDownloaded } = await import('./almacen.native');
    await nativeStore!.put('xrefs/jhn/3.json', Response.json({ a: 1 }));
    await refreshDownloaded('xrefs/jhn/3.json', Response.json({ a: 2 }));
    await refreshDownloaded('xrefs/jhn/4.json', Response.json({ a: 3 }));
    expect(disk.get('doc/biblia-descargas/xrefs/jhn/3.json')).toBe('{"a":2}');
    expect(disk.has('doc/biblia-descargas/xrefs/jhn/4.json')).toBe(false);
  });
});

describe('data.ts en el teléfono', () => {
  beforeEach(() => vi.resetModules());

  async function phone({ online, saved }: { online: boolean; saved: Record<string, string> }) {
    const refreshed: string[] = [];
    vi.doMock('react-native', () => ({ Platform: { OS: 'android', select: (o: Record<string, unknown>) => o.default } }));
    vi.doMock('./almacen', () => ({
      readDownloaded: async (p: string) => saved[p] ?? null,
      refreshDownloaded: async (p: string) => void refreshed.push(p),
    }));
    vi.doMock('./conexion', () => ({ isOnline: () => online }));
    const f = vi.fn(async (url: string) => {
      if (!online) throw new TypeError('Network request failed');
      return Response.json({ from: 'red', url });
    });
    vi.stubGlobal('fetch', f);
    return { data: await import('./data'), f, refreshed };
  }

  it('lee lo descargado del dispositivo y lo pone al día por detrás', async () => {
    const { data, f, refreshed } = await phone({ online: true, saved: { 'text/rv1909/jhn/3.json': '[[16,"guardado"]]' } });
    await expect(data.getChapter('jhn', 3)).resolves.toEqual([[16, 'guardado']]);
    await vi.waitFor(() => expect(refreshed).toEqual(['text/rv1909/jhn/3.json']));
    expect(f).toHaveBeenCalledWith('https://biblia.migueblanco.com/data/text/rv1909/jhn/3.json');
    // Lo que no está descargado viene de la red
    await expect(data.getChapter('jhn', 4)).resolves.toMatchObject({ from: 'red' });
  });

  it('sin conexión abre lo descargado y avisa de lo que no lo está', async () => {
    const { data, f } = await phone({ online: false, saved: { 'text/rv1909/jhn/3.json': '[[16,"guardado"]]' } });
    await expect(data.getChapter('jhn', 3)).resolves.toEqual([[16, 'guardado']]);
    expect(f).not.toHaveBeenCalled();
    await expect(data.getChapter('jhn', 4)).rejects.toThrow(data.NOT_DOWNLOADED);
    await expect(data.getCrossRefs('jhn', 4)).resolves.toEqual({});
  });
});
