// Función de Vercel: genera un estudio de un capítulo o versículo y responde preguntas sobre él.
// Con «word» (posición de una palabra hebrea o griega en el versículo) explica esa palabra: «¿Por qué esta palabra?».
// Con «herramienta» prepara, para un capítulo, el guion de un resumen en audio a dos voces («podcast»),
// tarjetas de repaso («tarjetas») o un mapa mental («mapa»), con el formato que la app sabe leer.
// Lo que sale bien se guarda en la base de datos por capítulo: la siguiente persona lo recibe al instante, sin
// volver a llamar a la IA. Con «nueva: true» («Preparar otra versión») se genera otra y sustituye a la guardada.
// Solo usa las fuentes de la app (RV1909, hebreo y griego de STEPBible, referencias de OpenBible.info y los
// comentarios libres de comentarioFuentes.ts, en su inglés original), que se pasan a Claude como documentos con citas
// activadas. La respuesta se envía como NDJSON:
//   {"type":"text","text":"…"}  fragmento de texto en markdown; las citas llegan como ⟦n⟧
//   {"type":"source","n":1,"label":"Juan 3:16","ref":"jhn.3.16"}  fuente de la cita n
//   {"type":"done"} | {"type":"error","message":"…"}

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

import { Section, sections } from './_comentarios';
import { needsAccount } from './_cuenta';
import { ACTIVAS, Fuente, comenta } from '../src/lib/comentarioFuentes';
import { DINAMICAS } from '../src/lib/dinamicas';
import { describeMorph } from '../src/lib/morph';
import { original } from '../src/lib/original';
import { formatRef, parseRef } from '../src/lib/refs';

const MODEL = process.env.ESTUDIO_MODEL ?? 'claude-opus-5-5';
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'dist', 'data');
// Palabras de cada comentario que lee la IA: para un versículo y para un capítulo entero.
const COMMENT_WORDS = { verse: 700, chapter: 1200 };
// Cambia cuando cambian las fuentes del estudio, para que los estudios guardados antes se preparen de nuevo.
const STUDY_VERSION = 'c1';
const MAX_TURNS = 12;
const MAX_QUESTION = 600;
const MAX_USES = 24;
const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

type Book = { id: string; name: string; chapters: number; testament: 'AT' | 'NT'; interlinear: boolean };
type Verse = [number, string];
type Word = [string, string, string, string, string, string, string, string];
type Turn = { role: 'user' | 'assistant'; text: string };
type Herramienta = 'podcast' | 'tarjetas' | 'mapa';
type Body = {
  book?: string;
  chapter?: number;
  verse?: number;
  word?: number;
  messages?: Turn[];
  taller?: Taller;
  herramienta?: Herramienta;
  /** «devocional»: el pasaje guiado para orar y vivirlo. Sin él, el estudio profundo. */
  enfoque?: 'devocional' | 'profundo';
  nueva?: boolean;
};
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

Fuentes: en cada conversación recibes documentos de la app: el capítulo en la Reina-Valera 1909, el texto original palabra por palabra (hebreo y arameo del Antiguo Testamento, griego del Nuevo) con su análisis gramatical (STEPBible, Tyndale House), referencias cruzadas votadas por lectores (OpenBible.info) y lo que dicen del pasaje los comentarios bíblicos de la app, en su inglés original (las notas de estudio de Tyndale y comentaristas clásicos como Matthew Henry, Calvino o Spurgeon).

Reglas:
- Basa lo que afirmes en esos documentos y cítalos cada vez que los uses.
- Los comentarios ayudan a entender el texto (contexto, historia, costumbres, el sentido de una frase), pero son opiniones humanas, no tienen la autoridad de la Biblia. Cuando uses uno, nombra al autor («Matthew Henry señala…», «las notas de Tyndale explican…»), dilo con tus palabras en español sin copiar párrafos y cítalo. Si los comentaristas no coinciden, muéstralo sin tomar partido. Nunca atribuyas a un autor algo que no está en su comentario.
- Si algo no está en los documentos (autoría, fechas, historia, costumbres), dilo así: «esto no está en las fuentes de la app». Solo si de verdad ayuda, añade contexto general ampliamente aceptado, breve y marcado como «contexto general», sin inventar datos, fechas ni citas de autores.
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

