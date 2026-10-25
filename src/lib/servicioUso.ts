import { type Cuenta, nivelDe, siguienteNivel, totalDe } from './servicio';
import { cuenta, useSellos } from './sellos';

/** El servicio de quien usa la app, contado de sus huellas en Mis sellos (src/lib/servicio.ts). */
export function useServicio() {
  const s = useSellos();
  const c: Cuenta = { profundos: cuenta(s, 'profundo'), escritos: cuenta(s, 'escrito'), guiados: cuenta(s, 'guiar') };
  const total = totalDe(c);
  return { ...c, total, nivel: nivelDe(total), siguiente: siguienteNivel(total) };
}
