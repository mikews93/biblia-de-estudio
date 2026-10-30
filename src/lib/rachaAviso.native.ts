// Aviso para no perder la racha devocional en la app nativa: una notificación local la noche del último día de la
// racha (src/lib/rachaTexto.ts), a las 8. Se vuelve a programar cada vez que la racha cambia: al terminar el
// devocional de hoy, el aviso pasa al siguiente último día. Solo si la persona ya dio permiso para notificaciones
// (por ejemplo, con el despertador) y no apagó el aviso de la racha.

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAvisos } from './avisos';
import { enSilencio } from './avisosTexto';
import { HORA_RACHA, Racha, rachaMessage, rachaParaAvisos } from './rachaTexto';
import { useTranquila } from './tranquila';

const TIPO = 'racha';

async function programar(racha: Racha, activo: boolean) {
  const programadas = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    programadas.filter((n) => n.content.data?.tipo === TIPO).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  const estado = rachaParaAvisos(racha);
  if (!activo || !estado || !(await Notifications.getPermissionsAsync()).granted) return;
  const [y, m, d] = estado.vence.split('-').map(Number);
  const cuando = new Date(y, m - 1, d, Math.floor(HORA_RACHA / 60), HORA_RACHA % 60);
  if (cuando.getTime() <= Date.now()) return;
  const aviso = rachaMessage(estado.dias);
  await Notifications.scheduleNotificationAsync({
    content: { title: aviso.title, body: aviso.body, data: { tipo: TIPO, url: aviso.url } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: cuando },
  });
}

export function useAvisoRacha(racha: Racha) {
  const { avisos, ready, silencio } = useAvisos();
  const tranquila = useTranquila();
  // Ni en «Lectura tranquila» ni si las ocho de la noche caen en el horario de silencio
  const activo = avisos.racha !== false && !tranquila && !(silencio.activo && enSilencio(HORA_RACHA, silencio.desde, silencio.hasta));
  useEffect(() => {
    if (ready) programar(racha, activo).catch(() => {});
  }, [racha.actual, racha.vence, activo, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al tocar el aviso se abre Mi diario con el devocional de hoy.
  const ultima = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const data = ultima?.notification.request.content.data;
    if (data?.tipo === TIPO && typeof data.url === 'string') router.push(data.url as never);
  }, [ultima]);
}
