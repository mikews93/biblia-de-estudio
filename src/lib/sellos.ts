import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { markStudyDay } from './progress';
import { cambio, registrar } from './sincronia';

// «Mis sellos»: la gamificación de la app. Celebra la profundidad y la compañía, nunca la velocidad: no hay
// puntos, ni niveles, ni rankings. Cada función deja una huella cuando se usa («palabra:G26», «lugar:jerusalén»…)
// y un sello se gana al juntar cierto número de huellas de un tipo. Al ganarlo se celebra una sola vez, con un
// versículo, y queda la fecha.
//
// Las huellas se guardan en el dispositivo y en la cuenta (almacén «sellos»). Otras partes de la app pueden
// sumar sellos propios con definirSellos (el Modo jóvenes usa `publico`).

/** Lo que deja huella. Las de estudio también cuentan como un día con la Palabra en «Tu semana». */
export type Tipo =
  | 'palabra' // una palabra hebrea o griega abierta (tarjeta del interlineal, concordancia, historia, audio original)
  | 'historia' // «La historia de una palabra» leída
  | 'original' // un capítulo escuchado en hebreo o griego
  | 'lugar' // un lugar en una ficha o en el mapa que sigue la lectura
  | 'persona' // la ficha de una persona
  | 'viaje' // un recorrido seguido hasta la última parada
  | 'promesa' // un hilo de promesa y cumplimiento recorrido
  | 'diferencia' // un versículo en «¿Por qué difieren las versiones?»
  | 'respondida' // una oración respondida (privada: solo cuenta la primera)
  | 'sermon' // una semana del sermón completa (5 días)
  | 'celula' // una lectura en vivo de la célula
  | 'evento' // un evento de la iglesia seguido en vivo
  | 'grupo' // la meta semanal de un grupo cumplida entre todos
  | 'pareja-dia' // un día de un plan en pareja respondido por los dos
  | 'pareja' // un plan en pareja terminado juntos
  | 'dia' // un día con la Palabra
  | 'meta' // una semana con la meta de 5 de 7 días
  | 'mision' // una misión del Modo Jóvenes (src/lib/jovenes.ts)
  | 'profunda' // una misión con sus tres estrellas: entendida, pensada y vivida
  | 'ruta' // una ruta de misiones terminada
  | `ruta-${string}` // una misión de esa ruta
  | 'cuento' // una historia del Espacio Niños (src/lib/ninos.ts)
  | 'charla' // una historia conversada en familia
  | 'memoria'; // un versículo guardado de memoria

const DE_ESTUDIO: Tipo[] = ['palabra', 'historia', 'original', 'lugar', 'persona', 'viaje', 'promesa', 'diferencia'];

export type Publico = 'todos' | 'jovenes' | 'ninos';

export type Familia = 'palabras' | 'pasaporte' | 'escrituras' | 'oracion' | 'juntos' | 'constancia' | (string & {});

export type FamiliaDef = { id: Familia; titulo: string; subtitulo: string };

const FAMILIAS_BASE: FamiliaDef[] = [
  { id: 'palabras', titulo: 'Palabras originales', subtitulo: 'El hebreo y el griego que vas descubriendo' },
  { id: 'pasaporte', titulo: 'Pasaporte', subtitulo: 'Los lugares que visitas y las personas que conoces' },
  { id: 'escrituras', titulo: 'Escudriñar', subtitulo: 'Promesas cumplidas y manuscritos comparados' },
  { id: 'oracion', titulo: 'Piedras de memoria', subtitulo: 'Lo que Dios ha respondido, solo para ti' },
  { id: 'juntos', titulo: 'Juntos', subtitulo: 'Compañía, nunca competencia' },
  { id: 'constancia', titulo: 'Constancia', subtitulo: 'Días con la Palabra, a tu ritmo' },
];