const DEVOCIONAL_SYSTEM = `

Ahora acompañas un devocional: un rato breve (10 a 15 minutos) en el que la persona lee el pasaje despacio, lo medita, ora y decide cómo vivirlo. Tu papel es abrir el texto y hacer buenas preguntas, no hablar por Dios ni por la persona.

Reglas del devocional:
- Empieza por lo que dice el texto en su contexto, no por emociones ni consejos. Muestra qué revela el pasaje de Dios (y, cuando el texto lo permite con honestidad, de Cristo) antes de hablar de la persona.
- Una sola idea por devocional. Nada de moralejas genéricas, autoayuda ni alegorías: si el versículo suelto dice otra cosa leído en su capítulo, respeta el capítulo.
- Nunca escribas una oración para que la persona la rece, ni un sermón, ni frases como «Dios te dice hoy…». Ofrece pistas para que ella ore con sus palabras, ancladas en versículos concretos.
- Las preguntas son abiertas, personales y vuelven al texto; ninguna se responde con sí o no.
- Tono cálido y sobrio, en segunda persona («tú»). Sé breve.`;

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
      'Propón tres formulaciones posibles de la idea central, cada una con el versículo que la sostiene; dos maneras de nombrar la necesidad humana que toca el pasaje; y dos de cómo responde la gracia de Dios en el pasaje. Yo elegiré y la escribiré con mis palabras. Formato: "## Idea central", "## Necesidad humana" y "## La gracia", con listas de una idea por línea; cada idea central en la forma "- Tema: … | Complemento: …".';
  } else if (t.tipo === 'encuentro') {
    const catalog = DINAMICAS.map((d) => `${d.nombre} (${d.minutos} min, apertura ${d.apertura}): ${d.objetivo}`).join('\n');
    ask = `Sugiere para este encuentro: preguntas de conversación en tres niveles (sobre el texto, sobre Dios y las personas, para la vida), y de 2 a 3 dinámicas del catálogo de la app que encajen con el pasaje, diciendo en qué parte usarlas y por qué. Usa solo dinámicas de este catálogo, todas sin materiales:\n${catalog}\n\nFormato: "## Preguntas" y "## Dinámicas", con listas de una pregunta o dinámica por línea.`;
  } else {
    ask =
      'Sugiere ideas para el bosquejo, no texto para leer: para cada sección, uno o dos apuntes de lo que el texto permite decir ahí (con cita), una idea de ilustración marcada como «Ejemplo, no hecho real» y una aplicación concreta. Formato: un título "## " por sección con el mismo nombre que tiene en lo que llevo, y listas cortas con una idea por línea.';
  }
  return `${head}${draft}\n\n${ask}`;
}

