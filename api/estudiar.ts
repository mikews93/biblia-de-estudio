// Función de Vercel: genera un estudio de un capítulo o versículo y responde preguntas sobre él.
// Con «word» (posición de una palabra hebrea o griega en el versículo) explica esa palabra: «¿Por qué esta palabra?».
// Con «semana» convierte las notas de un sermón en cinco días de devocional sobre su pasaje («Del sermón a tu semana»).
// Con «tema» (sin pasaje) investiga lo que alguien quiere tratar en el Taller: pasajes, comentarios y teologías.
// Con «pregunta» (sin pasaje) responde una pregunta libre del buscador (src/lib/preguntar.ts); la de una pregunta que
// muchos hacen («preparada») se guarda para todos y se lee sin cuenta.
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
  fichasDe,
  load,
  pasoDe,
  versionSystem,
} from './_investigar';
import { corregirRespuesta } from './_corregir';
import { guardarPregunta } from './_preguntas';
import { marcar, SENALES_SCHEMA, senalesDe } from './_senales';
import { Registro, detener, reanudar } from './_reanudar';
import { waitUntil } from './_seguir';
import { DINAMICAS } from '../src/lib/dinamicas';
import { describeMorph } from '../src/lib/morph';
import { original } from '../src/lib/original';
import { PalabraEnTema, palabraPorId, unirApariciones } from '../src/lib/palabras';
import { conVersion, versionPodcast } from '../src/lib/podcastVersion';
import { PREPARADAS } from '../src/lib/preguntasPreparadas';
import { ordenarVueltas, recortarVueltas } from '../src/lib/turnos';

// Lo que se guarda para todos (el primer estudio de un pasaje, las herramientas) se paga una vez: va con el mejor modelo.
// Lo de cada persona (preguntas de seguimiento, Taller, semana) se paga cada vez: va con uno más barato.
const MODEL = process.env.ESTUDIO_MODEL ?? 'claude-opus-5-5';
const MODEL_PROPIO = process.env.ESTUDIO_MODEL_PROPIO ?? 'claude-sonnet-5-5';
// Palabras de cada comentario que lee la IA: para un versículo y para un capítulo entero.
const COMMENT_WORDS = { verse: 700, chapter: 1200 };
// Cambia cuando cambian las fuentes del estudio, para que los estudios guardados antes se preparen de nuevo.
// c2: los comentaristas ya no se nombran en el texto, solo en sus citas.
const STUDY_VERSION = 'c2';
// Con una versión con derechos los estudios usan marcas ⟪Juan 3:16⟫ en vez de citar la RV1909 (ver versionSystem):
// los guardados antes citaban la RV1909, así que se preparan de nuevo.
const MARCAS = 'm1';
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
  /** Taller desde un tema: lo que la persona quiere tratar, grabado o escrito, todavía sin pasaje. */
  tema?: Tema;
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
  /** Id (UUID) que pone la app en cada pregunta: la respuesta sigue aunque se corte la conexión (api/_reanudar.ts). */
  seguir?: string;
  /** El id de una pregunta cuya conexión se cortó: devuelve lo que lleva escrito la IA. */
  reanudar?: string;
  /** El id de una pregunta que la persona detuvo: la IA deja de escribir. */
  detener?: string;
  /** Una pregunta libre sobre la Biblia desde el buscador (src/lib/preguntar.ts), sin pasaje. */
  pregunta?: Pregunta;
  /** Pide las señales del estudio de este pasaje (api/_senales.ts). */
  senales?: true;
  /** Marca o quita «Me ayudó» («ayudo») o «Algo suena raro» («raro», con motivo y nota) en el estudio de este pasaje. */
  senal?: { tipo?: unknown; quitar?: unknown; motivo?: unknown; nota?: unknown };
};
// Del sermón a tu semana: lo que la persona anotó del sermón del domingo, para cinco días de devocional.
type Semana = { notas: string; desde?: number; hasta?: number; predicador?: string };
// Ayuda del Taller (preparar reflexiones, encuentros y sermones): la IA pregunta, sugiere o revisa; en el Taller con
// borrador («borrador», «cambiar») escribe el borrador que la persona revisa y hace suyo.
type Taller = {
  /** «repaso»: las preguntas de opción múltiple que la congregación responde en vivo durante el evento (api/vivo.ts).
   *  «maqueta»: el esqueleto del mensaje a partir de un tema (títulos, preguntas guía y pasajes de apoyo).
   *  «corregir»: correcciones puntuales a lo que la persona ya escribió, según la revisión (src/lib/correcciones.ts).
   *  «borrador»: el mensaje completo, escrito como borrador para que la persona lo revise (src/lib/borrador.ts).
   *  «cambiar»: lo que la persona pide cambiar del borrador, hablándole a la IA, parte por parte.
   *  «practicar»: un repaso hablado del mensaje, para escucharlo y aprenderlo antes de exponerlo. */
  modo: 'preguntar' | 'sugerir' | 'revisar' | 'repaso' | 'ruleta' | 'maqueta' | 'corregir' | 'borrador' | 'cambiar' | 'practicar';
  tipo: 'reflexion' | 'encuentro' | 'sermon';
  paso: 'pasaje' | 'idea' | 'bosquejo' | 'revisar';
  plantilla?: string;
  desde?: number;
  hasta?: number;
  borrador?: string;
  /** Lo que la persona quería tratar cuando empezó desde un tema. */
  situacion?: string;
  /** Solo «corregir»: la revisión que hizo la IA y que las correcciones aplican. */
  revision?: string;
  /** Solo «borrador»: lo que la persona marcó de la investigación y hacia dónde quiere llevar el mensaje. */
  investigacion?: string;
  direccion?: string;
  /** Solo «borrador»: los minutos que tiene para el mensaje. */
  minutos?: number;
  /** Solo «cambiar»: lo que la persona pide cambiar, dicho o escrito. */
  pedido?: string;
};
/** «preparar»: el Taller con borrador; la investigación es más amplia y también busca predicaciones en la web. */
type Tema = { texto: string; tipo: Taller['tipo']; preparar?: boolean; estudio?: EstudioPrevio };
/** Un estudio profundo que la persona convierte en mensaje: el pasaje, el estudio que leyó y las preguntas que hizo. */
type EstudioPrevio = { cita: string; texto: string; preguntas: { pregunta: string; respuesta: string }[] };
// «sencillo»: corto y sin palabras técnicas; «fondo»: con contexto, el original y las fuentes. «preparada»: el id de una
// de las preguntas que muchos hacen (src/lib/preguntasPreparadas.ts), cuya respuesta se guarda para todos.
type Pregunta = { texto: string; nivel: 'sencillo' | 'fondo'; preparada?: string };

const SYSTEM = `Eres el asistente de estudio de una app bíblica gratuita en español. Ayudas a entender el texto; no sustituyes la lectura de la persona ni predicas por ella.

Fuentes: en cada conversación recibes documentos de la app: el capítulo en la versión con la que trabajas (la Reina-Valera 1909 si no se dice otra), el texto original palabra por palabra (hebreo y arameo del Antiguo Testamento, griego del Nuevo) con su análisis gramatical (STEPBible, Tyndale House), referencias cruzadas votadas por lectores (OpenBible.info) y lo que dicen del pasaje los comentarios bíblicos de la app, en su inglés original (las notas de estudio de Tyndale y comentaristas clásicos como Matthew Henry, Calvino o Spurgeon).

Reglas:
- Basa lo que afirmes en esos documentos y cítalos cada vez que los uses.
- Los comentarios ayudan a entender el texto (contexto, historia, costumbres, el sentido de una frase), pero son opiniones humanas, no tienen la autoridad de la Biblia. Cuando uses uno, no nombres al autor ni la obra en el texto: la cita ya dice de quién es y la persona la puede tocar. Preséntalo como una ayuda («un comentario señala…», «las notas de estudio explican…», «otro comentarista lo lee distinto…») o di la idea y cítala; dilo con tus palabras en español sin copiar párrafos. Nombra al autor solo si la persona pregunta quién lo dice. Si los comentaristas no coinciden, muéstralo sin tomar partido. Nunca atribuyas a un comentario algo que no dice.
- Si algo no está en los documentos (autoría, fechas, historia, costumbres), dilo así: «esto no está en las fuentes de la app». Solo si de verdad ayuda, añade contexto general ampliamente aceptado, breve y marcado como «contexto general», sin inventar datos, fechas ni citas de autores.
- Para el hebreo y el griego usa la glosa, el lema y la gramática del documento; no inventes significados ni etimologías.
- Cada versículo que nombres o copies tiene que ser exacto. Copia entre comillas solo palabras que tengas delante en los documentos o en lo que leíste con las herramientas, tal cual están, con su libro, capítulo y versículo; nunca de memoria. Si no estás seguro del versículo exacto, léelo antes (si tienes herramientas) o di la idea con tus palabras y cita solo el capítulo. La app revisa cada cita con el texto de la Biblia y quita las que no cuadran.
- Responde desde la lectura evangélica del texto. Cuando las tradiciones evangélicas y protestantes lo entienden distinto (el bautismo, la elección, los últimos tiempos), muestra cada postura con respeto y sin tomar partido. No presentes las posturas católica u ortodoxa como opciones; si la persona pregunta por ellas, explícalas con respeto y di con honestidad cuando no se apoyan con claridad en el texto bíblico.
- No uses ni presentes como interpretación cristiana las enseñanzas de grupos que niegan doctrinas centrales del cristianismo histórico, como la Trinidad o la divinidad de Cristo (por ejemplo, Testigos de Jehová o mormones).
- Escribe en español claro y cálido para alguien sin formación teológica: párrafos cortos, títulos con "## ", listas con "- " y **negritas** solo para palabras clave. Sin tablas.
- En las preguntas de seguimiento responde a lo que se pregunta, con la misma regla de fuentes. Si la pregunta no tiene que ver con la Biblia o con el estudio, redirígela con amabilidad.`;

