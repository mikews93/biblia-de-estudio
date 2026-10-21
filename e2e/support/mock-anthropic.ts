// Servidor que imita la API de Anthropic para las pruebas: las funciones de /api usan el SDK real con
// ANTHROPIC_BASE_URL apuntando aquí. Responde según lo que se le pide (estudio, herramienta, búsqueda,
// traducción…) y guarda cada petición para que las pruebas comprueben qué recibió la IA.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

type Block = { type: string; text?: string };
type Msg = { role: string; content: string | Block[] };
type Body = {
  stream?: boolean;
  system?: string | Block[];
  messages: Msg[];
  output_config?: { format?: { type: string; schema?: { properties?: Record<string, unknown> } } };
};

export const requests: Body[] = [];

const text = (c: Msg['content']) =>
  typeof c === 'string' ? c : c.flatMap((b) => (b.type === 'text' && b.text ? [b.text] : [])).join('\n');
const systemText = (s: Body['system']) => (typeof s === 'string' ? s : (s ?? []).map((b) => b.text ?? '').join('\n'));

const SEMANA = [
  '# Nacer de nuevo',
  ...[
    ['Un encuentro de noche', 'Juan 3:1-3', 'Nicodemo vino de noche', 3],
    ['El viento sopla', 'Juan 3:4-8', 'El Espíritu es como el viento', 8],
    ['Mirar y vivir', 'Juan 3:9-15', 'Mirar a Jesús como a la serpiente', 14],
    ['Tanto amó Dios', 'Juan 3:16-18', 'Dios amó primero', 16],
    ['De la luz a la luz', 'Juan 3:19-21', 'Venir a la luz', 21],
  ].map(
    ([titulo, pasaje, domingo, llevar], i) => `## Día ${i + 1} · ${titulo}
Pasaje: ${pasaje}
Del domingo: «${domingo}»

### Observa
Observación simulada del día ${i + 1}: el texto muestra a Dios que busca.

### Medita
- ¿Qué ves de Dios en el día ${i + 1}?
- ¿Dónde te encuentras tú en este texto?
- ¿Qué te dice hoy «${domingo}»?

### Vive
- Paso simulado ${i + 1}: llama a alguien y escúchale.
- Lee el pasaje otra vez antes de dormir.

### Ora
- Adora: Dios que da vida.
- Confiesa: lo que escondes de noche.
- Agradece: su amor que busca.
- Pide: ojos para ver su reino.

### Llévalo contigo
${llevar}`,
  ),
].join('\n\n');

