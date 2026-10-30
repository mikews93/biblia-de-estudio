// Cliente de la pestaña Comunidad: amigos, el muro de publicaciones, «me gusta» y comentarios.
// Usa la misma cuenta y la misma función que los grupos (src/lib/comunidad.ts).

import { HighlightColor } from './highlights';
import type { DatosImagen } from './compartir';
import { api, type TipoGrupo } from './comunidad';

export type TipoPublicacion = 'lectura' | 'resaltado' | 'imagen' | 'pregunta' | 'reflexion';
export type Audiencia = 'amigos' | 'todos';
export type Relacion = 'yo' | 'amigos' | 'enviada' | 'recibida' | 'bloqueada' | null;

export type Publicacion = {
  id: string;
  tipo: TipoPublicacion;
  audiencia: Audiencia;
  libro: string | null;
  libroNombre: string | null;
  capitulo: number | null;
  versiculo: number | null;
  version: string | null;
  cita: string | null;
  texto: string | null;
  datos: { capitulos?: number[]; color?: HighlightColor } & DatosImagen;
  creado: string;
  actualizado: string;
  autorId: string;
  autor: string;
  autorFoto: string | null;
  /** Racha devocional viva del autor: su foto brilla (components/comunidad/ui.tsx). */
  autorRacha?: number;
  autorServicio?: number;
  mia: boolean;
  meGusta: number;
  yoMeGusta: boolean;
  comentarios: number;
};

export type Comentario = {
  id: string;
  texto: string;
  creado: string;
  autorId: string;
  autor: string;
  autorFoto: string | null;
  /** Racha devocional viva del autor: su foto brilla (components/comunidad/ui.tsx). */
  autorRacha?: number;
  autorServicio?: number;
  mio: boolean;
};
export type PersonaBreve = { id: string; nombre: string; foto: string | null; racha?: number; servicio?: number };
export type Red = {
  codigo: string;
  compartirLecturas: boolean;
  amigos: PersonaBreve[];
  recibidas: PersonaBreve[];
  enviadas: PersonaBreve[];
  sugerencias: (PersonaBreve & { grupo: string })[];
  /** Las personas que bloqueaste (servidores viejos no la envían). */
  bloqueadas?: PersonaBreve[];
  /** Versículos que te enviaron y aún no abriste. */
  versiculosNuevos?: number;
  /** Quienes se unieron a Zarza con tu enlace de invitación (src/lib/invitar.ts). */
  invitados?: PersonaBreve[];
};
export type Persona = PersonaBreve & {
  bio: string | null;
  iglesia: string | null;
  ciudad: string | null;
  amigos: number;
  relacion: Relacion;
  /** Los grupos que compartes con esta persona (en tu propio perfil, todos los tuyos). */
  grupos?: { id: string; nombre: string; tipo: TipoGrupo; miembros: number }[];
};

export type NuevaPublicacion = {
  tipo: Exclude<TipoPublicacion, 'lectura'>;
  audiencia: Audiencia;
  texto?: string;
  libro?: string;
  capitulo?: number;
  versiculo?: number;
  version?: string;
  datos?: Publicacion['datos'];
};

export const wall = (filtro: Audiencia, antes?: string) =>
  api<{ publicaciones: Publicacion[] }>('muro', { filtro, antes }).then((r) => r.publicaciones);
export const getPost = (id: string) => api<{ publicacion: Publicacion; comentarios: Comentario[] }>('publicacion', { id });
export const publish = (p: NuevaPublicacion) => api<{ id: string }>('publicar', p);
export const deletePost = (id: string) => api('borrarPublicacion', { id });
export const like = (id: string, si: boolean) => api('meGusta', { id, si });
export const comment = (id: string, texto: string) => api<{ id: string }>('comentar', { id, texto });
export const deleteComment = (id: string) => api('borrarComentario', { id });
export const report = (id: string) => api('reportar', { id });

export const network = () => api<Red>('amigos');
export const personByCode = (codigo: string) =>
  api<{ persona: PersonaBreve }>('verCodigoAmigo', { codigo }).then((r) => r.persona);
export const askFriend = (to: { usuario: string } | { codigo: string }) =>
  api<{ id: string; relacion: Relacion }>('pedirAmistad', to);
export const answerFriend = (usuario: string, aceptar: boolean) => api('responderAmistad', { usuario, aceptar });
export const removeFriend = (usuario: string) => api('quitarAmigo', { usuario });
export const block = (usuario: string) => api<{ relacion: Relacion }>('bloquear', { usuario });
export const unblock = (usuario: string) => api<{ relacion: Relacion }>('desbloquear', { usuario });
export const setShareReadings = (si: boolean) => api('compartirLecturas', { si });
export const getPerson = (usuario: string) =>
  api<{ persona: Persona; publicaciones: Publicacion[] }>('persona', { usuario });

/** Enlace para que alguien te agregue como amigo. */
export function friendUrl(codigo: string) {
  const origin = typeof location !== 'undefined' ? location.origin : (process.env.EXPO_PUBLIC_API_URL || 'https://zarzabiblia.com');
  return `${origin}/amigo/${codigo}`;
}

/** «Juan 3:16» o «Juan 3» de una publicación. */
export function postReference(p: Publicacion) {
  if (!p.libroNombre || !p.capitulo) return null;
  return `${p.libroNombre} ${p.capitulo}${p.versiculo ? `:${p.versiculo}` : ''}`;
}

/** «Juan 3, 4 y 5»: los capítulos que alguien leyó hoy. */
export function chaptersLabel(p: Publicacion) {
  const caps = p.datos.capitulos ?? [];
  const list = caps.length > 1 ? `${caps.slice(0, -1).join(', ')} y ${caps[caps.length - 1]}` : String(caps[0] ?? '');
  return `${p.libroNombre ?? ''} ${list}`.trim();
}

// «Te envié un versículo»: la imagen de un versículo directo a un amigo, que responde «Amén» o «Gracias».

export type RespuestaVersiculo = 'amen' | 'gracias';
type VersiculoBase = {
  id: string;
  libro: string;
  capitulo: number;
  versiculo: number;
  version: string;
  cita: string;
  datos: DatosImagen;
  respuesta: RespuestaVersiculo | null;
  creado: string;
};
export type VersiculoRecibido = VersiculoBase & { visto: boolean; deId: string; deNombre: string; deFoto: string | null };
export type VersiculoEnviado = VersiculoBase & { paraId: string; paraNombre: string; paraFoto: string | null };

export type EnvioVersiculo = { para: string; libro: string; capitulo: number; versiculo: number; version?: string; datos: DatosImagen };

export const sendVerse = (e: EnvioVersiculo) => api<{ id: string; para: string }>('enviarVersiculo', e);
export const receivedVerses = () => api<{ recibidos: VersiculoRecibido[]; enviados: VersiculoEnviado[] }>('versiculosRecibidos');
export const answerVerse = (id: string, respuesta: RespuestaVersiculo) => api<{ respuesta: RespuestaVersiculo }>('responderVersiculo', { id, respuesta });
