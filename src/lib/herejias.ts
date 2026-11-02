// Las herejías que la Iglesia rechazó a lo largo de su historia, por época, para la pantalla /herejias y las
// preguntas preparadas (src/lib/preguntasPreparadas.ts). Datos solos, sin dependencias: también los lee el servidor.
// Cada una se abre como pregunta preparada: la IA la responde una vez con las fuentes de historia de la Iglesia
// (área «herejias» de api/_teologia.ts) y la respuesta queda guardada para todos.
// El id es la llave de la respuesta guardada: no cambiarlo.

export type Epoca = 'apostolica' | 'antiguos' | 'concilios' | 'despues' | 'reforma' | 'hoy';

export const EPOCAS: { id: Epoca; nombre: string; siglos: string }[] = [
  { id: 'apostolica', nombre: 'En tiempos de los apóstoles', siglos: 'Siglos I y II' },
  { id: 'antiguos', nombre: 'Antes de Nicea', siglos: 'Siglos II y III' },
  { id: 'concilios', nombre: 'Los grandes concilios', siglos: 'Siglos IV y V' },
  { id: 'despues', nombre: 'Después de Calcedonia', siglos: 'Siglos V al VII' },
  { id: 'reforma', nombre: 'En la Reforma', siglos: 'Siglos XVI y XVII' },
  { id: 'hoy', nombre: 'Ideas antiguas que vuelven hoy', siglos: 'Siglos XIX al XXI' },
];

export type Herejia = {
  id: string;
  nombre: string;
  epoca: Epoca;
  /** Lo que enseñaba, en una frase. */
  idea: string;
  /** Quién la refutó o dónde se rechazó. */
  respuesta: string;
  /** Un pasaje clave de la respuesta (cita para mostrar). */
  pasaje: string;
  /** La pregunta preparada que la explica. */
  pregunta: string;
};

