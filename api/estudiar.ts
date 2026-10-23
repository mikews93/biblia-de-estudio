// Función de Vercel: genera un estudio de un capítulo o versículo y responde preguntas sobre él.
// Con «word» (posición de una palabra hebrea o griega en el versículo) explica esa palabra: «¿Por qué esta palabra?».
// Con «semana» convierte las notas de un sermón en cinco días de devocional sobre su pasaje («Del sermón a tu semana»).
// Con «herramienta» prepara, para un capítulo, el guion de un resumen en audio a dos voces («podcast»),
// tarjetas de repaso («tarjetas») o un mapa mental («mapa»), con el formato que la app sabe leer.
// Con «palabra» (una del catálogo de src/lib/palabras.ts) cuenta la historia de esa palabra por toda la Biblia, o con
// «herramienta: 'podcast'» escribe el guion del pódcast de esa historia. Ya preparados, se leen sin cuenta.
// Lo que sale bien se guarda en la base de datos por capítulo: la siguiente persona lo recibe al instante, sin
// volver a llamar a la IA. Con «nueva: true» («Preparar otra versión») se genera otra y sustituye a la guardada.
// Solo usa las fuentes de la app (la versión libre que lee la persona o la RV1909, hebreo y griego de STEPBible,
// referencias de OpenBible.info y los comentarios libres de comentarioFuentes.ts, en su inglés original), que se pasan
// a Claude como documentos con citas activadas. Con «version» la IA trabaja con esa versión (ver api/_investigar.ts:
// las versiones con derechos no se le pasan). En las preguntas de seguimiento y el Taller la IA puede además
// investigar otros pasajes y fuentes con herramientas (TOOLS en api/_investigar.ts).
// La respuesta se envía como NDJSON:
//   {"type":"text","text":"…"}  fragmento de texto en markdown; las citas llegan como ⟦n⟧
//   {"type":"source","n":1,"label":"Juan 3:16","ref":"jhn.3.16"}  fuente de la cita n
//   {"type":"paso","tipo":"leer","texto":"Hechos 15"}  lo que la IA está consultando
//   {"type":"done"} | {"type":"error","message":"…"}
//
// Con «frecuente» (id de una pregunta frecuente aprobada en /cuidar) responde esa pregunta del pasaje; la respuesta
// también se guarda para todos. Con «senales» devuelve las señales de un estudio guardado y sus preguntas frecuentes,
// y con «senal» marca «Me ayudó» o «Algo suena raro» (api/_senales.ts). Esas dos responden JSON, no NDJSON.

import Anthropic from '@anthropic-ai/sdk';
import postgres from 'postgres';

import { gastarLampara, needsAccount, usuarioDe } from './_cuenta';
import {
  Biblia,
  Block,
  BlockMeta,
  Book,
  TOOLS,
  Use,
  Word,
  commentaryBlocks,
  investigar,
  lectura,
  load,
  pasoDe,
  versionSystem,
} from './_investigar';
import { guardarPregunta } from './_preguntas';
import { marcar, SENALES_SCHEMA, senalesDe } from './_senales';
import { waitUntil } from './_seguir';
import { DINAMICAS } from '../src/lib/dinamicas';
import { describeMorph } from '../src/lib/morph';
import { original } from '../src/lib/original';
import { PalabraEnTema, palabraPorId, unirApariciones } from '../src/lib/palabras';

// Lo que se guarda para todos (el primer estudio de un pasaje, las herramientas) se paga una vez: va con el mejor modelo.
// Lo de cada persona (preguntas de seguimiento, Taller, semana) se paga cada vez: va con uno más barato.
const MODEL = process.env.ESTUDIO_MODEL ?? 'claude-opus-5-5';
const MODEL_PROPIO = process.env.ESTUDIO_MODEL_PROPIO ?? 'claude-sonnet-5-5';
// Palabras de cada comentario que lee la IA: para un versículo y para un capítulo entero.
const COMMENT_WORDS = { verse: 700, chapter: 1200 };
// Cambia cuando cambian las fuentes del estudio, para que los estudios guardados antes se preparen de nuevo.
const STUDY_VERSION = 'c1';
const MAX_TURNS = 12;
const MAX_QUESTION = 600;
const MAX_USES = 24;
const DB_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
// Vueltas con herramientas en una respuesta: después la IA responde con lo que tiene.
const MAX_ROUNDS = 6;

type Turn = { role: 'user' | 'assistant'; text: string };
type Herramienta = 'podcast' | 'tarjetas' | 'mapa' | 'repaso' | 'quien' | 'mentira' | 'ruleta';
/** Lo que se guarda en herramientas_ia: las herramientas de un capítulo y las de una palabra (con capítulo 0). */
type Guardada = Herramienta | 'palabra' | 'palabra-podcast';
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
  semana?: Semana;
  /** Id de una palabra del catálogo (src/lib/palabras.ts): su historia por toda la Biblia. */
  palabra?: string;
  /** «jovenes»: la app está en el Modo Jóvenes (12 a 17 años). */
  publico?: 'jovenes';
  /** La versión que lee la persona (pipeline/build_data.py VERSIONS o src/lib/licenciadas.ts). Sin ella, la RV1909. */
  version?: string;
  /** La persona deja que su pregunta se guarde limpia y sin su nombre para las preguntas frecuentes (api/_preguntas.ts). */
  compartir?: boolean;
  /** Id de una pregunta frecuente del pasaje: su respuesta, guardada para todos. */
  frecuente?: number;
  /** Pide las señales del estudio de este pasaje (api/_senales.ts). */
  senales?: true;
  /** Marca o quita «Me ayudó» («ayudo») o «Algo suena raro» («raro», con motivo y nota) en el estudio de este pasaje. */
  senal?: { tipo?: unknown; quitar?: unknown; motivo?: unknown; nota?: unknown };
};
// Del sermón a tu semana: lo que la persona anotó del sermón del domingo, para cinco días de devocional.
type Semana = { notas: string; desde?: number; hasta?: number; predicador?: string };
// Ayuda del Taller (preparar reflexiones, encuentros y sermones): la IA pregunta, sugiere o revisa,
// pero nunca escribe el mensaje por la persona.
type Taller = {
  /** «repaso»: las preguntas de opción múltiple que la congregación responde en vivo durante el evento (api/vivo.ts). */
  modo: 'preguntar' | 'sugerir' | 'revisar' | 'repaso' | 'ruleta';
  tipo: 'reflexion' | 'encuentro' | 'sermon';
  paso: 'pasaje' | 'idea' | 'bosquejo' | 'revisar';
  plantilla?: string;
  desde?: number;
  hasta?: number;
  borrador?: string;
};

