// Servidor que imita la API de Anthropic para las pruebas: las funciones de /api usan el SDK real con
// ANTHROPIC_BASE_URL apuntando aquí. Responde según lo que se le pide (estudio, herramienta, búsqueda,
// traducción…) y guarda cada petición para que las pruebas comprueben qué recibió la IA.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

type Block = {
  type: string;
  text?: string;
  title?: string;
  source?: { content?: { text: string }[] } | string;
  content?: string | Block[];
};
type Msg = { role: string; content: string | Block[] };
type Body = {
  stream?: boolean;
  system?: string | Block[];
  messages: Msg[];
  output_config?: { format?: { type: string; schema?: { properties?: Record<string, unknown> } } };
  tools?: { name: string }[];
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

/**
 * Un relato con citas a pasajes concretos (la de jésed, la palabra de la semana en las pruebas): cada tramo cita el
 * bloque de los documentos que empieza por «cita» («Génesis 24:27:», «Léxico…»).
 */
type Segment = { text: string; cite?: string };
const RELATO: Segment[] = [
  { text: '## Qué significa\n\nEl léxico explica *jésed* como bondad, amabilidad y fidelidad: un amor que cumple lo prometido.', cite: '' },
  { text: ' Aparece 245 veces en el Antiguo Testamento, sobre todo en los Salmos, y la Reina-Valera casi siempre la traduce «misericordia».', cite: 'jésed (' },
  { text: '\n\n## Una oración respondida\n\nEl siervo de Abraham busca esposa para Isaac y, al encontrar a Rebeca, bendice a Dios porque «no apartó su misericordia y su verdad» de su amo.', cite: 'Génesis 24:27:' },
  { text: ' La primera vez que la palabra suena en boca de alguien que ora, describe a un Dios que cumple paso a paso lo que había prometido.' },
  { text: '\n\n## El Dios que guarda el pacto\n\nMoisés recuerda al pueblo que Jehová es «Dios fiel, que guarda el pacto y la misericordia» a los que le aman.', cite: 'Deuteronomio 7:9:' },
  { text: ' Aquí *jésed* va unida al pacto: no es un sentimiento pasajero, sino una lealtad que Dios se compromete a mantener.' },
  { text: '\n\n## La bondad de un pariente\n\nEn Rut, Noemí descubre que Booz es pariente suyo y bendice a Dios, que «no ha rehusado a los vivos la benevolencia que tuvo con los finados».', cite: 'Rut 2:20:' },
  { text: ' La lealtad de Dios se deja ver en la de una persona que cuida a dos viudas sin estar obligada.' },
  { text: '\n\n## Para siempre es su misericordia\n\nEl Salmo 136 repite en cada verso «porque para siempre es su misericordia», mientras recorre la creación y la historia de Israel.', cite: 'Salmos 136:4:' },
  { text: ' La palabra se vuelve canto: el pueblo aprende a leer toda su historia a la luz de ese amor fiel.' },
  { text: '\n\n## Nuevas cada mañana\n\nEntre las ruinas de Jerusalén, Lamentaciones confiesa: «Es por la misericordia de Jehová que no somos consumidos».', cite: 'Lamentaciones 3:22:' },
  { text: ' Aun cuando todo se ha perdido, *jésed* es lo único que no ha decaído.' },
  { text: '\n\n## El hilo\n\nDe la oración de un siervo al lamento de una ciudad destruida, *jésed* es la lealtad de Dios que sostiene el pacto cuando las personas fallan.', cite: 'Deuteronomio 7:9:' },
  { text: ' Por eso Miqueas pide al pueblo «amar misericordia»: quien la recibe aprende a vivirla con otros.', cite: 'Miqueas 6:8:' },
  { text: '\n\n## Para pensar\n\n- ¿En qué momento de tu historia podrías decir, como el siervo de Abraham, que Dios no apartó su misericordia?\n- ¿A quién podrías mostrar hoy una lealtad como la de Booz?' },
];

/** Texto de la respuesta y, si corresponde, una cita al primer documento. */
function answer(body: Body): { text: string; cite: boolean; segments?: Segment[]; slow?: boolean } {
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
  if (first.includes('guion de un pódcast sobre la historia de la palabra')) {
    return {
      text: [
        'ANA: ¿Te has fijado en cuántas veces dice la Biblia que la misericordia de Dios es para siempre?',
        'TOMÁS: Muchísimas. Detrás de esa frase hay una palabra hebrea: jésed.',
        'ANA: El léxico la explica como bondad, amabilidad y fidelidad. Un amor que no se suelta.',
        'TOMÁS: Y el primero en usarla así es el siervo de Abraham, en Génesis veinticuatro, veintisiete.',
        'ANA: ¿Qué pregunta te deja a ti?',
      ].join('\n'),
      cite: false,
    };
  }
  if (first.includes('Cuenta la historia de la palabra')) return { text: '', cite: false, segments: RELATO };
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
  // Una respuesta larga que llega despacio, para leerla mientras aún se escribe.
  if (followUp?.includes('despacio')) {
    const parrafos = Array.from({ length: 40 }, (_, i) => `Párrafo ${i + 1} de la respuesta lenta: Dios ama al mundo.`);
    return { text: parrafos.join('\n\n'), cite: false, slow: true };
  }
  if (followUp) return { text: `Respuesta simulada a «${followUp}».`, cite: true };
  return { text: 'Estudio simulado del pasaje: Dios ama al mundo y da a su Hijo.', cite: true };
}

/** Búsqueda por idea (api/buscar.ts): primero propone pasajes y después se queda con algunos. */
function structured(body: Body) {
  const props = body.output_config?.format?.schema?.properties ?? {};
  if ('candidates' in props) return { candidates: ['php.4.6', 'mat.6.34', 'gen.99.1', 'jhn.3.16'] };
  // Preguntas frecuentes de /cuidar (api/_cuidar.ts): una que hicieron cinco personas y otra de una sola.
  if ('propuestas' in props) {
    return {
      propuestas: [
        { texto: '¿Por qué Abdías anuncia juicio contra Edom?', versiculo: null, personas: ['P1', 'P2', 'P3', 'P4', 'P5', 'P5'] },
        { texto: '¿Quién era Abdías?', versiculo: 1, personas: ['P1', 'P99'] },
      ],
    };
  }
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

/**
 * Preguntas con herramientas (api/_investigar.ts): si la pregunta habla del canon, primero pide leer un pasaje, buscar
 * en la Biblia y consultar las obras de teología; con los resultados, responde citando el segundo versículo del primer
 * resultado y la primera sección de teología (el tercer resultado).
 */
function investigates(body: Body) {
  const last = body.messages[body.messages.length - 1];
  if (!body.tools?.length || typeof last.content === 'string' && !last.content.includes('canon')) return null;
  const results = typeof last.content === 'string' ? [] : last.content.filter((b) => b.type === 'tool_result');
  if (typeof last.content !== 'string' && !results.length) return null;
  return { done: results.length > 0 };
}

function sendTools(res: ServerResponse, send: (event: Record<string, unknown>) => void) {
  const calls = [
    { name: 'leer_pasaje', input: { cita: '2 Timoteo 3:14-17' } },
    { name: 'buscar_en_la_biblia', input: { palabras: 'escritur', testamento: 'NT' } },
    { name: 'teologia', input: { tema: 'el canon del Nuevo Testamento', busqueda: 'canon New Testament books accepted disputed', area: 'canon' } },
  ];
  calls.forEach((c, index) => {
    send({ type: 'content_block_start', index, content_block: { type: 'tool_use', id: `toolu_${index}`, name: c.name, input: {} } });
    send({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(c.input) } });
    send({ type: 'content_block_stop', index });
  });
  send({ type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 10 } });
  send({ type: 'message_stop' });
  res.end();
}