// Solo cuando la IA tiene herramientas (en las preguntas de seguimiento).
const TOOLS_SYSTEM = `

Herramientas: puedes investigar más allá del pasaje abierto: leer otros pasajes, buscar palabras en toda la Biblia, ver referencias cruzadas, el texto original y la concordancia, consultar los comentarios de la app sobre cualquier pasaje, buscar en teologías sistemáticas clásicas, credos, catecismos, historias del canon y de las herejías y los concilios, de dominio público, y en dos diccionarios bíblicos y un índice por temas.
- Úsalas cuando la pregunta va más allá del pasaje (un tema que recorre la Biblia, otro libro, una pregunta general como «¿cómo se formó el canon?») o cuando vayas a hablar de otro pasaje: léelo antes y cítalo.
- No las uses si los documentos del pasaje ya bastan. Pide varias a la vez cuando no dependan unas de otras, y no más de las necesarias: la persona espera la respuesta.
- No escribas nada antes de terminar de investigar: tu respuesta empieza cuando ya tienes lo que necesitas.
- Para doctrina o historia de la Iglesia (el canon, los concilios, la Trinidad, la justificación) consulta «teologia» y presenta cada postura como la de su tradición («la tradición reformada», «una teología metodista», «un credo antiguo»), sin nombrar al autor en el texto: la cita dice quién es. Si las obras difieren (sobre la elección, sobre el bautismo), muestra las dos posturas sin tomar partido. La Escritura va primero: apoya lo que digas en pasajes leídos con las otras herramientas.
- Para herejías y controversias antiguas (el modalismo o sabelianismo, el arrianismo, el gnosticismo, el nestorianismo, el pelagianismo) y lo que decidieron los concilios (Nicea, Constantinopla, Éfeso, Calcedonia), consulta «teologia» con el área «herejias» y, si sirve, también «credos» y «sistematicas». Explica con justicia qué enseñaban, por qué la Iglesia lo rechazó, con qué pasajes, en qué concilio o credo, y qué afirma la fe que se confesó en su lugar. Aquí no hay dos posturas que equilibrar: la Trinidad y la persona de Cristo tal como las confiesan los credos antiguos son la fe que comparten todas las tradiciones evangélicas. Si hoy algún grupo enseña algo parecido, puedes decirlo con respeto y sin burla, sin usar sus materiales.
- Para las personas y los lugares de un pasaje (de dónde venía alguien, su tribu o pueblo, su familia, su ciudad, si era grande o pequeña) y el momento histórico del capítulo, consulta «personajes_y_lugares»: son las fichas de la app, unidas entre sí, con su línea de tiempo.
- Para explicar algo concreto de la Biblia (un lugar como Getsemaní, un objeto como el efod, un grupo como los fariseos, una costumbre o una palabra como «propiciación») consulta «diccionario». Para reunir lo que la Biblia dice de un tema (la oración, el perdón, el matrimonio) consulta «temas_biblicos» y lee los pasajes más fuertes antes de usarlos.
- Lo que encuentres con ellas se cita igual que los documentos. Si algo no está en ninguna fuente de la app, márcalo como «contexto general», breve y sin inventar fechas ni citas.
- Antes de nombrar o copiar un versículo que no está en los documentos, léelo con «leer_pasaje» (o encuéntralo con «buscar_en_la_biblia»): nunca des una referencia de memoria.`;

// La búsqueda en la web del Taller con borrador: predicaciones y estudios evangélicos. Se dejan fuera los sitios de
// grupos que niegan doctrinas centrales y los católicos (decisiones de Mike del 2026-10-18 y 2026-10-27).
const WEB_BLOQUEADOS = [
  'jw.org',
  'churchofjesuschrist.org',
  'lds.org',
  'christianscience.com',
  'christadelphians.org',
  'aletheiacollege.net',
  'carelinks.net',
  'adventist.org',
  'adventistas.org',
  'upci.org',
  'iglesiapentecostalunida.org',
  'vatican.va',
  'catholic.net',
  'catholic.com',
  'catholic.org',
  'aciprensa.com',
  'ewtn.com',
  'opusdei.org',
  'corazones.org',
  'vaticannews.va',
];
const WEB_TOOL: Anthropic.Beta.BetaWebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 5,
  blocked_domains: WEB_BLOQUEADOS,
};
const WEB_SYSTEM = `

Búsqueda en la web: puedes buscar predicaciones y estudios en la web. Usa solo los de iglesias y ministerios evangélicos; descarta los de grupos que niegan la Trinidad o la divinidad de Cristo y los católicos. Lo que tomes de ellos se cita igual, sin nombrar al predicador en el texto. La Biblia y las fuentes de la app van primero: la web solo aporta ideas y enfoques.`;

const TALLER_SYSTEM = `

Ahora acompañas a alguien en el Taller de la app, donde prepara una reflexión, un encuentro de grupo o un sermón. Eres un acompañante que pregunta y sugiere, no un escritor fantasma: el valor está en que la persona estudie, ore y prepare.

Reglas del Taller:
- Nunca escribas un sermón, una reflexión o una guía completa, ni redactes secciones enteras listas para leer o predicar. Si te lo piden, explica con amabilidad que la preparación es suya y ofrece preguntas, opciones o un esquema de ideas para que la persona lo escriba.
- Lo que digas sobre el texto, el hebreo o el griego, o los pasajes relacionados lleva su cita, con la misma regla de fuentes.
- No inventes anécdotas como si fueran reales. Si sugieres una ilustración, márcala como «Ejemplo, no hecho real», en una o dos frases.
- Ayuda a que el mensaje tenga una sola idea central que salga del texto, nombre la necesidad humana que el pasaje toca y ponga la gracia de Dios en el centro, no solo consejos.
- Sé breve: lo justo para dar el siguiente paso.`;

// El Taller con borrador: la persona ora, la IA investiga, la persona da la dirección y la IA escribe el borrador.
// Reemplaza la regla del Taller de no escribir el mensaje (Mike lo decidió el 2026-11-07): es un borrador que la persona
// revisa, cambia y hace suyo.
const BORRADOR_SYSTEM = `

Ahora acompañas a alguien en el Taller de la app, donde prepara una reflexión, un encuentro de grupo o un sermón. Esta persona ya oró, revisó la investigación y te dio la dirección: te pide que escribas el borrador completo del mensaje, para leerlo entero, ver si quedó bien y cambiar lo que quiera. Es su mensaje: tú le ahorras el trabajo de redactar.

Reglas del borrador:
- Sigue la dirección que te dio y las ideas que marcó de la investigación; no cambies el rumbo por tu cuenta.
- Que el mensaje tenga una sola idea central que salga del texto, nombre la necesidad humana que el pasaje toca y ponga la gracia de Dios en el centro, no solo consejos.
- Escribe para decirlo en voz alta: frases claras, cálidas y cortas, en segunda persona o en «nosotros», sin tecnicismos. Que se pueda leer de corrido.
- Usa todas las fuentes de la app para complementar el mensaje (comentarios, texto original, diccionario bíblico, temas, teologías, credos) y cita cada cosa que tomes de ellas. Cada afirmación sobre el texto, el hebreo o el griego, la historia o las costumbres lleva su cita. Si no lo encontraste en una fuente, no lo afirmes: nada de datos, fechas, cifras ni citas de memoria.
- Los versículos que copies, exactos y leídos con las herramientas; la app revisa cada cita con la Biblia y corrige las que no cuadran.
- No nombres a comentaristas, teólogos ni predicadores en el texto: la cita ya dice de quién es.
- No inventes anécdotas como si fueran reales ni pongas palabras en boca de la persona («cuando yo estaba…»). Si una ilustración ayuda, márcala como «Ejemplo:» y que sea breve; si sirve una historia personal, deja el hueco entre corchetes para que la ponga ella: [Aquí, una historia tuya sobre…].
- Las dinámicas salen solo del catálogo de la app.
- Usa el momento histórico y a los protagonistas para que el texto se vea vivo: de dónde venían, qué pasaba alrededor, a quién escogió Dios (muchas veces a los pequeños o despreciados) y por qué eso importa hoy. Cada dato con su cita.`;

