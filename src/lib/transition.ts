import { Platform } from 'react-native';

export type Direction = 'forward' | 'back' | 'fade';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

/**
 * Cambia de pantalla con una View Transition en la web (deslizamiento corto o fundido, ver
 * public/index.html). En el teléfono y en navegadores sin soporte navega sin más: allí anima el Stack.
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
    update();
    // El router pinta en el siguiente render: se espera a que cambie la URL y a un instante más.
    // No sirve requestAnimationFrame: el navegador no pinta mientras dura esta función, así que nunca
    // llegaba y la transición se quedaba congelada hasta su límite de 4 segundos.
    for (let i = 0; i < 25 && location.href === from; i++) await tick();
    await tick();
  });
  transition.finished.finally(() => delete doc.documentElement.dataset.nav);
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 12));
