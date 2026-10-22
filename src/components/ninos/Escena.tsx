// Las ilustraciones del Espacio Niños: una escena plana por historia, dibujada con formas simples y colores suaves
// (como un libro de cuentos). En el tema oscuro se les pone un velo para que no encandilen.
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { Colors } from '@/lib/theme';
import { isDark } from '@/lib/theme';

const ANCHO = 320;
const ALTO = 200;
export const PROPORCION = ANCHO / ALTO;

type Props = { id: string; colors: Colors; style?: ViewStyle; titulo?: string };

export default function Escena({ id, colors, style, titulo }: Props) {
  const Dibujo = ESCENAS[id] ?? Creacion;
  return (
    <View style={[{ width: '100%', aspectRatio: PROPORCION, overflow: 'hidden' }, style]} accessibilityRole="image" accessibilityLabel={titulo}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="xMidYMid slice">
        <Dibujo />
        {isDark(colors) && <Rect width={ANCHO} height={ALTO} fill="#0b0d14" opacity={0.24} />}
      </Svg>
    </View>
  );
}

// ——— Piezas ———

function Cielo({ id, de, a }: { id: string; de: string; a: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`cielo-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={de} />
          <Stop offset="1" stopColor={a} />
        </LinearGradient>
      </Defs>
      <Rect width={ANCHO} height={ALTO} fill={`url(#cielo-${id})`} />
    </>
  );
}

function Nube({ x, y, s = 1, color = '#ffffff', o = 0.95 }: { x: number; y: number; s?: number; color?: string; o?: number }) {
  return (
    <G opacity={o}>
      <Ellipse cx={x} cy={y} rx={22 * s} ry={8 * s} fill={color} />
      <Circle cx={x - 8 * s} cy={y - 5 * s} r={8 * s} fill={color} />
      <Circle cx={x + 5 * s} cy={y - 8 * s} r={10 * s} fill={color} />
    </G>
  );
}

function Estrellitas({ puntos, color = '#fff7d6' }: { puntos: [number, number, number][]; color?: string }) {
  return (
    <>
      {puntos.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.5 + (i % 3) * 0.2} />
      ))}
    </>
  );
}

/** Una persona de cuento: cabeza redonda y túnica. (x, y) es el pie. */
function Persona({ x, y, s = 1, ropa, piel = '#e2a77a', pelo = '#4a3426', brazo }: { x: number; y: number; s?: number; ropa: string; piel?: string; pelo?: string; brazo?: 'arriba' | 'honda' }) {
  return (
    <G>
      {brazo === 'arriba' && <Line x1={x + 4 * s} y1={y - 15 * s} x2={x + 10 * s} y2={y - 28 * s} stroke={ropa} strokeWidth={3.2 * s} strokeLinecap="round" />}
      {brazo === 'honda' && (
        <>
          <Line x1={x + 4 * s} y1={y - 15 * s} x2={x + 11 * s} y2={y - 26 * s} stroke={ropa} strokeWidth={3 * s} strokeLinecap="round" />
          <Path d={`M${x + 11 * s} ${y - 26 * s} q ${6 * s} ${-6 * s} ${3 * s} ${-13 * s}`} stroke="#6b4f3a" strokeWidth={1.2 * s} fill="none" />
        </>
      )}
      <Path d={`M${x - 7 * s} ${y} L${x - 5 * s} ${y - 16 * s} Q${x} ${y - 19.5 * s} ${x + 5 * s} ${y - 16 * s} L${x + 7 * s} ${y} Z`} fill={ropa} />
      <Circle cx={x} cy={y - 22 * s} r={6 * s} fill={piel} />
      <Path d={`M${x - 6 * s} ${y - 23 * s} Q${x} ${y - 31 * s} ${x + 6 * s} ${y - 23 * s} Q${x} ${y - 26 * s} ${x - 6 * s} ${y - 23 * s} Z`} fill={pelo} />
    </G>
  );
}