const TEMA_SYSTEM = `

Esta vez la persona no llega con un pasaje: te cuenta una situación o un tema del que quiere hablar, a veces dictado en voz alta y con errores del dictado. No hay documentos del pasaje: todo lo que digas sale de lo que investigues con las herramientas.
- Parte de lo que la persona contó, pero deja que la Escritura defina el mensaje: propone pasajes que de verdad tratan el tema en su contexto, no versículos sueltos que solo comparten una palabra.
- Lee cada pasaje antes de proponerlo. Consulta los comentarios de la app sobre los más fuertes y, si el tema toca doctrina (la gracia, el perdón, el sufrimiento, la soberanía de Dios), la teología.
- Si la situación es personal o delicada (un duelo, una crisis, un conflicto en la iglesia), trátala con respeto y sin juzgar a nadie; no des consejo pastoral ni médico, ayuda a preparar el mensaje.`;

const PREGUNTA_SYSTEM = `

La persona te hace una pregunta sobre la Biblia o la fe desde el buscador de la app, sin un pasaje abierto, a veces dictada en voz alta y con errores del dictado. No hay documentos del pasaje: todo lo que digas sale de lo que investigues con las herramientas.
- Investiga antes de responder: lee los pasajes que vas a usar, en su contexto, y no cites ninguno que no hayas leído. Si la pregunta es sobre un tema («¿qué dice la Biblia sobre…?»), empieza por el índice por temas; si trata de algo concreto (un lugar, una persona, una costumbre), por el diccionario; si toca doctrina, una herejía antigua, un concilio o la historia de la Biblia, consulta la teología; si toca un pasaje concreto, sus comentarios.
- Responde a lo que se pregunta, con honestidad: si la Biblia no lo dice o no lo dice con claridad (fechas del fin, detalles del cielo), dilo así y explica lo que sí dice.
- Eres una ayuda para entender, no un pastor ni la voz de Dios: nada de «Dios te dice…», no escribas oraciones para que la persona las rece ni sermones.
- Si la pregunta es personal o delicada (un duelo, una culpa, una crisis en casa), responde con calidez y sin juzgar, y anima a hablarlo con alguien de confianza en su iglesia. Si menciona que quiere hacerse daño o que alguien le hace daño, deja la respuesta a un lado: dile con calidez que no tiene que pasarlo sin ayuda, que hable hoy con alguien de confianza y que si está en peligro llame a emergencias.
- No des consejo médico, legal ni financiero más allá de lo que dice el texto.`;

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
V: una sola cita que la respalda (por ejemplo «1 Reyes 18:21»)

Haz 12 preguntas: cada categoría en sus tres niveles (una de nivel 1, una de 2 y una de 3).
- «texto», lo que dice: qué pasa, quién, en qué orden. Solo esta categoría pregunta por datos.
- «sentido», qué significa: por qué se dice algo, qué quiere decir una palabra o una imagen, cómo se conecta con otra parte.
- «tema»: la idea central y lo que enseña de Dios, de Cristo o de la gracia; que obligue a pensar el mensaje, no a recordarlo.
- «vida», para la vida: una situación concreta de hoy (en la casa, el trabajo, el colegio, la iglesia) y cuál respuesta vive mejor esta enseñanza.
Dificultad: el nivel 1 se responde con una lectura atenta; el 2 pide relacionar dos partes; el 3 pide pensar en serio, con opciones que se parecen y solo una fiel al texto.
- Aunque inviten a reflexionar, cada pregunta tiene una sola respuesta correcta que el texto sostiene; las otras son creíbles pero el texto las descarta (en «vida», respuestas que suenan bien pero no son lo que enseña el pasaje). Nada de opinión personal ni de doctrina discutida entre iglesias.
- Opciones cortas (máximo 15 palabras, también en «vida») y parecidas en largo; que la correcta no sea siempre la misma letra. Nada de sí o no, ni de «todas las anteriores».`;

const REPASO_FORMATO = `Formato estricto, sin títulos ni introducción, con una línea en blanco entre preguntas:
P: la pregunta (una sola, concreta, de máximo 20 palabras)
A) opción
B) opción
C) opción
D) opción
R: la letra de la opción correcta
V: la cita que la respalda (por ejemplo «Juan 3:16»)`;

// La investigación de un tema sin pasaje. src/lib/tallerTema.ts lee este formato.
function temaTask(t: Tema) {
  if (t.preparar) return prepararTask(t);
  return `Quiero preparar ${TIPOS[t.tipo]} sobre algo que me importa. Te lo cuento como me salió:

«${t.texto.trim()}»

Investiga con las herramientas antes de responder. Después responde con este formato estricto, sin nada antes ni después:

## Lo que entiendo
Una o dos frases con el tema tal como lo entiendes, sin juzgar a nadie.

## Pasajes
De 3 a 5 líneas, el pasaje más fuerte primero, cada una así:
- Juan 14:1-6 | por qué sirve para este tema, en una frase, con su cita

## Lo que dicen las fuentes
De 2 a 5 líneas con lo que aportan los comentarios de la app y las teologías sobre esos pasajes o sobre el tema, cada una con su cita y sin nombrar al autor («un comentario…», «la tradición reformada…»): la cita dice de quién es.

## Para afinar
2 o 3 preguntas para que yo enfoque el mensaje (a quién va, qué espero que cambie, qué parte de la situación pesa más). Sin respuestas.

Reglas del formato:
- Cada pasaje dentro de un solo capítulo, de 1 a 30 versículos, con el nombre del libro completo en español («1 Corintios 13:4-7», «Salmos 46»), y antes del «|».
- Si te respondo o te pido otra cosa, vuelve a dar la respuesta completa con este mismo formato, ajustada a lo nuevo.`;
}

// La investigación del Taller con borrador: src/lib/tallerTema.ts (leerExploracion) lee este formato.
/** Lo que trae un estudio profundo convertido en mensaje: el estudio y las preguntas de la persona, con sus respuestas. */
function estudioPrevio(e: EstudioPrevio) {
  const preguntas = e.preguntas.map((p) => `- Pregunté: «${p.pregunta.trim()}»\n  Me respondió: ${p.respuesta.trim().replace(/\s*\n+\s*/g, ' ')}`).join('\n');
  return `

Antes estudié ${e.cita} a fondo en la app. Este es el estudio que leí:

<estudio>
${e.texto.trim()}
</estudio>
${
  preguntas
    ? `
Y estas son las preguntas que le hice al estudiar, con lo que me respondió. Son lo que me tocó o me costó entender, y seguramente son las mismas que tendrá la gente: tenlas muy en cuenta.

<preguntas>
${preguntas}
</preguntas>
`
    : ''
}
El mensaje parte de ${e.cita}: que sea el primer pasaje y que los enfoques salgan de él. No repitas sin más el estudio: amplíalo y compruébalo con las fuentes, y cita solo lo que tú leas ahora (el estudio y sus respuestas no se pueden citar).`;
}

function prepararTask(t: Tema) {
  const e = t.estudio;
  return `Quiero preparar ${TIPOS[t.tipo]}. Oré y esto es lo que siento que Dios me puso; te lo cuento como me salió:

«${t.texto.trim()}»${e ? estudioPrevio(e) : ''}

Investiga a fondo antes de responder, con todas las fuentes de la app: el índice por temas para reunir lo que dice la Biblia del tema; lee cada pasaje en su contexto; los comentarios de la app sobre los más fuertes; el texto original de las palabras clave; las fichas de personajes y lugares de la app para cada protagonista, su familia, su pueblo y su ciudad, y para el momento histórico; el diccionario bíblico para lugares, personas, pueblos, costumbres o palabras del texto; los pasajes que cuentan la historia de cada protagonista; y la teología (sistemáticas, credos y catecismos) para lo doctrinal. Busca también en la web predicaciones o estudios de iglesias evangélicas sobre este tema o estos pasajes (de 2 a 4), y lee lo que dicen. Después responde con este formato estricto, sin nada antes ni después:

## Lo que entiendo
Una o dos frases con el tema tal como lo entiendes, sin juzgar a nadie.

## Pasajes
De 3 a 5 líneas, el pasaje más fuerte primero, cada una así:
- Juan 14:1-6 | por qué sirve para este tema, en una frase, con su cita

## Lo que dicen las fuentes
De 3 a 5 líneas con lo que aportan los comentarios de la app y las teologías, cada una con su cita y sin nombrar al autor.

## Puntos de vista
De 1 a 3 líneas donde haya lecturas distintas entre evangélicos sobre el tema o el pasaje, cada una así:
- La pregunta | lo que dice una lectura; lo que dice la otra, con sus citas

