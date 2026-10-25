// Temas de «Para ti» en Hoy: lo que una persona puede estar viviendo y la palabra de Dios para eso.
//
// Es un banco curado a mano, no generado por IA: cada versículo lleva una línea corta con la verdad que responde a lo que
// pesa. Las palabras sirven para reconocer el tema en el diario de oración, dentro del teléfono (src/lib/paraTi.ts).
// Se escriben en minúsculas y sin tildes; cuentan como comienzo de palabra («ansios» vale para ansioso y ansiosa).
// Numeración de la RV1909. La depresión clínica no es falta de fe: aquí se consuela y se acompaña, no se promete curar.

export type TemaId =
  | 'ansiedad'
  | 'tristeza'
  | 'duelo'
  | 'soledad'
  | 'culpa'
  | 'miedo'
  | 'libertad'
  | 'familia'
  | 'matrimonio'
  | 'provision'
  | 'salud'
  | 'dudas'
  | 'proposito'
  | 'gratitud';

/** [libro, capítulo, versículo, hasta] y la línea que lo acompaña. */
export type Palabra = { ref: [string, number, number, number?]; luz: string };

export type Tema = {
  id: TemaId;
  /** Cómo se elige en «Mis temas»: «Ansiedad y preocupación». */
  nombre: string;
  /** Cómo se nombra en «¿Por qué veo esto?»: «tu ansiedad». Nunca sale en la cara de Hoy. */
  tuyo: string;
  palabras: string[];
  versiculos: Palabra[];
  /** El plan corto de este tema (src/lib/planesCatalogo.ts), si lo hay. */
  plan?: string;
  /** En los temas de tristeza y ansiedad, una vez y sin insistir: buscar ayuda también es cuidarse. */
  cuidado?: boolean;
  /** Cargas que no se llevan solo: Hoy pregunta de vez en cuando cómo sigue la persona (src/lib/acompanar.ts). */
  acompanar?: boolean;
};

