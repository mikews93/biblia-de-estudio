// Videos de YouTube que la persona comparte al preparar un mensaje: el título y el canal salen del oEmbed público de
// YouTube; el contenido, de la transcripción que la persona pegó (src/lib/videos.ts). Sin transcripción, la IA sabe
// que no puede ver el video y no inventa lo que dice.

import { MAX_TRANSCRIPCION, MAX_VIDEOS, type Video, idDeYoutube, parrafosDeTranscripcion } from '../src/lib/videos';
import { trazarIA } from './_quilate';

type Meta = { label: string; url: string; nota?: string };

export function validVideos(v: unknown): v is Video[] {
  return (
    Array.isArray(v) &&
    v.length <= MAX_VIDEOS &&
    v.every(
      (x) =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as Video).url === 'string' &&
        (x as Video).url.length <= 300 &&
        !!idDeYoutube((x as Video).url) &&
        ((x as Video).transcripcion === undefined || (typeof (x as Video).transcripcion === 'string' && (x as Video).transcripcion!.length <= MAX_TRANSCRIPCION)),
    )
  );
}

/** Título y canal del video, del oEmbed público de YouTube; si no responde a tiempo, sin ellos. */
export async function datosVideo(url: string): Promise<{ titulo?: string; canal?: string }> {
  const base = process.env.YOUTUBE_OEMBED_URL ?? 'https://www.youtube.com/oembed';
  try {
    const res = await fetch(`${base}?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${idDeYoutube(url)}`)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return {};
    const j = (await res.json()) as { title?: unknown; author_name?: unknown };
    return { titulo: typeof j.title === 'string' ? j.title : undefined, canal: typeof j.author_name === 'string' ? j.author_name : undefined };
  } catch {
    return {};
  }
}

/** Los documentos con la transcripción de cada video (para citarlos) y lo que se le dice a la IA de cada uno. */
export async function videosParaIA(videos: Video[]) {
  const datos = await Promise.all(videos.map((v) => datosVideo(v.url)));
  const docs: { title: string; blocks: { text: string; meta: Meta }[] }[] = [];
  const lineas: string[] = [];
  videos.forEach((v, i) => {
    const { titulo, canal } = datos[i];
    const nombre = titulo ? `«${titulo}»${canal ? ` (${canal})` : ''}` : v.url;
    const parrafos = parrafosDeTranscripcion(v.transcripcion ?? '');
    if (parrafos.length) {
      const meta: Meta = { label: `Video: ${titulo ? `«${titulo}»` : 'YouTube'}`, url: `https://www.youtube.com/watch?v=${idDeYoutube(v.url)}`, ...(canal && { nota: canal }) };
      docs.push({ title: `Transcripción del video ${nombre}, que compartí (copiada de YouTube; puede tener errores del subtitulado automático)`, blocks: parrafos.map((text) => ({ text, meta })) });
      lineas.push(`- ${nombre}: su transcripción está en los documentos. Úsala como una fuente más y cítala; no nombres al predicador en el texto.`);
    } else {
      lineas.push(`- ${nombre}: no tienes su transcripción, así que no sabes qué dice. No lo resumas ni le atribuyas ideas; si hace falta, di en «Lo que entiendo» que pegue su transcripción para usarlo.`);
    }
  });
  const texto = lineas.length ? `\n\nCompartí ${videos.length === 1 ? 'este video' : 'estos videos'} de YouTube:\n${lineas.join('\n')}` : '';
  return { docs, texto };
}

// Que la app vea el video sola (Mike eligió «Las dos», 2026-11-07): Gemini de Google acepta enlaces de videos
// públicos de YouTube y devuelve lo que se dice. Solo con la clave GEMINI_API_KEY en Vercel; sin ella, la persona
// pega la transcripción.
const PEDIDO_GEMINI = `Transcribe textualmente lo que se dice en este video, en su idioma original y en párrafos.
Sin marcas de tiempo, sin títulos y sin comentarios tuyos: solo lo que se dice. Si se lee un pasaje de la Biblia, transcríbelo como se oye.
Si el video no tiene voz, responde solo: SIN VOZ`;

export const geminiActivo = () => !!process.env.GEMINI_API_KEY;

export async function transcribirConGemini(url: string): Promise<string> {
  const base = process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com';
  const modelo = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const enlace = `https://www.youtube.com/watch?v=${idDeYoutube(url)}`;
  const { texto } = await trazarIA('Transcribir video', { fn: 'videos', model: modelo, input: enlace }, () => pedirTranscripcion(base, modelo, enlace), (r) => ({
    salida: r.texto,
    entrada: r.uso?.promptTokenCount,
    salidaTokens: r.uso?.candidatesTokenCount,
    cacheLeido: r.uso?.cachedContentTokenCount,
  }));
  return texto === 'SIN VOZ' ? '' : texto.slice(0, MAX_TRANSCRIPCION);
}

type UsoGemini = { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number };

async function pedirTranscripcion(base: string, modelo: string, enlace: string): Promise<{ texto: string; uso?: UsoGemini }> {
  const res = await fetch(`${base}/v1beta/models/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      contents: [{ parts: [{ file_data: { file_uri: enlace } }, { text: PEDIDO_GEMINI }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 32768 },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  const json = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
    usageMetadata?: UsoGemini;
  } | null;
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${json?.error?.message ?? 'sin detalle'}`);
  return { texto: (json?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim(), uso: json?.usageMetadata };
}
