// Todas las obras de otros que usa Zarza, con su autor y su licencia, para la página /fuentes. Las licencias CC BY y
// CC BY-SA aceptan que el crédito esté en una página aparte enlazada desde donde sale el contenido: es esta.
// Al añadir una fuente nueva, súmala aquí y en NOTICE.md.

import { FUENTES } from './comentarioFuentes';

export type Credito = {
  obra: string;
  autor: string;
  año?: string;
  licencia: string;
  /** Qué aporta en la app, en una línea. */
  uso: string;
  url?: string;
  /** Lo que la app cambió (traducción, formato…), como piden CC BY y CC BY-SA. */
  cambios?: string;
};

export type GrupoCreditos = { id: string; titulo: string; items: Credito[] };

const DP = 'Dominio público';
const BY = 'CC BY 4.0';
const BYSA = 'CC BY-SA 4.0';

export const LICENCIAS: Record<string, string> = {
  [BY]: 'https://creativecommons.org/licenses/by/4.0/deed.es',
  [BYSA]: 'https://creativecommons.org/licenses/by-sa/4.0/deed.es',
  'CC BY-NC 3.0': 'https://creativecommons.org/licenses/by-nc/3.0/deed.es',
  'CC BY-NC-ND 3.0': 'https://creativecommons.org/licenses/by-nc-nd/3.0/deed.es',
};

