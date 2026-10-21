import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { RUTAS, type Mision, type Ruta, type RutaId } from './jovenesRutas';
import { markStudyDay } from './progress';
import { definirSellos, huellasDe, type Dibujo, type Sello, type Tipo } from './sellos';
import { cambio, registrar } from './sincronia';
import { dateKey, daysBetween, todayKey } from './temporadas';

// Modo Jóvenes: el progreso de las misiones (src/lib/jovenesRutas.ts) y sus sellos en el álbum de la app.
//
// Cada misión da hasta tres estrellas, y las tres miden profundidad, no velocidad: la primera al leer y entender
// (las dos preguntas de comprensión, con todos los intentos que hagan falta), la segunda al escribir la respuesta
// a «Piénsalo» y la tercera al marcar que se vivió el reto de la semana. No hay puntos que se pierdan, ni rankings,
// ni misiones que caduquen: un día sin misión no borra nada. Lo escrito es privado (como el diario).

export type Registro = {
  /** Día en que se completó la misión (leer y entender). */
  fecha: string;
  /** Lo que la persona escribió en «Piénsalo». */
  respuesta?: string;
  /** Día en que marcó que vivió el reto. */
  hecho?: string;
};

type Estado = Record<string, Registro>;

const KEY = 'jovenes';
const PIN_KEY = 'jovenes-pin';
/** Días que el reto de una misión se sigue recordando en Hoy. */
export const DIAS_RETO = 7;
export const MAX_RESPUESTA = 1000;

let state: Estado = {};
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') state = parsed;
    })
    .catch(() => {})
    .then(() => {
      listeners.forEach((l) => l());
      return sembrar(state);
    });
  return loaded;
}

function write(next: Estado) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach((l) => l());
}

// En la cuenta va una misión por entrada («jesus.redes»): lo hecho en el teléfono y en el computador se suma.
registrar<Estado>({
  nombre: 'jovenes',
  leer: () => load().then(() => state),
  escribir: (s) => {
    write(s);
    sembrar(s);
  },
  partir: (s) => s,
  unir: (entradas) => entradas as Estado,
});

export const claveMision = (ruta: RutaId, mision: string) => `${ruta}.${mision}`;

export function buscarMision(rutaId: string, misionId: string): { ruta: Ruta; mision: Mision; indice: number } | null {
  const ruta = RUTAS.find((r) => r.id === rutaId);
  const indice = ruta?.misiones.findIndex((m) => m.id === misionId) ?? -1;
  return ruta && indice >= 0 ? { ruta, mision: ruta.misiones[indice], indice } : null;
}

/** 0 a 3: entendió, escribió su respuesta, vivió el reto. */
export function estrellas(r: Registro | undefined) {
  if (!r) return 0;
  return 1 + (r.respuesta?.trim() ? 1 : 0) + (r.hecho ? 1 : 0);
}

export const completadas = (ruta: Ruta, s: Estado) => ruta.misiones.filter((m) => s[claveMision(ruta.id, m.id)]).length;

/** La primera misión sin hacer de la ruta; las de una ruta se abren en orden. null si está terminada. */
export function siguiente(ruta: Ruta, s: Estado): number | null {
  const i = ruta.misiones.findIndex((m) => !s[claveMision(ruta.id, m.id)]);
  return i < 0 ? null : i;
}

export const abierta = (ruta: Ruta, indice: number, s: Estado) =>
  indice === 0 || !!s[claveMision(ruta.id, ruta.misiones[indice - 1].id)];

/**
 * La misión que se propone hoy: la que sigue en la última ruta en que se avanzó; si esa está terminada, la
 * primera ruta con misiones pendientes. null cuando ya se hicieron todas.
 */
export function misionDeHoy(s: Estado): { ruta: Ruta; mision: Mision; indice: number } | null {
  const ultima = Object.entries(s).sort((a, b) => b[1].fecha.localeCompare(a[1].fecha) || b[0].localeCompare(a[0]))[0];
  const orden = ultima ? [RUTAS.find((r) => r.id === ultima[0].split('.')[0]), ...RUTAS] : RUTAS;
  for (const ruta of orden) {
    if (!ruta) continue;
    const i = siguiente(ruta, s);
    if (i !== null) return { ruta, mision: ruta.misiones[i], indice: i };
  }
  return null;
}

