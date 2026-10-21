// Fuentes de comentario de la app. Sin dependencias de React Native: también lo usa la función del servidor.
//
// Para añadir una fuente:
// - «traducida»: texto en inglés libre (dominio público o CC BY-SA) que /api/comentario traduce con IA la primera vez
//   y guarda. La IA de Estudiar lee el original de las secciones del pasaje.
//   Sus secciones salen de pipeline/build_comentarios.py.
// - «propia»: texto que ya está en español (por ejemplo Enduring Word en español, si David Guzik da permiso).
//   Se dejan sus secciones en public/comentarios/<id>/ con el mismo formato y se sirven sin traducir:
//   pipeline/importar_comentario.py las prepara a partir del archivo que entregue la editorial.
// - «enlace»: no tenemos el texto; la app enlaza al sitio del autor.

export type Fuente = {
  id: string;
  /** Nombre corto para la pestaña. */
  nombre: string;
  obra: string;
  autor: string;
  año: string;
  tipo: 'traducida' | 'propia' | 'enlace';
  idioma: 'en' | 'es';
  licencia: string;
  /** Una línea para elegir la fuente: su estilo y para qué sirve. */
  nota: string;
  /** Libros que comenta, si no es toda la Biblia: 'AT', 'NT' o una lista de ids de libro. */
  libros?: 'AT' | 'NT' | string[];
  /** false: la licencia no permite pasarle el texto a la IA de Estudiar. */
  ia?: boolean;
  /** false: todavía sin licencia; no aparece en la app ni la sirve el servidor. */
  activa?: boolean;
  /** Página del pasaje en el sitio del autor. */
  url?: (slug: string, chapter: number) => string;
};

export const FUENTES: Fuente[] = [
  {
    id: 'tosn',
    nombre: 'Tyndale',
    obra: 'Notas de estudio abiertas de Tyndale',
    autor: 'Tyndale House Publishers',
    año: '2022',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Notas de estudio modernas, versículo a versículo, e introducción a cada libro.',
    licencia:
      'Adaptado de Tyndale Open Study Notes; la obra original de Tyndale House Publishers está disponible gratis en tyndaleopenresources.com. Esta traducción se comparte con la misma licencia, CC BY-SA 4.0.',
  },
  {
    id: 'mhc',
    nombre: 'Matthew Henry',
    obra: 'Comentario de toda la Biblia',
    autor: 'Matthew Henry',
    año: '1706-1721',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Pastoral y devocional, para meditar y aplicar el pasaje.',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire, preparado por Christian Classics Ethereal Library.',
  },
  {
    id: 'jfb',
    nombre: 'JFB',
    obra: 'Comentario crítico y explicativo de toda la Biblia',
    autor: 'Robert Jamieson, A. R. Fausset y David Brown',
    año: '1871',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Breve y versículo a versículo: qué significa cada frase.',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire, preparado por Christian Classics Ethereal Library.',
  },
  {
    id: 'clarke',
    nombre: 'Adam Clarke',
    obra: 'Comentario de la Santa Biblia',
    autor: 'Adam Clarke',
    año: '1810-1826',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Erudito: idiomas originales, costumbres e historia.',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire.',
  },
  {
    id: 'barnes',
    nombre: 'Barnes',
    obra: 'Notas sobre el Nuevo Testamento',
    autor: 'Albert Barnes',
    año: '1832-1851',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Claro y práctico, escrito para maestros de escuela dominical.',
    libros: 'NT',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire.',
  },
  {
    id: 'calvin',
    nombre: 'Calvino',
    obra: 'Comentarios',
    autor: 'Juan Calvino',
    año: '1540-1564',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'El reformador explica el texto con sencillez y lo aplica.',
    libros: [
      'gen', 'exo', 'lev', 'num', 'deu', 'jos', 'psa', 'isa', 'jer', 'lam', 'ezk', 'dan', 'hos', 'jol', 'amo', 'oba',
      'jon', 'mic', 'nam', 'hab', 'zep', 'hag', 'zec', 'mal', 'mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co',
      'gal', 'eph', 'php', 'col', '1th', '2th', '1ti', '2ti', 'tit', 'phm', 'heb', 'jas', '1pe', '2pe', '1jn', 'jud',
    ],
    licencia: 'Dominio público. Traducción inglesa de la Calvin Translation Society, del módulo SWORD de CrossWire.',
  },
  {
    id: 'kd',
    nombre: 'Keil y Delitzsch',
    obra: 'Comentario bíblico del Antiguo Testamento',
    autor: 'Carl F. Keil y Franz Delitzsch',
    año: '1857-1878',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Técnico: el hebreo, la gramática y el contexto del Antiguo Testamento.',
    libros: 'AT',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire.',
  },
  {
    id: 'tdavid',
    nombre: 'Spurgeon',
    obra: 'El tesoro de David',
    autor: 'Charles H. Spurgeon',
    año: '1869-1885',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Los Salmos versículo a versículo, para orar y predicar.',
    libros: ['psa'],
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire.',
  },
  {
    id: 'wesley',
    nombre: 'Wesley',
    obra: 'Notas explicativas sobre la Biblia',
    autor: 'John Wesley',
    año: '1754-1766',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Notas cortas y directas sobre cada pasaje.',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire.',
  },
  {
    id: 'scofield',
    nombre: 'Scofield',
    obra: 'Notas de la Biblia de referencia Scofield',
    autor: 'C. I. Scofield',
    año: '1917',
    tipo: 'traducida',
    idioma: 'en',
    nota: 'Notas breves sobre temas, profecía y pasajes clave.',
    licencia: 'Dominio público. Texto del módulo SWORD de CrossWire.',
  },
  {
    id: 'ew',
    nombre: 'Enduring Word',
    obra: 'Comentario bíblico Enduring Word',
    autor: 'David Guzik',
    año: '',
    tipo: 'enlace',
    idioma: 'es',
    nota: 'Comentario evangélico moderno, en su sitio web.',
    licencia: 'Se lee en el sitio de Enduring Word.',
    url: (slug, chapter) => `https://enduringword.com/bible-commentary/es/${slug}-${chapter}/`,
  },
  {
    // Notas de la Life Application Study Bible en español. Con derechos de autor: se activa cuando Tyndale dé la
    // licencia (permisos@tyndale.com) y el texto se importe con pipeline/importar_comentario.py.
    id: 'bdv',
    nombre: 'Diario Vivir',
    obra: 'Notas de la Biblia de estudio del diario vivir',
    autor: 'Tyndale House Publishers',
    año: '',
    tipo: 'propia',
    idioma: 'es',
    nota: 'Las notas de aplicación de la Biblia de estudio del diario vivir.',
    licencia: 'Usado con permiso de Tyndale House Publishers. Todos los derechos reservados.',
    ia: false,
    activa: false,
  },
];

/** Las fuentes que la app muestra. */
export const ACTIVAS = FUENTES.filter((f) => f.activa !== false);

/** ¿La fuente comenta este libro? */
export function comenta(f: Fuente, book: { id: string; testament: 'AT' | 'NT' }) {
  if (!f.libros) return true;
  return typeof f.libros === 'string' ? f.libros === book.testament : f.libros.includes(book.id);
}
