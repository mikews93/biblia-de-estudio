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
      'Cada persona piensa dos cosas ciertas de su semana y una cosa que desearía que hubiera pasado.',
      'Por turnos, las dice en cualquier orden.',
      'El grupo adivina cuál es el deseo; luego quien habló cuenta por qué lo desea.',
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
      'Pregunta: «Del 1 al 5, ¿cómo llegas hoy?».',
      'A la cuenta de tres, todos muestran el número con los dedos.',
      'Quien quiera explica su número; nadie está obligado.',
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
      'El líder hace una pregunta ligera relacionada con el tema (por ejemplo, «¿cuál fue la mejor comida de tu infancia?» antes de la multiplicación de los panes).',
      'Cada uno responde en una o dos frases, en círculo.',
      'El líder conecta las respuestas con el pasaje que van a leer.',
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
      'Cada persona «saca del bolsillo» un objeto imaginario que represente su semana (una mochila pesada, un paraguas, una taza de café…).',
      'Lo describe en pocas palabras y dice por qué lo eligió.',
      'Los demás solo escuchan; no se aconseja.',
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
      'La siguiente repite el nombre y el gusto de la anterior y añade los suyos.',
      'Se sigue así hasta el último, que repite todos. Se vale ayudar.',
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
      'Alguien dice algo de sí mismo («nací fuera de esta ciudad», «tengo hermanos mayores»).',
      'Levantan la mano quienes lo comparten.',
      'Pasa la palabra a otra persona. Al final, pregunta qué les sorprendió.',
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
      'Forma parejas con personas que se conozcan poco.',
      'Durante dos minutos cada uno entrevista al otro: de dónde es, qué le gusta, algo que agradece.',
      'De vuelta en el grupo, cada uno presenta a su pareja.',
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
      'Pregunta: «¿Qué harías con 100, con 1.000 y con un millón para cambiar el mundo?».',
      'Cada uno responde las tres cantidades.',
      'Conversen qué revelan las respuestas sobre lo que les importa.',
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
      'El líder elige una pregunta: un recuerdo de infancia, alguien que fue amable contigo, un momento que cambió tu rumbo.',
      'Quien quiera la responde con una historia breve.',
      'El grupo agradece cada historia sin comentarla ni corregirla.',
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
      'Reparte los personajes del pasaje: narrador, Jesús, discípulos, multitud…',
      'Lean el pasaje como un guion, cada uno su parte.',
      'Pregunta: «¿Qué notaste al oírlo así que no habías notado antes?».',
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
      'Después de leer, cierran las Biblias.',
      'Una persona cuenta el inicio del pasaje con sus palabras; la siguiente continúa, y así hasta el final.',
      'Abren el texto y el grupo revisa qué se olvidó o se añadió.',
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
      'En parejas o tríos, elijan un momento del pasaje.',
      'Formen con el cuerpo una «foto» quieta de ese momento.',
      'Los demás adivinan qué momento es y explican por qué; luego los actores dicen qué sintió su personaje.',
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
      'Hagan una lista de los personajes del pasaje.',
      'Cada uno elige el personaje con el que más se identifica hoy.',
      'Por turnos, dice cuál eligió y por qué.',
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
      'Después de leer, cada uno piensa en silencio un minuto.',
      'Comparte tres cosas: una pregunta que le deja el texto, algo que le iluminó y algo que le desafía.',
      'El líder anota las preguntas y, si alguna se responde con el pasaje, lo vuelven a mirar juntos.',
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
      'Lean el pasaje tres veces, despacio, con un momento de silencio entre lecturas.',
      'Después de la primera, cada uno dice una palabra o frase que le llamó la atención.',
      'Después de la segunda, dice por qué esa palabra le tocó.',
      'Después de la tercera, comparte qué le invita Dios a hacer a partir del texto, y terminan orando.',
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
      'Antes del encuentro, el líder elige una palabra clave del pasaje en el interlineal de la app.',
      'La presenta: cómo se escribe, qué significa y dónde más aparece.',
      'El grupo conversa: «¿Cómo cambia esto lo que entendemos del versículo?».',
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
      'El líder dice la primera frase de una parábola o historia bíblica.',
      'Cada persona añade una frase, en orden.',
      'Al terminar, leen el texto y comparan: ¿qué detalles se perdieron?',
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
      'Cada uno piensa en silencio qué hará esta semana en respuesta al pasaje.',
      'Lo dice en voz alta empezando con «Yo voy a…», algo específico y posible.',
      'Añade con quién lo va a compartir. La próxima vez, al «mirar atrás», se pregunta con gracia cómo les fue.',
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
      'Cada uno comparte una carga o petición breve.',
      'Oran el uno por el otro y se comprometen a escribirse un mensaje durante la semana.',
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
      'El líder señala una silla vacía (o un espacio en el círculo).',
      'Cada uno piensa en una persona concreta que necesita oír este pasaje.',
      'Oran en silencio por ella; quien quiera dice su nombre.',
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
      'Cada uno se escribe en el teléfono un mensaje breve: qué quiere recordar de este pasaje dentro de un mes.',
      'Lo programa como recordatorio o se lo envía a sí mismo.',
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
      'Una persona da gracias a Dios por alguien del grupo y dice por qué.',
      'La persona nombrada continúa la cadena dando gracias por otra.',
      'Se sigue hasta que todos hayan sido nombrados.',
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
      'Una persona se sienta «en la silla» (o simplemente se la nombra).',
      'Los demás dicen una cualidad genuina que ven en ella, sin exagerar.',
      'Se rota durante varias semanas hasta que todos hayan pasado.',
    ],
    encaja: 'Efesios 4:29, 1 Tesalonicenses 5:11.',
    fuente: POPULAR,
  },
];

export const dinamica = (id: string | undefined) => DINAMICAS.find((d) => d.id === id);
