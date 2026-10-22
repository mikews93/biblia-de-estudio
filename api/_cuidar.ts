// «Cuidar Zarza» (/cuidar): lo que revisan quienes cuidan la app (los correos de CUIDADORES en Vercel).
// - Estudios que varias personas marcaron con «Algo suena raro» (api/_senales.ts): se descartan o se preparan de nuevo.
// - Pasajes donde al menos MIN_PERSONAS personas distintas dejaron preguntas anónimas (api/_preguntas.ts): la IA
//   propone preguntas frecuentes, reescritas y sin datos personales, y quien cuida las aprueba o las cambia.
// - Iglesias anfitrionas (api/_iglesias.ts): darlas de alta, pausarlas y cambiar sus preguntas al día.
//
// El guion bajo hace que Vercel no la publique como función: sus acciones (las que empiezan por «cuidar») van por
// /api/comunidades, con la misma cuenta.

import Anthropic from '@anthropic-ai/sdk';
import type postgres from 'postgres';

import { IGLESIAS_SCHEMA, LAMPARA_IGLESIA, nuevoCodigo } from './_iglesias';
import { PREGUNTAS_SCHEMA } from './_preguntas';
import { esCuidador, SENALES_SCHEMA } from './_senales';

type Sql = ReturnType<typeof postgres>;
type Json = Record<string, unknown>;
type Yo = { id: string; correo: string | null };
type Ctx = { sql: Sql; body: Json; request: Request };
type Helpers = {
  auth: (sql: Sql, request: Request) => Promise<Yo>;
  fail: (message: string, status?: number) => Error;
  books: () => Promise<{ id: string; name: string; chapters: number }[]>;
};

const MODEL = process.env.CUIDAR_MODEL ?? 'claude-sonnet-5-5';
/** Una pregunta solo se vuelve frecuente si la hicieron al menos tantas personas distintas. */
export const MIN_PERSONAS = Number(process.env.FRECUENTES_MIN ?? 5);
const MAX_FRECUENTE = 200;
const MAX_NOMBRE = 80;

export const CUIDAR_SCHEMA = PREGUNTAS_SCHEMA + SENALES_SCHEMA + IGLESIAS_SCHEMA;

const PROPONER_SYSTEM = `Preparas las «preguntas frecuentes» de un pasaje en una app bíblica gratuita en español. Recibes preguntas que personas anónimas hicieron sobre el pasaje, cada una con una etiqueta de quién la hizo (P1, P2…): la misma etiqueta es la misma persona.

Reglas:
- Agrupa las preguntas que piden lo mismo aunque usen otras palabras, y escribe una pregunta clara para cada grupo.
- Propón una pregunta solo si en su grupo hay al menos ${MIN_PERSONAS} personas distintas. Si ningún grupo llega, no propongas nada.
- Solo preguntas sobre el texto, su sentido, su contexto, sus palabras o su doctrina. Nunca situaciones personales, nombres, lugares concretos de alguien ni nada que permita reconocer a una persona.
- Escribe en español claro, en una sola frase, sin copiar literalmente a nadie.
- Si la pregunta es sobre un versículo concreto, indica su número; si es sobre el capítulo, deja el versículo vacío.
- Como máximo tres preguntas, de la más a la menos preguntada.`;

let anthropic: Anthropic | null = null;

/** Las partes de la clave de un estudio guardado (api/estudiar.ts) para mostrarlo: «c1:profundo:jhn:3:16:». */
function partesDe(clave: string) {
  const [, enfoque, libro, capitulo, versiculo, palabra] = clave.split(':');
  return {
    enfoque,
    libro,
    capitulo: Number(capitulo) || 0,
    versiculo: versiculo ? Number(versiculo) : null,
    palabra: palabra ? Number(palabra) : null,
  };
}

