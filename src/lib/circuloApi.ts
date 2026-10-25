// Cliente del «Círculo de solteros» (api/_circulo.ts, por /api/comunidades). Las reglas compartidas con el servidor
// están en src/lib/circulo.ts.

import { api } from './comunidad';
import type { Etapa, Pasaje } from './circulo';

export type Persona = { id: string; nombre: string; foto: string | null };

export type PersonaCirculo = Persona & {
  bio: string | null;
  etapa: Etapa | null;
  /** Semanas en que los dos respondieron la pregunta del círculo. */
  enComun: number;
  /** Si yo la marqué con «Me gustaría conocerte» (solo lo sé yo). */
  marcada: boolean;
  puedoMarcar: boolean;
};

export type Progreso = { dia: number; abierto: boolean; terminado: boolean };

export type ConocerResumen = { id: string; otro: Persona; progreso: Progreso; mensajesNuevos: number; terminado: boolean };

export type CirculoOpcion = { id: string; nombre: string; edadMin: number | null; edadMax: number | null; miembros: number; lleno: boolean };
export type Liderado = { id: string; nombre: string; iglesia: string; pendientes: number; reportes: number };

export type EstadoCirculo = {
  etapa: Etapa | null;
  iglesia: { nombre: string } | null;
  lidero: Liderado[];
  acuerdo: string[];
  miembro: { circulo: { id: string; nombre: string }; estado: 'pendiente' | 'aprobado' | 'pausado'; edad: number } | null;
  circulos?: CirculoOpcion[];
  lideres?: Persona[];
  semana?: {
    clave: string;
    titulo: string;
    referencia: string;
    pasaje: Pasaje;
    pregunta: string;
    respondi: boolean;
    respuestas: { usuario: Persona; texto: string; mia: boolean }[];
  };
  personas?: PersonaCirculo[];
  marcas?: { abiertas: number; mes: number; maxAbiertas: number; maxMes: number; semanasEnComun: number; dias: number };
  conocer?: ConocerResumen | null;
};

export type Mensaje = { id: number; texto: string; alerta: string | null; mio: boolean; creado: string };
export type DiaRespondido = { dia: number; mia: string | null; suya: string | null; suyaEspera: boolean };
export type Conocer = ConocerResumen & { acompanado: boolean; dias: DiaRespondido[]; mensajes: Mensaje[] };

export type PersonaLider = Persona & { bio: string | null; correo: string | null; etapa: Etapa | null; edad: number };
export type Reporte = { id: number; motivo: string; detalle: string | null; creado: string; de: string; a: string; aId: string };
export type PanelLider = {
  circulo: { id: string; nombre: string; iglesia: string; edadMin: number | null; edadMax: number | null; max: number };
  pendientes: PersonaLider[];
  miembros: (PersonaLider & { pausado: boolean })[];
  reportes: Reporte[];
  conociendose: number;
};

export const estadoCirculo = () => api<EstadoCirculo>('circuloEstado');
export const cambiarEtapa = (etapa: Etapa | null) => api<{ etapa: Etapa | null }>('circuloEtapa', { etapa });
export const pedirEntrar = (circulo: string, nacimiento: string, etapa: Etapa) =>
  api('circuloPedir', { circulo, nacimiento, etapa, acepto: true });
export const salirCirculo = () => api('circuloSalir');
export const responderSemana = (texto: string) => api('circuloResponder', { texto });
export const borrarRespuestaSemana = () => api('circuloBorrarRespuesta');
export const marcar = (usuario: string) => api<{ mutuo: string | null }>('circuloMarcar', { usuario });
export const desmarcar = (usuario: string) => api('circuloDesmarcar', { usuario });
export const reportar = (usuario: string, motivo: string, detalle: string, bloquear: boolean) =>
  api('circuloReportar', { usuario, motivo, detalle, bloquear });

export const leerConocer = (id: string) => api<{ conocer: Conocer }>('circuloConocer', { id }).then((r) => r.conocer);
export const responderConocer = (id: string, dia: number, texto: string) => api('circuloConocerResponder', { id, dia, texto });
export const enviarMensaje = (id: string, texto: string) => api('circuloMensaje', { id, texto });
export const cerrarConocer = (id: string) => api('circuloCerrar', { id });
export const pedirAcompanamiento = (id: string) => api('circuloAcompanar', { id });

export const panelLider = (circulo: string) => api<PanelLider>('circuloLider', { circulo });
export const aprobar = (usuario: string, si: boolean) => api('circuloAprobar', { usuario, si });
export const revisar = (usuario: string, que: 'reactivar' | 'pausar' | 'quitar' | 'revisado') => api('circuloRevisar', { usuario, que });

// Para quien cuida Zarza (/cuidar)
export type CirculoCuidado = CirculoOpcion & { pendientes: number; max: number; lideres: { id: string; nombre: string; correo: string | null }[] };
export const circulosDeIglesia = (iglesia: string) => api<{ circulos: CirculoCuidado[] }>('cuidarCirculos', { iglesia }).then((r) => r.circulos);
export const nuevoCirculo = (iglesia: string, nombre: string, edadMin: string, edadMax: string) =>
  api('cuidarNuevoCirculo', { iglesia, nombre, edadMin: edadMin || null, edadMax: edadMax || null });
export const nombrarLider = (circulo: string, correo: string) => api('cuidarLiderCirculo', { circulo, correo });
export const quitarLider = (circulo: string, usuario: string) => api('cuidarLiderCirculo', { circulo, usuario, quitar: true });
export const borrarCirculo = (circulo: string) => api('cuidarBorrarCirculo', { circulo });

export const rangoEdad = (c: { edadMin: number | null; edadMax: number | null }) =>
  c.edadMin && c.edadMax ? `${c.edadMin} a ${c.edadMax} años` : c.edadMin ? `${c.edadMin} años o más` : c.edadMax ? `hasta ${c.edadMax} años` : 'Todas las edades';
