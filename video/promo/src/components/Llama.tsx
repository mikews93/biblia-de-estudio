import {useCurrentFrame} from 'remotion';
import {ease, progress} from '../motion';
import {c} from '../theme';

/**
 * La llama de Zarza (assets/icono/llama.svg): 21 hojas abiertas en abanico que forman una llama sobre la
 * Biblia abierta. Al encenderse, cada hoja se traza desde la base, del centro hacia afuera; después
 * chisporrotea con tirones desiguales, como la portada animada de la app (public/index.html).
 */
const HOJAS = ['M512 800 Q 152 791 -164 619', 'M512 800 Q 156 744 -135 532', 'M512 800 Q 167 698 -94 450', 'M512 800 Q 183 654 -43 374', 'M512 800 Q 205 612 17 305', 'M512 800 Q 232 573 86 245', 'M512 800 Q 264 539 162 194', 'M512 800 Q 300 509 244 153', 'M512 800 Q 340 484 331 124', 'M512 800 Q 383 464 421 106', 'M512 800 Q 512 450 512 100', 'M512 800 Q 641 464 603 106', 'M512 800 Q 684 484 693 124', 'M512 800 Q 724 509 780 153', 'M512 800 Q 760 539 862 194', 'M512 800 Q 792 573 938 245', 'M512 800 Q 819 612 1007 305', 'M512 800 Q 841 654 1067 374', 'M512 800 Q 857 698 1118 450', 'M512 800 Q 868 744 1159 532', 'M512 800 Q 872 791 1188 619'];
const LLAMA = ['M500 800 C 372 786 292 704 292 584 C 292 466 380 398 430 280 C 468 360 500 432 500 510 Z', 'M524 800 C 652 786 732 704 732 584 C 732 432 640 340 600 176 C 556 300 524 400 524 510 Z'];
const BASE = 'M210 812 C 330 782 440 790 512 840 C 584 790 694 782 814 812';

/** Un temblor sin ciclo visible: suma de senos con periodos primos. */
const flicker = (f: number) => Math.sin(f / 7) * 0.5 + Math.sin(f / 3.1 + 1) * 0.3 + Math.sin(f / 1.7 + 2) * 0.2;

export const Llama = ({size, start = 0, glow = 1}: {size: number; start?: number; glow?: number}) => {
  const f = useCurrentFrame() - start;
  const fl = flicker(f);
  const lit = progress(f, 0, 40, ease.expoOut);
  return (
    <div style={{position: 'relative', width: size, height: size}}>
      <div
        style={{
          position: 'absolute',
          inset: '-35%',
          background: `radial-gradient(circle at 50% 55%, rgba(240,138,44,${0.32 * glow * lit * (0.9 + fl * 0.08)}), rgba(184,58,18,${0.1 * glow * lit}) 38%, transparent 66%)`,
        }}
      />
      <svg viewBox="0 0 1024 1024" width={size} height={size} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id="fl" gradientUnits="userSpaceOnUse" x1="0" y1="800" x2="0" y2="180">
            <stop offset="0" stopColor={c.flameLow} />
            <stop offset=".45" stopColor={c.flameMid} />
            <stop offset=".85" stopColor={c.flameHigh} />
            <stop offset="1" stopColor={c.flameTip} />
          </linearGradient>
          <clipPath id="llama">
            {LLAMA.map((d) => (
              <path key={d} d={d} />
            ))}
          </clipPath>
        </defs>
        <g style={{transformOrigin: '512px 800px', transform: `scaleY(${1 + fl * 0.018 * lit}) skewX(${fl * 1.2 * lit}deg)`}}>
          <g clipPath="url(#llama)">
            {HOJAS.map((d, i) => {
              const fromCentre = Math.abs(i - 10);
              const t = progress(f, 4 + fromCentre * 2.2, 26, ease.expoOut);
              return <path key={i} d={d} stroke="url(#fl)" strokeWidth={18} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />;
            })}
          </g>
        </g>
        <path d={BASE} stroke="#FFF1D6" strokeWidth={30} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress(f, 0, 22, ease.quintOut)} />
      </svg>
    </div>
  );
};
