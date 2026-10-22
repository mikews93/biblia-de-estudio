// Rutas del Modo Jóvenes (12 a 17 años): seis misiones cortas por tema, cada una con un pasaje breve, dos
// preguntas para ver si se entendió lo que dice el texto, una pregunta abierta para pensar y un reto para la semana.
//
// Reglas del contenido: el gancho solo da contexto (quién, dónde, qué pasaba), nunca la moraleja; las preguntas
// de comprensión se responden con el pasaje y señalan el versículo; la pregunta abierta y el reto invitan, no
// sermonean. En cada pregunta de comprensión la respuesta correcta va primero: la pantalla las baraja.

export type RutaId = 'jesus' | 'identidad' | 'valientes' | 'paz' | 'amigos';

export type Pregunta = {
  q: string;
  /** La primera es la correcta. */
  opciones: [string, string, string];
  /** Versículo donde está la respuesta. */
  v: number;
};

export type Mision = {
  id: string;
  titulo: string;
  book: string;
  chapter: number;
  from: number;
  to: number;
  gancho: string;
  preguntas: [Pregunta, Pregunta];
  piensa: string;
  vive: string;
  /** El pasaje toca la tristeza profunda o el deseo de morir: la misión muestra a quién pedir ayuda. */
  cuidado?: boolean;
};

export type Ruta = {
  id: RutaId;
  titulo: string;
  lema: string;
  /** Nombre del sello que se gana al terminar la ruta. */
  sello: string;
  tinte: { light: [string, string]; dark: [string, string] };
  misiones: Mision[];
};

