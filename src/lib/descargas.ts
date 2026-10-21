import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { nativeStore } from './almacen';
import { isOnline } from './conexion';
import { Book, dataUrl, getBooks, load } from './data';

// Descargas para leer sin conexión. Cada paquete se baja por libros. En la web se guarda en Cache Storage
// («biblia-descargas») con la misma dirección que pide la app, y public/sw.js responde desde ahí cuando el
// archivo está guardado. En el teléfono se guarda en archivos (almacen.native.ts) y data.ts los lee primero.
// Los tamaños salen de data/descargas.json, que escribe pipeline/build_data.py.
//
// Paquetes: «texto:<versión>» (el texto y los párrafos), «original» (interlineal griego y hebreo, y las
// diferencias entre manuscritos) y
// «referencias» (referencias cruzadas).

export const DOWNLOADS_CACHE = 'biblia-descargas';
const SHELL_CACHE = 'biblia-v1';
const INDEX_URL = '/__descargas/indice.json';
const PARALLEL = 6;

export const ORIGINAL = 'original';
export const REFERENCIAS = 'referencias';
export const textPack = (version: string) => `texto:${version}`;

/** Bytes de cada libro por recurso; la lista de capítulos solo si al libro le faltan archivos. */
export type Manifest = Record<string, Record<string, [number, number[]?]>>;
/** Libros descargados de cada paquete. */
export type Index = Record<string, string[]>;

/** Lo mínimo para abrir el lector sin conexión, que se guarda con la primera descarga. */
export const BASE_FILES = ['books.json', 'versions.json', 'words.json', 'descargas.json'];

export function resources(pack: string): string[] {
  if (pack.startsWith('texto:')) return [`text/${pack.slice(6)}`, 'paragraphs'];
  if (pack === ORIGINAL) return ['interlinear', 'variantes'];
  if (pack === REFERENCIAS) return ['xrefs'];
  return [];
}

/** Archivos (rutas dentro de data/) de un paquete para un libro, solo los que existen. */
export function bookFiles(manifest: Manifest, book: Book, pack: string): string[] {
  return resources(pack).flatMap((res) => {
    const entry = manifest[res]?.[book.id];
    if (!entry) return [];
    const chapters = entry[1] ?? Array.from({ length: book.chapters }, (_, i) => i + 1);
    return chapters.map((c) => `${res}/${book.id}/${c}.json`);
  });
}

export function packBytes(manifest: Manifest, pack: string, bookIds: string[]): number {
  return resources(pack).reduce((sum, res) => sum + bookIds.reduce((s, id) => s + (manifest[res]?.[id]?.[0] ?? 0), 0), 0);
}

