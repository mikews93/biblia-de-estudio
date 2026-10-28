// «Del diccionario bíblico»: las palabras en español que abren una entrada de los diccionarios de Easton y Smith o un
// tema del índice de Nave (pipeline/build_diccionario.py). La tarjeta del buscador la explica en español, escrita una
// vez con IA y guardada para todos (api/comentario.ts). Sin dependencias de la app: también la lee el servidor.
// Las personas y los lugares con ficha no van aquí: el buscador ya enseña su ficha.

import { sinAcentos } from './preguntarTexto';

/** [id, nombre, otros nombres, entrada de Easton y Smith, tema de Nave]. El id es la llave de lo guardado: no cambiarlo. */
type Fila = [string, string, string[], string | null, string | null];

const FILAS: Fila[] = [
  ['gracia', 'Gracia', [], 'GRACE', 'GRACE OF GOD'],
  ['fe', 'Fe', [], 'FAITH', 'FAITH'],
  ['esperanza', 'Esperanza', [], 'HOPE', 'HOPE'],
  ['amor', 'Amor', ['caridad'], 'LOVE', 'LOVE'],
  ['perdon', 'Perdón', ['perdonar'], 'FORGIVENESS OF SIN', 'FORGIVENESS'],
  ['arrepentimiento', 'Arrepentimiento', ['arrepentirse'], 'REPENTANCE', 'REPENTANCE'],
  ['justificacion', 'Justificación', [], 'JUSTIFICATION', 'JUSTIFICATION'],
  ['santificacion', 'Santificación', [], 'SANCTIFICATION', 'SANCTIFICATION'],
  ['redencion', 'Redención', ['redentor'], 'REDEMPTION', 'REDEMPTION'],
  ['expiacion', 'Expiación', [], 'ATONEMENT', 'ATONEMENT'],
  ['propiciacion', 'Propiciación', [], 'PROPITIATION', 'PROPITIATION'],
  ['reconciliacion', 'Reconciliación', [], 'RECONCILATION', 'RECONCILIATION'],
  ['salvacion', 'Salvación', [], 'SALVATION', 'SALVATION'],
  ['eleccion', 'Elección', [], 'ELECTION OF GRACE', 'ELECTION'],
  ['predestinacion', 'Predestinación', [], 'PREDESTINATION', 'PREDESTINATION'],
  ['adopcion', 'Adopción', [], 'ADOPTION', 'ADOPTION'],
  ['regeneracion', 'Regeneración', ['nuevo nacimiento', 'nacer de nuevo'], 'REGENERATION', 'REGENERATION'],
  ['pacto', 'Pacto', ['alianza'], 'COVENANT', 'COVENANT'],
  ['ley', 'Ley', ['la ley'], 'LAW', 'LAW'],
  ['pecado', 'Pecado', [], 'SIN', 'SIN'],
  ['oracion', 'Oración', ['orar'], 'PRAYER', 'PRAYER'],
  ['ayuno', 'Ayuno', ['ayunar'], 'FAST', 'FASTING'],
  ['bautismo', 'Bautismo', ['bautizar'], 'BAPTISM', 'BAPTISM'],
  ['cena-del-senor', 'Cena del Señor', ['santa cena', 'comunión', 'eucaristía'], 'LORDS SUPPER', 'LORDS SUPPER'],
  ['iglesia', 'Iglesia', [], 'CHURCH', 'CHURCH'],
  ['reino-de-dios', 'Reino de Dios', ['reino de los cielos'], 'KINGDOM OF GOD', 'KINGDOM OF HEAVEN'],
  ['evangelio', 'Evangelio', [], 'GOSPEL', 'GOSPEL'],
  ['apostol', 'Apóstol', ['apóstoles'], 'APOSTLE', 'APOSTLE'],
  ['profeta', 'Profeta', ['profetas'], 'PROPHET', 'PROPHETS'],
  ['profecia', 'Profecía', [], 'PROPHECY', 'PROPHECY'],
  ['sacerdote', 'Sacerdote', ['sacerdotes', 'sacerdocio'], 'PRIEST', 'PRIEST'],
  ['sumo-sacerdote', 'Sumo sacerdote', [], 'HIGH PRIEST', 'HIGH PRIEST'],
  ['levitas', 'Levitas', ['levita'], 'LEVITES', 'LEVITES'],
  ['anciano', 'Anciano', ['ancianos'], 'ELDER', 'ELDER'],
  ['diacono', 'Diácono', ['diáconos'], 'DEACON', 'DEACON'],
  ['obispo', 'Obispo', [], 'BISHOP', 'BISHOP'],
  ['angel', 'Ángel', ['ángeles'], 'ANGEL', 'ANGEL (A SPIRIT)'],
  ['querubin', 'Querubín', ['querubines'], 'CHERUB', 'CHERUB'],
  ['serafin', 'Serafín', ['serafines'], 'SERAPHIM', 'SERAPHIM (SERAPHS)'],
  ['satanas', 'Satanás', [], 'SATAN', 'SATAN'],
  ['diablo', 'Diablo', [], 'DEVIL', 'DEVIL'],
  ['demonios', 'Demonios', ['demonio'], 'DEMON', 'DEMONS'],
  ['infierno', 'Infierno', [], 'HELL', 'HELL'],
  ['cielo', 'Cielo', ['el cielo'], 'HEAVEN', 'HEAVEN'],
  ['hades', 'Hades', ['seol'], 'HADES', 'HADES'],
  ['paraiso', 'Paraíso', [], 'PARADISE', 'PARADISE'],
  ['resurreccion', 'Resurrección', [], 'RESURRECTION OF THE DEAD', 'RESURRECTION'],
  ['juicio-final', 'Juicio final', ['el juicio'], 'JUDGMENT, THE FINAL', 'JUDGMENT'],
  ['anticristo', 'Anticristo', [], 'ANTICHRIST', 'ANTICHRIST'],
  ['milenio', 'Milenio', [], 'MILLENNIUM', 'MILLENNIUM'],
  ['trinidad', 'Trinidad', [], 'TRINITY', 'TRINITY'],
  ['espiritu-santo', 'Espíritu Santo', [], 'HOLY GHOST', 'HOLY SPIRIT'],
  ['mesias', 'Mesías', [], 'MESSIAH', 'MESSIAH'],
  ['cristo', 'Cristo', [], 'CHRIST', 'CHRIST'],
  ['emanuel', 'Emanuel', [], 'IMMANUEL', 'IMMANUEL'],
  ['hijo-del-hombre', 'Hijo del Hombre', [], 'SON OF MAN', null],
  ['cordero-de-dios', 'Cordero de Dios', [], 'LAMB', 'LAMB OF GOD'],
  ['encarnacion', 'Encarnación', [], 'INCARNATION', 'INCARNATION'],
  ['transfiguracion', 'Transfiguración', [], 'TRANSFIGURATION, THE', 'TRANSFIGURATION'],
  ['ascension', 'Ascensión', [], 'ASCENSION', 'ASCENSION'],
  ['santidad', 'Santidad', ['santo'], 'HOLINESS', 'HOLINESS'],
  ['gloria', 'Gloria', [], 'GLORY', 'GLORY'],
  ['alabanza', 'Alabanza', ['alabar'], null, 'PRAISE'],
  ['adoracion', 'Adoración', ['adorar'], 'WORSHIP', 'WORSHIP'],
  ['diezmo', 'Diezmo', ['diezmos'], 'TITHE', 'TITHES'],
  ['ofrenda', 'Ofrenda', ['ofrendas'], 'OFFERING', 'OFFERINGS'],
  ['sacrificio', 'Sacrificio', ['sacrificios'], 'SACRIFICE', 'SACRIFICES'],
  ['holocausto', 'Holocausto', [], 'BURNT OFFERING', 'BURNT OFFERING'],
  ['pascua', 'Pascua', [], 'PASSOVER', 'PASSOVER'],
  ['pentecostes', 'Pentecostés', [], 'PENTECOST', 'PENTECOST'],
  ['fiesta-de-los-tabernaculos', 'Fiesta de los Tabernáculos', ['fiesta de las cabañas'], 'TABERNACLES, FEAST OF', 'TABERNACLES, FEAST OF'],
  ['dia-de-la-expiacion', 'Día de la Expiación', [], 'ATONEMENT, DAY OF', 'ATONEMENT'],
  ['dia-de-reposo', 'Día de reposo', ['sábado', 'shabat'], 'SABBATH', 'SABBATH'],
  ['jubileo', 'Jubileo', [], 'JUBILEE', 'JUBILEE'],
  ['circuncision', 'Circuncisión', [], 'CIRCUMCISION', 'CIRCUMCISION'],
  ['tabernaculo', 'Tabernáculo', ['tienda de reunión'], 'TABERNACLE', 'TABERNACLE'],
  ['templo', 'Templo', ['el templo'], 'TEMPLE', 'TEMPLE'],
  ['arca-del-pacto', 'Arca del pacto', ['arca de la alianza', 'arca del testimonio'], 'ARK OF THE COVENANT', 'ARK'],
  ['arca-de-noe', 'Arca de Noé', [], 'ARK', 'ARK'],
  ['propiciatorio', 'Propiciatorio', [], 'MERCY-SEAT', 'MERCY-SEAT'],
  ['efod', 'Efod', [], 'EPHOD', 'EPHOD'],
  ['urim-y-tumim', 'Urim y Tumim', [], 'URIM AND THUMMIM', 'URIM AND THUMMIM'],
  ['mana', 'Maná', [], 'MANNA', 'MANNA'],
  ['candelero', 'Candelero', ['menorá'], 'CANDLESTICK', 'CANDLESTICK'],
  ['altar', 'Altar', [], 'ALTAR', 'ALTAR'],
  ['velo-del-templo', 'Velo del templo', ['velo'], 'VEIL', 'VEIL'],
  ['sinagoga', 'Sinagoga', [], 'SYNAGOGUE', 'SYNAGOGUE'],
  ['sanedrin', 'Sanedrín', ['concilio'], 'SANHEDRIM', 'SANHEDRIN'],
  ['fariseos', 'Fariseos', ['fariseo'], 'PHARISEES', 'PHARISEES'],
  ['saduceos', 'Saduceos', ['saduceo'], 'SADDUCEES', 'SADDUCEES'],
  ['escribas', 'Escribas', ['escriba'], 'SCRIBES', 'SCRIBE (S)'],
  ['publicanos', 'Publicanos', ['publicano', 'recaudadores de impuestos'], 'PUBLICAN', 'PUBLICANS'],
  ['samaritanos', 'Samaritanos', ['samaritano'], 'SAMARITANS', 'SAMARIA'],
  ['gentiles', 'Gentiles', [], 'GENTILES', 'GENTILES'],
  ['nazareo', 'Nazareo', ['voto de nazareo'], 'NAZARITE', 'NAZARITE'],
  ['esenios', 'Esenios', [], 'ESSENES', null],
  ['herodianos', 'Herodianos', [], 'HERODIANS', 'HERODIANS'],
  ['zelotes', 'Zelotes', ['zelote'], 'ZEALOTS', null],
  ['filisteos', 'Filisteos', [], 'PHILISTINES', 'PHILISTINES'],
  ['cananeos', 'Cananeos', [], 'CANAANITES', 'CANAANITES'],
  ['getsemani', 'Getsemaní', [], 'GETHSEMANE', 'GETHSEMANE'],
  ['golgota', 'Gólgota', [], 'GOLGOTHA', 'GOLGOTHA'],
  ['calvario', 'Calvario', [], 'CALVARY', 'CALVARY'],
  ['monte-de-los-olivos', 'Monte de los Olivos', [], 'OLIVES, MOUNT OF', 'OLIVES, MOUNT OF'],
  ['aceite', 'Aceite', [], 'OIL', 'OIL'],
  ['uncion', 'Unción', ['ungir'], 'ANOINT', 'ANOINTING'],
  ['vino', 'Vino', [], 'WINE', 'WINE'],
  ['levadura', 'Levadura', [], 'LEAVEN', 'LEAVEN (YEAST)'],
  ['panes-sin-levadura', 'Panes sin levadura', ['pan sin levadura', 'ázimos'], 'BREAD', 'UNLEAVENED BREAD'],
  ['panes-de-la-proposicion', 'Panes de la proposición', [], 'SHEWBREAD', 'SHEWBREAD (SHOWBREAD)'],
  ['incienso', 'Incienso', [], 'INCENSE', 'INCENSE'],
  ['mirra', 'Mirra', [], 'MYRRH', 'MYRRH'],
  ['denario', 'Denario', [], 'PENNY', 'PENNY'],
  ['talento', 'Talento', [], 'TALENT', 'TALENT'],
  ['siclo', 'Siclo', [], 'SHEKEL', 'SHEKEL'],
  ['codo', 'Codo', [], 'CUBIT', 'CUBIT'],
  ['parabola', 'Parábola', ['parábolas'], 'PARABLE', 'PARABLES'],
  ['milagro', 'Milagro', ['milagros'], 'MIRACLE', 'MIRACLES'],
  ['vision', 'Visión', ['visiones'], 'VISION', 'VISION'],
  ['suenos', 'Sueños', ['sueño'], 'DREAM', 'DREAM'],
  ['lepra', 'Lepra', ['leproso'], 'LEPROSY', 'LEPROSY'],
  ['cruz', 'Cruz', [], 'CROSS', 'CROSS'],
  ['crucifixion', 'Crucifixión', ['crucificar'], 'CRUCIFIXION', 'CRUCIFIXION'],
  ['sepulcro', 'Sepulcro', ['tumba'], 'SEPULCHRE', 'SEPULCHRE'],
  ['pastor', 'Pastor', ['pastores'], 'SHEPHERD', 'SHEPHERD'],
  ['vina', 'Viña', [], null, 'VINEYARD'],
  ['higuera', 'Higuera', [], 'FIG, FIG TREE', 'FIG TREE'],
  ['olivo', 'Olivo', [], 'OLIVE', 'OLIVE'],
  ['cizana', 'Cizaña', [], 'TARES', 'TARES'],
  ['mostaza', 'Mostaza', ['grano de mostaza'], 'MUSTARD', 'MUSTARD'],
  ['cilicio', 'Cilicio', [], 'SACKCLOTH', 'SACKCLOTH'],
  ['filacterias', 'Filacterias', ['filacteria'], 'PHYLACTERY', 'PHYLACTERY'],
  ['primogenito', 'Primogénito', ['primogenitura'], 'FIRST-BORN', 'FIRSTBORN'],
  ['herencia', 'Herencia', [], 'INHERITANCE', 'INHERITANCE'],
  ['esclavitud', 'Esclavitud', ['esclavo'], 'SLAVE', 'SLAVERY'],
  ['matrimonio', 'Matrimonio', ['casamiento', 'boda'], 'MARRIAGE', 'MARRIAGE'],
  ['divorcio', 'Divorcio', [], 'DIVORCE', 'DIVORCE'],
  ['viudas', 'Viudas', ['viuda'], 'WIDOW', 'WIDOW'],
  ['hospitalidad', 'Hospitalidad', [], 'HOSPITALITY', 'HOSPITALITY'],
  ['hipocresia', 'Hipocresía', ['hipócrita'], 'HYPOCRITE', 'HYPOCRISY'],
  ['idolatria', 'Idolatría', ['ídolos', 'ídolo'], 'IDOLATRY', 'IDOLATRY'],
  ['baal', 'Baal', [], 'BAAL', 'BAAL'],
  ['moloc', 'Moloc', [], 'MOLECH', 'MOLECH'],
  ['diluvio', 'Diluvio', [], 'DELUGE', 'DELUGE'],
  ['torre-de-babel', 'Torre de Babel', ['babel'], 'BABEL, TOWER OF', 'BABEL'],
  ['exodo', 'Éxodo', ['salida de Egipto'], 'EXODUS', 'EXODUS'],
  ['cautiverio', 'Cautiverio', ['exilio', 'destierro'], 'CAPTIVITY', 'CAPTIVITY'],
  ['dispersion', 'Dispersión', ['diáspora'], 'DISPERSION', 'DISPERSION'],
  ['septuaginta', 'Septuaginta', [], 'SEPTUAGINT', null],
  ['canon', 'Canon', ['canon bíblico'], 'CANON OF SCRIPTURE, THE', null],
  ['apocrifos', 'Apócrifos', [], 'APOCRYPHA', null],
  ['biblia', 'Biblia', ['la biblia'], 'BIBLE', 'BIBLE'],
  ['inspiracion', 'Inspiración', ['inspiración de la biblia'], 'INSPIRATION', 'INSPIRATION'],
  ['discipulo', 'Discípulo', ['discípulos'], 'DISCIPLE', 'DISCIPLE'],
  ['misericordia', 'Misericordia', [], 'MERCY', 'MERCY'],
  ['paz', 'Paz', [], null, 'PEACE'],
  ['gozo', 'Gozo', ['alegría'], null, 'JOY'],
  ['paciencia', 'Paciencia', [], null, 'PATIENCE'],
  ['humildad', 'Humildad', [], 'HUMILITY', 'HUMILITY'],
  ['orgullo', 'Orgullo', ['soberbia'], null, 'PRIDE'],
  ['envidia', 'Envidia', [], null, 'ENVY'],
  ['ira', 'Ira', ['enojo'], 'ANGER', 'ANGER'],
  ['ansiedad', 'Ansiedad', ['preocupación', 'afán'], null, 'CARE'],
  ['temor-de-dios', 'Temor de Dios', [], 'FEAR OF THE LORD THE', 'FEAR'],
  ['conciencia', 'Conciencia', [], 'CONSCIENCE', 'CONSCIENCE'],
  ['alma', 'Alma', [], null, 'SOUL'],
  ['carne', 'Carne', [], 'FLESH', 'FLESH'],
  ['corazon', 'Corazón', [], 'HEART', 'HEART'],
  ['muerte', 'Muerte', [], 'DEATH', 'DEATH'],
  ['vida-eterna', 'Vida eterna', [], 'ETERNAL LIFE', 'ETERNAL LIFE'],
  ['providencia', 'Providencia', [], 'PROVIDENCE', 'PROVIDENCE'],
  ['jehova', 'Jehová', ['yahveh', 'yahweh'], 'JEHOVAH', null],
  ['aleluya', 'Aleluya', [], 'HALLELUJAH', 'HALLELUJAH'],
  ['amen', 'Amén', [], 'AMEN', 'AMEN'],
  ['hosanna', 'Hosanna', [], 'HOSANNA', 'HOSANNA'],
  ['selah', 'Selah', [], 'SELAH', null],
  ['maranata', 'Maranata', [], 'MARANATHA', null],
  ['abba', 'Abba', [], 'ABBA', 'ABBA'],
  ['rabi', 'Rabí', ['rabino'], 'RABBI', 'RABBI'],
  ['corban', 'Corbán', [], 'CORBAN', 'CORBAN'],
  ['mamon', 'Mamón', ['riquezas'], 'MAMMON', 'MAMMON'],
  ['gehena', 'Gehena', [], 'GEHENNA', 'GEHENNA'],
  ['seno-de-abraham', 'Seno de Abraham', [], 'ABRAHAMS BOSOM', null],
  ['tentacion', 'Tentación', ['tentaciones'], 'TEMPTATION', 'TEMPTATION'],
  ['obediencia', 'Obediencia', [], null, 'OBEDIENCE'],
  ['verdad', 'Verdad', [], 'TRUTH', 'TRUTH'],
  ['sabiduria', 'Sabiduría', [], null, 'WISDOM'],
  ['bendicion', 'Bendición', ['bendiciones'], 'BLESS', 'BLESSING'],
  ['maldicion', 'Maldición', [], 'CURSE', 'CURSE'],
  ['pobreza', 'Pobreza', ['pobres', 'ayuda a los pobres'], 'POOR', 'POOR'],
  ['generosidad', 'Generosidad', ['dadivoso'], null, 'LIBERALITY'],
  ['juramento', 'Juramento', ['jurar'], 'OATH', 'OATH'],
  ['voto', 'Voto', ['promesa a Dios'], 'VOWS', 'VOWS'],
  ['hijos', 'Hijos', ['niños'], 'CHILDREN', 'CHILDREN'],
  ['padres', 'Padres', [], null, 'PARENTS'],
  ['trabajo', 'Trabajo', [], null, 'INDUSTRY'],
  ['dinero', 'Dinero', [], 'MONEY', 'MONEY'],
  ['enfermedad', 'Enfermedad', ['enfermos'], 'DISEASES', 'DISEASE'],
  ['sanidad', 'Sanidad', ['sanar', 'curación'], null, 'SICKNESS'],
  ['duelo', 'Duelo', ['luto'], 'MOURNING', 'MOURNING'],
];

