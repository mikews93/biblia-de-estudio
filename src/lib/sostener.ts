import { Platform } from 'react-native';

// «Sostén Zarza»: cómo se paga la app sin anuncios ni cobros (ver /mnt/project-files/investigacion/zarza-estrategia.md).
// Lo llena Mike a mano: cuando abra el colectivo o cambie el gasto del mes, se cambia aquí y se publica.

export type Fondo = {
  /** El mes que muestra la barra, por ejemplo «octubre de 2026». */
  mes: string;
  /** Lo que costaron la IA, las voces y los servidores ese mes, en dólares. */
  gasto: number;
  /** Lo que cubrieron los aportes ese mes, en dólares. */
  cubierto: number;
};

/** La barra de la lámpara de la comunidad. Sin datos todavía, no se muestra. */
export const FONDO: Fondo | null = null;

/** Dónde se aporta (Open Collective o GitHub Sponsors). Sin enlace, el botón dice «Muy pronto». */
export const ENLACE_APORTES: string | null = null;

/** Dónde escribe una iglesia que quiere ser anfitriona o apadrinar un libro. */
export const ENLACE_IGLESIAS: string | null = null;

/**
 * Solo en la web: en iPhone, Apple no deja enlazar a donaciones fuera de la app salvo a organizaciones sin fines de
 * lucro aprobadas, y en Android Google pide su sistema de pagos. Hasta que Zarza sea una organización, la página no
 * aparece en las apps de las tiendas.
 */
export const HAY_SOSTENER = Platform.OS === 'web';

/** Qué parte del gasto del mes está cubierta, de 0 a 1. */
export const cubierta = (f: Fondo) => (f.gasto > 0 ? Math.min(1, f.cubierto / f.gasto) : 1);
