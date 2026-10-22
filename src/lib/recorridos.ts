// Recorridos: el mapa que acompaña la lectura. Cada recorrido es una lista de paradas atadas a un versículo; los
// lugares se toman de OpenBible.info (places/<libro>/<cap>.json) por su nombre en inglés, y solo los que no tienen
// punto propio en ese capítulo (el desierto de Marcos 1:12, el puerto de salida) llevan coordenadas aquí.
// Mientras suena el audio (o al avanzar a mano) el mapa se mueve a la última parada alcanzada.

import { Place, getPlaces } from './data';
import { BOOK_SLUGS } from './routes';

export type Stop = {
  book: string;
  chapter: number;
  verse: number;
  /** Nombre en inglés del lugar en OpenBible (Place.en). */
  place?: string;
  /** Nombre que se muestra, si el de los datos no sirve («Buenos Puertos» y no «Fair Havens»). */
  name?: string;
  lon?: number;
  lat?: number;
  /** Lo que pasa allí, en pocas palabras. */
  note: string;
};

export type Journey = {
  id: string;
  title: string;
  /** Línea corta para la tarjeta del recorrido. */
  short: string;
  /** Contexto en dos o tres frases, sin predicar. */
  intro: string;
  stops: Stop[];
};

export type ResolvedStop = Stop & { name: string; lon: number; lat: number; conf: number; sea: boolean };

const s = (book: string, chapter: number, verse: number, place: string | null, note: string, extra: Partial<Stop> = {}): Stop => ({
  book,
  chapter,
  verse,
  ...(place ? { place } : {}),
  note,
  ...extra,
});

