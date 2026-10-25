// Lo que cada hombre escribe en «Hombres de pie» (src/lib/hombres.ts) y qué semanas y retos terminó. Vive solo en este
// teléfono: no pasa por el servidor y no hace falta cuenta.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export type DiarioHombres = {
  /** `respuestas[2][1]` es la segunda pregunta de la semana 2. */
  respuestas: Record<number, string[]>;
  /** Semana terminada → día en que se terminó («AAAA-MM-DD»). */
  hechas: Record<number, string>;
  /** Semanas cuyo reto se cumplió. */
  retos: Record<number, boolean>;
};

const KEY = 'hombres-de-pie';
const VACIO: DiarioHombres = { respuestas: {}, hechas: {}, retos: {} };

export function useHombresDiario() {
  const [diario, setDiario] = useState<DiarioHombres | null>(null);

  // Se vuelve a leer al volver a la pantalla, para que la lista vea la semana recién terminada.
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      AsyncStorage.getItem(KEY)
        .then((raw) => (raw ? { ...VACIO, ...(JSON.parse(raw) as DiarioHombres) } : VACIO))
        .catch(() => VACIO)
        .then((d) => vivo && setDiario(d));
      return () => {
        vivo = false;
      };
    }, []),
  );

  const cambiar = useCallback((f: (d: DiarioHombres) => DiarioHombres) => {
    setDiario((d) => {
      const next = f(d ?? VACIO);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const escribir = useCallback(
    (semana: number, i: number, texto: string) =>
      cambiar((d) => {
        const actual = [...(d.respuestas[semana] ?? [])];
        actual[i] = texto;
        return { ...d, respuestas: { ...d.respuestas, [semana]: actual } };
      }),
    [cambiar],
  );
  const terminar = useCallback((semana: number, hoy: string) => cambiar((d) => ({ ...d, hechas: { ...d.hechas, [semana]: hoy } })), [cambiar]);
  const marcarReto = useCallback((semana: number, hecho: boolean) => cambiar((d) => ({ ...d, retos: { ...d.retos, [semana]: hecho } })), [cambiar]);

  return { diario, escribir, terminar, marcarReto };
}
