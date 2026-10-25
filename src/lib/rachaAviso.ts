// Aviso para no perder la racha devocional, en el teléfono. En la web no hace nada aquí: ahí lo manda el servidor
// por push (api/notificaciones.ts) con lo que la app le cuenta (src/lib/avisos.ts). La versión de la app nativa
// está en rachaAviso.native.ts.

import type { Racha } from './rachaTexto';

export function useAvisoRacha(_racha: Racha) {}