/** El reto más reciente que aún no se marcó como vivido, mientras siga fresco (una semana). */
export function retoPendiente(s: Estado, hoy = todayKey()): { ruta: Ruta; mision: Mision } | null {
  const candidatas = Object.entries(s)
    .filter(([, r]) => !r.hecho && daysBetween(r.fecha, hoy) < DIAS_RETO)
    .sort((a, b) => b[1].fecha.localeCompare(a[1].fecha));
  for (const [clave] of candidatas) {
    const [ruta, mision] = clave.split('.');
    const found = buscarMision(ruta, mision);
    if (found) return found;
  }
  return null;
}

export const hechaHoy = (s: Estado, hoy = todayKey()) => Object.values(s).some((r) => r.fecha === hoy);

// Los sellos del Modo Jóvenes viven en el álbum de toda la app («Mis sellos», src/lib/sellos.ts) con el público
// «jovenes», en su propia familia. Las misiones dejan huellas y el álbum decide cuándo se gana cada uno y lo celebra.
const v = (ref: string, book: string, chapter: number, verse: number, texto: string) => ({ ref, book, chapter, verse, texto });
const DIBUJO: Record<RutaId, Dibujo> = { jesus: 'cruz', identidad: 'huella', valientes: 'escudo', paz: 'ola', amigos: 'amigos' };
// Versículos en la RV1909 (dominio público), como en el resto del álbum.
const VERSO: Record<RutaId, ReturnType<typeof v>> = {
  jesus: v('Marcos 1:17', 'mrk', 1, 17, 'Y les dijo Jesús: Venid en pos de mí, y haré que seáis pescadores de hombres.'),
  identidad: v('Génesis 1:27', 'gen', 1, 27, 'Y crió Dios al hombre a su imagen, a imagen de Dios lo crió; varón y hembra los crió.'),
  valientes: v('Josué 1:9', 'jos', 1, 9, 'Mira que te mando que te esfuerces y seas valiente: no temas ni desmayes, porque Jehová tu Dios será contigo en donde quiera que fueres.'),
  paz: v('Filipenses 4:7', 'php', 4, 7, 'Y la paz de Dios, que sobrepuja todo entendimiento, guardará vuestros corazones y vuestros entendimientos en Cristo Jesús.'),
  amigos: v('Juan 15:12', 'jhn', 15, 12, 'Este es mi mandamiento: Que os améis los unos a los otros, como yo os he amado.'),
};

export const FAMILIA_MISIONES = 'misiones';

