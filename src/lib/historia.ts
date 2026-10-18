// Contexto histórico: cuándo ocurre cada capítulo y qué pasaba en el mundo en esos años.
//
// Fechas bíblicas: cronología conservadora habitual (éxodo c. 1446 a.C. según 1 Reyes 6:1, reyes de Israel y Judá
// según E. R. Thiele, crucifixión c. 30 d.C.). Donde hay una alternativa seria se dice en la nota.
// Eventos del mundo: selección propia con las fechas que da la historia académica; «c.» marca las aproximadas.
// Años: negativos = antes de Cristo (no hay año 0).

export type Periodo = {
  id: string;
  titulo: string;
  desde: number;
  hasta: number;
  /** Capítulo donde empieza, para enlazar desde la línea de tiempo: «gen.12». */
  ref: string;
  nota?: string;
  /** El texto no permite fijar fechas (Génesis 1–11). */
  sinFecha?: boolean;
};

export type Region =
  | 'Egipto'
  | 'Mesopotamia'
  | 'Asia Menor'
  | 'Levante'
  | 'Persia'
  | 'Grecia'
  | 'Roma'
  | 'India'
  | 'China'
  | 'América'
  | 'Europa';

export type Evento = {
  desde: number;
  hasta?: number;
  /** Fecha aproximada. */
  c?: boolean;
  region: Region;
  titulo: string;
  texto: string;
  /** Pasaje que lo menciona o se relaciona directamente: «2ki.18.13». */
  ref?: string;
};

export const REGION_COLORS: Record<Region, string> = {
  Egipto: '#C08A2E',
  Mesopotamia: '#7D5BA6',
  'Asia Menor': '#A0522D',
  Levante: '#8E3B5B',
  Persia: '#2E8B83',
  Grecia: '#3B6FB6',
  Roma: '#B03A2E',
  India: '#D2691E',
  China: '#C0392B',
  América: '#4E8B3A',
  Europa: '#5D6D7E',
};

const EXODO = 'Fecha temprana según 1 Reyes 6:1; otros especialistas sitúan el éxodo hacia 1270–1260 a.C., con Ramsés II.';
const PATRIARCAS =
  'Fechas según la cronología temprana; muchos especialistas sitúan a los patriarcas entre 2000 y 1700 a.C.';
const CRUZ = 'Muchos fechan la crucifixión en el año 30 d.C.; otros en el 33 d.C.';