export type Palabra = { id: string; nombre: string; otros: string[]; entrada: string | null; tema: string | null };

export const PALABRAS: Palabra[] = FILAS.map(([id, nombre, otros, entrada, tema]) => ({ id, nombre, otros, entrada, tema }));

const porNombre = new Map<string, Palabra>();
for (const p of PALABRAS) for (const n of [p.nombre, ...p.otros]) if (!porNombre.has(sinAcentos(n))) porNombre.set(sinAcentos(n), p);

export const palabraPorId = (id: string) => PALABRAS.find((p) => p.id === id);

// «qué es la gracia», «qué significa propiciación», «quiénes eran los fariseos», «qué era el efod»
const PREGUNTA =
  /^(?:que (?:es|son|era|eran|fue|fueron|significa|quiere decir)|quien(?:es)? (?:es|son|era|eran|fue|fueron)|que dice la biblia (?:sobre|de|del|acerca de)|que es eso de|significado de)\s+(?:(?:el|la|los|las|un|una|lo|la palabra)\s+)?(.+?)(?: en la biblia| segun la biblia| biblico| biblica)?$/;

/** La palabra del diccionario que se busca: lo escrito tal cual («Getsemaní») o dentro de una pregunta corta. */
export function palabraDe(texto: string): Palabra | undefined {
  const t = sinAcentos(texto).replace(/^(el|la|los|las) /, '');
  const directa = porNombre.get(t);
  if (directa) return directa;
  const m = t.match(PREGUNTA);
  return m ? porNombre.get(m[1].replace(/^(el|la|los|las) /, '')) : undefined;
}