/** Las acciones de «Cuidar Zarza», para sumarlas a las de api/comunidades.ts. Todas piden ser cuidador. */
export function cuidarActions({ auth, fail, books }: Helpers): Record<string, (ctx: Ctx) => Promise<Json>> {
  async function cuidador(sql: Sql, request: Request) {
    const yo = await auth(sql, request);
    if (!esCuidador(yo.correo)) throw fail('Solo quienes cuidan Zarza pueden ver esto.', 403);
    return yo;
  }
  async function pasaje(body: Json) {
    const book = (await books()).find((b) => b.id === body.libro);
    const capitulo = Number(body.capitulo);
    if (!book || !Number.isInteger(capitulo) || capitulo < 1 || capitulo > book.chapters) throw fail('Pasaje no válido');
    return { book, capitulo };
  }
  const versiculoDe = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 200) throw fail('Versículo no válido');
    return n;
  };
  const textoDe = (v: unknown, max: number, que: string) => {
    const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
    if (!t) throw fail(`Escribe ${que}`);
    if (t.length > max) throw fail(`Es demasiado largo (máximo ${max} caracteres)`);
    return t;
  };
  /** Borra la respuesta guardada de un estudio o de una pregunta frecuente; si la tabla aún no existe, no hay nada. */
  async function olvidarEstudio(sql: Sql, clave: string) {
    try {
      await sql`delete from estudios_ia where clave = ${clave}`;
    } catch (err) {
      if ((err as { code?: string }).code !== '42P01') throw err;
    }
  }
  /** Las preguntas anónimas de un capítulo, con una etiqueta por persona (P1, P2…) que solo vale dentro del capítulo. */
  async function preguntasDe(sql: Sql, libro: string, capitulo: number) {
    const rows = await sql<{ id: string; versiculo: number | null; texto: string; quien: string; dia: string }[]>`
      select p.id::text, p.versiculo, p.texto, p.quien, to_char(p.dia, 'YYYY-MM-DD') as dia from preguntas_anonimas p
      where p.libro = ${libro} and p.capitulo = ${capitulo} order by p.id`;
    const [rev] = await sql<{ hasta: string }[]>`
      select hasta::text from preguntas_revisadas where libro = ${libro} and capitulo = ${capitulo}`;
    const alias = new Map<string, string>();
    return rows.map((r) => {
      if (!alias.has(r.quien)) alias.set(r.quien, `P${alias.size + 1}`);
      return { versiculo: r.versiculo, texto: r.texto, quien: alias.get(r.quien)!, dia: r.dia, nueva: !rev || BigInt(r.id) > BigInt(rev.hasta) };
    });
  }

  return {
    async cuidarResumen({ sql, request }) {
      await cuidador(sql, request);
      const raros = await sql<{ clave: string; raros: number; ayudo: number; motivos: string[]; notas: string[] }[]>`
        select clave,
          count(*) filter (where tipo = 'raro')::int as raros,
          count(*) filter (where tipo = 'ayudo')::int as ayudo,
          coalesce(array_agg(motivo) filter (where tipo = 'raro'), '{}') as motivos,
          coalesce(array_agg(nota) filter (where tipo = 'raro' and nota is not null), '{}') as notas
        from estudios_senales group by clave having count(*) filter (where tipo = 'raro') > 0
        order by raros desc, clave limit 50`;
      // Pasajes con preguntas nuevas (después de la última revisión) de al menos MIN_PERSONAS personas en total.
      const pasajes = await sql<{ libro: string; capitulo: number; personas: number; nuevas: number }[]>`
        select p.libro, p.capitulo, count(distinct p.quien)::int as personas,
          count(*) filter (where r.hasta is null or p.id > r.hasta)::int as nuevas
        from preguntas_anonimas p
        left join preguntas_revisadas r on r.libro = p.libro and r.capitulo = p.capitulo
        group by p.libro, p.capitulo
        having count(distinct p.quien) >= ${MIN_PERSONAS} and count(*) filter (where r.hasta is null or p.id > r.hasta) > 0
        order by personas desc limit 50`;
      const [{ frecuentes }] = await sql<{ frecuentes: number }[]>`select count(*)::int as frecuentes from preguntas_frecuentes`;
      const iglesias = await sql<Json[]>`
        select i.id, i.nombre, i.ciudad, i.codigo, i.lampara, i.activa,
          (select count(*)::int from iglesia_miembros m where m.iglesia_id = i.id) as miembros
        from iglesias_anfitrionas i order by i.activa desc, i.nombre`;
      return {
        minPersonas: MIN_PERSONAS,
        raros: raros.map((r) => ({ ...r, ...partesDe(r.clave) })),
        pasajes,
        frecuentes,
        iglesias,
      };
    },

    async cuidarPasaje({ sql, body, request }) {
      await cuidador(sql, request);
      const { book, capitulo } = await pasaje(body);
      const frecuentes = await sql<Json[]>`
        select id::int, versiculo, texto, personas from preguntas_frecuentes
        where libro = ${book.id} and capitulo = ${capitulo} order by personas desc, id`;
      return { minPersonas: MIN_PERSONAS, preguntas: await preguntasDe(sql, book.id, capitulo), frecuentes };
    },

    /** La IA agrupa las preguntas y propone las frecuentes; nada se publica hasta que alguien las aprueba. */
    async cuidarProponer({ sql, body, request }) {
      await cuidador(sql, request);
      const { book, capitulo } = await pasaje(body);
      const preguntas = await preguntasDe(sql, book.id, capitulo);
      const personas = new Set(preguntas.map((p) => p.quien));
      if (personas.size < MIN_PERSONAS) return { propuestas: [] };
      anthropic ??= new Anthropic();
      const lista = preguntas.map((p) => `- ${p.quien}${p.versiculo ? ` (v. ${p.versiculo})` : ''}: ${p.texto}`).join('\n');
      const response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: PROPONER_SYSTEM,
        messages: [{ role: 'user', content: `Pasaje: ${book.name} ${capitulo}\n\nPreguntas:\n${lista}` }],
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                propuestas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      texto: { type: 'string' },
                      versiculo: { type: ['integer', 'null'] },
                      personas: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['texto', 'versiculo', 'personas'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['propuestas'],
              additionalProperties: false,
            },
          },
        },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      if (response.stop_reason === 'refusal') throw fail('La IA no pudo proponer preguntas para este pasaje.', 502);
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      const { propuestas } = JSON.parse(text) as { propuestas: { texto: string; versiculo: number | null; personas: string[] }[] };
      // Se cuentan de nuevo las personas: solo las etiquetas que existen, sin repetir, y al menos MIN_PERSONAS.
      return {
        propuestas: propuestas
          .map((p) => ({
            texto: String(p.texto).trim().slice(0, MAX_FRECUENTE),
            versiculo: Number.isInteger(p.versiculo) ? p.versiculo : null,
            personas: new Set(p.personas.filter((q) => personas.has(q))).size,
          }))
          .filter((p) => p.texto && p.personas >= MIN_PERSONAS)
          .slice(0, 3),
      };
    },

    async cuidarAprobar({ sql, body, request }) {
      await cuidador(sql, request);
      const { book, capitulo } = await pasaje(body);
      const texto = textoDe(body.texto, MAX_FRECUENTE, 'la pregunta');
      const personas = Math.max(0, Math.min(10000, Number(body.personas) || 0));
      const [row] = await sql<{ id: number }[]>`
        insert into preguntas_frecuentes (libro, capitulo, versiculo, texto, personas)
        values (${book.id}, ${capitulo}, ${versiculoDe(body.versiculo)}, ${texto}, ${personas}) returning id::int`;
      return { id: row.id };
    },

    async cuidarQuitarFrecuente({ sql, body, request }) {
      await cuidador(sql, request);
      const id = Number(body.id);
      if (!Number.isInteger(id)) throw fail('Pregunta no válida');
      await sql`delete from preguntas_frecuentes where id = ${id}`;
      await olvidarEstudio(sql, `faq:${id}`);
      return {};
    },

    /** Las preguntas de un pasaje ya se revisaron: sale de la lista hasta que lleguen otras nuevas. */
    async cuidarRevisado({ sql, body, request }) {
      await cuidador(sql, request);
      const { book, capitulo } = await pasaje(body);
      await sql`
        insert into preguntas_revisadas (libro, capitulo, hasta)
        select ${book.id}, ${capitulo}, coalesce(max(id), 0) from preguntas_anonimas where libro = ${book.id} and capitulo = ${capitulo}
        on conflict (libro, capitulo) do update set hasta = excluded.hasta`;
      return {};
    },

    /** Prepara de nuevo un estudio: se borra el guardado (el próximo que lo abra recibe uno nuevo) y sus señales. */
    async cuidarRehacer({ sql, body, request }) {
      await cuidador(sql, request);
      const clave = textoDe(body.clave, 200, 'el estudio');
      await olvidarEstudio(sql, clave);
      await sql`delete from estudios_senales where clave = ${clave}`;
      return {};
    },

    /** El estudio está bien: se quitan los «Algo suena raro» y se queda como está. */
    async cuidarDescartar({ sql, body, request }) {
      await cuidador(sql, request);
      const clave = textoDe(body.clave, 200, 'el estudio');
      await sql`delete from estudios_senales where clave = ${clave} and tipo = 'raro'`;
      return {};
    },

    async cuidarNuevaIglesia({ sql, body, request }) {
      await cuidador(sql, request);
      const nombre = textoDe(body.nombre, MAX_NOMBRE, 'el nombre de la iglesia');
      const ciudad = typeof body.ciudad === 'string' && body.ciudad.trim() ? textoDe(body.ciudad, MAX_NOMBRE, 'la ciudad') : null;
      const lampara = body.lampara === undefined ? LAMPARA_IGLESIA : Number(body.lampara);
      if (!Number.isInteger(lampara) || lampara < 1 || lampara > 500) throw fail('Preguntas al día no válidas');
      for (let intento = 0; intento < 5; intento++) {
        const [row] = await sql<{ id: string; codigo: string }[]>`
          insert into iglesias_anfitrionas (nombre, ciudad, codigo, lampara) values (${nombre}, ${ciudad}, ${nuevoCodigo()}, ${lampara})
          on conflict (codigo) do nothing returning id, codigo`;
        if (row) return { iglesia: { ...row, nombre, ciudad, lampara, activa: true, miembros: 0 } };
      }
      throw fail('No se pudo crear el código, inténtalo de nuevo', 500);
    },

    async cuidarIglesia({ sql, body, request }) {
      await cuidador(sql, request);
      const id = typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
      if (!id) throw fail('Iglesia no válida');
      if (body.activa !== undefined && typeof body.activa !== 'boolean') throw fail('Pedido no válido');
      const lampara = body.lampara === undefined ? null : Number(body.lampara);
      if (lampara !== null && (!Number.isInteger(lampara) || lampara < 1 || lampara > 500)) throw fail('Preguntas al día no válidas');
      const [row] = await sql`
        update iglesias_anfitrionas set
          activa = coalesce(${(body.activa as boolean | undefined) ?? null}::boolean, activa),
          lampara = coalesce(${lampara}::int, lampara)
        where id = ${id} returning id`;
      if (!row) throw fail('Esa iglesia no existe', 404);
      return {};
    },
  };
}