async function sse(res: ServerResponse, body: Body) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (event: Record<string, unknown>) => res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  send({ type: 'message_start', message: { ...message([]), stop_reason: null } });
  const tools = investigates(body);
  if (tools && !tools.done) return sendTools(res, send);
  if (tools?.done) {
    send({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: [] } });
    send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Pablo dice que toda Escritura es inspirada por Dios.' } });
    send({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'citations_delta',
        citation: { type: 'search_result_location', cited_text: '', search_result_index: 0, source: '', title: null, start_block_index: 2, end_block_index: 3 },
      },
    });
    send({ type: 'content_block_stop', index: 0 });
    send({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '', citations: [] } });
    send({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: ' Eusebio distingue los libros aceptados de los discutidos.' } });
    send({
      type: 'content_block_delta',
      index: 1,
      delta: {
        type: 'citations_delta',
        citation: { type: 'search_result_location', cited_text: '', search_result_index: 2, source: '', title: null, start_block_index: 0, end_block_index: 1 },
      },
    });
    send({ type: 'content_block_stop', index: 1 });
    send({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
    send({ type: 'message_stop' });
    return res.end();
  }
  const { text: out, cite, segments, slow } = answer(body);
  if (segments) return sendSegments(res, send, body, segments);
  send({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: cite ? [] : null } });
  // Por partes, como la API real
  for (const piece of out.match(/.{1,20}/gs) ?? []) {
    send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } });
    if (slow) await new Promise((r) => setTimeout(r, 120));
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

/** Busca en los documentos del pedido el bloque que empieza por «prefix»: [documento, bloque]. */
function findBlock(body: Body, prefix: string): [number, number] | null {
  const docs = (typeof body.messages[0].content === 'string' ? [] : body.messages[0].content).filter((b) => b.type === 'document');
  for (let d = 0; d < docs.length; d++) {
    const src = docs[d].source;
    const blocks: { text: string }[] = typeof src === 'object' && src.content ? src.content : [];
    const i = blocks.findIndex((b) => b.text.startsWith(prefix));
    if (i >= 0) return [d, i];
  }
  return null;
}

/** Un bloque de texto por tramo, cada uno con su cita, como responde la API con citas activadas. */
function sendSegments(res: ServerResponse, send: (event: Record<string, unknown>) => void, body: Body, segments: Segment[]) {
  segments.forEach((seg, index) => {
    const at = seg.cite !== undefined ? findBlock(body, seg.cite) : null;
    send({ type: 'content_block_start', index, content_block: { type: 'text', text: '', citations: at ? [] : null } });
    send({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: seg.text } });
    if (at) {
      send({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'citations_delta',
          citation: { type: 'content_block_location', cited_text: '', document_index: at[0], document_title: null, start_block_index: at[1], end_block_index: at[1] + 1 },
        },
      });
    }
    send({ type: 'content_block_stop', index });
  });
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