## Predicaciones
De 2 a 4 líneas, cada una con una idea útil de una predicación o un estudio que leíste en la web, así:
- El título de la predicación | la idea que aporta, en una o dos frases, con su cita
Solo de iglesias o ministerios evangélicos. Si no encontraste ninguna que valga la pena, escribe solo «- Ninguna».

## Momento histórico
De 2 a 4 líneas con lo que pasaba alrededor cuando ocurrió o se escribió el pasaje (el imperio o el rey de turno, la situación del pueblo, la religión, la economía, las costumbres, la geografía) y por qué ayuda a entenderlo, cada una con su cita.

## Protagonistas
De 1 a 4 líneas, una por cada persona importante del pasaje, así:
- El nombre | de dónde viene (su pueblo o tribu, su ciudad, y si era grande o pequeña, importante o despreciada), su familia y su oficio, lo que vivía en ese momento y cómo era según lo que muestran los textos; y lo que eso enseña de cómo obra Dios, con sus citas
Solo lo que dicen el texto, otros pasajes sobre esa persona o las fuentes de la app: no le inventes sentimientos ni rasgos.

${
    e?.preguntas.length
      ? `
## Lo que preguntaste
Una línea por cada pregunta que hice al estudiar, así:
- La pregunta, corta | cómo puede enriquecer el mensaje (una pregunta para la gente, un punto, una aclaración o una aplicación), con su cita
`
      : ''
  }
## Enfoques
Tres direcciones posibles para el mensaje, cada una así:
- Un título corto | la cita del pasaje principal | la idea central en una frase

Reglas del formato:
- Cada pasaje dentro de un solo capítulo, de 1 a 30 versículos, con el nombre del libro completo en español («1 Corintios 13:4-7», «Salmos 46»).
- No nombres a los autores en el texto: la cita lo dice.
- Si te respondo o te pido otra cosa, vuelve a dar la respuesta completa con este mismo formato, ajustada a lo nuevo.`;
}

function preguntaTask(p: Pregunta) {
  const fondo = p.nivel === 'fondo';
  return `Tengo una pregunta sobre la Biblia:

«${p.texto.trim()}»

Investiga con las herramientas antes de responder. Después responde con este formato, sin nada antes ni después:

## En corto
La respuesta directa en una o dos frases, con su cita.

Debajo, en líneas aparte, la marca de uno o dos versículos clave entre ⟪ y ⟫ (por ejemplo ⟪Filipenses 4:6⟫, o un tramo de hasta tres versículos del mismo capítulo como ⟪Romanos 8:28-30⟫): la app pone en su lugar el versículo en la versión que lee la persona.

## Lo que dice la Biblia
${fondo ? 'De tres a cinco párrafos cortos' : 'Dos o tres párrafos cortos'} con los pasajes que responden la pregunta, leídos en su contexto, cada idea con su cita.${fondo ? ' Si ayuda, explica una palabra del texto original (transliterada en *cursiva*) o el contexto histórico.' : ''}

## Cómo lo han entendido
${fondo ? 'Dos o tres frases' : 'Una o dos frases'} con lo que aportan los comentarios o las teologías, con su cita y sin nombrar al autor. Si no aportan nada a esta pregunta, deja fuera esta parte.

## Para pensar
Una sola pregunta abierta que vuelva al texto y ayude a la persona a llevarlo a su vida. Sin respuesta.

Sigue: dos preguntas cortas que yo podría hacer después, separadas por « | », en una sola línea al final.

Reglas del formato:
- ${fondo ? 'Entre 350 y 600 palabras en total.' : 'Entre 150 y 250 palabras en total, en palabras sencillas: sin términos técnicos sin explicar.'}
- Cada marca ⟪…⟫ con el nombre del libro completo en español («1 Corintios 13:4-7»), en su propia línea y como mucho cuatro en toda la respuesta.
- Si te hago otra pregunta, respóndela con el mismo formato y termina también con la línea «Sigue:».`;
}

function validPregunta(p: unknown): p is Pregunta {
  if (!p || typeof p !== 'object') return false;
  const x = p as Record<string, unknown>;
  return (
    typeof x.texto === 'string' &&
    x.texto.trim().length >= 6 &&
    x.texto.length <= MAX_PREGUNTA &&
    (x.nivel === 'sencillo' || x.nivel === 'fondo') &&
    (x.preparada === undefined || PREPARADAS.some((q) => q.id === x.preparada))
  );
}

// El borrador completo: src/lib/borrador.ts (leerBorrador) lee este formato.
function borradorAsk(t: Taller) {
  const catalogo = DINAMICAS.map((d) => `${d.id}: ${d.nombre} (${d.minutos} min): ${d.objetivo}`).join('\n');
  return `${t.investigacion?.trim() ? `De la investigación marqué esto para usar:\n${t.investigacion.trim()}\n\n` : ''}${
    t.direccion?.trim() ? `La dirección que le quiero dar:\n«${t.direccion.trim()}»\n\n` : ''
  }Escribe el borrador completo del mensaje sobre las partes de la estructura que van en lo que llevo${t.minutos ? `, para unos ${t.minutos} minutos en total` : ''}. Antes de escribir, investiga con todas las fuentes de la app para complementar cada parte: lee los pasajes que vas a citar, los comentarios de la app sobre ellos, el texto original de las palabras clave, el diccionario bíblico para el contexto y la teología para lo doctrinal. Todo lo que tomes de ellas va con su cita; si algo no está en ninguna fuente, no lo afirmes.

Formato estricto, sin nada antes ni después:

# El título del mensaje (de 2 a 8 palabras)

## Idea central
- Tema: … | Complemento: …

Después, un título "## " por cada parte de la estructura, en su orden, en la forma "## Título de la parte | minutos" (por ejemplo "## Introducción | 5"), y bajo cada uno:
- el texto de esa parte en párrafos, tal como se diría, con sus citas;
- si encaja una dinámica, una línea "> dinámica: el id del catálogo";
- al final, de 1 a 3 líneas "* " con los puntos clave de esa parte para tenerlos a mano al presentar (máximo 12 palabras cada uno).

Catálogo de dinámicas (id: nombre (minutos): para qué):
${catalogo}

Reglas:
- ${t.tipo === 'sermon' ? 'Los títulos de los puntos («Punto 1», «Punto 2»…) cámbialos por un título corto que salga del texto; las demás partes conservan su nombre.' : 'Cada parte conserva su nombre exacto.'}
- ${
    t.tipo === 'encuentro'
      ? 'En un encuentro, el texto de cada parte es la guía de quien dirige: lo que dice, las preguntas que hace al grupo (que lleven al texto, no de sí o no) y cómo pasa a la siguiente parte.'
      : 'Los minutos de las partes suman más o menos el tiempo total; cada parte, de un largo que se pueda decir en sus minutos (unas 120 palabras por minuto).'
  }
- Como mucho una dinámica por parte, y solo donde ayude.
- No escribas anuncios: los pongo yo.`;
}

// Cambiar el borrador hablándole a la IA: src/lib/borrador.ts (leerCambios) lee este formato.
function cambiarAsk(t: Taller) {
  return `Esto quiero cambiar del borrador:
«${(t.pedido ?? '').trim()}»

Cada parte de lo que llevo empieza con su id entre corchetes. Responde con este formato estricto:

Primero, una o dos frases que digan qué cambiaste y por qué, con citas si tocan el texto bíblico.

Después, un bloque por cada parte que cambia, con una línea en blanco entre bloques:
@@ el id de la parte, tal cual (por ejemplo texto:abc123)
el texto nuevo completo de esa parte, en párrafos, con sus citas

Para el título de una parte usa el id titulo:… y una sola línea. Para añadir una parte nueva después de otra usa @@ nueva:despues:<id de la parte> y en la primera línea "## Título | minutos", luego su texto.

Reglas:
- Cambia solo lo que pido; lo demás queda igual y no lo repitas.
- Si pido otro versículo, léelo antes con las herramientas. Si pido otro punto de vista, investígalo y preséntalo con justicia, con su cita.
- Conserva mi tono y lo que yo ya edité a mano, salvo que pida cambiarlo.
- Si lo que pido no se puede hacer o no sale del texto bíblico, dilo en la primera frase y no pongas bloques.`;
}

function tallerTask(book: Book, chapter: number, verse: number | undefined, t: Taller) {
  const target = verse
    ? `${book.name} ${chapter}:${verse}`
    : t.desde
      ? `${book.name} ${chapter}:${t.desde}${t.hasta ? `-${t.hasta}` : ''}`
      : `${book.name} ${chapter}`;
  const head =
    `Estoy preparando ${TIPOS[t.tipo]} sobre ${target}${t.plantilla ? `, con la estructura «${t.plantilla}»` : ''}. Ahora estoy en el paso de ${PASOS[t.paso]}.` +
    (t.situacion?.trim() ? `\n\nEmpecé por esto que quiero tratar, antes de tener el pasaje:\n«${t.situacion.trim()}»` : '');
  const draft = t.borrador?.trim() ? `\n\nLo que llevo:\n${t.borrador.trim()}` : '\n\nTodavía no he escrito nada.';
  let ask: string;
  if (t.modo === 'borrador') {
    ask = borradorAsk(t);
  } else if (t.modo === 'cambiar') {
    ask = cambiarAsk(t);
  } else if (t.modo === 'practicar') {
    ask = `Prepárame un repaso hablado de este mensaje para escucharlo varias veces antes de exponerlo y tenerlo en la cabeza. Me lo va a leer la voz del teléfono, de 3 a 5 minutos.