export const JOURNEYS: Journey[] = [
  {
    id: 'jesus-galilea',
    title: 'Jesús en Galilea',
    short: 'Marcos 1 al 6 · del Jordán al mar de Galilea',
    intro:
      'Marcos cuenta con prisa: «luego», «luego». Jesús baja de Nazaret al Jordán, pasa por el desierto y vuelve a Galilea, donde Capernaum y el mar se vuelven el centro de su ministerio. El lago mide unos 21 km de largo: las travesías en barca de estos capítulos son cortas, pero sus tormentas eran famosas.',
    stops: [
      s('mrk', 1, 9, 'Nazareth', 'Jesús sale de Nazaret de Galilea'),
      s('mrk', 1, 9, 'Jordan', 'Juan lo bautiza en el Jordán'),
      s('mrk', 1, 12, null, 'El Espíritu lo lleva al desierto: cuarenta días', { name: 'El desierto', lon: 35.38, lat: 31.68 }),
      s('mrk', 1, 14, 'Galilee 1', 'Vuelve a Galilea predicando el evangelio'),
      s('mrk', 1, 16, 'Sea of Galilee', 'Llama a Simón, Andrés, Jacobo y Juan junto al mar'),
      s('mrk', 1, 21, 'Capernaum', 'Enseña en la sinagoga de Capernaum'),
      s('mrk', 1, 35, null, 'Ora de madrugada en un lugar desierto', { name: 'Un lugar desierto', lon: 35.53, lat: 32.9 }),
      s('mrk', 1, 39, 'Galilee 1', 'Predica en las sinagogas de toda Galilea'),
      s('mrk', 2, 1, 'Capernaum', 'Vuelve a Capernaum: sanan al paralítico'),
      s('mrk', 3, 7, null, 'Se retira al mar; lo siguen multitudes', { name: 'Mar de Galilea', lon: 35.59, lat: 32.82 }),
      s('mrk', 4, 1, null, 'Enseña en parábolas desde una barca', { name: 'La orilla del mar', lon: 35.555, lat: 32.865 }),
      s('mrk', 5, 1, 'Gerasa', 'Cruza el lago tras calmar la tempestad', {
        name: 'Tierra de los gadarenos',
        lon: 35.65,
        lat: 32.83,
      }),
      s('mrk', 5, 21, null, 'Regresa a la otra orilla: Jairo y la mujer enferma', { name: 'La otra orilla', lon: 35.565, lat: 32.875 }),
      s('mrk', 6, 1, 'Nazareth', 'En su tierra no lo reciben'),
      s('mrk', 6, 45, 'Bethsaida 2', 'Manda a los discípulos a Betsaida'),
      s('mrk', 6, 53, 'Gennesaret', 'Desembarcan en Genezaret'),
    ],
  },
  {
    id: 'exodo',
    title: 'La salida de Egipto',
    short: 'Éxodo 12 al 19 · de Ramesés al Sinaí',
    intro:
      'Israel sale de Ramesés, en el delta del Nilo, y en vez de tomar el camino corto de los filisteos (13:17) va hacia el desierto. La ruta exacta y el lugar del cruce del mar son discutidos; el mapa sigue las identificaciones más aceptadas de OpenBible.info. Del Sinaí no se moverán hasta Números 10.',
    stops: [
      s('exo', 12, 37, 'Rameses', 'Parten de Ramesés'),
      s('exo', 12, 37, 'Succoth 2', 'Primera parada: Succoth'),
      s('exo', 13, 20, 'Etham', 'Acampan en Etham, a la entrada del desierto'),
      s('exo', 14, 2, 'Pi-hahiroth', 'Vuelven y acampan junto a Pi-hahiroth, frente al mar'),
      s('exo', 14, 22, null, 'Cruzan el mar en seco; el lugar exacto es discutido', { name: 'El mar', lon: 32.56, lat: 29.93 }),
      s('exo', 15, 22, 'Shur', 'Tres días por el desierto de Shur sin agua', { name: 'Desierto de Shur', lon: 32.85, lat: 29.75 }),
      s('exo', 15, 23, 'Marah', 'Mara: las aguas amargas se endulzan'),
      s('exo', 15, 27, 'Elim', 'Elim: doce fuentes y setenta palmas'),
      s('exo', 16, 1, 'Sin', 'Desierto de Sin: el maná'),
      s('exo', 17, 1, 'Rephidim', 'Refidim: agua de la peña y batalla con Amalec'),
      s('exo', 19, 2, 'Mount Sinai', 'Acampan delante del monte Sinaí'),
    ],
  },
  {
    id: 'jornadas-desierto',
    title: 'Las jornadas del desierto',
    short: 'Números 33 · cuarenta años, parada por parada',
    intro:
      'Moisés escribió las salidas de Israel «por sus jornadas» (33:2): una lista de campamentos desde Egipto hasta las llanuras de Moab, frente a Jericó. Muchos de estos lugares solo se conocen por este capítulo, así que varias ubicaciones son inciertas.',
    stops: [
      s('num', 33, 3, 'Rameses', 'Salen de Ramesés el día quince del primer mes'),
      s('num', 33, 5, 'Succoth 2', 'Succoth'),
      s('num', 33, 6, 'Etham', 'Etham, al borde del desierto'),
      s('num', 33, 7, 'Pi-hahiroth', 'Pi-hahiroth, frente a Baalzephón'),
      s('num', 33, 8, 'Marah', 'Cruzan el mar y llegan a Mara'),
      s('num', 33, 9, 'Elim', 'Elim'),
      s('num', 33, 10, 'Red Sea 3', 'Junto al mar Bermejo', { name: 'Mar Bermejo', lon: 32.75, lat: 29.05 }),
      s('num', 33, 11, 'Sin', 'Desierto de Sin'),
      s('num', 33, 12, 'Dophkah', 'Dophca'),
      s('num', 33, 13, 'Alush', 'Alús'),
      s('num', 33, 14, 'Rephidim', 'Refidim, donde no había agua'),
      s('num', 33, 15, 'Wilderness of Sinai', 'Desierto de Sinaí'),
      s('num', 33, 16, 'Kibroth-hattaavah', 'Kibroth-hattaavah'),
      s('num', 33, 17, 'Hazeroth', 'Haseroth'),
      s('num', 33, 18, 'Rithmah', 'Ritma'),
      s('num', 33, 22, 'Kehelathah', 'Ceelatha'),
      s('num', 33, 23, 'Mount Shepher', 'Monte Sepher'),
      s('num', 33, 26, 'Tahath', 'Tahath'),
      s('num', 33, 29, 'Hashmonah', 'Hasmona'),
      s('num', 33, 30, 'Moseroth', 'Moseroth'),
      s('num', 33, 31, 'Bene-jaakan', 'Bene-jaacán'),
      s('num', 33, 32, 'Hor-haggidgad', 'Gidgad'),
      s('num', 33, 33, 'Jotbathah', 'Jotbatha'),
      s('num', 33, 34, 'Abronah', 'Abrona'),
      s('num', 33, 35, 'Ezion-geber', 'Esión-geber, junto al golfo'),
      s('num', 33, 36, 'Kadesh-barnea', 'Cades, en el desierto de Zin'),
      s('num', 33, 37, 'Mount Hor 1', 'Monte Hor: muere Aarón'),
      s('num', 33, 41, 'Zalmonah', 'Salmona'),
      s('num', 33, 42, 'Punon', 'Phunón'),
      s('num', 33, 43, 'Oboth', 'Oboth'),
      s('num', 33, 44, 'Iye-abarim', 'Ije-abarim, en la frontera de Moab'),
      s('num', 33, 45, 'Dibon 1', 'Dibón-gad'),
      s('num', 33, 46, 'Almon-diblathaim', 'Almon-diblathaim'),
      s('num', 33, 47, 'Abarim', 'Montes de Abarim, delante de Nebo'),
      s('num', 33, 48, 'Moab 2', 'Campos de Moab, junto al Jordán de Jericó', { name: 'Campos de Moab' }),
    ],
  },
  {
    id: 'pablo-1',
    title: 'Primer viaje de Pablo',
    short: 'Hechos 13 y 14 · Chipre y Galacia, hacia el 46-48 d.C.',
    intro:
      'La iglesia de Antioquía de Siria envía a Bernabé y a Saulo. Recorren Chipre, la tierra de Bernabé (4:36), y suben a la meseta de Galacia. A la vuelta pasan otra vez por las mismas ciudades para fortalecer a los discípulos y nombrar ancianos (14:21-23).',
    stops: [
      s('act', 13, 1, 'Antioch 1', 'La iglesia de Antioquía aparta a Bernabé y a Saulo'),
      s('act', 13, 4, 'Seleucia', 'Bajan al puerto de Seleucia'),
      s('act', 13, 5, 'Salamis', 'Salamina: predican en las sinagogas'),
      s('act', 13, 6, 'Paphos', 'Pafos: el procónsul Sergio Paulo cree'),
      s('act', 13, 13, 'Perga', 'Perge de Pamfilia: Juan Marcos se vuelve'),
      s('act', 13, 14, 'Antioch 2', 'Antioquía de Pisidia: el discurso en la sinagoga'),
      s('act', 13, 51, 'Iconium', 'Sacuden el polvo y van a Iconio'),
      s('act', 14, 6, 'Lystra', 'Listra: sanan a un cojo y apedrean a Pablo'),
      s('act', 14, 20, 'Derbe', 'Derbe: hacen muchos discípulos'),
      s('act', 14, 21, 'Lystra', 'Vuelven a Listra'),
      s('act', 14, 21, 'Iconium', 'A Iconio'),
      s('act', 14, 21, 'Antioch 2', 'Y a Antioquía, confirmando a los discípulos'),
      s('act', 14, 25, 'Perga', 'Predican en Perge'),
      s('act', 14, 25, 'Attalia', 'Bajan al puerto de Atalia'),
      s('act', 14, 26, 'Antioch 1', 'Regresan a Antioquía y cuentan lo que Dios hizo'),
    ],
  },
  {
    id: 'pablo-2',
    title: 'Segundo viaje de Pablo',
    short: 'Hechos 15:36 al 18:22 · el evangelio llega a Europa',
    intro:
      'Pablo y Silas salen a visitar las iglesias del primer viaje. Tras la visión del varón macedonio (16:9) cruzan a Europa: Filipos, Tesalónica, Berea, Atenas y Corinto, donde Pablo se queda año y medio (18:11).',
    stops: [
      s('act', 15, 40, 'Antioch 1', 'Pablo escoge a Silas y parten de Antioquía'),
      s('act', 15, 41, 'Cilicia', 'Recorren Siria y Cilicia confirmando a las iglesias'),
      s('act', 16, 1, 'Derbe', 'Llegan a Derbe'),
      s('act', 16, 1, 'Lystra', 'Listra: se les une Timoteo'),
      s('act', 16, 6, 'Phrygia', 'Pasan por Frigia y Galacia'),
      s('act', 16, 8, 'Troas', 'Troas: la visión del varón macedonio'),
      s('act', 16, 11, 'Samothrace', 'Navegan a Samotracia'),
      s('act', 16, 11, 'Neapolis', 'Neápolis'),
      s('act', 16, 12, 'Philippi', 'Filipos: Lidia, la cárcel y el carcelero'),
      s('act', 17, 1, 'Amphipolis', 'Pasan por Anfípolis'),
      s('act', 17, 1, 'Apollonia', 'Y Apolonia'),
      s('act', 17, 1, 'Thessalonica', 'Tesalónica: tres sábados en la sinagoga'),
      s('act', 17, 10, 'Berea', 'Berea: escudriñan las Escrituras cada día'),
      s('act', 17, 15, 'Athens', 'Atenas: el discurso en el Areópago'),
      s('act', 18, 1, 'Corinth', 'Corinto: con Aquila y Priscila, año y medio'),
      s('act', 18, 18, 'Cenchreae', 'Cencreas, el puerto de Corinto'),
      s('act', 18, 19, 'Ephesus', 'Éfeso: deja allí a Priscila y Aquila'),
      s('act', 18, 22, 'Caesarea', 'Desembarca en Cesarea'),
      s('act', 18, 22, 'Jerusalem', 'Sube a saludar a la iglesia'),
      s('act', 18, 22, 'Antioch 1', 'Desciende a Antioquía'),
    ],
  },
  {
    id: 'pablo-3',
    title: 'Tercer viaje de Pablo',
    short: 'Hechos 18:23 al 21:17 · tres años en Éfeso',
    intro:
      'Pablo recorre otra vez Galacia y Frigia y se instala en Éfeso, donde enseña cada día en la escuela de Tirano (19:9). Después visita Macedonia y Grecia, y vuelve por la costa de Asia rumbo a Jerusalén, despidiéndose de los ancianos de Éfeso en Mileto.',
    stops: [
      s('act', 18, 23, 'Galatia', 'Recorre Galacia y Frigia confirmando a todos'),
      s('act', 19, 1, 'Ephesus', 'Éfeso: dos años en la escuela de Tirano'),
      s('act', 20, 1, 'Macedonia', 'Parte a Macedonia tras el alboroto'),
      s('act', 20, 2, 'Greece', 'Tres meses en Grecia'),
      s('act', 20, 6, 'Philippi', 'Navegan desde Filipos'),
      s('act', 20, 6, 'Troas', 'Troas: Eutico cae de la ventana'),
      s('act', 20, 13, 'Assos', 'Pablo va a pie hasta Asón'),
      s('act', 20, 14, 'Mitylene', 'Mitilene'),
      s('act', 20, 15, 'Chios', 'Delante de Quío', { name: 'Chîo' }),
      s('act', 20, 15, 'Samos', 'Samo'),
      s('act', 20, 15, 'Miletus', 'Mileto: la despedida de los ancianos de Éfeso'),
      s('act', 21, 1, 'Cos', 'Coos'),
      s('act', 21, 1, 'Rhodes 1', 'Rodas'),
      s('act', 21, 1, 'Patara', 'Pátara: cambian de nave'),
      s('act', 21, 3, 'Tyre', 'Tiro: siete días con los discípulos'),
      s('act', 21, 7, 'Ptolemais', 'Tolemaida'),
      s('act', 21, 8, 'Caesarea', 'Cesarea: en casa de Felipe'),
      s('act', 21, 15, 'Jerusalem', 'Suben a Jerusalén'),
    ],
  },
  {
    id: 'pablo-roma',
    title: 'Pablo a Roma',
    short: 'Hechos 27 y 28 · la tormenta y el naufragio',
    intro:
      'Preso en Cesarea, Pablo apela al César y lo embarcan rumbo a Italia ya avanzado el otoño (27:9). Lucas narra el viaje en primera persona: el viento Euroclidón, catorce días a la deriva y el naufragio en Malta. En primavera llegan a Roma.',
    stops: [
      s('act', 27, 1, null, 'Embarcan a Pablo preso hacia Italia', { name: 'Cesarea', lon: 34.8917, lat: 32.5 }),
      s('act', 27, 3, 'Sidon', 'Sidón: Julio lo deja visitar a sus amigos'),
      s('act', 27, 5, 'Myra', 'Mira de Licia: cambian a una nave de Alejandría'),
      s('act', 27, 7, 'Cnidus', 'Con dificultad, frente a Gnido'),
      s('act', 27, 7, 'Salmone', 'Bordean Creta frente a Salmón'),
      s('act', 27, 8, 'Fair Havens', 'Buenos Puertos: Pablo aconseja invernar', { name: 'Buenos Puertos' }),
      s('act', 27, 16, 'Cauda', 'La tormenta: pasan junto a Clauda'),
      s('act', 27, 27, null, 'Catorce noches a la deriva por el Adriático', { name: 'Mar Adriático', lon: 17.2, lat: 35.6 }),
      s('act', 28, 1, 'Malta', 'Naufragan en Melita (Malta)'),
      s('act', 28, 12, 'Syracuse', 'Tres días en Siracusa'),
      s('act', 28, 13, 'Rhegium', 'Regio'),
      s('act', 28, 13, 'Puteoli', 'Puteolos: siete días con los hermanos'),
      s('act', 28, 15, 'Forum of Appius', 'Los hermanos salen a recibirlo', { name: 'Plaza de Appio' }),
      s('act', 28, 15, 'Three Taverns', 'Y a las Tres Tabernas', { name: 'Las Tres Tabernas' }),
      s('act', 28, 16, 'Rome', 'Roma: dos años en una casa alquilada'),
    ],
  },
];