/** «850 KB», «4,1 MB», «41 MB», «1 GB». */
export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('es', { maximumFractionDigits: 1 })} GB`;
  if (n < 1e6) return `${Math.max(1, Math.round(n / 1e3))} KB`;
  return `${(n / 1e6).toLocaleString('es', { maximumFractionDigits: n < 1e7 ? 1 : 0 })} MB`;
}

/** Dónde se guarda lo descargado. En la web, Cache Storage; en el teléfono, archivos; en pruebas, un sustituto. */
export type Store = {
  has(path: string): Promise<boolean>;
  put(path: string, res: Response): Promise<void>;
  remove(paths: string[]): Promise<void>;
  readIndex(): Promise<Index>;
  writeIndex(index: Index): Promise<void>;
  clear(): Promise<void>;
  /** Bytes libres en el dispositivo, si el almacén lo sabe (en la web lo informa el navegador). */
  free?(): Promise<number | null>;
};

function cacheStore(): Store | null {
  if (Platform.OS !== 'web' || typeof caches === 'undefined') return null;
  const open = () => caches.open(DOWNLOADS_CACHE);
  return {
    has: async (path) => !!(await (await open()).match(dataUrl(path))),
    put: async (path, res) => (await open()).put(dataUrl(path), res),
    remove: async (paths) => {
      const c = await open();
      await Promise.all(paths.map((p) => c.delete(dataUrl(p))));
    },
    readIndex: async () => {
      const res = await (await open()).match(INDEX_URL);
      return res ? res.json() : {};
    },
    writeIndex: async (index) =>
      (await open()).put(INDEX_URL, new Response(JSON.stringify(index), { headers: { 'content-type': 'application/json' } })),
    clear: async () => void (await caches.delete(DOWNLOADS_CACHE)),
  };
}

/**
 * Guarda la app misma para que abra sin conexión en cualquier ruta: la página y todo su código, también el de
 * las pantallas que aún no se abrieron (precache.json, de pipeline/seo_pages.py; unos 2 MB).
 */
async function cacheShell() {
  if (Platform.OS !== 'web' || typeof caches === 'undefined') return;
  const c = await caches.open(SHELL_CACHE);
  const code: string[] = await fetch('/precache.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  // Los archivos de código llevan su huella en el nombre: solo se piden los nuevos. La página, siempre.
  const missing = ['/app.html'];
  for (const u of ['/manifest.json', '/logo192.png', ...code]) if (!(await c.match(u))) missing.push(u);
  await Promise.all(missing.map((u) => c.add(u).catch(() => {})));
}

type Job = { books: string[]; done: number; total: number; error?: string };

type State = {
  /** false en un navegador sin Cache Storage. */
  supported: boolean;
  ready: boolean;
  books: Book[];
  manifest: Manifest;
  index: Index;
  jobs: Record<string, Job>;
  /** Espacio libre que informa el dispositivo, si lo informa. */
  free: number | null;
};

let store: Store | null = cacheStore() ?? nativeStore;
let fetcher: typeof fetch = (...args) => fetch(...args);
let state: State = { supported: !!store, ready: false, books: [], manifest: {}, index: {}, jobs: {}, free: null };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const running = new Map<string, { queue: string[]; controller: AbortController }>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function setJob(pack: string, job: Job | null) {
  const jobs = { ...state.jobs };
  if (job) jobs[pack] = job;
  else delete jobs[pack];
  set({ jobs });
}

/** Para las pruebas: otro almacén y otra forma de pedir archivos. */
export function useStoreForTests(s: Store | null, f: typeof fetch) {
  store = s;
  fetcher = f;
  running.clear();
  loading = null;
  state = { supported: !!s, ready: false, books: [], manifest: {}, index: {}, jobs: {}, free: null };
}

async function refreshFree() {
  if (store?.free) {
    const free = await store.free();
    return set({ free: free != null && Number.isFinite(free) ? Math.max(0, free) : null });
  }
  if (typeof navigator === 'undefined') return;
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  if (estimate?.quota != null && estimate.usage != null) set({ free: Math.max(0, estimate.quota - estimate.usage) });
}

export function init() {
  loading ??= (async () => {
    if (!store) return set({ ready: true });
    const [books, manifest, index] = await Promise.all([
      getBooks().catch(() => [] as Book[]),
      load<Manifest>('descargas.json', true).catch(() => ({}) as Manifest),
      store.readIndex().catch(() => ({}) as Index),
    ]);
    set({ books, manifest, index, ready: true });
    refreshFree().catch(() => {});
    // Tras publicar una versión nueva de la app, se guarda su código para seguir abriéndola sin conexión.
    if (Object.keys(index).length && isOnline()) cacheShell().catch(() => {});
  })();
  return loading;
}

const filesOf = (pack: string, ids: string[]) =>
  ids.flatMap((id) => {
    const book = state.books.find((b) => b.id === id);
    return book ? bookFiles(state.manifest, book, pack) : [];
  });

/** El estado actual, fuera de un componente. */
export const downloadsState = () => state;

export const isDownloaded = (pack: string, bookId: string) => !!state.index[pack]?.includes(bookId);

async function fetchOne(path: string, signal: AbortSignal) {
  if (await store!.has(path)) return;
  for (let attempt = 0; ; attempt++) {
    try {
      // no-store: el service worker deja pasar la petición sin guardar otra copia en su caché.
      const res = await fetcher(dataUrl(path), { cache: 'no-store', signal });
      if (res.status === 404) return;
      if (!res.ok) throw new Error(`(${res.status})`);
      await store!.put(path, res);
      return;
    } catch (e) {
      if (signal.aborted || attempt >= 2 || isNoSpace(e)) throw e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

async function fetchAll(paths: string[], signal: AbortSignal, onFile: () => void) {
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
      await fetchOne(paths[next++], signal);
      onFile();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, paths.length) }, worker));
}

const NO_SPACE = 'No queda espacio en este dispositivo. Borra algo de lo descargado e inténtalo otra vez.';

/** Sin espacio: QuotaExceededError en el navegador; en el teléfono, el error del sistema de archivos. */
const isNoSpace = (e: unknown) =>
  (e as Error)?.name === 'QuotaExceededError' || /ENOSPC|no space|not enough space|disk full/i.test(String((e as Error)?.message ?? ''));

function failure(e: unknown) {
  if (isNoSpace(e)) return NO_SPACE;
  if (!isOnline()) return 'Se cortó la conexión. Lo que ya bajó queda guardado; continúa cuando vuelvas a tener internet.';
  return 'No se pudo terminar la descarga. Inténtalo otra vez.';
}

/** Descarga los libros de un paquete. Si ya se está descargando, los suma a la cola. */
export async function download(pack: string, bookIds: string[]) {
  await init();
  if (!store) return;
  const run = running.get(pack);
  const job = state.jobs[pack];
  if (run && job) {
    const extra = bookIds.filter((id) => !isDownloaded(pack, id) && !run.queue.includes(id));
    run.queue.push(...extra);
    return setJob(pack, { ...job, books: [...job.books, ...extra], total: job.total + filesOf(pack, extra).length });
  }

  const queue = bookIds.filter((id) => !isDownloaded(pack, id));
  if (!queue.length) return;
  const total = filesOf(pack, queue).length;
  // Si ya se sabe que no cabe, se avisa antes de empezar (se deja un margen para lo demás del dispositivo).
  if (state.free != null && packBytes(state.manifest, pack, queue) + 50e6 > state.free)
    return setJob(pack, { books: [...queue], done: 0, total, error: NO_SPACE });
  const controller = new AbortController();
  running.set(pack, { queue, controller });
  setJob(pack, { books: [...queue], done: 0, total });

  try {
    globalThis.navigator?.storage?.persist?.().catch(() => {});
    await fetchAll(BASE_FILES, controller.signal, () => {});
    await cacheShell().catch(() => {});
    while (queue.length) {
      const id = queue[0];
      await fetchAll(filesOf(pack, [id]), controller.signal, () => {
        const j = state.jobs[pack];
        if (j) setJob(pack, { ...j, done: j.done + 1 });
      });
      queue.shift();
      const index = { ...state.index, [pack]: [...(state.index[pack] ?? []), id] };
      await store.writeIndex(index);
      set({ index });
    }
    setJob(pack, null);
  } catch (e) {
    if (controller.signal.aborted) setJob(pack, null);
    else setJob(pack, { ...state.jobs[pack], error: failure(e) });
  } finally {
    running.delete(pack);
    refreshFree().catch(() => {});
  }
}

export function cancel(pack: string) {
  running.get(pack)?.controller.abort();
  if (!running.has(pack)) setJob(pack, null);
}

/** Borra libros de un paquete, sin tocar los archivos que otro paquete descargado también usa (los párrafos). */
export async function remove(pack: string, bookIds: string[]) {
  await init();
  if (!store) return;
  const left = (state.index[pack] ?? []).filter((id) => !bookIds.includes(id));
  const keep = new Set(
    Object.entries({ ...state.index, [pack]: left }).flatMap(([p, ids]) => filesOf(p, ids)),
  );
  await store.remove(filesOf(pack, bookIds).filter((p) => !keep.has(p)));
  const index = { ...state.index, [pack]: left };
  if (!left.length) delete index[pack];
  await store.writeIndex(index);
  set({ index });
  refreshFree().catch(() => {});
}

export async function removeAll() {
  await init();
  running.forEach((r) => r.controller.abort());
  await store?.clear();
  set({ index: {}, jobs: {} });
  refreshFree().catch(() => {});
}

/** Bytes que ocupa lo descargado, contando una sola vez los archivos compartidos. */
export function downloadedBytes(s: Pick<State, 'index' | 'manifest'> = state): number {
  const seen = new Set<string>();
  let total = 0;
  for (const [pack, ids] of Object.entries(s.index))
    for (const res of resources(pack))
      for (const id of ids) {
        const key = `${res}/${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        total += s.manifest[res]?.[id]?.[0] ?? 0;
      }
  return total;
}

export function useDownloads() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    init();
    return () => void listeners.delete(l);
  }, []);
  return state;
}