Formato estricto, sin títulos ni marcas, en párrafos cortos separados por una línea en blanco:
- Primero, la idea central en una frase, y por qué importa para quien me va a escuchar.
- Luego, un párrafo por cada parte, en su orden: cómo entro a ella (la transición desde la anterior), lo esencial que digo y el versículo clave, dicho con su cita en palabras («Mateo catorce, versículo treinta»).
- Al final, la idea central otra vez y la frase con la que cierro.

Reglas:
- Háblame a mí, en segunda persona: «empiezas preguntando…», «aquí lees…».
- Sale solo de lo que llevo; no añadas ideas nuevas.
- Sin listas, sin markdown, sin abreviaturas ni números de versículo con dos puntos: todo se lee en voz alta.`;
  } else if (t.modo === 'maqueta') {
    // src/lib/tallerTema.ts lee este formato y lo convierte en las partes del mensaje.
    ask = `Arma la maqueta de este mensaje: el esqueleto para que yo lo escriba, no el mensaje. Las partes de la estructura van en lo que llevo.

Formato estricto, sin nada antes ni después:

## Idea central
Dos opciones, cada una en la forma "- Tema: … | Complemento: …", que salgan del pasaje y respondan a lo que quiero tratar, con su cita.

Después, un título "## " por cada parte de la estructura, en su orden, y bajo cada uno:
= una sola frase que resume el punto de esa parte (máximo 25 palabras), que salga del texto, con su cita
? una sola pregunta guía para que yo piense cómo desarrollarla (máximo 30 palabras)
> la cita de un pasaje de apoyo | por qué ayuda ahí, en pocas palabras, con su cita

Reglas:
- ${t.tipo === 'sermon' ? 'Los títulos de los puntos («Punto 1», «Punto 2»…) cámbialos por un título corto (de 2 a 8 palabras) que salga del texto; las demás partes conservan su nombre exacto.' : 'Cada parte conserva su nombre exacto.'}
- Una sola frase por parte, que yo voy a editar: nada de párrafos, ilustraciones ni aplicaciones desarrolladas. El desarrollo de cada parte lo escribo yo.
- El pasaje de apoyo puede ser el mismo pasaje principal (un versículo concreto) u otro que hayas leído; uno por parte.`;
  } else if (t.modo === 'corregir') {
    // src/lib/correcciones.ts lee este formato; cada campo de lo que llevo va con su id entre corchetes.
    ask = `${t.revision?.trim() ? `Esta fue tu revisión de lo que llevo:\n${t.revision.trim()}\n\n` : ''}Ahora propón correcciones puntuales a mi texto, las que la revisión señala y las faltas de ortografía, acentos, puntuación o frases confusas. Cada campo de lo que llevo empieza con su id entre corchetes.

Formato estricto, sin nada antes ni después, un bloque por corrección y una línea en blanco entre bloques:
@@ el id del campo, tal cual (por ejemplo notas:abc123)
- el trozo exacto que cambia, copiado letra por letra de mi texto (una frase o parte de ella)
+ el mismo trozo corregido
? por qué, en una frase, con cita si el cambio toca lo que dice el pasaje

Reglas:
- Corrige lo que escribí, no lo escribas por mí: conserva mis palabras, mi tono y mis ideas; cambia lo mínimo.
- Nada de párrafos nuevos, ilustraciones, aplicaciones ni secciones que yo no haya escrito; no rellenes campos vacíos. Si algo de la revisión necesita que yo escriba más, no lo corrijas aquí.
- El trozo de «-» tiene que estar tal cual en mi texto y ser corto (máximo dos frases). Un bloque por cambio.
- Si una frase afirma algo que no sale del pasaje, ajústala para que diga lo que el texto sí dice, con su cita.
- Máximo 12 correcciones, las más importantes primero. Si no hay nada que corregir, responde solo: SIN CAMBIOS`;
  } else if (t.modo === 'ruleta') {
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

/**
 * El idioma original de un libro para las herramientas: el hebreo en el Antiguo Testamento (con el arameo de Daniel 2-7,
 * Esdras 4-7 y Jeremías 10:11) y el griego en el Nuevo. Antes se pedía siempre «del griego», también en el AT.
 */
function lenguaOriginal(book: Book) {
  return ['dan', 'ezr', 'jer'].includes(book.id) ? 'hebreo (o del arameo, si el pasaje está en arameo)' : original(book).name;
}

// Herramientas inspiradas en NotebookLM. Cada una pide un formato de texto simple que la app convierte
// en audio, tarjetas o mapa; las citas ⟦n⟧ llegan igual que en el estudio.
const HERRAMIENTAS: Record<Herramienta, (book: Book, chapter: number, hasGreek: boolean) => string> = {
  podcast: (book, chapter, hasGreek) => `Escribe el guion de un resumen en audio de ${book.name} ${chapter}, como una conversación entre dos personas que estudian juntas la Biblia: Ana y Tomás. Se escuchará con voz sintetizada, de 5 a 7 minutos.

Formato estricto: cada intervención en su propia línea, empezando por «ANA:» o «TOMÁS:», sin títulos, sin listas, sin markdown, sin acotaciones entre paréntesis ni efectos de sonido.

Contenido:
- Abran con una frase que despierte interés por el capítulo; no se presenten ni saluden a la audiencia con fórmulas de radio.
- Recorran el capítulo en orden: qué pasa, quién habla y a quién, qué se repite, qué sorprende.${
    hasGreek ? `\n- Detengan la conversación en 1 o 2 palabras del ${lenguaOriginal(book)} que aclaren algo, dichas de forma que se entiendan al oído.` : ''
  }
- Relacionen el capítulo con 2 o 3 pasajes de las referencias cruzadas.
- Que uno pregunte y el otro explique, y que se alternen; intervenciones de 1 a 4 frases, en un español hablado y natural.
- No es un sermón: expliquen el texto, no prediquen ni den consejos largos.
- Cierren con una conclusión, no con preguntas sueltas: cada uno dice en una o dos frases lo que se lleva. Si en el cierre alguien plantea una pregunta de estudio, el otro la responde ahí mismo desde el texto.
- La última intervención le habla directo a quien escucha, de tú, con una invitación a participar: que piense qué le dice a su vida esto, que lo anote o lo converse con alguien (por ejemplo «¿Y tú qué piensas? ¿Qué te dice a ti?», «anótalo y conversémoslo en tu grupo»). Breve, cálida y concreta, sin sermonear.
- Al leer números de versículo, dilos como «el versículo dieciséis», y las citas bíblicas con palabras («Juan tres, dieciséis»).

Extensión: 800 a 1000 palabras. Empieza directamente por la primera línea del diálogo.`,

  tarjetas: (book, chapter, hasGreek) => `Prepara de 8 a 12 tarjetas de repaso de ${book.name} ${chapter} para estudiar con repetición espaciada.

Formato estricto, sin títulos ni introducción, con una línea en blanco entre tarjetas:
P: la pregunta (una sola, concreta)
R: la respuesta, corta (de 1 a 25 palabras), con su cita

Reglas:
- Cada tarjeta prueba una sola idea y se puede responder de memoria después de leer el capítulo.
- Mezcla: qué pasa y quién lo dice; ideas centrales del capítulo; ${
    hasGreek ? `palabras clave del ${lenguaOriginal(book)} y lo que significan; ` : ''
  }cómo se relaciona con alguno de los pasajes de las referencias cruzadas; y 2 o 3 tarjetas de completar un versículo importante, con la pregunta «Completa: …» y la parte que falta como respuesta, copiada exacta de la RV1909.
- Ordénalas como aparecen en el capítulo.
- Nada de preguntas de opinión ni de sí o no.`,

  // El repaso relámpago del estudio en grupo (src/lib/repaso.ts lee este formato).
  repaso: (book, chapter, hasGreek) => `Prepara un repaso relámpago de ${book.name} ${chapter} para un grupo que acaba de estudiarlo junto: 5 preguntas de opción múltiple que todos responden a la vez en su teléfono.

${REPASO_FORMATO}

Reglas:
- Cada pregunta se responde con lo que dice el capítulo; una sola opción es correcta y las otras son creíbles pero el texto las descarta.
- Mezcla: qué pasa y quién lo dice; ideas centrales; ${hasGreek ? `una palabra clave del ${lenguaOriginal(book)}; ` : ''}y una de completar un versículo importante, copiado exacto de la RV1909.
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