const PERIODOS_LISTA: Periodo[] = [
  {
    id: 'origenes',
    titulo: 'Los orígenes',
    desde: -3200,
    hasta: -2100,
    ref: 'gen.1',
    sinFecha: true,
    nota: 'Génesis 1–11 no da fechas que se puedan fijar en la historia. Como referencia, estas son las primeras civilizaciones que conoce la arqueología.',
  },
  { id: 'abraham', titulo: 'Abraham', desde: -2091, hasta: -1991, ref: 'gen.12', nota: PATRIARCAS },
  {
    id: 'job',
    titulo: 'Job (fecha incierta)',
    desde: -2100,
    hasta: -1800,
    ref: 'job.1',
    nota: 'El libro no da fechas; por sus costumbres muchos lo sitúan en la época de los patriarcas.',
  },
  { id: 'isaac-jacob', titulo: 'Isaac y Jacob', desde: -2066, hasta: -1898, ref: 'gen.25', nota: PATRIARCAS },
  { id: 'jose', titulo: 'José en Egipto', desde: -1898, hasta: -1805, ref: 'gen.37', nota: PATRIARCAS },
  { id: 'egipto', titulo: 'Israel crece en Egipto', desde: -1805, hasta: -1526, ref: 'exo.1', nota: EXODO },
  { id: 'moises', titulo: 'Nacimiento y llamado de Moisés', desde: -1526, hasta: -1446, ref: 'exo.2', nota: EXODO },
  { id: 'exodo', titulo: 'Las plagas y la salida de Egipto', desde: -1446, hasta: -1446, ref: 'exo.5', nota: EXODO },
  { id: 'sinai', titulo: 'Israel en el Sinaí', desde: -1446, hasta: -1445, ref: 'exo.16', nota: EXODO },
  { id: 'desierto', titulo: 'Cuarenta años en el desierto', desde: -1445, hasta: -1406, ref: 'num.11', nota: EXODO },
  { id: 'moab', titulo: 'Moisés se despide en Moab', desde: -1406, hasta: -1406, ref: 'deu.1', nota: EXODO },
  { id: 'conquista', titulo: 'La conquista de Canaán', desde: -1406, hasta: -1380, ref: 'jos.1', nota: EXODO },
  { id: 'jueces', titulo: 'Los jueces', desde: -1380, hasta: -1050, ref: 'jdg.1' },
  { id: 'rut', titulo: 'Rut, en tiempos de los jueces', desde: -1150, hasta: -1100, ref: 'rut.1' },
  { id: 'samuel', titulo: 'Samuel, el último juez', desde: -1105, hasta: -1050, ref: '1sa.1' },
  { id: 'saul', titulo: 'Reinado de Saúl', desde: -1050, hasta: -1010, ref: '1sa.8' },
  { id: 'david', titulo: 'Reinado de David', desde: -1010, hasta: -970, ref: '2sa.1' },
  {
    id: 'salmos',
    titulo: 'Los Salmos, sobre todo en tiempos de David',
    desde: -1010,
    hasta: -970,
    ref: 'psa.1',
    nota: 'El libro reúne cantos de muchos siglos, desde Moisés (Salmo 90) hasta el regreso del exilio (Salmo 126); la mayoría vienen de David y su época.',
  },
  { id: 'salomon', titulo: 'Reinado de Salomón', desde: -970, hasta: -931, ref: '1ki.1' },
  { id: 'division', titulo: 'El reino se divide', desde: -931, hasta: -874, ref: '1ki.12' },
  { id: 'roboam', titulo: 'Roboam, rey de Judá', desde: -931, hasta: -913, ref: '2ch.10' },
  { id: 'asa', titulo: 'Abías y Asa, reyes de Judá', desde: -913, hasta: -870, ref: '2ch.13' },
  { id: 'acab', titulo: 'Acab y el profeta Elías', desde: -874, hasta: -853, ref: '1ki.17' },
  { id: 'josafat', titulo: 'Josafat, rey de Judá', desde: -872, hasta: -848, ref: '2ch.17' },
  { id: 'eliseo', titulo: 'El profeta Eliseo', desde: -853, hasta: -841, ref: '2ki.1' },
  { id: 'atalia', titulo: 'Joram, Ocozías y Atalía', desde: -848, hasta: -835, ref: '2ch.21' },
  { id: 'jehu', titulo: 'Jehú, rey de Israel', desde: -841, hasta: -814, ref: '2ki.9' },
  { id: 'joas', titulo: 'Joás, rey de Judá', desde: -835, hasta: -796, ref: '2ki.11' },
  {
    id: 'joel',
    titulo: 'Joel (fecha discutida)',
    desde: -835,
    hasta: -796,
    ref: 'jol.1',
    nota: 'Unos lo sitúan en tiempos de Joás de Judá (siglo IX a.C.) y otros después del exilio.',
  },
  { id: 'amasias', titulo: 'Amasías de Judá y Jeroboam II de Israel', desde: -796, hasta: -767, ref: '2ki.14' },
  { id: 'jonas', titulo: 'Jonás, en tiempos de Jeroboam II', desde: -785, hasta: -760, ref: 'jon.1' },
  { id: 'amos', titulo: 'Amós profetiza en Israel', desde: -760, hasta: -750, ref: 'amo.1' },
  { id: 'oseas', titulo: 'Oseas profetiza en Israel', desde: -755, hasta: -715, ref: 'hos.1' },
  { id: 'uzias', titulo: 'Uzías y los últimos reyes de Israel', desde: -792, hasta: -732, ref: '2ki.15' },
  { id: 'jotam', titulo: 'Jotam, rey de Judá', desde: -750, hasta: -735, ref: '2ch.27' },
  { id: 'isaias', titulo: 'Isaías profetiza en Judá', desde: -740, hasta: -681, ref: 'isa.1' },
  { id: 'miqueas', titulo: 'Miqueas profetiza en Judá', desde: -735, hasta: -700, ref: 'mic.1' },
  { id: 'acaz', titulo: 'Acaz, rey de Judá', desde: -735, hasta: -715, ref: '2ki.16' },
  { id: 'samaria', titulo: 'Caída de Samaria', desde: -732, hasta: -722, ref: '2ki.17' },
  { id: 'ezequias', titulo: 'Ezequías, rey de Judá', desde: -715, hasta: -686, ref: '2ki.18' },
  { id: 'manases', titulo: 'Manasés y Amón, reyes de Judá', desde: -697, hasta: -640, ref: '2ki.21' },
  { id: 'nahum', titulo: 'Nahúm anuncia la caída de Nínive', desde: -663, hasta: -612, ref: 'nam.1' },
  { id: 'sofonias', titulo: 'Sofonías, en tiempos de Josías', desde: -640, hasta: -621, ref: 'zep.1' },
  { id: 'josias', titulo: 'Josías, rey de Judá', desde: -640, hasta: -609, ref: '2ki.22' },
  { id: 'jeremias', titulo: 'Jeremías profetiza en Jerusalén', desde: -627, hasta: -580, ref: 'jer.1' },
  { id: 'habacuc', titulo: 'Habacuc ante la amenaza de Babilonia', desde: -609, hasta: -598, ref: 'hab.1' },
  { id: 'caida', titulo: 'Últimos reyes de Judá y caída de Jerusalén', desde: -609, hasta: -586, ref: '2ki.24' },
  { id: 'daniel', titulo: 'Daniel en la corte de Babilonia', desde: -605, hasta: -536, ref: 'dan.1' },
  { id: 'ezequiel', titulo: 'Ezequiel entre los desterrados', desde: -593, hasta: -571, ref: 'ezk.1' },
  { id: 'lamentaciones', titulo: 'Jerusalén destruida', desde: -586, hasta: -586, ref: 'lam.1' },
  {
    id: 'abdias',
    titulo: 'Abdías, tras la caída de Jerusalén',
    desde: -586,
    hasta: -553,
    ref: 'oba.1',
    nota: 'Otros lo fechan en el siglo IX a.C.',
  },
  { id: 'exilio', titulo: 'El exilio en Babilonia', desde: -586, hasta: -538, ref: '2ki.25' },
  { id: 'visiones', titulo: 'Las visiones de Daniel', desde: -553, hasta: -536, ref: 'dan.7' },
  { id: 'regreso', titulo: 'Regreso del exilio y nuevo templo', desde: -538, hasta: -515, ref: 'ezr.1' },
  { id: 'hageo', titulo: 'Hageo y Zacarías animan a reconstruir', desde: -520, hasta: -480, ref: 'hag.1' },
  { id: 'ester', titulo: 'Ester en Susa', desde: -483, hasta: -473, ref: 'est.1' },
  { id: 'esdras', titulo: 'Esdras llega a Jerusalén', desde: -458, hasta: -457, ref: 'ezr.7' },
  { id: 'nehemias', titulo: 'Nehemías reconstruye los muros', desde: -445, hasta: -432, ref: 'neh.1' },
  { id: 'malaquias', titulo: 'Malaquías, el último profeta del AT', desde: -440, hasta: -430, ref: 'mal.1' },
  {
    id: 'cronicas',
    titulo: 'Cuando se escribió Crónicas',
    desde: -450,
    hasta: -400,
    ref: '1ch.1',
    nota: 'Estas genealogías recorren la historia desde Adán hasta el regreso del exilio; Crónicas se escribió para los que volvieron.',
  },
  { id: 'nacimiento', titulo: 'Nacimiento de Jesús', desde: -6, hasta: -4, ref: 'mat.1' },
  { id: 'ministerio', titulo: 'Ministerio de Jesús', desde: 27, hasta: 30, ref: 'mat.3', nota: CRUZ },
  { id: 'pasion', titulo: 'Muerte y resurrección de Jesús', desde: 30, hasta: 30, ref: 'mat.26', nota: CRUZ },
  { id: 'iglesia', titulo: 'La iglesia en Jerusalén', desde: 30, hasta: 34, ref: 'act.1' },
  { id: 'expansion', titulo: 'El evangelio sale de Jerusalén', desde: 34, hasta: 46, ref: 'act.8' },
  { id: 'santiago', titulo: 'Cuando se escribió Santiago', desde: 45, hasta: 49, ref: 'jas.1' },
  { id: 'viaje1', titulo: 'Primer viaje de Pablo', desde: 46, hasta: 48, ref: 'act.13' },
  {
    id: 'galatas',
    titulo: 'Cuando se escribió Gálatas',
    desde: 48,
    hasta: 49,
    ref: 'gal.1',
    nota: 'Otros la fechan hacia el 55 d.C., durante el tercer viaje.',
  },
  { id: 'concilio', titulo: 'Concilio de Jerusalén', desde: 49, hasta: 49, ref: 'act.15' },
  { id: 'viaje2', titulo: 'Segundo viaje de Pablo', desde: 49, hasta: 52, ref: 'act.16' },
  { id: 'tesalonicenses', titulo: 'Cuando se escribieron 1 y 2 Tesalonicenses', desde: 50, hasta: 51, ref: '1th.1' },
  { id: 'viaje3', titulo: 'Tercer viaje de Pablo', desde: 52, hasta: 57, ref: 'act.19' },
  { id: 'corintios', titulo: 'Cuando se escribieron 1 y 2 Corintios', desde: 55, hasta: 56, ref: '1co.1' },
  { id: 'romanos', titulo: 'Cuando se escribió Romanos', desde: 57, hasta: 57, ref: 'rom.1' },
  { id: 'prision', titulo: 'Pablo preso en Jerusalén y Cesarea', desde: 57, hasta: 59, ref: 'act.22' },
  { id: 'roma', titulo: 'Viaje a Roma y prisión de Pablo', desde: 59, hasta: 62, ref: 'act.27' },
  { id: 'carceles', titulo: 'Cartas desde la prisión en Roma', desde: 60, hasta: 62, ref: 'eph.1' },
  { id: 'pastorales', titulo: 'Cartas a Timoteo y Tito', desde: 62, hasta: 64, ref: '1ti.1' },
  { id: 'pedro', titulo: 'Cuando se escribió 1 Pedro', desde: 62, hasta: 64, ref: '1pe.1' },
  { id: 'ultimas', titulo: 'Últimas cartas de Pablo y de Pedro', desde: 64, hasta: 67, ref: '2ti.1' },
  { id: 'hebreos', titulo: 'Cuando se escribió Hebreos', desde: 64, hasta: 69, ref: 'heb.1' },
  { id: 'judas', titulo: 'Cuando se escribió Judas', desde: 65, hasta: 80, ref: 'jud.1' },
  { id: 'juan', titulo: 'Cuando se escribieron las cartas de Juan', desde: 85, hasta: 95, ref: '1jn.1' },
  {
    id: 'apocalipsis',
    titulo: 'Juan en Patmos',
    desde: 95,
    hasta: 95,
    ref: 'rev.1',
    nota: 'La fecha más aceptada es hacia el 95 d.C., con Domiciano; otros la sitúan hacia el 68 d.C., con Nerón.',
  },
];