// Para la pregunta «¿Qué dice la Biblia sobre la gracia?»: las que van sin artículo, las palabras que se citan y las que
// la regla de abajo no acierta.
const SIN_ARTICULO = new Set(['Getsemaní', 'Gólgota', 'Calvario', 'Satanás', 'Baal', 'Moloc', 'Jehová', 'Emanuel', 'Cristo', 'Mamón', 'Gehena', 'Pentecostés']);
const PALABRA = new Set(['Aleluya', 'Amén', 'Hosanna', 'Selah', 'Maranata', 'Abba', 'Corbán', 'Rabí']);
const ARTICULO: Record<string, string> = {
  Profeta: 'el profeta',
  Levitas: 'los levitas',
  Escribas: 'los escribas',
  'Arca del pacto': 'el arca del pacto',
  'Arca de Noé': 'el arca de Noé',
  Alma: 'el alma',
  'Torre de Babel': 'la torre de Babel',
  Hades: 'el Hades',
  Pascua: 'la Pascua',
  'Espíritu Santo': 'el Espíritu Santo',
  'Hijo del Hombre': 'el Hijo del Hombre',
  'Cordero de Dios': 'el Cordero de Dios',
  Trinidad: 'la Trinidad',
  Biblia: 'la Biblia',
  Septuaginta: 'la Septuaginta',
  Mesías: 'el Mesías',
  'Urim y Tumim': 'el Urim y el Tumim',
};
const FEMENINAS = new Set(['fe', 'ley', 'paz', 'cruz', 'muerte', 'carne']);
const MASCULINAS = new Set(['día', 'maná']);