function Oveja({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G>
      <Line x1={x - 6 * s} y1={y} x2={x - 6 * s} y2={y + 7 * s} stroke="#5b5048" strokeWidth={2 * s} strokeLinecap="round" />
      <Line x1={x + 6 * s} y1={y} x2={x + 6 * s} y2={y + 7 * s} stroke="#5b5048" strokeWidth={2 * s} strokeLinecap="round" />
      <Circle cx={x - 7 * s} cy={y - 3 * s} r={6 * s} fill="#fbf8f1" />
      <Circle cx={x} cy={y - 6 * s} r={7 * s} fill="#fbf8f1" />
      <Circle cx={x + 7 * s} cy={y - 3 * s} r={6 * s} fill="#fbf8f1" />
      <Ellipse cx={x} cy={y - 1 * s} rx={10 * s} ry={5 * s} fill="#fbf8f1" />
      <Ellipse cx={x + 13 * s} cy={y - 6 * s} rx={4 * s} ry={4.6 * s} fill="#5b5048" />
    </G>
  );
}

function Leon({ x, y, lado = 1 }: { x: number; y: number; lado?: 1 | -1 }) {
  const c = (dx: number) => x + dx * lado;
  return (
    <G>
      <Path d={`M${c(-30)} ${y - 6} q ${-12 * lado} -4 ${-10 * lado} -16`} stroke="#c58f37" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Ellipse cx={x} cy={y} rx={32} ry={14} fill="#dcaa4b" />
      <Circle cx={c(28)} cy={y - 10} r={17} fill="#b8782d" />
      <Circle cx={c(30)} cy={y - 9} r={11} fill="#e8bb5f" />
      {/* duerme */}
      <Path d={`M${c(25)} ${y - 11} q 2 2 4 0 M${c(32)} ${y - 11} q 2 2 4 0`} stroke="#5a3b1a" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Ellipse cx={c(31)} cy={y - 5} rx={2.5} ry={1.6} fill="#5a3b1a" />
    </G>
  );
}

function Olas({ y, color, amp = 8, paso = 40, fondo = ALTO }: { y: number; color: string; amp?: number; paso?: number; fondo?: number }) {
  let d = `M-10 ${y}`;
  for (let x = -10; x < ANCHO + paso; x += paso) d += ` q ${paso / 4} ${-amp} ${paso / 2} 0 t ${paso / 2} 0`;
  return <Path d={`${d} V${fondo} H-10 Z`} fill={color} />;
}

// ——— Escenas ———

function Creacion() {
  const rayos = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);
  return (
    <>
      <Cielo id="creacion" de="#1d2446" a="#f2b866" />
      <Estrellitas puntos={[[24, 20, 1.4], [60, 38, 1], [96, 14, 1.2], [250, 18, 1.3], [286, 40, 1], [300, 12, 1.5], [36, 62, 1], [270, 64, 1.1]]} />
      {rayos.map((a, i) => (
        <Line key={i} x1={160 + Math.cos(a) * 34} y1={96 + Math.sin(a) * 34} x2={160 + Math.cos(a) * (i % 2 ? 70 : 92)} y2={96 + Math.sin(a) * (i % 2 ? 70 : 92)} stroke="#ffe9a8" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      ))}
      <Circle cx={160} cy={96} r={60} fill="#fff1c2" opacity={0.22} />
      <Circle cx={160} cy={96} r={40} fill="#fff4cf" opacity={0.5} />
      <Circle cx={160} cy={96} r={24} fill="#fffaea" />
      <Olas y={158} color="#2f5d7c" amp={6} paso={48} />
      <Olas y={172} color="#3d7398" amp={5} paso={36} />
      <Path d="M30 186 q 10 -5 20 0 M120 182 q 10 -5 20 0 M220 188 q 10 -5 20 0" stroke="#8fc0dc" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
    </>
  );
}

