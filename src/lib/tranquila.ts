import { useSettings } from './theme';

/**
 * «Lectura tranquila»: sin rachas, insignias, sellos que celebran ni barras de porcentaje, para quien siente que
 * contar los días le quita la paz (una queja que se repite sobre otras apps, investigación de 2026-10-30).
 * Lo leído y escrito se sigue guardando igual; solo deja de mostrarse como una cuenta.
 */
export function useTranquila() {
  return useSettings().settings.tranquila;
}