export const PERIODOS: Record<string, Periodo> = Object.fromEntries(PERIODOS_LISTA.map((p) => [p.id, p]));

// [libro, primer capítulo, último capítulo, periodo]. Los tramos de un libro van en orden y lo cubren entero.
const TRAMOS: [string, number, number, string][] = [
  ['gen', 1, 11, 'origenes'],
  ['gen', 12, 24, 'abraham'],
  ['gen', 25, 36, 'isaac-jacob'],
  ['gen', 37, 50, 'jose'],
  ['exo', 1, 1, 'egipto'],
  ['exo', 2, 4, 'moises'],
  ['exo', 5, 15, 'exodo'],
  ['exo', 16, 40, 'sinai'],
  ['lev', 1, 27, 'sinai'],
  ['num', 1, 10, 'sinai'],
  ['num', 11, 36, 'desierto'],
  ['deu', 1, 34, 'moab'],
  ['jos', 1, 24, 'conquista'],
  ['jdg', 1, 21, 'jueces'],
  ['rut', 1, 4, 'rut'],
  ['1sa', 1, 7, 'samuel'],
  ['1sa', 8, 31, 'saul'],
  ['2sa', 1, 24, 'david'],
  ['1ki', 1, 11, 'salomon'],
  ['1ki', 12, 16, 'division'],
  ['1ki', 17, 22, 'acab'],
  ['2ki', 1, 8, 'eliseo'],
  ['2ki', 9, 10, 'jehu'],
  ['2ki', 11, 13, 'joas'],
  ['2ki', 14, 14, 'amasias'],
  ['2ki', 15, 15, 'uzias'],
  ['2ki', 16, 16, 'acaz'],
  ['2ki', 17, 17, 'samaria'],
  ['2ki', 18, 20, 'ezequias'],
  ['2ki', 21, 21, 'manases'],
  ['2ki', 22, 23, 'josias'],
  ['2ki', 24, 24, 'caida'],
  ['2ki', 25, 25, 'exilio'],
  ['1ch', 1, 9, 'cronicas'],
  ['1ch', 10, 10, 'saul'],
  ['1ch', 11, 29, 'david'],
  ['2ch', 1, 9, 'salomon'],
  ['2ch', 10, 12, 'roboam'],
  ['2ch', 13, 16, 'asa'],
  ['2ch', 17, 20, 'josafat'],
  ['2ch', 21, 23, 'atalia'],
  ['2ch', 24, 24, 'joas'],
  ['2ch', 25, 25, 'amasias'],
  ['2ch', 26, 26, 'uzias'],
  ['2ch', 27, 27, 'jotam'],
  ['2ch', 28, 28, 'acaz'],
  ['2ch', 29, 32, 'ezequias'],
  ['2ch', 33, 33, 'manases'],
  ['2ch', 34, 35, 'josias'],
  ['2ch', 36, 36, 'caida'],
  ['ezr', 1, 6, 'regreso'],
  ['ezr', 7, 10, 'esdras'],
  ['neh', 1, 13, 'nehemias'],
  ['est', 1, 10, 'ester'],
  ['job', 1, 42, 'job'],
  ['psa', 1, 73, 'salmos'],
  ['psa', 74, 74, 'exilio'],
  ['psa', 75, 78, 'salmos'],
  ['psa', 79, 79, 'exilio'],
  ['psa', 80, 89, 'salmos'],
  ['psa', 90, 90, 'desierto'],
  ['psa', 91, 125, 'salmos'],
  ['psa', 126, 126, 'regreso'],
  ['psa', 127, 136, 'salmos'],
  ['psa', 137, 137, 'exilio'],
  ['psa', 138, 150, 'salmos'],
  ['pro', 1, 24, 'salomon'],
  ['pro', 25, 29, 'ezequias'],
  ['pro', 30, 31, 'salomon'],
  ['ecc', 1, 12, 'salomon'],
  ['sng', 1, 8, 'salomon'],
  ['isa', 1, 66, 'isaias'],
  ['jer', 1, 52, 'jeremias'],
  ['lam', 1, 5, 'lamentaciones'],
  ['ezk', 1, 48, 'ezequiel'],
  ['dan', 1, 6, 'daniel'],
  ['dan', 7, 12, 'visiones'],
  ['hos', 1, 14, 'oseas'],
  ['jol', 1, 3, 'joel'],
  ['amo', 1, 9, 'amos'],
  ['oba', 1, 1, 'abdias'],
  ['jon', 1, 4, 'jonas'],
  ['mic', 1, 7, 'miqueas'],
  ['nam', 1, 3, 'nahum'],
  ['hab', 1, 3, 'habacuc'],
  ['zep', 1, 3, 'sofonias'],
  ['hag', 1, 2, 'hageo'],
  ['zec', 1, 14, 'hageo'],
  ['mal', 1, 4, 'malaquias'],
  ['mat', 1, 2, 'nacimiento'],
  ['mat', 3, 25, 'ministerio'],
  ['mat', 26, 28, 'pasion'],
  ['mrk', 1, 13, 'ministerio'],
  ['mrk', 14, 16, 'pasion'],
  ['luk', 1, 2, 'nacimiento'],
  ['luk', 3, 21, 'ministerio'],
  ['luk', 22, 24, 'pasion'],
  ['jhn', 1, 12, 'ministerio'],
  ['jhn', 13, 21, 'pasion'],
  ['act', 1, 7, 'iglesia'],
  ['act', 8, 12, 'expansion'],
  ['act', 13, 14, 'viaje1'],
  ['act', 15, 15, 'concilio'],
  ['act', 16, 18, 'viaje2'],
  ['act', 19, 21, 'viaje3'],
  ['act', 22, 26, 'prision'],
  ['act', 27, 28, 'roma'],
  ['rom', 1, 16, 'romanos'],
  ['1co', 1, 16, 'corintios'],
  ['2co', 1, 13, 'corintios'],
  ['gal', 1, 6, 'galatas'],
  ['eph', 1, 6, 'carceles'],
  ['php', 1, 4, 'carceles'],
  ['col', 1, 4, 'carceles'],
  ['1th', 1, 5, 'tesalonicenses'],
  ['2th', 1, 3, 'tesalonicenses'],
  ['1ti', 1, 6, 'pastorales'],
  ['2ti', 1, 4, 'ultimas'],
  ['tit', 1, 3, 'pastorales'],
  ['phm', 1, 1, 'carceles'],
  ['heb', 1, 13, 'hebreos'],
  ['jas', 1, 5, 'santiago'],
  ['1pe', 1, 5, 'pedro'],
  ['2pe', 1, 3, 'ultimas'],
  ['1jn', 1, 5, 'juan'],
  ['2jn', 1, 1, 'juan'],
  ['3jn', 1, 1, 'juan'],
  ['jud', 1, 1, 'judas'],
  ['rev', 1, 22, 'apocalipsis'],
];

