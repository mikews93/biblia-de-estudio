// Íconos de línea del lector y de la barra de abajo, con el mismo trazo que audioIcons.tsx y comunidad/icons.tsx.
// Todos se dibujan en una caja de 24 × 24 con el centro óptico en (12, 12), para que queden centrados en sus botones.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export { CheckIcon, OpenBookIcon, PeopleIcon, SparkIcon } from './comunidad/icons';
export { CloseIcon, DramaIcon, ListenIcon, TalkIcon } from './audioIcons';

type Props = { color: string; size?: number; strokeWidth?: number };

const Line = ({ size = 22, color, strokeWidth = 1.7, children }: Props & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const ChevronDownIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M6.5 9.5 12 15l5.5-5.5" />
  </Line>
);

export const ChevronLeftIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M14.5 6 8.5 12l6 6" />
  </Line>
);

export const ChevronRightIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M9.5 6l6 6-6 6" />
  </Line>
);

/** Casa con puerta: Hoy. */
export const HomeIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
    <Path d="M9.5 20.5v-5.5h5v5.5" />
  </Line>
);

/** Calendario con una marca: planes de lectura. */
export const PlansIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} />
    <Path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <Path d="m9 14.8 2 2 4-4" />
  </Line>
);

/** Atril con una hoja: el Taller (preparar reflexiones y mensajes). */
export const LecternIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M5 5.5h14l-2 6H7z" />
    <Path d="M9 8.5h6" />
    <Path d="M12 11.5v8M8.5 20.5h7" />
  </Line>
);

/** Idea central con tres ramas: mapa mental. */
export const MindMapIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={12} r={3} />
    <Circle cx={4.8} cy={5.8} r={1.8} />
    <Circle cx={19.2} cy={5.8} r={1.8} />
    <Circle cx={12} cy={20.2} r={1.8} />
    <Path d="M9.8 10 6.2 7M14.2 10l3.6-3M12 15v3.4" />
  </Line>
);

/** Dos tarjetas una sobre otra: tarjetas de repaso y memorizar. */
export const CardsIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={3.5} y={7} width={13} height={13} rx={2} />
    <Path d="M7.5 7V5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <Path d="M7 12h6M7 15.5h4" />
  </Line>
);

/** Dos eslabones: referencias cruzadas. */
export const LinkIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M10 14a4 4 0 0 0 5.7 0l3.1-3.1a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
    <Path d="M14 10a4 4 0 0 0-5.7 0l-3.1 3.1a4 4 0 0 0 5.7 5.7l1.3-1.3" />
  </Line>
);

/** Libro con renglones: comentario. */
export const CommentaryIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17z" />
    <Path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H19" />
    <Path d="M9 8.5h6M9 11.5h4" />
  </Line>
);

/** Lápiz: nota. */
export const PencilIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M15.5 5 19 8.5 9 18.5l-4.5 1 1-4.5z" />
    <Path d="m13.5 7 3.5 3.5" />
  </Line>
);

/** Caja con flecha hacia arriba: compartir. */
export const ShareIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <Path d="M8.5 10.5H7a2 2 0 0 0-2 2V18.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12.5a2 2 0 0 0-2-2h-1.5" />
  </Line>
);
