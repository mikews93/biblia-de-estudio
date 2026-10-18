// Función de Vercel: genera un estudio de un capítulo o versículo y responde preguntas sobre él.
// Solo usa las fuentes de la app (RV1909, griego de STEPBible y referencias de OpenBible.info),
// que se pasan a Claude como documentos con citas activadas. La respuesta se envía como NDJSON:
//   {"type":"text","text":"…"}  fragmento de texto en markdown; las citas llegan como ⟦n⟧
//   {"type":"source","n":1,"label":"Juan 3:16","ref":"jhn.3.16"}  fuente de la cita n
//   {"type":"done"} | {"type":"error","message":"…"}

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describeMorph } from '../src/lib/morph';
import { formatRef, parseRef } from '../src/lib/refs';

const MODEL = process.env.ESTUDIO_MODEL ?? 'claude-opus-5-5';
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');
const MAX_TURNS = 12;
const MAX_QUESTION = 600;

type Book = { id: string; name: string; chapters: number; interlinear: boolean };
type Verse = [number, string];
type Word = [string, string, string, string, string, string, string, string];
type Turn = { role: 'user' | 'assistant'; text: string };
type Body = { book?: string; chapter?: number; verse?: number; messages?: Turn[] };
// Cada bloque de un documento lleva su etiqueta y, si se puede abrir en la app, su referencia.
type BlockMeta = { label: string; ref?: string };

const SYSTEM = `Eres el asistente de estudio de una app bíblica gratuita en español. Ayudas a entender el texto; no sustituyes la lectura de la persona ni predicas por ella.

Fuentes: en cada conversación recibes documentos de la app: el capítulo en la Reina-Valera 1909, el griego del Nuevo Testamento con su análisis gramatical (STEPBible, Tyndale House) y referencias cruzadas votadas por lectores (OpenBible.info).

Reglas:
- Basa lo que afirmes en esos documentos y cítalos cada vez que los uses.
- Si algo no está en los documentos (autoría, fechas, historia, costumbres, opiniones de comentaristas), dilo así: «esto no está en las fuentes de la app». Solo si de verdad ayuda, añade contexto general ampliamente aceptado, breve y marcado como «contexto general», sin inventar datos, fechas ni citas de autores.
- Para el griego usa la glosa, el lema y la gramática del documento; no inventes significados ni etimologías.
- Cuando hay interpretaciones distintas dentro del cristianismo histórico (católica, ortodoxa, protestante y evangélica), dilo con respeto y sin tomar partido.
- No uses ni presentes como interpretación cristiana las enseñanzas de grupos que niegan doctrinas centrales del cristianismo histórico, como la Trinidad o la divinidad de Cristo (por ejemplo, Testigos de Jehová o mormones).
- Escribe en español claro y cálido para alguien sin formación teológica: párrafos cortos, títulos con "## ", listas con "- " y **negritas** solo para palabras clave. Sin tablas.
- En las preguntas de seguimiento responde a lo que se pregunta, con la misma regla de fuentes. Si la pregunta no tiene que ver con la Biblia o con el estudio, redirígela con amabilidad.`;

const client = new Anthropic();

async function load<T>(rel: string, fallback?: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, rel), 'utf8')) as T;
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

function doc(title: string, blocks: { text: string; meta: BlockMeta }[]) {
  const param: Anthropic.Beta.BetaRequestDocumentBlock = {
    type: 'document',
    title,
    citations: { enabled: true },
    source: { type: 'content', content: blocks.map((b) => ({ type: 'text' as const, text: b.text })) },
  };
  return { param, metas: blocks.map((b) => b.meta) };
}

/** Texto de una referencia (solo el tramo dentro del primer capítulo, para no cargar de más). */
async function refText(ref: string): Promise<string> {
  const { start, end } = parseRef(ref);
  const verses = await load<Verse[]>(`text/rv1909/${start.book}/${start.chapter}.json`, []);
  const last = end.book === start.book && end.chapter === start.chapter ? end.verse : start.verse;
  return verses
    .filter(([n]) => n >= start.verse && n <= last)
    .map(([, t]) => t)
    .join(' ');
}

async function buildSources(book: Book, chapter: number, verse: number | undefined, books: Book[]) {
  const [verses, interlinear, xrefs] = await Promise.all([
    load<Verse[]>(`text/rv1909/${book.id}/${chapter}.json`),
    load<Record<string, Word[]>>(`interlinear/${book.id}/${chapter}.json`, {}),
    load<Record<string, [string, number][]>>(`xrefs/${book.id}/${chapter}.json`, {}),
  ]);
  if (verse && !verses.some(([n]) => n === verse)) throw new Error('Ese versículo no existe');

  const docs = [
    doc(
      `${book.name} ${chapter} · Reina-Valera 1909`,
      verses.map(([n, t]) => ({
        text: `${chapter}:${n} ${t}`,
        meta: { label: `${book.name} ${chapter}:${n}`, ref: `${book.id}.${chapter}.${n}` },
      })),
    ),
  ];

  // Griego: con todo el análisis para un versículo; solo palabra y glosa para un capítulo entero.
  const greekVerses = verse ? [verse] : verses.map(([n]) => n);
  const greek = greekVerses
    .filter((n) => interlinear[n]?.length)
    .map((n) => ({
      text:
        `${chapter}:${n} ` +
        interlinear[n]
          .map(([g, tr, es, , lemma, lemmaGloss, strong, morph]) =>
            verse
              ? `${g} (${tr}) «${es}»: lema ${lemma} «${lemmaGloss}», ${strong}, ${describeMorph(morph)}`
              : `${g} «${es}»`,
          )
          .join(verse ? '; ' : ' '),
      meta: { label: `Griego de ${book.name} ${chapter}:${n}`, ref: `${book.id}.${chapter}.${n}` },
    }));
  if (greek.length) docs.push(doc(`${book.name} ${chapter} · Griego (STEPBible TAGNT)`, greek));

  // Referencias cruzadas: todas las del versículo, o las dos más votadas de cada versículo del capítulo.
  const refs = verse
    ? (xrefs[verse] ?? []).map(([r]) => r)
    : Object.values(xrefs).flatMap((list) => list.slice(0, 2).map(([r]) => r)).slice(0, 40);
  const refBlocks = await Promise.all(
    refs.map(async (r) => {
      const label = formatRef(r, books);
      return { text: `${label}: ${await refText(r)}`, meta: { label, ref: r } };
    }),
  );
  if (refBlocks.length) {
    const title = verse
      ? `Referencias cruzadas de ${book.name} ${chapter}:${verse} (OpenBible.info)`
      : `Referencias cruzadas de ${book.name} ${chapter} (OpenBible.info)`;
    docs.push(doc(title, refBlocks));
  }
  return docs;
}

