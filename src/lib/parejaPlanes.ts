// Los planes de «En pareja» (src/app/pareja). Contenido escrito para la app con palabras propias: las ideas que
// vienen de libros con derechos (Chapman, Eggerichs, Palau) se nombran con su crédito en «Para profundizar», sin
// copiar su texto ni usar sus marcas. La investigación está en /mnt/project-files/investigacion/devocionales-parejas.md.
//
// Cada plan dura una semana: seis días cortos (5 minutos: un pasaje, una pregunta que cada uno responde por su
// cuenta y una oración del uno por el otro) y un encuentro el séptimo día (20 minutos juntos, en persona).
// Lo importa también api/_pareja.ts, así que aquí no hay nada de React Native.

export type Etapa = 'novios' | 'casados';
/** Para quién es un plan: una etapa o las dos. */
export type ParaQuien = Etapa | 'ambos';

export type PasajePareja = { book: string; chapter: number; from: number; to: number };

export type DiaPareja = {
  titulo: string;
  pasaje: PasajePareja;
  /** «Eclesiastés 4:9-12», para mostrarlo sin cargar los libros. */
  referencia: string;
  /** Dos o tres frases que abren el texto (nunca un sermón). */
  idea: string;
  /** La pregunta que cada uno responde por escrito; la del otro se ve cuando los dos respondieron. */
  pregunta: string;
  /** Algo pequeño para hacer hoy, de la lista de ejercicios prácticos. */
  practica: string;
  /** Una pista para orar el uno por el otro (no una oración escrita para rezarla). */
  ora: string;
};

export type Encuentro = {
  titulo: string;
  pasaje: PasajePareja;
  referencia: string;
  idea: string;
  minutos: number;
  /** Los pasos del encuentro, en orden. */
  pasos: { titulo: string; texto: string }[];
  /** Preguntas para conversar en persona (no se escriben en la app). */
  conversen: string[];
  /** Lo que cada uno escribe al terminar (opcional): lo que se llevan del encuentro. */
  cierre: string;
};

export type PlanPareja = {
  id: string;
  titulo: string;
  subtitulo: string;
  para: ParaQuien;
  /** Los seis días cortos; el séptimo es `encuentro`. */
  dias: DiaPareja[];
  encuentro: Encuentro;
  /** Libros para seguir, con su autor (crédito, no contenido). */
  profundizar?: { titulo: string; autor: string; nota: string }[];
};

export const DIAS_PLAN = 7;

const p = (book: string, chapter: number, from: number, to = from): PasajePareja => ({ book, chapter, from, to });