export const RUTAS: Ruta[] = [
  {
    id: 'jesus',
    titulo: '¿Quién es Jesús?',
    lema: 'Seis encuentros en Marcos, el evangelio más corto.',
    sello: 'Seguidor',
    tinte: { light: ['#9B3B2E', '#F7E4DF'], dark: ['#F0A595', '#3A211C'] },
    misiones: [
      {
        id: 'redes',
        titulo: 'Deja las redes',
        book: 'mrk',
        chapter: 1,
        from: 14,
        to: 20,
        gancho: 'Marcos va directo al grano: en pocos versículos Jesús ya está llamando a sus primeros seguidores, unos pescadores del mar de Galilea.',
        preguntas: [
          { q: '¿Qué estaban haciendo Simón y Andrés cuando Jesús los llamó?', opciones: ['Echaban la red en el mar', 'Cosían sus redes en la barca', 'Vendían pescado en el pueblo'], v: 16 },
          { q: '¿Qué hicieron Jacobo y Juan cuando Jesús los llamó?', opciones: ['Dejaron a su padre en la barca y lo siguieron', 'Le pidieron tiempo para pensarlo', 'Invitaron a Jesús a su casa'], v: 20 },
        ],
        piensa: 'Ellos dejaron las redes, lo que hacían todos los días. ¿Qué ocupa ahora mismo más espacio que Jesús en tu día?',
        vive: 'Esta semana, dale a Jesús los primeros cinco minutos del día antes de abrir el celular.',
      },
      {
        id: 'techo',
        titulo: 'Por el techo',
        book: 'mrk',
        chapter: 2,
        from: 1,
        to: 12,
        gancho: 'La casa en Capernaúm estaba tan llena que no cabía nadie más ni en la puerta. Cuatro amigos tenían un problema y no se rindieron.',
        preguntas: [
          { q: '¿Cómo llegaron los amigos hasta Jesús?', opciones: ['Abrieron el techo y bajaron la camilla', 'Esperaron afuera hasta la noche', 'Pidieron a la gente que se apartara'], v: 4 },
          { q: '¿Qué le dijo Jesús primero al paralítico?', opciones: ['Que sus pecados estaban perdonados', 'Que se levantara y caminara', 'Que volviera otro día'], v: 5 },
        ],
        piensa: 'Jesús vio la fe de los amigos. ¿Quién te acercó a ti a Jesús? ¿Y a quién podrías acercar tú?',
        vive: 'Escríbele hoy a un amigo para preguntarle cómo está, de verdad.',
      },
      {
        id: 'tormenta',
        titulo: 'La tormenta',
        book: 'mrk',
        chapter: 4,
        from: 35,
        to: 41,
        gancho: 'Varios discípulos eran pescadores con experiencia en ese lago, y aun así esta tormenta los asustó.',
        preguntas: [
          { q: '¿Qué hacía Jesús mientras la barca se llenaba de agua?', opciones: ['Dormía sobre un cojín en la popa', 'Remaba con los discípulos', 'Oraba en la orilla'], v: 38 },
          { q: '¿Qué se preguntaron los discípulos al final?', opciones: ['¿Quién es este, que hasta el viento y el mar le obedecen?', '¿Por qué no nos avisó antes?', '¿Cuándo llegaremos a la otra orilla?'], v: 41 },
        ],
        piensa: 'Los discípulos le dijeron: «¿no te importa?». ¿Hay alguna tormenta en tu vida en la que te has preguntado lo mismo?',
        vive: 'Cuando algo te preocupe esta semana, díselo a Jesús con tus palabras, tan directo como ellos.',
      },
      {
        id: 'bartimeo',
        titulo: 'Bartimeo grita',
        book: 'mrk',
        chapter: 10,
        from: 46,
        to: 52,
        gancho: 'Bartimeo era ciego y pedía limosna junto al camino a la salida de Jericó. Mucha gente quería que se callara.',
        preguntas: [
          { q: '¿Qué hizo Bartimeo cuando lo mandaron a callar?', opciones: ['Gritó todavía más fuerte', 'Se fue a su casa', 'Esperó en silencio'], v: 48 },
          { q: '¿Qué le preguntó Jesús?', opciones: ['¿Qué quieres que haga por ti?', '¿Por qué gritas tanto?', '¿Quién te trajo hasta aquí?'], v: 51 },
        ],
        piensa: 'Jesús le preguntó qué quería, aunque parecía obvio. Si te hiciera hoy esa pregunta, ¿qué le responderías?',
        vive: 'Fíjate esta semana en alguien a quien los demás ignoran y salúdalo por su nombre.',
      },
      {
        id: 'cruz',
        titulo: 'La cruz',
        book: 'mrk',
        chapter: 15,
        from: 33,
        to: 39,
        gancho: 'Es el momento más oscuro del evangelio, y Marcos lo cuenta con muy pocas palabras.',
        preguntas: [
          { q: '¿Qué pasó con la cortina del templo cuando Jesús murió?', opciones: ['Se rasgó en dos de arriba abajo', 'Se quemó', 'Se cayó al suelo'], v: 38 },
          { q: '¿Qué dijo el capitán romano que estaba frente a la cruz?', opciones: ['Que de verdad ese hombre era Hijo de Dios', 'Que era un profeta más', 'Que había que bajarlo de la cruz'], v: 39 },
        ],
        piensa: 'Jesús gritó: «¿por qué me has abandonado?». ¿Qué significa para ti que Jesús conozca ese dolor desde adentro?',
        vive: 'Antes de dormir, una noche de esta semana, vuelve a leer este pasaje despacio y quédate un minuto en silencio.',
      },
      {
        id: 'resucito',
        titulo: '¡Ha resucitado!',
        book: 'mrk',
        chapter: 16,
        from: 1,
        to: 8,
        gancho: 'Tres mujeres fueron muy temprano a la tumba con especias para el cuerpo de Jesús. Iban preocupadas por una piedra enorme.',
        preguntas: [
          { q: '¿Qué les preocupaba a las mujeres en el camino?', opciones: ['Quién les quitaría la piedra de la entrada', 'Que los soldados las vieran', 'No encontrar el lugar'], v: 3 },
          { q: 'Además de «sus discípulos», ¿a quién nombra el joven vestido de blanco?', opciones: ['A Pedro', 'A Juan', 'A Tomás'], v: 7 },
        ],
        piensa: 'Pedro había negado a Jesús tres veces, y el mensaje lo nombra a él. ¿Qué te dice eso de cómo trata Jesús a quien le ha fallado?',
        vive: 'Cuéntale a alguien esta semana, con tus palabras, por qué la resurrección importa para ti.',
      },
    ],
  },
  {
    id: 'identidad',
    titulo: '¿Quién soy?',
    lema: 'Lo que Dios dice de ti cuando todos opinan.',
    sello: 'Imagen de Dios',
    tinte: { light: ['#1F6F6B', '#DDF0EE'], dark: ['#8FD3CC', '#17302E'] },
    misiones: [
      {
        id: 'imagen',
        titulo: 'Hecho a su imagen',
        book: 'gen',
        chapter: 1,
        from: 26,
        to: 31,
        gancho: 'Al final del relato de la creación aparece algo que no se dice de ninguna otra criatura.',
        preguntas: [
          { q: '¿A imagen de quién hizo Dios al ser humano?', opciones: ['A imagen de Dios', 'A imagen de los ángeles', 'A imagen de los animales'], v: 27 },
          { q: '¿Qué vio Dios al mirar todo lo que había hecho?', opciones: ['Que era muy bueno', 'Que faltaba algo', 'Que debía empezar de nuevo'], v: 31 },
        ],
        piensa: 'Si llevas la imagen de Dios, ¿cómo cambia eso lo que piensas de ti cuando te miras al espejo?',
        vive: 'Cada vez que pienses algo duro sobre ti esta semana, recuerda: «Dios me hizo a su imagen».',
      },
      {
        id: 'me-conoces',
        titulo: 'Me conoces',
        book: 'psa',
        chapter: 139,
        from: 1,
        to: 14,
        gancho: 'David escribió este salmo maravillado de que Dios lo conoce por completo, por dentro y por fuera.',
        preguntas: [
          { q: 'Según el salmo, ¿qué sabe Dios antes de que lo digas?', opciones: ['Cada palabra que vas a decir', 'Solo tus buenas acciones', 'Lo que otros piensan de ti'], v: 4 },
          { q: '¿Cómo es la oscuridad para Dios?', opciones: ['No es oscura: la noche brilla como el día', 'Lo esconde todo', 'Le impide ver'], v: 12 },
        ],
        piensa: 'Ser conocido del todo puede dar miedo o dar paz. ¿Qué sientes tú al leer que Dios te conoce así?',
        vive: 'Escribe el versículo 14 en una nota y ponla donde la veas cada mañana.',
      },
      {
        id: 'corazon',
        titulo: 'Dios ve el corazón',
        book: '1sa',
        chapter: 16,
        from: 1,
        to: 13,
        gancho: 'Samuel fue a la casa de Isaí, en Belén, a ungir al próximo rey. Él esperaba a alguien alto e impresionante.',
        preguntas: [
          { q: '¿Qué le dijo Dios a Samuel cuando vio a Eliab?', opciones: ['Que no se fijara en su apariencia ni en su altura', 'Que ese era el elegido', 'Que volviera al día siguiente'], v: 7 },
          { q: '¿Dónde estaba David cuando llegó Samuel?', opciones: ['Cuidando las ovejas', 'En la guerra', 'Dormido en casa'], v: 11 },
        ],
        piensa: 'Nadie pensó en llamar a David. ¿En qué parte de tu vida sientes que nadie te tiene en cuenta?',
        vive: 'Esta semana, felicita a alguien por algo de su carácter, no de su apariencia.',
      },
      {
        id: 'joven',
        titulo: '«Soy muy joven»',
        book: 'jer',
        chapter: 1,
        from: 4,
        to: 10,
        gancho: 'Jeremías recibió un llamado enorme siendo joven, y su primera respuesta fue una excusa.',
        preguntas: [
          { q: '¿Qué excusa puso Jeremías?', opciones: ['Que era muy joven y no sabía hablar', 'Que estaba enfermo', 'Que le tenía miedo al rey'], v: 6 },
          { q: '¿Qué le prometió Dios?', opciones: ['Que estaría con él para protegerlo', 'Que nunca tendría problemas', 'Que todos lo escucharían'], v: 8 },
        ],
        piensa: '¿Para qué cosas te dices «soy muy joven»? ¿Qué cambiaría si Dios estuviera contigo en eso?',
        vive: 'Ofrécete esta semana para algo en tu iglesia o en tu casa que normalmente dejarías a un adulto.',
      },
      {
        id: 'regalo',
        titulo: 'Un regalo, no un premio',
        book: 'eph',
        chapter: 2,
        from: 4,
        to: 10,
        gancho: 'Pablo escribe a los cristianos de Éfeso sobre cómo Dios los salvó. Y no fue por portarse bien.',
        preguntas: [
          { q: 'Según el pasaje, ¿cómo somos salvos?', opciones: ['Por gracia, por medio de la fe', 'Por nuestras buenas obras', 'Por no equivocarnos nunca'], v: 8 },
          { q: '¿Para qué fuimos creados en Cristo Jesús?', opciones: ['Para hacer las buenas obras que Dios preparó', 'Para ganarnos el cielo', 'Para que nadie nos critique'], v: 10 },
        ],
        piensa: 'La salvación es un regalo, no un premio. ¿Por qué crees que cuesta aceptar algo que no te ganaste?',
        vive: 'Haz una buena obra esta semana en secreto, sin que nadie se entere.',
      },
      {
        id: 'hijos',
        titulo: 'Hijos de Dios',
        book: '1jn',
        chapter: 3,
        from: 1,
        to: 3,
        gancho: 'Juan escribe esta carta ya mayor, a cristianos a los que trata con el cariño de un padre.',
        preguntas: [
          { q: '¿Cómo nos llama el Padre por su gran amor?', opciones: ['Hijos de Dios', 'Siervos de Dios', 'Invitados de Dios'], v: 1 },
          { q: '¿Qué pasará cuando Cristo se manifieste?', opciones: ['Seremos como él, porque lo veremos tal como es', 'Nada cambiará', 'Tendremos que empezar de cero'], v: 2 },
        ],
        piensa: '¿Qué diferencia hay entre saber que eres hijo de Dios y sentirlo? ¿Cuál de las dos te cuesta más?',
        vive: 'Esta semana, cuando ores, empieza diciendo «Padre» y fíjate cómo cambia tu oración.',
      },
    ],
  },
  {
    id: 'valientes',
    titulo: 'Valientes',
    lema: 'Jóvenes que se mantuvieron firmes cuando era difícil.',
    sello: 'Valiente',
    tinte: { light: ['#A8641F', '#F5E9D8'], dark: ['#E2A868', '#36291B'] },
    misiones: [
      {
        id: 'josue',
        titulo: 'Sé fuerte',
        book: 'jos',
        chapter: 1,
        from: 1,
        to: 9,
        gancho: 'Moisés había muerto y ahora Josué tenía que guiar a todo el pueblo hacia una tierra nueva. Un cambio enorme.',
        preguntas: [
          { q: '¿Qué le repite Dios a Josué varias veces?', opciones: ['Que sea fuerte y valiente', 'Que tenga cuidado con todos', 'Que descanse un tiempo'], v: 6 },
          { q: '¿Por qué no tenía que tener miedo Josué?', opciones: ['Porque Dios estaría con él dondequiera que fuera', 'Porque tenía un gran ejército', 'Porque los enemigos eran pocos'], v: 9 },
        ],
        piensa: 'Dios no le quitó el reto a Josué: le prometió su compañía. ¿Qué reto tienes por delante que te da miedo?',
        vive: 'Memoriza el versículo 9 esta semana y repítelo cuando sientas miedo.',
      },
      {
        id: 'goliat',
        titulo: 'David y el gigante',
        book: '1sa',
        chapter: 17,
        from: 41,
        to: 50,
        gancho: 'Todo el ejército de Israel temblaba ante Goliat, un guerrero filisteo enorme. Un muchacho pastor se ofreció a enfrentarlo.',
        preguntas: [
          { q: '¿En nombre de quién dijo David que venía?', opciones: ['En el nombre del Señor', 'En nombre del rey Saúl', 'En nombre de su familia'], v: 45 },
          { q: '¿Con qué venció David a Goliat?', opciones: ['Con una honda y una piedra', 'Con la espada del rey', 'Con una lanza'], v: 50 },
        ],
        piensa: 'David dijo que la batalla era del Señor. ¿Qué «gigante» enfrentas tú, y cómo sería ponerlo en manos de Dios?',
        vive: 'Haz esta semana algo que vienes evitando por miedo, y ora antes de hacerlo.',
      },
      {
        id: 'daniel-comida',
        titulo: 'Lejos de casa',
        book: 'dan',
        chapter: 1,
        from: 8,
        to: 16,
        gancho: 'Daniel y sus amigos fueron llevados lejos de su tierra, a Babilonia, para servir al rey. Allí todo los empujaba a olvidar quiénes eran.',
        preguntas: [
          { q: '¿Qué decidió Daniel?', opciones: ['No contaminarse con la comida y el vino del rey', 'Escapar de Babilonia', 'Pelear contra los guardias'], v: 8 },
          { q: '¿Cuánto duró la prueba que propuso Daniel?', opciones: ['Diez días', 'Tres días', 'Un año'], v: 12 },
        ],
        piensa: 'Daniel no fue grosero: pidió con respeto y propuso una prueba. ¿Cómo puedes mantenerte firme sin pelear con nadie?',
        vive: 'Elige esta semana una cosa en la que no vas a seguir a la mayoría, y cuéntaselo a Dios.',
      },
      {
        id: 'horno',
        titulo: '«Y si no…»',
        book: 'dan',
        chapter: 3,
        from: 16,
        to: 27,
        gancho: 'El rey Nabucodonosor mandó que todos adoraran una estatua de oro. Tres amigos de Daniel se negaron.',
        preguntas: [
          { q: '¿Qué dijeron los tres amigos aunque Dios no los librara?', opciones: ['Que igual no adorarían la estatua', 'Que lo pensarían otra vez', 'Que la adorarían solo una vez'], v: 18 },
          { q: '¿Cuántos hombres vio el rey caminando en el fuego?', opciones: ['Cuatro', 'Tres', 'Ninguno'], v: 25 },
        ],
        piensa: '«Y si no…» es una fe que no depende del resultado. ¿Confías en Dios solo cuando las cosas salen bien?',
        vive: 'Cuéntale esta historia a un amigo esta semana y pregúntale qué habría hecho en su lugar.',
      },
      {
        id: 'ester',
        titulo: 'Para un momento como este',
        book: 'est',
        chapter: 4,
        from: 10,
        to: 17,
        gancho: 'Ester era reina, pero casi nadie sabía que era judía. Un decreto del rey amenazaba a todo su pueblo.',
        preguntas: [
          { q: '¿Por qué era peligroso que Ester fuera a ver al rey?', opciones: ['Quien entraba sin ser llamado podía morir', 'El rey estaba de viaje', 'Estaba prohibido hablar de los judíos'], v: 11 },
          { q: '¿Qué pidió Ester antes de ir?', opciones: ['Que ayunaran por ella tres días', 'Que le llevaran un regalo al rey', 'Que Mardoqueo fuera en su lugar'], v: 16 },
        ],
        piensa: 'Mardoqueo le dijo: «¿quién sabe si para esto has llegado?». ¿Dónde te ha puesto Dios a ti, y para qué podría ser?',
        vive: 'Defiende esta semana a alguien de quien se burlan, aunque te cueste.',
      },
      {
        id: 'leones',
        titulo: 'Entre leones',
        book: 'dan',
        chapter: 6,
        from: 16,
        to: 23,
        gancho: 'Los enemigos de Daniel lograron que el rey prohibiera orar a cualquiera que no fuera él. Daniel siguió orando como siempre.',
        preguntas: [
          { q: 'Según Daniel, ¿quién cerró la boca de los leones?', opciones: ['Un ángel enviado por Dios', 'El rey', 'Los guardias'], v: 22 },
          { q: '¿Cómo pasó la noche el rey?', opciones: ['Sin comer y sin poder dormir', 'En una fiesta', 'Durmiendo tranquilo'], v: 18 },
        ],
        piensa: 'Daniel oraba siempre, no solo en la crisis. ¿Cómo es tu oración en un día normal?',
        vive: 'Escoge una hora fija esta semana para orar cinco minutos cada día.',
      },
    ],
  },
  {
    id: 'paz',
    titulo: 'Paz en la ansiedad',
    lema: 'Para los días en que la cabeza no para.',
    sello: 'En paz',
    tinte: { light: ['#2F5D8C', '#E1EBF6'], dark: ['#A3C3E6', '#1C2838'] },
    misiones: [
      {
        id: 'aves',
        titulo: 'Mira las aves',
        book: 'mat',
        chapter: 6,
        from: 25,
        to: 34,
        gancho: 'Jesús le habla a una multitud de gente sencilla, preocupada por la comida y la ropa de cada día.',
        preguntas: [
          { q: '¿Qué ejemplos de la naturaleza usa Jesús?', opciones: ['Las aves y las flores del campo', 'Los leones y los osos', 'Las estrellas y la luna'], v: 26 },
          { q: '¿Qué dice Jesús que busquemos primero?', opciones: ['El reino de Dios y su justicia', 'Tener todo bajo control', 'Un buen trabajo'], v: 33 },
        ],
        piensa: '¿Qué te preocupa del mañana? Nómbralo y pregúntate qué parte de eso puedes dejar hoy en manos del Padre.',
        vive: 'Cada noche de esta semana, antes de dormir, nombra tres cosas por las que das gracias.',
      },
      {
        id: 'filipenses',
        titulo: 'Desde la cárcel',
        book: 'php',
        chapter: 4,
        from: 4,
        to: 9,
        gancho: 'Pablo escribió esta carta preso, y aun así habla de alegría y de paz.',
        preguntas: [
          { q: '¿Qué recomienda Pablo en lugar de vivir afanados?', opciones: ['Presentar todo a Dios en oración, con gratitud', 'Distraerse con otra cosa', 'No pensar en nada'], v: 6 },
          { q: '¿Qué guardará el corazón y la mente?', opciones: ['La paz de Dios', 'El éxito', 'La opinión de los demás'], v: 7 },
        ],
        piensa: 'El versículo 8 da una lista de cosas en qué pensar. ¿Qué cosas llenan tu mente cuando estás con el celular?',
        vive: 'Cambia esta semana diez minutos de redes sociales por algo de la lista del versículo 8.',
      },
      {
        id: 'pastor',
        titulo: 'Mi pastor',
        book: 'psa',
        chapter: 23,
        from: 1,
        to: 6,
        gancho: 'David cuidó ovejas antes de ser rey. En este salmo se ve a sí mismo como una oveja.',
        preguntas: [
          { q: '¿A dónde lleva el pastor a su oveja?', opciones: ['A pastos verdes y aguas tranquilas', 'A la ciudad', 'A lo alto de una montaña'], v: 2 },
          { q: '¿Por qué no teme en el valle de sombra de muerte?', opciones: ['Porque el Señor está con él', 'Porque es muy fuerte', 'Porque el valle es corto'], v: 4 },
        ],
        piensa: 'El salmo no promete que no habrá valles oscuros, sino que no estarás solo en ellos. ¿Qué valle estás cruzando ahora?',
        vive: 'Lee el Salmo 23 en voz alta una noche de esta semana, despacio.',
      },
      {
        id: 'elias',
        titulo: 'Cansado de todo',
        book: '1ki',
        chapter: 19,
        from: 1,
        to: 8,
        gancho: 'Elías acababa de vivir una gran victoria. Una amenaza de la reina Jezabel lo hundió en el miedo y el agotamiento.',
        preguntas: [
          { q: '¿Qué hizo Elías después de la amenaza?', opciones: ['Huyó al desierto y le pidió a Dios morir', 'Fue a enfrentar a Jezabel', 'Se escondió en su casa'], v: 4 },
          { q: '¿Qué le dio el ángel antes que cualquier otra cosa?', opciones: ['Pan y agua, y lo dejó dormir', 'Un regaño por huir', 'Una espada'], v: 6 },
        ],
        piensa: 'Dios cuidó primero el cuerpo cansado de Elías. ¿Cómo estás durmiendo y comiendo estos días?',
        vive: 'Esta semana, acuéstate a una hora fija y deja el celular fuera de la cama.',
        cuidado: true,
      },
      {
        id: 'camino',
        titulo: 'No se turbe',
        book: 'jhn',
        chapter: 14,
        from: 1,
        to: 6,
        gancho: 'Es la última cena. Jesús sabe que va a morir, y sus amigos están confundidos y tristes.',
        preguntas: [
          { q: '¿Qué les pide Jesús que no dejen que pase?', opciones: ['Que su corazón se turbe', 'Que se vayan a casa', 'Que les tengan miedo a los romanos'], v: 1 },
          { q: '¿Qué le responde Jesús a la duda de Tomás?', opciones: ['Yo soy el camino, la verdad y la vida', 'Pronto lo entenderás', 'No preguntes tanto'], v: 6 },
        ],
        piensa: 'Tomás dijo con honestidad: «no sabemos». ¿Qué duda tienes que te gustaría decirle a Jesús así de directo?',
        vive: 'Escribe tu duda y conversa sobre ella esta semana con tu líder o con alguien maduro en la fe.',
      },
      {
        id: 'descanso',
        titulo: 'Descanso',
        book: 'mat',
        chapter: 11,
        from: 28,
        to: 30,
        gancho: 'Un yugo era la madera que unía a dos bueyes para que tiraran juntos del arado. Jesús usa esa imagen.',
        preguntas: [
          { q: '¿A quiénes invita Jesús?', opciones: ['A los cansados y cargados', 'Solo a los fuertes', 'A los que nunca fallan'], v: 28 },
          { q: '¿Cómo describe Jesús su carga?', opciones: ['Ligera', 'Pesada pero justa', 'Imposible de llevar'], v: 30 },
        ],
        piensa: '¿Qué carga llevas que no te toca cargar a ti?',
        vive: 'Haz cada día una pausa de cinco minutos sin pantallas y repite: «Vengan a mí… y les daré descanso».',
      },
    ],
  },
  {
    id: 'amigos',
    titulo: 'Amigos y familia',
    lema: 'Lo que la Biblia dice de querer bien a los demás.',
    sello: 'Prójimo',
    tinte: { light: ['#4F7A2E', '#E7F1DC'], dark: ['#B5D88F', '#22301A'] },
    misiones: [
      {
        id: 'jonatan',
        titulo: 'Jonatán y David',
        book: '1sa',
        chapter: 18,
        from: 1,
        to: 4,
        gancho: 'Jonatán era hijo del rey Saúl y heredero del trono. David era un pastor que acababa de vencer a Goliat.',
        preguntas: [
          { q: '¿Cómo quería Jonatán a David?', opciones: ['Como a sí mismo', 'Como a un rival', 'Como a un sirviente'], v: 3 },
          { q: '¿Qué le regaló Jonatán a David?', opciones: ['Su manto, su ropa, su espada y su arco', 'Una corona', 'Dinero'], v: 4 },
        ],
        piensa: 'Jonatán regaló lo que lo identificaba como príncipe. ¿Qué te cuesta compartir con tus amigos?',
        vive: 'Dile esta semana a un amigo por qué agradeces su amistad.',
      },
      {
        id: 'rut',
        titulo: 'A donde tú vayas',
        book: 'rut',
        chapter: 1,
        from: 6,
        to: 18,
        gancho: 'Noemí había perdido a su esposo y a sus dos hijos. Decidió volver a su tierra y les pidió a sus nueras que se quedaran en la suya.',
        preguntas: [
          { q: '¿Qué hizo Orfa?', opciones: ['Besó a Noemí y volvió a su pueblo', 'Se fue con Noemí', 'Se quedó sola en el camino'], v: 14 },
          { q: '¿Qué le dijo Rut a Noemí?', opciones: ['«A donde tú vayas, iré yo»', '«Volveré a buscarte»', '«No puedo dejar a mi familia»'], v: 16 },
        ],
        piensa: 'Rut se quedó cuando lo fácil era irse. ¿Quién en tu vida necesita que te quedes cerca ahora?',
        vive: 'Acompaña esta semana a alguien de tu familia en algo que le cueste, aunque no sea divertido.',
      },
      {
        id: 'prodigo',
        titulo: 'El padre que corre',
        book: 'luk',
        chapter: 15,
        from: 11,
        to: 24,
        gancho: 'Jesús cuenta esta historia a gente religiosa que lo criticaba por comer con «pecadores».',
        preguntas: [
          { q: '¿Qué hizo el hijo menor con su herencia?', opciones: ['La malgastó en un país lejano', 'La invirtió bien', 'La compartió con su hermano'], v: 13 },
          { q: '¿Qué hizo el padre al ver a su hijo de lejos?', opciones: ['Corrió, lo abrazó y lo besó', 'Esperó a que pidiera perdón', 'Cerró la puerta'], v: 20 },
        ],
        piensa: 'El padre corrió antes de oír el discurso de su hijo. ¿Qué te dice eso de cómo te recibe Dios cuando vuelves?',
        vive: 'Si tienes que pedirle perdón a alguien de tu familia, hazlo esta semana.',
      },
      {
        id: 'cordon',
        titulo: 'Mejor dos que uno',
        book: 'ecc',
        chapter: 4,
        from: 9,
        to: 12,
        gancho: 'El autor de Eclesiastés mira la vida tal como es, y aquí nota algo sobre la soledad.',
        preguntas: [
          { q: '¿Qué pasa si uno cae y está acompañado?', opciones: ['El otro lo levanta', 'Los dos caen', 'Nadie se da cuenta'], v: 10 },
          { q: '¿Qué no se rompe fácilmente?', opciones: ['Un cordón de tres hilos', 'Una espada nueva', 'Una puerta cerrada'], v: 12 },
        ],
        piensa: '¿Quiénes te levantan cuando caes? ¿Para quién eres tú esa persona?',
        vive: 'Invita esta semana a alguien que está solo a sentarse contigo o a hacer algo juntos.',
      },
      {
        id: 'amigos-jesus',
        titulo: 'Te llamo amigo',
        book: 'jhn',
        chapter: 15,
        from: 12,
        to: 17,
        gancho: 'En la última cena, Jesús les deja a sus discípulos un mandamiento que repite dos veces.',
        preguntas: [
          { q: '¿Qué mandamiento repite Jesús?', opciones: ['Que se amen unos a otros', 'Que oren más', 'Que no hablen con extraños'], v: 12 },
          { q: '¿Cómo llama Jesús a sus discípulos?', opciones: ['Amigos', 'Siervos', 'Alumnos'], v: 15 },
        ],
        piensa: 'Jesús te llama amigo. ¿Cómo cambia tu oración saber que hablas con un amigo y no solo con un jefe?',
        vive: 'Haz esta semana algo por un amigo que a él le cueste y que tú sí puedas hacer.',
      },
      {
        id: 'samaritano',
        titulo: '¿Quién es mi prójimo?',
        book: 'luk',
        chapter: 10,
        from: 30,
        to: 37,
        gancho: 'Un experto en la ley le preguntó a Jesús: «¿y quién es mi prójimo?». Jesús respondió con esta historia.',
        preguntas: [
          { q: '¿Quiénes pasaron de largo junto al herido?', opciones: ['Un sacerdote y un levita', 'Dos soldados', 'Unos comerciantes'], v: 31 },
          { q: '¿Qué hizo el samaritano?', opciones: ['Lo curó, lo llevó a un mesón y pagó por él', 'Avisó a los guardias del camino', 'Le dejó unas monedas y siguió'], v: 34 },
        ],
        piensa: 'Judíos y samaritanos no se llevaban. ¿Quién es esa persona difícil de tu escuela o tu barrio a la que podrías acercarte?',
        vive: 'Ayuda esta semana a alguien que no podría devolverte el favor.',
      },
    ],
  },
];