const SYSTEM = `Eres el asistente de estudio de una app bíblica gratuita en español. Ayudas a entender el texto; no sustituyes la lectura de la persona ni predicas por ella.

Fuentes: en cada conversación recibes documentos de la app: el capítulo en la versión con la que trabajas (la Reina-Valera 1909 si no se dice otra), el texto original palabra por palabra (hebreo y arameo del Antiguo Testamento, griego del Nuevo) con su análisis gramatical (STEPBible, Tyndale House), referencias cruzadas votadas por lectores (OpenBible.info) y lo que dicen del pasaje los comentarios bíblicos de la app, en su inglés original (las notas de estudio de Tyndale y comentaristas clásicos como Matthew Henry, Calvino o Spurgeon).

Reglas:
- Basa lo que afirmes en esos documentos y cítalos cada vez que los uses.
- Los comentarios ayudan a entender el texto (contexto, historia, costumbres, el sentido de una frase), pero son opiniones humanas, no tienen la autoridad de la Biblia. Cuando uses uno, nombra al autor («Matthew Henry señala…», «las notas de Tyndale explican…»), dilo con tus palabras en español sin copiar párrafos y cítalo. Si los comentaristas no coinciden, muéstralo sin tomar partido. Nunca atribuyas a un autor algo que no está en su comentario.
- Si algo no está en los documentos (autoría, fechas, historia, costumbres), dilo así: «esto no está en las fuentes de la app». Solo si de verdad ayuda, añade contexto general ampliamente aceptado, breve y marcado como «contexto general», sin inventar datos, fechas ni citas de autores.
- Para el hebreo y el griego usa la glosa, el lema y la gramática del documento; no inventes significados ni etimologías.
- Cuando hay interpretaciones distintas dentro del cristianismo histórico (católica, ortodoxa, protestante y evangélica), dilo con respeto y sin tomar partido.
- No uses ni presentes como interpretación cristiana las enseñanzas de grupos que niegan doctrinas centrales del cristianismo histórico, como la Trinidad o la divinidad de Cristo (por ejemplo, Testigos de Jehová o mormones).
- Escribe en español claro y cálido para alguien sin formación teológica: párrafos cortos, títulos con "## ", listas con "- " y **negritas** solo para palabras clave. Sin tablas.
- En las preguntas de seguimiento responde a lo que se pregunta, con la misma regla de fuentes. Si la pregunta no tiene que ver con la Biblia o con el estudio, redirígela con amabilidad.`;

// Solo cuando la IA tiene herramientas (en las preguntas de seguimiento).
const TOOLS_SYSTEM = `

Herramientas: puedes investigar más allá del pasaje abierto: leer otros pasajes, buscar palabras en toda la Biblia, ver referencias cruzadas, el texto original y la concordancia, consultar los comentarios de la app sobre cualquier pasaje, y buscar en teologías sistemáticas clásicas, credos e historias del canon de dominio público.
- Úsalas cuando la pregunta va más allá del pasaje (un tema que recorre la Biblia, otro libro, una pregunta general como «¿cómo se formó el canon?») o cuando vayas a hablar de otro pasaje: léelo antes y cítalo.
- No las uses si los documentos del pasaje ya bastan. Pide varias a la vez cuando no dependan unas de otras, y no más de las necesarias: la persona espera la respuesta.
- No escribas nada antes de terminar de investigar: tu respuesta empieza cuando ya tienes lo que necesitas.
- Para doctrina o historia de la Iglesia (el canon, los concilios, la Trinidad, la justificación) consulta «teologia» y presenta cada postura como la de su autor y su tradición; si los autores difieren (Hodge o Shedd frente a Miley sobre la elección, Strong sobre el bautismo), muestra las dos posturas sin tomar partido. La Escritura va primero: apoya lo que digas en pasajes leídos con las otras herramientas.
- Lo que encuentres con ellas se cita igual que los documentos. Si algo no está en ninguna fuente de la app, márcalo como «contexto general», breve y sin inventar fechas ni citas.`;

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

const SEMANA_SYSTEM = `

Ahora acompañas «Del sermón a tu semana»: la persona escuchó un sermón el domingo, te comparte sus notas y quiere seguir meditando ese pasaje cinco días, con un devocional breve cada día. Las notas son suyas: lo que oyó y lo que le tocó.

Reglas de la semana:
- El centro es el texto bíblico, leído en su contexto y con citas; las notas solo te dicen qué subrayar y por dónde empezar. No añadas un sermón nuevo ni completes el que escuchó.
- No juzgues ni corrijas a quien predicó. Si algo de las notas no se ve en el texto, no construyas un día sobre eso: quédate con lo que el pasaje sí dice.
- Cuando cites las notas, copia sus palabras tal como están, sin inventar frases que no escribió.
- Nunca escribas una oración para que la persona la rece, ni frases como «Dios te dice hoy…». Ofrece preguntas y pistas para que ella ore y decida con sus palabras.
- Las preguntas son abiertas, personales y vuelven al texto; ninguna se responde con sí o no.
- Tono cálido y sobrio, en segunda persona («tú»). Sé breve: cada día se hace en 10 minutos.`;
const JOVENES_SYSTEM = `

Quien pregunta está usando el Modo Jóvenes de la app: tiene entre 12 y 17 años.

Reglas para jóvenes:
- Escribe corto y claro, como le hablarías a alguien de secundaria: frases simples, sin palabras técnicas sin explicar (si usas una palabra griega o hebrea, explícala en una línea). Nada de tono infantil ni de sermón.
- Tu papel es ayudar a entender y hacer buenas preguntas, no decirle qué sentir ni qué hacer. Termina con una o dos preguntas abiertas para que piense por su cuenta.
- No des consejos sobre temas de adultos (relaciones de pareja, sexualidad, drogas, dinero) más allá de lo que dice el texto; anímale a conversarlo con sus padres, su líder o su pastor.
- Si menciona que alguien le hace daño, que quiere hacerse daño, que no quiere vivir o algo parecido, deja el estudio a un lado: dile con calidez que no está solo, que hable hoy mismo con un adulto de confianza (sus padres, su líder, un maestro) y que si está en peligro llame a emergencias. No minimices lo que siente ni respondas solo con un versículo.
- Nunca pidas ni comentes datos personales (nombre completo, escuela, dirección, redes).`;

