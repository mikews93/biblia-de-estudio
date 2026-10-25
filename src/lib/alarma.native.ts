// Alarma del despertador en la app nativa: notificaciones locales semanales (una por día elegido) con el sonido
// de amanecer (assets/sonidos/amanecer.wav, pipeline/despertar_alarma.py). En Android se programan como
// alarma de reloj (setAlarmClock): suenan a su minuto aunque el teléfono esté ahorrando batería y sin internet.
// Al tocarla se abre /despertar, que pone la música y lee la Palabra.
//
// Desde Android 14 el permiso de «Alarmas y recordatorios» viene apagado: sin él, la alarma puede llegar unos
// minutos tarde. Al activar el despertador se ofrece abrir ese ajuste (alarmaExacta / pedirAlarmaExacta).

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { despertarMessage, Despertador, DIAS } from './despertarTexto';

export const ALARMA_NATIVA = true;

const CANAL = 'despertar';
const SONIDO = 'amanecer.wav';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function canal() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Despertar con la Biblia',
    description: 'La alarma de la mañana con música suave y la Palabra',
    importance: Notifications.AndroidImportance.MAX,
    sound: SONIDO,
    vibrationPattern: [0, 600, 300, 600, 300, 1200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM, contentType: Notifications.AndroidAudioContentType.SONIFICATION },
  });
}

export async function permisoAlarma() {
  const actual = await Notifications.getPermissionsAsync();
  if (!actual.granted && !(await Notifications.requestPermissionsAsync()).granted) return false;
  if (!(await alarmaExacta())) await ofrecerAlarmaExacta();
  return true;
}

/** ¿Puede sonar a su minuto? Siempre en iPhone y en Android anterior al 12. */
export async function alarmaExacta() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true;
  }
}

/** Abre el ajuste «Alarmas y recordatorios» de Zarza y dice si quedó permitido al volver. */
export async function pedirAlarmaExacta() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Explica para qué es el permiso antes de mandar a la persona a los ajustes del teléfono. */
function ofrecerAlarmaExacta() {
  return new Promise<void>((resolve) => {
    Alert.alert(
      'Para que suene a su minuto',
      'Android pide un permiso más para las alarmas: «Alarmas y recordatorios». Sin él, el despertador puede sonar unos minutos tarde.',
      [
        { text: 'Ahora no', style: 'cancel', onPress: () => resolve() },
        { text: 'Permitir', onPress: () => void pedirAlarmaExacta().finally(resolve) },
      ],
      { cancelable: true, onDismiss: () => resolve() },
    );
  });
}

/** Si el despertador puede sonar a su minuto; se vuelve a mirar cuando la persona regresa a la app. */
export function useAlarmaExacta() {
  const [exacta, setExacta] = useState(true);
  useEffect(() => {
    const mirar = () => void alarmaExacta().then(setExacta);
    mirar();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && mirar());
    return () => sub.remove();
  }, []);
  return exacta;
}

/** Borra las alarmas anteriores y programa una por cada día elegido. */
export async function programarAlarma(d: Despertador, lectura?: string) {
  const programadas = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    programadas.filter((n) => n.content.data?.tipo === CANAL).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!d.activo) return;
  await canal();
  const aviso = despertarMessage({ lectura });
  const hour = Math.floor(d.hora / 60);
  const minute = d.hora % 60;
  await Promise.all(
    DIAS.filter((dia) => d.dias & (1 << dia.bit)).map((dia) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: aviso.title,
          body: aviso.body,
          sound: SONIDO,
          data: { tipo: CANAL, url: aviso.url },
          priority: Notifications.AndroidNotificationPriority.MAX,
          interruptionLevel: 'timeSensitive',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          channelId: CANAL,
          // expo-notifications cuenta del 1 (domingo) al 7 (sábado).
          weekday: dia.bit + 1,
          hour,
          minute,
          delivery: 'alarmClock',
        },
      }),
    ),
  );
}

/**
 * Al tocar una notificación (con la app abierta o cerrada) se abre su pantalla: /despertar para la alarma, y la
 * lectura, las tarjetas o la comunidad para los avisos push. Solo rutas de la propia app.
 */
export function useAbrirAlarma() {
  const ultima = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = ultima?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) router.push(url as never);
  }, [ultima]);
}