/** Dibujo dentro del sello (ver SelloIcono en components/Sello.tsx). */
export type Dibujo =
  | 'tesoro'
  | 'pico'
  | 'pergamino'
  | 'libro'
  | 'oido'
  | 'peregrino'
  | 'camino'
  | 'pisadas'
  | 'testigos'
  | 'familia'
  | 'hilo'
  | 'amen'
  | 'lupa'
  | 'piedra'
  | 'dos'
  | 'pagina'
  | 'templo'
  | 'pulpito'
  | 'lampara'
  | 'sol'
  // Los del Modo Jóvenes: el dibujo de cada ruta y dos más
  | 'cruz'
  | 'huella'
  | 'escudo'
  | 'ola'
  | 'amigos'
  | 'ancla'
  | 'chispa'
  // Los del Espacio Niños
  | 'arcoiris'
  | 'oveja'
  | 'corazon'
  // En pareja
  | 'cordon';

export type Sello = {
  id: string;
  familia: Familia;
  titulo: string;
  /** Cómo se gana, en una frase. */
  como: string;
  /** Lo que se celebra al ganarlo, en pasado. */
  logro: string;
  tipo: Tipo;
  meta: number;
  dibujo: Dibujo;
  versiculo: { ref: string; texto: string; book: string; chapter: number; verse: number };
  /** Adónde ir para ganarlo. */
  ir: { label: string; href: string };
  publico: Publico;
  /** Privado: no muestra el número (las oraciones respondidas no se cuentan). */
  sinCuenta?: boolean;
};

const v = (ref: string, book: string, chapter: number, verse: number, texto: string) => ({ ref, book, chapter, verse, texto });