const PASOS = {
  pasaje: 'observar el pasaje (quién, qué, dónde, cuándo, por qué; palabras repetidas; conectores como «pero», «por tanto», «para que»)',
  idea: 'formular la idea central (tema: ¿de qué habla?; complemento: ¿qué dice de eso?), la necesidad humana que toca el pasaje y la respuesta de la gracia',
  bosquejo: 'armar el bosquejo por secciones',
  revisar: 'revisar el borrador antes de presentarlo',
};

const TIPOS = { reflexion: 'una reflexión breve (5 a 10 minutos)', encuentro: 'un encuentro de grupo pequeño (60 a 90 minutos)', sermon: 'un sermón (20 a 45 minutos)' };

// El formato que lee src/lib/repaso.ts, para el repaso del capítulo y el del mensaje de un evento.
// La ruleta de preguntas: doce preguntas, una por casilla (categoría y nivel; src/lib/repaso.ts, RULETA).
const RULETA_FORMATO = `Formato estricto, sin títulos ni introducción, con una línea en blanco entre preguntas:
C: la categoría, exactamente una de: texto, sentido, tema, vida
N: la dificultad: 1 (fácil), 2 (media) o 3 (difícil)
P: la pregunta (una sola, concreta, de máximo 25 palabras)
A) opción
B) opción
C) opción
D) opción
R: la letra de la opción correcta
V: la cita que la respalda

Haz 12 preguntas: cada categoría en sus tres niveles (una de nivel 1, una de 2 y una de 3).
- «texto», lo que dice: qué pasa, quién, en qué orden. Solo esta categoría pregunta por datos.
- «sentido», qué significa: por qué se dice algo, qué quiere decir una palabra o una imagen, cómo se conecta con otra parte.
- «tema»: la idea central y lo que enseña de Dios, de Cristo o de la gracia; que obligue a pensar el mensaje, no a recordarlo.
- «vida», para la vida: una situación concreta de hoy (en la casa, el trabajo, el colegio, la iglesia) y cuál respuesta vive mejor esta enseñanza.
Dificultad: el nivel 1 se responde con una lectura atenta; el 2 pide relacionar dos partes; el 3 pide pensar en serio, con opciones que se parecen y solo una fiel al texto.
- Aunque inviten a reflexionar, cada pregunta tiene una sola respuesta correcta que el texto sostiene; las otras son creíbles pero el texto las descarta (en «vida», respuestas que suenan bien pero no son lo que enseña el pasaje). Nada de opinión personal ni de doctrina discutida entre iglesias.
- Opciones parecidas en largo; que la correcta no sea siempre la misma letra. Nada de sí o no, ni de «todas las anteriores».`;

const REPASO_FORMATO = `Formato estricto, sin títulos ni introducción, con una línea en blanco entre preguntas:
P: la pregunta (una sola, concreta, de máximo 20 palabras)
A) opción
B) opción
C) opción
D) opción
R: la letra de la opción correcta
V: la cita que la respalda (por ejemplo «Juan 3:16»)`;