export const journeyById = (id: string) => JOURNEYS.find((j) => j.id === id) ?? null;

/** Recorridos que pasan por un capítulo. */
export const journeysFor = (book: string, chapter: number) =>
  JOURNEYS.filter((j) => j.stops.some((st) => st.book === book && st.chapter === chapter));

const BOOK_ORDER = Object.keys(BOOK_SLUGS);
const key = (book: string, chapter: number, verse: number) => BOOK_ORDER.indexOf(book) * 1e6 + chapter * 1e3 + verse;

/** El recorrido que se sigue en un versículo: si dos se tocan en un capítulo (Hechos 18), el que ya empezó y no ha acabado. */
export function journeyAt(journeys: Journey[], book: string, chapter: number, verse: number): Journey | null {
  if (!journeys.length) return null;
  const here = key(book, chapter, verse);
  const started = journeys.filter((j) => key(j.stops[0].book, j.stops[0].chapter, j.stops[0].verse) <= here);
  return started.length ? started[started.length - 1] : journeys[0];
}

/** Índice de la última parada alcanzada en este versículo (-1 si el recorrido aún no empieza). */
export function stopIndexAt(stops: Stop[], book: string, chapter: number, verse: number): number {
  const here = key(book, chapter, verse);
  let index = -1;
  stops.forEach((st, i) => {
    if (key(st.book, st.chapter, st.verse) <= here) index = i;
  });
  return index;
}