function ArcoIris() {
  const colores = ['#ee6c6c', '#f4a259', '#f5d45c', '#7cc576', '#5aa9e6', '#9b7fd4'];
  return (
    <>
      <Cielo id="arcoiris" de="#a6d8f1" a="#eaf7fc" />
      <Circle cx={42} cy={38} r={15} fill="#ffd166" />
      {colores.map((c, i) => {
        const r = 112 - i * 10;
        return <Path key={c} d={`M${160 - r} 160 A ${r} ${r} 0 0 1 ${160 + r} 160`} stroke={c} strokeWidth={10} fill="none" />;
      })}
      <Nube x={56} y={158} s={1.6} />
      <Nube x={266} y={158} s={1.6} />
      <Path d="M0 170 Q80 146 160 168 T320 158 V200 H0Z" fill="#8cc97a" />
      <Path d="M0 186 Q100 168 200 184 T320 180 V200 H0Z" fill="#72b562" />
      {/* el arca */}
      <Path d="M126 176 h68 l-10 14 h-48z" fill="#8a5a3b" />
      <Rect x={138} y={162} width={44} height={14} rx={2} fill="#b07a52" />
      <Path d="M134 163 L160 152 L186 163 Z" fill="#7a4d31" />
      <Rect x={154} y={166} width={10} height={8} rx={1.5} fill="#5b3a25" />
    </>
  );
}

function Mar() {
  const gente: [number, number, number][] = [[160, 118, 0.42], [154, 136, 0.55], [168, 150, 0.65], [150, 172, 0.8], [174, 192, 0.95]];
  return (
    <>
      <Cielo id="mar" de="#f6d4a0" a="#fdf1dc" />
      <Circle cx={160} cy={92} r={12} fill="#ffcf73" />
      <Path d="M150 96 L170 96 L232 200 L88 200 Z" fill="#e8c78d" />
      <Path d="M157 110 l3 6 M151 140 l4 8 M166 168 l5 10" stroke="#d3ae6f" strokeWidth={2} strokeLinecap="round" />
      <Path d="M0 64 Q40 54 74 68 Q112 82 150 96 L88 200 L0 200 Z" fill="#3c84b5" />
      <Path d="M320 64 Q280 54 246 68 Q208 82 170 96 L232 200 L320 200 Z" fill="#3c84b5" />
      <Path d="M150 96 L88 200" stroke="#7cbde3" strokeWidth={7} opacity={0.8} />
      <Path d="M170 96 L232 200" stroke="#7cbde3" strokeWidth={7} opacity={0.8} />
      <Path d="M20 100 q 12 -6 24 0 M40 140 q 12 -6 24 0 M14 176 q 12 -6 24 0 M276 104 q 12 -6 24 0 M256 146 q 12 -6 24 0 M284 180 q 12 -6 24 0" stroke="#9fd0ec" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {[[0, 64], [37, 57], [74, 68], [112, 82], [246, 68], [283, 57], [320, 64], [208, 82]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={6} fill="#eef8fd" />
      ))}
      {gente.map(([x, y, s], i) => (
        <Persona key={i} x={x} y={y} s={s} ropa={['#c4553d', '#4f7cc0', '#e0a23a', '#6b9b4f', '#9a5fb0'][i]} />
      ))}
    </>
  );
}

function David() {
  return (
    <>
      <Cielo id="david" de="#bde0f4" a="#ecf7fc" />
      <Nube x={70} y={36} s={1.1} />
      <Nube x={200} y={28} s={0.8} />
      <Path d="M0 140 Q90 112 170 136 T320 128 V200 H0Z" fill="#a9d490" />
      <Path d="M0 176 Q120 160 220 174 T320 170 V200 H0Z" fill="#c9b27c" />
      {/* Goliat */}
      <Line x1={282} y1={58} x2={282} y2={190} stroke="#6b4f3a" strokeWidth={4} strokeLinecap="round" />
      <Path d="M276 62 L282 44 L288 62 Z" fill="#8e9399" />
      <Persona x={252} y={192} s={3.3} ropa="#8d9097" piel="#d59a6c" pelo="#3a2a20" />
      <Path d={`M232 120 Q252 98 272 120 L270 126 Q252 116 234 126 Z`} fill="#a4a8ae" />
      <Rect x={231} y={142} width={42} height={20} rx={6} fill="#a4a8ae" opacity={0.85} />
      {/* David y la piedra */}
      <Path d="M96 152 Q150 70 214 110" stroke="#8a8a8a" strokeWidth={1.6} strokeDasharray="3 5" fill="none" strokeLinecap="round" />
      <Circle cx={168} cy={92} r={5} fill="#9b9b9b" />
      <Persona x={84} y={186} s={1.5} ropa="#e3a646" brazo="honda" />
      <Oveja x={42} y={182} s={0.8} />
    </>
  );
}