// Versículos en la RV1909 (dominio público).
const CATALOGO: Sello[] = [
  {
    id: 'palabras-10',
    familia: 'palabras',
    titulo: 'Buscador de tesoros',
    como: 'Abre 10 palabras en hebreo o griego.',
    logro: 'Abriste 10 palabras en hebreo o griego.',
    tipo: 'palabra',
    meta: 10,
    dibujo: 'tesoro',
    versiculo: v('Proverbios 2:4-5', 'pro', 2, 4, 'Si como a la plata la buscares, y como a tesoros la escudriñares: entonces entenderás el temor de Jehová.'),
    ir: { label: 'Toca una palabra en el interlineal', href: '/juan/1' },
    publico: 'todos',
  },
  {
    id: 'palabras-50',
    familia: 'palabras',
    titulo: 'Más que mucho oro',
    como: 'Abre 50 palabras en hebreo o griego.',
    logro: 'Abriste 50 palabras en hebreo o griego.',
    tipo: 'palabra',
    meta: 50,
    dibujo: 'pico',
    versiculo: v('Salmos 19:10', 'psa', 19, 10, 'Deseables más que el oro, y más que mucho oro afinado: y dulces más que miel, y que licor de panales.'),
    ir: { label: 'Toca una palabra en el interlineal', href: '/juan/1' },
    publico: 'todos',
  },
  {
    id: 'palabras-100',
    familia: 'palabras',
    titulo: 'Cien palabras',
    como: 'Abre 100 palabras en hebreo o griego.',
    logro: 'Abriste 100 palabras en hebreo o griego.',
    tipo: 'palabra',
    meta: 100,
    dibujo: 'pergamino',
    versiculo: v('Salmos 119:162', 'psa', 119, 162, 'Regocíjome yo sobre tu palabra, como el que halla muchos despojos.'),
    ir: { label: 'Toca una palabra en el interlineal', href: '/juan/1' },
    publico: 'todos',
  },
  {
    id: 'historias-3',
    familia: 'palabras',
    titulo: 'Palabra viva',
    como: 'Lee la historia de 3 palabras.',
    logro: 'Leíste la historia de 3 palabras.',
    tipo: 'historia',
    meta: 3,
    dibujo: 'libro',
    versiculo: v('Hebreos 4:12', 'heb', 4, 12, 'Porque la palabra de Dios es viva y eficaz, y más penetrante que toda espada de dos filos.'),
    ir: { label: 'Ir a «La historia de una palabra»', href: '/palabras' },
    publico: 'todos',
  },
  {
    id: 'original-1',
    familia: 'palabras',
    titulo: 'Al oído',
    como: 'Escucha un capítulo en hebreo o en griego.',
    logro: 'Escuchaste un capítulo en su lengua original.',
    tipo: 'original',
    meta: 1,
    dibujo: 'oido',
    versiculo: v('Romanos 10:17', 'rom', 10, 17, 'Luego la fe es por el oír, y el oír por la palabra de Dios.'),
    ir: { label: 'Escuchar Génesis 1 en hebreo', href: '/genesis/1' },
    publico: 'todos',
  },
  {
    id: 'lugares-10',
    familia: 'pasaporte',
    titulo: 'Peregrino',
    como: 'Visita 10 lugares en el mapa o en sus fichas.',
    logro: 'Visitaste 10 lugares de la Biblia.',
    tipo: 'lugar',
    meta: 10,
    dibujo: 'peregrino',
    versiculo: v('Hebreos 11:13', 'heb', 11, 13, 'Confesando que eran peregrinos y advenedizos sobre la tierra.'),
    ir: { label: 'Seguir Hechos 13 en el mapa', href: '/recorrido/hechos/13' },
    publico: 'todos',
  },
  {
    id: 'lugares-50',
    familia: 'pasaporte',
    titulo: 'Caminos en el corazón',
    como: 'Visita 50 lugares en el mapa o en sus fichas.',
    logro: 'Visitaste 50 lugares de la Biblia.',
    tipo: 'lugar',
    meta: 50,
    dibujo: 'camino',
    versiculo: v('Salmos 84:5', 'psa', 84, 5, 'Bienaventurado el hombre, que tiene su fortaleza en ti: caminos en sus corazones.'),
    ir: { label: 'Ver los recorridos', href: '/recorridos' },
    publico: 'todos',
  },
  {
    id: 'viaje-1',
    familia: 'pasaporte',
    titulo: 'Tras sus pisadas',
    como: 'Sigue un recorrido en el mapa hasta la última parada.',
    logro: 'Seguiste un recorrido hasta el final.',
    tipo: 'viaje',
    meta: 1,
    dibujo: 'pisadas',
    versiculo: v('1 Pedro 2:21', '1pe', 2, 21, 'Cristo padeció por nosotros, dejándonos un modelo, para que vosotros sigáis sus pisadas.'),
    ir: { label: 'Ver los recorridos', href: '/recorridos' },
    publico: 'todos',
  },
  {
    id: 'personas-10',
    familia: 'pasaporte',
    titulo: 'Nube de testigos',
    como: 'Conoce a 10 personas de la Biblia en sus fichas.',
    logro: 'Conociste a 10 personas de la Biblia.',
    tipo: 'persona',
    meta: 10,
    dibujo: 'testigos',
    versiculo: v('Hebreos 12:1', 'heb', 12, 1, 'Teniendo puesta sobre nosotros una tan grande nube de testigos, corramos con paciencia la carrera.'),
    ir: { label: 'Toca un nombre en el lector', href: '/genesis/12' },
    publico: 'todos',
  },
  {
    id: 'personas-50',
    familia: 'pasaporte',
    titulo: 'Familiares de Dios',
    como: 'Conoce a 50 personas de la Biblia en sus fichas.',
    logro: 'Conociste a 50 personas de la Biblia.',
    tipo: 'persona',
    meta: 50,
    dibujo: 'familia',
    versiculo: v('Efesios 2:19', 'eph', 2, 19, 'Ya no sois forasteros y extranjeros, sino conciudadanos de los santos, y familiares de Dios.'),
    ir: { label: 'Toca un nombre en el lector', href: '/genesis/12' },
    publico: 'todos',
  },
  {
    id: 'promesas-1',
    familia: 'escrituras',
    titulo: 'Sí y Amén',
    como: 'Recorre un hilo de promesa y cumplimiento.',
    logro: 'Recorriste una promesa hasta su cumplimiento.',
    tipo: 'promesa',
    meta: 1,
    dibujo: 'amen',
    versiculo: v('2 Corintios 1:20', '2co', 1, 20, 'Porque todas las promesas de Dios son en él sí, y en él Amén para gloria de Dios por nosotros.'),
    ir: { label: 'Ver las promesas', href: '/promesas' },
    publico: 'todos',
  },
  {
    id: 'promesas-12',
    familia: 'escrituras',
    titulo: 'Todo se cumplió',
    como: 'Recorre 12 hilos de promesa y cumplimiento.',
    logro: 'Recorriste 12 promesas hasta su cumplimiento.',
    tipo: 'promesa',
    meta: 12,
    dibujo: 'hilo',
    versiculo: v('Josué 21:45', 'jos', 21, 45, 'No faltó palabra de todas las buenas palabras que habló Jehová a la casa de Israel, todo se cumplió.'),
    ir: { label: 'Ver las promesas', href: '/promesas' },
    publico: 'todos',
  },
  {
    id: 'bereano',
    familia: 'escrituras',
    titulo: 'Como los de Berea',
    como: 'Mira por qué difieren las versiones en 5 versículos.',
    logro: 'Escudriñaste 5 versículos en los manuscritos.',
    tipo: 'diferencia',
    meta: 5,
    dibujo: 'lupa',
    versiculo: v('Hechos 17:11', 'act', 17, 11, 'Recibieron la palabra con toda codicia, escudriñando cada día las Escrituras, para ver si estas cosas eran así.'),
    ir: { label: 'Comparar Juan 1:18', href: '/comparar/juan/1/18' },
    publico: 'todos',
  },
  {
    id: 'ebenezer',
    familia: 'oracion',
    titulo: 'Ebenezer',
    como: 'Marca una oración como respondida en tu diario.',
    logro: 'Guardaste una oración respondida.',
    tipo: 'respondida',
    meta: 1,
    dibujo: 'piedra',
    versiculo: v('1 Samuel 7:12', '1sa', 7, 12, 'Y Samuel tomó una piedra, y púsole nombre Eben-ezer, diciendo: Hasta aquí nos ayudó Jehová.'),
    ir: { label: 'Abrir mis oraciones', href: '/diario?vista=oraciones' },
    publico: 'todos',
    sinCuenta: true,
  },
  {
    id: 'grupo',
    familia: 'juntos',
    titulo: 'Mejores son dos',
    como: 'Cumplan entre todos la meta de la semana de tu grupo.',
    logro: 'Tu grupo cumplió la meta de la semana.',
    tipo: 'grupo',
    meta: 1,
    dibujo: 'dos',
    versiculo: v('Eclesiastés 4:9', 'ecc', 4, 9, 'Mejores son dos que uno; porque tienen mejor paga de su trabajo.'),
    ir: { label: 'Ir a la comunidad', href: '/comunidades' },
    publico: 'todos',
  },
  {
    id: 'pareja-primero',
    familia: 'juntos',
    titulo: 'El primer nudo',
    como: 'Respondan juntos el primer día de un plan en pareja.',
    logro: 'Respondieron juntos su primer día en pareja.',
    tipo: 'pareja-dia',
    meta: 1,
    dibujo: 'cordon',
    versiculo: v('Génesis 2:18', 'gen', 2, 18, 'Y dijo Jehová Dios: No es bueno que el hombre esté solo; haréle ayuda idónea para él.'),
    ir: { label: 'Ir a En pareja', href: '/pareja' },
    publico: 'todos',
  },
  {
    id: 'pareja-plan',
    familia: 'juntos',
    titulo: 'Cordón de tres dobleces',
    como: 'Terminen juntos un plan en pareja.',
    logro: 'Terminaron juntos un plan en pareja.',
    tipo: 'pareja',
    meta: 1,
    dibujo: 'cordon',
    versiculo: v('Eclesiastés 4:12', 'ecc', 4, 12, 'Y si alguno prevaleciere contra el uno, dos estarán contra él; y cordón de tres dobleces no presto se rompe.'),
    ir: { label: 'Ir a En pareja', href: '/pareja' },
    publico: 'todos',
  },
  {
    id: 'pareja-30',
    familia: 'juntos',
    titulo: 'Donde tú vayas',
    como: 'Respondan juntos 30 días de planes en pareja.',
    logro: 'Respondieron juntos 30 días en pareja.',
    tipo: 'pareja-dia',
    meta: 30,
    dibujo: 'cordon',
    versiculo: v('Rut 1:16', 'rut', 1, 16, 'Respondió Ruth: No me ruegues que te deje, y que me aparte de ti: porque donde quiera que tú fueres, iré yo; y donde quiera que vivieres, viviré. Tu pueblo será mi pueblo, y tu Dios mi Dios.'),
    ir: { label: 'Ir a En pareja', href: '/pareja' },
    publico: 'todos',
  },
  {
    id: 'celula',
    familia: 'juntos',
    titulo: 'Una sola página',
    como: 'Lee en vivo con tu célula.',
    logro: 'Leíste en vivo con tu célula.',
    tipo: 'celula',
    meta: 1,
    dibujo: 'pagina',
    versiculo: v('Salmos 133:1', 'psa', 133, 1, '¡Mirad, cuán bueno, y cuán suave es habitar los hermanos también en uno!'),
    ir: { label: 'Leer en vivo', href: '/vivo' },
    publico: 'todos',
  },
  {
    id: 'evento',
    familia: 'juntos',
    titulo: 'En la congregación',
    como: 'Sigue en vivo un evento de tu iglesia.',
    logro: 'Seguiste en vivo a tu iglesia.',
    tipo: 'evento',
    meta: 1,
    dibujo: 'templo',
    versiculo: v('Hebreos 10:25', 'heb', 10, 25, 'No dejando nuestra congregación, como algunos tienen por costumbre, mas exhortándonos.'),
    ir: { label: 'Ver los eventos', href: '/eventos' },
    publico: 'todos',
  },
  {
    id: 'sermon',
    familia: 'juntos',
    titulo: 'Hacedores',
    como: 'Completa los cinco días de una semana del sermón.',
    logro: 'Viviste una semana entera del sermón.',
    tipo: 'sermon',
    meta: 1,
    dibujo: 'pulpito',
    versiculo: v('Santiago 1:22', 'jas', 1, 22, 'Mas sed hacedores de la palabra, y no tan solamente oidores.'),
    ir: { label: 'Del sermón a tu semana', href: '/semana' },
    publico: 'todos',
  },
  {
    id: 'meta-1',
    familia: 'constancia',
    titulo: 'De día y de noche',
    como: 'Cumple la meta de 5 días en una semana.',
    logro: 'Cumpliste la meta de 5 días en una semana.',
    tipo: 'meta',
    meta: 1,
    dibujo: 'lampara',
    versiculo: v('Salmos 1:2', 'psa', 1, 2, 'Mas antes en la ley de Jehová es su voluntad: y en su ley meditará de día y de noche.'),
    ir: { label: 'Seguir leyendo', href: '/' },
    publico: 'todos',
  },
  {
    id: 'dias-30',
    familia: 'constancia',
    titulo: 'Nuevas cada mañana',
    como: 'Pasa 30 días con la Palabra, a tu ritmo.',
    logro: 'Llevas 30 días con la Palabra.',
    tipo: 'dia',
    meta: 30,
    dibujo: 'sol',
    versiculo: v('Lamentaciones 3:22-23', 'lam', 3, 22, 'Sus misericordias nunca desfallecieron. Nuevas cada mañana: grande es tu fe.'),
    ir: { label: 'Seguir leyendo', href: '/' },
    publico: 'todos',
  },
];

