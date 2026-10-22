// Cliente de «Cuidar Zarza» (api/_cuidar.ts): solo responde a quienes cuidan la app (CUIDADORES en Vercel).

import { api } from './comunidad';
import { Motivo } from './senales';

export type Raro = {
  clave: string;
  raros: number;
  ayudo: number;
  motivos: Motivo[];
  notas: string[];
  enfoque: string;
  libro: string;
  capitulo: number;
  versiculo: number | null;
  palabra: number | null;
};
export type PasajePendiente = { libro: string; capitulo: number; personas: number; nuevas: number };
export type IglesiaCuidada = { id: string; nombre: string; ciudad: string | null; codigo: string; lampara: number; activa: boolean; miembros: number };
export type Resumen = { minPersonas: number; raros: Raro[]; pasajes: PasajePendiente[]; frecuentes: number; iglesias: IglesiaCuidada[] };
export type PreguntaAnonima = { versiculo: number | null; texto: string; quien: string; dia: string; nueva: boolean };
export type FrecuenteCuidada = { id: number; versiculo: number | null; texto: string; personas: number };
export type Propuesta = { texto: string; versiculo: number | null; personas: number };

export const resumen = () => api<Resumen>('cuidarResumen');
export const detallePasaje = (libro: string, capitulo: number) =>
  api<{ minPersonas: number; preguntas: PreguntaAnonima[]; frecuentes: FrecuenteCuidada[] }>('cuidarPasaje', { libro, capitulo });
export const proponer = (libro: string, capitulo: number) => api<{ propuestas: Propuesta[] }>('cuidarProponer', { libro, capitulo });
export const aprobar = (libro: string, capitulo: number, p: Propuesta) =>
  api<{ id: number }>('cuidarAprobar', { libro, capitulo, versiculo: p.versiculo, texto: p.texto, personas: p.personas });
export const quitarFrecuente = (id: number) => api('cuidarQuitarFrecuente', { id });
export const marcarRevisado = (libro: string, capitulo: number) => api('cuidarRevisado', { libro, capitulo });
export const rehacer = (clave: string) => api('cuidarRehacer', { clave });
export const descartar = (clave: string) => api('cuidarDescartar', { clave });
export const nuevaIglesia = (nombre: string, ciudad: string, lampara: number) =>
  api<{ iglesia: IglesiaCuidada }>('cuidarNuevaIglesia', { nombre, ciudad, lampara });
export const cambiarIglesia = (id: string, cambio: { activa?: boolean; lampara?: number }) => api('cuidarIglesia', { id, ...cambio });
