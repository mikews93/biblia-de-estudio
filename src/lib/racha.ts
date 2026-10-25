import { useMemo } from 'react';

import { diasCon, useActividad } from './actividad';
import { useDiario } from './diario';
import { calcularRacha, fechaLocal } from './rachaTexto';
import { huellasDe } from './sellos';

// La racha devocional de la persona (la cuenta está en src/lib/rachaTexto.ts). Un día cuenta si se terminó un
// devocional: lo dice el registro de actividad y, para lo de antes de él, las entradas del diario. Borrar una
// entrada del diario no quita el día de la racha.

/** Los días con devocional: los del registro de actividad y los de las entradas del diario. */
export function useDiasDevocionales() {
  const registro = useActividad();
  const diario = useDiario();
  return useMemo(() => {
    const dias = diasCon(registro, 'devocional');
    for (const e of diario) dias.add(fechaLocal(e.created));
    return [...dias].sort();
  }, [registro, diario]);
}

/** La racha de hoy. */
export function useRacha() {
  const dias = useDiasDevocionales();
  const hoy = fechaLocal();
  return useMemo(() => ({ ...calcularRacha(dias, hoy), dias }), [dias, hoy]);
}

/**
 * Deja en «Mis sellos» las huellas de la racha: un devocional por día («devocional:2026-10-24») y cada día de la
 * mejor racha alcanzada («racha:1» … «racha:21»), así el sello de 21 días se gana al llegar a 21.
 */
export async function huellasDeRacha(dias: string[], mejor: number) {
  await huellasDe('devocional', dias);
  await huellasDe('racha', Array.from({ length: mejor }, (_, i) => String(i + 1)));
}