let catalogo = [...CATALOGO];
let familias = [...FAMILIAS_BASE];
const catalogoListeners = new Set<() => void>();

/** Las familias en que se agrupan los sellos en la página, en orden. */
export const getFamilias = () => familias;

/**
 * Suma sellos al catálogo (por ejemplo, los del Modo jóvenes), y si hace falta familias nuevas para agruparlos.
 * Un id repetido reemplaza al anterior.
 */
export function definirSellos(nuevos: Sello[], nuevasFamilias: FamiliaDef[] = []) {
  const ids = new Set(nuevos.map((s) => s.id));
  catalogo = [...catalogo.filter((s) => !ids.has(s.id)), ...nuevos];
  const fids = new Set(nuevasFamilias.map((f) => f.id));
  familias = [...familias.filter((f) => !fids.has(f.id)), ...nuevasFamilias];
  catalogoListeners.forEach((l) => l());
  revisar();
}

/** Los sellos que ve cada público: los de todos y, si hay modo, los suyos. */
export const sellosPara = (publico: Publico = 'todos') => catalogo.filter((s) => s.publico === 'todos' || s.publico === publico);

export const selloPorId = (id: string) => catalogo.find((s) => s.id === id);

// ——— Estado ———

type Ganado = { fecha: string; visto: boolean };
export type Estado = {
  /** «tipo:id» → día de la primera vez («AAAA-MM-DD»). */
  huellas: Record<string, string>;
  ganados: Record<string, Ganado>;
  /** Ya se revisó lo que había antes de los sellos (eso no se celebra uno por uno). */
  iniciado: boolean;
};

