// Invitar amigos a Zarza con un enlace: zarzabiblia.com/i/CODIGO, con el mismo código de amistad de /amigo.
// Quien lo abre conoce la app sin cuenta; si crea la suya (o entra), queda como amigo de quien lo compartió.
// El código se guarda en el teléfono al abrir el enlace, así la amistad se hace aunque la cuenta se cree más tarde
// o el proveedor (Google, Facebook) vuelva a otra pantalla: <InvitacionSync /> la completa al aparecer la cuenta.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './comunidad';
import { SITIO } from './sitio';
import type { Relacion } from './social';

/** El dominio de Zarza para los enlaces que se comparten, sea cual sea la dirección donde se abrió la app. */
export const SITIO_INVITAR = SITIO;

export const inviteUrl = (codigo?: string | null) => (codigo ? `${SITIO_INVITAR}/i/${codigo}` : SITIO_INVITAR);

/** La dirección como se lee, sin «https://». */
export const shortUrl = (url: string) => url.replace(/^https?:\/\//, '');

export type EstiloMensaje = 'sencillo' | 'versiculo' | 'grupo';

export const ESTILOS: { value: EstiloMensaje; label: string }[] = [
  { value: 'sencillo', label: 'Sencillo' },
  { value: 'versiculo', label: 'Con un versículo' },
  { value: 'grupo', label: 'Para un grupo' },
];

/** El texto que se comparte, con el enlace dentro (ver shareMessage en src/lib/compartir.ts). */
export function inviteMessage(estilo: EstiloMensaje, url: string) {
  switch (estilo) {
    case 'versiculo':
      return `«¡Mirad cuán bueno y cuán delicioso es habitar los hermanos igualmente en uno!» (Salmo 133:1)\n\nLeamos la Biblia juntos en Zarza. Es gratis: ${url}`;
    case 'grupo':
      return `Les comparto Zarza, una Biblia de estudio gratis: griego y hebreo, referencias, audio y planes para leer en grupo. Únanse con mi enlace: ${url}`;
    default:
      return `Estoy leyendo la Biblia con Zarza y me encantaría que me acompañes. Es gratis: ${url}`;
  }
}

/** Para abrir WhatsApp con el mensaje escrito (en el teléfono abre la app; en el computador, WhatsApp Web). */
export const whatsappUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

/** Deja solo letras y números en mayúscula, como los guarda el servidor. */
export const cleanCode = (codigo: unknown) =>
  String(codigo ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const KEY = 'invitacion';

/** Recuerda la invitación abierta hasta que haya cuenta para aceptarla. */
export async function savePending(codigo: string) {
  const c = cleanCode(codigo);
  if (c) await AsyncStorage.setItem(KEY, c).catch(() => {});
}

export const getPending = () => AsyncStorage.getItem(KEY).catch(() => null);
const clearPending = () => AsyncStorage.removeItem(KEY).catch(() => {});

export type Aceptada = { id: string; nombre: string; relacion: Relacion; codigo: string };

let inflight: Promise<Aceptada | null> | null = null;

/**
 * Acepta la invitación guardada con la cuenta actual. Devuelve a quién (o null si no había ninguna). Se borra
 * también si ya no sirve (enlace propio o persona que no existe), para no reintentarla en cada arranque.
 */
export function acceptPending(): Promise<Aceptada | null> {
  inflight ??= (async () => {
    const codigo = await getPending();
    if (!codigo) return null;
    try {
      const r = await api<Omit<Aceptada, 'codigo'>>('aceptarInvitacion', { codigo });
      await clearPending();
      return { ...r, codigo };
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 400 || status === 404) await clearPending();
      throw e;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
