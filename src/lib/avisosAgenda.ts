// Cuándo vuelve a tocar algún aviso. El programador externo llama a /api/notificaciones?accion=enviar cada minuto
// (por el despertador), y si cada llamada consultara la base de datos, Neon nunca se dormiría: con el plan gratis eso
// gastaba casi todo el cómputo del mes. Con esta agenda, la función solo despierta la base cuando algo puede tocar
// (recordatorio, despertador, «10 minutos más» o racha), cuando alguien cambió sus avisos o, como red de seguridad,
// cada REVISAR_CADA minutos.

import { enSilencio, isDue, localNow } from './avisosTexto';
import { despertarDue } from './despertarTexto';
import { EstadoRacha, rachaDue } from './rachaTexto';

/** Cada cuánto se vuelve a mirar la base aunque la agenda diga que no toca nada (cambios hechos en otra instancia). */
export const REVISAR_CADA = 3 * 60;

export type FilaAgenda = {
  zona: string;
  hora: number;
  lectura: boolean;
  tarjetas: boolean;
  reto: boolean;
  racha: boolean;
  estado: { racha?: EstadoRacha } | null;
  enviado: string | null;
  racha_enviado: string | null;
  despertar: number | null;
  despertar_dias: number;
  despertar_enviado: string | null;
  pospuesto: Date | string | null;
  silencio_desde: number | null;
  silencio_hasta: number | null;
};

/** ¿Le toca algo a esta suscripción en este instante? Las mismas reglas que usa la ronda de envío. */
export function algoToca(s: FilaAgenda, now: Date) {
  if (despertarDue(s, now).due) return true;
  if (s.racha) {
    const local = localNow(s.zona, now);
    if (!enSilencio(local.minutos, s.silencio_desde, s.silencio_hasta) && rachaDue(s.estado?.racha, local, s.racha_enviado)) return true;
  }
  return (s.lectura || s.tarjetas || s.reto) && isDue(s, now).due;
}

/**
 * El primer minuto (en ms) después de «desde» en que a alguna suscripción le toca algo, sin pasar de «hasta».
 * Las filas deben reflejar lo que ya se envió en esta ronda. Si nada toca antes, devuelve «hasta».
 */
export function proximoAviso(subs: FilaAgenda[], desde: Date, hasta: number) {
  const inicio = Math.floor(desde.getTime() / 60_000) * 60_000 + 60_000;
  for (let t = inicio; t < hasta; t += 60_000) {
    const now = new Date(t);
    if (subs.some((s) => algoToca(s, now))) return t;
  }
  return hasta;
}
