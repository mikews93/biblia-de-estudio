// Función de Vercel: versiones con derechos (NBLA, LBLA, NVI, NTV, NIV) a través de API.Bible y YouVersion.
// Las claves (API_BIBLE_KEY, YVP_APP_KEY) solo viven aquí. Condiciones de las licencias en src/lib/licenciadas.ts.
//   GET /api/biblia?versiones=1               versiones a las que alguna clave tiene acceso
//   GET /api/biblia?v=nbla&book=jhn&chapter=3 versículos del capítulo, aviso de derechos y ficha FUMS (API.Bible)

import { LICENSED, chapterVerses, chapterVersesHtml, licensedById, type ApiNode, type Licensed } from '../src/lib/licenciadas';

const API = 'https://rest.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY;
const YV_API = 'https://api.youversion.com/v1';
const YV_KEY = process.env.YVP_APP_KEY;
const LIST_TTL = 6 * 60 * 60 * 1000;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiBible<T>(pathAndQuery: string): Promise<T> {
  if (!KEY) throw new HttpError(503, 'Falta la clave de API.Bible.');
  const res = await fetch(`${API}/${pathAndQuery}`, { headers: { 'api-key': KEY, Accept: 'application/json' } });
  if (res.status === 401) throw new HttpError(503, 'La clave de API.Bible no es válida.');
  if (res.status === 403) throw new HttpError(403, 'Tu cuenta de API.Bible no tiene esta versión.');
  if (res.status === 404) throw new HttpError(404, 'Este capítulo no está en esta versión.');
  if (!res.ok) throw new HttpError(502, `API.Bible respondió ${res.status}.`);
  return (await res.json()) as T;
}

let accessCache: { at: number; ids: Promise<Set<string>> } | null = null;

/** Ids de API.Bible de las Biblias que la clave puede leer. */
function accessible(): Promise<Set<string>> {
  if (!accessCache || Date.now() - accessCache.at > LIST_TTL) {
    const ids = apiBible<{ data: { id: string }[] }>('bibles').then((r) => new Set(r.data.map((b) => b.id)));
    ids.catch(() => (accessCache = null));
    accessCache = { at: Date.now(), ids };
  }
  return accessCache.ids;
}

async function youversion<T>(pathAndQuery: string): Promise<T> {
  if (!YV_KEY) throw new HttpError(503, 'Falta la clave de YouVersion.');
  const res = await fetch(`${YV_API}/${pathAndQuery}`, { headers: { 'X-YVP-App-Key': YV_KEY, Accept: 'application/json' } });
  if (res.status === 401) throw new HttpError(503, 'La clave de YouVersion no es válida.');
  if (res.status === 403) throw new HttpError(403, 'Tu app de YouVersion no tiene la licencia de esta versión.');
  if (res.status === 404) throw new HttpError(404, 'Este capítulo no está en esta versión.');
  if (!res.ok) throw new HttpError(502, `YouVersion respondió ${res.status}.`);
  return (await res.json()) as T;
}

let yvCache: { at: number; ids: Promise<Set<number>> } | null = null;

/** Ids de YouVersion de las Biblias en español e inglés cuya licencia aceptó la app. */
function yvAccessible(): Promise<Set<number>> {
  if (!yvCache || Date.now() - yvCache.at > LIST_TTL) {
    // Con varios idiomas a la vez solo devuelve los del primero que tenga Biblias: se pide cada uno por separado.
    const ids = Promise.all(
      ['es', 'en'].map((lang) =>
        youversion<{ data: { id: number }[] }>(`bibles?language_ranges[]=${lang}&page_size=99&fields[]=id`)
          .then((r) => r.data.map((b) => b.id))
          .catch(() => [] as number[]),
      ),
    ).then((lists) => new Set(lists.flat()));
    ids.catch(() => (yvCache = null));
    yvCache = { at: Date.now(), ids };
  }
  return yvCache.ids;
}

