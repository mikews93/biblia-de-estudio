// «Hombres de pie»: ocho semanas para hombres, solteros o casados, sobre fe y trabajo, integridad, construir con otros,
// caminar de hombre a hombre, proveer y liderar sirviendo. Sin React Native.
//
// Mike notó (2026-10-25) que en su grupo y en casi todas las iglesias hay más mujeres que hombres. La investigación
// (/mnt/project-files/investigacion/mas-mujeres-que-hombres.md) apunta a una fe que no toca el trabajo, a cultos con
// poca misión y pocos retos, y a que los hombres siguen a otros hombres. Por eso cada semana trae un pasaje, una
// lectura corta, preguntas para responder a solas y un reto concreto, y la quinta invita a otro hombre a leer juntos.
// Lo que cada uno escribe se queda en su teléfono (src/lib/hombresDiario.ts); no hace falta cuenta.

import type { Pasaje } from './circulo';

const p = (book: string, chapter: number, from: number, to = from): Pasaje => ({ book, chapter, from, to });

export type SemanaHombres = {
  n: number;
  titulo: string;
  /** Una línea que resume la semana. */
  lema: string;
  intro: string[];
  pasajes: { referencia: string; pasaje: Pasaje }[];
  preguntas: string[];
  /** Lo que se hace durante la semana. */
  reto: string;
  /** El reto invita a otro hombre: la pantalla ofrece compartir la invitación. */
  invitar?: boolean;
  /** El reto toca a los hijos: la pantalla lleva al Espacio Niños. */
  hijos?: boolean;
};

