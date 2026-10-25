// Alarma del despertador en el teléfono. En la web no hace nada: ahí el despertador llega por push desde el
// servidor (api/notificaciones.ts). La versión de la app nativa está en alarma.native.ts.

import type { Despertador } from './despertarTexto';

/** ¿Suena una alarma del propio teléfono (sin internet y a su minuto)? Solo en la app nativa. */
export const ALARMA_NATIVA = false;

/** Pide permiso para avisar. En la web lo pide avisos.activar(). */
export async function permisoAlarma(): Promise<boolean> {
  return false;
}

export async function programarAlarma(_d: Despertador, _lectura?: string): Promise<void> {}

/** En la web no hay permiso de alarmas exactas: el aviso lo manda el servidor. */
export async function alarmaExacta(): Promise<boolean> {
  return true;
}

export async function pedirAlarmaExacta(): Promise<boolean> {
  return true;
}

export function useAlarmaExacta() {
  return true;
}

/** Al tocar una notificación nativa se abre su pantalla. En la web lo hace el service worker. */
export function useAbrirAlarma() {}
