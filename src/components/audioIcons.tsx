// Íconos del reproductor, con el mismo trazo que los de las pantallas de cuenta (comunidad/icons.tsx).
import Svg, { Path, Text as SvgText } from 'react-native-svg';

type Props = { color: string; size?: number };

const Line = ({ size = 22, color, children }: Props & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

/** El triángulo tiene su centro de gravedad en el centro de la caja: así se ve centrado en un botón redondo. */
export const PlayIcon = ({ size = 22, color }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.6-6.8c.6-.4.6-1.4 0-1.8L9.6 4.3C8.9 3.9 8 4.4 8 5.2z" fill={color} />
  </Svg>
);

export const PauseIcon = ({ size = 22, color }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M7 4.5h3.2v15H7zM13.8 4.5H17v15h-3.2z" fill={color} />
  </Svg>
);

/** Flecha en círculo hacia atrás (atrás 10 s o la intervención anterior). */
export const BackIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <Path d="M4.5 3.8v3.4h3.4" />
  </Line>
);

export const ForwardIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <Path d="M19.5 3.8v3.4h-3.4" />
  </Line>
);

/**
 * Atrás o adelante unos segundos: la flecha en círculo con el número dentro, dibujado en el mismo SVG para que
 * quede centrado en cualquier tamaño y tipo de letra.
 */
const Skip = ({ size = 26, color, seconds, forward }: Props & { seconds: number; forward?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d={forward ? 'M19.4 9.2A8 8 0 1 1 15.6 4.8' : 'M4.6 9.2A8 8 0 1 0 8.4 4.8'}
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
    />
    <Path d={forward ? 'M15.4 2.2l.6 3.1-3.1.8' : 'M8.6 2.2 8 5.3l3.1.8'} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    <SvgText x={12} y={15.6} fill={color} fontSize={8} fontWeight="700" textAnchor="middle">
      {seconds}
    </SvgText>
  </Svg>
);

export const SkipBackIcon = (p: Props & { seconds?: number }) => <Skip {...p} seconds={p.seconds ?? 10} />;
export const SkipForwardIcon = (p: Props & { seconds?: number }) => <Skip {...p} seconds={p.seconds ?? 10} forward />;

export const CloseIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Line>
);

/** Auriculares: la lectura del capítulo. */
export const ListenIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3" />
    <Path d="M4.5 14.5h2.2c.6 0 1 .4 1 1v3c0 .6-.4 1-1 1H5.5a1 1 0 0 1-1-1zM19.5 14.5h-2.2c-.6 0-1 .4-1 1v3c0 .6.4 1 1 1h1.2a1 1 0 0 0 1-1z" />
  </Line>
);

/** Ondas de sonido sobre una escena: el audio dramatizado, con voces, efectos y música. */
export const DramaIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M3.5 12h1.5M7.5 8.5v7M11 5.5v13M14.5 8v8M18 10.5v3M20.5 12h0" />
  </Line>
);

/** Dos globos de diálogo: el pódcast de Ana y Tomás. */
export const TalkIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M4 5.5h10a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4A1.5 1.5 0 0 1 2.5 12V7A1.5 1.5 0 0 1 4 5.5z" />
    <Path d="M18 9h1.5A1.5 1.5 0 0 1 21 10.5v5a1.5 1.5 0 0 1-1.5 1.5H19v3l-3.5-3H12" />
  </Line>
);