function Daniel() {
  return (
    <>
      <Cielo id="daniel" de="#5c4636" a="#3a2c22" />
      <Ellipse cx={160} cy={14} rx={72} ry={22} fill="#bfe3f5" />
      <Path d="M100 14 L220 14 L262 200 L58 200 Z" fill="#fff5d0" opacity={0.16} />
      <Ellipse cx={160} cy={128} rx={62} ry={72} fill="#fff1bf" opacity={0.3} />
      <Ellipse cx={160} cy={118} rx={34} ry={44} fill="#fff6d8" opacity={0.35} />
      <Path d="M0 60 Q20 120 10 200 H0Z M320 60 Q300 120 310 200 H320Z" fill="#2f241c" opacity={0.6} />
      <Rect x={0} y={186} width={ANCHO} height={14} fill="#4a382b" />
      <Leon x={74} y={180} />
      <Leon x={246} y={180} lado={-1} />
      <Persona x={160} y={188} s={1.7} ropa="#4f7cc0" brazo="arriba" />
    </>
  );
}

function Jonas() {
  return (
    <>
      <Cielo id="jonas" de="#c9dbe9" a="#eff6fa" />
      <Nube x={240} y={34} s={1.2} />
      <Defs>
        <LinearGradient id="mar-jonas" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3483b2" />
          <Stop offset="1" stopColor="#1d4f70" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={84} width={ANCHO} height={116} fill="url(#mar-jonas)" />
      <Olas y={86} color="#3483b2" amp={4} paso={30} fondo={96} />
      {/* el barco a lo lejos */}
      <Path d="M44 84 h34 l-5 7 h-24z" fill="#7a4b2b" />
      <Line x1={61} y1={84} x2={61} y2={62} stroke="#5b3a25" strokeWidth={1.6} />
      <Path d="M62 64 L76 80 L62 80 Z" fill="#f4ecdc" />
      {/* el gran pez */}
      <Path d="M88 142 Q116 100 188 104 Q238 108 254 136 L290 112 L282 146 L292 178 L254 154 Q234 182 180 184 Q114 184 88 142 Z" fill="#4b7fa7" />
      <Path d="M96 150 Q140 176 196 176 Q232 174 248 156 Q216 168 180 168 Q130 166 96 150 Z" fill="#a9cbe2" />
      <Circle cx={124} cy={128} r={4.5} fill="#1c2d3b" />
      <Circle cx={125.5} cy={126.5} r={1.4} fill="#ffffff" />
      <Path d="M96 146 q 10 6 22 4" stroke="#1c2d3b" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M190 118 q 10 10 0 22" stroke="#3c6d93" strokeWidth={3} fill="none" strokeLinecap="round" />
      {[[80, 120, 4], [70, 104, 3], [76, 92, 2]].map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="none" stroke="#cfe6f3" strokeWidth={1.4} />
      ))}
    </>
  );
}

