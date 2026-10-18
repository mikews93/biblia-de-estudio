// Una rama de la línea de tiempo: brota delgada (curvándose desde y0 si viene de otra), engorda y, si el
// reino termina, acaba en punta. Las ligaduras entre reinos son curvas que cruzan de un carril a otro.
import Svg, { Circle, Path } from 'react-native-svg';

export type RamaProps = {
  w: number;
  h: number;
  /** Altura del centro donde brota y donde se queda (en px dentro de la caja). */
  y0?: number;
  y1?: number;
  grosor: number;
  color: string;
  opacidad?: number;
  /** Empieza delgada, como un brote. */
  brote?: boolean;
  /** Termina en punta; si no, redondeada. */
  punta?: boolean;
  punteado?: boolean;
};

/** Contorno de una rama de ancho w; se exporta para las pruebas. */
export function contornoRama(w: number, y0: number, y1: number, grosor: number, brote: boolean, punta: boolean) {
  const g = grosor / 2;
  const g0 = brote ? Math.min(1, g) : g;
  const c = Math.min(28, w / 3);
  const e = Math.min(16, w / 4);
  const r = (n: number) => Math.round(n * 10) / 10;
  const fin = punta
    ? `L${r(w)},${r(y1)} L${r(w - e)},${r(y1 + g)}`
    : `Q${r(w)},${r(y1 - g)} ${r(w)},${r(y1)} Q${r(w)},${r(y1 + g)} ${r(w - e)},${r(y1 + g)}`;
  return (
    `M0,${r(y0 - g0)} C${r(c / 2)},${r(y0 - g0)} ${r(c / 2)},${r(y1 - g)} ${r(c)},${r(y1 - g)} ` +
    `L${r(w - e)},${r(y1 - g)} ${fin} L${r(c)},${r(y1 + g)} ` +
    `C${r(c / 2)},${r(y1 + g)} ${r(c / 2)},${r(y0 + g0)} 0,${r(y0 + g0)} Z`
  );
}

export function Rama({ w, h, y0 = h / 2, y1 = h / 2, grosor, color, opacidad = 1, brote = true, punta = true, punteado }: RamaProps) {
  if (w < 2) return null;
  if (punteado)
    return (
      <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
        <Path d={`M0,${y0} L${w},${y1}`} stroke={color} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" opacity={opacidad} />
      </Svg>
    );
  return (
    <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Path d={contornoRama(w, y0, y1, grosor, brote, punta)} fill={color} opacity={opacidad} />
    </Svg>
  );
}

/** Curva que une el final de un reino con el comienzo de otro, con un nudo donde se separa. */
export function Ligadura({ w, h, desdeArriba, color, opacidad = 0.6 }: { w: number; h: number; desdeArriba: boolean; color: string; opacidad?: number }) {
  const ya = desdeArriba ? 3 : h - 3;
  const yb = desdeArriba ? h - 3 : 3;
  return (
    <Svg width={w} height={h} pointerEvents="none">
      <Path d={`M3,${ya} C${w * 0.55},${ya} ${w * 0.45},${yb} ${w},${yb}`} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={opacidad} />
      <Circle cx={3} cy={ya} r={3} fill={color} opacity={opacidad} />
    </Svg>
  );
}
