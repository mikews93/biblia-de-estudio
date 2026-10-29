// «Zarza para Iglesias» (api/_iglesias.ts): una iglesia anfitriona sostiene Zarza y sus miembros, que entran con su
// código o su QR, tienen más preguntas a la IA al día.

import { api, refreshGroups } from './comunidad';

// En web la función vive en el mismo dominio; en el teléfono, en la web publicada.
const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type IglesiaPublica = { nombre: string; ciudad: string | null; codigo: string; lampara: number; miembros: number };

/** El enlace que abre el QR de la iglesia. */
export function enlaceIglesia(codigo: string) {
  const origin = typeof location !== 'undefined' ? location.origin : API || 'https://zarzabiblia.com';
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

// ——— Postular una iglesia y ser su encargado ———

/** Lo que una iglesia acepta al postularse. La revisa una persona de Cuidar Zarza antes de aprobarla. */
export const DECLARACION_FE =
  'Creemos en un solo Dios, eterno en tres personas: Padre, Hijo y Espíritu Santo. Jesucristo es Dios hecho hombre: ' +
  'murió por nuestros pecados y resucitó. La Biblia es la Palabra de Dios, y la salvación es por gracia, por medio de la fe.';

export type DatosPostulacion = {
  nombre: string;
  ciudad: string;
  direccion: string;
  denominacion: string;
  responsable: string;
  cargo: string;
  contacto: string;
  enlace: string;
  mensaje: string;
};
export type Postulacion = { id: string; nombre: string; estado: 'pendiente' | 'aprobada' | 'rechazada'; motivo: string | null };
export type IglesiaEncargada = IglesiaPublica & { activa: boolean; pausa: string | null; semana: number };

export const postularIglesia = (datos: DatosPostulacion) =>
  api<{ postulacion: Postulacion }>('iglesiaPostular', { ...datos, fe: true });

export const miEncargo = () => api<{ postulacion: Postulacion | null; iglesia: IglesiaEncargada | null }>('iglesiaEncargo');

export const nuevoCodigoIglesia = () => api<{ codigo: string }>('iglesiaNuevoCodigo');