export const GRUPOS: GrupoCreditos[] = [
  {
    id: 'biblias',
    titulo: 'Biblias',
    items: [
      { obra: 'Reina-Valera 1909 y Reina-Valera 1865', autor: 'Casiodoro de Reina y Cipriano de Valera, revisiones', licencia: DP, uso: 'El texto principal del lector, del estudio y de la IA.', url: 'https://github.com/scrollmapper/bible_databases' },
      { obra: 'Santa Biblia libre para el mundo', autor: 'eBible.org', licencia: DP, uso: 'Versión para leer y comparar.', url: 'https://ebible.org' },
      { obra: 'Reina Valera Gómez', autor: 'Dr. Humberto Gómez Caballero', año: '2004, 2010', licencia: 'Redistribuible según eBible.org', uso: 'Versión para leer y comparar.', url: 'https://ebible.org' },
      { obra: 'La Biblia en Español Sencillo', autor: 'AudioBiblia', licencia: DP, uso: 'Versión para leer y guion del audio dramatizado.' },
      { obra: 'Palabra de Dios para ti', autor: 'Asociación Bíblica Latinoamericana', año: '2020', licencia: BY, uso: 'Versión para leer y comparar.' },
      { obra: 'NBLA, LBLA, NTV, NVI y NIV', autor: 'The Lockman Foundation, Tyndale House, Biblica', licencia: 'Con derechos de sus editores', uso: 'Se leen en línea por API.Bible y YouVersion, con el aviso de cada editor en cada capítulo. No se usan con la IA.' },
    ],
  },
  {
    id: 'comentarios',
    titulo: 'Comentarios',
    items: FUENTES.filter((f) => f.activa !== false && f.tipo !== 'enlace').map((f) => ({
      obra: f.obra,
      autor: f.autor,
      año: f.año,
      licencia: /CC BY-SA/.test(f.licencia) ? BYSA : DP,
      uso: f.nota,
      cambios: f.idioma === 'en' ? 'Traducido al español con IA la primera vez que alguien lo abre.' : undefined,
    })),
  },
  {
    id: 'diccionarios',
    titulo: 'Diccionarios y léxicos',
    items: [
      {
        obra: 'Diccionario bíblico Tyndale (Aquifer Open Bible Dictionary)',
        autor: 'Tyndale House Publishers (2023); edición en español de Mission Mutual (2026)',
        licencia: BYSA,
        uso: 'El diccionario bíblico de /diccionario, de la pestaña Diccionario del versículo y del buscador.',
        url: 'https://github.com/BibleAquifer/AquiferOpenBibleDictionary',
        cambios: 'Formato adaptado a la app y referencias convertidas en enlaces. Se comparte con la misma licencia.',
      },
      {
        obra: 'Diccionario de hebreo bíblico y Diccionario del griego del Nuevo Testamento',
        autor: 'Sociedades Bíblicas Unidas (2023); el griego adapta el léxico de J. P. Louw y E. A. Nida',
        licencia: BYSA,
        uso: 'El sentido de cada palabra griega y hebrea en la tarjeta de la palabra y el interlineal.',
        url: 'https://github.com/ubsicap/ubs-open-license',
        cambios: 'Sin cambios en el texto; solo se quitan las marcas internas.',
      },
      {
        obra: 'Manuales de plantas, animales y objetos de la Biblia (Flora, Fauna and Realia Handbooks)',
        autor: 'Sociedades Bíblicas Unidas (2025); adaptan obras de Edward R. Hope y otros',
        licencia: BYSA,
        uso: '«¿Qué era?» en la tarjeta de la palabra: el hisopo, el efod, el chacal.',
        url: 'https://github.com/ubsicap/ubs-open-license',
        cambios: 'Traducidos al español con IA, sin los consejos para traductores. La traducción se comparte con la misma licencia.',
      },
      { obra: "Easton's Bible Dictionary", autor: 'M. G. Easton', año: '1897', licencia: DP, uso: 'Explicaciones del buscador y de la IA.', url: 'https://github.com/neuu-org/bible-dictionary-dataset', cambios: 'Datos de NEUU (CC BY 4.0). Explicado en español con IA.' },
      { obra: "Smith's Bible Dictionary", autor: 'William Smith', año: '1863', licencia: DP, uso: 'Explicaciones del buscador y de la IA.', url: 'https://github.com/neuu-org/bible-dictionary-dataset', cambios: 'Datos de NEUU (CC BY 4.0). Explicado en español con IA.' },
      { obra: "Nave's Topical Bible", autor: 'Orville J. Nave', año: '1896', licencia: DP, uso: 'Temas de la Biblia para la IA.', url: 'https://github.com/BradyStephenson/bible-data', cambios: 'Datos de BibleData (CC BY 4.0).' },
      { obra: 'Léxicos breves TBESG y TBESH', autor: 'STEPBible, Tyndale House, Cambridge', licencia: BY, uso: '«La historia de una palabra» y el significado del interlineal.', url: 'https://github.com/STEPBible/STEPBible-Data' },
    ],
  },
  {
    id: 'original',
    titulo: 'Griego, hebreo y datos de estudio',
    items: [
      { obra: 'TAGNT, TAHOT y TIPNR', autor: 'STEPBible, Tyndale House, Cambridge', licencia: BY, uso: 'Interlineal, morfología, concordancia y fichas de personas y lugares.', url: 'https://github.com/STEPBible/STEPBible-Data', cambios: 'Glosas en español corregidas y descripciones traducidas con IA.' },
      { obra: 'Referencias cruzadas y ubicación de lugares', autor: 'OpenBible.info', licencia: BY, uso: 'Referencias del versículo, arcos de /conexiones y mapas.', url: 'https://www.openbible.info/' },
      { obra: 'Theographic Bible Metadata', autor: 'Robert Rouse', licencia: BYSA, uso: 'Genealogías y familias de las fichas.', url: 'https://github.com/robertrouse/theographic-bible-metadata', cambios: 'Los árboles derivados se comparten con la misma licencia.' },
      { obra: 'Fotos de lugares, objetos y mapas', autor: 'Wikimedia Commons', licencia: 'La de cada foto', uso: 'Imágenes del estudio, con su autor y licencia junto a la imagen.', url: 'https://commons.wikimedia.org' },
    ],
  },
  {
    id: 'teologia',
    titulo: 'Teología e historia de la Iglesia',
    items: [
      { obra: 'Teologías sistemáticas', autor: 'Charles Hodge, Augustus H. Strong, W. G. T. Shedd, John Miley', año: '1871-1907', licencia: DP, uso: 'La IA las consulta para las preguntas de doctrina.' },
      { obra: 'Institución de la religión cristiana', autor: 'Juan Calvino (trad. Beveridge, 1845)', licencia: DP, uso: 'Consulta de la IA.' },
      { obra: 'The Creeds of Christendom y History of the Christian Church', autor: 'Philip Schaff', licencia: DP, uso: 'Credos, confesiones y controversias.', url: 'https://ccel.org/ccel/schaff' },
      { obra: 'Catecismo Mayor de Westminster', autor: 'Asamblea de Westminster', año: '1647', licencia: DP, uso: 'Consulta de la IA.' },
      { obra: 'Padres de la Iglesia', autor: 'Ireneo, Tertuliano, Hipólito, Atanasio, Eusebio', licencia: DP, uso: 'Historia del canon y respuestas a las herejías.', url: 'https://ccel.org' },
      { obra: 'Historia del canon del Nuevo Testamento', autor: 'B. F. Westcott', licencia: DP, uso: 'Consulta de la IA sobre el canon.' },
    ],
  },
  {
    id: 'audio',
    titulo: 'Audio',
    items: [
      { obra: 'Nuevo Testamento griego (Westcott-Hort)', autor: 'Leído por Marilyn Phemister', licencia: 'CC BY-NC 3.0', uso: 'Audio en griego, desde archive.org.' },
      { obra: 'Tanaj hebreo', autor: 'Leído por Abraham Shmuelof', licencia: 'CC BY-NC-ND 3.0', uso: 'Audio en hebreo, desde archive.org, sin cambios.' },
      { obra: 'Reina-Valera 1909 en audio', autor: 'Samuel Montoya y voluntarios de LibriVox', licencia: DP, uso: 'Lectura en voz alta, desde archive.org.' },
    ],
  },
];