export const EVENTOS: Evento[] = [
  // Las primeras civilizaciones
  { desde: -3200, c: true, region: 'Mesopotamia', titulo: 'Nace la escritura', texto: 'En Uruk (Sumer) aparecen las primeras tablillas en escritura cuneiforme.' },
  { desde: -3100, c: true, region: 'Egipto', titulo: 'Egipto se unifica', texto: 'El Alto y el Bajo Egipto se unen bajo un solo rey; comienza la historia de los faraones.' },
  { desde: -2600, hasta: -1900, c: true, region: 'India', titulo: 'Civilización del valle del Indo', texto: 'Harappa y Mohenjo-daro tienen calles en cuadrícula, desagües y una escritura que aún no se descifra.' },
  { desde: -2560, c: true, region: 'Egipto', titulo: 'La Gran Pirámide de Guiza', texto: 'Se construye para el faraón Keops; fue el edificio más alto del mundo durante casi 4.000 años.' },
  { desde: -2500, c: true, region: 'Europa', titulo: 'Stonehenge', texto: 'En Britania se levantan los grandes bloques de piedra del santuario de Stonehenge.' },
  { desde: -2334, hasta: -2154, c: true, region: 'Mesopotamia', titulo: 'Imperio acadio', texto: 'Sargón de Acad une las ciudades de Mesopotamia en el primer gran imperio conocido.' },
  { desde: -2112, hasta: -2004, c: true, region: 'Mesopotamia', titulo: 'Ur en su esplendor', texto: 'La tercera dinastía de Ur levanta el gran zigurat; de Ur de los caldeos salió la familia de Abraham.', ref: 'gen.11.31' },
  // Los patriarcas
  { desde: -2055, hasta: -1650, c: true, region: 'Egipto', titulo: 'Reino Medio de Egipto', texto: 'Egipto vive una época de estabilidad, grandes obras de riego y literatura clásica.' },
  { desde: -1950, c: true, region: 'Grecia', titulo: 'Palacios de Creta', texto: 'La civilización minoica construye el palacio de Cnosos.' },
  { desde: -1800, hasta: -1760, c: true, region: 'Mesopotamia', titulo: 'Archivos de Mari', texto: 'Miles de tablillas del reino de Mari describen nombres y costumbres parecidos a los de los patriarcas.' },
  { desde: -1792, hasta: -1750, region: 'Mesopotamia', titulo: 'Hammurabi de Babilonia', texto: 'El rey Hammurabi graba su código de leyes en una estela de piedra (c. 1754 a.C.).' },
  // Israel en Egipto
  { desde: -1650, hasta: -1550, c: true, region: 'Egipto', titulo: 'Los hicsos', texto: 'Gobernantes de origen semita dominan el norte de Egipto desde Avaris, en el delta del Nilo.' },
  { desde: -1600, hasta: -1046, c: true, region: 'China', titulo: 'Dinastía Shang', texto: 'Primera dinastía china con escritura: preguntas a los antepasados grabadas en huesos y caparazones.' },
  { desde: -1600, hasta: -1100, c: true, region: 'Grecia', titulo: 'Grecia micénica', texto: 'Reinos guerreros como Micenas y Pilos; son los reyes de los relatos de Homero.' },
  { desde: -1550, hasta: -1070, c: true, region: 'Egipto', titulo: 'Reino Nuevo de Egipto', texto: 'Egipto expulsa a los hicsos y se convierte en un imperio que domina Canaán.' },
  { desde: -1479, hasta: -1458, region: 'Egipto', titulo: 'La reina-faraón Hatshepsut', texto: 'Gobierna Egipto como faraón y envía expediciones al país de Punt.' },
  { desde: -1457, c: true, region: 'Egipto', titulo: 'Batalla de Meguido', texto: 'Tutmosis III derrota a una coalición de reyes cananeos y somete Canaán a Egipto.' },
  // Éxodo, conquista y jueces
  { desde: -1360, hasta: -1332, c: true, region: 'Egipto', titulo: 'Cartas de Amarna', texto: 'Reyes de Canaán, entre ellos el de Jerusalén, piden ayuda al faraón contra los «habiru».' },
  { desde: -1353, hasta: -1336, c: true, region: 'Egipto', titulo: 'Akenatón', texto: 'El faraón impone el culto al disco solar Atón y funda una nueva capital.' },
  { desde: -1332, hasta: -1323, c: true, region: 'Egipto', titulo: 'Tutankamón', texto: 'El joven faraón devuelve el culto a los dioses antiguos; su tumba se halló casi intacta en 1922.' },
  { desde: -1279, hasta: -1213, region: 'Egipto', titulo: 'Ramsés II', texto: 'Gran constructor; en Qadesh (1274 a.C.) lucha contra los hititas y luego firma con ellos la paz.' },
  { desde: -1250, c: true, region: 'Grecia', titulo: 'La guerra de Troya', texto: 'Fecha tradicional del conflicto que siglos después cantará Homero.' },
  { desde: -1208, region: 'Egipto', titulo: 'Estela de Merneptah', texto: 'Un faraón presume de haber vencido a «Israel»: la mención más antigua de Israel fuera de la Biblia.' },
  { desde: -1200, hasta: -1150, c: true, region: 'Asia Menor', titulo: 'Colapso de la Edad del Bronce', texto: 'Caen el imperio hitita y Ugarit; los «Pueblos del Mar» atacan Egipto y los filisteos se asientan en la costa de Canaán.', ref: 'jdg.13.1' },
  { desde: -1200, hasta: -400, c: true, region: 'América', titulo: 'Los olmecas', texto: 'En la costa del golfo de México surge la primera gran cultura de Mesoamérica, con sus cabezas colosales.' },
  { desde: -1500, hasta: -1200, c: true, region: 'India', titulo: 'Los Vedas', texto: 'Se componen los himnos del Rig Veda, el texto más antiguo de la India.' },
  { desde: -1050, c: true, region: 'Levante', titulo: 'El alfabeto fenicio', texto: 'Los fenicios difunden un alfabeto de 22 letras, antepasado del griego y del latino.' },
  // El reino unido
  { desde: -1046, hasta: -256, region: 'China', titulo: 'Dinastía Zhou', texto: 'Los Zhou derrocan a los Shang y gobiernan China durante ocho siglos.' },
  { desde: -980, hasta: -947, c: true, region: 'Levante', titulo: 'Hiram, rey de Tiro', texto: 'Tiro domina el comercio del Mediterráneo; su rey envía cedros y artesanos a David y a Salomón.', ref: '1ki.5.1' },
  { desde: -900, hasta: -200, c: true, region: 'América', titulo: 'Chavín de Huántar', texto: 'En los Andes del Perú se levanta el templo de piedra de la cultura Chavín.' },
  // El reino dividido
  { desde: -925, c: true, region: 'Egipto', titulo: 'Campaña de Sisac', texto: 'El faraón Sheshonq I (Sisac) invade Judá e Israel y lo graba en el templo de Karnak.', ref: '1ki.14.25' },
  { desde: -911, hasta: -609, region: 'Mesopotamia', titulo: 'Imperio asirio', texto: 'Asiria se convierte en la gran potencia del Oriente y cobra tributo a los reinos vecinos.' },
  { desde: -853, region: 'Mesopotamia', titulo: 'Batalla de Qarqar', texto: 'Salmanasar III de Asiria lucha contra una coalición en la que, según su inscripción, iba «Acab el israelita» con 2.000 carros.', ref: '1ki.22.1' },
  { desde: -841, region: 'Mesopotamia', titulo: 'El obelisco negro', texto: 'Salmanasar III muestra a Jehú, rey de Israel, postrado ante él pagando tributo.', ref: '2ki.9.13' },
  { desde: -840, c: true, region: 'Levante', titulo: 'Estela de Mesa', texto: 'Mesa, rey de Moab, celebra haberse librado del dominio de Omri y de su hijo.', ref: '2ki.3.4' },
  { desde: -840, c: true, region: 'Levante', titulo: 'Estela de Tel Dan', texto: 'Un rey arameo menciona la «casa de David»: la primera mención de David fuera de la Biblia.' },
  { desde: -814, c: true, region: 'Levante', titulo: 'Fundación de Cartago', texto: 'Colonos de Tiro fundan Cartago, en el norte de África.' },
  { desde: -776, region: 'Grecia', titulo: 'Primeros Juegos Olímpicos', texto: 'Fecha tradicional de los primeros juegos en honor de Zeus en Olimpia.' },
  { desde: -753, region: 'Roma', titulo: 'Fundación de Roma', texto: 'Fecha tradicional de la fundación de Roma por Rómulo.' },
  { desde: -750, c: true, region: 'Grecia', titulo: 'Homero', texto: 'Se ponen por escrito la Ilíada y la Odisea.' },
  { desde: -745, hasta: -727, region: 'Mesopotamia', titulo: 'Tiglat-pileser III', texto: 'El rey asirio (llamado Pul en la Biblia) conquista Siria y parte de Israel y deporta a sus habitantes.', ref: '2ki.15.29' },
  { desde: -722, region: 'Mesopotamia', titulo: 'Asiria toma Samaria', texto: 'Salmanasar V y Sargón II conquistan Samaria y deportan a las diez tribus del norte.', ref: '2ki.17.6' },
  // Judá solo
  { desde: -701, region: 'Mesopotamia', titulo: 'Senaquerib contra Judá', texto: 'Asiria destruye Laquis y sitia Jerusalén; su prisma dice que encerró a Ezequías «como a un pájaro en su jaula», pero no dice que la tomara.', ref: '2ki.18.13' },
  { desde: -668, hasta: -631, c: true, region: 'Mesopotamia', titulo: 'Biblioteca de Asurbanipal', texto: 'El rey asirio reúne en Nínive miles de tablillas, entre ellas la epopeya de Gilgamesh.' },
  { desde: -663, region: 'Egipto', titulo: 'Asiria saquea Tebas', texto: 'Asurbanipal destruye Tebas, la gran ciudad de Egipto (No-Amón en la Biblia).', ref: 'nam.3.8' },
  { desde: -612, region: 'Mesopotamia', titulo: 'Cae Nínive', texto: 'Babilonios y medos destruyen la capital de Asiria, como habían anunciado Nahúm y Sofonías.', ref: 'nam.3.7' },
  { desde: -609, region: 'Egipto', titulo: 'Necao en Meguido', texto: 'El faraón Necao II va en ayuda de Asiria; Josías le sale al paso y muere en Meguido.', ref: '2ki.23.29' },
  { desde: -605, region: 'Mesopotamia', titulo: 'Batalla de Carquemis', texto: 'Nabucodonosor derrota a Egipto y Babilonia queda como dueña de Siria y Palestina.', ref: 'jer.46.2' },
  { desde: -605, hasta: -562, region: 'Mesopotamia', titulo: 'Nabucodonosor II', texto: 'Hace de Babilonia la ciudad más grande del mundo, con la puerta de Ishtar y sus murallas.' },
  { desde: -597, region: 'Mesopotamia', titulo: 'La Crónica babilónica', texto: 'Una tablilla registra que Nabucodonosor tomó «la ciudad de Judá» y puso un rey de su elección.', ref: '2ki.24.10' },
  { desde: -594, c: true, region: 'Grecia', titulo: 'Leyes de Solón', texto: 'Solón reforma las leyes de Atenas y alivia las deudas de los campesinos.' },
  { desde: -585, region: 'Grecia', titulo: 'Tales de Mileto', texto: 'Según la tradición predice un eclipse de sol; con él empieza la filosofía griega.' },
  // El exilio
  { desde: -563, hasta: -483, c: true, region: 'India', titulo: 'Siddhartha Gautama (Buda)', texto: 'Según las fechas tradicionales, enseña en el norte de la India el camino que dará origen al budismo.' },
  { desde: -592, c: true, region: 'Mesopotamia', titulo: 'Tablillas de Joaquín', texto: 'Listas de raciones del palacio de Babilonia nombran a «Joaquín, rey de Judá» y a sus hijos, desterrados allí.', ref: '2ki.24.15' },
  { desde: -556, hasta: -539, region: 'Mesopotamia', titulo: 'Nabonido y Belsasar', texto: 'El último rey de Babilonia vive años en Arabia y deja el gobierno a su hijo Belsasar.', ref: 'dan.5.1' },
  { desde: -551, hasta: -479, region: 'China', titulo: 'Confucio', texto: 'El maestro chino enseña el respeto a los padres, la rectitud y el buen gobierno.' },
  { desde: -550, region: 'Persia', titulo: 'Ciro el Grande', texto: 'Ciro une a medos y persas y empieza a formar el mayor imperio visto hasta entonces.', ref: 'isa.45.1' },
  { desde: -539, region: 'Persia', titulo: 'Ciro toma Babilonia', texto: 'El cilindro de Ciro cuenta que permitió a los pueblos deportados volver a su tierra con sus dioses.', ref: 'ezr.1.1' },
  // Bajo Persia
  { desde: -525, region: 'Persia', titulo: 'Persia conquista Egipto', texto: 'Cambises, hijo de Ciro, anexa Egipto al imperio.' },
  { desde: -522, hasta: -486, region: 'Persia', titulo: 'Darío I', texto: 'Organiza el imperio en satrapías y construye Persépolis; en su segundo año se reanuda el templo de Jerusalén.', ref: 'ezr.4.24' },
  { desde: -509, region: 'Roma', titulo: 'Nace la República romana', texto: 'Roma expulsa a su último rey y se gobierna con cónsules y senado.' },
  { desde: -508, region: 'Grecia', titulo: 'Democracia en Atenas', texto: 'Las reformas de Clístenes dan el poder a la asamblea de los ciudadanos.' },
  { desde: -500, c: true, region: 'América', titulo: 'Monte Albán', texto: 'Los zapotecas fundan su capital sobre una montaña en el valle de Oaxaca.' },
  { desde: -490, region: 'Grecia', titulo: 'Batalla de Maratón', texto: 'Los atenienses detienen la primera invasión persa enviada por Darío.' },
  { desde: -486, hasta: -465, region: 'Persia', titulo: 'Jerjes I (Asuero)', texto: 'El rey del libro de Ester; entre su gran banquete y la elección de Ester invade Grecia.', ref: 'est.1.1' },
  { desde: -480, region: 'Grecia', titulo: 'Termópilas y Salamina', texto: 'Los griegos frenan a Jerjes en las Termópilas y vencen a su flota en Salamina.' },
  { desde: -465, hasta: -424, region: 'Persia', titulo: 'Artajerjes I', texto: 'Envía a Esdras (458 a.C.) y luego a su copero Nehemías (445 a.C.) a Jerusalén.', ref: 'neh.2.1' },
  { desde: -450, c: true, region: 'Grecia', titulo: 'Heródoto', texto: 'El «padre de la historia» escribe sobre las guerras entre griegos y persas.' },
  { desde: -447, hasta: -432, region: 'Grecia', titulo: 'El Partenón', texto: 'Bajo Pericles se construye el gran templo de la Acrópolis de Atenas.' },
  { desde: -431, hasta: -404, region: 'Grecia', titulo: 'Guerra del Peloponeso', texto: 'Atenas y Esparta se enfrentan durante casi treinta años.' },
  { desde: -399, region: 'Grecia', titulo: 'Muerte de Sócrates', texto: 'Atenas condena a muerte al filósofo, maestro de Platón.' },
  // Entre los testamentos
  { desde: -336, hasta: -323, region: 'Grecia', titulo: 'Alejandro Magno', texto: 'Conquista el Imperio persa, Egipto y llega hasta la India; Daniel lo había visto como el macho cabrío veloz.', ref: 'dan.8.21' },
  { desde: -323, region: 'Grecia', titulo: 'El imperio se reparte', texto: 'A la muerte de Alejandro sus generales se lo dividen: los Tolomeos en Egipto y los Seléucidas en Siria.', ref: 'dan.11.4' },
  { desde: -268, hasta: -232, c: true, region: 'India', titulo: 'Ashoka', texto: 'El emperador indio se convierte al budismo y graba sus edictos en columnas de piedra.' },
  { desde: -250, c: true, region: 'Egipto', titulo: 'La Septuaginta', texto: 'En Alejandría se traduce la Ley al griego; es el Antiguo Testamento que citarán muchos autores del Nuevo.' },
  { desde: -264, hasta: -146, region: 'Roma', titulo: 'Guerras púnicas', texto: 'Roma vence a Cartago y se adueña del Mediterráneo occidental.' },
  { desde: -221, region: 'China', titulo: 'China unificada', texto: 'Qin Shi Huang une China, inicia la Gran Muralla y se hace enterrar con su ejército de terracota.' },
  { desde: -167, region: 'Levante', titulo: 'Antíoco IV profana el templo', texto: 'El rey seléucida prohíbe la Ley y pone un altar pagano en el templo de Jerusalén.', ref: 'dan.11.31' },
  { desde: -164, region: 'Levante', titulo: 'Los macabeos', texto: 'Judas Macabeo recupera y purifica el templo; de ahí la fiesta de la Dedicación.', ref: 'jhn.10.22' },
  { desde: -63, region: 'Roma', titulo: 'Pompeyo toma Jerusalén', texto: 'Judea pasa a depender de Roma.' },
  { desde: -44, region: 'Roma', titulo: 'Asesinato de Julio César', texto: 'César muere a manos de senadores; poco después la República da paso al Imperio.' },
  { desde: -37, hasta: -4, region: 'Roma', titulo: 'Herodes el Grande', texto: 'Roma lo nombra rey de Judea; reconstruye el templo con gran esplendor.', ref: 'mat.2.1' },
  // Jesús y la iglesia primitiva
  { desde: -27, hasta: 14, region: 'Roma', titulo: 'César Augusto', texto: 'Primer emperador de Roma; su edicto de empadronamiento lleva a José y María a Belén.', ref: 'luk.2.1' },
  { desde: 14, hasta: 37, region: 'Roma', titulo: 'Tiberio', texto: 'En su año quince Juan el Bautista empieza a predicar.', ref: 'luk.3.1' },
  { desde: 26, hasta: 36, region: 'Roma', titulo: 'Poncio Pilato', texto: 'Gobernador de Judea; en 1961 se halló en Cesarea una piedra con su nombre.', ref: 'mat.27.2' },
  { desde: 41, hasta: 54, region: 'Roma', titulo: 'Claudio', texto: 'Hacia el 49 expulsa de Roma a los judíos; así llegan Aquila y Priscila a Corinto.', ref: 'act.18.2' },
  { desde: 51, hasta: 52, region: 'Grecia', titulo: 'Galión en Corinto', texto: 'Una inscripción de Delfos fecha su gobierno en Acaya, cuando Pablo compareció ante él.', ref: 'act.18.12' },
  { desde: 54, hasta: 68, region: 'Roma', titulo: 'Nerón', texto: 'Tras el incendio de Roma (64) persigue a los cristianos; según la tradición mueren Pedro y Pablo.' },
  { desde: 70, region: 'Roma', titulo: 'Destrucción del templo', texto: 'Tito toma Jerusalén y destruye el templo, como Jesús había anunciado.', ref: 'mat.24.2' },
  { desde: 79, region: 'Roma', titulo: 'El Vesubio', texto: 'La erupción del volcán sepulta Pompeya y Herculano.' },
  { desde: 81, hasta: 96, region: 'Roma', titulo: 'Domiciano', texto: 'Exige que se le llame «señor y dios»; en su tiempo Juan está desterrado en Patmos.', ref: 'rev.1.9' },
  { desde: 100, c: true, region: 'América', titulo: 'Teotihuacán', texto: 'En el valle de México empieza a levantarse la gran ciudad de la pirámide del Sol.' },
  { desde: 105, region: 'China', titulo: 'El papel', texto: 'Cai Lun presenta al emperador Han el papel hecho de corteza y trapos.' },
];

