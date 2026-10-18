// Íconos de línea de las pantallas de cuenta, con el mismo trazo que GlobeIcon y TreeIcon.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Props = { color: string; size?: number };

const Line = ({ size = 22, color, children }: Props & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

/** Biblia abierta con su cinta. */
export const OpenBookIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
    <Path d="M12 6.5v13" />
    <Path d="M15.5 5.2v5l1.5-1.2 1.5 1.2V5.1" />
  </Line>
);

/** Destello: lo que prepara la IA. */
export const SparkIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 3.5l1.9 5.2 5.1 1.8-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.8z" />
    <Path d="M18.5 16v4M16.5 18h4" />
  </Line>
);

/** Dos personas: grupos y amigos. */
export const PeopleIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={9} cy={8.5} r={3} />
    <Path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
    <Circle cx={16.5} cy={9.5} r={2.4} />
    <Path d="M15.8 14.3c2.3.1 4 1.6 4.7 4.2" />
  </Line>
);

/** Teléfono y pantalla: la cuenta en todos los dispositivos. */
export const DevicesIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={2.5} y={5} width={13} height={9.5} rx={1.5} />
    <Path d="M6 18h6M9 14.5V18" />
    <Rect x={16} y={8.5} width={5.5} height={10.5} rx={1.3} />
  </Line>
);
