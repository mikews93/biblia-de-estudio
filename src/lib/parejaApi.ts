// Cliente de «En pareja» (api/_pareja.ts, por /api/comunidades). El estado de la pareja se comparte entre las
// pantallas como el de la cuenta, y se vuelve a pedir al entrar a cada una.

import { useCallback, useEffect, useState } from 'react';

import { api, useAccount } from './comunidad';
import type { Cordon, Progreso } from './pareja';
import type { Etapa } from './parejaPlanes';
import { huella, huellasDe } from './sellos';
import { origenCompartir } from './sitio';

export type Pareja = {
  id: string;
  etapa: Etapa;
  plan: string;
  soyQuienInvito: boolean;
  /** El código mientras la invitación espera; null cuando ya están unidos. */
  codigo: string | null;
  otro: { nombre: string; foto: string | null } | null;
  hechos?: Record<number, string>;
  progreso?: Progreso;
  respondi?: number[];
  respondio?: number[];
  /** Plan → días hechos juntos. */
  planes?: Record<string, number>;
  cordon?: Cordon;
  pedidos?: { mio: string | null; suyo: string | null };
  oreHoy?: boolean;
  oroHoy?: boolean;
  /** Las adivinanzas que el otro ya marcó, y cuántas acertaron (de los dos juntos). */
  adivinanzas?: { marcadas: number; aciertos: number };
};

/** 0 no, 1 casi, 2 ¡acertaste! (lo marca quien fue adivinado). */
export type Acierto = 0 | 1 | 2;
export type Respuesta = { texto: string; fecha: string; adivino: string | null; acierto: Acierto | null };
export type DiaRespuestas = { abierto: boolean; mia: Respuesta | null; suya: Respuesta | null; suyaEspera: boolean };

let current: Pareja | null | undefined;
const listeners = new Set<() => void>();

function set(p: Pareja | null) {
  current = p;
  listeners.forEach((l) => l());
  if (p?.planes) sellos(p);
}

/** Los días y planes hechos juntos dejan su huella en Mis sellos (src/lib/sellos.ts). */
function sellos(p: Pareja) {
  // Una huella por cada día hecho juntos, en todos los planes (los nudos del cordón)
  const nudos = p.cordon?.nudos ?? 0;
  if (nudos) huellasDe('pareja-dia', Array.from({ length: nudos }, (_, i) => `${p.id}.${i + 1}`)).catch(() => {});
  for (const [plan, n] of Object.entries(p.planes ?? {})) if (n >= 7) huella('pareja', plan).catch(() => {});
}

async function call(accion: string, body: Record<string, unknown> = {}) {
  const r = await api<{ pareja: Pareja | null }>(accion, body);
  set(r.pareja);
  return r.pareja;
}

export const refreshPareja = () => call('parejaEstado');
export const invitar = (etapa: Etapa) => call('parejaInvitar', { etapa });
export const unirse = (codigo: string) => call('parejaUnirse', { codigo });
export const elegirPlan = (plan: string) => call('parejaPlan', { plan });
export const cambiarEtapa = (etapa: Etapa) => call('parejaEtapa', { etapa });
export const guardarPedido = (texto: string) => call('parejaPedido', { texto });
export const ore = () => call('parejaOre');
export const salir = () => call('parejaSalir');

export const verCodigo = (codigo: string) =>
  api<{ nombre: string; foto: string | null; etapa: Etapa; esMio: boolean }>('parejaVerCodigo', { codigo });

export const leerDia = (plan: string, dia: number) => api<DiaRespuestas>('parejaDia', { plan, dia });

export async function responder(plan: string, dia: number, texto: string, adivino?: string) {
  await api('parejaResponder', { plan, dia, texto, adivino });
  await refreshPareja().catch(() => {});
}

export async function borrarRespuesta(plan: string, dia: number) {
  await api('parejaBorrarRespuesta', { plan, dia });
  await refreshPareja().catch(() => {});
}

export async function marcarAcierto(plan: string, dia: number, valor: Acierto) {
  await api('parejaAcierto', { plan, dia, valor });
  await refreshPareja().catch(() => {});
}

/** El enlace de invitación que se comparte fuera de la app. */
export function enlacePareja(codigo: string) {
  const origin = origenCompartir();
  return `${origin}/pareja/unirse/${codigo}`;
}

/**
 * La pareja de la cuenta: undefined mientras carga, null si no hay. Se pide de nuevo cada vez que se monta una
 * pantalla (y con `reload`), porque lo que el otro hace no llega solo.
 */
export function usePareja() {
  const { usuario, ready } = useAccount();
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    if (!usuario) return Promise.resolve();
    return refreshPareja()
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message));
  }, [usuario]);

  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!usuario) current = undefined;
  }, [usuario]);

  return { pareja: usuario ? current : null, cuenta: usuario, listo: ready, error, reload };
}
