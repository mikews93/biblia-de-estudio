// Pedir a mi grupo que ore y recibir ánimo, sin exponer el dolor («pornomiseria»).
//
// Las reglas: la petición va solo al grupo que la persona elige (nunca al muro de todos), puede ir sin su nombre, no
// hace falta contar detalles y deja de verse a los 30 días. Los ánimos son mensajes cortos que solo ve quien pidió:
// no hay comentarios públicos, ni «me gusta», ni ranking de quién sufre más. Lo usa también el servidor
// (api/comunidades.ts), así que no lleva React Native.

import { contiene } from './paraTi';
import { PALABRAS_RIESGO } from './temas';

/** Largo de un ánimo: unas palabras, no un sermón. */
export const MAX_ANIMO = 240;
/** Hasta aquí la petición se lee de un vistazo; más largo, se sugiere contar menos. */
export const PETICION_CORTA = 220;
/** Días que una petición abierta se ve en el grupo. Quien la pidió puede renovarla. */
export const DIAS_VISIBLE = 30;
/** Peticiones nuevas por persona y día en todos sus grupos. */
export const PETICIONES_DIA = 3;

/** Una petición del diario lista para el grupo: solo el título, que es lo que la persona ya resumió. */
export function textoSugerido(titulo: string) {
  const t = titulo.trim().replace(/[.\s]+$/, '');
  return t ? `Oren por mí: ${t.charAt(0).toLowerCase()}${t.slice(1)}.` : 'Oren por mí, estoy pasando un tiempo difícil.';
}

export type Revision = {
  /** Habla de hacerse daño: antes que al grupo, a alguien que pueda ayudar hoy. */
  riesgo: boolean;
  /** Cuenta mucho: se sugiere, sin obligar, decir menos. */
  larga: boolean;
};

export function revisarPeticion(texto: string): Revision {
  return { riesgo: contiene(texto, PALABRAS_RIESGO), larga: texto.trim().length > PETICION_CORTA };
}

/** Ánimos para tocar y enviar, o para empezar a escribir. Sin «todo pasa por algo». */
export const ANIMOS_SUGERIDOS = [
  'Estoy orando por ti hoy.',
  'Dios está contigo en esto, y nosotros también.',
  'Si quieres hablar o tomar un café, aquí estoy.',
  'Gracias por confiarnos esto. No lo cargas a solas.',
];

/** ¿Ve el grupo esta petición? Las respondidas se quedan como testimonio; las abiertas vencen. */
export function visibleEnGrupo(p: { respondida: boolean; creado: string | number }, ahora = Date.now()) {
  return p.respondida || ahora - new Date(p.creado).getTime() <= DIAS_VISIBLE * 86_400_000;
}

/** Cómo se llama a quien pidió: su nombre o, si la compartió sin nombre, «Alguien del grupo». */
export const autorVisible = (autor: string | null | undefined) => autor || 'Alguien del grupo';