/** Texto de la respuesta y, si corresponde, una cita al primer documento. */
function answer(body: Body): { text: string; cite: boolean } {
  const system = systemText(body.system);
  const first = text(body.messages[0].content);
  const last = body.messages[body.messages.length - 1];
  const followUp = body.messages.length > 1 ? text(last.content) : '';

  if (system.startsWith('Traduces al español las fichas')) {
    // Conserva las marcas de referencia del original, como pide la traducción
    const marks = first.match(/⟦[^⟧]+⟧/g) ?? [];
    return { text: `Descripción simulada de la ficha ${marks.slice(0, 2).join(' ')}.\n\nSegundo párrafo de la descripción.`, cite: false };
  }
  if (system.startsWith('Traduces al español')) {
    return { text: 'Traducción simulada: Dios amó al mundo de tal manera que dio a su Hijo.', cite: false };
  }
  if (system.startsWith('Revisas traducciones')) return { text: 'SIN CAMBIOS', cite: false };
  if (system.startsWith('Preparas preguntas')) {
    return { text: '1. ¿Qué nos enseña este pasaje sobre Dios?\n2. ¿Cómo lo viviremos esta semana?', cite: false };
  }
  if (first.includes('guion de un resumen en audio')) {
    return {
      text: 'ANA: Este capítulo empieza con una sorpresa.\nTOMÁS: Sí, y el versículo dieciséis lo resume todo.\nANA: ¿Qué pregunta te deja a ti?',
      cite: false,
    };
  }
  if (first.includes('tarjetas de repaso')) {
    return {
      text: [
        'P: ¿Quién visitó a Jesús de noche?\nR: Nicodemo, un principal de los judíos (Juan 3:1-2)',
        'P: ¿Qué dijo Jesús que hay que hacer para ver el reino de Dios?\nR: Nacer otra vez (Juan 3:3)',
        'P: Completa: «Porque de tal manera amó Dios al mundo…»\nR: que ha dado á su Hijo unigénito (Juan 3:16)',
      ].join('\n\n'),
      cite: false,
    };
  }
  if (first.includes('Haz el mapa mental')) {
    return {
      text: '# El nuevo nacimiento y el amor de Dios\n- Jesús y Nicodemo (vv. 1-21)\n  - Hay que nacer otra vez (v. 3)\n  - Dios amó al mundo (v. 16)\n- Testimonio de Juan el Bautista (vv. 22-36)\n  - Él crece, yo mengüo (v. 30)',
      cite: false,
    };
  }
  // Del sermón a tu semana: cinco días con el formato de src/lib/semanas.ts
  if (system.includes('Reglas de la semana')) return { text: SEMANA, cite: true };
  // Taller: una respuesta distinta por modo (preguntar, sugerir, revisar) en el primer turno.
  if (system.includes('Reglas del Taller') && !followUp) {
    if (first.includes('Hazme de 3 a 5 preguntas')) {
      return { text: 'Preguntas del Taller simuladas:\n- ¿Qué muestra el pasaje del amor de Dios?\n- ¿A quién se lo dice Jesús?', cite: true };
    }
    if (first.includes('Revisa lo que llevo')) {
      return { text: '## Lo que funciona\n- Revisión simulada: la idea sale del texto.\n\n## Para mejorar\n- Concreta la aplicación.', cite: true };
    }
    if (first.includes('Sugiere ideas para el bosquejo')) {
      return { text: '## El versículo\n- Apunte simulado del bosquejo: leerlo despacio.', cite: true };
    }
    return {
      text: '## Idea central\n- Sugerencia simulada del Taller: Dios ama y da.\n- Tema: El amor de Dios | Complemento: da a su Hijo al mundo\n\n## Necesidad humana\n- Necesidad simulada: sentirnos lejos de Dios.',
      cite: true,
    };
  }
  if (followUp) return { text: `Respuesta simulada a «${followUp}».`, cite: true };
  return { text: 'Estudio simulado del pasaje: Dios ama al mundo y da a su Hijo.', cite: true };
}

/** Búsqueda por idea (api/buscar.ts): primero propone pasajes y después se queda con algunos. */
function structured(body: Body) {
  const props = body.output_config?.format?.schema?.properties ?? {};
  if ('candidates' in props) return { candidates: ['php.4.6', 'mat.6.34', 'gen.99.1', 'jhn.3.16'] };
  return {
    keep: [
      { n: 1, reason: 'Pide no estar afanosos y presentar todo a Dios en oración.' },
      { n: 2, reason: 'Jesús enseña a no afanarse por el día de mañana.' },
    ],
    note: '',
  };
}

const usage = { input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
const message = (content: unknown[]) => ({
  id: 'msg_prueba',
  type: 'message',
  role: 'assistant',
  model: 'claude-prueba',
  content,
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage,
});

function sse(res: ServerResponse, body: Body) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (event: Record<string, unknown>) => res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  const { text: out, cite } = answer(body);
  send({ type: 'message_start', message: { ...message([]), stop_reason: null } });
  send({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: cite ? [] : null } });
  // Por partes, como la API real
  for (const piece of out.match(/.{1,20}/gs) ?? []) {
    send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } });
  }
  if (cite) {
    send({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'citations_delta',
        citation: {
          type: 'content_block_location',
          cited_text: '',
          document_index: 0,
          document_title: null,
          start_block_index: 0,
          end_block_index: 1,
        },
      },
    });
  }
  send({ type: 'content_block_stop', index: 0 });
  send({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
  send({ type: 'message_stop' });
  res.end();
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET' && req.url === '/__requests') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(requests));
  }
  if (req.method === 'DELETE' && req.url === '/__requests') {
    requests.length = 0;
    return res.end();
  }
  if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) {
    res.writeHead(404);
    return res.end();
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Body;
  requests.push(body);
  if (body.stream) return sse(res, body);
  const content =
    body.output_config?.format?.type === 'json_schema'
      ? [{ type: 'text', text: JSON.stringify(structured(body)) }]
      : [{ type: 'text', text: answer(body).text }];
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(message(content)));
}

export function startMockAnthropic(port: number) {
  return new Promise<void>((resolve) => createServer((req, res) => void handle(req, res)).listen(port, resolve));
}