export const HEREJIAS: Herejia[] = [
  {
    id: 'ebionismo',
    nombre: 'Ebionismo',
    epoca: 'apostolica',
    idea: 'Jesús fue solo un hombre justo, hijo de José, y para salvarse había que guardar la ley de Moisés.',
    respuesta: 'Ireneo la refutó; el Nuevo Testamento ya enseña la salvación por gracia y la divinidad de Cristo.',
    pasaje: 'Gálatas 2:16',
    pregunta: '¿Qué enseñaban los ebionitas y por qué se rechazó?',
  },
  {
    id: 'docetismo',
    nombre: 'Docetismo',
    epoca: 'apostolica',
    idea: 'Cristo solo parecía tener cuerpo: no sufrió ni murió de verdad.',
    respuesta: 'El apóstol Juan ya la enfrenta, y la combatieron Ignacio de Antioquía e Ireneo.',
    pasaje: '1 Juan 4:2-3',
    pregunta: '¿Qué era el docetismo y por qué se rechazó?',
  },
  {
    id: 'gnosticismo',
    nombre: 'Gnosticismo',
    epoca: 'apostolica',
    idea: 'La materia es mala, el creador es un dios inferior y la salvación llega por un conocimiento secreto.',
    respuesta: 'Ireneo escribió «Contra las herejías» para refutarlo; también Tertuliano e Hipólito.',
    pasaje: 'Colosenses 2:8-9',
    pregunta: '¿Qué era el gnosticismo?',
  },
  {
    id: 'marcionismo',
    nombre: 'Marcionismo',
    epoca: 'apostolica',
    idea: 'El Dios del Antiguo Testamento es otro distinto del Padre de Jesús; Marción dejó solo Lucas y diez cartas de Pablo.',
    respuesta: 'La iglesia de Roma lo apartó hacia el año 144; Tertuliano escribió «Contra Marción».',
    pasaje: 'Lucas 24:27',
    pregunta: '¿Qué enseñaba Marción y por qué se rechazó?',
  },
  {
    id: 'montanismo',
    nombre: 'Montanismo',
    epoca: 'antiguos',
    idea: 'Montano y dos profetisas decían traer una revelación nueva del Espíritu, por encima de la de los apóstoles.',
    respuesta: 'Sínodos de Asia Menor la rechazaron en el siglo II: la revelación quedó en la Escritura.',
    pasaje: 'Judas 1:3',
    pregunta: '¿Qué era el montanismo y por qué se rechazó?',
  },
  {
    id: 'adopcionismo',
    nombre: 'Adopcionismo',
    epoca: 'antiguos',
    idea: 'Jesús era un hombre al que Dios adoptó como Hijo, en su bautismo o en su resurrección.',
    respuesta: 'Un sínodo en Antioquía condenó a Pablo de Samosata en el año 268.',
    pasaje: 'Juan 1:1-3',
    pregunta: '¿Qué era el adopcionismo?',
  },
  {
    id: 'modalismo',
    nombre: 'Modalismo',
    epoca: 'antiguos',
    idea: 'Padre, Hijo y Espíritu son un solo Dios que se muestra en tres modos, uno después del otro.',
    respuesta: 'Tertuliano («Contra Práxeas») e Hipólito («Contra Noeto»); Sabelio fue apartado en Roma.',
    pasaje: 'Mateo 3:16-17',
    pregunta: '¿Qué es el modalismo y por qué se rechazó?',
  },
  {
    id: 'arrianismo',
    nombre: 'Arrianismo',
    epoca: 'concilios',
    idea: 'El Hijo es la primera y más alta criatura: «hubo un tiempo en que no existía».',
    respuesta: 'El concilio de Nicea (325) confesó al Hijo «de la misma sustancia» que el Padre; Atanasio la combatió toda su vida.',
    pasaje: 'Juan 1:1',
    pregunta: '¿Qué enseñaba Arrio y qué decidió el concilio de Nicea?',
  },
  {
    id: 'pneumatomacos',
    nombre: 'Macedonianismo',
    epoca: 'concilios',
    idea: 'El Espíritu Santo no es Dios, sino una fuerza o una criatura al servicio del Hijo.',
    respuesta: 'El concilio de Constantinopla (381) confesó al Espíritu «Señor y dador de vida», adorado con el Padre y el Hijo.',
    pasaje: 'Hechos 5:3-4',
    pregunta: '¿Qué enseñaban los que negaban la divinidad del Espíritu Santo?',
  },
  {
    id: 'apolinarismo',
    nombre: 'Apolinarismo',
    epoca: 'concilios',
    idea: 'Cristo tenía cuerpo humano, pero en lugar de mente humana tenía al Verbo divino.',
    respuesta: 'Constantinopla (381): lo que Cristo no asumió no fue sanado; fue hombre completo.',
    pasaje: 'Hebreos 2:17',
    pregunta: '¿Qué era el apolinarismo?',
  },
  {
    id: 'nestorianismo',
    nombre: 'Nestorianismo',
    epoca: 'concilios',
    idea: 'En Cristo había como dos personas, una divina y otra humana, unidas solo por voluntad.',
    respuesta: 'El concilio de Éfeso (431) afirmó que Cristo es una sola persona.',
    pasaje: 'Juan 1:14',
    pregunta: '¿Qué enseñaba Nestorio y por qué se rechazó?',
  },
  {
    id: 'eutiquianismo',
    nombre: 'Monofisismo',
    epoca: 'concilios',
    idea: 'En Cristo lo humano quedó absorbido en lo divino: después de la unión solo hay una naturaleza.',
    respuesta: 'Calcedonia (451): una persona en dos naturalezas, sin confusión, sin cambio, sin división, sin separación.',
    pasaje: 'Filipenses 2:6-8',
    pregunta: '¿Qué era el monofisismo y qué decidió Calcedonia?',
  },
  {
    id: 'pelagianismo',
    nombre: 'Pelagianismo',
    epoca: 'concilios',
    idea: 'No hay pecado original: cualquiera puede vivir sin pecar con sus propias fuerzas.',
    respuesta: 'Agustín lo refutó; lo condenaron Cartago (418) y Éfeso (431).',
    pasaje: 'Romanos 5:12',
    pregunta: '¿Qué es el pelagianismo?',
  },
  {
    id: 'donatismo',
    nombre: 'Donatismo',
    epoca: 'concilios',
    idea: 'Solo vale el bautismo de un ministro puro; la iglesia verdadera es solo la de los perfectos.',
    respuesta: 'Agustín respondió que la eficacia viene de Cristo y no de quien sirve; Cartago (411).',
    pasaje: '1 Corintios 3:6-7',
    pregunta: '¿Qué era el donatismo?',
  },
  {
    id: 'semipelagianismo',
    nombre: 'Semipelagianismo',
    epoca: 'despues',
    idea: 'El primer paso hacia la fe lo da la persona sola; después Dios ayuda con su gracia.',
    respuesta: 'El sínodo de Orange (529) afirmó que aun el comienzo de la fe es obra de la gracia.',
    pasaje: 'Efesios 2:8-9',
    pregunta: '¿Qué es el semipelagianismo?',
  },
  {
    id: 'monotelismo',
    nombre: 'Monotelismo',
    epoca: 'despues',
    idea: 'Cristo tenía dos naturalezas, pero una sola voluntad, la divina.',
    respuesta: 'El concilio de Constantinopla (681): dos voluntades, la humana sujeta a la divina.',
    pasaje: 'Lucas 22:42',
    pregunta: '¿Qué era el monotelismo?',
  },
  {
    id: 'socinianismo',
    nombre: 'Socinianismo',
    epoca: 'reforma',
    idea: 'Negaba la Trinidad, la divinidad eterna de Cristo y que su muerte pagara por nuestros pecados.',
    respuesta: 'Los reformadores y teólogos protestantes lo refutaron; los credos de la Reforma reafirmaron Nicea y Calcedonia.',
    pasaje: 'Isaías 53:5-6',
    pregunta: '¿Qué enseñaban los socinianos?',
  },
  {
    id: 'antinomianismo',
    nombre: 'Antinomianismo',
    epoca: 'reforma',
    idea: 'Como somos salvos por gracia, la ley de Dios ya no tiene nada que decirle al creyente sobre cómo vivir.',
    respuesta: 'Lutero escribió contra Agrícola (1539) y los credos de la Reforma afirmaron que la fe verdadera da fruto.',
    pasaje: 'Romanos 6:1-2',
    pregunta: '¿Qué es el antinomianismo?',
  },
  {
    id: 'unicitarios',
    nombre: 'Unicitarios',
    epoca: 'hoy',
    idea: 'Algunas iglesias enseñan que Jesús es el Padre, el Hijo y el Espíritu a la vez: el modalismo antiguo.',
    respuesta: 'La respuesta es la misma de Tertuliano e Hipólito: la Escritura muestra a los tres a la vez.',
    pasaje: 'Juan 17:5',
    pregunta: '¿En qué se parece la enseñanza unicitaria al modalismo antiguo?',
  },
  {
    id: 'testigos-arrianismo',
    nombre: 'Testigos de Jehová',
    epoca: 'hoy',
    idea: 'Enseñan que el Hijo fue creado y que el Espíritu Santo es una fuerza: se parece al arrianismo.',
    respuesta: 'Nicea y Constantinopla respondieron a esas mismas ideas con la Escritura.',
    pasaje: 'Colosenses 1:16-17',
    pregunta: '¿En qué se parece la enseñanza de los Testigos de Jehová al arrianismo?',
  },
  {
    id: 'mormonismo',
    nombre: 'Mormonismo',
    epoca: 'hoy',
    idea: 'Enseña que hay muchos dioses y que el Padre fue antes un hombre: es distinto del Dios único de la Biblia.',
    respuesta: 'Los credos antiguos confiesan un solo Dios eterno; la Escritura lo afirma una y otra vez.',
    pasaje: 'Isaías 43:10',
    pregunta: '¿Por qué los cristianos no consideran cristiana la enseñanza mormona sobre Dios?',
  },
];