function tallerTask(book: Book, chapter: number, verse: number | undefined, t: Taller) {
  const target = verse
    ? `${book.name} ${chapter}:${verse}`
    : t.desde
      ? `${book.name} ${chapter}:${t.desde}${t.hasta ? `-${t.hasta}` : ''}`
      : `${book.name} ${chapter}`;
  const head = `Estoy preparando ${TIPOS[t.tipo]} sobre ${target}${t.plantilla ? `, con la estructura «${t.plantilla}»` : ''}. Ahora estoy en el paso de ${PASOS[t.paso]}.`;
  const draft = t.borrador?.trim() ? `\n\nLo que llevo:\n${t.borrador.trim()}` : '\n\nTodavía no he escrito nada.';
  let ask: string;
  if (t.modo === 'ruleta') {
    ask = `Prepara la ruleta de preguntas de este mensaje para la congregación, que la juega en vivo en su teléfono: preguntas de opción múltiple sobre lo que se predicó y sobre las citas del bosquejo (sus versículos van en lo que llevo), no solo sobre ${target}. Si el bosquejo no da para una categoría, usa los versículos citados.

${RULETA_FORMATO}`;
  } else if (t.modo === 'repaso') {
    // Un sermón recorre varias citas y capítulos: las preguntas salen del bosquejo y de los versículos que trae.
    ask = `Prepara un repaso relámpago de este mensaje para la congregación, que lo responde en vivo en su teléfono durante o al final: 5 preguntas de opción múltiple sobre lo que se predicó y sobre las citas del bosquejo (sus versículos van en lo que llevo), no solo sobre ${target}.

${REPASO_FORMATO}

Reglas:
- Cada pregunta se responde con el bosquejo o con sus versículos; una sola opción es correcta y las otras son creíbles pero el texto las descarta.
- Reparte las preguntas entre los puntos del mensaje, en su orden, y usa citas distintas; incluye una de completar un versículo citado, copiado exacto de lo que llevo.
- Opciones cortas (de 1 a 12 palabras) y parecidas en largo; que la correcta no sea siempre la misma letra.
- Nada de preguntas de opinión, de sí o no, ni de «todas las anteriores».`;
  } else if (t.modo === 'preguntar') {
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

  // El repaso relámpago del estudio en grupo (src/lib/repaso.ts lee este formato).
  repaso: (book, chapter, hasGreek) => `Prepara un repaso relámpago de ${book.name} ${chapter} para un grupo que acaba de estudiarlo junto: 5 preguntas de opción múltiple que todos responden a la vez en su teléfono.

${REPASO_FORMATO}

Reglas:
- Cada pregunta se responde con lo que dice el capítulo; una sola opción es correcta y las otras son creíbles pero el texto las descarta.
- Mezcla: qué pasa y quién lo dice; ideas centrales; ${hasGreek ? 'una palabra clave del griego; ' : ''}y una de completar un versículo importante, copiado exacto de la RV1909.
- Opciones cortas (de 1 a 12 palabras) y parecidas en largo; que la correcta no sea siempre la misma letra.
- Nada de preguntas de opinión, de sí o no, ni de «todas las anteriores».
- Ordénalas como aparecen en el capítulo.`,

  ruleta: (book, chapter) => `Prepara la ruleta de preguntas de ${book.name} ${chapter} para un grupo que acaba de estudiarlo junto: la ruleta cae en una categoría y todos responden en su teléfono una pregunta de esa categoría.

${RULETA_FORMATO}`,

  // Juegos del estudio en grupo, con el mismo formato que el repaso (src/lib/repaso.ts).
  quien: (book, chapter) => `Prepara el juego «¿Quién lo dijo?» de ${book.name} ${chapter} para un grupo que acaba de leerlo junto: 5 frases dichas por alguien, y todos eligen en su teléfono quién la dijo.

${REPASO_FORMATO}

Reglas:
- «P:» es la frase entre comillas, copiada exacta de la RV1909 (de 5 a 25 palabras); las opciones son personas o grupos.
- Usa frases de este capítulo. Si en él habla una sola persona (una carta, un salmo), mezcla preguntas de «¿A quién se lo dijo?» o «¿De quién habla?» escritas en «P:», o frases de los pasajes de las referencias cruzadas.
- Las otras opciones son personajes de la Biblia creíbles para esa frase, no absurdos; que la correcta no sea siempre la misma letra.
- Ordénalas como aparecen en el capítulo.`,

  mentira: (book, chapter) => `Prepara el juego «Dos verdades y una mentira» de ${book.name} ${chapter} para un grupo que acaba de leerlo junto: 5 rondas de tres frases sobre el capítulo, dos verdaderas y una falsa, y todos eligen en su teléfono la falsa.

Formato estricto, sin títulos ni introducción, con una línea en blanco entre rondas:
P: una frase corta que diga de qué parte del capítulo se trata (por ejemplo «Sobre los versículos 1 al 4»)
A) frase
B) frase
C) frase
R: la letra de la frase FALSA
V: la cita que la desmiente

Reglas:
- Las verdaderas dicen lo que el texto dice; la falsa cambia un detalle que el texto deja claro (quién, qué, cuántos, dónde, el orden), de forma creíble.
- Frases de 6 a 20 palabras, parecidas en largo y en tono; nada de opiniones ni de doctrina discutida.
- Que la falsa no sea siempre la misma letra. Ordénalas como avanza el capítulo.`,

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

const MODOS = ['preguntar', 'sugerir', 'revisar', 'repaso', 'ruleta'];
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
type Saved = { texto: string; fuentes: { n: number; label: string; ref?: string; url?: string; nota?: string }[] };
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

let senalesLista: Promise<unknown> | null = null;

/** La base con las tablas de señales y preguntas frecuentes (api/_senales.ts). */
async function dbSenales() {
  const s = await db();
  if (!s) return null;
  senalesLista ??= s.unsafe(SENALES_SCHEMA).catch((err) => {
    senalesLista = null;
    throw err;
  });
  await senalesLista;
  return s;
}

/** «senales» y «senal»: las señales de un estudio guardado. */
async function senalesPost(request: Request, body: Body, clave: string, book: Book, chapter: number, verse?: number) {
  const s = await dbSenales().catch((err) => {
    console.error('estudiar: señales', err);
    return null;
  });
  const usuario = await usuarioDe(request);
  if (!s || !usuario) return badRequest('No se pudieron leer las señales. Inténtalo de nuevo.', 503);
  if (body.senal !== undefined) {
    if (!body.senal || typeof body.senal !== 'object') return badRequest('Señal no válida');
    const pasaje = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;
    const problema = await marcar(s, usuario, clave, pasaje, body.senal);
    if (problema) return badRequest(problema);
  }
  return Response.json(await senalesDe(s, usuario, clave, book.id, chapter, verse), { headers: { 'Cache-Control': 'no-store' } });
}

/** La pregunta frecuente aprobada, si es de este capítulo. */
async function frecuenteDe(id: number, libro: string, capitulo: number) {
  const s = await dbSenales();
  if (!s) return null;
  const [row] = await s<{ texto: string; versiculo: number | null }[]>`
    select texto, versiculo from preguntas_frecuentes where id = ${id} and libro = ${libro} and capitulo = ${capitulo}`;
  return row ?? null;
}

// Si la base de datos falla, la herramienta se genera igual: guardar es una ayuda, no un requisito.
async function savedTool(herramienta: Guardada, libro: string, capitulo: number): Promise<Saved | null> {
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

async function saveTool(herramienta: Guardada, libro: string, capitulo: number, saved: Saved) {
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

function doc(title: string, blocks: Block[]) {
  const param: Anthropic.Beta.BetaRequestDocumentBlock = {
    type: 'document',
    title,
    citations: { enabled: true },
    source: { type: 'content', content: blocks.map((b) => ({ type: 'text' as const, text: b.text })) },
  };
  return { param, metas: blocks.map((b) => b.meta) };
}

/** Otras apariciones de la palabra en su testamento, repartidas por todo el texto para que no salgan solo del mismo libro. */
async function wordUses(word: Word, here: string, biblia: Biblia) {
  const entry = await load<{ uses: Use[] } | Use[]>(`concordance/${word[6]}.json`, []);
  const uses = (Array.isArray(entry) ? entry : entry.uses).filter(([ref]) => ref !== here);
  const step = Math.max(1, uses.length / MAX_USES);
  const picked = Array.from({ length: Math.min(MAX_USES, uses.length) }, (_, i) => uses[Math.floor(i * step)]);
  const blocks = await Promise.all(
    picked.map(async ([ref, form, gloss]) => {
      const label = biblia.label(ref);
      return { text: `${label}: ${form} «${gloss}». ${biblia.version.abbr}: ${await biblia.refText(ref)}`, meta: { label, ref } };
    }),
  );
  return { total: uses.length + 1, blocks };
}

/** Lo que dicen del pasaje los comentarios que la IA puede leer: un documento por comentario. */
async function commentaryDocs(request: Request, book: Book, chapter: number, verse: number | undefined, books: Book[]) {
  const found = await commentaryBlocks(request, book, chapter, verse, books, verse ? COMMENT_WORDS.verse : COMMENT_WORDS.chapter);
  return found.map((f) => doc(f.title, f.blocks));
}

async function buildSources(biblia: Biblia, book: Book, chapter: number, verse: number | undefined, word?: number) {
  const { request, books } = biblia;
  const [verses, interlinear, xrefs] = await Promise.all([
    biblia.chapter(book.id, chapter),
    load<Record<string, Word[]>>(`interlinear/${book.id}/${chapter}.json`, {}),
    load<Record<string, [string, number][]>>(`xrefs/${book.id}/${chapter}.json`, {}),
  ]);
  if (verse && !verses.some(([n]) => n === verse)) throw new Error('Ese versículo no existe');

  const docs = [
    doc(
      `${book.name} ${chapter} · ${biblia.version.name}`,
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
      const label = biblia.label(r);
      return { text: `${label}: ${await biblia.refText(r)}`, meta: { label, ref: r } };
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
    const uses = await wordUses(w, `${book.id}.${chapter}.${verse}`, biblia);
    if (uses.blocks.length) {
      docs.push(doc(`Otros pasajes del ${testamentName(book)} con ${w[4]} (${w[6]}), con su glosa y la ${biblia.version.abbr}`, uses.blocks));
    }
    focus = { word: w, total: uses.total };
  }
  docs.push(...(await commentaryDocs(request, book, chapter, verse, books)));
  return { docs, focus, hasOriginal: greek.length > 0 };
}

const testamentName = (book: Book) => (book.testament === 'AT' ? 'Antiguo Testamento' : 'Nuevo Testamento');

function wordTask(book: Book, chapter: number, verse: number, focus: { word: Word; total: number }, abbr: string) {
  const [greek, translit, es, , lemma, lemmaGloss, strong] = focus.word;
  const lang = original(book);
  return `La persona tocó la ${lang.word} ${greek} (${translit}, glosa «${es}») en ${book.name} ${chapter}:${verse}. Su forma de diccionario es ${lemma} «${lemmaGloss}» (${strong}) y aparece ${focus.total} ${
    focus.total === 1 ? 'vez' : 'veces'
  } en el ${testamentName(book)}. Explica «¿Por qué esta palabra?» con estas secciones:
## Qué dice el ${lang.name}: el significado de la palabra y lo que aporta su forma gramatical aquí.
## Cómo la traduce la ${abbr}: qué palabra española usa en este versículo y qué matiz se gana o se pierde frente al ${lang.name}.
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

function frecuenteTask(book: Book, chapter: number, verse: number | null, pregunta: string) {
  const target = verse ? `${book.name} ${chapter}:${verse}` : `${book.name} ${chapter}`;
  return `Varias personas que estudiaron ${target} hicieron esta pregunta: «${pregunta}»

Respóndela para todas, con citas: primero lo que dice el texto en su contexto, después lo que aportan el original, las referencias o los comentarios si ayudan. Si las tradiciones cristianas históricas la responden distinto, muéstralo sin tomar partido. Termina con una pregunta breve para seguir pensando. Extensión: 150 a 300 palabras. Empieza directamente por la respuesta, sin títulos.`;
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

function semanaTask(book: Book, chapter: number, s: Semana) {
  const target = `${book.name} ${chapter}${s.desde ? `:${s.desde}${s.hasta && s.hasta !== s.desde ? `-${s.hasta}` : ''}` : ''}`;
  const dia = (n: number, foco: string) => `## Día ${n} · Un título breve (de 2 a 6 palabras)
Pasaje: ${n === 1 ? target : 'la cita'}
Del domingo: «una frase copiada tal cual de las notas»

### Observa
De 60 a 110 palabras: ${foco}, con citas.

### Medita
- Tres preguntas abiertas, una por línea, con su cita. Una de ellas vuelve a la frase «Del domingo».

### Vive
- Dos o tres pasos pequeños y concretos para las próximas 24 horas, que salgan del texto (una frase cada uno, con cita).

### Ora
- Adora: (una frase, con cita)
- Confiesa: (una frase, con cita)
- Agradece: (una frase, con cita)
- Pide: (una frase, con cita)

### Llévalo contigo
El número de un versículo del pasaje del día, solo el número.`;
  return `Esta semana quiero seguir meditando el sermón del domingo sobre ${target}${s.predicador ? `, que predicó ${s.predicador}` : ''}. Mis notas del sermón están entre <notas> y </notas>.

<notas>
${s.notas}
</notas>

Prepara cinco días de devocional. Los días 1 a 4 recorren el pasaje en orden, cada uno con una porción de pocos versículos (o el pasaje entero si es corto); el día 5 lee un pasaje relacionado de las referencias cruzadas o vuelve al pasaje entero para mirar la semana. Cada día toma de las notas una frase distinta, si las notas lo permiten. Usa la cita del pasaje de cada día con el nombre del libro en español, como «${book.name} ${chapter}:1-4». La app muestra cada sección como un paso; respeta el formato exacto, sin texto antes ni después:

# El título de la semana (de 2 a 6 palabras, sacado del pasaje)

${dia(1, 'la idea central del pasaje y qué revela de Dios')}

${dia(2, 'qué dice esta porción en su contexto')}

(Los días 3, 4 y 5 con el mismo formato. En el día 5, el Observa une lo de la semana sin repetirlo.)`;
}

const MAX_NOTAS = 8000;

function validSemana(t: unknown): t is Semana {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  const optInt = (v: unknown) => v === undefined || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 200);
  return (
    typeof x.notas === 'string' &&
    x.notas.trim().length >= 10 &&
    x.notas.length <= MAX_NOTAS &&
    (x.predicador === undefined || (typeof x.predicador === 'string' && x.predicador.length <= 80)) &&
    optInt(x.desde) &&
    optInt(x.hasta) &&
    (x.hasta === undefined || (x.desde !== undefined && (x.hasta as number) >= (x.desde as number)))
  );
}

// ---------------------------------------------------------------- La historia de una palabra

const PALABRA_USES = 70;
const PAREJA_USES = 14;
type Lexico = { strong: string; lema: string; glosa: string; definicion: string };

const PALABRA_SYSTEM = `

Ahora cuentas «la historia de una palabra»: cómo una palabra del texto original recorre la Biblia. Recibes la entrada del léxico breve de STEPBible (Tyndale House, en inglés), cuántas veces y dónde aparece según la concordancia de la app, y una selección de pasajes con la forma original, su glosa y el texto de la Reina-Valera 1909.

Reglas de la historia:
- Cuenta lo que muestran los pasajes y cítalos; cada momento se apoya en versículos concretos de la lista.
- El significado sale del léxico y de cómo se usa la palabra en los pasajes: nada de etimologías, cifras ni datos que no estén en los documentos.
- Es un relato para descubrir, no un sermón: explica, no prediques ni des consejos largos.
- Cuando escribas la palabra original, usa la transliteración que te doy (por ejemplo «jésed»), en cursiva con *asteriscos*.`;

async function palabraUses(strongs: string[], order: Map<string, number>): Promise<Use[]> {
  const lists = await Promise.all(
    strongs.map(async (s) => {
      const entry = await load<{ uses: Use[] } | Use[]>(`concordance/${s}.json`, []);
      return Array.isArray(entry) ? entry : entry.uses;
    }),
  );
  return unirApariciones(lists, order);
}

/** Apariciones repartidas por toda la Biblia: la primera de cada libro donde está y el resto a intervalos iguales. Un versículo, una vez. */
export function repartir(uses: Use[], max: number): Use[] {
  const firsts = new Map<string, number>();
  const verses = new Map<string, number>();
  uses.forEach(([ref], i) => {
    if (!verses.has(ref)) verses.set(ref, i);
    const book = ref.split('.')[0];
    if (!firsts.has(book)) firsts.set(book, i);
  });
  const unique = [...verses.values()];
  if (unique.length <= max) return unique.map((i) => uses[i]);
  const picked = new Set([...firsts.values()].slice(0, max));
  // Los que faltan, a intervalos iguales; si alguno ya estaba, se prueba a intervalos más finos
  for (let parts = max; picked.size < max; parts *= 2) {
    for (let k = 0; k < parts && picked.size < max; k++) picked.add(unique[Math.floor(((k + 0.5) * unique.length) / parts)]);
  }
  return [...picked].sort((a, b) => a - b).map((i) => uses[i]);
}

async function usesDoc(title: string, uses: Use[], biblia: Biblia) {
  const blocks = await Promise.all(
    uses.map(async ([ref, form, gloss]) => {
      const label = biblia.label(ref);
      return { text: `${label}: ${form} «${gloss}». RV1909: ${await biblia.refText(ref)}`, meta: { label, ref } };
    }),
  );
  return doc(title, blocks);
}

async function palabraSources(p: PalabraEnTema, biblia: Biblia) {
  const { books } = biblia;
  const order = new Map(books.map((b, i) => [b.id, i]));
  const name = new Map(books.map((b) => [b.id, b.name]));
  const [{ lexico }, uses, pareja] = await Promise.all([
    load<{ lexico: Lexico[] }>(`palabras/${p.id}.json`, { lexico: [] }),
    palabraUses(p.strongs, order),
    p.pareja ? palabraUses(p.pareja.strongs, order) : Promise.resolve([] as Use[]),
  ]);
  const docs: Doc[] = [];
  if (lexico.length) {
    docs.push(
      doc(
        `Léxico breve de STEPBible (Tyndale House): ${p.original}`,
        lexico.map((l) => ({
          text: `${l.lema} (${l.strong}), «${l.glosa}»: ${l.definicion}`,
          meta: { label: `Léxico de STEPBible: ${l.lema} (${l.strong})` },
        })),
      ),
    );
  }
  const byBook = new Map<string, number>();
  for (const [ref] of uses) byBook.set(ref.split('.')[0], (byBook.get(ref.split('.')[0]) ?? 0) + 1);
  const top = [...byBook].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const lengua = p.hebreo ? 'hebreo del Antiguo Testamento' : 'griego del Nuevo Testamento';
  docs.push(
    doc(`Concordancia de la app: ${p.nombre} (${p.original})`, [
      {
        text: `${p.nombre} (${p.original}, ${p.strongs.join(', ')}) aparece ${uses.length} veces en el ${lengua}, en ${byBook.size} libros. Donde más aparece: ${top
          .map(([b, n]) => `${name.get(b) ?? b} (${n})`)
          .join(', ')}.`,
        meta: { label: `Concordancia de la app (STEPBible): ${p.nombre}` },
      },
    ]),
  );
  docs.push(await usesDoc(`Pasajes con ${p.nombre} (${p.original}), con la forma original, su glosa y la RV1909`, repartir(uses, PALABRA_USES), biblia));
  if (p.pareja && pareja.length) {
    const otro = p.hebreo ? 'griego del Nuevo Testamento' : 'hebreo del Antiguo Testamento';
    docs.push(
      await usesDoc(
        `La misma idea en el ${otro}: pasajes con ${p.pareja.nombre} (${p.pareja.original}), que aparece ${pareja.length} veces`,
        repartir(pareja, PAREJA_USES),
        biblia,
      ),
    );
  }
  return docs;
}

function palabraTask(p: PalabraEnTema) {
  const donde = p.hebreo ? 'el Antiguo Testamento' : 'el Nuevo Testamento';
  return `Cuenta la historia de la palabra *${p.nombre}* (${p.original}), del ${p.hebreo ? 'hebreo' : 'griego'}, a lo largo de ${donde}. Que se lea como un relato breve y fiel, no como un diccionario: la persona descubre cómo la palabra va mostrando algo nuevo de un pasaje a otro.

Formato estricto, sin texto antes del primer título:

## Qué significa
Un párrafo de 50 a 90 palabras: el sentido de la palabra según el léxico, cuántas veces aparece y cómo se suele traducir en los pasajes.

## Un título de 2 a 6 palabras para el primer momento
De 4 a 6 momentos, cada uno con su título "## ", en el orden de la Biblia. Cada momento es un pasaje (o dos del mismo libro) de la lista: un párrafo de 60 a 110 palabras con qué pasa ahí, quién habla y qué muestra la palabra en ese lugar, con su cita.

## El hilo
Un párrafo de 50 a 90 palabras: qué une a los momentos y cómo crece la palabra.${
    p.pareja ? ` Si ayuda, cuenta cómo la idea sigue en *${p.pareja.nombre}* (${p.pareja.original}), con los pasajes de esa lista.` : ''
  } Relaciónalo con Cristo solo si los pasajes lo sostienen, sin forzarlo.

## Para pensar
- Dos preguntas abiertas, una por línea, que lleven de vuelta a los pasajes.

Elige momentos de libros distintos que muestren matices diferentes. Extensión total: 550 a 850 palabras.`;
}

function palabraPodcastTask(p: PalabraEnTema) {
  return `Escribe el guion de un pódcast sobre la historia de la palabra ${p.nombre} (${p.original}) por la Biblia, como una conversación entre dos personas que estudian juntas: Ana y Tomás. Se escuchará con voz sintetizada, de 5 a 7 minutos.

Formato estricto: cada intervención en su propia línea, empezando por «ANA:» o «TOMÁS:», sin títulos, sin listas, sin markdown, sin acotaciones entre paréntesis ni efectos de sonido.

Contenido:
- Abran con una pregunta o una escena que despierte interés por la palabra; no se presenten ni saluden con fórmulas de radio.
- Digan la palabra como se lee en español («${p.nombre}») y expliquen qué significa según el léxico.
- Recorran de 4 a 6 pasajes de la lista en el orden de la Biblia: qué pasa en cada uno y qué muestra ahí la palabra.${
    p.pareja ? `\n- Hacia el final, cuenten cómo sigue la idea en ${p.pareja.nombre}, con uno o dos pasajes de esa lista.` : ''
  }
- Que uno pregunte y el otro explique, y que se alternen; intervenciones de 1 a 4 frases, en un español hablado y natural.
- No es un sermón: expliquen el texto, no prediquen ni den consejos largos.
- Cierren con una o dos preguntas para que quien escucha siga pensando, sin respuesta.
- Las citas bíblicas, con palabras («Rut tres, diez»).

Extensión: 800 a 1000 palabras. Empieza directamente por la primera línea del diálogo.`;
}

async function palabraPost(request: Request, body: Body) {
  const palabra = typeof body.palabra === 'string' ? palabraPorId(body.palabra) : null;
  if (!palabra) return badRequest('Palabra no válida');
  if (body.herramienta !== undefined && body.herramienta !== 'podcast') return badRequest('Herramienta no válida');
  if (
    (body.nueva !== undefined && typeof body.nueva !== 'boolean') ||
    body.book !== undefined ||
    body.chapter !== undefined ||
    body.verse !== undefined ||
    body.word !== undefined ||
    body.taller !== undefined ||
    body.enfoque !== undefined ||
    (Array.isArray(body.messages) ? body.messages.length > 0 : body.messages !== undefined)
  ) {
    return badRequest('Pedido no válido');
  }
  const tool = body.herramienta === 'podcast' ? 'palabra-podcast' : 'palabra';
  if (!body.nueva) {
    const saved = await savedTool(tool, palabra.id, 0);
    if (saved) {
      return ndjson([...saved.fuentes.map((f) => ({ type: 'source', ...f })), { type: 'text', text: saved.texto }, { type: 'done' }]);
    }
  }
  const denied = await needsAccount(request);
  if (denied) return denied;

  const books = await load<Book[]>('books.json');
  // La historia de una palabra es la misma para todos: siempre con la RV1909.
  const docs = await palabraSources(palabra, new Biblia(request, (await lectura(undefined))!, books));
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: [
        ...docs.map((d) => d.param),
        { type: 'text', text: tool === 'palabra' ? palabraTask(palabra) : palabraPodcastTask(palabra) },
      ],
    },
  ];
  return streamAnswer(request, docs, messages, SYSTEM + PALABRA_SYSTEM, MODEL, (saved) => saveTool(tool, palabra.id, 0, saved), undefined, true);
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  // La historia de una palabra ya preparada se lee sin cuenta: se mira el pedido antes que la sesión.
  const peek: unknown = await request
    .clone()
    .json()
    .catch(() => null);
  if (peek && typeof peek === 'object' && 'palabra' in peek) return palabraPost(request, peek as Body);
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
  if (body.semana !== undefined && (!validSemana(body.semana) || taller || verse !== undefined || word !== undefined || turns.length > 0)) {
    return badRequest('Notas del sermón no válidas');
  }
  const semana = body.semana;
  const herramienta = body.herramienta;
  if (body.enfoque !== undefined && !['devocional', 'profundo'].includes(body.enfoque)) return badRequest('Enfoque no válido');
  const devocional = body.enfoque === 'devocional' && !taller && !herramienta && word === undefined;
  if (body.publico !== undefined && body.publico !== 'jovenes') return badRequest('Público no válido');
  // El Taller es para preparar mensajes: no cambia con el modo.
  const jovenes = body.publico === 'jovenes' && !taller;
  if (
    herramienta !== undefined &&
    (!Object.hasOwn(HERRAMIENTAS, herramienta) || verse !== undefined || taller || semana || turns.length > 0)
  ) {
    return badRequest('Herramienta no válida');
  }
  if (body.nueva !== undefined && (typeof body.nueva !== 'boolean' || !herramienta)) return badRequest('Pedido no válido');
  // Las herramientas (pódcast, tarjetas, mapa) se guardan por capítulo para todos: siempre con la RV1909.
  const version = await lectura(herramienta ? undefined : body.version);
  if (!version) return badRequest('Versión no válida');

  // Una pregunta frecuente del capítulo: la respuesta es la misma para todos y se guarda como el estudio.
  let frecuente: { texto: string; versiculo: number | null } | null = null;
  if (body.frecuente !== undefined) {
    const id = Number(body.frecuente);
    if (!Number.isInteger(id) || herramienta || taller || semana || word !== undefined || turns.length > 0 || jovenes) {
      return badRequest('Pregunta no válida');
    }
    frecuente = await frecuenteDe(id, book.id, chapter).catch((err) => {
      console.error('estudiar: pregunta frecuente', err);
      return null;
    });
    if (!frecuente) return badRequest('Esa pregunta ya no está', 404);
  }
  const focusVerse = frecuente ? (frecuente.versiculo ?? undefined) : verse;

  // El primer estudio de un pasaje (sin preguntas ni Taller) se guarda para todos. La semana es de cada persona.
  const clave = frecuente
    ? `faq:${Number(body.frecuente)}` + (version.id === 'rv1909' ? '' : `:${version.id}`)
    : !herramienta && !taller && !semana && turns.length === 0
      ? [
          STUDY_VERSION + (version.id === 'rv1909' ? '' : `-${version.id}`),
          (devocional ? 'devocional' : 'profundo') + (jovenes ? '-jovenes' : ''),
          book.id,
          chapter,
          verse ?? '',
          word ?? '',
        ].join(':')
      : null;

  if (body.senales !== undefined || body.senal !== undefined) {
    if (!clave || frecuente) return badRequest('Pedido no válido');
    return senalesPost(request, body, clave, book, chapter, verse);
  }

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

  // Lo que no se guarda para todos gasta la lámpara diaria de la cuenta.
  const compartido = Boolean(herramienta || clave);
  if (!compartido) {
    const vacia = await gastarLampara(request);
    if (vacia) return vacia;
  }
  // Una pregunta sobre el pasaje (no del Taller ni de la semana, nunca del Modo Jóvenes) que la persona deja compartir.
  if (body.compartir === true && turns.length > 0 && !taller && !semana && !jovenes && body.publico === undefined) {
    await guardarPregunta(request, book.id, chapter, verse, turns[turns.length - 1].text);
  }

  const biblia = new Biblia(request, version, books);
  let docs;
  let focus;
  let hasOriginal = false;
  try {
    ({ docs, focus, hasOriginal } = await buildSources(biblia, book, chapter, focusVerse, word));
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
          text: frecuente
            ? frecuenteTask(book, chapter, frecuente.versiculo, frecuente.texto)
            : semana
            ? semanaTask(book, chapter, semana)
            : taller
            ? tallerTask(book, chapter, verse, taller)
            : herramienta
              ? HERRAMIENTAS[herramienta](book, chapter, hasOriginal && book.interlinear)
              : focus && verse
              ? wordTask(book, chapter, verse, focus, version.abbr)
              : devocional
              ? devotionalTask(book, chapter, verse)
              : studyTask(book, chapter, verse, hasOriginal && book.interlinear),
        },
      ],
    },
    ...turns.map((t) => ({ role: t.role, content: t.text })),
  ];

  // Investigar otros pasajes y fuentes: en las preguntas de la persona. El primer estudio se basta con el pasaje.
  const investiga = turns.length > 0;
  const system =
    (frecuente ? SYSTEM : semana ? SYSTEM + SEMANA_SYSTEM : taller ? SYSTEM + TALLER_SYSTEM : devocional ? SYSTEM + DEVOCIONAL_SYSTEM : SYSTEM) +
    versionSystem(version) +
    (investiga ? TOOLS_SYSTEM : '') +
    (jovenes ? JOVENES_SYSTEM : '');
  return streamAnswer(
    request,
    docs,
    messages,
    system,
    compartido ? MODEL : MODEL_PROPIO,
    async (saved) => {
      if (herramienta) await saveTool(herramienta, book.id, chapter, saved);
      else if (clave) await saveStudy(clave, saved);
    },
    investiga ? biblia : undefined,
    compartido,
  );
}

type Doc = ReturnType<typeof doc>;

/**
 * Pide la respuesta a Claude y la envía por partes; «save» guarda la respuesta completa. Con «biblia», la IA puede
 * usar las herramientas de api/_investigar.ts: cada vuelta envía lo que consulta y sigue hasta que responde.
 * Con «compartido» (lo que se guarda para todos) sigue hasta guardarla aunque la persona se vaya: en iPhone, al
 * bloquear la pantalla o salir de la app, Safari corta la conexión, y sin esto el estudio nunca quedaba guardado.
 */
function streamAnswer(
  request: Request,
  docs: Doc[],
  messages: Anthropic.Beta.BetaMessageParam[],
  system: string,
  model: string,
  save: (saved: Saved) => Promise<void>,
  biblia?: Biblia,
  compartido = false,
) {
  const encoder = new TextEncoder();
  // Si la persona cierra la conexión, lo que queda por enviar se descarta.
  let abierto = true;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      abierto = false;
    },
    async start(controller) {
      const send = (event: object) => {
        if (!abierto) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        } catch {
          abierto = false;
        }
      };
      const work = generate(send).finally(() => {
        if (!abierto) return;
        abierto = false;
        controller.close();
      });
      if (compartido) waitUntil(work);
      await work;
    },
  });

  async function generate(send: (event: object) => void) {
    const sources = new Map<string, number>();
    // Bloques de cada search_result que devolvieron las herramientas, en el orden en que la IA los recibió.
    const results: BlockMeta[][] = [];
    // Lo enviado, para guardar la herramienta tal cual la recibió la persona
    let texto = '';
    const fuentes: Saved['fuentes'] = [];
    const cite = (metas: BlockMeta[], from: number, to: number, into: Set<number>) => {
      for (let i = from; i < to; i++) {
        const meta = metas[i];
        if (!meta) continue;
        let n = sources.get(meta.label);
        if (n === undefined) {
          n = sources.size + 1;
          sources.set(meta.label, n);
          fuentes.push({ n, ...meta });
          send({ type: 'source', n, ...meta });
        }
        into.add(n);
      }
    };
    const history = [...messages];
    try {
      for (let round = 0; ; round++) {
        const pending = new Map<number, Set<number>>();
        const last = !biblia || round >= MAX_ROUNDS;
        const response = client.beta.messages.stream(
          {
            model,
            max_tokens: 16000,
            system,
            messages: history,
            // En la última vuelta las herramientas siguen declaradas (la conversación las usó), pero ya no se pueden pedir.
            ...(biblia && { tools: TOOLS, tool_choice: { type: last ? 'none' : 'auto' } as const }),
            cache_control: { type: 'ephemeral' },
            output_config: { effort: 'medium' },
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          },
          // Lo que se guarda para todos termina aunque la persona se haya ido; lo suyo se detiene con ella.
          { signal: compartido ? undefined : request.signal },
        );
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            texto += event.delta.text;
            send({ type: 'text', text: event.delta.text });
          } else if (event.type === 'content_block_delta' && event.delta.type === 'citations_delta') {
            const c = event.delta.citation;
            if (!pending.has(event.index)) pending.set(event.index, new Set());
            const into = pending.get(event.index)!;
            if (c.type === 'content_block_location') cite(docs[c.document_index]?.metas ?? [], c.start_block_index, c.end_block_index, into);
            else if (c.type === 'search_result_location') cite(results[c.search_result_index] ?? [], c.start_block_index, c.end_block_index, into);
          } else if (event.type === 'content_block_stop' && pending.has(event.index)) {
            // Las marcas van al final del fragmento citado, como notas al pie.
            const marks = [...pending.get(event.index)!].map((n) => `⟦${n}⟧`).join('');
            if (marks) {
              texto += marks;
              send({ type: 'text', text: marks });
            }
            pending.delete(event.index);
          }
        }
        const final = await response.finalMessage();
        const calls = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
        if (biblia && final.stop_reason === 'tool_use' && calls.length) {
          // Separa lo que hubiera escrito antes de investigar de la respuesta que viene después.
          if (texto && !texto.endsWith('\n\n')) {
            texto += '\n\n';
            send({ type: 'text', text: '\n\n' });
          }
          const inputs = calls.map((call) => (call.input && typeof call.input === 'object' ? (call.input as Record<string, unknown>) : {}));
          calls.forEach((call, i) => send({ type: 'paso', ...pasoDe(call.name, inputs[i], biblia) }));
          const done = await Promise.all(calls.map((call, i) => investigar(call.name, inputs[i], biblia)));
          done.forEach((d) => results.push(...d.results));
          history.push(
            { role: 'assistant', content: final.content },
            {
              role: 'user',
              content: calls.map((call, i) => ({
                type: 'tool_result' as const,
                tool_use_id: call.id,
                content: done[i].content,
                ...(done[i].error && { is_error: true }),
              })),
            },
          );
          continue;
        }
        if (final.stop_reason === 'refusal') {
          send({ type: 'error', message: 'No puedo ayudar con esta pregunta. Prueba a formularla de otra manera.' });
        } else {
          // Solo se guarda una respuesta completa
          if (final.stop_reason === 'end_turn' && texto.trim()) {
            await save({ texto, fuentes });
          }
          send({ type: 'done' });
        }
        break;
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
    }
  }

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