function Navidad() {
  return (
    <>
      <Cielo id="navidad" de="#141a39" a="#33396b" />
      <Estrellitas puntos={[[20, 18, 1.2], [70, 40, 1], [110, 16, 1.4], [150, 50, 0.9], [190, 22, 1], [300, 30, 1.3], [290, 70, 1], [40, 70, 1]]} />
      <Path d="M150 120 L238 52 L250 60 L210 130 Z" fill="#fff4c4" opacity={0.12} />
      <Circle cx={244} cy={46} r={22} fill="#fff1b8" opacity={0.25} />
      <Path d="M244 22 L249 41 L268 46 L249 51 L244 70 L239 51 L220 46 L239 41 Z" fill="#fff6d2" />
      <Path d="M0 160 Q90 132 180 156 T320 150 V200 H0Z" fill="#2c4a3c" />
      <Path d="M0 184 Q120 170 230 182 T320 180 V200 H0Z" fill="#3b5d45" />
      {/* el establo */}
      <Rect x={118} y={124} width={88} height={52} fill="#7a5235" />
      <Path d="M108 128 L162 96 L216 128 Z" fill="#5b3c27" />
      <Rect x={130} y={136} width={64} height={40} fill="#3b2a1e" />
      <Ellipse cx={162} cy={160} rx={26} ry={16} fill="#ffe9a8" opacity={0.35} />
      <Path d="M146 162 h32 l-5 12 h-22 z" fill="#a8763f" />
      <Ellipse cx={162} cy={160} rx={12} ry={5} fill="#f5efe2" />
      <Circle cx={153} cy={158} r={4} fill="#f0c9a0" />
      <Persona x={140} y={176} s={0.9} ropa="#4f7cc0" />
      <Persona x={186} y={176} s={0.95} ropa="#8a6f4e" />
      <Oveja x={56} y={180} s={1} />
      <Oveja x={268} y={186} s={1.1} />
      <Persona x={84} y={186} s={1.1} ropa="#9b6b3c" brazo="arriba" />
    </>
  );
}

function Tormenta() {
  return (
    <>
      <Cielo id="tormenta" de="#4b596b" a="#8c9bab" />
      <Nube x={60} y={30} s={2.2} color="#3e4957" o={1} />
      <Nube x={230} y={26} s={2.6} color="#46525f" o={1} />
      <Path d="M262 40 L246 74 L258 74 L242 106 L276 64 L262 64 L274 40 Z" fill="#ffe17a" />
      {Array.from({ length: 16 }, (_, i) => (
        <Line key={i} x1={10 + i * 20} y1={50 + (i % 3) * 8} x2={2 + i * 20} y2={72 + (i % 3) * 8} stroke="#d4dde6" strokeWidth={1.4} opacity={0.55} strokeLinecap="round" />
      ))}
      <Olas y={138} color="#2c5675" amp={22} paso={64} />
      {/* la barca */}
      <G transform="rotate(-6 160 140)">
        <Line x1={160} y1={140} x2={160} y2={64} stroke="#5b3a25" strokeWidth={3} />
        <Path d="M162 68 L204 128 L162 128 Z" fill="#efe6d2" />
        <Persona x={130} y={142} s={0.9} ropa="#c4553d" />
        <Persona x={146} y={142} s={0.85} ropa="#e0a23a" />
        <Persona x={184} y={144} s={1.05} ropa="#f4f1ea" brazo="arriba" />
        <Path d="M96 138 h128 l-20 30 h-88 z" fill="#7a4b2b" />
        <Path d="M104 148 h112" stroke="#5b3a25" strokeWidth={2} />
      </G>
      <Olas y={168} color="#3b6d90" amp={14} paso={52} />
      <Path d="M20 168 q 8 -8 16 0 M150 172 q 8 -8 16 0 M270 166 q 8 -8 16 0" stroke="#d7e6f0" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </>
  );
}