export const SELLOS_JOVENES: Sello[] = [
  {
    id: 'jovenes-primera',
    familia: FAMILIA_MISIONES,
    titulo: 'Primer paso',
    como: 'Haz tu primera misión.',
    logro: 'Hiciste tu primera misión.',
    tipo: 'mision',
    meta: 1,
    dibujo: 'chispa',
    versiculo: v('Salmos 119:105', 'psa', 119, 105, 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.'),
    ir: { label: 'Ir a las misiones', href: '/jovenes' },
    publico: 'jovenes',
  },
  ...RUTAS.map<Sello>((r) => ({
    id: `jovenes-ruta-${r.id}`,
    familia: FAMILIA_MISIONES,
    titulo: r.sello,
    como: `Termina la ruta «${r.titulo}».`,
    logro: `Terminaste la ruta «${r.titulo}».`,
    tipo: `ruta-${r.id}`,
    meta: r.misiones.length,
    dibujo: DIBUJO[r.id],
    versiculo: VERSO[r.id],
    ir: { label: `Ir a «${r.titulo}»`, href: `/jovenes/${r.id}` },
    publico: 'jovenes',
  })),
  {
    id: 'jovenes-diez',
    familia: FAMILIA_MISIONES,
    titulo: 'Ejemplo',
    como: 'Haz 10 misiones, a tu ritmo.',
    logro: 'Hiciste 10 misiones.',
    tipo: 'mision',
    meta: 10,
    dibujo: 'pisadas',
    versiculo: v('1 Timoteo 4:12', '1ti', 4, 12, 'Ninguno tenga en poco tu juventud; pero sé ejemplo de los fieles en palabra, en conversación, en caridad, en espíritu, en fe, en limpieza.'),
    ir: { label: 'Ir a las misiones', href: '/jovenes' },
    publico: 'jovenes',
  },
  {
    id: 'jovenes-profundo',
    familia: FAMILIA_MISIONES,
    titulo: 'Sobre la roca',
    como: 'Gana las tres estrellas en 5 misiones: entender, pensar y vivir.',
    logro: 'Entendiste, pensaste y viviste 5 misiones.',
    tipo: 'profunda',
    meta: 5,
    dibujo: 'ancla',
    versiculo: v('Mateo 7:24', 'mat', 7, 24, 'Cualquiera, pues, que me oye estas palabras, y las hace, le compararé a un hombre prudente, que edificó su casa sobre la peña.'),
    ir: { label: 'Ir a las misiones', href: '/jovenes' },
    publico: 'jovenes',
  },
  {
    id: 'jovenes-todas',
    familia: FAMILIA_MISIONES,
    titulo: 'Explorador',
    como: 'Termina las cinco rutas.',
    logro: 'Terminaste las cinco rutas.',
    tipo: 'ruta',
    meta: RUTAS.length,
    dibujo: 'camino',
    versiculo: v('Salmos 119:9', 'psa', 119, 9, '¿Con qué limpiará el joven su camino? Con guardar tu palabra.'),
    ir: { label: 'Ir a las misiones', href: '/jovenes' },
    publico: 'jovenes',
  },
];

/** Los sellos de las misiones, en el orden del álbum. */
export const sellosJovenes = () => SELLOS_JOVENES;

definirSellos(SELLOS_JOVENES, [{ id: FAMILIA_MISIONES, titulo: 'Misiones', subtitulo: 'Las rutas del Modo Jóvenes' }]);

/** Las huellas que corresponden a lo hecho en las misiones, por tipo. */
export function huellasMisiones(s: Estado): Record<string, string[]> {
  const out: Record<string, string[]> = { mision: [], profunda: [], ruta: [] };
  for (const [clave, r] of Object.entries(s)) {
    const [ruta, mision] = clave.split('.');
    if (!buscarMision(ruta, mision)) continue;
    out.mision.push(clave);
    (out[`ruta-${ruta}`] ??= []).push(mision);
    if (estrellas(r) === 3) out.profunda.push(clave);
  }
  for (const r of RUTAS) if (completadas(r, s) === r.misiones.length) out.ruta.push(r.id);
  return out;
}

/**
 * Deja en el álbum las huellas de lo hecho (también lo que llega de otro dispositivo). Durante una misión no se
 * llama: la pantalla lo pide al terminarla, para que la celebración de un sello no interrumpa la lectura.
 */
export const celebrarMisiones = () => load().then(() => sembrar(state));

async function sembrar(s: Estado) {
  for (const [tipo, ids] of Object.entries(huellasMisiones(s))) if (ids.length) await huellasDe(tipo as Tipo, ids);
}

/** Baraja las opciones siempre igual para la misma pregunta: la correcta no queda siempre arriba. */
export function barajar<T>(items: readonly T[], semilla: string): { item: T; original: number }[] {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619);
  const out = items.map((item, original) => ({ item, original }));
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function completar(ruta: RutaId, mision: string) {
  await load();
  const k = claveMision(ruta, mision);
  if (!state[k]) {
    write({ ...state, [k]: { fecha: todayKey() } });
    cambio();
    markStudyDay();
  }
}

export async function responder(ruta: RutaId, mision: string, respuesta: string) {
  await load();
  const k = claveMision(ruta, mision);
  const texto = respuesta.trim().slice(0, MAX_RESPUESTA);
  write({ ...state, [k]: { ...(state[k] ?? { fecha: todayKey() }), respuesta: texto || undefined } });
  cambio();
}

export async function marcarReto(ruta: RutaId, mision: string, hecho: boolean) {
  await load();
  const k = claveMision(ruta, mision);
  if (!state[k]) return;
  write({ ...state, [k]: { ...state[k], hecho: hecho ? dateKey(new Date()) : undefined } });
  cambio();
  await sembrar(state);
}

export function useJovenes() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

// --- PIN para salir del modo ---
// Un adulto puede poner un PIN de cuatro cifras: sin él no se vuelve a la app para todos. Queda solo en este
// dispositivo y no es una cerradura de seguridad: ayuda a que el modo no se cambie sin querer.

const huella = (pin: string) => {
  let h = 5381;
  for (const c of `biblia-jovenes:${pin}`) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
};

export const pinValido = (pin: string) => /^\d{4}$/.test(pin);

export async function tienePin() {
  return !!(await AsyncStorage.getItem(PIN_KEY).catch(() => null));
}

export async function ponerPin(pin: string | null) {
  if (pin === null) await AsyncStorage.removeItem(PIN_KEY).catch(() => {});
  else if (pinValido(pin)) await AsyncStorage.setItem(PIN_KEY, huella(pin)).catch(() => {});
}

export async function revisarPin(pin: string) {
  const guardado = await AsyncStorage.getItem(PIN_KEY).catch(() => null);
  return !guardado || guardado === huella(pin);
}