/** Punto dentro de algún anillo de tierra (par-impar). */
function onLand(lon: number, lat: number, land: [number, number][][]): boolean {
  for (const ring of land) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

/** Coordenadas y nombre de cada parada a partir de los lugares de su capítulo. sea: el tramo que llega a ella va por mar. */
export async function resolveStops(
  journey: Journey,
  land: [number, number][][] = [],
  places: (book: string, chapter: number) => Promise<Place[]> = getPlaces,
): Promise<ResolvedStop[]> {
  const chapters = new Map<string, Promise<Place[]>>();
  const out: ResolvedStop[] = [];
  for (const st of journey.stops) {
    const k = `${st.book}/${st.chapter}`;
    if (!chapters.has(k)) chapters.set(k, places(st.book, st.chapter));
    const found = st.place ? (await chapters.get(k)!).find((p) => p.en === st.place) : undefined;
    const lon = st.lon ?? found?.lon;
    const lat = st.lat ?? found?.lat;
    if (lon === undefined || lat === undefined) continue; // sin ubicación: no se dibuja
    const name = st.name ?? found?.name.replace(/ \(.*\)$/, '') ?? st.place ?? '';
    const prev = out[out.length - 1];
    const sea = !!prev && land.length > 0 && !onLand((prev.lon + lon) / 2, (prev.lat + lat) / 2, land);
    out.push({ ...st, name, lon, lat, conf: found?.conf ?? 500, sea });
  }
  return out;
}

/** Distancia en línea recta, en km. */
export function haversine(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Kilómetros recorridos hasta la parada `upTo` (incluida), sumando tramo a tramo. */
export function distanceKm(stops: { lon: number; lat: number }[], upTo = stops.length - 1) {
  let km = 0;
  for (let i = 1; i <= upTo && i < stops.length; i++) km += haversine(stops[i - 1], stops[i]);
  return km;
}

/** «1.240»: redondeado a decenas desde 100 km, con punto de miles. */
export const formatKm = (km: number) =>
  String(km < 100 ? Math.round(km) : Math.round(km / 10) * 10).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Versículo que suena cuando el audio no trae tiempos: se reparte la duración según el largo de cada versículo. */
export function estimateVerse(fraction: number, verses: [number, string, string?][]): number | null {
  if (!verses.length) return null;
  const total = verses.reduce((sum, [, t]) => sum + t.length, 0);
  let acc = 0;
  for (const [n, t] of verses) {
    acc += t.length;
    if (acc / total >= fraction) return n;
  }
  return verses[verses.length - 1][0];
}

/** Partes del texto de un versículo, marcando los nombres de lugar para resaltarlos. */
export function splitPlaces(text: string, names: string[]): { text: string; place: boolean }[] {
  const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const wanted = [...new Set(names.flatMap((n) => [n, n.split(' ').pop() ?? n]))]
    .filter((n) => n.length > 2 && /^[A-ZÁÉÍÓÚÑ]/.test(n))
    .map(fold);
  if (!wanted.length) return [{ text, place: false }];
  const parts: { text: string; place: boolean }[] = [];
  const folded = fold(text);
  let i = 0;
  let plain = '';
  while (i < text.length) {
    const hit = wanted
      .filter((w) => folded.startsWith(w, i) && (i === 0 || !/\p{L}/u.test(text[i - 1])) && !/\p{L}/u.test(text[i + w.length] ?? ''))
      .sort((a, b) => b.length - a.length)[0];
    if (hit && /\p{Lu}/u.test(text[i])) {
      if (plain) parts.push({ text: plain, place: false });
      parts.push({ text: text.slice(i, i + hit.length), place: true });
      plain = '';
      i += hit.length;
    } else {
      plain += text[i];
      i++;
    }
  }
  if (plain) parts.push({ text: plain, place: false });
  return parts;
}

export const recorridoHref = (book: string, chapter: number, verse?: number) =>
  `/recorrido/${BOOK_SLUGS[book] ?? book}/${chapter}${verse ? `?v=${verse}` : ''}`;
