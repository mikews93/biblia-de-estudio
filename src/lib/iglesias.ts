// «Zarza para Iglesias» (api/_iglesias.ts): una iglesia anfitriona sostiene Zarza y sus miembros, que entran con su
// código o su QR, tienen más preguntas a la IA al día.

import { api, refreshGroups } from './comunidad';

// En web la función vive en el mismo dominio; en el teléfono, en la web publicada.
const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type IglesiaPublica = { nombre: string; ciudad: string | null; codigo: string; lampara: number; miembros: number };

/** El enlace que abre el QR de la iglesia. */
export function enlaceIglesia(codigo: string) {
  const origin = typeof location !== 'undefined' ? location.origin : API || 'https://biblia.migueblanco.com';
  return `${origin}/iglesia/${codigo}`;
}

export const verIglesia = (codigo: string) =>
  api<{ iglesia: IglesiaPublica; soyMiembro: boolean; otra: string | null }>('iglesiaVer', { codigo });

export const miIglesia = () => api<{ iglesia: IglesiaPublica | null }>('iglesiaMia');

export async function unirmeIglesia(codigo: string) {
  const r = await api<{ iglesia: IglesiaPublica }>('iglesiaUnirme', { codigo });
  await refreshGroups();
  return r.iglesia;
}

export async function salirIglesia() {
  await api('iglesiaSalir');
  await refreshGroups();
}
