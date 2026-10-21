import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

import { navigate, startTurnGesture, type TurnGesture } from './transition';

/** Distancia antes de decidir que el gesto es horizontal, y cuánto arrastre pasa la hoja entera. */
const SLOP = 12;
const FULL = 0.8;

/** Donde un gesto no pasa la hoja: campos de texto y paneles abiertos encima del lector. */
const IGNORE = 'input, textarea, [contenteditable="true"], [aria-modal="true"], [role="dialog"]';

type HrefFor = (delta: 1 | -1) => Href | null;

/** El lector enfocado; el gesto sigue vivo aunque al pasar la hoja se monte otro lector. */
let focused: { current: HrefFor } | null = null;
let installed = false;

/**
 * Deslizar a la izquierda o la derecha con el dedo pasa la hoja siguiéndolo (solo web; en el teléfono
 * nativo el lector cambia de capítulo con sus botones). Con el ratón arrastrar es para seleccionar
 * texto, así que en el computador la hoja pasa con las flechas ← → del teclado o los botones. hrefFor(1) es el capítulo siguiente y
 * hrefFor(-1) el anterior, o null si no hay. Al soltar, la hoja termina de pasar si se arrastró lo
 * bastante o se lanzó rápido; si no, vuelve a su sitio.
 */
export function usePageSwipe(hrefFor: HrefFor) {
  const latest = useRef(hrefFor);
  latest.current = hrefFor;

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return;
      install();
      focused = latest;
      return () => {
        if (focused === latest) focused = null;
      };
    }, []),
  );
}

function install() {
  if (installed) return;
  installed = true;
  const root = document.documentElement;
  let start: { x: number; y: number; id: number } | null = null;
  let gesture: TurnGesture | null = null;
  let delta: 1 | -1 = 1;
  let progress = 0;
  let speed = 0;
  let last = { x: 0, t: 0 };

  document.addEventListener('pointerdown', (e) => {
    if (!focused || gesture || e.pointerType === 'mouse') return;
    // Ni al escribir ni dentro de un panel abierto encima del lector (Estudio, versículo, notas...).
    if ((e.target as Element | null)?.closest?.(IGNORE)) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    last = { x: e.clientX, t: e.timeStamp };
  });

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!gesture) {
        if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) start = null;
        if (!start || Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        delta = dx < 0 ? 1 : -1;
        const href = focused?.current(delta);
        if (!href) {
          start = null;
          return;
        }
        const from = (location.pathname + location.search) as Href;
        gesture = startTurnGesture(
          () => router.replace(href),
          () => router.replace(from),
          delta > 0 ? 'turn-forward' : 'turn-back',
        );
        root.dataset.swipe = '';
        window.getSelection()?.removeAllRanges();
      }
      e.preventDefault();
      const dt = e.timeStamp - last.t;
      if (dt > 0) speed = (e.clientX - last.x) / dt;
      last = { x: e.clientX, t: e.timeStamp };
      progress = Math.min(1, Math.max(0, (delta > 0 ? -dx : dx) / (window.innerWidth * FULL)));
      gesture.move(progress);
    },
    { passive: false },
  );

  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    start = null;
    if (!gesture) return;
    // Un lanzamiento rápido en la dirección del gesto también pasa la hoja.
    const flung = (delta > 0 ? -speed : speed) > 0.5;
    gesture.release(e.type === 'pointerup' && (progress > 0.4 || (flung && progress > 0.05)));
    gesture = null;
    delete root.dataset.swipe;
    // El clic que sigue al soltar no debe seleccionar un versículo ni pulsar un botón.
    const swallow = (c: Event) => {
      c.stopPropagation();
      c.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400);
  };
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);

  document.addEventListener('keydown', (e) => {
    if (!focused || gesture || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if ((e.target as Element | null)?.closest?.(IGNORE) || document.querySelector('[aria-modal="true"]')) return;
    const href = focused.current(e.key === 'ArrowRight' ? 1 : -1);
    if (!href) return;
    e.preventDefault();
    navigate(() => router.replace(href), e.key === 'ArrowRight' ? 'turn-forward' : 'turn-back');
  });
}