// Herramientas inspiradas en NotebookLM. Cada una pide un formato de texto simple que la app convierte
// en audio, tarjetas o mapa; las citas ⟦n⟧ llegan igual que en el estudio.
const HERRAMIENTAS: Record<Herramienta, (book: Book, chapter: number, hasGreek: boolean) => string> = {
  podcast: (book, chapter, hasGreek) => `Escribe el guion de un resumen en audio de ${book.name} ${chapter}, como una conversación entre dos personas que estudian juntas la Biblia: Ana y Tomás. Se escuchará con voz sintetizada, de 5 a 7 minutos.

Formato estricto: cada intervención en su propia línea, empezando por «ANA:» o «TOMÁS:», sin títulos, sin listas, sin markdown, sin acotaciones entre paréntesis ni efectos de sonido.

Contenido:
- Abran con una frase que despierte interés por el capítulo; no se presenten ni saluden a la audiencia con fórmulas de radio.
- Recorran el capítulo en orden: qué pasa, quién habla y a quién, qué se repite, qué sorprende.${
    hasGreek ? '\n- Detengan la conversación en 1 o 2 palabras del griego que aclaren algo, dichas de forma que se entiendan al oído.' : ''
  }
- Relacionen el capítulo con 2 o 3 pasajes de las referencias cruzadas.
- Que uno pregunte y el otro explique, y que se alternen; intervenciones de 1 a 4 frases, en un español hablado y natural.
- No es un sermón: expliquen el texto, no prediquen ni den consejos largos.
- Cierren con una o dos preguntas para que quien escucha siga pensando, sin respuesta.
- Al leer números de versículo, dilos como «el versículo dieciséis», y las citas bíblicas con palabras («Juan tres, dieciséis»).

Extensión: 800 a 1000 palabras. Empieza directamente por la primera línea del diálogo.`,

  tarjetas: (book, chapter, hasGreek) => `Prepara de 8 a 12 tarjetas de repaso de ${book.name} ${chapter} para estudiar con repetición espaciada.

Formato estricto, sin títulos ni introducción, con una línea en blanco entre tarjetas:
P: la pregunta (una sola, concreta)
R: la respuesta, corta (de 1 a 25 palabras), con su cita

Reglas:
- Cada tarjeta prueba una sola idea y se puede responder de memoria después de leer el capítulo.
- Mezcla: qué pasa y quién lo dice; ideas centrales del capítulo; ${
    hasGreek ? 'palabras clave del griego y lo que significan; ' : ''
  }cómo se relaciona con alguno de los pasajes de las referencias cruzadas; y 2 o 3 tarjetas de completar un versículo importante, con la pregunta «Completa: …» y la parte que falta como respuesta, copiada exacta de la RV1909.
- Ordénalas como aparecen en el capítulo.
- Nada de preguntas de opinión ni de sí o no.`,

  mapa: (book, chapter) => `Haz el mapa mental de ${book.name} ${chapter}.

Formato estricto, sin texto antes ni después:
# la idea central del capítulo (de 3 a 9 palabras)
- rama (de 2 a 5 palabras) (vv. 1-8)
  - idea (de 3 a 10 palabras) (v. 3)

Reglas:
- De 3 a 6 ramas que sigan el orden del capítulo o sus grandes temas, cada una con los versículos que abarca.
- De 2 a 4 ideas por rama, cada una con su versículo y su cita.
- Frases cortas, no oraciones largas: es un mapa para ver de un vistazo.
- Solo dos niveles bajo la idea central.`,
};

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

// Herramientas ya generadas, compartidas por todos: una fila por herramienta y capítulo.
type Saved = { texto: string; fuentes: { n: number; label: string; ref?: string }[] };
let sql: ReturnType<typeof postgres> | null = null;
let ready: Promise<unknown> | null = null;

async function db() {
  if (!DB_URL) return null;
  sql ??= postgres(DB_URL, { max: 2, idle_timeout: 20, onnotice: () => {} });
  ready ??= sql`
    create table if not exists herramientas_ia (
      herramienta text not null,
      libro text not null,
      capitulo int not null,
      texto text not null,
      fuentes jsonb not null,
      modelo text,
      creado timestamptz not null default now(),
      primary key (herramienta, libro, capitulo)
    )`
    .then(
      () => sql!`
        create table if not exists estudios_ia (
          clave text primary key,
          texto text not null,
          fuentes jsonb not null,
          modelo text,
          creado timestamptz not null default now()
        )`,
    )
    .catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return sql;
}

// Si la base de datos falla, la herramienta se genera igual: guardar es una ayuda, no un requisito.
async function savedTool(herramienta: Herramienta, libro: string, capitulo: number): Promise<Saved | null> {
  try {
    const s = await db();
    if (!s) return null;
    const [row] = await s<Saved[]>`select texto, fuentes from herramientas_ia
      where herramienta = ${herramienta} and libro = ${libro} and capitulo = ${capitulo}`;
    return row ?? null;
  } catch (err) {
    console.error('estudiar: leer herramienta', err);
    return null;
  }
}

