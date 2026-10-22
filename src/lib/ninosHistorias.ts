// Espacio Niños (6 a 11 años): doce historias de la Biblia para escuchar con un adulto al lado, y los versículos
// para guardar en el corazón. Los pasajes son de La Biblia en Español Sencillo (dominio público), la versión del
// modo. «cuento» es una entrada corta, nuestra, que pone en situación antes de escuchar la Biblia: no reemplaza
// el texto ni le añade nada. Las preguntas tienen dos opciones grandes (la primera es la correcta; la pantalla
// las baraja) y su respuesta está en el versículo «v». «familia» es una pregunta para conversar en casa.

export type PreguntaNinos = { q: string; opciones: [Opcion, Opcion]; v: number };
type Opcion = { e: string; t: string };

export type Historia = {
  id: string;
  titulo: string;
  book: string;
  chapter: number;
  /** Los versículos que se escuchan, en orden (a veces se salta alguno para que la historia fluya). */
  versos: number[];
  cuento: string;
  preguntas: [PreguntaNinos, PreguntaNinos];
  familia: string;
};

const o = (e: string, t: string): Opcion => ({ e, t });

export const HISTORIAS: Historia[] = [
  {
    id: 'creacion',
    titulo: 'Dios hizo todo',
    book: 'gen',
    chapter: 1,
    versos: [1, 2, 3, 4, 5],
    cuento: 'Antes de que existiera el mundo, solo estaba Dios. No había sol, ni árboles, ni animales… ¡ni tú! Escucha lo que Dios hizo primero.',
    preguntas: [
      { q: '¿Qué hizo Dios al principio?', opciones: [o('🌍', 'El cielo y la tierra'), o('🏠', 'Una casa grande')], v: 1 },
      { q: '¿Qué dijo Dios?', opciones: [o('💡', '«Hágase la luz»'), o('🌙', '«Que todo siga oscuro»')], v: 3 },
    ],
    familia: '¿Qué es lo que más te gusta de todo lo que Dios hizo? Denle gracias juntos por eso.',
  },
  {
    id: 'arcoiris',
    titulo: 'El arco iris de la promesa',
    book: 'gen',
    chapter: 9,
    versos: [12, 13, 14, 15, 16],
    cuento: 'Después de un diluvio muy grande, Noé, su familia y todos los animales salieron del arca. Entonces Dios puso algo hermoso en el cielo.',
    preguntas: [
      { q: '¿Qué puso Dios en la nube?', opciones: [o('🌈', 'Un arco iris'), o('🎈', 'Un globo')], v: 13 },
      { q: '¿Qué significa el arco iris?', opciones: [o('🤝', 'Que Dios cumple su promesa'), o('🎨', 'Nada, es solo un dibujo')], v: 13 },
    ],
    familia: '¿Alguna vez cumpliste una promesa que te costó? ¿Qué promesa de Dios conocen?',
  },
  {
    id: 'mar',
    titulo: 'El mar se abrió',
    book: 'exo',
    chapter: 14,
    versos: [21, 22],
    cuento: 'El pueblo de Dios salía de Egipto. Delante tenían el mar y detrás venía el ejército del faraón. ¡No había por dónde pasar! Pero Dios sí tenía un camino.',
    preguntas: [
      { q: '¿Qué hizo Dios con el mar?', opciones: [o('🌊', 'Lo abrió en dos'), o('🧊', 'Lo congeló')], v: 21 },
      { q: '¿Cómo cruzó el pueblo?', opciones: [o('👣', 'Caminando en tierra seca'), o('🚤', 'En lanchas')], v: 22 },
    ],
    familia: '¿Cuándo has tenido miedo? Cuenten una vez en que Dios les abrió un camino.',
  },
  {
    id: 'david',
    titulo: 'David y el gigante',
    book: '1sa',
    chapter: 17,
    versos: [45, 47, 48, 49],
    cuento: 'Goliat era un gigante enorme y todos tenían miedo de pelear con él. Pero David, un joven pastor de ovejas, confiaba en Dios.',
    preguntas: [
      { q: '¿En nombre de quién venía David?', opciones: [o('🙌', 'En el nombre del Señor'), o('⚔️', 'En el de su espada')], v: 45 },
      { q: '¿Qué usó David?', opciones: [o('🪨', 'Una piedra'), o('🛡️', 'Un escudo gigante')], v: 49 },
    ],
    familia: '¿Qué cosa grande te da miedo? Oren juntos por eso: la lucha es del Señor.',
  },
  {
    id: 'daniel',
    titulo: 'Daniel y los leones',
    book: 'dan',
    chapter: 6,
    versos: [19, 20, 21, 22, 23],
    cuento: 'Daniel oraba a Dios todos los días, aunque el rey había prohibido orar. Por eso lo echaron a un pozo lleno de leones. ¿Qué pasó a la mañana siguiente?',
    preguntas: [
      { q: '¿A quién envió Dios?', opciones: [o('👼', 'A su ángel'), o('🐘', 'A un elefante')], v: 22 },
      { q: '¿Qué le hicieron los leones a Daniel?', opciones: [o('🤐', 'Nada, no le hicieron daño'), o('🏃', 'Lo persiguieron')], v: 22 },
    ],
    familia: 'Daniel oraba siempre. ¿Cuándo oras tú? Busquen un momento del día para orar juntos.',
  },
  {
    id: 'jonas',
    titulo: 'Jonás y el gran pez',
    book: 'jon',
    chapter: 1,
    versos: [15, 17],
    cuento: 'Dios le pidió a Jonás que fuera a la ciudad de Nínive, pero Jonás se subió a un barco que iba para el otro lado. Entonces vino una tormenta muy fuerte, y Jonás dijo a los marineros: «La culpa es mía».',
    preguntas: [
      { q: '¿Qué preparó el Señor?', opciones: [o('🐋', 'Un gran pez'), o('🛶', 'Otro barco')], v: 17 },
      { q: '¿Cuánto tiempo estuvo Jonás dentro del pez?', opciones: [o('3️⃣', 'Tres días y tres noches'), o('🔟', 'Diez años')], v: 17 },
    ],
    familia: '¿Alguna vez hiciste lo contrario de lo que te pidieron? Dios le dio a Jonás otra oportunidad.',
  },
  {
    id: 'navidad',
    titulo: 'Nació Jesús',
    book: 'luk',
    chapter: 2,
    versos: [8, 9, 10, 11, 12, 13, 14],
    cuento: 'Una noche, unos pastores cuidaban sus ovejas en el campo. Todo estaba oscuro y tranquilo… hasta que pasó algo maravilloso.',
    preguntas: [
      { q: '¿Qué les dijo el ángel a los pastores?', opciones: [o('😊', '«No teman»'), o('😴', '«Vayan a dormir»')], v: 10 },
      { q: '¿Dónde estaba el niño?', opciones: [o('🐄', 'Donde comen los animales'), o('🏰', 'En un castillo')], v: 12 },
    ],
    familia: '¿Por qué es una buena noticia que Jesús naciera? ¿A quién se la pueden contar?',
  },
  {
    id: 'tormenta',
    titulo: 'Jesús calma la tormenta',
    book: 'mrk',
    chapter: 4,
    versos: [37, 38, 39, 40, 41],
    cuento: 'Jesús y sus amigos cruzaban el lago en una barca. Jesús estaba tan cansado que se quedó dormido. De pronto, empezó a soplar un viento muy fuerte.',
    preguntas: [
      { q: '¿Qué hacía Jesús en la barca?', opciones: [o('😴', 'Dormía'), o('🎣', 'Pescaba')], v: 38 },
      { q: '¿Qué le dijo Jesús al mar?', opciones: [o('🤫', '«Paz, enmudece»'), o('🌊', '«Más olas»')], v: 39 },
    ],
    familia: 'Cuando tienes miedo, ¿qué le puedes decir a Jesús? Inventen juntos una oración cortita.',
  },
  {
    id: 'panes',
    titulo: 'Cinco panes y dos peces',
    book: 'jhn',
    chapter: 6,
    versos: [8, 9, 10, 11, 12, 13],
    cuento: 'Muchísima gente siguió a Jesús todo el día para escucharlo. Ya era tarde y todos tenían hambre. Solo había un niño con un poquito de comida.',
    preguntas: [
      { q: '¿Qué tenía el niño?', opciones: [o('🍞', 'Cinco panes y dos pescados'), o('🍕', 'Una pizza')], v: 9 },
      { q: '¿Cuántos cestos sobraron?', opciones: [o('🧺', 'Doce cestos llenos'), o('🫙', 'Ninguno')], v: 13 },
    ],
    familia: 'El niño compartió lo poquito que tenía. ¿Qué puedes compartir tú esta semana?',
  },
  {
    id: 'zaqueo',
    titulo: 'Zaqueo sube al árbol',
    book: 'luk',
    chapter: 19,
    versos: [1, 2, 3, 4, 5, 6, 8, 9, 10],
    cuento: 'Zaqueo era rico, pero no se portaba bien: cobraba de más. Un día supo que Jesús pasaría por su ciudad y quiso verlo. Pero había un problema: ¡era muy bajito!',
    preguntas: [
      { q: '¿Dónde se subió Zaqueo?', opciones: [o('🌳', 'A un árbol'), o('🏠', 'Al techo')], v: 4 },
      { q: '¿Qué le dijo Jesús?', opciones: [o('🏡', '«Hoy voy a tu casa»'), o('🚫', '«Bájate y vete»')], v: 5 },
    ],
    familia: 'Jesús quiso ser amigo de Zaqueo. ¿Con quién podrías ser amable aunque otros no lo sean?',
  },
  {
    id: 'oveja',
    titulo: 'La oveja perdida',
    book: 'luk',
    chapter: 15,
    versos: [3, 4, 5, 6, 7],
    cuento: 'Jesús contó una historia sobre un pastor que tenía muchas ovejas. Las conocía y las cuidaba a todas. Un día las contó… ¡y faltaba una!',
    preguntas: [
      { q: '¿Cuántas ovejas tenía el pastor?', opciones: [o('💯', 'Cien'), o('🖐️', 'Cinco')], v: 4 },
      { q: '¿Qué hizo cuando la encontró?', opciones: [o('🤗', 'La tomó en sus brazos con alegría'), o('😠', 'La regañó')], v: 5 },
    ],
    familia: 'Jesús es como ese pastor: te busca y te cuida. ¿Cómo te sientes al saberlo?',
  },
  {
    id: 'resucito',
    titulo: '¡Jesús está vivo!',
    book: 'mat',
    chapter: 28,
    versos: [1, 2, 3, 5, 6, 7],
    cuento: 'Jesús murió en la cruz y lo pusieron en una tumba cerrada con una piedra muy grande. Sus amigas estaban muy tristes. Pero el domingo, muy temprano…',
    preguntas: [
      { q: '¿Quién movió la piedra?', opciones: [o('👼', 'Un ángel del Señor'), o('💪', 'Unos soldados')], v: 2 },
      { q: '¿Qué dijo el ángel de Jesús?', opciones: [o('🎉', '¡Ha resucitado!'), o('😢', 'Sigue en la tumba')], v: 7 },
    ],
    familia: '¿A quién le pueden contar esta semana que Jesús está vivo?',
  },
];