function Panes() {
  const cabezas: [number, number, string][] = [];
  const tonos = ['#c4553d', '#4f7cc0', '#e0a23a', '#6b9b4f', '#9a5fb0', '#d07a9a'];
  for (let i = 0; i < 18; i++) cabezas.push([12 + i * 17.5, 118 + (i % 2) * 5, tonos[i % tonos.length]]);
  for (let i = 0; i < 14; i++) cabezas.push([24 + i * 21, 138 + (i % 2) * 4, tonos[(i + 3) % tonos.length]]);
  return (
    <>
      <Cielo id="panes" de="#d5eee6" a="#f5fbf8" />
      <Circle cx={270} cy={36} r={16} fill="#ffd36e" />
      <Path d="M0 120 Q100 92 200 114 T320 106 V200 H0Z" fill="#93cf82" />
      {cabezas.map(([x, y, c], i) => (
        <G key={i}>
          <Path d={`M${x - 5} ${y + 10} Q${x} ${y + 2} ${x + 5} ${y + 10} Z`} fill={c} />
          <Circle cx={x} cy={y} r={3.6} fill="#e2a77a" />
        </G>
      ))}
      <Path d="M0 150 Q120 136 220 150 T320 146 V200 H0Z" fill="#7cbf6b" />
      {/* la canasta */}
      <Path d="M104 152 h112 l-14 40 h-84 z" fill="#b9824a" />
      <Path d="M108 162 h104 M112 174 h96 M116 186 h88" stroke="#9a6a38" strokeWidth={2} />
      {[118, 138, 160, 182, 202].map((x, i) => (
        <G key={x}>
          <Ellipse cx={x} cy={148 - (i % 2) * 6} rx={13} ry={9} fill="#e1ac63" />
          <Path d={`M${x - 6} ${146 - (i % 2) * 6} q 6 -4 12 0`} stroke="#f3cf91" strokeWidth={2} fill="none" strokeLinecap="round" />
        </G>
      ))}
      {[[140, 130, 1], [184, 128, -1]].map(([x, y, l], i) => (
        <G key={i}>
          <Path d={`M${x - 14 * l} ${y} Q${x} ${y - 10} ${x + 12 * l} ${y} Q${x} ${y + 10} ${x - 14 * l} ${y} Z`} fill="#f08a4b" />
          <Path d={`M${x + 12 * l} ${y} l ${8 * l} -7 l 0 14 z`} fill="#f08a4b" />
          <Circle cx={x - 7 * l} cy={y - 1.5} r={1.6} fill="#5a2c12" />
        </G>
      ))}
    </>
  );
}

function Zaqueo() {
  const gente: [number, string][] = [[20, '#c4553d'], [44, '#e0a23a'], [234, '#6b9b4f'], [258, '#9a5fb0'], [282, '#4f7cc0'], [306, '#d07a9a']];
  return (
    <>
      <Cielo id="zaqueo" de="#d8edfa" a="#f5fbff" />
      <Nube x={60} y={40} s={1} />
      <Path d="M0 168 Q160 150 320 168 V200 H0Z" fill="#ead7b0" />
      {/* el árbol */}
      <Path d="M186 200 L190 116 Q178 98 162 92 M190 120 Q204 100 222 96 M190 140 L196 116" stroke="#7a5236" strokeWidth={14} fill="none" strokeLinecap="round" />
      <Circle cx={160} cy={72} r={30} fill="#4f9d55" />
      <Circle cx={222} cy={70} r={32} fill="#4f9d55" />
      <Circle cx={190} cy={50} r={34} fill="#5fae63" />
      <Circle cx={140} cy={92} r={20} fill="#5fae63" />
      <Circle cx={240} cy={96} r={20} fill="#73c072" />
      {/* Zaqueo, asomado entre las hojas */}
      <Path d="M164 104 L168 92 Q174 88 180 92 L184 104 Z" fill="#7d5ba6" />
      <Circle cx={174} cy={84} r={7.5} fill="#e2a77a" />
      <Path d="M166 83 Q174 74 182 83 Q174 79 166 83 Z" fill="#4a3426" />
      <Line x1={182} y1={96} x2={194} y2={92} stroke="#7d5ba6" strokeWidth={3} strokeLinecap="round" />
      <Circle cx={196} cy={94} r={9} fill="#73c072" />
      <Circle cx={152} cy={104} r={10} fill="#73c072" />
      {/* Jesús lo mira desde abajo */}
      <Persona x={104} y={190} s={1.7} ropa="#f4f1ea" brazo="arriba" />
      {gente.map(([x, c]) => (
        <Persona key={x} x={x} y={200} s={1.25} ropa={c} />
      ))}
    </>
  );
}

