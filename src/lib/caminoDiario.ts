// Lo que cada persona escribe en el «Camino de preparación» (src/lib/camino.ts). Vive solo en este teléfono: no se
// sincroniza con la cuenta ni pasa por el servidor, que solo sabe qué etapas terminó. Va por cuenta, por si dos
// personas comparten un dispositivo.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** Respuestas por etapa: `diario[2][3]` es la cuarta pregunta de la etapa 2. */
export type Diario = Record<number, string[]>;

const key = (usuario: string) => `camino-diario:${usuario}`;

export function useCaminoDiario(usuario: string | null | undefined) {
  const [diario, setDiario] = useState<Diario | null>(null);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    AsyncStorage.getItem(key(usuario))
      .then((raw) => (raw ? (JSON.parse(raw) as Diario) : {}))
      .catch(() => ({}))
      .then((d) => vivo && setDiario(d));
    return () => {
      vivo = false;
    };
  }, [usuario]);

  const escribir = useCallback(
    (etapa: number, i: number, texto: string) => {
      if (!usuario) return;
      setDiario((d) => {
        const actual = [...(d?.[etapa] ?? [])];
        actual[i] = texto;
        const next = { ...d, [etapa]: actual };
        AsyncStorage.setItem(key(usuario), JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [usuario],
  );

  return { diario, escribir };
}
