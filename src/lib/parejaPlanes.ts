// Los planes de «En pareja» (src/app/pareja). Contenido escrito para la app con palabras propias: las ideas que
// vienen de libros con derechos (Chapman, Eggerichs, Palau, Wright) se nombran con su crédito en «Para profundizar», sin
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
    subtitulo: 'Para novios: por qué, quiénes somos y qué esperamos',
    para: 'novios',
    dias: [
      {
        titulo: 'La mujer de tu pacto',
        pasaje: p('mal', 2, 14, 15),
        referencia: 'Malaquías 2:14-15',
        idea:
          'Malaquías llama a la esposa «tu compañera, y la mujer de tu pacto», y dice que Dios es testigo. El matrimonio no es un contrato que se cumple mientras convenga: es una promesa delante de Dios.',
        pregunta: 'Escribe tres razones por las que quieres casarte con tu pareja. Debajo, las tres que crees que escribirá ella o él.',
        practica:
          'Al ver las respuestas, miren si alguna razón suena a escapar (de casa, de la soledad, de una presión). Si aparece, no es un fracaso: es algo para hablar con un mentor.',
        ora: 'Da gracias por tu pareja y pide que su «sí» sea un pacto y no solo un sentimiento.',
      },
      {
        titulo: 'Distintos a propósito',
        pasaje: p('eph', 4, 2, 3),
        referencia: 'Efesios 4:2-3',
        idea:
          'Pablo no pide que todos piensen igual, sino humildad, mansedumbre y paciencia para soportarse en amor. Las diferencias que hoy atraen mañana pueden irritar; con el tiempo, bien llevadas, también enriquecen.',
        pregunta: '¿Qué diferencia entre los dos te atrajo al principio, y cuál ya te cuesta un poco?',
        practica: 'Cada uno anote tres cosas en que se parecen y tres en que son distintos. Comparen las listas y den gracias por una de las diferencias.',
        ora: 'Pide paciencia para no querer cambiar a tu pareja a tu medida.',
      },
      {
        titulo: 'Lo que traemos de casa',
        pasaje: p('gen', 2, 24),
        referencia: 'Génesis 2:24',
        idea:
          '«Dejará el hombre a su padre y a su madre». Cada uno llega con una historia: costumbres, maneras de discutir y de amar aprendidas en casa. Conocerla ayuda a construir algo nuevo, sin copiarla ni pelear con ella.',
        pregunta: 'Algo del matrimonio de tus padres (o de quienes te criaron) que quieres repetir, y algo que prefieres no llevar a tu hogar.',
        practica: 'Entrevístense con calma: un recuerdo feliz de la infancia, algo que les daba miedo, y quién les habló de Dios por primera vez.',
        ora: 'Da gracias por tu familia y pide sanidad donde haga falta.',
      },
      {
        titulo: 'Expectativas sobre la mesa',
        pasaje: p('luk', 14, 28, 30),
        referencia: 'Lucas 14:28-30',
        idea: 'Quien quiere edificar una torre primero se sienta a calcular. No es falta de fe: es tomarse en serio lo que se construye.',
        pregunta: 'Escribe cinco cosas que esperas de tu pareja ya casados, de las de todos los días (la casa, el tiempo, la familia, la iglesia, el dinero).',
        practica:
          'Al leer las expectativas del otro, marquen cada una en voz alta: «fácil», «difícil pero posible» o «no creo poder». Las difíciles no son un problema; las escondidas sí.',
        ora: 'Pide que no queden expectativas escondidas entre los dos.',
      },
      {
        titulo: 'Pronto para oír',
        pasaje: p('jas', 1, 19, 20),
        referencia: 'Santiago 1:19-20',
        idea:
          'Santiago lo pone en orden: oír primero, hablar después, enojarse tarde. Escuchar de verdad no es esperar el turno para responder; es entender lo que la otra persona siente, aunque no estés de acuerdo.',
        pregunta: 'Cuando no están de acuerdo, ¿qué haces tú: te alejas, insistes hasta ganar, cedes para no pelear, negocian o lo hablan hasta resolverlo? ¿Y qué hace tu pareja?',
        practica: 'En la próxima conversación difícil, antes de responder, repite con tus palabras lo que entendiste y pregunta: «¿Es eso lo que sientes?».',
        ora: 'Pide oídos atentos y una lengua lenta para los dos.',
      },
      {
        titulo: 'Para lo bueno y lo difícil',
        pasaje: p('rom', 15, 5, 7),
        referencia: 'Romanos 15:5-7',
        idea:
          'Pablo pide al «Dios de la paciencia y de la consolación» que les dé un mismo sentir, y les dice que se sobrelleven como Cristo los sobrellevó. Las pruebas llegarán: una enfermedad, un trabajo perdido, un plan que no sale.',
        pregunta: 'Si mañana llegara algo difícil (perder el trabajo, una enfermedad, un hijo que no llega), ¿qué necesitarías de tu pareja?',
        practica: 'Elijan juntos una situación difícil de las que viven otros matrimonios que conocen, y conversen cómo la enfrentarían ustedes dos.',
        ora: 'Pide que Cristo sea el que los sostiene cuando las cosas no salgan como esperaban.',
      },
    ],
    encuentro: {
      titulo: 'Nuestra visión',
      pasaje: p('hab', 2, 2, 3),
      referencia: 'Habacuc 2:2-3',
      idea: '«Escribe la visión, y declárala en tablas». Este encuentro es para soñar con los pies en la tierra y dejar por escrito hacia dónde quieren ir.',
      minutos: 30,
      pasos: [
        { titulo: 'Lean juntos', texto: 'Lean Habacuc 2:2-3 y Proverbios 15:22.' },
        { titulo: 'Repasen la semana', texto: 'Miren las respuestas de estos días. ¿Dónde coinciden? ¿Qué expectativa difícil necesitan seguir conversando?' },
        {
          titulo: 'Escriban sus metas',
          texto:
            'Cada uno escriba en un papel cinco metas para su matrimonio, concretas y en positivo («cenaremos juntos sin teléfonos tres veces por semana», no «no pelearemos»). Comparen y elijan juntos las dos más importantes.',
        },
        { titulo: 'Pónganles un cómo', texto: 'Para cada una de las dos metas, acuerden el primer paso y una fecha para revisarla. Vuelvan a hacer este ejercicio después de casados.' },
        { titulo: 'Busquen consejo', texto: 'Acuerden con quién conversarán lo aprendido: un pastor, un mentor o un matrimonio de confianza.' },
        { titulo: 'Oren', texto: 'Oren por esa visión, poniéndola en manos de Dios.' },
      ],
      conversen: ['¿Qué aprendimos el uno del otro esta semana?', '¿Qué tema necesitamos seguir conversando con un mentor?'],
      cierre: 'Escribe la meta que más te ilusiona.',
    },
    profundizar: [
      {
        titulo: 'Antes de decir sí',
        autor: 'H. Norman Wright y Wes Roberts',
        nota: 'Un cuaderno de trabajo para novios. Este plan toma algunas de sus ideas (adivinar las respuestas del otro, las expectativas que se marcan como fáciles o difíciles, la historia de cada familia, la visión) y las cuenta con nuestras palabras.',
      },
      {
        titulo: '¿Con quién me casaré?',
        autor: 'Luis Palau',
        nota: 'Un clásico para jóvenes sobre elegir pareja según la voluntad de Dios.',
      },
    ],
  },
  {
    id: 'hacia-el-hogar',
    titulo: 'Hacia el hogar',
    subtitulo: 'Para novios: decisiones, dinero, familias y fe',
    para: 'novios',
    dias: [
      {
        titulo: 'Quién decide qué',
        pasaje: p('php', 2, 3, 4),
        referencia: 'Filipenses 2:3-4',
        idea:
          'Pablo pide no mirar cada uno «a lo suyo propio, sino cada cual también a lo de los otros». Todas las parejas deciden de alguna manera; las que lo conversan antes se ahorran muchos malentendidos.',
        pregunta: '¿Cómo te imaginas que decidirán dónde vivir, a qué iglesia ir y en qué gastar? ¿Qué decisiones crees que puedes tomar sin consultar?',
        practica: 'Para esas tres decisiones, cada uno diga cuánto debería pesar la opinión de cada uno (por ejemplo, 50 y 50, o 70 y 30). Comparen sin discutir todavía.',
        ora: 'Pide humildad para buscar lo del otro y no solo lo tuyo.',
      },
      {
        titulo: 'Donde está tu tesoro',
        pasaje: p('mat', 6, 19, 21),
        referencia: 'Mateo 6:19-21',
        idea:
          'Jesús une el dinero con el corazón: lo que atesoramos dice lo que amamos. Cada uno aprendió algo sobre el dinero en casa, a veces sin palabras: escasez, seguridad, peleas o silencio.',
        pregunta: '¿Cómo se vivía el dinero en tu casa cuando crecías, y cómo te marcó?',
        practica: 'Juego: cada uno adivine cuánto cuestan cinco cosas que el otro paga en un mes (el transporte, un corte de pelo, el mercado de la semana). Ríanse de los errores y aprendan.',
        ora: 'Pide un corazón libre del amor al dinero y del miedo a que falte.',
      },
      {
        titulo: 'Un presupuesto de dos',
        pasaje: p('pro', 27, 23, 24),
        referencia: 'Proverbios 27:23-24',
        idea:
          '«Considera atentamente el aspecto de tus ovejas». El pastor sabe cómo está su rebaño; un hogar sabio sabe a dónde se va su dinero. No es control: es cuidado.',
        pregunta: 'Si les regalaran una suma grande de dinero, ¿en qué la usarías? Escribe tus tres primeras ideas.',
        practica: 'Esta semana, cada uno anote todo lo que gasta. Al final, piensen juntos en un presupuesto sencillo, con una parte para dar y otra para cuidar su relación.',
        ora: 'Da gracias por lo que tienen y pide sabiduría para administrarlo juntos.',
      },
      {
        titulo: 'Tu pueblo será mi pueblo',
        pasaje: p('rut', 1, 16, 17),
        referencia: 'Rut 1:16-17',
        idea:
          'La promesa más famosa de lealtad en la Biblia es de una nuera a su suegra. Rut no deja de ser quien es, pero abraza a la familia de Noemí. Casarse es también recibir una familia nueva.',
        pregunta: '¿Cómo imaginas la relación con tus futuros suegros: visitas, fiestas, consejos? ¿Qué te ilusiona y qué te preocupa?',
        practica: 'Cada uno escriba una nota corta a sus futuros suegros, agradeciéndoles por la persona que criaron.',
        ora: 'Ora por los padres de tu pareja, por nombre.',
      },
      {
        titulo: 'Santidad y respeto',
        pasaje: p('1th', 4, 3, 8),
        referencia: '1 Tesalonicenses 4:3-8',
        idea:
          'La voluntad de Dios incluye la santidad del cuerpo, y Pablo la conecta con no agraviar al hermano. Los límites no son desconfianza: son una forma de honrar a la otra persona. La intimidad es un regalo de Dios para el matrimonio.',
        pregunta: '¿Qué límites les ayudarían a honrarse el uno al otro y a Dios en esta etapa?',
        practica: 'Acuerden juntos sus límites y compártanlos con alguien de confianza. Antes de la boda, busquen un consejero o un curso prematrimonial para hablar de la intimidad con libertad.',
        ora: 'Pide fortaleza y gracia para los dos, sin culpa por el pasado.',
      },
      {
        titulo: 'Nuestra historia con Dios',
        pasaje: p('deu', 6, 6, 7),
        referencia: 'Deuteronomio 6:6-7',
        idea:
          'La Palabra se habla «estando en tu casa, y andando por el camino, y al acostarte». La fe del hogar no se improvisa: se cultiva en lo cotidiano, y empieza por conocer la historia de fe del otro.',
        pregunta: '¿Cómo llegaste a la fe y quién te marcó en el camino? Si hoy pudieras hacerle una pregunta a Dios, ¿cuál sería?',
        practica: 'Decidan cómo quieren orar y leer la Biblia juntos cuando estén casados: cuándo, cuánto tiempo y dónde.',
        ora: 'Pide que el hogar que van a formar tenga a Dios en lo de todos los días.',
      },
    ],
    encuentro: {
      titulo: 'La boda que queremos',
      pasaje: p('php', 4, 6, 7),
      referencia: 'Filipenses 4:6-7',
      idea: 'Preparar una boda puede robar la paz que la boda celebra. Este encuentro es para soñarla juntos y entregarle a Dios lo que preocupa.',
      minutos: 25,
      pasos: [
        { titulo: 'Lean juntos', texto: 'Lean Filipenses 4:6-7.' },
        {
          titulo: 'Lo que cada uno desea',
          texto: 'Cada uno diga qué desea para la boda, y qué creen que desean sus padres. ¿Dónde coinciden? ¿Dónde puede haber tensión?',
        },
        { titulo: 'Lo que importa', texto: 'Acuerden tres cosas por las que les gustaría que la gente recuerde su boda, y cómo quieren que se note que Cristo está en el centro.' },
        { titulo: 'Un plan B', texto: 'Algo va a salir distinto a lo planeado, y está bien. Decidan desde ya cómo reaccionarán cuando pase: con humor y sin culpas.' },
        { titulo: 'Oren', texto: 'Presenten a Dios lo que les preocupa de la boda y de las familias, con gratitud.' },
      ],
      conversen: ['¿Quién está más tenso con la boda, y cómo podemos ayudarle?', '¿Qué es lo que de verdad no queremos perder en estos meses?'],
      cierre: '¿Qué te gustaría recordar del día de la boda?',
    },
    profundizar: [
      {
        titulo: 'Antes de decir sí',
        autor: 'H. Norman Wright y Wes Roberts',
        nota: 'Este plan toma ideas del cuaderno (las decisiones, el dinero en la familia de origen, los suegros y la boda) y las cuenta con nuestras palabras.',
      },
    ],
  },
];

export const planPareja = (id: string) => PLANES_PAREJA.find((x) => x.id === id);

/** Los planes que ve una pareja según su etapa. */
export const planesPara = (etapa: Etapa) => PLANES_PAREJA.filter((x) => x.para === 'ambos' || x.para === etapa);