/**
 * Reinos e imperios que duran siglos: en la línea de tiempo forman la «corriente» de cada región, como en la
 * Carta sincronológica de Adams. Junto con los eventos de 150 años o más, cubren sin huecos grandes la historia
 * de cada región; los eventos largos no se repiten aquí.
 */
export const REINOS: Evento[] = [
  { desde: -2686, hasta: -2181, c: true, region: 'Egipto', titulo: 'Reino Antiguo', texto: 'La época de las pirámides: los faraones gobiernan desde Menfis.' },
  { desde: -1070, hasta: -525, c: true, region: 'Egipto', titulo: 'Egipto dividido', texto: 'Dinastías libias, nubias y saítas; Egipto pierde su imperio pero sigue mezclándose en la política de Israel y Judá.' },
  { desde: -525, hasta: -332, region: 'Egipto', titulo: 'Egipto persa', texto: 'Egipto es una provincia del Imperio persa hasta la llegada de Alejandro.' },
  { desde: -305, hasta: -30, region: 'Egipto', titulo: 'Los Tolomeos', texto: 'Los sucesores griegos de Alejandro gobiernan desde Alejandría; la última es Cleopatra.' },
  { desde: -30, hasta: 120, region: 'Egipto', titulo: 'Provincia romana', texto: 'Tras la muerte de Cleopatra, Egipto pasa a ser el granero de Roma.' },
  { desde: -3200, hasta: -2334, c: true, region: 'Mesopotamia', titulo: 'Ciudades de Sumer', texto: 'Uruk, Ur, Lagash y otras ciudades-estado se disputan el sur de Mesopotamia.' },
  { desde: -1894, hasta: -1595, c: true, region: 'Mesopotamia', titulo: 'Antigua Babilonia', texto: 'Babilonia crece hasta dominar Mesopotamia con Hammurabi; los hititas la saquean en 1595 a.C.' },
  { desde: -1595, hasta: -1155, c: true, region: 'Mesopotamia', titulo: 'Babilonia casita', texto: 'Los casitas gobiernan Babilonia durante más de cuatro siglos.' },
  { desde: -626, hasta: -539, region: 'Mesopotamia', titulo: 'Imperio babilónico', texto: 'Nabopolasar y Nabucodonosor hacen de Babilonia la heredera de Asiria; cae ante Ciro.' },
  { desde: -312, hasta: -141, region: 'Mesopotamia', titulo: 'Los seléucidas', texto: 'Herederos de Alejandro en Siria y Mesopotamia; uno de ellos, Antíoco IV, persigue a los judíos.' },
  { desde: -678, hasta: -550, c: true, region: 'Persia', titulo: 'Los medos', texto: 'Reino de los medos en el oeste de Irán; con Babilonia derriban a Asiria.' },
  { desde: -550, hasta: -330, region: 'Persia', titulo: 'Imperio persa', texto: 'De Ciro a Darío III, el mayor imperio visto hasta entonces; bajo él vuelven los judíos a Jerusalén.' },
  { desde: -247, hasta: 120, c: true, region: 'Persia', titulo: 'Los partos', texto: 'Desde Irán disputan a Roma el Oriente; partos estaban en Jerusalén en Pentecostés.', ref: 'act.2.9' },
  { desde: -2000, hasta: -1450, c: true, region: 'Grecia', titulo: 'Creta minoica', texto: 'Una civilización de palacios y comercio marítimo en la isla de Creta.' },
  { desde: -1100, hasta: -800, c: true, region: 'Grecia', titulo: 'Edad oscura griega', texto: 'Tras la caída de Micenas se pierde la escritura y las ciudades se despueblan.' },
  { desde: -800, hasta: -338, c: true, region: 'Grecia', titulo: 'Ciudades griegas', texto: 'Atenas, Esparta y cientos de polis independientes; nacen la filosofía, el teatro y la democracia.' },
  { desde: -323, hasta: -31, region: 'Grecia', titulo: 'Reinos helenísticos', texto: 'La lengua y la cultura griegas se extienden por todo el Oriente; el Nuevo Testamento se escribe en ese griego.' },
  { desde: -753, hasta: -509, region: 'Roma', titulo: 'Reyes de Roma', texto: 'Según la tradición, siete reyes gobiernan la pequeña ciudad del Tíber.' },
  { desde: -509, hasta: -27, region: 'Roma', titulo: 'República romana', texto: 'Cónsules y senado; Roma pasa de ciudad a dueña del Mediterráneo.' },
  { desde: -27, hasta: 120, region: 'Roma', titulo: 'Imperio romano', texto: 'Desde Augusto, los emperadores gobiernan el mundo en el que nace Jesús y se extiende la iglesia.', ref: 'luk.2.1' },
  { desde: -2000, hasta: -1200, c: true, region: 'Levante', titulo: 'Ciudades de Canaán', texto: 'Ciudades amuralladas con sus reyes, como Jericó, Hazor, Meguido y Jerusalén.', ref: 'jos.12.7' },
  { desde: -1200, hasta: -332, c: true, region: 'Levante', titulo: 'Fenicia', texto: 'Tiro y Sidón, ciudades de navegantes y comerciantes, hasta que Alejandro toma Tiro.' },
  { desde: -1000, hasta: -732, c: true, region: 'Levante', titulo: 'Arameos de Damasco', texto: 'El reino de Siria, vecino y a menudo enemigo de Israel, hasta que Asiria lo conquista.', ref: '2ki.16.9' },
  { desde: -140, hasta: -63, region: 'Levante', titulo: 'Los asmoneos', texto: 'Tras la revuelta de los macabeos, Judea es independiente por última vez hasta que llega Roma.' },
  { desde: -1650, hasta: -1178, c: true, region: 'Asia Menor', titulo: 'Los hititas', texto: 'Imperio de Anatolia rival de Egipto; la Biblia menciona a hititas en Canaán, como Urías.', ref: '2sa.11.3' },
  { desde: -680, hasta: -546, c: true, region: 'Asia Menor', titulo: 'Lidia', texto: 'El reino de Creso, donde se acuñan las primeras monedas; Ciro lo conquista.' },
  { desde: -600, hasta: -322, c: true, region: 'India', titulo: 'Reinos del Ganges', texto: 'Grandes reinos en el norte de la India; en ellos enseñan Buda y Mahavira.' },
  { desde: -322, hasta: -185, region: 'India', titulo: 'Imperio maurya', texto: 'Primer imperio de casi toda la India; su rey más famoso es Ashoka.' },
  { desde: -206, hasta: 120, region: 'China', titulo: 'Dinastía Han', texto: 'Cuatro siglos de gobierno; se abre la Ruta de la Seda hacia Occidente.' },
  { desde: -800, hasta: -50, c: true, region: 'Europa', titulo: 'Los celtas', texto: 'Pueblos celtas se extienden por Europa central y occidental, hasta que Julio César conquista la Galia.' },
];