export const HOMBRES: SemanaHombres[] = [
  {
    n: 1,
    titulo: 'Esfuérzate y sé valiente',
    lema: 'La valentía no nace de ti, sino de Quien va contigo.',
    intro: [
      'Josué tenía que ocupar el lugar de Moisés y guiar a un pueblo entero. Dios no le prometió que sería fácil. Le prometió algo mejor: «yo estaré contigo».',
      'Muchos hombres esperan sentirse listos para dar un paso de fe, y ese día nunca llega. La valentía bíblica no es ausencia de miedo, es obedecer con miedo porque Dios va delante.',
    ],
    pasajes: [{ referencia: 'Josué 1:6-9', pasaje: p('jos', 1, 6, 9) }],
    preguntas: [
      '¿En qué área de tu vida estás esperando «sentirte listo» para obedecer?',
      '¿Qué te dice que Dios repita tres veces «esfuérzate y sé valiente»?',
      '¿Qué paso concreto, pequeño y valiente, podrías dar esta semana?',
    ],
    reto: 'Lee Josué 1:9 cada mañana de esta semana y da el paso que escribiste. Al final de la semana, cuéntale a alguien cómo te fue.',
  },
  {
    n: 2,
    titulo: 'El trabajo de tus manos',
    lema: 'Tu lunes también es para Dios.',
    intro: [
      'José era esclavo en una casa ajena, y aun así «Jehová estaba con José, y fue varón prosperado». No esperó un trabajo «espiritual» para honrar a Dios: lo honró en el que tenía.',
      'Lo que haces de lunes a viernes no es una pausa en tu fe. Es uno de los lugares donde más se nota. Trabajar bien, con honradez y sin quejarte de todo, también es predicar.',
    ],
    pasajes: [
      { referencia: 'Génesis 39:2-6', pasaje: p('gen', 39, 2, 6) },
      { referencia: 'Colosenses 3:23-24', pasaje: p('col', 3, 23, 24) },
    ],
    preguntas: [
      '¿Ves tu trabajo o tu estudio como parte de tu llamado, o como algo aparte de tu fe?',
      '¿Qué notarían tus compañeros si trabajaras «como para el Señor»?',
      '¿Hay algo en tu trabajo que te cueste hacer con honradez? ¿Qué harías distinto?',
    ],
    reto: 'Haz tu trabajo esta semana como si tu jefe fuera Jesús. Ora cada día, por su nombre, por un compañero de trabajo o de estudio.',
  },
  {
    n: 3,
    titulo: 'Cuando nadie mira',
    lema: 'La integridad se decide antes de la tentación.',
    intro: [
      'José huyó de la tentación aunque nadie lo habría sabido. Daniel «propuso en su corazón» no contaminarse antes de sentarse a la mesa del rey. Los dos ya habían decidido antes del momento difícil.',
      'Las caídas casi nunca son de un día. Empiezan con pequeñas concesiones que nadie ve. Poner límites claros y tener a un hermano que te pregunte cómo vas no es debilidad: es sabiduría.',
    ],
    pasajes: [
      { referencia: 'Génesis 39:7-12', pasaje: p('gen', 39, 7, 12) },
      { referencia: 'Daniel 1:8', pasaje: p('dan', 1, 8) },
    ],
    preguntas: [
      '¿Cuál es la tentación que más te cuesta? Nómbrala con honestidad.',
      '¿Qué límite concreto podrías poner antes de que llegue el momento, como José o Daniel?',
      '¿Hay algún hombre de confianza a quien podrías pedirle que te pregunte cómo vas?',
    ],
    reto: 'Pon por escrito el límite que elegiste y cuéntaselo a un hermano de confianza. Pídele que te pregunte por él el domingo.',
  },
  {
    n: 4,
    titulo: 'Con la espada y la paleta',
    lema: 'Los hombres de Dios construyen juntos.',
    intro: [
      'Jerusalén estaba en ruinas y Nehemías no se quedó en el lamento: «Levantémonos y edifiquemos». Los hombres trabajaban con una mano y con la otra sostenían la espada, cuidando a sus familias mientras construían.',
      'Muchos hombres se sienten espectadores en la iglesia. Pero hay muros que levantar: una familia que necesita ayuda, un salón que reparar, un joven que necesita un ejemplo. La fe también se hace con las manos.',
    ],
    pasajes: [
      { referencia: 'Nehemías 2:17-18', pasaje: p('neh', 2, 17, 18) },
      { referencia: 'Nehemías 4:14-18', pasaje: p('neh', 4, 14, 18) },
    ],
    preguntas: [
      '¿Qué «muro caído» ves en tu familia, tu iglesia o tu barrio?',
      '¿Qué sabes hacer con tus manos o con tu oficio que podría servir a otros?',
      '¿Con qué otros hombres podrías construir algo juntos?',
    ],
    reto: 'Sirve esta semana en algo práctico: reparar, cargar, construir, llevar a alguien. Mejor si lo haces junto a otro hombre de tu iglesia.',
  },
  {
    n: 5,
    titulo: 'Hierro con hierro',
    lema: 'Nadie se vuelve fuerte a solas.',
    intro: [
      '«Hierro con hierro se aguza». Un cuchillo no se afila contra algo blando. Necesitas hombres que te digan la verdad, que te animen y que te reten.',
      'Muchos hombres tienen conocidos, pero no amigos con quienes hablar de lo que de verdad importa. No hace falta un programa grande: basta con un hermano y un capítulo de la Biblia.',
    ],
    pasajes: [
      { referencia: 'Proverbios 27:17', pasaje: p('pro', 27, 17) },
      { referencia: 'Eclesiastés 4:9-12', pasaje: p('ecc', 4, 9, 12) },
    ],
    preguntas: [
      '¿Tienes un amigo con quien puedas hablar de tu fe, tus luchas y tus sueños? ¿Quién es?',
      '¿Qué te frena para abrirte con otro hombre?',
      '¿A qué hombre de tu iglesia o de tu trabajo sientes que deberías invitar a caminar contigo?',
    ],
    reto: 'Invita a un hombre a leer contigo un capítulo esta semana, en persona o por teléfono, y conversen 20 minutos sobre lo que leyeron.',
    invitar: true,
  },
  {
    n: 6,
    titulo: 'De hombre a hombre',
    lema: 'Lo que recibiste, entrégalo a otros.',
    intro: [
      'Pablo formó a Timoteo, y le pidió que formara a otros que a su vez enseñaran a otros. Antes, Bernabé había creído en Saulo cuando nadie confiaba en él.',
      'Todo hombre necesita a alguien que vaya más adelante y a alguien a quien ayudar a caminar. Si eres joven, busca un hombre mayor que te acompañe. Si llevas años en la fe, hay un joven que necesita que alguien crea en él.',
    ],
    pasajes: [
      { referencia: '2 Timoteo 2:1-2', pasaje: p('2ti', 2, 1, 2) },
      { referencia: 'Hechos 9:26-28', pasaje: p('act', 9, 26, 28) },
    ],
    preguntas: [
      '¿Quién fue un «Bernabé» para ti? ¿Qué hizo que te marcó?',
      '¿Quién podría acompañarte a ti? ¿Y a quién podrías acompañar tú?',
      '¿Qué te gustaría enseñarle a un hombre más joven sobre la vida y la fe?',
    ],
    reto: 'Habla con un hombre mayor o con uno más joven y proponle verse cada dos semanas durante un mes para leer y orar juntos.',
    invitar: true,
  },
  {
    n: 7,
    titulo: 'Proveer sin idolatrar',
    lema: 'Trabaja con todas tus fuerzas; confía con todo tu corazón.',
    intro: [
      'Dios espera que el hombre trabaje y cuide de los suyos. Pero Jesús advierte que nadie puede servir a dos señores: el dinero es un buen siervo y un amo cruel.',
      'Proveer no es tener mucho, sino ser fiel con lo que tienes: trabajar con constancia, vivir con un presupuesto, dar con alegría y no vivir ansioso por el mañana.',
    ],
    pasajes: [
      { referencia: 'Mateo 6:31-34', pasaje: p('mat', 6, 31, 34) },
      { referencia: '1 Timoteo 6:6-10', pasaje: p('1ti', 6, 6, 10) },
    ],
    preguntas: [
      '¿El dinero te preocupa más de lo que te gustaría admitir? ¿Por qué?',
      '¿Vives con un presupuesto? ¿Tienes deudas que te quiten la paz?',
      '¿Qué significaría para ti «buscar primero el reino» en tus finanzas este mes?',
    ],
    reto: 'Haz un presupuesto sencillo para este mes. Separa primero lo que darás a Dios y a quien lo necesite.',
  },
  {
    n: 8,
    titulo: 'Liderar sirviendo',
    lema: 'El más grande es el que lava los pies.',
    intro: [
      'Jesús, sabiendo que el Padre le había dado todas las cosas, tomó una toalla y lavó los pies de sus discípulos. Así enseñó lo que es un líder: alguien que usa su fuerza para servir.',
      'En casa, en la iglesia y en el trabajo, liderar no es mandar. Es ir primero en servir, en pedir perdón y en orar. Y si tienes hijos, es enseñarles la Palabra en el camino, en la mesa y antes de dormir.',
    ],
    pasajes: [
      { referencia: 'Juan 13:12-17', pasaje: p('jhn', 13, 12, 17) },
      { referencia: 'Deuteronomio 6:5-7', pasaje: p('deu', 6, 5, 7) },
    ],
    preguntas: [
      '¿Dónde te toca liderar hoy: en tu casa, tu trabajo, tu iglesia, tu grupo de amigos?',
      '¿Qué sería «lavar los pies» a las personas que tienes cerca esta semana?',
      'Si tienes hijos, o los tendrás algún día, ¿cómo te gustaría que te recordaran como hombre de fe?',
    ],
    reto: 'Sirve en tu casa esta semana en algo que nadie te pidió. Si tienes hijos, lee con ellos una historia de la Biblia antes de dormir.',
    hijos: true,
  },
];

export const SEMANAS_HOMBRES = HOMBRES.length;

export type ProgresoHombres = { hechas: number; siguiente: number | null; completo: boolean };

/** Las semanas van en orden: se abre la siguiente a la última terminada. */
export function progresoHombres(hechas: number[]): ProgresoHombres {
  const set = new Set(hechas);
  const siguiente = HOMBRES.find((s) => !set.has(s.n))?.n ?? null;
  return { hechas: HOMBRES.filter((s) => set.has(s.n)).length, siguiente, completo: siguiente === null };
}

/** La invitación que se comparte con otro hombre. */
export const invitacionHombres = (url: string) =>
  `Estoy haciendo «Hombres de pie», ocho semanas sobre fe, trabajo y amistad entre hombres. ¿Te animas a leer conmigo un capítulo esta semana? ${url}`;
