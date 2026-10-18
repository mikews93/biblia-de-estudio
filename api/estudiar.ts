// Función de Vercel: genera un estudio de un capítulo o versículo y responde preguntas sobre él.
// Con «word» (posición de una palabra hebrea o griega en el versículo) explica esa palabra: «¿Por qué esta palabra?».
// Solo usa las fuentes de la app (RV1909, hebreo y griego de STEPBible y referencias de OpenBible.info),
// que se pasan a Claude como documentos con citas activadas. La respuesta se envía como NDJSON:
//   {"type":"text","text":"…"}  fragmento de texto en markdown; las citas llegan como ⟦n⟧
//   {"type":"source","n":1,"label":"Juan 3:16","ref":"jhn.3.16"}  fuente de la cita n
//   {"type":"done"} | {"type":"error","message":"…"}

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { DINAMICAS } from '../src/lib/dinamicas';
import { describeMorph } from '../src/lib/morph';
import { original } from '../src/lib/original';
import { formatRef, parseRef } from '../src/lib/refs';

const MODEL = process.env.ESTUDIO_MODEL ?? 'claude-opus-5-5';
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');
const MAX_TURNS = 12;
const MAX_QUESTION = 600;
const MAX_USES = 24;

type Book = { id: string; name: string; chapters: number; testament: 'AT' | 'NT'; interlinear: boolean };
type Verse = [number, string];
type Word = [string, string, string, string, string, string, string, string];
type Turn = { role: 'user' | 'assistant'; text: string };
type Body = { book?: string; chapter?: number; verse?: number; word?: number; messages?: Turn[]; taller?: Taller };
// Ayuda del Taller (preparar reflexiones, encuentros y sermones): la IA pregunta, sugiere o revisa,
// pero nunca escribe el mensaje por la persona.
type Taller = {
  modo: 'preguntar' | 'sugerir' | 'revisar';
  tipo: 'reflexion' | 'encuentro' | 'sermon';
  paso: 'pasaje' | 'idea' | 'bosquejo' | 'revisar';
  plantilla?: string;
  desde?: number;
  hasta?: number;
  borrador?: string;
};
// [referencia, forma griega, glosa]: concordancia por número de Strong generada por el pipeline
type Use = [string, string, string];
// Cada bloque de un documento lleva su etiqueta y, si se puede abrir en la app, su referencia.
type BlockMeta = { label: string; ref?: string };

const SYSTEM = `Eres el asistente de estudio de una app bíblica gratuita en español. Ayudas a entender el texto; no sustituyes la lectura de la persona ni predicas por ella.

Fuentes: en cada conversación recibes documentos de la app: el capítulo en la Reina-Valera 1909, el texto original palabra por palabra (hebreo y arameo del Antiguo Testamento, griego del Nuevo) con su análisis gramatical (STEPBible, Tyndale House) y referencias cruzadas votadas por lectores (OpenBible.info).

Reglas:
- Basa lo que afirmes en esos documentos y cítalos cada vez que los uses.
- Si algo no está en los documentos (autoría, fechas, historia, costumbres, opiniones de comentaristas), dilo así: «esto no está en las fuentes de la app». Solo si de verdad ayuda, añade contexto general ampliamente aceptado, breve y marcado como «contexto general», sin inventar datos, fechas ni citas de autores.
- Para el hebreo y el griego usa la glosa, el lema y la gramática del documento; no inventes significados ni etimologías.
- Cuando hay interpretaciones distintas dentro del cristianismo histórico (católica, ortodoxa, protestante y evangélica), dilo con respeto y sin tomar partido.
- No uses ni presentes como interpretación cristiana las enseñanzas de grupos que niegan doctrinas centrales del cristianismo histórico, como la Trinidad o la divinidad de Cristo (por ejemplo, Testigos de Jehová o mormones).
- Escribe en español claro y cálido para alguien sin formación teológica: párrafos cortos, títulos con "## ", listas con "- " y **negritas** solo para palabras clave. Sin tablas.
- En las preguntas de seguimiento responde a lo que se pregunta, con la misma regla de fuentes. Si la pregunta no tiene que ver con la Biblia o con el estudio, redirígela con amabilidad.`;

const TALLER_SYSTEM = `

Ahora acompañas a alguien en el Taller de la app, donde prepara una reflexión, un encuentro de grupo o un sermón. Eres un acompañante que pregunta y sugiere, no un escritor fantasma: el valor está en que la persona estudie, ore y prepare.

Reglas del Taller:
- Nunca escribas un sermón, una reflexión o una guía completa, ni redactes secciones enteras listas para leer o predicar. Si te lo piden, explica con amabilidad que la preparación es suya y ofrece preguntas, opciones o un esquema de ideas para que la persona lo escriba.
- Lo que digas sobre el texto, el hebreo o el griego, o los pasajes relacionados lleva su cita, con la misma regla de fuentes.
- No inventes anécdotas como si fueran reales. Si sugieres una ilustración, márcala como «Ejemplo, no hecho real», en una o dos frases.
- Ayuda a que el mensaje tenga una sola idea central que salga del texto, nombre la necesidad humana que el pasaje toca y ponga la gracia de Dios en el centro, no solo consejos.
- Sé breve: lo justo para dar el siguiente paso.`;