/** Quién sucedió a quién (o lo conquistó): en la línea de tiempo, una rama que brota de otra. [antes, después] */
export const RAMAS: [string, string][] = [
  ['Reino Antiguo', 'Reino Medio de Egipto'],
  ['Reino Medio de Egipto', 'Reino Nuevo de Egipto'],
  ['Reino Nuevo de Egipto', 'Egipto dividido'],
  ['Egipto dividido', 'Egipto persa'],
  ['Los Tolomeos', 'Provincia romana'],
  ['Ciudades de Sumer', 'Imperio acadio'],
  ['Antigua Babilonia', 'Babilonia casita'],
  ['Imperio asirio', 'Imperio babilónico'],
  ['Imperio babilónico', 'Imperio persa'],
  ['Los medos', 'Imperio persa'],
  ['Lidia', 'Imperio persa'],
  ['Imperio persa', 'Egipto persa'],
  ['Imperio persa', 'Reinos helenísticos'],
  ['Ciudades griegas', 'Reinos helenísticos'],
  ['Reinos helenísticos', 'Los Tolomeos'],
  ['Reinos helenísticos', 'Los seléucidas'],
  ['Los seléucidas', 'Los asmoneos'],
  ['Los seléucidas', 'Los partos'],
  ['Los asmoneos', 'Imperio romano'],
  ['Creta minoica', 'Grecia micénica'],
  ['Grecia micénica', 'Edad oscura griega'],
  ['Edad oscura griega', 'Ciudades griegas'],
  ['Reyes de Roma', 'República romana'],
  ['República romana', 'Imperio romano'],
  ['Ciudades de Canaán', 'Fenicia'],
  ['Los Vedas', 'Reinos del Ganges'],
  ['Reinos del Ganges', 'Imperio maurya'],
  ['Dinastía Shang', 'Dinastía Zhou'],
  ['Dinastía Zhou', 'Dinastía Han'],
];

