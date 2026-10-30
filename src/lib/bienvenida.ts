import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { chapterHref } from './routes';

/**
 * La bienvenida de la primera vez (src/components/Bienvenida.tsx): tres pasos para elegir la versión, qué se quiere
 * hacer y cómo se lee mejor. Solo la ve quien abre Zarza por primera vez: si ya leyó algo, tiene cuenta o la cerró,
 * no vuelve a salir.
 */

const VISTA = 'bienvenida';

export type Meta = 'leer' | 'estudiar' | 'ensenar' | 'grupo' | 'orar';

export const METAS: { value: Meta; titulo: string; detalle: string; href: string }[] = [
  { value: 'leer', titulo: 'Leer cada día', detalle: 'Un plan corto para no perder el hilo.', href: '/planes' },
  { value: 'estudiar', titulo: 'Estudiar a fondo', detalle: 'El griego y el hebreo, conexiones y preguntas.', href: chapterHref('jhn', 1) },
  { value: 'ensenar', titulo: 'Preparar un estudio o sermón', detalle: 'El Taller te pregunta y te sugiere; el mensaje es tuyo.', href: '/taller' },
  { value: 'grupo', titulo: 'Leer con mi grupo', detalle: 'Un plan juntos, o tu iglesia con su código.', href: '/grupos' },
  { value: 'orar', titulo: 'Orar y escribir', detalle: 'Un diario para lo que Dios te habla.', href: '/diario' },
];

/** Lo que se dice de cada versión libre al elegirla. Las de API.Bible y YouVersion dicen que piden internet. */
export const SOBRE_VERSION: Record<string, string> = {
  rv1909: 'La Reina-Valera clásica, de 1909.',
  bes: 'Lenguaje sencillo, fácil de entender.',
  pdt: 'Moderna y clara, para leer de corrido.',
  rvg: 'Reina-Valera revisada por Gómez.',
  rv1865: 'La Reina-Valera de 1865.',
  blm: 'Traducción libre, en español actual.',
};

/** En las pruebas automáticas (Playwright) no sale, salvo que la URL lleve ?bienvenida=1. */
function enPruebas() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('bienvenida') === '1') return false;
  return navigator.webdriver === true;
}

export async function debeVerBienvenida(conCuenta: boolean) {
  if (conCuenta || enPruebas()) return false;
  try {
    const [vista, leido] = await Promise.all([AsyncStorage.getItem(VISTA), AsyncStorage.getItem('ultima-lectura')]);
    return !vista && !leido;
  } catch {
    return false;
  }
}

export function bienvenidaVista() {
  AsyncStorage.setItem(VISTA, new Date().toISOString()).catch(() => {});
}