const MODOS = ['preguntar', 'sugerir', 'revisar', 'repaso', 'ruleta', 'maqueta', 'corregir', 'borrador', 'cambiar', 'practicar'];
/** Los modos en que la IA escribe: el borrador y sus cambios (BORRADOR_SYSTEM). */
const ESCRIBE = ['borrador', 'cambiar'];
const TALLER_TIPOS = ['reflexion', 'encuentro', 'sermon'];
const TALLER_PASOS = ['pasaje', 'idea', 'bosquejo', 'revisar'];
const MAX_DRAFT = 12000;
const MAX_TEMA = 4000;
const MAX_PREGUNTA = 300;

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
    (x.situacion === undefined || (typeof x.situacion === 'string' && x.situacion.length <= MAX_TEMA)) &&
    (x.revision === undefined || (typeof x.revision === 'string' && x.revision.length <= MAX_DRAFT)) &&
    (x.investigacion === undefined || (typeof x.investigacion === 'string' && x.investigacion.length <= MAX_DRAFT)) &&
    (x.direccion === undefined || (typeof x.direccion === 'string' && x.direccion.length <= MAX_TEMA)) &&
    (x.pedido === undefined || (typeof x.pedido === 'string' && x.pedido.trim().length > 0 && x.pedido.length <= MAX_TEMA)) &&
    (x.modo !== 'cambiar' || typeof x.pedido === 'string') &&
    optInt(x.minutos) &&
    optInt(x.desde) &&
    optInt(x.hasta)
  );
}

function validTema(t: unknown): t is Tema {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  return (
    typeof x.texto === 'string' &&
    x.texto.trim().length >= 10 &&
    x.texto.length <= MAX_TEMA &&
    TALLER_TIPOS.includes(x.tipo as string) &&
    (x.preparar === undefined || typeof x.preparar === 'boolean') &&
    (x.estudio === undefined || (x.preparar === true && validEstudio(x.estudio)))
  );
}

