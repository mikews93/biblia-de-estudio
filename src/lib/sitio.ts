// El dominio de Zarza para los enlaces que salen de la app (amistad, grupos, pareja, retos, eventos, iglesias...).
// La app también se abre en biblia.migueblanco.com (el dominio viejo, que sigue vivo para no perder lo guardado en
// ese origen), pero lo que se comparte siempre lleva zarzabiblia.com. Solo en pruebas (localhost, vistas previas de
// Vercel) el enlace usa la dirección donde corre la app, para que abra esa misma versión.

export const SITIO = 'https://zarzabiblia.com';

const esPrueba = (host: string) => host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app');

/** El origen para un enlace que se comparte: https://zarzabiblia.com salvo en pruebas. */
export function origenCompartir(): string {
  if (typeof location === 'undefined' || !location.hostname) return SITIO;
  return esPrueba(location.hostname) ? location.origin : SITIO;
}
