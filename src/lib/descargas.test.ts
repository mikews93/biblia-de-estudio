import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import type { Index, Manifest, Store } from './descargas';

// Tres libros bastan: Rut (4 caps.), Judas (1) y Filemón (1). A Rut le falta el archivo de párrafos del cap. 2.
const books = BOOKS.filter((b) => ['rut', 'jud', 'phm'].includes(b.id));
const manifest: Manifest = {
  'text/rv1909': { rut: [4000], jud: [1200], phm: [1100] },
  'text/bes': { rut: [4100], jud: [1300], phm: [1000] },
  paragraphs: { rut: [40, [1, 3, 4]], jud: [10] },
  interlinear: { rut: [30000], jud: [9000], phm: [8000] },
  xrefs: { rut: [2000], jud: [900], phm: [700] },
};

function memoryStore() {
  const files = new Map<string, string>();
  let index: Index = {};
  const store: Store = {
    has: async (p) => files.has(p),
    put: async (p, res) => void files.set(p, await res.text()),
    remove: async (paths) => paths.forEach((p) => files.delete(p)),
    readIndex: async () => index,
    writeIndex: async (i) => void (index = i),
    clear: async () => {
      files.clear();
      index = {};
    },
  };
  return { store, files };
}

/** Sirve /data como el servidor; `fail` hace fallar las direcciones que contiene. */
function server(fail?: string) {
  const asked: string[] = [];
  const f = vi.fn(async (url: string | URL | Request) => {
    const path = String(url).replace(/^\/data\//, '');
    asked.push(path);
    if (fail && path.includes(fail)) throw new TypeError('Failed to fetch');
    if (path === 'books.json') return Response.json(books);
    if (path === 'descargas.json') return Response.json(manifest);
    const [res, book, chapter] = [path.split('/').slice(0, -2).join('/'), path.split('/').at(-2)!, path.split('/').at(-1)!];
    const entry = manifest[res]?.[book];
    const ch = Number(chapter.replace('.json', ''));
    const exists = entry && (entry[1] ? entry[1].includes(ch) : ch <= books.find((b) => b.id === book)!.chapters);
    if (['versions.json', 'words.json'].includes(path) || exists) return Response.json({ path });
    return new Response('', { status: 404 });
  });
  return { fetch: f as unknown as typeof fetch, asked };
}

async function setup(fail?: string) {
  const mod = await import('./descargas');
  const s = server(fail);
  const mem = memoryStore();
  vi.stubGlobal('fetch', s.fetch);
  mod.useStoreForTests(mem.store, s.fetch);
  await mod.init();
  return { mod, ...s, ...mem };
}

describe('descargas sin conexión', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('bookFiles: todos los capítulos, o solo los que existen cuando el manifiesto los lista', async () => {
    const { bookFiles, textPack, ORIGINAL, REFERENCIAS } = await import('./descargas');
    const rut = books.find((b) => b.id === 'rut')!;
    expect(bookFiles(manifest, rut, textPack('rv1909'))).toEqual([
      'text/rv1909/rut/1.json',
      'text/rv1909/rut/2.json',
      'text/rv1909/rut/3.json',
      'text/rv1909/rut/4.json',
      'paragraphs/rut/1.json',
      'paragraphs/rut/3.json',
      'paragraphs/rut/4.json',
    ]);
    expect(bookFiles(manifest, rut, ORIGINAL)).toHaveLength(4);
    expect(bookFiles(manifest, books.find((b) => b.id === 'phm')!, REFERENCIAS)).toEqual(['xrefs/phm/1.json']);
    expect(bookFiles(manifest, rut, 'otro')).toEqual([]);
  });

  it('packBytes suma los recursos del paquete y formatBytes lo dice en KB o MB', async () => {
    const { packBytes, formatBytes, textPack } = await import('./descargas');
    expect(packBytes(manifest, textPack('rv1909'), ['rut', 'jud'])).toBe(4000 + 1200 + 40 + 10);
    expect(formatBytes(850_000)).toBe('850 KB');
    expect(formatBytes(4_147_537)).toBe('4,1 MB');
    expect(formatBytes(41_575_552)).toBe('42 MB');
    expect(formatBytes(120)).toBe('1 KB');
    expect(formatBytes(1_015_000_000)).toBe('1 GB');
  });

  it('descarga un libro: guarda lo básico y sus capítulos, sin pedir los que no existen', async () => {
    const { mod, files, asked } = await setup();
    await mod.download(mod.textPack('rv1909'), ['rut']);
    expect(mod.isDownloaded(mod.textPack('rv1909'), 'rut')).toBe(true);
    expect(mod.isDownloaded(mod.textPack('rv1909'), 'jud')).toBe(false);
    for (const f of [...mod.BASE_FILES, 'text/rv1909/rut/4.json', 'paragraphs/rut/3.json']) expect(files.has(f)).toBe(true);
    expect(asked).not.toContain('paragraphs/rut/2.json');
    expect(files.size).toBe(mod.BASE_FILES.length + 7);
    // Al terminar no queda nada en curso
    expect(mod.downloadsState().jobs).toEqual({});
  });

  it('no vuelve a pedir lo que ya está guardado', async () => {
    const { mod, asked } = await setup();
    await mod.download(mod.ORIGINAL, ['jud']);
    const before = asked.length;
    await mod.download(mod.ORIGINAL, ['jud', 'phm']);
    expect(asked.slice(before).filter((p) => p.startsWith('interlinear/'))).toEqual(['interlinear/phm/1.json']);
  });

  it('al quitar una versión deja los párrafos que otra versión descargada también usa', async () => {
    const { mod, files } = await setup();
    await mod.download(mod.textPack('rv1909'), ['rut', 'jud']);
    await mod.download(mod.textPack('bes'), ['rut']);
    await mod.remove(mod.textPack('rv1909'), ['rut', 'jud']);
    expect(files.has('text/rv1909/rut/1.json')).toBe(false);
    expect(files.has('paragraphs/rut/1.json')).toBe(true);
    expect(files.has('paragraphs/jud/1.json')).toBe(false);
    expect(files.has('text/bes/rut/1.json')).toBe(true);
    expect(mod.isDownloaded(mod.textPack('rv1909'), 'rut')).toBe(false);
  });

  it('downloadedBytes cuenta una sola vez lo compartido', async () => {
    const { downloadedBytes } = await import('./descargas');
    const index = { 'texto:rv1909': ['rut'], 'texto:bes': ['rut'], referencias: ['jud'] };
    expect(downloadedBytes({ index, manifest })).toBe(4000 + 4100 + 40 + 900);
  });

  it('si se corta la red, guarda los libros que terminaron y avisa', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { mod, files } = await setup('xrefs/phm');
    await mod.download(mod.REFERENCIAS, ['jud', 'phm']);
    expect(mod.isDownloaded(mod.REFERENCIAS, 'jud')).toBe(true);
    expect(mod.isDownloaded(mod.REFERENCIAS, 'phm')).toBe(false);
    expect(files.has('xrefs/jud/1.json')).toBe(true);
    expect(mod.downloadsState().jobs[mod.REFERENCIAS].error).toMatch(/Se cortó la conexión/);
    // Cancelar quita el aviso
    mod.cancel(mod.REFERENCIAS);
    expect(mod.downloadsState().jobs).toEqual({});
  });

  it('removeAll borra todo', async () => {
    const { mod, files } = await setup();
    await mod.download(mod.REFERENCIAS, ['jud']);
    await mod.removeAll();
    expect(files.size).toBe(0);
    expect(mod.isDownloaded(mod.REFERENCIAS, 'jud')).toBe(false);
  });
});

describe('conexión', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('requireConnection solo falla cuando el navegador dice que no hay red', async () => {
    const { requireConnection, NEEDS_CONNECTION } = await import('./conexion');
    vi.stubGlobal('navigator', { onLine: true });
    expect(() => requireConnection()).not.toThrow();
    vi.stubGlobal('navigator', { onLine: false });
    expect(() => requireConnection()).toThrow(NEEDS_CONNECTION);
  });

  it('las funciones con IA no llaman al servidor sin conexión', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { aiHeaders } = await import('./comunidad');
    const { NEEDS_CONNECTION } = await import('./conexion');
    await expect(aiHeaders()).rejects.toThrow(NEEDS_CONNECTION);
    expect(f).not.toHaveBeenCalled();
  });

  it('data.ts: sin red, lo opcional queda vacío y un capítulo avisa que no está descargado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const { getCrossRefs, getChapter, NOT_DOWNLOADED } = await import('./data');
    await expect(getCrossRefs('jhn', 3)).resolves.toEqual({});
    await expect(getChapter('jhn', 3)).rejects.toThrow(NOT_DOWNLOADED);
  });
});
