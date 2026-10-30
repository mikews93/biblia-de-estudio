import { Platform } from 'react-native';

// «Sostén Zarza»: cómo se paga la app sin anuncios ni cobros (ver /mnt/project-files/investigacion/zarza-estrategia.md).
// Lo llena Mike a mano: cuando abra el colectivo o cambie el gasto del mes, se cambia aquí y se publica.

export type Fondo = {
  /** El mes que muestra la barra, por ejemplo «octubre de 2026». */
  mes: string;
  /** El mismo mes como «2026-10»: si es el mes en curso y está cubierto, Zarza deja de invitar a sembrar. */
  clave: string;
  /** Lo que costaron la IA, las voces y los servidores ese mes, en dólares. */
  gasto: number;
  /** Lo que cubrieron los aportes ese mes, en dólares. */
  cubierto: number;
  /** En qué se gastó, factura por factura: «IA (Anthropic)», 84. */
  partidas?: { concepto: string; monto: number }[];
  /** Cuántas personas sembraron ese mes (sin nombres ni montos). */
  sembradores?: number;
  /** Lo que el aporte hizo posible ese mes, en una línea: «Se dramatizó el libro de Rut». */
  logro?: string;
};

/** La barra de la lámpara de la comunidad. Sin datos todavía, no se muestra. */
export const FONDO: Fondo | null = null;

/**
 * Enlaces de pago de Stripe (Payment Links del producto «Sostén Zarza» de MB Technology Solutions LLC).
 * Cada mes: 1, 3 o 5 dólares. Una vez: el monto que la persona quiera (desde 1 dólar, sugiere 10).
 */
export const STRIPE_MENSUAL: { monto: number; enlace: string }[] = [
  { monto: 1, enlace: 'https://buy.stripe.com/3cI8wO2HybmT3cnd3RcEw02' },
  { monto: 3, enlace: 'https://buy.stripe.com/aFaeVc0zq4YveV50h5cEw03' },
  { monto: 5, enlace: 'https://buy.stripe.com/aFacN4fukgHd6oz6FtcEw04' },
];
export const STRIPE_UNA_VEZ: string | null = 'https://donate.stripe.com/eVqdR80zqbmT5kv8NBcEw01';

/** Perfil de GitHub Sponsors, por ejemplo https://github.com/sponsors/mikews93, cuando GitHub lo apruebe. */
export const ENLACE_GITHUB: string | null = null;

/**
 * Dónde cambia o cancela su aporte mensual quien siembra: el enlace de inicio de sesión del portal de cliente de
 * Stripe. Mientras sea null, se cancela escribiendo a CORREO_SOSTENER.
 */
export const ENLACE_CANCELAR: string | null = null;
export const CORREO_SOSTENER = 'zarza@migueblanco.com';

/** Hay al menos una forma de aportar abierta. */
export const HAY_APORTES = !!(STRIPE_MENSUAL.length || STRIPE_UNA_VEZ || ENLACE_GITHUB);

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

/** «2026-10» para una fecha. */
export const claveMes = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * La «regla de Éxodo 36» (Éx 36:5-7: «el pueblo trae mucho más de lo que se necesita»): con el mes en curso
 * cubierto, Zarza lo dice y deja de invitar a sembrar hasta el mes siguiente.
 */
export const mesCubierto = (f: Fondo | null = FONDO, hoy = new Date()) => !!f && f.clave === claveMes(hoy) && cubierta(f) >= 1;
