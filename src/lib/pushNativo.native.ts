// Notificaciones push de la app nativa: la dirección del teléfono es un token de Expo (ExponentPushToken[…]) que
// se guarda en /api/notificaciones como cualquier otra suscripción, y el servidor lo envía por el servicio de
// Expo (api/_push.ts). Hace falta el projectId de EAS en app.json (`eas init`) y, en Android, la clave de
// Firebase (FCM) guardada en EAS; sin projectId la app sigue diciendo «Pronto en esta app».

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const projectId: string | undefined =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

export const PUSH_NATIVO = Boolean(projectId);

/** El canal de Android de los recordatorios y los avisos de la comunidad (el despertador tiene el suyo). */
export const CANAL_AVISOS = 'avisos';

async function canal() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_AVISOS, {
    name: 'Recordatorios y avisos',
    description: 'La lectura del día, las tarjetas para repasar y los avisos de tu comunidad',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * La dirección de este teléfono. Con `pedir`, pregunta el permiso si aún no lo dio; sin él, solo la devuelve si
 * el permiso sigue concedido (al abrir la app). Lanza si la persona dijo que no.
 */
export async function tokenNativo(pedir: boolean): Promise<string | null> {
  if (!projectId) return null;
  let permiso = await Notifications.getPermissionsAsync();
  if (!permiso.granted && pedir && permiso.canAskAgain) permiso = await Notifications.requestPermissionsAsync();
  if (!permiso.granted) {
    if (!pedir) return null;
    throw new Error('Las notificaciones están apagadas para Zarza. Permítelas en los ajustes del teléfono.');
  }
  await canal();
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