const MAX_PREGUNTAS_ESTUDIO = 8;
function validEstudio(e: unknown): e is EstudioPrevio {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  const texto = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  return (
    texto(x.cita, 80) &&
    texto(x.texto, MAX_DRAFT) &&
    Array.isArray(x.preguntas) &&
    x.preguntas.length <= MAX_PREGUNTAS_ESTUDIO &&
    x.preguntas.every((p) => !!p && typeof p === 'object' && texto((p as Record<string, unknown>).pregunta, MAX_PREGUNTA * 2) && texto((p as Record<string, unknown>).respuesta, MAX_TEMA))
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
async function savedTool(herramienta: Guardada | string, libro: string, capitulo: number): Promise<Saved | null> {
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

async function saveTool(herramienta: Guardada | string, libro: string, capitulo: number, saved: Saved) {
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
  // Quiénes son las personas del pasaje, de dónde vienen y el momento histórico: un documento con las fichas de la app.
  const fichas = await fichasDe(biblia, { book, chapter, verse }, '', verse ? 4 : 6, 110).catch(() => []);
  if (fichas.length) {
    docs.push(
      doc(
        `Personas, lugares y momento histórico de ${book.name} ${chapter} (fichas y línea de tiempo de la app; descripciones en inglés)`,
        fichas.flatMap((f) => f.blocks),
      ),
    );
  }
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
        '## Su mundo: quiénes son las personas del pasaje (de dónde vienen, su pueblo o tribu, su ciudad y si era grande o pequeña, su familia) y qué pasaba en ese momento de la historia, con las fichas y la línea de tiempo de la app. Si el pasaje no tiene personas ni lugares, el momento histórico en dos o tres frases.',
        '## Observa: quién habla y a quién, qué se afirma, palabras repetidas y conectores («pero», «por tanto», «para que»).',
        hasGreek && `## Palabras del ${lang}: 2 a 4 palabras clave, con su significado y lo que aporta su gramática.`,
        '## Interpreta: qué significaba para sus primeros lectores y, si las tradiciones cristianas lo leen distinto, cómo.',
        '## Pasajes relacionados: 3 o 4 referencias y lo que cada una aporta.',
        '## Hacia Cristo: cómo se relaciona con el evangelio, solo si el texto o sus referencias lo sostienen, sin forzarlo.',
        '## Para aplicar: 2 o 3 preguntas personales o para un grupo.',
      ]
    : [
        '## Panorama: de qué trata el capítulo y dónde encaja en el libro.',
        '## Su mundo: quiénes son las personas del capítulo (de dónde vienen, su pueblo o tribu, su ciudad y si era grande o pequeña, su familia) y qué pasaba en ese momento de la historia, con las fichas y la línea de tiempo de la app. Si no tiene personas ni lugares, el momento histórico en dos o tres frases.',
        '## Cómo avanza: las partes del capítulo por grupos de versículos.',
        '## Observa: palabras y temas que se repiten, contrastes y conectores importantes.',
        hasGreek && `## Palabras del ${lang}: 3 a 5 palabras importantes en el capítulo.`,
        '## Interpreta: la idea central del capítulo para sus primeros lectores y, si las tradiciones cristianas lo leen distinto, cómo.',
        '## Pasajes relacionados: 3 o 4 referencias y lo que aportan.',
        '## Hacia Cristo: cómo se relaciona con el evangelio, solo si el texto o sus referencias lo sostienen, sin forzarlo.',
        '## Para aplicar: 2 o 3 preguntas personales o para un grupo.',
      ];
  return `Prepara un estudio de ${target} con estas secciones:\n${sections.filter(Boolean).join('\n')}\n\nExtensión: ${
    verse ? '500 a 700' : '650 a 900'
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
De 80 a 140 palabras en uno o dos párrafos: qué dice el pasaje en su contexto y qué revela de Dios, con citas. Si ayuda, una o dos frases sobre quiénes son sus personas, de dónde vienen o qué pasaba en ese momento, con las fichas de la app.

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

Ahora cuentas «la historia de una palabra»: cómo una palabra del texto original recorre la Biblia. Recibes la entrada del léxico breve de STEPBible (Tyndale House, en inglés), cuántas veces y dónde aparece según la concordancia de la app, y una selección de pasajes con la forma original, su glosa y el texto de la Reina-Valera 1909 (u otra versión, si se dice).

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
      return { text: `${label}: ${form} «${gloss}». ${biblia.version.abbr}: ${await biblia.refText(ref)}`, meta: { label, ref } };
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
  docs.push(await usesDoc(`Pasajes con ${p.nombre} (${p.original}), con la forma original, su glosa y la ${biblia.version.abbr}`, repartir(uses, PALABRA_USES), biblia));
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
- Cierren con una conclusión, no con preguntas sueltas: cada uno dice en una o dos frases lo que se lleva. Si en el cierre alguien plantea una pregunta de estudio, el otro la responde ahí mismo desde el texto.
- La última intervención le habla directo a quien escucha, de tú, con una invitación a participar: que piense qué le dice a su vida esto, que lo anote o lo converse con alguien (por ejemplo «¿Y tú qué piensas? ¿Qué te dice a ti?», «anótalo y conversémoslo en tu grupo»). Breve, cálida y concreta, sin sermonear.
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
  if (body.version !== undefined && typeof body.version !== 'string') return badRequest('Versión no válida');
  // El relato es el mismo para todos, con la RV1909; el pódcast, uno por versión libre (src/lib/podcastVersion.ts).
  const version = await lectura(body.herramienta === 'podcast' ? versionPodcast(body.version) : undefined);
  if (!version) return badRequest('Versión no válida');
  const tool = body.herramienta === 'podcast' ? conVersion('palabra-podcast', version.id) : 'palabra';
  if (!body.nueva) {
    const saved = await savedTool(tool, palabra.id, 0);
    if (saved) {
      return ndjson([...saved.fuentes.map((f) => ({ type: 'source', ...f })), { type: 'text', text: saved.texto }, { type: 'done' }]);
    }
  }
  const denied = await needsAccount(request);
  if (denied) return denied;

  const books = await load<Book[]>('books.json');
  const lector = new Biblia(request, version, books);
  const docs = await palabraSources(palabra, lector);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: [
        ...docs.map((d) => d.param),
        { type: 'text', text: tool === 'palabra' ? palabraTask(palabra) : palabraPodcastTask(palabra) },
      ],
    },
  ];
  const system = SYSTEM + PALABRA_SYSTEM + versionSystem(version);
  return streamAnswer(request, docs, messages, system, MODEL, (saved) => saveTool(tool, palabra.id, 0, saved), undefined, true, lector);
}

/**
 * La conversación después del primer mensaje: respuestas de la IA y preguntas de la persona, alternadas. Devuelve el
 * mensaje de error si no vale.
 * - Una pregunta que se quedó sin respuesta seguida de otra (la app vieja las mandaba así) vale como la última.
 * - Una conversación larga se recorta (la primera respuesta y las últimas vueltas): la app vieja la mandaba entera
 *   y al pasar de 12 vueltas la conversación dejaba de funcionar.
 * - Solo la pregunta nueva tiene que caber en MAX_QUESTION; las de antes se acortan si hiciera falta.
 */
function validTurns(turns: unknown): Turn[] | string {
  const ordenadas = ordenarVueltas<Turn>(turns);
  if (!ordenadas) return 'Conversación no válida';
  const ultima = ordenadas[ordenadas.length - 1];
  if (ultima && ultima.text.length > MAX_QUESTION) return `Tu pregunta es muy larga: escríbela en menos de ${MAX_QUESTION} letras.`;
  return recortarVueltas(ordenadas).map((t) => (t.role === 'user' && t.text.length > MAX_QUESTION ? { ...t, text: t.text.slice(0, MAX_QUESTION) } : t));
}

// El Taller desde un tema: todavía no hay pasaje, así que la IA investiga con las herramientas desde el principio.
async function temaPost(request: Request, body: Body) {
  if (
    !validTema(body.tema) ||
    body.book !== undefined ||
    body.chapter !== undefined ||
    body.taller !== undefined ||
    body.herramienta !== undefined ||
    body.semana !== undefined ||
    body.frecuente !== undefined
  ) {
    return badRequest('Tema no válido');
  }
  const turns = validTurns(body.messages ?? []);
  if (typeof turns === 'string') return badRequest(turns);
  const version = await lectura(body.version);
  if (!version) return badRequest('Versión no válida');
  const vacia = await gastarLampara(request);
  if (vacia) return vacia;
  const books = await load<Book[]>('books.json');
  const biblia = new Biblia(request, version, books);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: temaTask(body.tema) },
    ...turns.map((t) => ({ role: t.role, content: t.text })),
  ];
  const preparar = body.tema.preparar === true;
  const system = SYSTEM + (preparar ? BORRADOR_SYSTEM : TALLER_SYSTEM) + TEMA_SYSTEM + versionSystem(version) + TOOLS_SYSTEM + (preparar ? WEB_SYSTEM : '');
  return streamAnswer(request, [], messages, system, MODEL_PROPIO, async () => {}, biblia, false, undefined, Registro.de(request, body.seguir), preparar);
}

// Una pregunta desde el buscador: sin pasaje, la IA investiga con las herramientas desde el principio. La primera
// respuesta a una de las preguntas que muchos hacen es la misma para todos: se guarda y se lee sin cuenta.
async function preguntaPost(request: Request, body: Body) {
  const p = body.pregunta;
  if (
    !validPregunta(p) ||
    body.book !== undefined ||
    body.chapter !== undefined ||
    body.taller !== undefined ||
    body.herramienta !== undefined ||
    body.semana !== undefined ||
    body.tema !== undefined ||
    body.frecuente !== undefined
  ) {
    return badRequest('Pregunta no válida');
  }
  if (body.publico !== undefined && body.publico !== 'jovenes') return badRequest('Público no válido');
  const jovenes = body.publico === 'jovenes';
  const turns = validTurns(body.messages ?? []);
  if (typeof turns === 'string') return badRequest(turns);
  const version = await lectura(body.version);
  if (!version) return badRequest('Versión no válida');
  // La preparada se guarda con su texto del catálogo, no con lo que escribió la persona.
  const preparada = turns.length === 0 ? PREPARADAS.find((q) => q.id === p.preparada) : undefined;
  const clave = preparada
    ? [
        'preg1' + (version.id === 'rv1909' ? '' : `-${version.id}`) + (version.licensed ? `-${MARCAS}` : ''),
        p.nivel + (jovenes ? '-jovenes' : ''),
        preparada.id,
      ].join(':')
    : null;
  if (clave) {
    const saved = await savedStudy(clave);
    if (saved) {
      return ndjson([...saved.fuentes.map((f) => ({ type: 'source', ...f })), { type: 'text', text: saved.texto }, { type: 'done' }]);
    }
  }
  const denied = await needsAccount(request);
  if (denied) return denied;
  if (!clave) {
    const vacia = await gastarLampara(request);
    if (vacia) return vacia;
  }
  const books = await load<Book[]>('books.json');
  const biblia = new Biblia(request, version, books);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: preguntaTask(preparada ? { ...p, texto: preparada.texto } : p) },
    ...turns.map((t) => ({ role: t.role, content: t.text })),
  ];
  const system = SYSTEM + PREGUNTA_SYSTEM + versionSystem(version, true) + TOOLS_SYSTEM + (jovenes ? JOVENES_SYSTEM : '');
  return streamAnswer(
    request,
    [],
    messages,
    system,
    clave ? MODEL : MODEL_PROPIO,
    async (saved) => {
      if (clave) await saveStudy(clave, saved);
    },
    biblia,
    Boolean(clave),
    undefined,
    clave ? null : Registro.de(request, body.seguir),
  );
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
  // La respuesta guardada de una pregunta que muchos hacen también se lee sin cuenta.
  if (peek && typeof peek === 'object' && 'pregunta' in peek) return preguntaPost(request, peek as Body);
  const denied = await needsAccount(request);
  if (denied) return denied;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return badRequest('JSON no válido');
  }
  if (body.reanudar !== undefined) return reanudar(request, body.reanudar);
  if (body.detener !== undefined) return detener(request, body.detener);
  if (body.tema !== undefined) return temaPost(request, body);
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

  const turns = validTurns(body.messages ?? []);
  if (typeof turns === 'string') return badRequest(turns);
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
  // Las herramientas (tarjetas, mapa…) se guardan por capítulo para todos: siempre con la RV1909. El pódcast, en la
  // versión libre que lee la persona (o una libre de lenguaje actual si la suya tiene derechos): uno por versión.
  if (body.version !== undefined && typeof body.version !== 'string') return badRequest('Versión no válida');
  const version = await lectura(
    herramienta === 'podcast' ? versionPodcast(body.version) : herramienta ? undefined : body.version,
  );
  if (!version) return badRequest('Versión no válida');
  const guardada = herramienta === 'podcast' ? conVersion(herramienta, version.id) : herramienta;

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
    ? `faq:${Number(body.frecuente)}` + (version.id === 'rv1909' ? '' : `:${version.id}`) + (version.licensed ? `:${MARCAS}` : '')
    : !herramienta && !taller && !semana && turns.length === 0
      ? [
          STUDY_VERSION + (version.id === 'rv1909' ? '' : `-${version.id}`) + (version.licensed ? `-${MARCAS}` : ''),
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
    const saved = guardada ? await savedTool(guardada, book.id, chapter) : await savedStudy(clave!);
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
  // La maqueta de un tema también lee los pasajes de apoyo que propone.
  const investiga = turns.length > 0 || taller?.modo === 'maqueta' || taller?.modo === 'borrador' || taller?.modo === 'cambiar';
  const tallerSystem = taller && ESCRIBE.includes(taller.modo) ? BORRADOR_SYSTEM : TALLER_SYSTEM;
  const system =
    (frecuente ? SYSTEM : semana ? SYSTEM + SEMANA_SYSTEM : taller ? SYSTEM + tallerSystem : devocional ? SYSTEM + DEVOCIONAL_SYSTEM : SYSTEM) +
    // Las marcas de versículo se leen donde la respuesta es texto libre: no en el Taller ni en la semana, que tienen su formato.
    versionSystem(version, !taller && !semana) +
    (investiga ? TOOLS_SYSTEM : '') +
    (jovenes ? JOVENES_SYSTEM : '');
  return streamAnswer(
    request,
    docs,
    messages,
    system,
    compartido ? MODEL : MODEL_PROPIO,
    async (saved) => {
      if (guardada) await saveTool(guardada, book.id, chapter, saved);
      else if (clave) await saveStudy(clave, saved);
    },
    investiga ? biblia : undefined,
    compartido,
    biblia,
    compartido ? null : Registro.de(request, body.seguir),
  );
}

type Doc = ReturnType<typeof doc>;

/** Lo que hace falta en los registros de Vercel para saber qué falló: estado, tipo, mensaje y petición. */
function detalle(err: unknown) {
  if (err instanceof Anthropic.APIError) return { status: err.status, type: err.type, message: err.message, requestID: err.requestID };
  return { message: err instanceof Error ? err.message : String(err) };
}

/**
 * Si una vuelta falló sin enviar nada, cómo volver a intentarla: «esperar» cuando la IA está saturada o se cortó la
 * conexión, «sin pensamiento» cuando rechaza el razonamiento devuelto de vueltas anteriores (entonces se quita del
 * historial, como pide la API), o null si no tiene arreglo.
 */
function reintento(err: unknown, history: Anthropic.Beta.BetaMessageParam[]): 'esperar' | 'sin pensamiento' | null {
  if (err instanceof Anthropic.APIUserAbortError) return null;
  if (err instanceof Anthropic.APIError && err.status === 400 && /thinking|signature/i.test(err.message)) {
    let quitado = false;
    for (const m of history) {
      if (m.role !== 'assistant' || typeof m.content === 'string') continue;
      const sin = m.content.filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking');
      if (sin.length !== m.content.length) {
        m.content = sin;
        quitado = true;
      }
    }
    return quitado ? 'sin pensamiento' : null;
  }
  if (err instanceof Anthropic.APIConnectionError) return 'esperar';
  if (err instanceof Anthropic.APIError) {
    // Los errores que llegan dentro del stream no traen estado, solo el tipo.
    if ((err.status ?? 0) >= 500 || err.type === 'overloaded_error' || err.type === 'api_error') return 'esperar';
  }
  return null;
}

/**
 * Los resultados de las herramientas para la IA. La API no deja mezclar search_result con texto dentro de un mismo
 * tool_result (en producción respondía 400 y el estudio fallaba tras los pasos), así que las notas que acompañan a
 * los resultados (el resumen de una búsqueda, el aviso de la teología) van después, como texto aparte.
 */
export function respuestas(
  calls: Anthropic.Beta.BetaToolUseBlock[],
  done: { content: Anthropic.Beta.BetaToolResultBlockParam['content']; error?: boolean }[],
): Anthropic.Beta.BetaContentBlockParam[] {
  const notas: Anthropic.Beta.BetaTextBlockParam[] = [];
  const results = calls.map((call, i): Anthropic.Beta.BetaToolResultBlockParam => {
    let content = done[i].content;
    if (Array.isArray(content) && content.some((b) => b.type === 'search_result')) {
      const texto = content.flatMap((b) => (b.type === 'text' && b.text.trim() ? [b.text] : []));
      if (texto.length) notas.push({ type: 'text', text: `Nota del resultado de ${call.name}: ${texto.join('\n')}` });
      content = content.filter((b) => b.type === 'search_result');
    }
    return { type: 'tool_result', tool_use_id: call.id, content, ...(done[i].error && { is_error: true }) };
  });
  return [...results, ...notas];
}

/**
 * Lo que se devuelve a la IA de su propia respuesta. Si a media respuesta pasó a otro modelo (bloque «fallback»), la
 * API pide quitar el razonamiento y las herramientas pedidas antes del cambio; y nunca acepta textos vacíos.
 */
export function paraDevolver(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlock[] {
  const corte = content.map((b) => b.type).lastIndexOf('fallback');
  return content.filter(
    (b, i) =>
      !(i < corte && (b.type === 'thinking' || b.type === 'redacted_thinking' || b.type === 'tool_use')) &&
      !(b.type === 'text' && !b.text),
  );
}

/**
 * Añade a la conversación lo que respondió la IA. Tras una pausa («pause_turn», la búsqueda en la web con su código),
 * la respuesta que sigue continúa el MISMO mensaje: se une al anterior. Si se enviaba como otro mensaje, el primero
 * quedaba con su código sin resultado y la API respondía 400 («code_execution tool use … without a corresponding
 * code_execution_tool_result block»), y el paso Investigar fallaba en producción.
 */
export function sumarRespuesta(history: Anthropic.Beta.BetaMessageParam[], content: Anthropic.Beta.BetaContentBlock[]) {
  const ultimo = history.at(-1);
  if (ultimo?.role === 'assistant') {
    const antes = typeof ultimo.content === 'string' ? [{ type: 'text' as const, text: ultimo.content }] : ultimo.content;
    ultimo.content = [...antes, ...content];
  } else history.push({ role: 'assistant', content });
}

/**
 * Pide la respuesta a Claude y la envía por partes; «save» guarda la respuesta completa. Con «biblia», la IA puede
 * usar las herramientas de api/_investigar.ts: cada vuelta envía lo que consulta y sigue hasta que responde.
 * Con «compartido» (lo que se guarda para todos) sigue hasta guardarla aunque la persona se vaya: en iPhone, al
 * bloquear la pantalla o salir de la app, Safari corta la conexión, y sin esto el estudio nunca quedaba guardado.
 * Con «registro» (las preguntas de cada persona) también sigue, y lo escrito se guarda para que la app lo recoja al
 * volver (api/_reanudar.ts).
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
  /** Para revisar las citas al final cuando la IA no tiene herramientas (si no, es «biblia»). */
  lector?: Biblia,
  registro?: Registro | null,
  /** Que la IA también pueda buscar en la web (el Taller con borrador). */
  web = false,
) {
  const sigue = compartido || Boolean(registro);
  const encoder = new TextEncoder();
  // Si la persona cierra la conexión, lo que queda por enviar se descarta.
  let abierto = true;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      abierto = false;
    },
    async start(controller) {
      const send = (event: object) => {
        registro?.anotar(event as Record<string, unknown>);
        if (!abierto) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        } catch {
          abierto = false;
        }
      };
      const work = generate(send).finally(async () => {
        if (abierto) {
          abierto = false;
          controller.close();
        }
        await registro?.cerrar();
      });
      if (sigue) waitUntil(work);
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
    // Una vuelta con la IA. «enviado» dice si ya llegó texto a la persona: entonces no se puede repetir.
    let enviado = false;
    const vuelta = async (last: boolean) => {
      const pending = new Map<number, Set<number>>();
      const response = client.beta.messages.stream(
        {
          model,
          max_tokens: 16000,
          system,
          messages: history,
          // En la última vuelta las herramientas siguen declaradas (la conversación las usó), pero ya no se pueden pedir.
          ...(biblia && { tools: web ? [...TOOLS, WEB_TOOL] : TOOLS, tool_choice: { type: last ? 'none' : 'auto' } as const }),
          cache_control: { type: 'ephemeral' },
          output_config: { effort: 'medium' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        // Lo que se guarda para todos, y las preguntas que la app puede recoger luego, terminan aunque la persona se
        // haya ido; lo demás se detiene con ella.
        { signal: registro ? registro.corte.signal : compartido ? undefined : request.signal },
      );
      for await (const event of response) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          texto += event.delta.text;
          enviado = true;
          send({ type: 'text', text: event.delta.text });
        } else if (event.type === 'content_block_delta' && event.delta.type === 'citations_delta') {
          const c = event.delta.citation;
          if (!pending.has(event.index)) pending.set(event.index, new Set());
          const into = pending.get(event.index)!;
          if (c.type === 'content_block_location') cite(docs[c.document_index]?.metas ?? [], c.start_block_index, c.end_block_index, into);
          else if (c.type === 'search_result_location') cite(results[c.search_result_index] ?? [], c.start_block_index, c.end_block_index, into);
          else if (c.type === 'web_search_result_location') cite([{ label: c.title?.trim() || new URL(c.url).hostname, url: c.url }], 0, 1, into);
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
      return response.finalMessage();
    };
    try {
      for (let round = 0; ; round++) {
        const last = !biblia || round >= MAX_ROUNDS;
        let final: Anthropic.Beta.BetaMessage;
        for (let intento = 1; ; intento++) {
          const antes = enviado;
          try {
            final = await vuelta(last);
            break;
          } catch (err) {
            const nuevo = enviado && !antes;
            const arreglo = intento < 3 && !nuevo && !(registro ? registro.corte.signal : compartido ? null : request.signal)?.aborted ? reintento(err, history) : null;
            if (!arreglo) throw err;
            console.warn('estudiar: reintento', round, intento, arreglo, detalle(err));
            if (arreglo === 'esperar') await new Promise((r) => setTimeout(r, 1500 * intento));
          }
        }
        const content = paraDevolver(final.content);
        // Lo que buscó en la web (herramienta del servidor): se ve como un paso más de la investigación.
        for (const b of content) {
          if (b.type === 'server_tool_use' && b.name === 'web_search') {
            const q = (b.input as { query?: unknown } | null)?.query;
            if (typeof q === 'string') send({ type: 'paso', tipo: 'web', texto: `«${q.slice(0, 80)}»` });
          }
        }
        // La búsqueda en la web puede pausar la vuelta: se sigue con lo que lleva.
        if (final.stop_reason === 'pause_turn' && round < MAX_ROUNDS) {
          sumarRespuesta(history, content);
          continue;
        }
        const calls = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
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
          sumarRespuesta(history, content);
          history.push({ role: 'user', content: respuestas(calls, done) });
          continue;
        }
        if (final.stop_reason === 'refusal') {
          send({ type: 'error', message: 'No puedo ayudar con esta pregunta. Prueba a formularla de otra manera.' });
        } else {
          // Solo se guarda una respuesta completa
          if (final.stop_reason === 'end_turn' && texto.trim()) {
            // Las citas que no cuadran con la Biblia se corrigen antes de guardar; la persona recibe el texto nuevo.
            const leer = lector ?? biblia;
            const corregido = leer ? await corregirRespuesta(request, texto, fuentes, leer) : texto;
            if (corregido !== texto) {
              texto = corregido;
              send({ type: 'correccion', text: texto });
            }
            await save({ texto, fuentes });
          }
          send({ type: 'done' });
        }
        break;
      }
    } catch (err) {
      console.error('estudiar', detalle(err), err);
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
