/**
 * Pasar la hoja como en un libro (solo web, dentro de una View Transition; ver navigate en transition.ts).
 *
 * La hoja se dobla por una línea en diagonal que nace en la esquina inferior derecha y barre la página
 * hasta el lomo, enderezándose al final. A un lado de la línea queda lo que aún no se ha pasado; el otro
 * lado se levanta y aparece reflejado sobre la línea como el dorso de la hoja (#pliegue). Debajo se ve la
 * página nueva con la sombra que proyecta la hoja (#pliegue-sombra) y el doblez se oscurece un poco
 * (#pliegue-brillo). Hacia atrás es la misma animación al revés, con la página anterior cayendo encima.
 *
 * Las capturas de la View Transition solo se pueden mover con transformaciones y recortes, así que cada
 * fotograma se calcula aquí y se reproduce con la Web Animations API. Con el dedo (interactive) las
 * animaciones quedan en pausa y siguen el gesto con seek(); una animación de espera sobre
 * ::view-transition mantiene viva la transición hasta done().
 */

const DURATION = 680;
const FRAMES = 40;
const POINTS = 6;

type Pt = [number, number];

export type PageTurn = {
  /** Lleva la hoja a una posición entre 0 (sin pasar) y 1 (pasada). */
  seek: (progress: number) => void;
  /** Termina de pasar la hoja desde donde esté. */
  play: () => Promise<unknown>;
  /** Devuelve la hoja a su sitio. */
  rewind: () => Promise<unknown>;
  /** Deja terminar la transición (solo hace falta con interactive). */
  done: () => void;
};

export function animatePageTurn(direction: 'turn-forward' | 'turn-back', interactive = false): PageTurn {
  const root = document.documentElement;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const page: Pt[] = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];

  const kept: Keyframe[] = [];
  const flap: Keyframe[] = [];
  const shadow: Keyframe[] = [];
  const crease: Keyframe[] = [];
  for (let i = 0; i <= FRAMES; i++) {
    const t = i / FRAMES;
    // Ángulo del doblez respecto a la vertical: diagonal al levantar la esquina, casi recto al llegar al lomo.
    const beta = ((24 - 21 * t) * Math.PI) / 180;
    const n: Pt = [Math.cos(beta), Math.sin(beta)];
    const u: Pt = [-n[1], n[0]];
    const start = W * n[0] + H * n[1];
    const end = -0.04 * W;
    const d = start + (end - start) * t;
    const L = 1.5 * Math.hypot(W, H);
    const alpha = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
    const deg = (beta * 180) / Math.PI;

    kept.push({ clipPath: polygon(clip(page, n, d, true)) });
    flap.push({
      clipPath: polygon(clip(page, n, d, false)),
      transform: `translate(${2 * d * n[0]}px, ${2 * d * n[1]}px) rotate(${alpha}deg) scaleY(-1) rotate(${-alpha}deg)`,
    });
    shadow.push({ transform: `translate(${d * n[0] - L * u[0]}px, ${d * n[1] - L * u[1]}px) rotate(${deg}deg)` });
    crease.push({ transform: `translate(${d * n[0] + L * u[0]}px, ${d * n[1] + L * u[1]}px) rotate(${deg + 180}deg)` });
  }

  const options: KeyframeAnimationOptions = {
    duration: DURATION,
    // Con el dedo la hoja va donde está el dedo, sin curva de aceleración.
    easing: interactive ? 'linear' : 'cubic-bezier(0.42, 0, 0.3, 1)',
    fill: 'both',
    direction: direction === 'turn-forward' ? 'normal' : 'reverse',
  };
  const page_ = direction === 'turn-forward' ? '::view-transition-old(root)' : '::view-transition-new(root)';
  const animations = [
    root.animate(kept, { ...options, pseudoElement: page_ }),
    root.animate(flap, { ...options, pseudoElement: '::view-transition-new(pliegue)' }),
    root.animate(shadow, { ...options, pseudoElement: '::view-transition-new(pliegue-sombra)' }),
    root.animate(crease, { ...options, pseudoElement: '::view-transition-new(pliegue-brillo)' }),
  ];
  const hold = interactive
    ? root.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 10 * 60 * 1000, pseudoElement: '::view-transition' })
    : null;
  if (interactive) for (const a of animations) a.pause();

  const run = (rate: number) => {
    for (const a of animations) {
      a.playbackRate = rate;
      a.play();
    }
    return Promise.all(animations.map((a) => a.finished));
  };
  return {
    seek: (progress) => {
      for (const a of animations) a.currentTime = Math.min(1, Math.max(0, progress)) * DURATION;
    },
    play: () => run(1),
    rewind: () => run(-1.4),
    done: () => hold?.cancel(),
  };
}

/** Parte del polígono a un lado de la recta p·n = d (keepLess: el lado p·n < d). */
function clip(poly: Pt[], n: Pt, d: number, keepLess: boolean): Pt[] {
  const side = (p: Pt) => (keepLess ? d - dot(p, n) : dot(p, n) - d);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa >= 0 !== sb >= 0) {
      const k = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}

const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];

/** Siempre con el mismo número de vértices para que el navegador pueda interpolar entre fotogramas. */
function polygon(points: Pt[]) {
  const pts = points.length ? points : [[0, 0] as Pt];
  while (pts.length < POINTS) pts.push(pts[pts.length - 1]);
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;
}
