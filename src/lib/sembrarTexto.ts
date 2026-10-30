// Cuándo Zarza invita a sembrar, sin presión (investigación del 2026-10-30, paquete B que eligió Mike):
// una tarjeta suave en Hoy, como mucho una vez al año, después de un buen momento. Nunca a quien ya aporta,
// nunca con «Lectura tranquila», nunca a quien llegó hace poco y nunca si el mes ya está cubierto
// (la «regla de Éxodo 36»: cuando hay lo suficiente, se deja de pedir).

export type Momento = 'plan' | 'aniversario' | 'diciembre';

export type Invitacion = { momento: Momento; titulo: string; texto: string };

export type Recuerdo = {
  /** El primer día que esta persona abrió Hoy (desde que existe esta tarjeta). */
  desde?: string;
  /** El último día que vio la invitación y la respondió («Quiero sembrar» o «Ahora no»). */
  respondida?: string;
  /** Volvió de Stripe a la pantalla de gracias en este dispositivo. */
  aporta?: boolean;
};

export type Contexto = Recuerdo & {
  /** Hoy, «2026-12-04». */
  hoy: string;
  /** Hay forma de aportar en esta plataforma (solo en la web, hasta que Zarza sea una organización). */
  abierto: boolean;
  tranquila: boolean;
  /** La comunidad ya cubrió el gasto de este mes. */
  mesCubierto: boolean;
  /** Planes terminados: su título y la fecha en que se terminaron. */
  terminados: { title: string; finished: string }[];
  chaptersRead: number;
};

/** Días entre dos fechas «AAAA-MM-DD». */
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** No se invita a quien llegó hace menos de un mes. */
export const DIAS_DE_GRACIA = 30;
/** Entre una invitación respondida y la siguiente. */
export const DIAS_ENTRE_INVITACIONES = 365;
/** Un plan terminado cuenta como buen momento durante una semana. */
const DIAS_DEL_PLAN = 7;

const CIERRE = 'La sostienen personas que la usan, como tú. Si algún día quieres ser parte, aquí está. Y si no, sigue leyendo: es tuya igual.';

/** La invitación que toca hoy, o null si no toca. */
export function invitacionDeHoy(c: Contexto): Invitacion | null {
  if (!c.abierto || c.aporta || c.tranquila || c.mesCubierto || !c.desde) return null;
  if (diasEntre(c.desde, c.hoy) < DIAS_DE_GRACIA) return null;
  if (c.respondida && diasEntre(c.respondida, c.hoy) < DIAS_ENTRE_INVITACIONES) return null;

  const plan = c.terminados
    .filter((p) => {
      const d = diasEntre(p.finished, c.hoy);
      return d >= 0 && d < DIAS_DEL_PLAN;
    })
    .sort((a, b) => b.finished.localeCompare(a.finished))[0];
  if (plan) {
    return {
      momento: 'plan',
      titulo: `Terminaste «${plan.title}»`,
      texto: `Zarza existe para momentos así, sin anuncios y sin cobrar. ${CIERRE}`,
    };
  }
  if (diasEntre(c.desde, c.hoy) >= 365) {
    return {
      momento: 'aniversario',
      titulo: 'Ya llevas un año con Zarza',
      texto: `Gracias por leer con nosotros. Zarza sigue sin anuncios y sin cobrar. ${CIERRE}`,
    };
  }
  if (c.hoy.slice(5, 7) === '12' && c.chaptersRead >= 10) {
    return {
      momento: 'diciembre',
      titulo: 'Cerrando el año con la Palabra',
      texto: `Ya leíste ${c.chaptersRead} capítulos en Zarza, sin anuncios y sin cobrar. ${CIERRE}`,
    };
  }
  return null;
}
