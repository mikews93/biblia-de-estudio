// Qué icono lleva cada acontecimiento o época de la línea de tiempo, según lo que cuenta.
import type { Evento, Periodo } from './historia';

export type Icono =
  | 'corona'
  | 'espada'
  | 'pergamino'
  | 'pluma'
  | 'estela'
  | 'templo'
  | 'piramide'
  | 'muralla'
  | 'ciudad'
  | 'lampara'
  | 'barco'
  | 'fuego'
  | 'laurel'
  | 'shofar'
  | 'tienda'
  | 'montana'
  | 'olas'
  | 'arpa'
  | 'espiga'
  | 'cadena'
  | 'estrella'
  | 'cruz'
  | 'paloma'
  | 'punto';

// La primera regla que encaja gana: lo más concreto va antes que lo general.
const REGLAS_EVENTO: [RegExp, Icono][] = [
  [/Vesubio|incendio/i, 'fuego'],
  [/Olímpicos/i, 'laurel'],
  [/estela|obelisco|cilindro|prisma|inscripción|piedra con su nombre/i, 'estela'],
  [/escritura|tablillas?|archivos|biblioteca|Vedas|Homero|Septuaginta|Crónica|código|alfabeto|papel|Heródoto|leyes de/i, 'pergamino'],
  [/templo|zigurat|Dedicación/i, 'templo'],
  [/Pirámide|Stonehenge|Partenón|palacios|Chavín|Monte Albán|Teotihuacán|Gran Muralla|cabezas colosales/i, 'piramide'],
  [/filósofo|filosofía|Buda|Confucio|Sócrates|democracia|Solón|enseña/i, 'lampara'],
  [/expedicion|colonos|navegantes|marítimo|comercio del Mediterráneo/i, 'barco'],
  [/batalla|guerra|conquist|saque|toma|cae |caída|destru|invad|sitia|Termópilas|Maratón|campaña|derrota|profana|colapso|asesin|macabeos|persigue/i, 'espada'],
  [/funda|Cartago|ciudad/i, 'ciudad'],
  [/rey|reina|faraón|emperador|dinastía|imperio|reino|César|gobierna|Herodes|Pilato|Galión|sátrap|unifica|une /i, 'corona'],
];

const REGLAS_PERIODO: [RegExp, Icono][] = [
  [/^Cuando se escribi|Crónicas|Cartas? /, 'pluma'],
  [/Nacimiento de Jesús/, 'estrella'],
  [/Muerte y resurrección/, 'cruz'],
  [/iglesia|evangelio|Concilio/, 'paloma'],
  [/viaje/i, 'barco'],
  [/preso|prisión|exilio|desterrados/, 'cadena'],
  [/Patmos/, 'shofar'],
  [/Salmos/, 'arpa'],
  [/Rut/, 'espiga'],
  [/plagas|salida de Egipto/, 'olas'],
  [/Sinaí|desierto|Moisés/, 'montana'],
  [/Abraham|Isaac|Jacob|José|Job|crece en Egipto/, 'tienda'],
  [/muros/, 'muralla'],
  [/templo/, 'templo'],
  [/conquista|caída|Caída|destruida|divide/, 'espada'],
  [/profet|Elías|Eliseo|Jonás|Joel|Abdías|Malaquías|Habacuc|Nahúm|Sofonías|Hageo|Daniel|Samuel|Esdras|Ministerio/, 'shofar'],
  [/rey|reina|Reinado|Reina|Ester|jueces/, 'corona'],
];

// Donde las palabras engañan (Galión aparece por una inscripción, Ramsés por ser faraón…)
const POR_TITULO: Record<string, Icono> = {
  'Civilización del valle del Indo': 'ciudad',
  'Los hicsos': 'corona',
  'Grecia micénica': 'corona',
  'Cartas de Amarna': 'pergamino',
  Akenatón: 'corona',
  'Ramsés II': 'corona',
  'Senaquerib contra Judá': 'espada',
  'Necao en Meguido': 'espada',
  'Nabucodonosor II': 'corona',
  'Darío I': 'corona',
  'Jerjes I (Asuero)': 'corona',
  'Artajerjes I': 'corona',
  Tiberio: 'corona',
  Claudio: 'corona',
  Domiciano: 'corona',
  'Galión en Corinto': 'estela',
  'Los orígenes': 'estrella',
  'Los jueces': 'shofar',
  'Joram, Ocozías y Atalía': 'corona',
  'Amasías de Judá y Jeroboam II de Israel': 'corona',
  'Regreso del exilio y nuevo templo': 'templo',
  'Últimas cartas de Pablo y de Pedro': 'pluma',
  'Ministerio de Jesús': 'lampara',
};

export function iconoEvento(e: Evento): Icono {
  if (POR_TITULO[e.titulo]) return POR_TITULO[e.titulo];
  const texto = `${e.titulo} · ${e.texto}`;
  return REGLAS_EVENTO.find(([re]) => re.test(e.titulo))?.[1] ?? REGLAS_EVENTO.find(([re]) => re.test(texto))?.[1] ?? 'punto';
}

export function iconoPeriodo(p: Periodo): Icono {
  return POR_TITULO[p.titulo] ?? REGLAS_PERIODO.find(([re]) => re.test(p.titulo))?.[1] ?? 'punto';
}
