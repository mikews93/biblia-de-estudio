// El sello de «Mis sellos»: un medallón de borde festoneado, como un sello de lacre, con su dibujo de línea en el
// centro. Ganado se ve en el tono cálido (el ámbar solo en lo que se destaca); por ganar, en línea punteada con un
// arco que muestra cuánto falta.
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { STROKE } from './iconLine';
import type { Dibujo } from '@/lib/sellos';
import type { Colors } from '@/lib/theme';

/** Borde festoneado de 30 ondas alrededor de (50, 50). */
const FESTON = (() => {
  const n = 30;
  const R = 48;
  const r = 44.5;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const m = ((i - 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + r * Math.cos(a);
    const y = 50 + r * Math.sin(a);
    if (i === 0) d += `M${x.toFixed(2)} ${y.toFixed(2)}`;
    else d += `Q${(50 + R * 1.06 * Math.cos(m)).toFixed(2)} ${(50 + R * 1.06 * Math.sin(m)).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d + 'Z';
})();

type Props = {
  dibujo: Dibujo;
  colors: Colors;
  size?: number;
  ganado: boolean;
  /** 0 a 1: lo que lleva de un sello por ganar. */
  parte?: number;
};

export default function Sello({ dibujo, colors, size = 84, ganado, parte = 0 }: Props) {
  const tinta = ganado ? colors.warm : colors.muted;
  const arco = 2 * Math.PI * 40;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ganado ? (
        <>
          <Path d={FESTON} fill={colors.warmSoft} stroke={colors.warm} strokeWidth={1.6} strokeLinejoin="round" />
          <Circle cx={50} cy={50} r={37} fill="none" stroke={colors.warm} strokeWidth={1.2} strokeDasharray="1.5 3.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={50} cy={50} r={45} fill={colors.surface} stroke={colors.border} strokeWidth={1.4} strokeDasharray="3 4" />
          <Circle cx={50} cy={50} r={40} fill="none" stroke={colors.accentSoft} strokeWidth={3.5} />
          {parte > 0 && (
            <Circle
              cx={50}
              cy={50}
              r={40}
              fill="none"
              stroke={colors.accent}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(2, arco * parte)} ${arco}`}
              transform="rotate(-90 50 50)"
            />
          )}
        </>
      )}
      <G
        transform="translate(26 26) scale(2)"
        fill="none"
        stroke={tinta}
        strokeWidth={STROKE * (ganado ? 0.95 : 0.85)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={ganado ? 1 : 0.55}
      >
        <SelloIcono dibujo={dibujo} color={tinta} />
      </G>
    </Svg>
  );
}

