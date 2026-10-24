// Alarma del despertador en la app nativa: notificaciones locales semanales (una por día elegido) con el sonido
// de amanecer (assets/sonidos/amanecer.wav, pipeline/despertar_alarma.py). En Android se programan como
// alarma de reloj (setAlarmClock): suenan a su minuto aunque el teléfono esté ahorrando batería y sin internet.
// Al tocarla se abre /despertar, que pone la música y lee la Palabra.

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

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
  if (actual.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
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

/** Al tocar la alarma (con la app abierta o cerrada) se abre la pantalla de despertar. */
export function useAbrirAlarma() {
  const ultima = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = ultima?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/despertar')) router.push(url as never);
  }, [ultima]);
}