/** De dónde se lee una versión: API.Bible si la clave la tiene, si no YouVersion; null si ninguna. */
async function sourceOf(v: Licensed): Promise<{ apiBible: string } | { yv: number } | null> {
  const [api, yv] = await Promise.all([
    KEY ? accessible().catch(() => new Set<string>()) : new Set<string>(),
    YV_KEY ? yvAccessible() : new Set<number>(),
  ]);
  if (v.bibleId && api.has(v.bibleId)) return { apiBible: v.bibleId };
  const yvId = v.yvIds?.find((id) => yv.has(id));
  return yvId ? { yv: yvId } : null;
}

const yvCopyright = new Map<number, Promise<string | null>>();

/** Aviso de derechos de una Biblia de YouVersion (lo pide su guía de atribución). */
function yvCopyrightOf(id: number): Promise<string | null> {
  let p = yvCopyright.get(id);
  if (!p) {
    p = youversion<{ copyright?: string; promotional_content?: string }>(`bibles/${id}`)
      .then((b) => (b.copyright || b.promotional_content || '').replace(/<[^>]+>/g, '').trim() || null)
      .catch(() => null);
    yvCopyright.set(id, p);
  }
  return p;
}

function json(body: unknown, status = 200, cache?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cache) headers['Cache-Control'] = cache;
  return new Response(JSON.stringify(body), { status, headers });
}

type ChapterResponse = {
  data: { content: ApiNode[]; copyright?: string };
  meta?: { fumsToken?: string };
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  try {
    if (query.get('versiones')) {
      const sources = await Promise.all(LICENSED.map((v) => sourceOf(v).catch(() => null)));
      const versions = LICENSED.filter((_, i) => sources[i]).map(({ id, abbr, name, credit, link }) => ({
        id,
        abbr,
        name,
        credit,
        link,
        licensed: true,
      }));
      return json({ versions }, 200, 'public, s-maxage=21600, stale-while-revalidate=86400');
    }
    const version = licensedById(query.get('v') ?? '');
    const book = (query.get('book') ?? '').toLowerCase();
    const chapter = Number(query.get('chapter'));
    if (!version) return json({ error: 'Versión desconocida.' }, 400);
    if (!/^[1-3]?[a-z]{2,3}$/.test(book) || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
      return json({ error: 'Falta el libro o el capítulo.' }, 400);
    }
    const source = await sourceOf(version);
    if (!source) throw new HttpError(403, 'Esta versión no está disponible.');
    // API.Bible permite guardar capítulos sueltos (menos de 500 versículos seguidos) hasta 14 días: un día en el CDN.
    const cache = 'public, s-maxage=86400, stale-while-revalidate=3600';
    if ('yv' in source) {
      const [res, copyright] = await Promise.all([
        youversion<{ content: string }>(
          `bibles/${source.yv}/passages/${book.toUpperCase()}.${chapter}?format=html&include_headings=false&include_notes=false`,
        ),
        yvCopyrightOf(source.yv),
      ]);
      const verses = chapterVersesHtml(res.content);
      if (!verses.length) throw new HttpError(404, 'Este capítulo no está en esta versión.');
      return json({ verses, copyright: copyright ?? version.credit, fums: null }, 200, cache);
    }
    const params = new URLSearchParams({
      'content-type': 'json',
      'include-notes': 'false',
      'include-titles': 'false',
      'include-chapter-numbers': 'false',
      'include-verse-numbers': 'true',
      'include-verse-spans': 'false',
      'fums-version': '3',
    });
    const res = await apiBible<ChapterResponse>(
      `bibles/${source.apiBible}/chapters/${book.toUpperCase()}.${chapter}?${params}`,
    );
    const verses = chapterVerses(res.data.content);
    if (!verses.length) throw new HttpError(404, 'Este capítulo no está en esta versión.');
    return json(
      { verses, copyright: res.data.copyright?.trim() || version.credit, fums: res.meta?.fumsToken ?? null },
      200,
      cache,
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : 'Error inesperado' }, status);
  }
}
