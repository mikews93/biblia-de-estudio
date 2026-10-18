// Contenido que cambia cada día: el mismo para todos en la misma fecha.

/** Versículos del día: [libro, capítulo, versículo], numeración de la RV1909. */
const VERSES: [string, number, number][] = [
  ['jhn', 3, 16], ['psa', 23, 1], ['rom', 8, 28], ['php', 4, 13], ['isa', 41, 10], ['pro', 3, 5],
  ['mat', 11, 28], ['jer', 29, 11], ['jos', 1, 9], ['psa', 46, 1], ['rom', 12, 2], ['gal', 2, 20],
  ['eph', 2, 8], ['1co', 13, 4], ['2co', 5, 17], ['heb', 11, 1], ['jas', 1, 5], ['1pe', 5, 7],
  ['1jn', 1, 9], ['psa', 119, 105], ['isa', 40, 31], ['lam', 3, 22], ['mic', 6, 8], ['mat', 6, 33],
  ['mat', 5, 9], ['jhn', 14, 6], ['jhn', 15, 5], ['jhn', 1, 1], ['rom', 5, 8], ['rom', 6, 23],
  ['rom', 10, 9], ['rom', 15, 13], ['php', 4, 6], ['col', 3, 23], ['2ti', 1, 7], ['heb', 4, 16],
  ['heb', 12, 1], ['psa', 37, 4], ['psa', 91, 1], ['psa', 121, 1], ['psa', 139, 14], ['pro', 16, 3],
  ['ecc', 3, 1], ['isa', 26, 3], ['isa', 53, 5], ['zep', 3, 17], ['mat', 28, 19], ['mrk', 10, 45],
  ['luk', 1, 37], ['jhn', 8, 32], ['jhn', 11, 25], ['act', 1, 8], ['gal', 5, 22], ['eph', 4, 32],
  ['1th', 5, 16], ['2ti', 3, 16], ['1jn', 4, 19], ['rev', 21, 4], ['deu', 31, 6], ['num', 6, 24],
];

const QUESTIONS = [
  '¿Qué dice este pasaje sobre quién es Dios?',
  '¿Hay una promesa aquí que necesites recordar hoy?',
  '¿Qué cambiaría en tu día si creyeras esto de verdad?',
  '¿A quién podrías animar hoy con estas palabras?',
  '¿Qué palabra del versículo te llama más la atención, y por qué?',
  '¿Hay algo aquí que te cueste aceptar? Díselo a Dios con sinceridad.',
  '¿Cómo se ve este versículo en la vida de Jesús?',
];

function dayNumber(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((now - start) / 86_400_000) + date.getFullYear() * 366;
}

export function verseOfTheDay(date = new Date()) {
  const [book, chapter, verse] = VERSES[dayNumber(date) % VERSES.length];
  return { book, chapter, verse };
}

export const questionOfTheDay = (date = new Date()) => QUESTIONS[dayNumber(date) % QUESTIONS.length];

export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}