const PASOS = {
  pasaje: 'observar el pasaje (quién, qué, dónde, cuándo, por qué; palabras repetidas; conectores como «pero», «por tanto», «para que»)',
  idea: 'formular la idea central (tema: ¿de qué habla?; complemento: ¿qué dice de eso?), la necesidad humana que toca el pasaje y la respuesta de la gracia',
  bosquejo: 'armar el bosquejo por secciones',
  revisar: 'revisar el borrador antes de presentarlo',
};

const TIPOS = { reflexion: 'una reflexión breve (5 a 10 minutos)', encuentro: 'un encuentro de grupo pequeño (60 a 90 minutos)', sermon: 'un sermón (20 a 45 minutos)' };

function tallerTask(book: Book, chapter: number, verse: number | undefined, t: Taller) {
  const target = verse
    ? `${book.name} ${chapter}:${verse}`
    : t.desde
      ? `${book.name} ${chapter}:${t.desde}${t.hasta ? `-${t.hasta}` : ''}`
      : `${book.name} ${chapter}`;
  const head = `Estoy preparando ${TIPOS[t.tipo]} sobre ${target}${t.plantilla ? `, con la estructura «${t.plantilla}»` : ''}. Ahora estoy en el paso de ${PASOS[t.paso]}.`;
  const draft = t.borrador?.trim() ? `\n\nLo que llevo:\n${t.borrador.trim()}` : '\n\nTodavía no he escrito nada.';
  let ask: string;
  if (t.modo === 'preguntar') {
    ask =
      'Hazme de 3 a 5 preguntas para pensar este paso por mí mismo, ancladas en el texto y con sus citas. No me des las respuestas. Formato: una lista con "- ", y antes una frase corta de introducción.';
  } else if (t.modo === 'revisar') {
    ask = `Revisa lo que llevo con esta lista: idea central en una frase; que salga del texto y respete su contexto; que nombre la necesidad humana; que Dios y su gracia estén en el centro; ${
      t.tipo === 'sermon' ? 'que cada punto tenga explicación, ilustración y aplicación; ' : ''
    }${t.tipo === 'encuentro' ? 'que las preguntas lleven al texto y no sean de sí o no; ' : ''}que la aplicación sea concreta; que quepa en el tiempo. Señala con cita cualquier afirmación que no salga del pasaje. Formato: "## Lo que funciona" y "## Para mejorar", con listas cortas. No reescribas mis secciones: dime qué revisar y por qué.`;
  } else if (t.paso === 'idea' || t.paso === 'pasaje') {
    ask =
      'Propón tres formulaciones posibles de la idea central (tema y complemento, una frase cada una), cada una con el versículo que la sostiene, y dos maneras de nombrar la necesidad humana que toca el pasaje. Yo elegiré y la escribiré con mis palabras. Formato: "## Idea central" y "## Necesidad humana", con listas.';
  } else if (t.tipo === 'encuentro') {
    const catalog = DINAMICAS.map((d) => `${d.nombre} (${d.minutos} min, apertura ${d.apertura}): ${d.objetivo}`).join('\n');
    ask = `Sugiere para este encuentro: preguntas de conversación en tres niveles (sobre el texto, sobre Dios y las personas, para la vida), y de 2 a 3 dinámicas del catálogo de la app que encajen con el pasaje, diciendo en qué parte usarlas y por qué. Usa solo dinámicas de este catálogo, todas sin materiales:\n${catalog}\n\nFormato: "## Preguntas" y "## Dinámicas", con listas.`;
  } else {
    ask =
      'Sugiere ideas para el bosquejo, no texto para leer: para cada sección, uno o dos apuntes de lo que el texto permite decir ahí (con cita), una idea de ilustración marcada como «Ejemplo, no hecho real» y una aplicación concreta. Formato: un título "## " por sección y listas cortas.';
  }
  return `${head}${draft}\n\n${ask}`;
}

const MODOS = ['preguntar', 'sugerir', 'revisar'];
const TALLER_TIPOS = ['reflexion', 'encuentro', 'sermon'];
const TALLER_PASOS = ['pasaje', 'idea', 'bosquejo', 'revisar'];
const MAX_DRAFT = 12000;

function validTaller(t: unknown): t is Taller {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  const optInt = (v: unknown) => v === undefined || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 200);
  return (
    MODOS.includes(x.modo as string) &&
    TALLER_TIPOS.includes(x.tipo as string) &&
    TALLER_PASOS.includes(x.paso as string) &&
    (x.plantilla === undefined || (typeof x.plantilla === 'string' && x.plantilla.length <= 80)) &&
    (x.borrador === undefined || (typeof x.borrador === 'string' && x.borrador.length <= MAX_DRAFT)) &&
    optInt(x.desde) &&
    optInt(x.hasta)
  );
}

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

