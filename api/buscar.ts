// Función de Vercel: búsqueda por idea («versículos sobre la ansiedad»).
// 1. Claude propone pasajes que tratan la idea.
// 2. El servidor comprueba que cada referencia existe y carga su texto real de la RV1909.
// 3. Claude lee esos textos y se queda solo con los que de verdad hablan de la idea, explicando por qué con el texto delante.
// Respuesta: { results: [{ ref, label, text, reason }], note? } | { error }

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { formatRef, parseRef } from '../src/lib/refs';

const MODEL = process.env.ESTUDIO_MODEL ?? 'claude-opus-5-5';
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');
const MAX_QUERY = 200;
const MAX_CANDIDATES = 24;
const MAX_RESULTS = 12;
const MAX_VERSES = 6; // un pasaje propuesto no puede pasar de seis versículos

type Book = { id: string; name: string; chapters: number };
type Verse = [number, string];
type Result = { ref: string; label: string; text: string; reason: string };

const RULES = `Trabajas para el buscador de una app bíblica gratuita en español (Reina-Valera 1909).
- Busca pasajes por lo que dicen, no solo por palabras sueltas: una idea puede aparecer sin la palabra exacta.
- No inventes referencias. Prefiere pasajes conocidos y claros sobre el tema.
- Cuando el tema toca doctrinas en las que las tradiciones cristianas históricas (católica, ortodoxa, protestante y evangélica) difieren, incluye pasajes que usan unas y otras, sin tomar partido.
- No uses interpretaciones de grupos que niegan doctrinas centrales del cristianismo histórico (por ejemplo, Testigos de Jehová o mormones).
- Si la búsqueda no tiene que ver con la Biblia, devuelve una lista vacía.`;

const client = new Anthropic();

async function load<T>(rel: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, rel), 'utf8')) as T;
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

async function ask<T>(prompt: string, schema: Record<string, unknown>): Promise<T> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: RULES,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  if (response.stop_reason === 'refusal') throw new Error('refusal');
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return JSON.parse(text) as T;
}

/** Texto real de la RV1909 de una referencia, o null si no existe o es demasiado larga. */
async function verify(ref: string, books: Book[]): Promise<{ ref: string; label: string; text: string } | null> {
  if (!/^[0-9a-z]{3}\.\d+\.\d+(-[0-9a-z]{3}\.\d+\.\d+)?$/.test(ref)) return null;
  const { start, end } = parseRef(ref);
  const book = books.find((b) => b.id === start.book);
  if (!book || start.chapter < 1 || start.chapter > book.chapters) return null;
  // Solo tramos dentro de un mismo capítulo
  if (end.book !== start.book || end.chapter !== start.chapter || end.verse < start.verse) return null;
  if (end.verse - start.verse >= MAX_VERSES) return null;
  const verses = await load<Verse[]>(`text/rv1909/${start.book}/${start.chapter}.json`, []);
  const picked = verses.filter(([n]) => n >= start.verse && n <= end.verse);
  if (!picked.length || picked[0][0] !== start.verse || picked[picked.length - 1][0] !== end.verse) return null;
  const clean = end.verse === start.verse ? `${start.book}.${start.chapter}.${start.verse}` : ref;
  return { ref: clean, label: formatRef(clean, books), text: picked.map(([, t]) => t).join(' ') };
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let query: string;
  try {
    query = String(((await request.json()) as { query?: unknown }).query ?? '').trim();
  } catch {
    return badRequest('JSON no válido');
  }
  if (query.length < 3) return badRequest('Escribe un poco más lo que buscas');
  if (query.length > MAX_QUERY) return badRequest('La búsqueda es demasiado larga');

  const books = await load<Book[]>('books.json');
  const ids = books.map((b) => `${b.id}=${b.name}`).join(', ');

  try {
    // 1. Propuesta
    const proposal = await ask<{ candidates: string[] }>(
      `Búsqueda de la persona: «${query}»

Propón hasta ${MAX_CANDIDATES} pasajes de la Biblia que traten esa idea, del más al menos claro. Escribe cada uno como libro.capítulo.versículo con estos códigos de libro: ${ids}. Para un tramo corto del mismo capítulo usa libro.c.v-libro.c.v (máximo ${MAX_VERSES} versículos). Ejemplos: php.4.6 o mat.6.33-mat.6.34.`,
      {
        type: 'object',
        properties: { candidates: { type: 'array', items: { type: 'string' } } },
        required: ['candidates'],
        additionalProperties: false,
      },
    );

    // 2. Comprobación contra el texto real
    const unique = [...new Set(proposal.candidates)].slice(0, MAX_CANDIDATES);
    const found = (await Promise.all(unique.map((r) => verify(r, books)))).filter(
      (x): x is NonNullable<typeof x> => x !== null,
    );
    if (!found.length) return Response.json({ results: [] });

    // 3. Lectura del texto: solo quedan los pasajes que de verdad hablan de la idea
    const review = await ask<{ keep: { n: number; reason: string }[]; note: string }>(
      `Búsqueda de la persona: «${query}»

Estos son los textos reales de la Reina-Valera 1909:
${found.map((f, i) => `[${i + 1}] ${f.label}: ${f.text}`).join('\n')}

Quédate solo con los que, leídos tal como están, hablan de verdad de esa idea (máximo ${MAX_RESULTS}), ordenados del más al menos claro. Para cada uno escribe en "reason" una frase breve en español que explique qué dice el texto sobre la idea, basada solo en sus palabras. En "note" escribe una frase si las tradiciones cristianas entienden el tema de maneras distintas, sin tomar partido; si no, deja "note" vacío.`,
      {
        type: 'object',
        properties: {
          keep: {
            type: 'array',
            items: {
              type: 'object',
              properties: { n: { type: 'integer' }, reason: { type: 'string' } },
              required: ['n', 'reason'],
              additionalProperties: false,
            },
          },
          note: { type: 'string' },
        },
        required: ['keep', 'note'],
        additionalProperties: false,
      },
    );

    const seen = new Set<number>();
    const results: Result[] = review.keep
      .filter(({ n }) => n >= 1 && n <= found.length && !seen.has(n) && seen.add(n))
      .slice(0, MAX_RESULTS)
      .map(({ n, reason }) => ({ ...found[n - 1], reason }));
    return Response.json({ results, note: review.note || undefined }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('buscar', err);
    if (err instanceof Error && err.message === 'refusal') {
      return badRequest('No puedo ayudar con esta búsqueda. Prueba a formularla de otra manera.', 422);
    }
    const message =
      err instanceof Anthropic.RateLimitError
        ? 'Hay muchas consultas ahora mismo. Inténtalo en un momento.'
        : err instanceof Anthropic.AuthenticationError
          ? 'Falta configurar la clave de la IA en el servidor.'
          : 'No se pudo hacer la búsqueda. Inténtalo de nuevo.';
    return badRequest(message, 502);
  }
}
