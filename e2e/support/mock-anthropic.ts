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
  // El repaso de un mensaje en un evento (Taller, modo «repaso»): sale del bosquejo y de sus citas.
  if (first.includes('repaso relámpago de este mensaje')) {
    return {
      text: [
        'P: ¿Qué hizo el padre cuando vio al hijo de lejos?\nA) Lo esperó en la puerta\nB) Corrió y lo besó\nC) Mandó a un siervo\nD) Lo reprendió\nR: B\nV: Lucas 15:20',
        'P: Según Romanos 5:8, ¿cuándo murió Cristo por nosotros?\nA) Siendo aún pecadores\nB) Después de arrepentirnos\nC) Al ser bautizados\nD) Al guardar la ley\nR: A\nV: Romanos 5:8',
      ].join('\n\n'),
      cite: false,
    };
  }
  // La ruleta: una pregunta por categoría y nivel; la correcta siempre es la B para poder jugarla en las pruebas.
  if (first.includes('Prepara la ruleta de preguntas')) {
    const mensaje = first.includes('de este mensaje');
    const nombres: Record<string, string> = { texto: 'Lo que dice', sentido: 'Qué significa', tema: 'El tema', vida: 'Para la vida' };
    return {
      text: ['texto', 'sentido', 'tema', 'vida']
        .flatMap((c) =>
          [1, 2, 3].map(
            (n) =>
              `C: ${c}\nN: ${n}\nP: ${mensaje ? 'Del mensaje' : 'De Colosenses 3'}: ${nombres[c]}, nivel ${n}\nA) Opción falsa uno\nB) La respuesta fiel al texto\nC) Opción falsa dos\nD) Opción falsa tres\nR: B\nV: ${mensaje ? 'Lucas 15:20' : 'Colosenses 3:1'}`,
          ),
        )
        .join('\n\n'),
      cite: false,
    };
  }
  if (first.includes('«Dos verdades y una mentira»')) {
    return {
      text: [
        'P: Sobre los versículos 1 al 4\nA) Hay que buscar las cosas de arriba\nB) Cristo está sentado a la diestra de Dios\nC) Nuestra vida está escondida en el templo\nR: C\nV: Colosenses 3:3',
        'P: Sobre los versículos 12 al 14\nA) Hay que vestirse de caridad\nB) La caridad es el vínculo de la perfección\nC) Hay que vestirse de ira\nR: C\nV: Colosenses 3:12',
      ].join('\n\n'),
      cite: false,
    };
  }
  if (first.includes('«¿Quién lo dijo?»')) {
    return {
      text: 'P: «Cuando Cristo, vuestra vida, se manifestare»\nA) Pedro\nB) Pablo\nC) Juan\nD) Santiago\nR: B\nV: Colosenses 3:4',
      cite: false,
    };
  }
  if (first.includes('repaso relámpago')) {
    return {
      text: [
        'P: ¿Dónde está sentado Cristo según el versículo 1?\nA) En el templo\nB) A la diestra de Dios\nC) En el monte\nD) Junto al mar\nR: B\nV: Colosenses 3:1',
        'P: ¿Dónde está escondida nuestra vida?\nA) En la ley\nB) En la iglesia\nC) Con Cristo en Dios\nD) En el cielo nuevo\nR: C\nV: Colosenses 3:3',
        'P: ¿De qué hay que vestirse sobre todas las cosas?\nA) De caridad\nB) De paciencia\nC) De gozo\nD) De sabiduría\nR: A\nV: Colosenses 3:14',
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
  // La maqueta de un mensaje que empezó desde un tema (src/lib/tallerTema.ts lee este formato).
  if (system.includes('Reglas del Taller') && first.includes('Arma la maqueta')) {
    const sermon = first.includes('un sermón');
    return {
      text: [
        '## Idea central',
        '- Tema: La paz de Dios | Complemento: guarda el corazón de quien le entrega sus cargas en oración',
        '- Tema: El afán por el mañana | Complemento: se vence presentando todo a Dios con gratitud',
        '',
        '## Introducción: la necesidad', '= Muchos viven el futuro como una amenaza y oran sin sentir que Dios escucha.',
        '? ¿Qué preocupaciones sobre el futuro escuchas más en tus jóvenes, y qué dicen de lo que creen sobre Dios?',
        '> Filipenses 4:6 | el versículo que nombra el afán sin minimizarlo',
        '',
        `## ${sermon ? 'Orar en vez de afanarse' : 'Mirar arriba'}`, '= Pablo no niega el afán: lo convierte en oración con gratitud.',
        '? ¿Por qué Pablo pone «con hacimiento de gracias» junto a la petición?',
        '> Filipenses 4:6-7 | la oración con gratitud y la paz que guarda',
        '',
        `## ${sermon ? 'Un Padre que sabe lo que necesitamos' : 'Mirar adelante'}`, '= El Padre ya sabe lo que necesitamos, y eso cambia cómo miramos el mañana.',
        '? ¿Qué cambia en la ansiedad saber que el Padre ya sabe lo que necesitas?',
        '> Mateo 6:31-34 | Jesús habla del mañana y del Padre que sabe',
        '',
        `## ${sermon ? 'Pensar en lo verdadero' : 'Oración'}`, '= La paz se cuida eligiendo pensar en lo verdadero y no en lo que tememos.',
        '? ¿Qué pensamientos verdaderos pueden reemplazar los escenarios que imaginan?',
        '> Filipenses 4:8 | la lista de lo que hay que pensar',
        ...(sermon ? ['', '## Conclusión', '= La paz de Dios no depende de que todo salga bien, sino de con quién vamos.', '? ¿Qué paso concreto puede dar esta semana alguien que vive con ansiedad?', '> Filipenses 4:9 | «lo que aprendisteis… esto haced»'] : []),
      ].join('\n'),
      cite: true,
    };
  }
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
  // Con una versión con derechos la IA no copia versículos: los marca y la app los muestra en esa versión
  // (versionSystem en api/_investigar.ts).
  if (system.includes('⟪Juan 3:16⟫') && !followUp && first.includes('Juan 3')) {
    return {
      text: [
        '## Panorama',
        'Jesús le explica a Nicodemo de dónde viene la vida nueva: no de lo que el hombre hace, sino del amor del Padre que da a su Hijo.',
        '⟪Juan 3:16⟫',
        '## Para aplicar',
        '- Jesús dice que hay que nacer de nuevo (⟪Juan 3:3⟫). ¿Qué parte de tu vida necesita empezar otra vez?',
      ].join('\n\n'),
      cite: true,
    };
  }
  // Una respuesta larga que llega despacio, para leerla mientras aún se escribe.
  if (followUp?.includes('despacio')) {
    const parrafos = Array.from({ length: 40 }, (_, i) => `Párrafo ${i + 1} de la respuesta lenta: Dios ama al mundo.`);
    return { text: parrafos.join('\n\n'), cite: false, slow: true };
  }
  if (followUp) return { text: `Respuesta simulada a «${followUp}».`, cite: true };
  // El estudio Profundo de Colosenses 3 con sus secciones, para el estudio en grupo de la lectura en vivo.
  if (first.includes('## Cómo avanza') && first.includes('Colosenses 3')) {
    return {
      text: [
        '## Panorama\n\nPablo pasa de lo que Cristo hizo a cómo vive quien resucitó con él: «buscad las cosas de arriba».',
        '## Cómo avanza\n\n- Vv. 1-4: la vida escondida con Cristo.\n- Vv. 5-17: lo que se deja y lo que se viste.\n- Vv. 18-25: la casa.',
        '## Palabras del griego\n\n**Zēteite** («buscad») está en presente: es una búsqueda que sigue cada día.',
        '## Para aplicar\n\n- ¿Qué cosa «de la tierra» ocupa hoy más tu mente que Cristo?\n- ¿Con quién del grupo necesitas «soportaros y perdonaros»?',
      ].join('\n\n'),
      cite: true,
    };
  }
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

// El Taller desde un tema (TEMA_SYSTEM en api/estudiar.ts): lee el pasaje, consulta los comentarios y la teología, y
// responde con el formato de src/lib/tallerTema.ts citando un resultado de cada herramienta.
const TEMA_CALLS = [
  { name: 'leer_pasaje', input: { cita: 'Filipenses 4:4-9' } },
  { name: 'comentarios', input: { cita: 'Filipenses 4:6' } },
  { name: 'teologia', input: { tema: 'la providencia de Dios', busqueda: 'providence God care anxiety prayer', area: 'sistematicas' } },
];

const TEMA: { text: string; tool?: number }[] = [
  { text: '## Lo que entiendo\nQuieres hablar a jóvenes que viven ansiosos por el futuro y sienten que Dios no los escucha, sin minimizar lo que sienten.\n\n## Pasajes\n' },
  { text: '- Filipenses 4:4-9 | Pablo, preso, llama a presentar todo a Dios en oración en vez de afanarse.', tool: 0 },
  { text: '\n- Mateo 6:25-34 | Jesús habla del mañana y de un Padre que sabe lo que necesitamos.\n- Salmos 55 | David entrega su carga cuando lo traicionan y siente que todo se derrumba.\n- 1 Pedro 5:6-7 | echar toda la ansiedad sobre Dios, porque él cuida de nosotros.\n\n## Lo que dicen las fuentes\n' },
  { text: '- Matthew Henry señala que la oración con gratitud es el remedio contra el afán: no quita las cargas, cambia dónde las ponemos.', tool: 1 },
  { text: '\n' },
  { text: '- Hodge explica que la providencia de Dios alcanza también lo pequeño y lo que parece azar, y por eso se puede confiar en el mañana.', tool: 2 },
  { text: '\n\n## Para afinar\n- ¿Qué edades tiene el grupo y qué los preocupa más: estudios, trabajo, familia?\n- ¿Qué esperas que hagan distinto esta semana?\n- ¿Lo vas a predicar a todo el grupo o es para una conversación más pequeña?' },
];

function temaTools(body: Body): 'pedir' | 'responder' | null {
  if (!body.tools?.length || !systemText(body.system).includes('Esta vez la persona no llega con un pasaje')) return null;
  const last = body.messages[body.messages.length - 1];
  return typeof last.content !== 'string' && last.content.some((b) => b.type === 'tool_result') ? 'responder' : 'pedir';
}

function sendTema(res: ServerResponse, send: (event: Record<string, unknown>) => void, body: Body) {
  // El índice del primer search_result que devolvió cada herramienta, en el orden en que los recibió la IA.
  const first: number[] = [];
  let n = 0;
  const last = body.messages[body.messages.length - 1];
  for (const r of typeof last.content === 'string' ? [] : last.content.filter((b) => b.type === 'tool_result')) {
    const blocks = Array.isArray(r.content) ? r.content.filter((b) => b.type === 'search_result') : [];
    first.push(blocks.length ? n : -1);
    n += blocks.length;
  }
  TEMA.forEach((seg, index) => {
    const at = seg.tool !== undefined ? first[seg.tool] : -1;
    send({ type: 'content_block_start', index, content_block: { type: 'text', text: '', citations: at >= 0 ? [] : null } });
    send({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: seg.text } });
    if (at >= 0) {
      send({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'citations_delta',
          citation: { type: 'search_result_location', cited_text: '', search_result_index: at, source: '', title: null, start_block_index: 0, end_block_index: 1 },
        },
      });
    }
    send({ type: 'content_block_stop', index });
  });
  send({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
  send({ type: 'message_stop' });
  res.end();
}

// Los temas con «SATURADA» que ya recibieron el error una vez
const SATURADAS = new Set<string>();

function sendTools(res: ServerResponse, send: (event: Record<string, unknown>) => void, list?: typeof TEMA_CALLS, from = 0) {
  const calls = list ?? [
    { name: 'leer_pasaje', input: { cita: '2 Timoteo 3:14-17' } },
    { name: 'buscar_en_la_biblia', input: { palabras: 'escritur', testamento: 'NT' } },
    { name: 'teologia', input: { tema: 'el canon del Nuevo Testamento', busqueda: 'canon New Testament books accepted disputed', area: 'canon' } },
  ];
  calls.forEach((c, i) => {
    const index = from + i;
    send({ type: 'content_block_start', index, content_block: { type: 'tool_use', id: `toolu_${i}`, name: c.name, input: {} } });
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
  const tema = temaTools(body);
  // «SATURADA» en el tema: la IA piensa y deja un texto vacío antes de pedir las herramientas, y la primera vez que
  // recibe los resultados responde que está saturada, como la API real en producción.
  const saturada = tema && JSON.stringify(body.messages[0]).includes('SATURADA');
  if (tema === 'pedir' && saturada) {
    send({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } });
    send({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Busco pasajes.' } });
    send({ type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'firma' } });
    send({ type: 'content_block_stop', index: 0 });
    send({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '', citations: null } });
    send({ type: 'content_block_stop', index: 1 });
    return sendTools(res, send, TEMA_CALLS, 2);
  }
  if (tema === 'pedir') return sendTools(res, send, TEMA_CALLS);
  if (tema === 'responder' && saturada && !SATURADAS.has(JSON.stringify(body.messages[0]))) {
    SATURADAS.add(JSON.stringify(body.messages[0]));
    send({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
    return res.end();
  }
  if (tema === 'responder') return sendTema(res, send, body);
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
