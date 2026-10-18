// Catálogo de planes de lectura. Dos clases:
// - «a tu ritmo»: una lista de capítulos que se reparte en días según los minutos que la persona tiene;
// - retos «de temporada»: un capítulo por día con fecha común para todos, siguiendo el año cristiano
//   (Cuaresma, Semana Santa, Pentecostés, Adviento y Año nuevo). Cada día trae una pregunta para pensar:
//   lo que se busca es profundidad, no velocidad.

export type Season = 'cuaresma' | 'semana-santa' | 'pentecostes' | 'adviento' | 'anio-nuevo';

/** [libro, capítulo] o [libro] para el libro entero. */
type Spec = [string, number?];

export type PlanDef = {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Capítulos en orden; un libro sin capítulo significa el libro entero. */
  spec: Spec[];
  /** Solo en los de temporada: un título por día, en el mismo orden que los capítulos. */
  days?: string[];
  /** Solo en los de temporada: una pregunta para pensar por día. */
  questions?: string[];
  season?: Season;
};

const OT = [
  'gen', 'exo', 'lev', 'num', 'deu', 'jos', 'jdg', 'rut', '1sa', '2sa', '1ki', '2ki', '1ch', '2ch', 'ezr', 'neh',
  'est', 'job', 'psa', 'pro', 'ecc', 'sng', 'isa', 'jer', 'lam', 'ezk', 'dan', 'hos', 'jol', 'amo', 'oba', 'jon',
  'mic', 'nam', 'hab', 'zep', 'hag', 'zec', 'mal',
];
const NT = [
  'mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co', 'gal', 'eph', 'php', 'col', '1th', '2th', '1ti', '2ti',
  'tit', 'phm', 'heb', 'jas', '1pe', '2pe', '1jn', '2jn', '3jn', 'jud', 'rev',
];

const books = (ids: string[]): Spec[] => ids.map((id) => [id]);

