// Catálogo de dinámicas para encuentros de grupo. Todas se hacen sin materiales: solo personas,
// Biblias (o teléfonos) y conversación. Están redactadas con palabras propias; cuando una idea viene
// de una colección concreta se cita y se enlaza para quien quiera más.

export type Momento = 'conectar' | 'texto' | 'aplicar';
export type Apertura = 'baja' | 'media' | 'alta';

export type Dinamica = {
  id: string;
  nombre: string;
  momento: Momento;
  apertura: Apertura;
  minutos: number;
  grupo: string;
  objetivo: string;
  pasos: string[];
  /** A qué pasajes o momentos conviene. */
  encaja?: string;
  fuente?: { nombre: string; url?: string };
};

export const MOMENTOS: { momento: Momento; label: string }[] = [
  { momento: 'conectar', label: 'Para conectar' },
  { momento: 'texto', label: 'Para entrar al texto' },
  { momento: 'aplicar', label: 'Para aplicar y orar' },
];

export const APERTURA_LABEL: Record<Apertura, string> = {
  baja: 'Apertura baja',
  media: 'Apertura media',
  alta: 'Apertura alta',
};

const BIBLIAON = { nombre: 'Bibliaon', url: 'https://bibliaon.com/es/dinamicas_cristianas_biblicas/' };
const RESOURCEUMC = {
  nombre: 'ResourceUMC',
  url: 'https://www.resourceumc.org/content/7-creative-icebreakers-for-all-ages-and-church-groups',
};
const DBS = { nombre: 'Estudio Bíblico de Descubrimiento', url: 'https://www.ccc.org/wp-content/uploads/2025/02/dbs-guide.pdf' };
const POPULAR = { nombre: 'Dinámica popular' };

