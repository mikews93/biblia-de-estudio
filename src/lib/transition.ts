import { Platform, type ViewStyle } from 'react-native';

import { animatePageTurn } from './pageTurn';

export type Direction = 'forward' | 'back' | 'fade' | 'turn-forward' | 'turn-back';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { ready: Promise<void>; finished: Promise<void> };
};

/**
 * Cambia de pantalla con una View Transition en la web (deslizamiento corto, fundido o pasar la hoja
 * entre capítulos, ver public/index.html). En el teléfono y en navegadores sin soporte navega sin más: allí anima el Stack.
 */
export function navigate(update: () => void, direction: Direction = 'fade') {
  const doc = Platform.OS === 'web' ? (globalThis.document as ViewTransitionDocument | undefined) : undefined;
  if (!doc?.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  const from = location.href;
  doc.documentElement.dataset.nav = direction;
  const transition = doc.startViewTransition(async () => {
    // El dorso y las sombras de pasar la hoja solo aparecen en el estado nuevo (ya tomada la foto del anterior).
    if (direction.startsWith('turn')) doc.documentElement.dataset.fold = '';
    update();
    // El router pinta en el siguiente render: se espera a que cambie la URL y a un instante más.
    // No sirve requestAnimationFrame: el navegador no pinta mientras dura esta función, así que nunca
    // llegaba y la transición se quedaba congelada hasta su límite de 4 segundos.
    for (let i = 0; i < 25 && location.href === from; i++) await tick();
    await tick();
  });
  if (direction === 'turn-forward' || direction === 'turn-back') {
    transition.ready.then(() => animatePageTurn(direction)).catch(() => {});
  }
  transition.finished.finally(() => {
    delete doc.documentElement.dataset.nav;
    delete doc.documentElement.dataset.fold;
  });
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 12));

/**
 * Marca lo que no cambia entre pantallas (barra de pestañas, cabecera, barra de audio…): la transición
 * lo deja quieto en su sitio mientras el contenido se desliza. Cada nombre debe estar una sola vez en
 * pantalla; las animaciones de estos grupos están en public/index.html.
 */
export function fixedInTransition(name: string): ViewStyle | undefined {
  return Platform.OS === 'web' ? ({ viewTransitionName: name } as ViewStyle) : undefined;
}