export const TEMAS: Tema[] = [
  {
    id: 'ansiedad',
    acompanar: true,
    nombre: 'Ansiedad y preocupación',
    tuyo: 'tu ansiedad',
    plan: 'paz-ansiedad',
    cuidado: true,
    palabras: [
      'ansiedad', 'ansios', 'angusti', 'panico', 'nervios', 'preocupa', 'estres', 'agobi', 'inquiet', 'insomnio',
      'no puedo dormir', 'ataque de', 'intranquil', 'abrumad',
    ],
    versiculos: [
      { ref: ['php', 4, 6, 7], luz: 'No tienes que cargarlo solo: Dios guarda tu corazón con una paz que no se explica.' },
      { ref: ['1pe', 5, 7], luz: 'Tus preocupaciones no le cansan: le importas.' },
      { ref: ['mat', 6, 34], luz: 'Hoy tiene su propia gracia; mañana también la tendrá.' },
      { ref: ['isa', 26, 3], luz: 'La paz crece donde la mente descansa en Él.' },
      { ref: ['psa', 94, 19], luz: 'Entre muchos pensamientos, su consuelo alegra el alma.' },
      { ref: ['jhn', 14, 27], luz: 'Jesús te deja su paz, que no es la del mundo.' },
      { ref: ['mat', 11, 28], luz: 'Jesús no te pide más fuerza: te invita a descansar en Él.' },
      { ref: ['psa', 55, 22], luz: 'Echa sobre Él tu carga; Él te sostendrá.' },
      { ref: ['isa', 41, 10], luz: 'No estás solo en esto: su mano te sostiene.' },
      { ref: ['psa', 4, 8], luz: 'Puedes dormir en paz: Él vela por ti.' },
    ],
  },
  {
    id: 'tristeza',
    acompanar: true,
    nombre: 'Tristeza y depresión',
    tuyo: 'tu tristeza',
    plan: 'alma-abatida',
    cuidado: true,
    palabras: [
      'depresi', 'deprimid', 'triste', 'vacio', 'sin ganas', 'desanim', 'desalent', 'abatid', 'llor', 'no tengo fuerzas',
      'desesper', 'oscuridad', 'sin sentido', 'no puedo mas', 'cansad de vivir',
    ],
    versiculos: [
      { ref: ['psa', 42, 11], luz: 'Se puede esperar en Dios aun llorando: el salmista lo hizo.' },
      { ref: ['psa', 34, 18], luz: 'Dios está cerca de los quebrantados de corazón.' },
      { ref: ['lam', 3, 22, 23], luz: 'Sus misericordias son nuevas cada mañana, también esta.' },
      { ref: ['2co', 4, 8, 9], luz: 'Abatidos, pero no destruidos: hay un tesoro que no se rompe.' },
      { ref: ['psa', 147, 3], luz: 'Él sana a los quebrantados y venda sus heridas.' },
      { ref: ['psa', 40, 1, 2], luz: 'Él oye desde el fondo del pozo y pone tus pies sobre la peña.' },
      { ref: ['rom', 8, 38, 39], luz: 'Nada de lo que sientes puede separarte de su amor.' },
      { ref: ['psa', 30, 5], luz: 'El llanto puede durar la noche; la alegría viene a la mañana.' },
      { ref: ['isa', 53, 4], luz: 'Jesús conoce el dolor desde dentro: llevó nuestros dolores.' },
      { ref: ['mat', 11, 28], luz: 'Jesús llama a los cansados, no a los fuertes.' },
    ],
  },
  {
    id: 'duelo',
    acompanar: true,
    nombre: 'Duelo por alguien que partió',
    tuyo: 'tu duelo',
    plan: 'esperanza-duelo',
    palabras: ['muri', 'fallec', 'duelo', 'luto', 'perdi a', 'partio', 'funeral', 'velorio', 'extrano a', 'su partida', 'se nos fue'],
    versiculos: [
      { ref: ['jhn', 11, 25, 26], luz: 'Jesús es la resurrección: la muerte no tiene la última palabra.' },
      { ref: ['rev', 21, 4], luz: 'Viene el día en que Dios mismo secará cada lágrima.' },
      { ref: ['1th', 4, 13, 14], luz: 'Lloramos, pero no como quienes no tienen esperanza.' },
      { ref: ['psa', 23, 4], luz: 'En el valle de sombra, Él camina contigo.' },
      { ref: ['mat', 5, 4], luz: 'Los que lloran serán consolados: es una promesa de Jesús.' },
      { ref: ['2co', 1, 3, 4], luz: 'El Dios de toda consolación te consuela en esta tribulación.' },
      { ref: ['jhn', 14, 2, 3], luz: 'Jesús prepara un lugar y vuelve por los suyos.' },
      { ref: ['isa', 25, 8], luz: 'Dios destruirá la muerte para siempre.' },
    ],
  },
  {
    id: 'soledad',
    acompanar: true,
    nombre: 'Soledad',
    tuyo: 'tu soledad',
    plan: 'nunca-solo',
    palabras: ['soledad', 'me siento sol', 'estoy sol', 'nadie me', 'abandonad', 'aislad', 'rechazad', 'sin amigos'],
    versiculos: [
      { ref: ['deu', 31, 6], luz: 'Él no te dejará ni te desamparará.' },
      { ref: ['heb', 13, 5], luz: 'Jesús lo repite: no te dejaré, no te desampararé.' },
      { ref: ['psa', 68, 6], luz: 'Dios hace habitar en familia a los solos.' },
      { ref: ['mat', 28, 20], luz: 'Jesús está contigo todos los días, también este.' },
      { ref: ['isa', 43, 2], luz: 'En las aguas y en el fuego, Él está contigo.' },
      { ref: ['psa', 27, 10], luz: 'Aunque otros te dejen, el Señor te recoge.' },
      { ref: ['jhn', 15, 15], luz: 'Jesús te llama amigo.' },
      { ref: ['zep', 3, 17], luz: 'Dios se alegra por ti con cánticos.' },
    ],
  },
  {
    id: 'culpa',
    acompanar: true,
    nombre: 'Culpa y perdón',
    tuyo: 'tu deseo de perdón',
    plan: 'libre-condenacion',
    palabras: ['culpa', 'verguenza', 'perdon', 'pecado', 'arrepent', 'falle a', 'me equivoque', 'remordim'],
    versiculos: [
      { ref: ['1jn', 1, 9], luz: 'Si confiesas, Él es fiel para perdonar y limpiar.' },
      { ref: ['psa', 103, 12], luz: 'Tan lejos como el oriente del occidente alejó tus pecados.' },
      { ref: ['rom', 8, 1], luz: 'En Cristo ya no hay condenación.' },
      { ref: ['isa', 1, 18], luz: 'Aunque sea rojo como el carmesí, quedará blanco.' },
      { ref: ['psa', 32, 5], luz: 'Al confesar, el peso se va: Él perdona.' },
      { ref: ['mic', 7, 18, 19], luz: 'Dios se deleita en la misericordia y echa los pecados al mar.' },
      { ref: ['2co', 5, 17], luz: 'En Cristo eres nueva criatura: lo viejo pasó.' },
      { ref: ['luk', 15, 20], luz: 'El Padre corre hacia el que vuelve.' },
    ],
  },
  {
    id: 'miedo',
    acompanar: true,
    nombre: 'Miedo',
    tuyo: 'tu miedo',
    plan: 'no-temas',
    palabras: ['miedo', 'temor', 'asustad', 'amenaz', 'pavor', 'terror', 'peligro'],
    versiculos: [
      { ref: ['jos', 1, 9], luz: 'Esfuérzate: el Señor está contigo dondequiera que vayas.' },
      { ref: ['psa', 27, 1], luz: 'Si Él es tu luz, ¿de quién temerás?' },
      { ref: ['2ti', 1, 7], luz: 'Dios no te dio espíritu de temor, sino de poder, amor y templanza.' },
      { ref: ['isa', 43, 1], luz: 'Te llamó por tu nombre: eres suyo.' },
      { ref: ['psa', 56, 3], luz: 'El día que temas, puedes confiar en Él.' },
      { ref: ['psa', 91, 1, 2], luz: 'Bajo su sombra hay refugio.' },
      { ref: ['isa', 41, 13], luz: 'Él toma tu mano y te dice: no temas.' },
      { ref: ['heb', 13, 6], luz: 'El Señor es tu ayudador: no temerás.' },
    ],
  },
  {
    id: 'libertad',
    acompanar: true,
    nombre: 'Tentación y adicción',
    tuyo: 'tu lucha por ser libre',
    plan: 'libres',
    palabras: ['adicci', 'vicio', 'tentaci', 'recai', 'alcohol', 'droga', 'pornograf', 'apuesta', 'ludopat', 'dejar de fumar'],
    versiculos: [
      { ref: ['1co', 10, 13], luz: 'Con la tentación, Dios da también la salida.' },
      { ref: ['gal', 5, 1], luz: 'Cristo te hizo libre: no vuelvas al yugo.' },
      { ref: ['jhn', 8, 36], luz: 'Si el Hijo te liberta, serás verdaderamente libre.' },
      { ref: ['rom', 6, 14], luz: 'El pecado ya no se enseñorea de ti: estás bajo la gracia.' },
      { ref: ['heb', 4, 15, 16], luz: 'Jesús fue tentado y entiende: acércate con confianza.' },
      { ref: ['jas', 4, 7], luz: 'Sométete a Dios, resiste, y el diablo huirá.' },
      { ref: ['2co', 12, 9], luz: 'Su gracia basta; su poder se ve en tu debilidad.' },
      { ref: ['php', 4, 13], luz: 'Todo lo puedes en Cristo que te fortalece.' },
    ],
  },
  {
    id: 'familia',
    nombre: 'Mi familia',
    tuyo: 'tu familia',
    palabras: ['familia', 'mi hij', 'mis hij', 'mi mama', 'mi papa', 'mi madre', 'mi padre', 'mi herman', 'mis padres', 'mi niet'],
    versiculos: [
      { ref: ['jos', 24, 15], luz: 'Tú y tu casa pueden servir al Señor.' },
      { ref: ['act', 16, 31], luz: 'La promesa alcanza a tu casa.' },
      { ref: ['psa', 127, 1], luz: 'Si el Señor no edifica la casa, en vano se trabaja.' },
      { ref: ['col', 3, 13, 14], luz: 'Soportarse, perdonarse y, sobre todo, amarse.' },
      { ref: ['isa', 54, 13], luz: 'Tus hijos serán enseñados por el Señor.' },
      { ref: ['psa', 103, 17], luz: 'Su misericordia llega a los hijos de los hijos.' },
    ],
  },
  {
    id: 'matrimonio',
    nombre: 'Mi matrimonio',
    tuyo: 'tu matrimonio',
    palabras: ['matrimonio', 'mi espos', 'mi marido', 'divorci', 'separaci', 'mi pareja'],
    versiculos: [
      { ref: ['ecc', 4, 12], luz: 'El cordón de tres dobleces no se rompe pronto.' },
      { ref: ['1co', 13, 4, 7], luz: 'El amor es sufrido, es benigno, todo lo soporta.' },
      { ref: ['eph', 4, 32], luz: 'Perdonarse como Dios nos perdonó en Cristo.' },
      { ref: ['col', 3, 14], luz: 'El amor es el vínculo de la perfección.' },
      { ref: ['1pe', 3, 8], luz: 'Compasivos, amigables, de un mismo sentir.' },
      { ref: ['eph', 5, 25], luz: 'Amar como Cristo amó: dándose.' },
    ],
  },
  {
    id: 'provision',
    nombre: 'Trabajo y provisión',
    tuyo: 'tu trabajo y tu provisión',
    palabras: ['trabajo', 'empleo', 'deuda', 'dinero', 'renta', 'alquiler', 'economi', 'negocio', 'sueldo', 'desemple', 'provision'],
    versiculos: [
      { ref: ['php', 4, 19], luz: 'Dios suplirá lo que te falta conforme a sus riquezas.' },
      { ref: ['mat', 6, 33], luz: 'Busca primero el reino: lo demás vendrá por añadidura.' },
      { ref: ['psa', 37, 25], luz: 'El salmista nunca vio al justo desamparado.' },
      { ref: ['psa', 23, 1], luz: 'El Señor es tu pastor: nada te faltará.' },
      { ref: ['pro', 16, 3], luz: 'Encomienda tus obras al Señor.' },
      { ref: ['2co', 9, 8], luz: 'Dios puede hacer que abunde en ti toda gracia.' },
    ],
  },
  {
    id: 'salud',
    nombre: 'Salud y enfermedad',
    tuyo: 'tu salud o la de alguien que amas',
    palabras: ['salud', 'enferm', 'cancer', 'cirugia', 'operaci', 'hospital', 'diagnostic', 'sanidad', 'sanar', 'tratamiento', 'quimio'],
    versiculos: [
      { ref: ['jer', 17, 14], luz: 'Sáname, Señor, y seré sano.' },
      { ref: ['psa', 103, 2, 3], luz: 'Él perdona y sana: no olvides sus beneficios.' },
      { ref: ['jas', 5, 14, 15], luz: 'Pide a la iglesia que ore por ti.' },
      { ref: ['psa', 41, 3], luz: 'El Señor sostiene al enfermo en su lecho.' },
      { ref: ['2co', 12, 9], luz: 'Su gracia basta, también en la debilidad.' },
      { ref: ['isa', 53, 5], luz: 'Por su llaga fuimos curados.' },
    ],
  },
  {
    id: 'dudas',
    nombre: 'Dudas de fe',
    tuyo: 'tus preguntas sobre la fe',
    palabras: ['duda', 'no se si dios', 'fe debil', 'incredul', 'no siento a dios', 'dios no me escucha', 'donde esta dios'],
    versiculos: [
      { ref: ['mrk', 9, 24], luz: '«Creo; ayuda mi incredulidad»: Jesús no rechazó esa oración.' },
      { ref: ['jhn', 20, 27], luz: 'Jesús le mostró sus manos a Tomás: no despreció su duda.' },
      { ref: ['jas', 1, 5], luz: 'Pide sabiduría: Dios da a todos abundantemente.' },
      { ref: ['jhn', 6, 68], luz: 'Señor, ¿a quién iremos? Tú tienes palabras de vida eterna.' },
      { ref: ['isa', 55, 8, 9], luz: 'Sus caminos son más altos que los nuestros.' },
      { ref: ['rom', 10, 17], luz: 'La fe viene por el oír la palabra de Dios.' },
    ],
  },
  {
    id: 'proposito',
    nombre: 'Propósito y dirección',
    tuyo: 'tu búsqueda de dirección',
    palabras: ['proposito', 'direccion', 'decision', 'decidir', 'guia', 'futuro', 'vocacion', 'llamado', 'que hacer con mi vida'],
    versiculos: [
      { ref: ['jer', 29, 11], luz: 'Dios tiene pensamientos de paz para ti.' },
      { ref: ['eph', 2, 10], luz: 'Eres hechura suya, creado para buenas obras.' },
      { ref: ['pro', 3, 5, 6], luz: 'Reconócelo en tus caminos y Él enderezará tus veredas.' },
      { ref: ['psa', 32, 8], luz: 'Él te enseñará el camino en que debes andar.' },
      { ref: ['rom', 8, 28], luz: 'Todo ayuda a bien a los que aman a Dios.' },
      { ref: ['mic', 6, 8], luz: 'Hacer justicia, amar misericordia, andar humildemente.' },
    ],
  },
  {
    id: 'gratitud',
    nombre: 'Gratitud',
    tuyo: 'una oración que Dios respondió',
    palabras: ['gracias', 'gratitud', 'agradec'],
    versiculos: [
      { ref: ['psa', 103, 1, 2], luz: 'Bendice, alma mía, y no olvides ninguno de sus beneficios.' },
      { ref: ['psa', 40, 3], luz: 'Puso en tu boca un cántico nuevo.' },
      { ref: ['psa', 126, 3], luz: 'Grandes cosas ha hecho el Señor con nosotros.' },
      { ref: ['psa', 118, 1], luz: 'Alabad al Señor, porque es bueno.' },
      { ref: ['1th', 5, 18], luz: 'Dad gracias en todo.' },
      { ref: ['psa', 9, 1], luz: 'Contaré todas sus maravillas.' },
    ],
  },
];

export const temaPorId = (id: string) => TEMAS.find((t) => t.id === id);

/**
 * Palabras que dicen que alguien puede estar en peligro. Con ellas Hoy no responde solo con un versículo: primero
 * muestra quién puede ayudar hoy (src/lib/lineasVida.ts).
 */
export const PALABRAS_RIESGO = [
  'suicid', 'quitarme la vida', 'quiero morir', 'me quiero morir', 'no quiero vivir', 'no quiero seguir', 'hacerme dano',
  'cortarme', 'matarme', 'acabar con todo', 'mejor muert', 'desaparecer para siempre', 'no vale la pena vivir',
];