async function saveTool(herramienta: Herramienta, libro: string, capitulo: number, saved: Saved) {
  try {
    const s = await db();
    if (!s) return;
    await s`insert into herramientas_ia (herramienta, libro, capitulo, texto, fuentes, modelo)
      values (${herramienta}, ${libro}, ${capitulo}, ${saved.texto}, ${s.json(saved.fuentes)}, ${MODEL})
      on conflict (herramienta, libro, capitulo)
      do update set texto = excluded.texto, fuentes = excluded.fuentes, modelo = excluded.modelo, creado = now()`;
  } catch (err) {
    console.error('estudiar: guardar herramienta', err);
  }
}

// Estudios y devocionales ya generados, compartidos por todos: el primer estudio de un pasaje es
// igual para cualquiera, así que se guarda y al volver a abrirlo sale al momento.
async function savedStudy(clave: string): Promise<Saved | null> {
  try {
    const s = await db();
    if (!s) return null;
    const [row] = await s<Saved[]>`select texto, fuentes from estudios_ia where clave = ${clave}`;
    return row ?? null;
  } catch (err) {
    console.error('estudiar: leer estudio', err);
    return null;
  }
}

async function saveStudy(clave: string, saved: Saved) {
  try {
    const s = await db();
    if (!s) return;
    await s`insert into estudios_ia (clave, texto, fuentes, modelo)
      values (${clave}, ${saved.texto}, ${s.json(saved.fuentes)}, ${MODEL})
      on conflict (clave)
      do update set texto = excluded.texto, fuentes = excluded.fuentes, modelo = excluded.modelo, creado = now()`;
  } catch (err) {
    console.error('estudiar: guardar estudio', err);
  }
}

const ndjson = (events: object[]) =>
  new Response(events.map((e) => JSON.stringify(e) + '\n').join(''), {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });

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
  const entry = await load<{ uses: Use[] } | Use[]>(`concordance/${word[6]}.json`, []);
  const uses = (Array.isArray(entry) ? entry : entry.uses).filter(([ref]) => ref !== here);
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

/** Los primeros párrafos de un texto hasta unas palabras; el último se corta en una frase si hace falta. */
function firstWords(paras: string[], max: number) {
  const out: string[] = [];
  let left = max;
  for (const p of paras) {
    const words = p.split(/\s+/);
    if (words.length <= left) {
      out.push(p);
      left -= words.length;
      continue;
    }
    if (left >= 40 || out.length === 0) out.push(words.slice(0, Math.max(left, 40)).join(' ') + '…');
    break;
  }
  return out;
}

