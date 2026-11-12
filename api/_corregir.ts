// Corrige las citas bíblicas de una respuesta de la IA antes de guardarla y de que la persona la vea terminada
// (src/lib/corregirCitas.ts). Aquí está lo que solo tiene el servidor: la RV1909 entera para buscar una frase en toda
// la Biblia y la IA para reescribir lo que no se arregla con el texto.
import Anthropic from '@anthropic-ai/sdk';

import { Biblia, RV1909 } from './_investigar';
import { conClaude } from './_quilate';
import { buscarEnBiblia, corregirCitas, type Problema, type Reemplazo } from '../src/lib/corregirCitas';
import type { Source } from '../src/lib/estudio';

const MODEL = process.env.CORREGIR_MODEL ?? 'claude-sonnet-5-5';
/** Lo que puede tardar todo: si se pasa, la respuesta queda como la escribió la IA (y la app avisa de lo que falle). */
const ESPERA_MS = Number(process.env.CORREGIR_ESPERA_MS ?? 25_000);

let client: Anthropic | null = null;

const SYSTEM = `Revisas las citas bíblicas de una respuesta de una app de estudio bíblico en español. Te paso la respuesta y las citas que no cuadran con el texto de la Biblia (Reina-Valera 1909), con lo que dice de verdad cada pasaje.
Para cada una, decide el cambio mínimo:
- Si sabes con certeza en qué versículo están esas palabras, cambia la referencia y copia las palabras como están en la Reina-Valera 1909.
- Si las palabras sí son de ese pasaje pero estaban mal copiadas, cópialas bien de lo que te paso.
- Si no son palabras de la Biblia, quita las comillas y la referencia y di la idea con otras palabras, sin presentarla como un versículo.
Nunca inventes un versículo ni una referencia. No cambies nada más de la respuesta.
Responde solo con JSON: una lista de objetos {"de": "fragmento exacto de la respuesta, copiado tal cual, de una frase como mucho", "a": "cómo queda"}.`;

async function reparar(texto: string, problemas: Problema[]): Promise<Reemplazo[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const ia = (client ??= new Anthropic());
  const lista = problemas
    .map((p, i) =>
      [
        `${i + 1}. Cita: ${p.cita}`,
        p.frase && `   Palabras citadas: «${p.frase}»`,
        `   Problema: ${p.motivo}`,
        p.texto && `   Lo que dice ${p.cita} en la RV1909: «${p.texto}»`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');
  const pedido = `Respuesta:\n<<<\n${texto}\n>>>\n\nCitas que no cuadran:\n${lista}`;
  const res = await conClaude('Corregir citas', { fn: 'corregir', model: MODEL, input: pedido }, () =>
    ia.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: pedido }],
    }),
  );
  const salida = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const json = salida.slice(salida.indexOf('['), salida.lastIndexOf(']') + 1);
  const pedidos = JSON.parse(json) as unknown;
  if (!Array.isArray(pedidos)) return [];
  return pedidos.filter((p): p is Reemplazo => typeof p?.de === 'string' && typeof p?.a === 'string');
}

/**
 * La respuesta con sus citas corregidas, o la misma si estaban bien o si la revisión no termina a tiempo.
 * «lector» es la Biblia de la petición (la versión con la que trabajó la IA).
 */
export async function corregirRespuesta(request: Request, texto: string, fuentes: Source[], lector: Biblia): Promise<string> {
  const rv = lector.version.id === 'rv1909' ? lector : new Biblia(request, RV1909, lector.books);
  const trabajo = corregirCitas(texto, {
    books: lector.books,
    sources: fuentes,
    versiones: [...new Set([lector.version.id, 'rv1909'])],
    leer: (book, chapter, version) => (version === lector.version.id ? lector : rv).chapter(book, chapter),
    buscar: (frase) => buscarEnBiblia(frase, lector.books, (b, c) => rv.chapter(b, c)),
    reparar,
  }).then(({ texto: nuevo, cambios }) => {
    if (cambios.length) console.log('estudiar: citas corregidas', cambios);
    return nuevo;
  });
  const tarde = new Promise<string>((r) => setTimeout(() => r(texto), ESPERA_MS));
  return Promise.race([trabajo, tarde]).catch((err) => {
    console.error('estudiar: corregir citas', err);
    return texto;
  });
}