const KEY = 'sellos';
let state: Estado = { huellas: {}, ganados: {}, iniciado: false };
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) state = { ...state, ...JSON.parse(raw) };
    })
    .catch(() => {})
    .then(() => listeners.forEach((l) => l()));
  return loaded;
}

function write(next: Estado) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Cuántas huellas hay de un tipo. */
export function cuenta(s: Pick<Estado, 'huellas'>, tipo: Tipo) {
  const pre = `${tipo}:`;
  let n = 0;
  for (const k in s.huellas) if (k.startsWith(pre)) n++;
  return n;
}

/** Los sellos que ya se cumplen y aún no estaban ganados. */
export function nuevosGanados(s: Estado, lista: Sello[] = catalogo): Sello[] {
  return lista.filter((sello) => !s.ganados[sello.id] && cuenta(s, sello.tipo) >= sello.meta);
}

function revisar(next: Estado = state) {
  const nuevos = nuevosGanados(next);
  if (!nuevos.length) return next === state ? undefined : write(next);
  const fecha = hoy();
  const ganados = { ...next.ganados };
  // Lo que ya se había hecho antes de los sellos se gana sin fiesta: se ve en la página, pero no salta encima
  for (const s of nuevos) ganados[s.id] = { fecha, visto: !next.iniciado };
  write({ ...next, ganados });
}

