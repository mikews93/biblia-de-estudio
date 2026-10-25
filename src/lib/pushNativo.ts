// Notificaciones push de la app nativa (Expo). En la web no se usan: ahí van por Web Push (src/lib/avisos.ts y
// public/sw.js). La versión de verdad está en pushNativo.native.ts.

/** ¿Puede esta app pedir su dirección de notificaciones? En la web, nunca. */
export const PUSH_NATIVO = false;

/** Pide permiso y devuelve la dirección de este teléfono (ExponentPushToken[…]). */
export async function tokenNativo(_pedir: boolean): Promise<string | null> {
  return null;
}