export const DINAMICAS: Dinamica[] = [
  // Para conectar
  {
    id: 'dos-verdades-un-deseo',
    nombre: 'Dos verdades y un deseo',
    momento: 'conectar',
    apertura: 'baja',
    minutos: 10,
    grupo: '4 a 15 personas',
    objetivo: 'Conocerse mejor de forma ligera y escuchar lo que cada uno anhela.',
    pasos: [
      'Piensa en dos cosas que de verdad te pasaron esta semana y una que te habría gustado que pasara.',
      'Cuando sea tu turno, dilas las tres en el orden que quieras, sin decir cuál es el deseo.',
      'Los demás adivinan cuál es el deseo. Después cuentas en una frase por qué lo deseas.',
    ],
    encaja: 'Cualquier pasaje; muy útil en las primeras semanas.',
    fuente: POPULAR,
  },
  {
    id: 'termometro',
    nombre: 'Termómetro con la mano',
    momento: 'conectar',
    apertura: 'baja',
    minutos: 5,
    grupo: 'Cualquier tamaño',
    objetivo: 'Leer el ánimo del grupo en un minuto.',
    pasos: [
      'Piensa: del 1 al 5, ¿cómo llegas hoy? (1 es muy mal, 5 es muy bien).',
      'A la cuenta de tres, todos muestran su número con los dedos al mismo tiempo.',
      'Si quieres, explica tu número en una frase. Nadie está obligado a hablar.',
    ],
    encaja: 'Al inicio de cualquier encuentro. Si hay números bajos, tenlo en cuenta al orar.',
    fuente: POPULAR,
  },
  {
    id: 'pregunta-en-ronda',
    nombre: 'Pregunta en ronda',
    momento: 'conectar',
    apertura: 'baja',
    minutos: 10,
    grupo: '4 a 15 personas',
    objetivo: 'Abrir la conversación con una pregunta sencilla ligada al tema del pasaje.',
    pasos: [
      'Escucha la pregunta del día: es ligera y tiene que ver con el tema que van a leer.',
      'En círculo, cada uno responde en una o dos frases. Se vale pasar.',
      'Al terminar, fíjense juntos qué tienen en común las respuestas: de eso habla el pasaje.',
    ],
    encaja: 'Cualquier pasaje. Envía la pregunta un par de días antes para que todos lleguen pensándola.',
    fuente: { nombre: 'Roger Carr, ChurchLeaders', url: 'https://churchleaders.com/smallgroups/small-group-articles/320316-best-time-icebreaker-question-roger-carr.html' },
  },
  {
    id: 'objeto-invisible',
    nombre: 'El objeto invisible',
    momento: 'conectar',
    apertura: 'baja',
    minutos: 10,
    grupo: '4 a 12 personas',
    objetivo: 'Contar cómo fue la semana con una imagen, sin tener que dar muchos detalles.',
    pasos: [
      'Imagina que sacas del bolsillo un objeto que represente tu semana (una mochila pesada, un paraguas, una taza de café…).',
      'Cuando sea tu turno, muéstralo con las manos y di en pocas palabras por qué lo elegiste.',
      'Los demás solo escuchan: no se dan consejos ni se comenta.',
    ],
    fuente: POPULAR,
  },
  {
    id: 'cadena-de-nombres',
    nombre: 'Cadena de nombres',
    momento: 'conectar',
    apertura: 'baja',
    minutos: 10,
    grupo: '6 a 15 personas',
    objetivo: 'Aprender los nombres en un grupo nuevo.',
    pasos: [
      'En círculo, la primera persona dice: «Me llamo… y me gusta…».',
      'La siguiente repite el nombre y el gusto de la anterior y luego dice los suyos.',
      'Así hasta el último, que repite todos. Si alguien se traba, los demás le ayudan.',
    ],
    encaja: 'Grupos nuevos o cuando llegan varias personas por primera vez.',
    fuente: BIBLIAON,
  },
  {
    id: 'lo-que-tenemos-en-comun',
    nombre: 'Lo que tenemos en común',
    momento: 'conectar',
    apertura: 'baja',
    minutos: 10,
    grupo: '6 a 20 personas',
    objetivo: 'Descubrir puntos de unión entre personas distintas.',
    pasos: [
      'Una persona dice algo de sí misma: «nací fuera de esta ciudad», «tengo hermanos mayores».',
      'Levantan la mano todos los que también lo tienen en común.',
      'Pasa el turno a otra persona. Al final cada uno dice qué le sorprendió del grupo.',
    ],
    encaja: 'Pasajes sobre la unidad del cuerpo de Cristo (1 Corintios 12, Efesios 4).',
    fuente: POPULAR,
  },
  {
    id: 'te-presento-a',
    nombre: 'Te presento a…',
    momento: 'conectar',
    apertura: 'media',
    minutos: 15,
    grupo: '6 a 16 personas, en parejas',
    objetivo: 'Escuchar con atención a otra persona y darla a conocer.',
    pasos: [
      'Busca como pareja a alguien que conozcas poco.',
      'Durante dos minutos cada uno le pregunta al otro: de dónde es, qué le gusta y algo por lo que da gracias.',
      'De vuelta en el grupo, presenta a tu pareja con lo que te contó (no a ti mismo).',
    ],
    fuente: POPULAR,
  },
  {
    id: 'si-tuvieras',
    nombre: 'Si tuvieras…',
    momento: 'conectar',
    apertura: 'media',
    minutos: 10,
    grupo: '4 a 12 personas',
    objetivo: 'Descubrir las pasiones de cada uno.',
    pasos: [
      'Piensa qué harías para cambiar el mundo si tuvieras 100, 1.000 y un millón.',
      'Cuando sea tu turno, di qué harías con cada cantidad.',
      'Entre todos, conversen: ¿qué dicen esas respuestas de lo que nos importa?',
    ],
    encaja: 'Antes de pasajes sobre mayordomía, generosidad o el reino (Mateo 25, Lucas 12).',
    fuente: RESOURCEUMC,
  },
  {
    id: 'cuentanos-una-historia',
    nombre: 'Cuéntanos una historia',
    momento: 'conectar',
    apertura: 'media',
    minutos: 15,
    grupo: '4 a 10 personas',
    objetivo: 'Ir más allá de lo superficial con recuerdos personales.',
    pasos: [
      'Escuchen la pregunta (por ejemplo: alguien que fue amable contigo cuando no lo esperabas).',
      'Quien quiera la responde con una historia corta, de uno o dos minutos.',
      'Los demás dan gracias por cada historia, sin comentarla ni corregirla.',
    ],
    encaja: 'Pasajes sobre la fidelidad de Dios en la historia personal (Salmos, Génesis).',
    fuente: RESOURCEUMC,
  },

  // Para entrar al texto
  {
    id: 'lectura-dramatizada',
    nombre: 'Lectura dramatizada en voz alta',
    momento: 'texto',
    apertura: 'media',
    minutos: 10,
    grupo: '4 a 15 personas',
    objetivo: 'Escuchar el pasaje como una escena viva.',
    pasos: [
      'Repártanse los personajes del pasaje: narrador, Jesús, los discípulos, la multitud…',
      'Lean el pasaje como si fuera un guion: cada uno dice solo lo de su personaje, con la emoción que tendría.',
      'Después, cada uno dice algo que notó al oírlo así y que no había visto antes.',
    ],
    encaja: 'Pasajes narrativos con diálogo (Evangelios, Hechos, Rut, Jonás).',
    fuente: POPULAR,
  },
  {
    id: 'recuento-en-cadena',
    nombre: 'Recuento en cadena',
    momento: 'texto',
    apertura: 'media',
    minutos: 10,
    grupo: '4 a 12 personas',
    objetivo: 'Asegurar que todos conocen el pasaje antes de conversarlo.',
    pasos: [
      'Lean el pasaje y luego cierren la Biblia (o bloqueen el teléfono).',
      'Una persona cuenta con sus palabras el comienzo de la historia; la siguiente sigue desde ahí, y así hasta el final.',
      'Abran el texto otra vez y comparen entre todos: ¿qué se olvidó o qué se añadió?',
    ],
    encaja: 'Cualquier pasaje. Si el grupo no lo puede recontar, todavía no lo conoce.',
    fuente: DBS,
  },
  {
    id: 'estatuas',
    nombre: 'Estatuas',
    momento: 'texto',
    apertura: 'media',
    minutos: 15,
    grupo: '6 a 18 personas, en tríos',
    objetivo: 'Fijarse en los detalles de una escena.',
    pasos: [
      'En parejas o tríos, elijan un momento del pasaje sin decir cuál.',
      'Formen con el cuerpo una «foto» quieta de ese momento, como estatuas.',
      'El resto adivina qué momento es y por qué. Luego cada estatua dice qué sentía su personaje.',
    ],
    encaja: 'Narrativas con acción (el hijo pródigo, la tormenta calmada, la entrada en Jerusalén).',
    fuente: POPULAR,
  },
  {
    id: 'quien-soy-en-la-historia',
    nombre: '¿Quién soy en la historia?',
    momento: 'texto',
    apertura: 'media',
    minutos: 15,
    grupo: '4 a 12 personas',
    objetivo: 'Ponerse dentro del relato y ver la propia vida a su luz.',
    pasos: [
      'Entre todos, nombren a los personajes del pasaje.',
      'En silencio, elige el personaje con el que más te pareces hoy.',
      'Por turnos, cada uno dice cuál eligió y por qué.',
    ],
    encaja: 'Narrativas con varios personajes (Lucas 15, Juan 4, Juan 11).',
    fuente: POPULAR,
  },
  {
    id: 'pregunta-luz-desafio',
    nombre: 'Pregunta, luz y desafío',
    momento: 'texto',
    apertura: 'media',
    minutos: 15,
    grupo: '4 a 12 personas',
    objetivo: 'Que cada uno responda personalmente al texto.',
    pasos: [
      'Después de leer, piensa un minuto en silencio.',
      'Cuando sea tu turno, comparte tres cosas: una pregunta que te deja el texto, algo que te iluminó y algo que te desafía.',
      'Al final, busquen juntos en el pasaje la respuesta a alguna de las preguntas que salieron.',
    ],
    encaja: 'Cartas y enseñanzas (Romanos, Santiago, el Sermón del Monte).',
    fuente: POPULAR,
  },
  {
    id: 'lectura-meditada',
    nombre: 'Lectura meditada en oración',
    momento: 'texto',
    apertura: 'media',
    minutos: 20,
    grupo: '3 a 12 personas',
    objetivo: 'Escuchar el pasaje despacio y responder a Dios en oración, siempre anclados en el texto.',
    pasos: [
      'Escuchen el pasaje leído despacio tres veces, con un momento de silencio entre cada lectura.',
      'Después de la primera, cada uno dice solo una palabra o frase que le llamó la atención.',
      'Después de la segunda, cada uno dice por qué esa palabra le tocó.',
      'Después de la tercera, cada uno dice qué siente que Dios le invita a hacer, y terminan orando.',
    ],
    encaja:
      'Pasajes breves (Salmos, parábolas, un párrafo de una carta). Es una práctica de la iglesia antigua (lectio divina); aquí se hace siempre con el texto delante, sin técnicas de «dejar la mente en blanco».',
    fuente: POPULAR,
  },
  {
    id: 'palabra-original',
    nombre: 'La palabra original',
    momento: 'texto',
    apertura: 'baja',
    minutos: 10,
    grupo: 'Cualquier tamaño',
    objetivo: 'Descubrir la riqueza de una palabra del griego o del hebreo.',
    pasos: [
      'Miren juntos la palabra clave del pasaje en el idioma original (griego o hebreo) en el interlineal de la app.',
      'Lean en voz alta qué significa y en qué otros versículos aparece.',
      'Conversen: ¿cómo cambia esto lo que entendíamos del versículo?',
    ],
    encaja: 'Cualquier pasaje: la app tiene el interlineal hebreo del AT y el griego del NT.',
  },
  {
    id: 'historia-en-cadena',
    nombre: 'Historia en cadena',
    momento: 'texto',
    apertura: 'baja',
    minutos: 10,
    grupo: '5 a 15 personas',
    objetivo: 'Recordar una parábola o historia entre todos, de forma divertida.',
    pasos: [
      'Escuchen la primera frase de la historia o parábola.',
      'Por turnos, cada uno añade una frase para seguirla, sin mirar la Biblia.',
      'Al terminar, lean el texto y comparen: ¿qué detalles se perdieron o cambiaron?',
    ],
    encaja: 'Parábolas y relatos conocidos.',
    fuente: POPULAR,
  },

  // Para aplicar y orar
  {
    id: 'yo-voy-a',
    nombre: 'Yo voy a…',
    momento: 'aplicar',
    apertura: 'alta',
    minutos: 10,
    grupo: 'Cualquier tamaño',
    objetivo: 'Convertir lo aprendido en un paso concreto para esta semana.',
    pasos: [
      'En silencio, piensa qué vas a hacer esta semana por lo que dice el pasaje.',
      'Dilo en voz alta empezando con «Yo voy a…»: algo concreto y posible (no «orar más», sino «orar 5 minutos antes de trabajar»).',
      'Di también con quién lo vas a compartir para que te pregunte cómo te fue.',
    ],
    encaja: 'El cierre de cualquier encuentro.',
    fuente: DBS,
  },
  {
    id: 'oracion-en-parejas',
    nombre: 'Oración en parejas',
    momento: 'aplicar',
    apertura: 'alta',
    minutos: 10,
    grupo: 'Cualquier tamaño par, en parejas',
    objetivo: 'Cuidarse unos a otros más allá del encuentro.',
    pasos: [
      'Formen parejas (mejor si son del mismo sexo).',
      'Cada uno cuenta en un minuto una carga o petición.',
      'Oren el uno por el otro y quedan de escribirse un mensaje durante la semana.',
    ],
    fuente: POPULAR,
  },
  {
    id: 'silla-vacia',
    nombre: 'Silla vacía',
    momento: 'aplicar',
    apertura: 'media',
    minutos: 5,
    grupo: 'Cualquier tamaño',
    objetivo: 'Mirar hacia quienes todavía no están en el grupo.',
    pasos: [
      'Miren la silla vacía (o el espacio libre en el círculo): representa a quien todavía no está.',
      'Cada uno piensa en una persona concreta que necesita oír este pasaje.',
      'Oren en silencio por ella; quien quiera dice su nombre en voz alta.',
    ],
    encaja: 'Pasajes sobre misión y compasión (Lucas 15, Juan 4, Hechos 1:8).',
    fuente: POPULAR,
  },
  {
    id: 'carta-a-mi-mismo',
    nombre: 'Carta a mí mismo',
    momento: 'aplicar',
    apertura: 'alta',
    minutos: 10,
    grupo: 'Cualquier tamaño',
    objetivo: 'Guardar lo aprendido para recordarlo más adelante.',
    pasos: [
      'Escríbete en el teléfono un mensaje corto: qué quieres recordar de este pasaje dentro de un mes.',
      'Prográmalo como recordatorio o envíatelo a ti mismo.',
      'En un encuentro futuro, quien quiera cuenta qué leyó y cómo le fue.',
    ],
    fuente: POPULAR,
  },
  {
    id: 'cadena-de-gratitud',
    nombre: 'Cadena de gratitud',
    momento: 'aplicar',
    apertura: 'media',
    minutos: 10,
    grupo: '4 a 15 personas',
    objetivo: 'Terminar el encuentro dando gracias unos por otros.',
    pasos: [
      'Una persona da gracias a Dios en voz alta por alguien del grupo y dice por qué.',
      'La persona nombrada sigue la cadena dando gracias por otra.',
      'Sigan hasta que todos hayan sido nombrados.',
    ],
    encaja: 'Buen cierre; pasajes sobre gratitud (Filipenses 1, Colosenses 3).',
    fuente: POPULAR,
  },
  {
    id: 'palabras-que-edifican',
    nombre: 'Palabras que edifican',
    momento: 'aplicar',
    apertura: 'media',
    minutos: 10,
    grupo: '4 a 12 personas',
    objetivo: 'Animarse unos a otros con palabras sinceras.',
    pasos: [
      'Una persona se sienta «en la silla» (o simplemente se dice su nombre).',
      'Los demás, uno a uno, dicen una cualidad sincera que ven en ella, sin exagerar.',
      'Se rota en otros encuentros hasta que todos hayan pasado por la silla.',
    ],
    encaja: 'Efesios 4:29, 1 Tesalonicenses 5:11.',
    fuente: POPULAR,
  },
];

export const dinamica = (id: string | undefined) => DINAMICAS.find((d) => d.id === id);

/**
 * Los pasos que ven todos de la dinámica de una parte: los escritos para ese mensaje si los hay, o los del catálogo.
 * Siempre dicen lo que hacen las personas, no lo que hace quien guía.
 */
export function pasosDe(s: { dinamica?: string; dinamicaPasos?: string[] } | null | undefined): string[] | undefined {
  const d = dinamica(s?.dinamica);
  if (!d) return undefined;
  const propios = s?.dinamicaPasos?.map((p) => p.trim()).filter(Boolean);
  return propios?.length ? propios.slice(0, 8) : d.pasos;
}