/** El tronco de la historia bíblica: raíz sin fechas, el reino que se divide, el destierro y el regreso. */
export type Tramo = {
  desde: number;
  hasta: number;
  /** Dónde va la rama: en el centro del tronco o, cuando se divide, arriba (norte) o abajo (sur). */
  pos: 'medio' | 'arriba' | 'abajo';
  /** De dónde brota (si cambia de altura al empezar). */
  brotaDe?: 'medio' | 'arriba' | 'abajo';
  titulo?: string;
  punteado?: boolean;
  /** Termina en punta: el reino desaparece. */
  punta?: boolean;
};

export const TRONCO: Tramo[] = [
  { desde: -3200, hasta: -2091, pos: 'medio', punteado: true },
  { desde: -2091, hasta: -931, pos: 'medio' },
  { desde: -931, hasta: -722, pos: 'arriba', brotaDe: 'medio', titulo: 'Israel, reino del norte', punta: true },
  { desde: -931, hasta: -586, pos: 'abajo', brotaDe: 'medio', titulo: 'Judá, reino del sur', punta: true },
  { desde: -586, hasta: -538, pos: 'medio', brotaDe: 'abajo', titulo: 'Destierro', punteado: true },
  { desde: -538, hasta: 120, pos: 'medio' },
];

/** Los eventos de 150 años o más se dibujan como corriente, igual que los reinos. */
export const esCorriente = (e: Evento) => (e.hasta ?? e.desde) - e.desde >= 150;

