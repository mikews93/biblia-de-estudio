// Cliente de las señales de un toque de /api/estudiar (api/_senales.ts): «Me ayudó», «Algo suena raro» y las
// preguntas frecuentes de un pasaje. Sin cuenta no hay señales (el estudio con IA ya la pide).

import { sessionKey } from './comunidad';
import { getSettings } from './theme';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type Pasaje = { book: string; chapter: number; verse?: number; word?: number; enfoque: 'devocional' | 'profundo' };
export type Frecuente = { id: number; texto: string; versiculo: number | null };
export type Senales = { ayudo: number; mio: { ayudo: boolean; raro: boolean }; frecuentes: Frecuente[] };
export type Motivo = 'texto' | 'doctrina' | 'dato' | 'otro';

export const MOTIVOS: { value: Motivo; label: string }[] = [
  { value: 'texto', label: 'No es lo que dice el texto' },
  { value: 'doctrina', label: 'Una enseñanza dudosa' },
  { value: 'dato', label: 'Un dato equivocado' },
  { value: 'otro', label: 'Otra cosa' },
];

async function post(pasaje: Pasaje, extra: object): Promise<Senales | null> {
  const llave = await sessionKey();
  if (!llave) return null;
  const res = await fetch(`${API}/api/estudiar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llave}` },
    body: JSON.stringify({
      ...pasaje,
      // Cada versión tiene su estudio (api/estudiar.ts, clave): las señales van al que la persona está leyendo.
      version: getSettings().version,
      // El estudio del Modo Jóvenes es otro: sus señales también.
      ...(getSettings().modo === 'jovenes' ? { publico: 'jovenes' } : {}),
      ...extra,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? 'No se pudo enviar. Inténtalo de nuevo.');
  return json as Senales;
}

export const leerSenales = (pasaje: Pasaje) => post(pasaje, { senales: true });

export const marcarAyudo = (pasaje: Pasaje, quitar = false) => post(pasaje, { senal: { tipo: 'ayudo', quitar } });

export const reportarRaro = (pasaje: Pasaje, motivo: Motivo, nota: string) =>
  post(pasaje, { senal: { tipo: 'raro', motivo, nota: nota.trim() || undefined } });

export const quitarRaro = (pasaje: Pasaje) => post(pasaje, { senal: { tipo: 'raro', quitar: true } });