/**
 * Deja una huella. La primera vez de cada cosa cuenta; repetirla no suma. Las de estudio marcan además el día
 * en «Tu semana»: explorar una palabra o un lugar también es un día con la Palabra.
 */
export async function huella(tipo: Tipo, id: string) {
  await load();
  if (DE_ESTUDIO.includes(tipo)) markStudyDay();
  const k = `${tipo}:${id.toLowerCase()}`;
  if (state.huellas[k]) return;
  revisar({ ...state, huellas: { ...state.huellas, [k]: hoy() } });
  cambio();
}

/** Una palabra hebrea o griega: «G0026», «G26» y «g26a» cuentan como la misma. */
export function huellaPalabra(strong: string | null | undefined) {
  const m = /^([GH])0*(\d{1,4})/i.exec(strong?.trim() ?? '');
  if (m) return huella('palabra', `${m[1]}${m[2]}`);
}

/** Un lugar, por su nombre: el mapa y las fichas usan ids distintos, pero «Antioquía» es la misma en los dos. */
export function huellaLugar(nombre: string) {
  const clave = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (clave) return huella('lugar', clave);
}

/**
 * Huellas que salen de lo que la app ya guarda (días leídos, oraciones respondidas, semanas del sermón): se
 * suman todas de una vez. La primera vez marca el inicio, así lo de antes no se celebra uno por uno.
 */
export async function huellasDe(tipo: Tipo, ids: string[]) {
  await load();
  const faltan = ids.filter((id) => !state.huellas[`${tipo}:${id.toLowerCase()}`]);
  if (!faltan.length) return;
  const huellas = { ...state.huellas };
  for (const id of faltan) huellas[`${tipo}:${id.toLowerCase()}`] = hoy();
  revisar({ ...state, huellas });
  cambio();
}