export type Era = { titulo: string; desde: number; hasta: number; color: string };

export const ERAS: Era[] = [
  { titulo: 'Las primeras civilizaciones', desde: -3200, hasta: -2100, color: '#8C8C8C' },
  { titulo: 'Los patriarcas', desde: -2100, hasta: -1805, color: '#B07D3C' },
  { titulo: 'Israel en Egipto', desde: -1805, hasta: -1446, color: '#C08A2E' },
  { titulo: 'Éxodo, desierto y conquista', desde: -1446, hasta: -1380, color: '#A86B32' },
  { titulo: 'Los jueces', desde: -1380, hasta: -1050, color: '#7C8B3A' },
  { titulo: 'El reino unido', desde: -1050, hasta: -931, color: '#8A4B2A' },
  { titulo: 'El reino dividido', desde: -931, hasta: -722, color: '#7D5BA6' },
  { titulo: 'Judá solo', desde: -722, hasta: -586, color: '#5B6BA6' },
  { titulo: 'El exilio', desde: -586, hasta: -538, color: '#4A5568' },
  { titulo: 'Bajo Persia', desde: -538, hasta: -332, color: '#2E8B83' },
  { titulo: 'Entre los testamentos', desde: -332, hasta: -6, color: '#3B6FB6' },
  { titulo: 'Jesús', desde: -6, hasta: 30, color: '#B03A2E' },
  { titulo: 'La iglesia primitiva', desde: 30, hasta: 110, color: '#C0392B' },
];

/** Periodo de un capítulo. */
export function periodoDe(book: string, chapter: number): Periodo | undefined {
  const t = TRAMOS.find(([b, a, z]) => b === book && chapter >= a && chapter <= z);
  return t ? PERIODOS[t[3]] : undefined;
}

const fin = (e: Evento) => e.hasta ?? e.desde;

/** Distancia en años entre un evento y un periodo (0 si se solapan). */
function distancia(e: Evento, desde: number, hasta: number) {
  if (fin(e) < desde) return desde - fin(e);
  if (e.desde > hasta) return e.desde - hasta;
  return 0;
}

/** Eventos del mundo en los años del periodo; si hay pocos, los más cercanos. Ordenados por fecha. */
export function eventosDe(periodo: Periodo, max = 6): Evento[] {
  const { desde, hasta } = periodo;
  const margen = Math.max(25, (hasta - desde) * 0.25);
  const ranked = EVENTOS.map((e) => ({ e, d: distancia(e, desde, hasta) }))
    .filter(({ d }) => d <= 250)
    .sort((a, b) => a.d - b.d || Number(!!b.e.ref) - Number(!!a.e.ref));
  const cerca = ranked.filter(({ d }) => d <= margen);
  const elegidos = (cerca.length >= 3 ? cerca : ranked.slice(0, 4)).slice(0, max).map(({ e }) => e);
  return elegidos.sort((a, b) => a.desde - b.desde);
}

/** «1010 a.C.», «30 d.C.». */
export function año(y: number) {
  return y < 0 ? `${-y} a.C.` : `${y} d.C.`;
}

/** «c. 1010–970 a.C.», «6 a.C.–30 d.C.», «c. 1446 a.C.». */
export function rango(desde: number, hasta = desde, c = false) {
  const pre = c ? 'c. ' : '';
  if (desde === hasta) return pre + año(desde);
  if (desde < 0 && hasta < 0) return `${pre}${-desde}–${-hasta} a.C.`;
  if (desde > 0 && hasta > 0) return `${pre}${desde}–${hasta} d.C.`;
  return `${pre}${año(desde)}–${año(hasta)}`;
}

export const fechaPeriodo = (p: Periodo) => (p.sinFecha ? 'Sin fecha' : rango(p.desde, p.hasta, p.desde < -1000));

export const fechaEvento = (e: Evento) => rango(e.desde, e.hasta, e.c);

export const FUENTE_HISTORIA =
  'Fechas bíblicas según la cronología conservadora habitual (éxodo c. 1446 a.C. y reyes según E. R. Thiele); ' +
  'eventos del mundo con las fechas de la historia académica. Todas las fechas antiguas son aproximadas.';