export type Memoria = { id: string; ref: string; book: string; chapter: number; verse: number; texto: string };

// Versículos cortos para guardar en el corazón, uno por semana, en el Español Sencillo.
export const MEMORIA: Memoria[] = [
  { id: 'pastor', ref: 'Salmos 23:1', book: 'psa', chapter: 23, verse: 1, texto: 'El Señor es mi Pastor; nada me faltará.' },
  { id: 'principio', ref: 'Génesis 1:1', book: 'gen', chapter: 1, verse: 1, texto: 'Al principio Dios hizo el cielo y la tierra.' },
  { id: 'temor', ref: 'Salmos 56:3', book: 'psa', chapter: 56, verse: 3, texto: 'En el tiempo de mi temor, confío en ti.' },
  { id: 'luz', ref: 'Salmos 119:105', book: 'psa', chapter: 119, verse: 105, texto: 'Tu palabra es una luz para mis pies, brillando siempre en mi camino.' },
  { id: 'fuerza', ref: 'Filipenses 4:13', book: 'php', chapter: 4, verse: 13, texto: 'Puedo hacer todas las cosas por medio de aquel que me fortalece.' },
  { id: 'amense', ref: 'Juan 15:12', book: 'jhn', chapter: 15, verse: 12, texto: 'Este es el mandamiento que les doy: ámense unos a otros, así como yo les amo.' },
  { id: 'corazon', ref: 'Juan 14:1', book: 'jhn', chapter: 14, verse: 1, texto: 'No se turbe su corazón; tengan fe en Dios y tengan fe en mí.' },
  { id: 'alegria', ref: 'Salmos 118:24', book: 'psa', chapter: 118, verse: 24, texto: 'Este es el día que el Señor ha hecho; estaremos llenos de alegría y deleite en ello.' },
];

/**
 * Parte un versículo en trozos de dos o tres palabras para el juego de ordenar: la puntuación queda pegada a su
 * palabra y ningún trozo pasa de unas 18 letras, para que quepan en botones grandes.
 */
export function trozos(texto: string): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let actual: string[] = [];
  for (const p of palabras) {
    const largo = [...actual, p].join(' ').length;
    if (actual.length && (actual.length >= 3 || largo > 18)) {
      out.push(actual.join(' '));
      actual = [];
    }
    actual.push(p);
    // Una pausa (coma, punto y coma, dos puntos) cierra el trozo: así suena al leerlo.
    if (/[,;:]$/.test(p) && actual.length >= 2) {
      out.push(actual.join(' '));
      actual = [];
    }
  }
  if (actual.length) {
    // Una palabra suelta al final se pega al trozo anterior.
    if (actual.length === 1 && out.length && out[out.length - 1].length + actual[0].length < 22) out[out.length - 1] += ` ${actual[0]}`;
    else out.push(actual.join(' '));
  }
  return out;
}