/** Otras apariciones de la palabra en su testamento, repartidas por todo el texto para que no salgan solo del mismo libro. */
async function wordUses(word: Word, here: string, books: Book[]) {
  const uses = (await load<Use[]>(`concordance/${word[6]}.json`, [])).filter(([ref]) => ref !== here);
  const step = Math.max(1, uses.length / MAX_USES);
  const picked = Array.from({ length: Math.min(MAX_USES, uses.length) }, (_, i) => uses[Math.floor(i * step)]);
  const blocks = await Promise.all(
    picked.map(async ([ref, form, gloss]) => {
      const label = formatRef(ref, books);
      return { text: `${label}: ${form} «${gloss}». RV1909: ${await refText(ref)}`, meta: { label, ref } };
    }),
  );
  return { total: uses.length + 1, blocks };
}

async function buildSources(book: Book, chapter: number, verse: number | undefined, books: Book[], word?: number) {
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

  // Texto original: con todo el análisis para un versículo; solo palabra y glosa para un capítulo entero.
  const lang = original(book);
  const Lang = lang.name[0].toUpperCase() + lang.name.slice(1);
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
      meta: { label: `${Lang} de ${book.name} ${chapter}:${n}`, ref: `${book.id}.${chapter}.${n}` },
    }));
  if (greek.length) docs.push(doc(`${book.name} ${chapter} · ${Lang} (STEPBible ${lang.source})`, greek));

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

  let focus: { word: Word; total: number } | undefined;
  if (verse && word !== undefined) {
    const w = interlinear[verse]?.[word];
    if (!w) throw new Error('Esa palabra no existe en el versículo');
    const uses = await wordUses(w, `${book.id}.${chapter}.${verse}`, books);
    if (uses.blocks.length) {
      docs.push(doc(`Otros pasajes del ${testamentName(book)} con ${w[4]} (${w[6]}), con su glosa y la RV1909`, uses.blocks));
    }
    focus = { word: w, total: uses.total };
  }
  return { docs, focus };
}

const testamentName = (book: Book) => (book.testament === 'AT' ? 'Antiguo Testamento' : 'Nuevo Testamento');

function wordTask(book: Book, chapter: number, verse: number, focus: { word: Word; total: number }) {
  const [greek, translit, es, , lemma, lemmaGloss, strong] = focus.word;
  const lang = original(book);
  return `La persona tocó la ${lang.word} ${greek} (${translit}, glosa «${es}») en ${book.name} ${chapter}:${verse}. Su forma de diccionario es ${lemma} «${lemmaGloss}» (${strong}) y aparece ${focus.total} ${
    focus.total === 1 ? 'vez' : 'veces'
  } en el ${testamentName(book)}. Explica «¿Por qué esta palabra?» con estas secciones:
## Qué dice el ${lang.name}: el significado de la palabra y lo que aporta su forma gramatical aquí.
## Cómo la traduce la RV1909: qué palabra española usa en este versículo y qué matiz se gana o se pierde frente al ${lang.name}.
## Dónde más aparece: 3 o 4 pasajes de la lista de otros pasajes que muestren cómo se usa, y qué enseña cada uno.
## Para pensar: una pregunta breve para la persona.

Si los especialistas o las tradiciones cristianas entienden la palabra de maneras distintas en este pasaje, menciónalo sin tomar partido. Extensión: 250 a 400 palabras. Empieza directamente por la primera sección.`;
}

function studyTask(book: Book, chapter: number, verse: number | undefined, hasGreek: boolean) {
  const lang = original(book).name;
  const target = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;
  const sections = verse
    ? [
        '## Qué dice: el versículo explicado dentro de su contexto en el capítulo.',
        hasGreek && `## Palabras clave: 2 a 4 palabras del ${lang} que ayudan a entenderlo.`,
        '## Pasajes relacionados: 3 o 4 referencias y lo que cada una aporta.',
        '## Para reflexionar: 2 o 3 preguntas personales o para un grupo.',
      ]
    : [
        '## Resumen: de qué trata el capítulo en pocas frases.',
        '## Cómo avanza: las partes del capítulo por grupos de versículos.',
        hasGreek && `## Palabras clave: 3 a 5 palabras del ${lang} importantes en el capítulo.`,
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
  const word = body.word === undefined ? undefined : Number(body.word);
  if (word !== undefined && (verse === undefined || !book.interlinear || !Number.isInteger(word) || word < 0)) {
    return badRequest('Palabra no válida');
  }

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
  if (body.taller !== undefined && !validTaller(body.taller)) return badRequest('Pedido del Taller no válido');
  const taller = body.taller;

  let docs;
  let focus;
  try {
    ({ docs, focus } = await buildSources(book, chapter, verse, books, word));
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
        {
          type: 'text',
          text: taller
            ? tallerTask(book, chapter, verse, taller)
            : focus && verse
              ? wordTask(book, chapter, verse, focus)
              : studyTask(book, chapter, verse, docs.length > 1 && book.interlinear),
        },
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
            system: taller ? SYSTEM + TALLER_SYSTEM : SYSTEM,
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