function studyTask(book: Book, chapter: number, verse: number | undefined, hasGreek: boolean) {
  const target = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;
  const sections = verse
    ? [
        '## Qué dice: el versículo explicado dentro de su contexto en el capítulo.',
        hasGreek && '## Palabras clave: 2 a 4 palabras del griego que ayudan a entenderlo.',
        '## Pasajes relacionados: 3 o 4 referencias y lo que cada una aporta.',
        '## Para reflexionar: 2 o 3 preguntas personales o para un grupo.',
      ]
    : [
        '## Resumen: de qué trata el capítulo en pocas frases.',
        '## Cómo avanza: las partes del capítulo por grupos de versículos.',
        hasGreek && '## Palabras clave: 3 a 5 palabras del griego importantes en el capítulo.',
        '## Pasajes relacionados: 3 o 4 referencias y lo que aportan.',
        '## Para reflexionar: 2 o 3 preguntas personales o para un grupo.',
      ];
  return `Prepara un estudio de ${target} con estas secciones:\n${sections.filter(Boolean).join('\n')}\n\nExtensión: ${
    verse ? '350 a 500' : '500 a 700'
  } palabras. Empieza directamente por la primera sección.`;
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return badRequest('JSON no válido');
  }
  const books = await load<Book[]>('books.json');
  const book = books.find((b) => b.id === body.book);
  const chapter = Number(body.chapter);
  const verse = body.verse === undefined ? undefined : Number(body.verse);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return badRequest('Libro o capítulo no válido');
  }
  if (verse !== undefined && (!Number.isInteger(verse) || verse < 1)) return badRequest('Versículo no válido');

  const turns = body.messages ?? [];
  if (
    !Array.isArray(turns) ||
    turns.length > MAX_TURNS ||
    turns.some((t, i) => t?.role !== (i % 2 === 0 ? 'assistant' : 'user') || typeof t.text !== 'string') ||
    (turns.length > 0 && turns[turns.length - 1].role !== 'user') ||
    turns.some((t) => t.role === 'user' && t.text.length > MAX_QUESTION)
  ) {
    return badRequest('Conversación no válida');
  }

  let docs;
  try {
    docs = await buildSources(book, chapter, verse, books);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'No se pudieron cargar las fuentes', 404);
  }

  // El primer mensaje (documentos + encargo) es siempre igual para el mismo pasaje: queda en caché
  // y las preguntas de seguimiento solo pagan lo nuevo.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: [
        ...docs.map((d) => d.param),
        { type: 'text', text: studyTask(book, chapter, verse, docs.length > 1 && book.interlinear) },
      ],
    },
    ...turns.map((t) => ({ role: t.role, content: t.text })),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      const sources = new Map<string, number>();
      const pending = new Map<number, Set<number>>();
      try {
        const response = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 16000,
            system: SYSTEM,
            messages,
            cache_control: { type: 'ephemeral' },
            output_config: { effort: 'medium' },
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          },
          { signal: request.signal },
        );
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send({ type: 'text', text: event.delta.text });
          } else if (event.type === 'content_block_delta' && event.delta.type === 'citations_delta') {
            const c = event.delta.citation;
            if (c.type !== 'content_block_location') continue;
            const metas = docs[c.document_index]?.metas ?? [];
            for (let i = c.start_block_index; i < c.end_block_index; i++) {
              const meta = metas[i];
              if (!meta) continue;
              let n = sources.get(meta.label);
              if (n === undefined) {
                n = sources.size + 1;
                sources.set(meta.label, n);
                send({ type: 'source', n, ...meta });
              }
              if (!pending.has(event.index)) pending.set(event.index, new Set());
              pending.get(event.index)!.add(n);
            }
          } else if (event.type === 'content_block_stop' && pending.has(event.index)) {
            // Las marcas van al final del fragmento citado, como notas al pie.
            send({ type: 'text', text: [...pending.get(event.index)!].map((n) => `⟦${n}⟧`).join('') });
            pending.delete(event.index);
          }
        }
        const final = await response.finalMessage();
        if (final.stop_reason === 'refusal') {
          send({ type: 'error', message: 'No puedo ayudar con esta pregunta. Prueba a formularla de otra manera.' });
        } else {
          send({ type: 'done' });
        }
      } catch (err) {
        console.error('estudiar', err);
        const message =
          err instanceof Anthropic.RateLimitError
            ? 'Hay muchas consultas ahora mismo. Inténtalo en un momento.'
            : err instanceof Anthropic.AuthenticationError
              ? 'Falta configurar la clave de la IA en el servidor.'
              : 'No se pudo generar el estudio. Inténtalo de nuevo.';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