/** Lo que dicen del pasaje los comentarios que la IA puede leer: un documento por comentario. */
async function commentaryDocs(request: Request, book: Book, chapter: number, verse: number | undefined, books: Book[]) {
  const fuentes = ACTIVAS.filter((f) => f.tipo !== 'enlace' && f.ia !== false && comenta(f, book));
  const docs = await Promise.all(
    fuentes.map(async (f: Fuente) => {
      const all = await sections(request, f, book.id, chapter);
      // Un versículo: la sección que lo comenta (o la anterior más cercana, que suele cubrir un tramo).
      const picked = verse
        ? [all.find((s) => s.desde <= verse && verse <= s.hasta) ?? all.filter((s) => s.desde > 0 && s.desde <= verse).at(-1)].filter(
            (s): s is Section => !!s,
          )
        : all;
      if (!picked.length) return null;
      const budget = verse ? COMMENT_WORDS.verse : COMMENT_WORDS.chapter;
      const each = Math.max(60, Math.floor(budget / picked.length));
      const blocks = picked.flatMap((s) => {
        const where =
          s.desde === 0 ? `${book.name} ${chapter}` : `${book.name} ${chapter}:${s.desde}${s.hasta > s.desde ? `-${s.hasta}` : ''}`;
        const paras = s.partes.join('\n\n').split(/\n{2,}/);
        const text = firstWords(paras, each).map((p) =>
          // Las referencias ⟦jhn.3.16⟧ se leen como «Juan 3:16»: ⟦…⟧ marca las citas en la respuesta.
          p.replace(/⟦([^⟧]+)⟧/g, (_, r: string) => {
            try {
              return formatRef(r, books);
            } catch {
              return '';
            }
          }),
        );
        const meta = { label: `${f.nombre}, ${where}`, ref: `${book.id}.${chapter}.${Math.max(1, s.desde)}` };
        return text.map((t, i) => ({ text: i === 0 && s.titulo ? `${s.titulo}\n${t}` : t, meta }));
      });
      return doc(`${f.obra}, ${f.autor}${f.año ? ` (${f.año})` : ''} · comentario sobre ${verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`}`, blocks);
    }),
  );
  return docs.filter((d) => d !== null);
}

async function buildSources(
  request: Request,
  book: Book,
  chapter: number,
  verse: number | undefined,
  books: Book[],
  word?: number,
) {
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
  docs.push(...(await commentaryDocs(request, book, chapter, verse, books)));
  return { docs, focus, hasOriginal: greek.length > 0 };
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
  // Estudio inductivo: observar, interpretar, relacionar y aplicar.
  const sections = verse
    ? [
        '## Panorama: dónde está el versículo dentro del capítulo y qué ocurre alrededor.',
        '## Observa: quién habla y a quién, qué se afirma, palabras repetidas y conectores («pero», «por tanto», «para que»).',
        hasGreek && `## Palabras del ${lang}: 2 a 4 palabras clave, con su significado y lo que aporta su gramática.`,
        '## Interpreta: qué significaba para sus primeros lectores y, si las tradiciones cristianas lo leen distinto, cómo.',
        '## Pasajes relacionados: 3 o 4 referencias y lo que cada una aporta.',
        '## Hacia Cristo: cómo se relaciona con el evangelio, solo si el texto o sus referencias lo sostienen, sin forzarlo.',
        '## Para aplicar: 2 o 3 preguntas personales o para un grupo.',
      ]
    : [
        '## Panorama: de qué trata el capítulo y dónde encaja en el libro.',
        '## Cómo avanza: las partes del capítulo por grupos de versículos.',
        '## Observa: palabras y temas que se repiten, contrastes y conectores importantes.',
        hasGreek && `## Palabras del ${lang}: 3 a 5 palabras importantes en el capítulo.`,
        '## Interpreta: la idea central del capítulo para sus primeros lectores y, si las tradiciones cristianas lo leen distinto, cómo.',
        '## Pasajes relacionados: 3 o 4 referencias y lo que aportan.',
        '## Hacia Cristo: cómo se relaciona con el evangelio, solo si el texto o sus referencias lo sostienen, sin forzarlo.',
        '## Para aplicar: 2 o 3 preguntas personales o para un grupo.',
      ];
  return `Prepara un estudio de ${target} con estas secciones:\n${sections.filter(Boolean).join('\n')}\n\nExtensión: ${
    verse ? '450 a 650' : '600 a 850'
  } palabras. Empieza directamente por la primera sección.`;
}

function devotionalTask(book: Book, chapter: number, verse: number | undefined) {
  const target = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;
  return `Prepara el devocional de ${target}${verse ? ', leído dentro de su capítulo' : ''}. La app muestra cada sección como un paso; respeta el formato exacto, sin texto antes ni después:

## Observa
De 80 a 140 palabras en uno o dos párrafos: qué dice el pasaje en su contexto y qué revela de Dios, con citas.

## Medita
- Tres preguntas abiertas, una por línea: una sobre lo que el texto muestra de Dios, una sobre la persona a la luz del texto y una que la invite a quedarse con una palabra o frase. Cada pregunta con su cita.

## Vive
- Dos o tres pasos pequeños y concretos que se puedan hacer en las próximas 24 horas y salgan del texto (una frase cada uno, con cita).

## Ora
- Adora: qué del carácter de Dios en este pasaje invita a alabarle (una frase, con cita).
- Confiesa: qué invita a reconocer o soltar (una frase, con cita).
- Agradece: qué regalo de Dios aparece aquí (una frase, con cita).
- Pide: qué tiene sentido pedir a la luz del texto (una frase, con cita).
Son pistas breves para que la persona ore con sus palabras, no oraciones redactadas.

## Llévalo contigo
El número del versículo del pasaje que conviene memorizar o repetir durante el día, solo el número${verse ? ` (normalmente ${verse})` : ''}.`;
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const denied = await needsAccount(request);
  if (denied) return denied;
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
  const herramienta = body.herramienta;
  if (body.enfoque !== undefined && !['devocional', 'profundo'].includes(body.enfoque)) return badRequest('Enfoque no válido');
  const devocional = body.enfoque === 'devocional' && !taller && !herramienta && word === undefined;
  if (
    herramienta !== undefined &&
    (!Object.hasOwn(HERRAMIENTAS, herramienta) || verse !== undefined || taller || turns.length > 0)
  ) {
    return badRequest('Herramienta no válida');
  }
  if (body.nueva !== undefined && (typeof body.nueva !== 'boolean' || !herramienta)) return badRequest('Pedido no válido');

  // El primer estudio de un pasaje (sin preguntas ni Taller) se guarda para todos.
  const clave =
    !herramienta && !taller && turns.length === 0
      ? [STUDY_VERSION, devocional ? 'devocional' : 'profundo', book.id, chapter, verse ?? '', word ?? ''].join(':')
      : null;

  if ((herramienta || clave) && !body.nueva) {
    const saved = herramienta ? await savedTool(herramienta, book.id, chapter) : await savedStudy(clave!);
    if (saved) {
      return ndjson([
        ...saved.fuentes.map((f) => ({ type: 'source', ...f })),
        { type: 'text', text: saved.texto },
        { type: 'done' },
      ]);
    }
  }

  let docs;
  let focus;
  let hasOriginal = false;
  try {
    ({ docs, focus, hasOriginal } = await buildSources(request, book, chapter, verse, books, word));
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
            : herramienta
              ? HERRAMIENTAS[herramienta](book, chapter, hasOriginal && book.interlinear)
              : focus && verse
              ? wordTask(book, chapter, verse, focus)
              : devocional
              ? devotionalTask(book, chapter, verse)
              : studyTask(book, chapter, verse, hasOriginal && book.interlinear),
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
      // Lo enviado, para guardar la herramienta tal cual la recibió la persona
      let texto = '';
      const fuentes: Saved['fuentes'] = [];
      try {
        const response = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 16000,
            system: taller ? SYSTEM + TALLER_SYSTEM : devocional ? SYSTEM + DEVOCIONAL_SYSTEM : SYSTEM,
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
            texto += event.delta.text;
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
                fuentes.push({ n, ...meta });
                send({ type: 'source', n, ...meta });
              }
              if (!pending.has(event.index)) pending.set(event.index, new Set());
              pending.get(event.index)!.add(n);
            }
          } else if (event.type === 'content_block_stop' && pending.has(event.index)) {
            // Las marcas van al final del fragmento citado, como notas al pie.
            const marks = [...pending.get(event.index)!].map((n) => `⟦${n}⟧`).join('');
            texto += marks;
            send({ type: 'text', text: marks });
            pending.delete(event.index);
          }
        }
        const final = await response.finalMessage();
        if (final.stop_reason === 'refusal') {
          send({ type: 'error', message: 'No puedo ayudar con esta pregunta. Prueba a formularla de otra manera.' });
        } else {
          // Solo se guarda una respuesta completa
          if (final.stop_reason === 'end_turn' && texto.trim()) {
            if (herramienta) await saveTool(herramienta, book.id, chapter, { texto, fuentes });
            else if (clave) await saveStudy(clave, { texto, fuentes });
          }
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
