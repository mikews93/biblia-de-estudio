// Función de Vercel: versiones con derechos (NBLA, LBLA, NTV, NIV) a través de API.Bible.
// La clave (API_BIBLE_KEY) solo vive aquí. Condiciones de la licencia en src/lib/licenciadas.ts.
//   GET /api/biblia?versiones=1               versiones a las que la clave tiene acceso
//   GET /api/biblia?v=nbla&book=jhn&chapter=3 versículos del capítulo, aviso de derechos y ficha FUMS

import { LICENSED, chapterVerses, licensedById, type ApiNode } from '../src/lib/licenciadas';

const API = 'https://rest.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY;
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
      const ids = KEY ? await accessible().catch(() => new Set<string>()) : new Set<string>();
      const versions = LICENSED.filter((v) => ids.has(v.bibleId)).map(({ id, abbr, name, credit, link }) => ({
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
      `bibles/${version.bibleId}/chapters/${book.toUpperCase()}.${chapter}?${params}`,
    );
    const verses = chapterVerses(res.data.content);
    if (!verses.length) throw new HttpError(404, 'Este capítulo no está en esta versión.');
    // API.Bible permite guardar capítulos sueltos (menos de 500 versículos seguidos) hasta 14 días: un día en el CDN.
    return json(
      { verses, copyright: res.data.copyright?.trim() || version.credit, fums: res.meta?.fumsToken ?? null },
      200,
      'public, s-maxage=86400, stale-while-revalidate=3600',
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : 'Error inesperado' }, status);
  }
}
