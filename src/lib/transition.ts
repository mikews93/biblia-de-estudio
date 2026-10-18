import { Platform, type ViewStyle } from 'react-native';

import { animatePageTurn, type PageTurn } from './pageTurn';

export type Direction = 'forward' | 'back' | 'fade' | 'turn-forward' | 'turn-back';

type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => ViewTransition;
};

const supported = () => {
  const doc = Platform.OS === 'web' ? (globalThis.document as ViewTransitionDocument | undefined) : undefined;
  if (!doc?.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return doc as ViewTransitionDocument & { startViewTransition: NonNullable<ViewTransitionDocument['startViewTransition']> };
};

/**
 * Cambia de pantalla con una View Transition en la web (deslizamiento corto, fundido o pasar la hoja
 * entre capítulos, ver public/index.html). En el teléfono y en navegadores sin soporte navega sin más: allí anima el Stack.
 */
export function navigate(update: () => void, direction: Direction = 'fade') {
  const doc = supported();
  if (!doc) {
    update();
    return;
  }
  const transition = begin(doc, update, direction);
  if (direction === 'turn-forward' || direction === 'turn-back') {
    transition.ready.then(() => animatePageTurn(direction)).catch(() => {});
  }
}

export type TurnGesture = {
  /** Posición de la hoja entre 0 (sin pasar) y 1 (pasada). */
  move: (progress: number) => void;
  /** Al soltar: termina de pasar la hoja (commit) o la devuelve a su sitio y deshace la navegación (revert). */
  release: (commit: boolean) => void;
};

/**
 * Pasar la hoja con el dedo o el cursor: la navegación ocurre al empezar el gesto (para tener debajo la
 * página nueva) y la hoja sigue a move(). Si se suelta sin pasarla, vuelve y revert() regresa al capítulo
 * de antes mientras la hoja aún lo tapa. Sin View Transitions solo navega al soltar.
 */
export function startTurnGesture(update: () => void, revert: () => void, direction: 'turn-forward' | 'turn-back'): TurnGesture {
  const doc = supported();
  if (!doc) return { move: () => {}, release: (commit) => commit && update() };

  const transition = begin(doc, update, direction);
  let turn: PageTurn | null = null;
  let progress = 0;
  let released: boolean | null = null;

  const end = async (commit: boolean) => {
    if (!turn) return;
    if (commit) {
      await turn.play();
    } else {
      await turn.rewind();
      // La hoja vieja tapa la pantalla: se vuelve al capítulo de antes y se espera a que se pinte.
      const from = location.href;
      revert();
      for (let i = 0; i < 25 && location.href === from; i++) await tick();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    turn.done();
  };

  transition.ready
    .then(() => {
      turn = animatePageTurn(direction, true);
      turn.seek(progress);
      if (released !== null) end(released);
    })
    .catch(() => released === false && revert());

  return {
    move: (p) => {
      progress = p;
      turn?.seek(p);
    },
    release: (commit) => {
      if (released !== null) return;
      released = commit;
      end(commit);
    },
  };
}

function begin(doc: ReturnType<typeof supported> & object, update: () => void, direction: Direction) {
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
  transition.finished.finally(() => {
    delete doc.documentElement.dataset.nav;
    delete doc.documentElement.dataset.fold;
  });
  return transition;
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
