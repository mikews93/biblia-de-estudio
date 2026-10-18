// Catálogo de planes de lectura. Dos clases:
// - «a tu ritmo»: una lista de capítulos que se reparte en días según los minutos que la persona tiene;
// - «de temporada»: un capítulo por día con fecha común para todos (Cuaresma, Adviento, Año Nuevo).

export type Season = 'cuaresma' | 'adviento' | 'anio-nuevo';

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
  },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id);
