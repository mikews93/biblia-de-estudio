// Función de Vercel: audio dramatizado en español de Bible Brain (Faith Comes By Hearing).
// La clave (BIBLE_BRAIN_KEY) solo vive aquí; la app recibe las URL firmadas, que caducan en un día.
// Licencia de la API: gratis mientras la app sea gratis para quien la usa.
//   GET /api/audio?versiones=1                 versiones dramatizadas en español disponibles
//   GET /api/audio?book=jhn&chapter=3[&bible=] pistas del capítulo, tiempos por versículo y créditos

const API = 'https://4.dbt.io/api';
const KEY = process.env.BIBLE_BRAIN_KEY;
// Orden de preferencia de versiones (ids de Bible Brain separados por comas); si no hay, se elige por nombre.
const PREFERRED = (process.env.BIBLE_BRAIN_BIBLES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const NAME_PREFERENCE = [/1960/, /Nueva Versi[oó]n Internacional|NVI/i, /Reina/i, /Lenguaje Actual/i, /Biblia de las Am[eé]ricas/i];
// Regla del proyecto: nada de traducciones de grupos que niegan doctrinas centrales del cristianismo.
const BLOCKED = /Nuevo Mundo|Testigos de Jehov|mormón|Santos de los [UÚ]ltimos/i;
const LIST_TTL = 12 * 60 * 60 * 1000;

const NT_BOOKS = new Set([
  'mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co', 'gal', 'eph', 'php', 'col', '1th', '2th',
  '1ti', '2ti', 'tit', 'phm', 'heb', 'jas', '1pe', '2pe', '1jn', '2jn', '3jn', 'jud', 'rev',
]);

type Fileset = { id: string; type: string; size: string; codec?: string; container?: string };
type BibleRaw = { abbr: string; name?: string; vname?: string; filesets?: Record<string, Fileset[]> };
export type AudioVersion = { id: string; name: string; nt?: string; ot?: string };
type Track = { url: string; duration: number; verseStart: number };

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function dbp<T>(pathAndQuery: string): Promise<T> {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetch(`${API}/${pathAndQuery}${sep}v=4&key=${KEY}`, { headers: { Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new HttpError(503, 'La clave de Bible Brain no es válida.');
  if (res.status === 404) throw new HttpError(404, 'Este capítulo no tiene audio en esta versión.');
  if (!res.ok) throw new HttpError(502, `Bible Brain respondió ${res.status}.`);
  return (await res.json()) as T;
}

/** Mejor fileset dramatizado en mp3 para un testamento: completo antes que parcial, mp3 antes que opus. */
function pick(filesets: Fileset[], testament: 'NT' | 'OT'): string | undefined {
  const candidates = filesets.filter(
    (f) => f.type === 'audio_drama' && !/opus/i.test(f.id) && (f.size === 'C' || f.size.includes(testament)),
  );
  const score = (f: Fileset) =>
    (f.size === testament || f.size === 'C' ? 0 : 1) + (f.codec && f.codec !== 'mp3' ? 2 : 0) + (/DA$/.test(f.id) ? 0 : 1);
  return candidates.sort((a, b) => score(a) - score(b))[0]?.id;
}

let versionsCache: { at: number; list: Promise<AudioVersion[]> } | null = null;

function rank(v: AudioVersion): number {
  const byId = PREFERRED.indexOf(v.id);
  if (byId >= 0) return byId;
  const byName = NAME_PREFERENCE.findIndex((re) => re.test(v.name));
  return PREFERRED.length + (byName >= 0 ? byName : NAME_PREFERENCE.length);
}

async function fetchVersions(): Promise<AudioVersion[]> {
  const res = await dbp<{ data: BibleRaw[] }>('bibles?language_code=spa&media=audio_drama&limit=100');
  const list: AudioVersion[] = [];
  for (const b of res.data ?? []) {
    const name = (b.vname || b.name || b.abbr).trim();
    if (BLOCKED.test(name)) continue;
    const filesets = Object.values(b.filesets ?? {}).flat();
    const version = { id: b.abbr, name, nt: pick(filesets, 'NT'), ot: pick(filesets, 'OT') };
    if (version.nt || version.ot) list.push(version);
  }
  return list.sort((a, b) => rank(a) - rank(b));
}

function getVersions(): Promise<AudioVersion[]> {
  if (!versionsCache || Date.now() - versionsCache.at > LIST_TTL) {
    const list = fetchVersions();
    versionsCache = { at: Date.now(), list };
    list.catch(() => (versionsCache = null));
  }
  return versionsCache.list;
}

async function credit(fileset: string, versionName: string): Promise<string> {
  try {
    const raw = await dbp<{ copyright?: { copyright?: string }; data?: { copyright?: { copyright?: string } } }>(
      `bibles/filesets/${fileset}/copyright?iso=spa`,
    );
    const text = (raw.copyright ?? raw.data?.copyright)?.copyright?.replace(/\s+/g, ' ').trim();
    if (text) return `Audio: ${versionName}. ${text} · Faith Comes By Hearing (Bible Brain)`;
  } catch {
    // los créditos no deben impedir escuchar
  }
  return `Audio: ${versionName} · Faith Comes By Hearing (Bible Brain)`;
}

async function chapterAudio(book: string, chapter: number, bibleId?: string) {
  const versions = await getVersions();
  const testament = NT_BOOKS.has(book) ? 'nt' : 'ot';
  const usable = versions.filter((v) => v[testament]);
  const version = usable.find((v) => v.id === bibleId) ?? usable[0];
  if (!version) throw new HttpError(404, 'Todavía no hay audio dramatizado en español para este testamento.');
  const fileset = version[testament]!;
  const code = book.toUpperCase();

  type File = { path: string; duration?: number; verse_start?: string | number; chapter_start?: string | number };
  type Stamp = { verse_start: string | number; timestamp: number | string };
  const [files, stamps, text] = await Promise.all([
    dbp<{ data: File[] }>(`bibles/filesets/${fileset}/${code}/${chapter}`),
    dbp<{ data: Stamp[] }>(`timestamps/${fileset}/${code}/${chapter}`).catch(() => ({ data: [] as Stamp[] })),
    credit(fileset, version.name),
  ]);

  const tracks: Track[] = (files.data ?? [])
    .filter((f) => f.path && (f.chapter_start === undefined || Number(f.chapter_start) === chapter))
    .map((f) => ({ url: f.path, duration: Number(f.duration) || 0, verseStart: Number(f.verse_start) || 1 }))
    .sort((a, b) => a.verseStart - b.verseStart);
  if (!tracks.length) throw new HttpError(404, 'Este capítulo no tiene audio en esta versión.');

  // [versículo, segundo de inicio] para seguir la lectura
  const timestamps = (stamps.data ?? [])
    .map((s) => [Number(s.verse_start), Number(s.timestamp)] as [number, number])
    .filter(([v, t]) => v > 0 && Number.isFinite(t))
    .sort((a, b) => a[0] - b[0]);

  return { version: { id: version.id, name: version.name }, testament, tracks, timestamps, credit: text };
}

function json(body: unknown, status = 200, cache?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cache) headers['Cache-Control'] = cache;
  return new Response(JSON.stringify(body), { status, headers });
}

export async function GET(request: Request) {
  if (!KEY) return json({ error: 'El audio todavía no está configurado.', code: 'sin_clave' }, 503);
  const query = new URL(request.url).searchParams;
  try {
    if (query.get('versiones')) {
      const versions = await getVersions();
      return json(
        { versions: versions.map(({ id, name, nt, ot }) => ({ id, name, nt: !!nt, ot: !!ot })) },
        200,
        'public, s-maxage=43200, stale-while-revalidate=86400',
      );
    }
    const book = (query.get('book') ?? '').toLowerCase();
    const chapter = Number(query.get('chapter'));
    if (!/^[1-3]?[a-z]{2,3}$/.test(book) || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
      return json({ error: 'Falta el libro o el capítulo.' }, 400);
    }
    const audio = await chapterAudio(book, chapter, query.get('bible') ?? undefined);
    // Las URL firmadas duran un día: una hora de caché en el CDN deja margen de sobra.
    return json(audio, 200, 'public, s-maxage=3600, stale-while-revalidate=600');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : 'Error inesperado' }, status);
  }
}