export const PLANES_PAREJA: PlanPareja[] = [
  {
    id: 'cordon',
    titulo: 'Cordón de tres dobleces',
    subtitulo: 'Una semana para empezar: Dios en el centro de los dos',
    para: 'ambos',
    dias: [
      {
        titulo: 'Mejores son dos',
        pasaje: p('ecc', 4, 9, 12),
        referencia: 'Eclesiastés 4:9-12',
        idea:
          'El Predicador mira la vida «debajo del sol» y encuentra algo bueno: dos que se levantan el uno al otro. El tercer hilo del cordón no es un adorno; es lo que hace que no se rompa.',
        pregunta: '¿En qué momento reciente sentiste que tu pareja te «levantó»? Cuéntalo con un detalle.',
        practica: 'Al despedirse y al volver a verse hoy, un abrazo sin prisa (cuenten seis segundos).',
        ora: 'Da gracias por una forma concreta en que tu pareja te ayuda, y pide que Dios sea el hilo que los une.',
      },
      {
        titulo: 'No es bueno estar solo',
        pasaje: p('gen', 2, 18, 25),
        referencia: 'Génesis 2:18-25',
        idea:
          'Antes de que existiera el pecado, Dios mismo dice que algo «no es bueno»: la soledad. La «ayuda idónea» no es una ayudante menor: es alguien que corresponde, que está frente a frente.',
        pregunta: '¿Qué es lo que más valoras de compartir la vida (o el camino) con tu pareja en esta etapa?',
        practica: 'Cuéntense lo mejor y lo más difícil de su día, sin dar consejos: solo escuchar.',
        ora: 'Pide por la soledad que tu pareja quizá siente en algún área, aunque no la diga.',
      },
      {
        titulo: 'Prefiéranse con honra',
        pasaje: p('rom', 12, 9, 13),
        referencia: 'Romanos 12:9-13',
        idea:
          'Pablo describe un amor sin fingimiento que se nota en lo práctico: preferir al otro, servir con ganas, ser constantes en la oración. Es un amor que compite, pero en honrar.',
        pregunta: '¿De qué manera te gustaría que tu pareja te honrara (que te pusiera primero) esta semana?',
        practica: 'Di en voz alta una cualidad de tu pareja con un ejemplo de hoy.',
        ora: 'Pide un corazón que prefiera a tu pareja en algo concreto de mañana.',
      },
      {
        titulo: 'Con paciencia, soportándose',
        pasaje: p('eph', 4, 1, 3),
        referencia: 'Efesios 4:1-3',
        idea:
          '«Soportarse» no es aguantar en silencio: es cargar con paciencia lo que el otro todavía no es. La unidad no se fabrica; se guarda con humildad y mansedumbre.',
        pregunta: '¿En qué área te cuesta más tener paciencia contigo mismo, y cómo podría ayudarte tu pareja?',
        practica: 'Si hoy aparece un roce, empiecen suave: «Yo me siento… y necesito…», sin culpar.',
        ora: 'Pide paciencia para ti, no para que tu pareja cambie.',
      },
      {
        titulo: 'Perdónense',
        pasaje: p('eph', 4, 29, 32),
        referencia: 'Efesios 4:29-32',
        idea:
          'Las palabras pueden edificar o entristecer al Espíritu. El perdón entre los dos tiene un modelo y una medida: «como Dios también os perdonó en Cristo».',
        pregunta: '¿Hay algo pequeño que necesites pedir perdón o perdonar? Si prefieres, escribe solo «sí» y conversenlo en persona.',
        practica: 'Cambien una queja de hoy por una palabra que edifique.',
        ora: 'Agradece el perdón que has recibido de Dios y pide que se note en cómo tratas a tu pareja.',
      },
      {
        titulo: 'Anímense unos a otros',
        pasaje: p('1th', 5, 11),
        referencia: '1 Tesalonicenses 5:11',
        idea:
          'Animar y edificar es algo que «ya hacéis», dice Pablo, y aun así lo pide de nuevo. El ánimo no es halago: es poner valor en el corazón del otro para seguir.',
        pregunta: '¿Qué está enfrentando tu pareja esta semana en lo que te gustaría animarle?',
        practica: 'Mándale un mensaje a mitad del día con una frase de ánimo concreta.',
        ora: 'Ora por lo que tu pareja enfrenta mañana, nombrándolo.',
      },
    ],
    encuentro: {
      titulo: 'Nuestro primer encuentro',
      pasaje: p('col', 3, 12, 14),
      referencia: 'Colosenses 3:12-14',
      idea: 'Pablo habla de virtudes que uno «se viste» cada día, y sobre todas, el amor, que es «el vínculo de la perfección»: lo que ata todo lo demás.',
      minutos: 20,
      pasos: [
        { titulo: 'Lean juntos', texto: 'Uno lee el pasaje en voz alta y el otro lo vuelve a leer. Cada uno dice qué palabra le llamó la atención.' },
        { titulo: 'Tres gracias', texto: 'Por turnos, digan tres cosas que agradecen del otro de esta semana, con un ejemplo cada una.' },
        { titulo: 'Un «unos a otros»', texto: 'Elijan una virtud del pasaje (paciencia, perdón, humildad…) y acuerden una forma concreta de vivirla la próxima semana.' },
        { titulo: 'Oren el uno por el otro', texto: 'Una frase cada uno basta. Si a alguien le cuesta orar en voz alta, puede leer un versículo del pasaje como oración.' },
      ],
      conversen: ['¿Qué día de esta semana nos hizo bien?', '¿Qué necesitamos cuidar para que este rato juntos siga?'],
      cierre: '¿Qué te llevas de este encuentro?',
    },
  },
  {
    id: 'lenguajes',
    titulo: 'Cómo das y recibes amor',
    subtitulo: 'Palabras, tiempo, servicio, detalles y cercanía',
    para: 'ambos',
    dias: [
      {
        titulo: 'El amor tiene forma',
        pasaje: p('1co', 13, 4, 7),
        referencia: '1 Corintios 13:4-7',
        idea:
          'Pablo no define el amor como un sentimiento: lo describe con verbos. Es sufrido, es benigno, no busca lo suyo. Cada persona aprende a recibir ese amor de maneras distintas.',
        pregunta: '¿Cuándo te sentiste más amado por tu pareja? Describe qué hizo o dijo.',
        practica: 'Fíjate hoy en cómo tu pareja suele demostrar cariño: muchas veces da amor como le gusta recibirlo.',
        ora: 'Pide que Dios te enseñe a amar a tu pareja como ella o él lo necesita, no como a ti te sale.',
      },
      {
        titulo: 'Palabras que sanan',
        pasaje: p('pro', 16, 21, 24),
        referencia: 'Proverbios 16:21-24',
        idea: 'Los dichos suaves son «panal de miel»: dulces al alma y medicina a los huesos. Una palabra a tiempo puede sostener el día de alguien.',
        pregunta: '¿Qué frase de tu pareja recuerdas todavía porque te hizo bien?',
        practica: 'Escribe una nota corta (papel o mensaje) con algo específico que admiras de tu pareja.',
        ora: 'Pide que tus palabras de hoy sean miel y no vinagre.',
      },
      {
        titulo: 'Tiempo sin prisa',
        pasaje: p('luk', 10, 38, 42),
        referencia: 'Lucas 10:38-42',
        idea:
          'Marta servía y María se sentaba a escuchar. Jesús no desprecia el servicio, pero dice que hay «una cosa» necesaria: estar presente. El tiempo atento también es una forma de amor.',
        pregunta: '¿Qué te ayuda a sentir que tu pareja de verdad está contigo y no solo a tu lado?',
        practica: 'Den un paseo de veinte minutos sin teléfonos.',
        ora: 'Pide que Dios ordene tu agenda para tener tiempo de calidad con tu pareja.',
      },
      {
        titulo: 'Servir como Él',
        pasaje: p('jhn', 13, 12, 17),
        referencia: 'Juan 13:12-17',
        idea: 'El Maestro lavó los pies de sus discípulos y dijo: «ejemplo os he dado». Servir en lo cotidiano, sin que lo pidan, es amor que se ve.',
        pregunta: '¿Qué tarea pequeña, si tu pareja la hiciera por ti, te haría sentir amado esta semana?',
        practica: 'Haz hoy una tarea que normalmente hace tu pareja, sin anunciarlo.',
        ora: 'Pide un corazón que sirva con alegría y sin llevar la cuenta.',
      },
      {
        titulo: 'Un detalle que dice «pensé en ti»',
        pasaje: p('jhn', 12, 1, 8),
        referencia: 'Juan 12:1-8',
        idea:
          'María derramó un perfume costoso a los pies de Jesús. Para algunos fue un desperdicio; para Jesús fue una obra buena. Un detalle vale por lo que dice: «tú me importas».',
        pregunta: '¿Qué detalle, aunque sea sencillo, te ha hecho sentir recordado por tu pareja?',
        practica: 'Trae un pequeño detalle hoy: una fruta, una flor, su dulce favorito. Lo importante es que sea pensado.',
        ora: 'Agradece los detalles de Dios contigo esta semana y pide ser generoso con tu pareja.',
      },
      {
        titulo: 'Cercanía que da paz',
        pasaje: p('mrk', 10, 13, 16),
        referencia: 'Marcos 10:13-16',
        idea:
          'Jesús no solo habló a los niños: los tomó en sus brazos y los bendijo. La cercanía física, con respeto y en su etapa, también comunica amor y seguridad.',
        pregunta: '¿Qué gesto de cercanía (tomarse de la mano, un abrazo, sentarse juntos) te da más paz? Responde según su etapa.',
        practica: 'Tómense de la mano al orar hoy, aunque sea por un momento.',
        ora: 'Pide que la cercanía entre los dos sea siempre segura, respetuosa y llena de ternura.',
      },
    ],
    encuentro: {
      titulo: 'Descubran cómo recibe amor cada uno',
      pasaje: p('1jn', 4, 7, 12),
      referencia: '1 Juan 4:7-12',
      idea: 'Amamos porque Dios nos amó primero. Conocer cómo recibe amor el otro es una forma de tomar en serio ese mandato.',
      minutos: 20,
      pasos: [
        { titulo: 'Lean juntos', texto: 'Lean 1 Juan 4:7-12 en voz alta, por turnos.' },
        {
          titulo: 'Ordenen las cinco formas',
          texto:
            'Cada uno, sin mirar al otro, ordena de la que más a la que menos lo hace sentir amado: palabras de ánimo, tiempo juntos, servicio, detalles, cercanía física. Luego compárenlo.',
        },
        { titulo: 'Una meta para cada uno', texto: 'Elijan una acción concreta para la semana en la forma que más necesita el otro.' },
        { titulo: 'Oren', texto: 'Da gracias por cómo tu pareja te ama, y pide aprender su forma de recibir amor.' },
      ],
      conversen: ['¿Te sorprendió algo de cómo ordenó tu pareja las cinco formas?', '¿Cuál de las cinco nos cuesta más darnos?'],
      cierre: '¿Qué acción elegiste para tu pareja esta semana?',
    },
    profundizar: [
      {
        titulo: 'Los 5 lenguajes del amor',
        autor: 'Gary Chapman',
        nota: 'La idea de las cinco formas de dar y recibir amor viene de este libro. Aquí está contada con nuestras palabras.',
      },
    ],
  },
  {
    id: 'honra',
    titulo: 'Amor y honra',
    subtitulo: 'Efesios 5 leído desde el versículo 21',
    para: 'casados',
    dias: [
      {
        titulo: 'Sujetos los unos a los otros',
        pasaje: p('eph', 5, 15, 21),
        referencia: 'Efesios 5:15-21',
        idea:
          'Antes de hablar de esposas y esposos, Pablo dice: «sujetos los unos a los otros en el temor de Dios». Todo lo que sigue sobre el matrimonio nace de una vida llena del Espíritu y de una entrega mutua.',
        pregunta: '¿En qué área de su matrimonio sientes que hoy más necesitan «sujetarse el uno al otro», es decir, ceder por amor?',
        practica: 'Cede hoy en una decisión pequeña que normalmente defenderías.',
        ora: 'Pide ser lleno del Espíritu en tu manera de tratar a tu cónyuge.',
      },
      {
        titulo: 'Amar como Cristo amó',
        pasaje: p('eph', 5, 25, 30),
        referencia: 'Efesios 5:25-30',
        idea:
          'El modelo del amor del esposo es la cruz: Cristo «se entregó a sí mismo». Es un amor que cuida, alimenta y busca el bien del otro, no el propio poder.',
        pregunta: '¿Cómo se ve, en un martes cualquiera, un amor que se entrega por el otro?',
        practica: 'Pregúntale a tu cónyuge: «¿Qué puedo hacer hoy para que tu día sea más liviano?», y hazlo.',
        ora: 'Agradece el amor de Cristo que se entregó por ti, y pide que se refleje en tu casa.',
      },
      {
        titulo: 'Honra que se nota',
        pasaje: p('1pe', 3, 7, 9),
        referencia: '1 Pedro 3:7-9',
        idea:
          'Pedro pide vivir «sabiamente» con el cónyuge y darle honor como coheredero de la gracia. Y añade algo serio: la falta de honra estorba las oraciones.',
        pregunta: '¿Qué te hace sentir respetado y tomado en serio por tu cónyuge? Da un ejemplo.',
        practica: 'Delante de otra persona, di algo bueno de tu cónyuge.',
        ora: 'Pide que nada en tu trato estorbe las oraciones de los dos.',
      },
      {
        titulo: 'La mente de Cristo',
        pasaje: p('php', 2, 3, 8),
        referencia: 'Filipenses 2:3-8',
        idea: 'Nada por contienda ni por vanagloria. Cristo, siendo igual a Dios, se humilló. En el matrimonio la humildad no es perder: es parecerse a Él.',
        pregunta: '¿En qué discusión frecuente les ayudaría más «estimar al otro como superior»?',
        practica: 'Cuando hoy hablen de un tema delicado, uno resume lo que entendió del otro antes de responder.',
        ora: 'Pide humildad para escuchar antes de defenderte.',
      },
      {
        titulo: 'Paz que gobierna',
        pasaje: p('col', 3, 15, 19),
        referencia: 'Colosenses 3:15-19',
        idea:
          'La paz de Cristo «gobierne» en sus corazones: la palabra habla de un árbitro. Pablo pide a los esposos que no sean ásperos y a todos que vivan agradecidos.',
        pregunta: '¿Qué suele quitarles la paz como pareja, y qué la devuelve?',
        practica: 'Hagan un rato de veinte minutos para que uno se desahogue de algo de afuera mientras el otro solo escucha.',
        ora: 'Pide que la paz de Cristo sea el árbitro de su próxima conversación difícil.',
      },
      {
        titulo: 'Alabarse en la puerta',
        pasaje: p('pro', 31, 28, 31),
        referencia: 'Proverbios 31:28-31',
        idea: 'El poema de la mujer virtuosa termina con su familia alabándola. La gratitud dicha en voz alta es parte de un matrimonio sano, para los dos.',
        pregunta: '¿Qué cualidad de tu cónyuge te gustaría que más gente conociera?',
        practica: 'Mándale un mensaje con algo que admiras de su carácter, no de lo que hace.',
        ora: 'Da gracias por tu cónyuge, nombrando dos cualidades.',
      },
    ],
    encuentro: {
      titulo: 'Reunión de los dos',
      pasaje: p('eph', 5, 31, 33),
      referencia: 'Efesios 5:31-33',
      idea: 'Pablo cierra con una frase para los dos: amor y respeto. Ambos lo necesitan, y ambos lo dan, como reflejo de Cristo y la iglesia.',
      minutos: 20,
      pasos: [
        { titulo: 'Lean juntos', texto: 'Lean Efesios 5:21-33 completo, empezando en el versículo 21.' },
        { titulo: 'Cinco gracias', texto: 'Cada uno dice cinco cosas concretas que agradece del otro esta semana.' },
        {
          titulo: 'Un tema, con turnos',
          texto:
            'Elijan un solo tema pendiente. Uno habla y el otro escucha y resume; luego al revés. No hace falta resolverlo hoy: basta con entenderse.',
        },
        { titulo: 'La semana que viene', texto: 'Miren juntos la agenda: ¿cuándo tendrán tiempo para los dos?' },
        { titulo: 'Oren', texto: 'Oren el uno por el otro, con una frase basta.' },
      ],
      conversen: ['¿Cuándo me sentí más amado esta semana?', '¿Cuándo me sentí más respetado esta semana?'],
      cierre: '¿Qué acordaron para la semana que viene?',
    },
    profundizar: [
      {
        titulo: 'Amor y respeto',
        autor: 'Emerson Eggerichs',
        nota: 'Este plan toma la idea de Efesios 5:33 que el libro popularizó, leída como necesidad de los dos y desde el versículo 21.',
      },
    ],
  },
  {
    id: 'antes-del-si',
    titulo: 'Antes del sí',
    subtitulo: 'Para novios: discernir, conocerse y cuidar el corazón',
    para: 'novios',
    dias: [
      {
        titulo: '¿Andarán dos juntos?',
        pasaje: p('amo', 3, 3),
        referencia: 'Amós 3:3',
        idea: 'Amós pregunta algo obvio para enseñar algo profundo: para caminar juntos hay que ponerse de acuerdo en el rumbo. La fe compartida no es un detalle; es el camino.',
        pregunta: '¿Cómo describirías hoy tu relación con Dios, y cómo te gustaría que fuera la de los dos juntos?',
        practica: 'Cuéntense cómo llegó cada uno a la fe, si no lo han hecho con calma.',
        ora: 'Pide que Dios guíe el rumbo de los dos, juntos o no.',
      },
      {
        titulo: 'Guarda tu corazón',
        pasaje: p('pro', 4, 20, 27),
        referencia: 'Proverbios 4:20-27',
        idea: 'Del corazón «mana la vida». Guardarlo no es cerrarlo: es cuidarlo con sabiduría, con los ojos puestos adelante y los pies en caminos derechos.',
        pregunta: '¿Qué te ayuda a mantener a Dios en el centro mientras se enamoran?',
        practica: 'Cada uno nombre una persona sabia (un mentor, un pastor, un matrimonio) que pueda acompañarlos.',
        ora: 'Pide sabiduría para cuidar tu corazón y el de tu pareja.',
      },
      {
        titulo: 'Dejar y unirse',
        pasaje: p('gen', 2, 24),
        referencia: 'Génesis 2:24',
        idea:
          '«Dejará el hombre a su padre y a su madre». Cada uno trae una historia: costumbres, maneras de discutir y de amar aprendidas en casa. Conocerlas ayuda a construir algo nuevo.',
        pregunta: '¿Qué costumbre de tu familia te gustaría llevar a tu futuro hogar, y cuál preferirías dejar?',
        practica: 'Cuéntense cómo se resolvían los desacuerdos en sus casas cuando eran niños.',
        ora: 'Da gracias por tu familia y pide sanidad donde haga falta.',
      },
      {
        titulo: 'Lo que esperamos',
        pasaje: p('luk', 14, 28, 30),
        referencia: 'Lucas 14:28-30',
        idea: 'Quien quiere edificar una torre primero se sienta a calcular. No es falta de fe: es tomarse en serio lo que se construye.',
        pregunta: 'Escribe tus expectativas sobre una de estas áreas: hijos, trabajo, dinero, iglesia o familias. Luego comparen.',
        practica: 'Cada uno haga una lista privada de tres cosas que da por hecho del matrimonio. Conversen las diferencias.',
        ora: 'Pide que no haya expectativas escondidas entre los dos.',
      },
      {
        titulo: 'Santidad y respeto',
        pasaje: p('1th', 4, 3, 8),
        referencia: '1 Tesalonicenses 4:3-8',
        idea:
          'La voluntad de Dios incluye la santidad del cuerpo, y Pablo la conecta con no agraviar al hermano. Los límites no son desconfianza: son una forma de honrar a la otra persona.',
        pregunta: '¿Qué límites les ayudarían a honrarse el uno al otro y a Dios en esta etapa?',
        practica: 'Si no lo han hecho, conversen y acuerden juntos sus límites, y compártanlos con alguien de confianza.',
        ora: 'Pide fortaleza y gracia para los dos, sin culpa por el pasado.',
      },
      {
        titulo: 'Donde tú vayas',
        pasaje: p('rut', 1, 16, 17),
        referencia: 'Rut 1:16-17',
        idea:
          'Rut no hace una promesa romántica: es lealtad (jésed) a Noemí y a su Dios, para lo bueno y lo difícil. El amor que dura se parece más a esa lealtad que a un sentimiento.',
        pregunta: '¿Qué significa para ti un compromiso que se mantiene en lo difícil?',
        practica: 'Sirvan juntos a alguien esta semana: una visita, una ayuda, una comida.',
        ora: 'Pide una lealtad como la de Rut, firme y llena de bondad.',
      },
    ],
    encuentro: {
      titulo: 'Carta al futuro',
      pasaje: p('pro', 15, 22),
      referencia: 'Proverbios 15:22',
      idea: 'Los planes se afirman con consejo. Este encuentro es para conversar con calma y dejar por escrito lo que esperan.',
      minutos: 25,
      pasos: [
        { titulo: 'Lean juntos', texto: 'Lean Proverbios 15:22 y Lucas 14:28-30.' },
        { titulo: 'Comparen sus expectativas', texto: 'Repasen lo que cada uno escribió esta semana. ¿Dónde coinciden? ¿Dónde necesitan conversar más?' },
        {
          titulo: 'Escriban una carta',
          texto: 'Cada uno escriba una carta corta a la pareja que serán dentro de unos años. Guárdenla para leerla en una fecha especial.',
        },
        { titulo: 'Busquen consejo', texto: 'Acuerden con quién conversarán lo aprendido: un pastor, un mentor o un matrimonio de confianza.' },
        { titulo: 'Oren', texto: 'Oren por el futuro de los dos, poniéndolo en manos de Dios.' },
      ],
      conversen: ['¿Qué aprendimos el uno del otro esta semana?', '¿Qué tema necesitamos seguir conversando con un mentor?'],
      cierre: '¿Qué te llevas de esta semana?',
    },
    profundizar: [
      {
        titulo: '¿Con quién me casaré?',
        autor: 'Luis Palau',
        nota: 'Un clásico para jóvenes sobre elegir pareja según la voluntad de Dios. Este plan está escrito con nuestras palabras, en su espíritu.',
      },
    ],
  },
];

export const planPareja = (id: string) => PLANES_PAREJA.find((x) => x.id === id);

/** Los planes que ve una pareja según su etapa. */
export const planesPara = (etapa: Etapa) => PLANES_PAREJA.filter((x) => x.para === 'ambos' || x.para === etapa);