function OvejaPerdida() {
  return (
    <>
      <Cielo id="oveja" de="#dff1d6" a="#f7fbf3" />
      <Circle cx={56} cy={42} r={14} fill="#ffd36e" />
      <Path d="M0 120 Q80 96 170 116 T320 104 V200 H0Z" fill="#b6dca0" />
      <Path d="M0 160 Q110 136 220 156 T320 150 V200 H0Z" fill="#93c97f" />
      <Oveja x={244} y={120} s={0.55} />
      <Oveja x={266} y={124} s={0.55} />
      <Oveja x={286} y={118} s={0.5} />
      <Path d="M20 176 q 14 -18 34 -6 q 10 6 8 16 h-44 z" fill="#a39d93" />
      <Path d="M266 186 q 16 -16 34 -4 q 8 6 6 14 h-42 z" fill="#b2ada4" />
      {/* el pastor con la oveja en los hombros */}
      <Path d="M186 190 L184 100 q 0 -14 -12 -14 q -10 0 -10 10" stroke="#6b4f3a" strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <G transform="translate(0 -2)">
        <Circle cx={146} cy={136} r={8} fill="#fbf8f1" />
        <Circle cx={156} cy={130} r={9} fill="#fbf8f1" />
        <Circle cx={170} cy={130} r={9} fill="#fbf8f1" />
        <Circle cx={178} cy={137} r={7} fill="#fbf8f1" />
        <Ellipse cx={138} cy={134} rx={5} ry={5.6} fill="#5b5048" />
      </G>
      <Persona x={160} y={192} s={2.4} ropa="#8a6f4e" />
    </>
  );
}

function Resucito() {
  const rayos = Array.from({ length: 9 }, (_, i) => Math.PI + (i / 8) * Math.PI);
  return (
    <>
      <Cielo id="resucito" de="#ffc98a" a="#fff3de" />
      {rayos.map((a, i) => (
        <Line key={i} x1={246 + Math.cos(a) * 36} y1={126 + Math.sin(a) * 36} x2={246 + Math.cos(a) * 70} y2={126 + Math.sin(a) * 70} stroke="#ffe08f" strokeWidth={3} strokeLinecap="round" />
      ))}
      <Circle cx={246} cy={126} r={28} fill="#ffcf5e" />
      <Path d="M0 140 Q90 118 200 136 T320 128 V200 H0Z" fill="#9ccf86" />
      {/* la tumba vacía y la piedra corrida */}
      <Path d="M60 184 Q64 96 136 92 Q206 96 210 184 Z" fill="#aaa59c" />
      <Path d="M76 184 Q80 112 136 108" stroke="#c3beb5" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Ellipse cx={136} cy={156} rx={22} ry={28} fill="#3b3530" />
      <Circle cx={204} cy={168} r={22} fill="#8f8a83" />
      <Circle cx={204} cy={168} r={15} fill="none" stroke="#a7a29a" strokeWidth={3} />
      <Path d="M0 178 Q140 168 320 182 V200 H0Z" fill="#86c070" />
      {[[30, 186, '#f28fb0'], [48, 190, '#ffd36e'], [252, 188, '#f28fb0'], [276, 192, '#b99be6'], [296, 186, '#ffd36e'], [96, 192, '#b99be6']].map(([x, y, c], i) => (
        <G key={i}>
          <Line x1={x as number} y1={(y as number) + 2} x2={x as number} y2={(y as number) + 10} stroke="#5d9a4a" strokeWidth={1.6} />
          <Circle cx={x as number} cy={y as number} r={3.4} fill={c as string} />
        </G>
      ))}
    </>
  );
}

const ESCENAS: Record<string, () => React.ReactElement> = {
  creacion: Creacion,
  arcoiris: ArcoIris,
  mar: Mar,
  david: David,
  daniel: Daniel,
  jonas: Jonas,
  navidad: Navidad,
  tormenta: Tormenta,
  panes: Panes,
  zaqueo: Zaqueo,
  oveja: OvejaPerdida,
  resucito: Resucito,
};