/** Los dibujos de los sellos, en la caja de 24 × 24 de los íconos de la app. */
export function SelloIcono({ dibujo, color }: { dibujo: Dibujo; color: string }) {
  switch (dibujo) {
    case 'tesoro': // cofre abierto con un brillo
      return (
        <>
          <Path d="M4 11h16v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
          <Path d="M4 11l1.5-4h13L20 11" />
          <Path d="M10.5 11v3h3v-3" />
          <Path d="M12 2.5v2M8.5 3.5l1 1.5M15.5 3.5l-1 1.5" />
        </>
      );
    case 'pico': // lingote con destellos: más que el oro
      return (
        <>
          <Path d="M5 18.5l2.5-6h9l2.5 6z" />
          <Path d="M9 12.5l1.5-4h3l1.5 4" />
          <Path d="M18.5 4.5v3M17 6h3M5.5 6.5v2M4.5 7.5h2" />
        </>
      );
    case 'pergamino':
      return (
        <>
          <Path d="M7 4.5h10.5a2 2 0 0 1 2 2 2 2 0 0 1-2 2H16" />
          <Path d="M7 4.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.5" />
          <Path d="M7 4.5a2 2 0 0 1 2 2v13" />
          <Path d="M11.5 11.5h3.5M11.5 14.5h3.5" />
        </>
      );
    case 'libro': // libro abierto con una llama: palabra viva
      return (
        <>
          <Path d="M12 9.5c-2-1.5-5-2-8-1.5v10c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V8c-3-.5-6 0-8 1.5z" />
          <Path d="M12 9.5v10" />
          <Path d="M12 6.5c-1-1-1-2.5 0-4 1 1.5 1 3 0 4z" fill={color} />
        </>
      );
    case 'oido': // ondas que llegan a un oído
      return (
        <>
          <Path d="M9 19c1.5 1 3.5.5 4-1.5.4-1.6 1.6-2.4 2.4-3.5A5.5 5.5 0 1 0 6 10.5" />
          <Path d="M9.5 10.5a2 2 0 0 1 4 0c0 1.2-1 1.6-1.5 2.4" />
          <Path d="M18.5 4.5a8 8 0 0 1 1.5 4.5M20.5 2.5a11 11 0 0 1 2 6.5" />
        </>
      );
    case 'peregrino': // bastón y camino hacia el horizonte
      return (
        <>
          <Path d="M3.5 20.5c4-1 6-4 8.5-8.5" />
          <Path d="M20.5 20.5c-4-1-6-4-8.5-8.5" />
          <Path d="M9 9.5h6" />
          <Circle cx={12} cy={5.5} r={2.2} />
        </>
      );
    case 'camino': // camino que sube entre montes hacia el corazón
      return (
        <>
          <Path d="M2.5 18l5-7 3.5 4.5 3-3.5 7.5 6" />
          <Path d="M12 9c-1.7-1.6-3.5-2.8-3.5-4.4a1.8 1.8 0 0 1 3.5-.6 1.8 1.8 0 0 1 3.5.6C15.5 6.2 13.7 7.4 12 9z" />
        </>
      );
    case 'pisadas':
      return (
        <>
          <Path d="M7.5 20.5c-1.7 0-2.5-1.5-2.5-3.5s.9-4.5 2.5-4.5S10 15 10 17s-.8 3.5-2.5 3.5z" />
          <Path d="M16.5 11.5C14.8 11.5 14 10 14 8s.9-4.5 2.5-4.5S19 6 19 8s-.8 3.5-2.5 3.5z" />
          <Path d="M5.5 10.5v.01M8 9.5v.01M14.5 1.8v.01" />
        </>
      );
    case 'testigos': // tres cabezas en una nube
      return (
        <>
          <Path d="M6.5 13.5a3.5 3.5 0 0 1 0-7 4.5 4.5 0 0 1 8.5-1.5 3.8 3.8 0 0 1 2.5 7.2" />
          <Circle cx={8} cy={14.5} r={1.6} />
          <Circle cx={12} cy={13.5} r={1.6} />
          <Circle cx={16} cy={14.5} r={1.6} />
          <Path d="M5 20.5c.5-2 1.6-3 3-3s2.5 1 3 3M9 19.5c.6-2 1.7-3 3-3s2.4 1 3 3M13 20.5c.5-2 1.6-3 3-3s2.5 1 3 3" />
        </>
      );
    case 'familia': // casa con tres personas
      return (
        <>
          <Path d="M3.5 11L12 4l8.5 7" />
          <Path d="M5.5 9.5v10h13v-10" />
          <Circle cx={9.5} cy={12.5} r={1.4} />
          <Circle cx={14.5} cy={12.5} r={1.4} />
          <Path d="M7.5 19.5c0-2 1-3.5 2-3.5s2 1.5 2 3.5M12.5 19.5c0-2 1-3.5 2-3.5s2 1.5 2 3.5" />
        </>
      );
    case 'hilo': // un hilo que une promesa y cumplimiento
      return (
        <>
          <Path d="M4 17c2-8 4-11 8-11s6 3 8 11" />
          <Path d="M8 17c1-4 2-6 4-6s3 2 4 6" />
          <Circle cx={4} cy={18.5} r={1.5} />
          <Circle cx={20} cy={18.5} r={1.5} fill={color} />
        </>
      );
    case 'amen': // sello con una marca de «sí»
      return (
        <>
          <Path d="M5.5 16.5C6.5 9 9 6 12 6s5.5 3 6.5 10.5" />
          <Circle cx={5.5} cy={18} r={2} />
          <Circle cx={18.5} cy={18} r={2} fill={color} />
          <Path d="M9.5 12.5l2 2 3.5-4" />
        </>
      );
    case 'lupa': // lupa sobre un manuscrito
      return (
        <>
          <Path d="M4 4.5h9M4 8h6M4 11.5h4.5M4 15h4" />
          <Circle cx={14.5} cy={13} r={4.5} />
          <Path d="M17.8 16.3l3.2 3.2" />
        </>
      );
    case 'piedra': // piedra de memoria erguida
      return (
        <>
          <Path d="M8 20.5c-.5-4 0-9 1.2-12.5C10 5.5 11 4 12.5 4S15 5.5 15.6 8c.8 3.5 1 8.5.4 12.5" />
          <Path d="M4 20.5h16" />
          <Path d="M10.5 11h3.5M10.5 14h3" />
        </>
      );
    case 'dos': // dos personas lado a lado
      return (
        <>
          <Circle cx={8.5} cy={8} r={2.6} />
          <Circle cx={15.5} cy={8} r={2.6} />
          <Path d="M3.5 19.5c.5-3.5 2.4-5.5 5-5.5 1.4 0 2.6.6 3.5 1.6.9-1 2.1-1.6 3.5-1.6 2.6 0 4.5 2 5 5.5" />
        </>
      );
    case 'pagina': // página que pasa para todos
      return (
        <>
          <Path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z" />
          <Path d="M12 6.5v13" />
          <Path d="M15 9.5l2 1.5-2 1.5" />
        </>
      );
    case 'templo':
      return (
        <>
          <Path d="M12 2.5v4M10.5 4h3" />
          <Path d="M5 11l7-4.5 7 4.5" />
          <Path d="M6.5 10v10h11V10" />
          <Path d="M10.5 20v-4a1.5 1.5 0 0 1 3 0v4" />
          <Path d="M3.5 20.5h17" />
        </>
      );
    case 'pulpito': // atril con un libro y unas manos (hacedores)
      return (
        <>
          <Path d="M6 9.5h12l-1.5 3.5h-9z" />
          <Path d="M12 13v7.5M8.5 20.5h7" />
          <Path d="M8 9.5c1.5-1.5 2.7-2 4-1.2 1.3-.8 2.5-.3 4 1.2" />
          <Path d="M12 3v2.5" />
        </>
      );
    case 'lampara': // lámpara de aceite encendida
      return (
        <>
          <Path d="M3.5 14c2 3 5 4 8.5 4s6.5-1 8.5-4c-3 0-5.5-1-8.5-1s-5.5 1-8.5 1z" />
          <Path d="M20.5 14l1.5-2" />
          <Path d="M9 20.5h6" />
          <Path d="M12 11c-1.4-1.3-1.6-3.2 0-5.5 1.6 2.3 1.4 4.2 0 5.5z" fill={color} />
        </>
      );
    case 'sol': // sol que sale: nuevas cada mañana
      return (
        <>
          <Path d="M7 17a5 5 0 0 1 10 0" />
          <Path d="M3 17h18M6 20.5h12" />
          <Path d="M12 6.5v3M5.5 9.5l2 2M18.5 9.5l-2 2M2.5 13.5h2M19.5 13.5h2" />
        </>
      );
    default:
      return <Rect x={6} y={6} width={12} height={12} rx={3} />;
  }
}