/** Lunes («AAAA-MM-DD») de cada semana en que se cumplió la meta de días. */
export function semanasConMeta(days: string[], meta = 5) {
  const porSemana = new Map<string, number>();
  for (const d of new Set(days)) {
    const [y, m, dd] = d.split('-').map(Number);
    const fecha = new Date(y, m - 1, dd);
    fecha.setDate(fecha.getDate() - ((fecha.getDay() + 6) % 7));
    const lunes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    porSemana.set(lunes, (porSemana.get(lunes) ?? 0) + 1);
  }
  return [...porSemana].filter(([, n]) => n >= meta).map(([lunes]) => lunes);
}

/** Ya pasó la revisión de lo que había antes: desde ahora cada sello nuevo se celebra. */
export async function iniciar() {
  await load();
  if (!state.iniciado) write({ ...state, iniciado: true });
}

/** El siguiente sello por celebrar, si hay. */
export const porCelebrar = (s: Estado = state) =>
  catalogo.find((sello) => s.ganados[sello.id] && !s.ganados[sello.id].visto) ?? null;

export async function celebrado(id: string) {
  await load();
  const g = state.ganados[id];
  if (g && !g.visto) write({ ...state, ganados: { ...state.ganados, [id]: { ...g, visto: true } } });
}

/** Avance de un sello: cuántas huellas lleva de las que pide. */
export function avance(s: Estado, sello: Sello) {
  const n = Math.min(cuenta(s, sello.tipo), sello.meta);
  return { n, meta: sello.meta, ganado: s.ganados[sello.id] ?? null, parte: n / sello.meta };
}

/** El sello aún sin ganar que está más cerca, para animar sin presionar. */
export function siguienteSello(s: Estado, lista: Sello[]) {
  return (
    lista
      .filter((sello) => !s.ganados[sello.id] && !sello.sinCuenta)
      .map((sello) => ({ sello, ...avance(s, sello) }))
      .filter((a) => a.n > 0)
      .sort((a, b) => b.parte - a.parte)[0] ?? null
  );
}

/** Los ganados, del más reciente al más antiguo. */
export const ganadosRecientes = (s: Estado, lista: Sello[]) =>
  lista.filter((sello) => s.ganados[sello.id]).sort((a, b) => s.ganados[b.id].fecha.localeCompare(s.ganados[a.id].fecha));

export function useSellos() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    catalogoListeners.add(l);
    load();
    return () => {
      listeners.delete(l);
      catalogoListeners.delete(l);
    };
  }, []);
  return state;
}

// En la cuenta va una huella por entrada («h.palabra:g26») y un sello ganado por entrada («g.bereano»).
export function partirSellos(s: Estado): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, fecha] of Object.entries(s.huellas)) out[`h.${k}`] = fecha;
  for (const [id, g] of Object.entries(s.ganados)) out[`g.${id}`] = g.fecha;
  return out;
}

/** Un sello que llega de otro dispositivo ya se celebró allá. */
export function unirSellos(entradas: Record<string, unknown>, antes: Estado): Estado {
  const huellas: Record<string, string> = {};
  const ganados: Record<string, Ganado> = {};
  for (const [k, valor] of Object.entries(entradas)) {
    if (typeof valor !== 'string') continue;
    if (k.startsWith('h.')) huellas[k.slice(2)] = valor;
    else if (k.startsWith('g.')) {
      const id = k.slice(2);
      ganados[id] = { fecha: valor, visto: antes.ganados[id]?.visto ?? true };
    }
  }
  return { huellas, ganados, iniciado: antes.iniciado || Object.keys(huellas).length > 0 };
}

registrar<Estado>({
  nombre: 'sellos',
  leer: () => load().then(() => state),
  escribir: (s) => {
    write(s);
    revisar();
  },
  partir: partirSellos,
  unir: unirSellos,
});