export const PLANS: PlanDef[] = [
  {
    id: 'juan',
    title: 'El Evangelio de Juan',
    description: 'Para conocer a Jesús de cerca: sus señales, sus palabras y su cruz. Un buen primer plan.',
    icon: '✚',
    spec: [['jhn']],
  },
  {
    id: 'marcos',
    title: 'Marcos, la vida de Jesús',
    description: 'El evangelio más corto y directo, lleno de acción. Se lee en pocas semanas.',
    icon: '✦',
    spec: [['mrk']],
  },
  {
    id: 'salmos',
    title: 'Los Salmos',
    description: 'Ciento cincuenta oraciones para aprender a hablar con Dios en la alegría y en la angustia.',
    icon: '♪',
    spec: [['psa']],
  },
  {
    id: 'proverbios',
    title: 'Proverbios',
    description: 'Sabiduría práctica para el trabajo, la familia, las palabras y el dinero.',
    icon: '◆',
    spec: [['pro']],
  },
  {
    id: 'romanos',
    title: 'Romanos',
    description: 'El evangelio explicado paso a paso: pecado, gracia, fe y vida nueva.',
    icon: '¶',
    spec: [['rom']],
  },
  {
    id: 'genesis',
    title: 'Génesis',
    description: 'Los comienzos: la creación, la caída y las promesas a Abraham, Isaac, Jacob y José.',
    icon: '☼',
    spec: [['gen']],
  },
  {
    id: 'nt',
    title: 'El Nuevo Testamento',
    description: 'De Mateo a Apocalipsis, a tu paso.',
    icon: '✧',
    spec: books(NT),
  },
  {
    id: 'biblia',
    title: 'La Biblia completa',
    description: 'De Génesis a Apocalipsis. Con unos 13 minutos al día se lee en un año.',
    icon: '☰',
    spec: books([...OT, ...NT]),
  },

  {
    id: 'cuaresma',
    season: 'cuaresma',
    title: 'Cuaresma: camino a la cruz',
    description:
      'Cuarenta días desde el Miércoles de Ceniza hasta la Pascua. Los domingos no hay lectura nueva: son para descansar o ponerte al día.',
    icon: '✝',
    spec: [
      ['psa', 51], ['jol', 2], ['isa', 58], ['mat', 4], ['mat', 5], ['mat', 6], ['mat', 7], ['gen', 22], ['exo', 12],
      ['psa', 22], ['isa', 53], ['luk', 15], ['jhn', 3], ['jhn', 4], ['jhn', 6], ['jhn', 8], ['jhn', 9], ['jhn', 10],
      ['jhn', 11], ['luk', 18], ['luk', 19], ['mrk', 10], ['mrk', 11], ['mrk', 12], ['mrk', 13], ['jhn', 12],
      ['jhn', 13], ['jhn', 14], ['jhn', 15], ['jhn', 16], ['jhn', 17], ['mat', 26], ['mrk', 14], ['luk', 22],
      ['jhn', 18], ['mat', 27], ['luk', 23], ['jhn', 19], ['heb', 9], ['heb', 10], ['jhn', 20],
    ],
    days: [
      'Crea en mí un corazón limpio', 'Volved a mí de todo corazón', 'El ayuno que Dios quiere', 'Tentado en el desierto',
      'Las bienaventuranzas', 'La oración en lo secreto', 'La casa sobre la roca', 'Dios proveerá el cordero',
      'La sangre de la Pascua', '¿Por qué me has desamparado?', 'Herido por nuestras rebeliones', 'El padre que corre',
      'Nacer de nuevo', 'El agua viva', 'El pan de vida', 'La verdad os libertará', 'Ahora veo', 'El buen pastor',
      'Yo soy la resurrección', 'Ten misericordia de mí', 'Zaqueo y la entrada en Jerusalén', 'Vino a servir',
      'La higuera y el templo', 'El mayor mandamiento', 'Velad', 'Si el grano de trigo no muere', 'Lavó sus pies',
      'Yo soy el camino', 'La vid y los pámpanos', 'El Consolador', 'La oración de Jesús', 'Getsemaní',
      'La negación de Pedro', 'La última cena', 'Arrestado', 'Crucificado', 'Hoy estarás conmigo en el paraíso',
      'Consumado es', 'Una sola ofrenda', 'Acerquémonos con confianza', '¡Ha resucitado!',
    ],
    questions: [
      '¿Qué te gustaría pedirle a Dios que limpie o renueve en ti durante esta Cuaresma?',
      'Joel pide rasgar el corazón y no los vestidos. ¿Qué diferencia hay entre arrepentirse por fuera y por dentro?',
      'Según Isaías, ¿qué ayuno agrada a Dios? ¿A quién podrías servir esta semana?',
      'Jesús respondió cada tentación con la Escritura. ¿Qué versículo te ayudaría en tu tentación más frecuente?',
      '¿Cuál de las bienaventuranzas te cuesta más vivir, y por qué?',
      '¿Qué haces para que otros te vean, y qué haces solo para Dios?',
      '¿Qué enseñanza de Jesús has oído muchas veces pero todavía no pones en práctica?',
      '¿Qué te enseña Abraham sobre confiar en Dios cuando no entiendes lo que te pide?',
      '¿Cómo apunta el cordero de la Pascua a lo que Jesús hizo por ti?',
      'Jesús oró este salmo en la cruz. ¿Qué te dice que una oración pueda empezar en la angustia y terminar en alabanza?',
      'Lee despacio los versículos 4 a 6. ¿Qué palabra te detiene, y por qué?',
      '¿Te pareces hoy más al hijo menor o al mayor? ¿Qué te dice el padre a ti?',
      '¿Qué significa para ti «nacer de nuevo»? ¿Cómo se lo explicarías a un amigo?',
      '¿Con qué intentas calmar una sed que no se sacia? ¿Qué te ofrece Jesús en su lugar?',
      'Muchos dejaron a Jesús ese día. ¿Qué te hace quedarte, como Pedro: «¿a quién iremos?»?',
      '¿De qué te gustaría que la verdad de Jesús te hiciera libre?',
      'El ciego contó lo que sabía: «antes era ciego y ahora veo». ¿Qué ha cambiado en ti desde que conoces a Jesús?',
      '¿En qué situación de hoy necesitas escuchar la voz del buen pastor?',
      'Jesús lloró con Marta y María antes de resucitar a Lázaro. ¿Qué te dice eso de cómo te acompaña en tu dolor?',
      '¿Te identificas más con el fariseo o con el publicano? ¿Cómo sería orar hoy como el publicano?',
      'Zaqueo cambió su manera de usar el dinero. ¿Qué cambio concreto trae Jesús a tu vida?',
      'Jesús vino a servir y no a ser servido. ¿Dónde puedes servir esta semana sin que nadie lo note?',
      'La higuera tenía hojas pero no fruto. ¿Hay algo en tu fe que se ve bien por fuera pero no da fruto?',
      '¿Qué significaría amar a Dios con toda tu mente, y no solo con el corazón?',
      '¿Qué te ayuda a vivir despierto y preparado, sin miedo, esperando a Jesús?',
      '¿A qué necesitas morir para que Dios dé fruto en ti?',
      '¿A quién te cuesta servir? ¿Cómo sería, en la práctica, lavarle los pies?',
      '¿Qué te turba hoy? Lee los versículos 1 y 27 como palabras dirigidas a ti.',
      '¿Qué te ayuda a permanecer en Jesús durante un día normal?',
      '¿Qué hace el Espíritu Santo según este capítulo? ¿Cuál de esas cosas necesitas hoy?',
      'En el versículo 20 Jesús oró por ti. ¿Qué pidió, y qué sientes al saberlo?',
      '«No como yo quiero, sino como tú». ¿En qué área de tu vida te cuesta orar así?',
      'Pedro lloró amargamente, pero Jesús no lo desechó. ¿Qué esperanza te da su historia cuando fallas?',
      'Jesús dijo «haced esto en memoria de mí». ¿Qué recuerdas de Él cuando participas de la Santa Cena?',
      'Jesús se entregó cuando podía escapar. ¿Qué te dice eso de su amor por ti?',
      '¿Qué personaje de este capítulo te sorprende más, y por qué?',
      'El ladrón no tenía nada que ofrecer, solo fe. ¿Qué te enseña eso sobre la gracia?',
      '¿Qué quedó terminado en la cruz? ¿Hay algo que todavía intentas pagar tú?',
      '¿Qué diferencia hay entre los sacrificios antiguos y el de Cristo, según este capítulo?',
      '¿Qué te impide acercarte a Dios con confianza? ¿Qué responde el texto a eso?',
      'Si Jesús resucitó, ¿qué cambia en tu manera de ver el miedo, la culpa y la muerte?',
    ],
  },
  {
    id: 'semana-santa',
    season: 'semana-santa',
    title: 'Semana Santa: los últimos días',
    description: 'Ocho días con Jesús, del Domingo de Ramos a la mañana de la resurrección, un día de la semana a la vez.',
    icon: '✠',
    spec: [['luk', 19], ['mrk', 11], ['mat', 25], ['jhn', 12], ['jhn', 13], ['jhn', 19], ['isa', 53], ['luk', 24]],
    days: [
      'Domingo de Ramos: bendito el Rey que viene', 'Lunes: casa de oración', 'Martes: velad y estad listos',
      'Miércoles: el perfume de María', 'Jueves Santo: los amó hasta el fin', 'Viernes Santo: consumado es',
      'Sábado: el silencio de la espera', 'Domingo de Resurrección: ¡no está aquí!',
    ],
    questions: [
      'Jesús lloró sobre Jerusalén mientras lo aclamaban (v. 41). ¿Qué te dice eso de su corazón?',
      'Jesús limpió el templo. ¿Qué tendría que limpiar en ti para que tu vida sea casa de oración?',
      'De las tres parábolas, ¿cuál te habla más? ¿Qué significa estar listo hoy?',
      'María derramó por Jesús algo muy valioso. ¿Qué te gustaría ofrecerle tú esta semana?',
      'Jesús lavó los pies incluso de Judas. ¿A quién te pide amar así?',
      'Quédate un momento al pie de la cruz. ¿Qué le quieres decir a Jesús?',
      'El sábado los discípulos esperaban sin entender. ¿Qué esperas tú de Dios sin entenderlo todavía?',
      'A los de Emaús les ardía el corazón mientras Jesús les abría las Escrituras. ¿Cuándo te ha pasado algo así?',
    ],
  },
  {
    id: 'pentecostes',
    season: 'pentecostes',
    title: 'Pentecostés: diez días esperando la promesa',
    description:
      'De la Ascensión a Pentecostés, como los discípulos que esperaron orando juntos la venida del Espíritu Santo.',
    icon: '✹',
    spec: [['act', 1], ['jhn', 14], ['jhn', 16], ['jol', 2], ['ezk', 36], ['ezk', 37], ['rom', 8], ['gal', 5], ['1co', 12], ['act', 2]],
    days: [
      'Esperad la promesa del Padre', 'Otro Consolador', 'Os conviene que yo me vaya', 'Derramaré mi Espíritu',
      'Un corazón nuevo', 'Huesos secos, ¡vivid!', 'Guiados por el Espíritu', 'El fruto del Espíritu',
      'Un mismo Espíritu, muchos dones', 'Todos fueron llenos',
    ],
    questions: [
      'Los discípulos esperaron orando juntos (v. 14). ¿Con quién podrías orar en estos diez días?',
      'Jesús promete que el Espíritu estará con nosotros para siempre. ¿Qué cambia saber que no estás solo?',
      '¿Por qué dijo Jesús que convenía que Él se fuera? ¿Qué hace el Espíritu en el mundo y en ti?',
      'Dios promete su Espíritu sobre jóvenes y ancianos, hijos e hijas. ¿Qué te dice eso de a quién quiere usar Dios?',
      '¿Dónde notas tu corazón de piedra? Pídele a Dios el corazón nuevo que promete.',
      '¿Qué parece muerto o sin esperanza en tu vida, tu familia o tu iglesia? Ora por ello con este capítulo.',
      'El Espíritu intercede cuando no sabemos qué pedir (v. 26). ¿Qué te gustaría que Él pusiera en palabras por ti?',
      '¿Qué fruto del Espíritu ves crecer en ti, y cuál necesitas más?',
      '¿Qué don crees que Dios te ha dado para servir a otros? Si no lo sabes, pregúntale a alguien que te conozca bien.',
      'La iglesia nació orando, compartiendo y alabando juntos (v. 42-47). ¿Cuál de esas cosas quieres vivir más con los tuyos?',
    ],
  },
  {
    id: 'adviento',
    season: 'adviento',
    title: 'Adviento: la promesa cumplida',
    description: 'Del 1 al 25 de diciembre, siguiendo la promesa del Mesías desde el Edén hasta Belén.',
    icon: '✶',
    spec: [
      ['gen', 3], ['gen', 12], ['2sa', 7], ['psa', 2], ['isa', 7], ['isa', 9], ['isa', 11], ['isa', 35], ['isa', 40],
      ['isa', 42], ['isa', 60], ['isa', 61], ['jer', 23], ['mic', 5], ['mal', 3], ['luk', 1], ['mat', 1], ['psa', 98],
      ['jhn', 1], ['php', 2], ['heb', 1], ['col', 1], ['gal', 4], ['mat', 2], ['luk', 2],
    ],
    days: [
      'La primera promesa', 'En ti serán benditas las familias', 'Un trono para siempre', 'Mi Hijo eres tú',
      'La virgen concebirá', 'Un niño nos es nacido', 'Un vástago de Isaí', 'Él vendrá y os salvará', 'Consolaos',
      'Mi siervo escogido', 'Levántate, resplandece', 'Me ha enviado a sanar', 'El Renuevo justo', 'De ti, Belén',
      'El mensajero', 'Hágase conforme a tu palabra', 'Emanuel', 'Gozo al mundo', 'El Verbo se hizo carne',
      'Se humilló a sí mismo', 'El resplandor de su gloria', 'La imagen del Dios invisible', 'El cumplimiento del tiempo',
      'Los magos lo adoran', 'Os ha nacido un Salvador',
    ],
    questions: [
      'Justo después de la caída, Dios promete un vencedor (v. 15). ¿Qué te dice de Dios que la esperanza llegue tan pronto?',
      'Dios prometió bendecir a todas las familias de la tierra por medio de Abraham. ¿Cómo se cumple esa promesa en Jesús?',
      'Dios promete a David un trono para siempre. ¿Por qué importa que el Mesías sea hijo de David?',
      '¿Qué contraste ves entre las naciones que se rebelan y el Hijo que Dios ha puesto como Rey?',
      '«Emanuel» significa «Dios con nosotros». ¿Dónde necesitas recordar hoy que Dios está contigo?',
      'De los cuatro nombres del niño (v. 6), ¿cuál necesitas más hoy, y por qué?',
      'El Mesías trae justicia y paz. ¿Qué imagen de este capítulo te da más esperanza?',
      'El desierto florecerá. ¿Qué parte seca de tu vida le entregas a Dios en esta Navidad?',
      '«Consolaos». ¿Quién a tu alrededor necesita oír este consuelo esta semana?',
      'El Siervo «no quebrará la caña cascada» (v. 3). ¿Qué te dice eso de cómo trata Jesús a los débiles?',
      'La luz de Dios atrae a las naciones. ¿Cómo puedes reflejar esa luz donde vives o trabajas?',
      'Jesús leyó este pasaje en Nazaret (Lucas 4). ¿Qué parte de esta misión te toca continuar a ti?',
      'Dios promete un Renuevo justo frente a los malos pastores. ¿Qué esperas de un buen pastor, y cómo lo cumple Jesús?',
      'Dios eligió a la pequeña Belén. ¿Qué te dice eso de cómo obra Dios con lo pequeño?',
      'Dios envía un mensajero que prepara el camino. ¿Qué necesitas preparar en tu corazón para recibir a Jesús?',
      'María dijo «hágase conforme a tu palabra». ¿Qué te cuesta rendir a Dios como ella?',
      'En la genealogía de Jesús hay extranjeros y pecadores. ¿Qué te dice eso de la familia que vino a formar?',
      'Escribe tres razones por las que hoy puedes cantar a Dios un cántico nuevo.',
      '«El Verbo se hizo carne y habitó entre nosotros». ¿Qué significa para ti que Dios se acercara tanto?',
      'Cristo se humilló a sí mismo. ¿En qué relación podrías tener hoy ese mismo sentir?',
      '¿Qué dice este capítulo sobre quién es Jesús? Elige una frase y quédate con ella hoy.',
      'Todo fue creado por Él y para Él. ¿Cómo cambia eso tu manera de ver este día?',
      'Dios envió a su Hijo para que fuéramos hijos. ¿Qué significa para ti llamarle «Abba, Padre»?',
      'Los magos viajaron lejos para adorar. ¿Qué te cuesta a ti adorar a Jesús, y qué le ofreces?',
      'Los pastores fueron a ver y luego contaron lo que vieron. ¿A quién le contarás hoy la buena noticia?',
    ],
  },
  {
    id: 'anio-nuevo',
    season: 'anio-nuevo',
    title: 'Año nuevo: 21 días para empezar',
    description: 'Del 1 al 21 de enero, para empezar el año con fundamentos firmes.',
    icon: '◐',
    spec: [
      ['gen', 1], ['psa', 1], ['psa', 90], ['pro', 3], ['isa', 43], ['lam', 3], ['mat', 5], ['mat', 6], ['mat', 7],
      ['jhn', 1], ['jhn', 15], ['rom', 8], ['rom', 12], ['eph', 4], ['php', 3], ['php', 4], ['col', 3], ['heb', 11],
      ['heb', 12], ['jas', 1], ['1jn', 4],
    ],
    days: [
      'En el principio', 'Como árbol plantado', 'Enséñanos a contar nuestros días', 'Fíate de Jehová',
      'Yo hago cosa nueva', 'Nuevas son cada mañana', 'Sal y luz', 'Buscad primeramente el reino', 'Pedid y se os dará',
      'Luz en las tinieblas', 'Permaneced en mí', 'Ninguna condenación', 'Transformaos', 'Vestíos del nuevo hombre',
      'Prosigo a la meta', 'No os afanéis', 'Buscad las cosas de arriba', 'Por la fe', 'Corramos con paciencia',
      'Hacedores de la palabra', 'Dios es amor',
    ],
    questions: [
      'Dios pone orden en el caos con su palabra. ¿Qué área de tu vida quieres ordenar con Él este año?',
      '¿Qué te ayudaría a meditar en la Palabra de día y de noche, de una forma realista para ti?',
      '«Enséñanos de tal modo a contar nuestros días». ¿Qué quieres que cuente de verdad este año?',
      '¿En qué decisión de este año necesitas fiarte de Dios y no de tu propia prudencia?',
      'Dios hace cosa nueva. ¿Qué de lo pasado necesitas soltar para ver lo nuevo?',
      'Sus misericordias son nuevas cada mañana. ¿Cómo empezaría tu día si lo recordaras al despertar?',
      '¿Dónde te ha puesto Dios este año para ser sal y luz?',
      '¿Qué te preocupa del año que empieza? ¿Qué significa buscar primero el reino en eso?',
      '¿Qué quieres pedirle a Dios con confianza este año?',
      '¿Qué tinieblas de tu vida necesitan la luz de Jesús?',
      '¿Qué hábito concreto te ayudaría a permanecer en Jesús este año?',
      '«Ninguna condenación hay». ¿Qué culpa del año pasado necesitas dejar a los pies de Cristo?',
      '¿Qué parte de tu manera de pensar necesita ser transformada?',
      '¿Qué hábito del viejo hombre quieres dejar, y de qué quieres vestirte en su lugar?',
      '¿Qué meta espiritual quieres perseguir este año?',
      'Convierte en oración tres cosas que te preocupan (v. 6).',
      '¿Cómo sería buscar las cosas de arriba en tu trabajo o en tus estudios?',
      '¿Qué persona de fe de este capítulo te inspira más para este año?',
      '¿Qué peso necesitas dejar para correr con paciencia?',
      '¿Qué has leído en estos días que quieres empezar a hacer, y no solo a oír?',
      '¿A quién puedes amar de una manera concreta esta semana, porque Él te amó primero?',
    ],
  },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id);
