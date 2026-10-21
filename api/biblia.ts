// Función de Vercel: versiones con derechos (NBLA, LBLA, NVI, NTV, NIV) a través de API.Bible y YouVersion.
// Las claves (API_BIBLE_KEY, YVP_APP_KEY) solo viven aquí. Condiciones de las licencias en src/lib/licenciadas.ts.
//   GET /api/biblia?versiones=1               versiones a las que alguna clave tiene acceso
//   GET /api/biblia?v=nbla&book=jhn&chapter=3 versículos del capítulo, aviso de derechos y ficha FUMS (API.Bible)

import { LICENSED, chapterHtml, chapterVerses, licensedById, type ApiNode, type Licensed } from '../src/lib/licenciadas';

const API = 'https://rest.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY;
const YV_API = 'https://api.youversion.com/v1';
const YV_KEY = process.env.YVP_APP_KEY;
const LIST_TTL = 6 * 60 * 60 * 1000;
const YV_LIST_TTL = 30 * 60 * 1000;

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

type YvBible = { id: number; abbreviation?: string; localized_abbreviation?: string; title?: string };
let yvCache: { at: number; bibles: Promise<YvBible[]> } | null = null;
/** Lo que respondió YouVersion la última vez, para ?diagnostico=1 (sin claves). */
const yvLog: string[] = [];

/** Biblias en español e inglés cuya licencia aceptó la app de YouVersion. */
function yvAccessible(fresh = false): Promise<YvBible[]> {
  // Las licencias se aceptan en el portal en cualquier momento: la lista se renueva cada media hora.
  if (fresh || !yvCache || Date.now() - yvCache.at > YV_LIST_TTL) {
    yvLog.length = 0;
    // Con varios idiomas a la vez solo devuelve los del primero que tenga Biblias: se pide cada uno por separado.
    // El código puede ir en ISO 639-1 (es) o 639-3 (spa): se prueban los dos.
    const bibles = Promise.all(
      ['es', 'spa', 'en', 'eng'].map((lang) =>
        youversion<{ data: YvBible[] }>(`bibles?language_ranges[]=${lang}&page_size=99`)
          .then((r) => {
            yvLog.push(`${lang}: ${r.data.length} Biblias`);
            return r.data;
          })
          .catch((err) => {
            yvLog.push(`${lang}: ${err instanceof Error ? err.message : err}`);
            console.error(`YouVersion ${lang}:`, err);
            return null;
          }),
      ),
    ).then((lists) => {
      if (lists.every((l) => l === null)) yvCache = null; // sin respuesta: se vuelve a preguntar
      const seen = new Map<number, YvBible>();
      for (const b of lists.flat()) if (b) seen.set(b.id, b);
      return [...seen.values()];
    });
    yvCache = { at: Date.now(), bibles };
  }
  return yvCache.bibles;
}

/** Id de YouVersion de una versión: por su id conocido o, si no, por su abreviatura. */
function yvIdOf(v: Licensed, bibles: YvBible[]): number | undefined {
  const known = v.yvIds?.find((id) => bibles.some((b) => b.id === id));
  if (known) return known;
  const abbr = v.abbr.toUpperCase();
  return bibles.find((b) => [b.abbreviation, b.localized_abbreviation].some((a) => a?.toUpperCase() === abbr))?.id;
}

/** De dónde se lee una versión: API.Bible si la clave la tiene, si no YouVersion; null si ninguna. */
async function sourceOf(v: Licensed): Promise<{ apiBible: string } | { yv: number } | null> {
  const [api, yv] = await Promise.all([
    KEY ? accessible().catch(() => new Set<string>()) : new Set<string>(),
    YV_KEY ? yvAccessible() : ([] as YvBible[]),
  ]);
  if (v.bibleId && api.has(v.bibleId)) return { apiBible: v.bibleId };
  const yvId = yvIdOf(v, yv);
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
    if (query.get('diagnostico')) {
      // Qué ve cada clave, sin mostrar las claves: para revisar desde el navegador por qué falta una versión.
      const [api, yv] = await Promise.all([
        KEY
          ? accessible()
              .then((ids) => LICENSED.filter((v) => v.bibleId && ids.has(v.bibleId)).map((v) => v.abbr))
              .catch((e) => String(e))
          : 'sin API_BIBLE_KEY',
        YV_KEY ? yvAccessible(true) : ([] as YvBible[]),
      ]);
      // ?muestra=nvi: el comienzo del HTML de Juan 3 tal como llega, para revisar cómo vienen las notas al pie
      const sample = licensedById(query.get('muestra') ?? '');
      const yvId = sample && YV_KEY ? yvIdOf(sample, yv) : undefined;
      const muestra = yvId
        ? await youversion<{ content: string }>(`bibles/${yvId}/passages/JHN.3?format=html&include_headings=false&include_notes=true`)
            .then((r) => r.content.slice(0, 1500))
            .catch((e) => String(e))
        : undefined;
      return json({
        muestra,
        apiBible: api,
        youversion: YV_KEY ? { respuestas: yvLog, biblias: yv.map((b) => `${b.id} ${b.abbreviation ?? ''} ${b.title ?? ''}`) } : 'sin YVP_APP_KEY',
      });
    }
    if (query.get('versiones')) {
      const sources = await Promise.all(LICENSED.map((v) => sourceOf(v).catch(() => null)));
      const versions = LICENSED.flatMap(({ id, abbr, name, credit, links }, i) => {
        const source = sources[i];
        // guardable: por API.Bible, los últimos capítulos leídos se pueden guardar unos días en el dispositivo
        return source ? [{ id, abbr, name, credit, links, licensed: true, guardable: 'apiBible' in source }] : [];
      });
      return json({ versions }, 200, 'public, s-maxage=3600, stale-while-revalidate=86400');
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
          // Las notas al pie van con el texto: Bíblica pide que se puedan leer.
          `bibles/${source.yv}/passages/${book.toUpperCase()}.${chapter}?format=html&include_headings=false&include_notes=true`,
        ),
        yvCopyrightOf(source.yv),
      ]);
      const { verses, notes } = chapterHtml(res.content);
      if (!verses.length) throw new HttpError(404, 'Este capítulo no está en esta versión.');
      return json({ verses, notes, copyright: copyright ?? version.credit, fums: null }, 200, cache);
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
      {
        verses,
        copyright: res.data.copyright?.trim() || version.credit,
        fums: res.meta?.fumsToken ?? null,
        guardable: true, // API.Bible deja guardar capítulos sueltos unos días en el dispositivo
      },
      200,
      cache,
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : 'Error inesperado' }, status);
  }
}