/** «Gracia» → «la gracia»; «Fariseos» → «los fariseos»; «Getsemaní» → «Getsemaní». */
export function conArticulo(nombre: string): string {
  if (SIN_ARTICULO.has(nombre)) return nombre;
  if (PALABRA.has(nombre)) return `la palabra «${nombre.toLowerCase()}»`;
  if (ARTICULO[nombre]) return ARTICULO[nombre];
  const n = nombre[0].toLowerCase() + nombre.slice(1);
  const primera = sinAcentos(n.split(' ')[0]);
  const raw = n.split(' ')[0];
  const plural = /[^aeiou]es$|[aeiou]s$/.test(primera) && !/(is|us)$/.test(primera);
  const singular = plural ? primera.replace(/(ion|dad)es$/, '$1').replace(/s$/, '') : primera;
  const femenino = FEMENINAS.has(raw) || (!MASCULINAS.has(raw) && /(a|ion|dad|tud|umbre)$/.test(singular));
  return `${plural ? (femenino ? 'las' : 'los') : femenino ? 'la' : 'el'} ${n}`;
}

/** Lo que la tarjeta enseña, escrito por la IA desde las fuentes (api/comentario.ts). */
export type Explicacion = {
  /** Dos o tres frases sencillas. */
  breve: string;
  /** Unos párrafos cortos más, para «Leer más». */
  mas: string[];
  /** Aspectos del tema con sus pasajes, de las citas de las fuentes. */
  pasajes: { tema: string; refs: string[] }[];
  fuentes: ('easton' | 'smith' | 'nave')[];
};
