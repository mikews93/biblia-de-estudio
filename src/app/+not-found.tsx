import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';

import NoEncontrada from '@/components/NoEncontrada';
import { limpiarRuta } from '@/lib/noEncontrada';

/**
 * Cualquier dirección sin pantalla. Si solo sobraba la puntuación de un enlace copiado («/instalar.»), abre la
 * pantalla correcta; en la web public/index.html ya la corrige antes de cargar, esto cubre los enlaces de la app.
 */
export default function NotFound() {
  const path = usePathname();
  const limpia = limpiarRuta(path);
  useEffect(() => {
    if (limpia) router.replace(limpia as never);
  }, [limpia]);
  return limpia ? null : <NoEncontrada path={path} />;
}
