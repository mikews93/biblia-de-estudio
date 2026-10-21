// Íconos de línea de toda la app: un solo juego, con la base común de iconLine.tsx (caja de 24 × 24, trazo de 1,7).
// Las pantallas usan estos íconos y no símbolos de texto ni emojis, para que cada función se vea igual en todas partes.
// Todos se dibujan con el centro óptico en (12, 12), para que queden centrados en sus botones.
import { Circle, Path, Rect } from 'react-native-svg';

import { Line, type IconProps as Props } from './iconLine';

export {
  CameraIcon,
  CheckIcon,
  ChurchIcon,
  CloudCheckIcon,
  CloudUpIcon,
  DevicesIcon,
  DownloadIcon,
  FacebookLogo,
  KeyIcon,
  OfflineIcon,
  OpenBookIcon,
  PeopleIcon,
  SparkIcon,
} from './comunidad/icons';
export { CloseIcon, DramaIcon, ListenIcon, PauseIcon, PlayIcon, TalkIcon } from './audioIcons';
export type { IconProps } from './iconLine';

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

export const ChevronUpIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M6.5 14.5 12 9l5.5 5.5" />
  </Line>
);

export const ArrowRightIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Line>
);

/** Flecha hacia arriba: enviar una pregunta o subir algo de lugar. */
export const ArrowUpIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 19.5v-15M6 10.5l6-6 6 6" />
  </Line>
);

export const ArrowDownIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 4.5v15M6 13.5l6 6 6-6" />
  </Line>
);

/** Flecha que sale de una caja: se abre fuera de la app. */
export const ExternalIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M13.5 4.5h6v6M19.5 4.5 11 13" />
    <Path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Line>
);

/** Flecha en círculo: preparar otra versión. */
export const RefreshIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <Path d="M19.5 3.8v3.4h-3.4" />
  </Line>
);

export const PlusIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 5v14M5 12h14" />
  </Line>
);

/** Más en un cuadrado: «Añadir a pantalla de inicio». */
export const PlusSquareIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={3.5} y={3.5} width={17} height={17} rx={4} />
    <Path d="M12 8v8M8 12h8" />
  </Line>
);

/** Lupa. */
export const SearchIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={10.5} cy={10.5} r={6.5} />
    <Path d="M15.5 15.5 20 20" />
  </Line>
);

/** Micrófono para dictar. */
export const MicIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={9} y={3} width={6} height={11} rx={3} />
    <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </Line>
);

/** Una persona: tu perfil. */
export const PersonIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={8.5} r={3.6} />
    <Path d="M5 20c.8-3.6 3.6-5.8 7-5.8s6.2 2.2 7 5.8" />
  </Line>
);

/** Campana: recordatorios y notificaciones. */
export const BellIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.5 6.5 2.5 7.5h-17C4.5 15.5 6 13.5 6 9Z" />
    <Path d="M10 20a2.2 2.2 0 0 0 4 0" />
  </Line>
);

/** Corazón: devocional, diario y «me gusta». Con «filled», relleno. */
export const HeartIcon = ({ filled, ...p }: Props & { filled?: boolean }) => (
  <Line {...p}>
    <Path
      d="M12 19.5s-7.5-4.4-7.5-9.7A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6c0 5.3-7.5 9.7-7.5 9.7z"
      fill={filled ? p.color : 'none'}
    />
  </Line>
);

/** Candado: lo que se guarda solo para ti. */
export const LockIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={5} y={10.5} width={14} height={10} rx={2.5} />
    <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
  </Line>
);

/** Globo de diálogo: comentarios. */
export const CommentIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M5.5 5h13A1.5 1.5 0 0 1 20 6.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h0A1.5 1.5 0 0 1 4 15.5v-9A1.5 1.5 0 0 1 5.5 5z" />
  </Line>
);

/** Tres libros en un estante: la lista de libros de la Biblia y las versiones. */
export const BooksIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={4} y={4.5} width={4} height={15.5} rx={1} />
    <Rect x={9.5} y={6.5} width={4} height={13.5} rx={1} />
    <Path d="m15.2 7.6 3.8-1 3 12.4-3.9 1z" />
  </Line>
);

/** Vela encendida: los retos de temporada. */
export const CandleIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 3c1.6 1.8 2 3.1 2 4a2 2 0 0 1-4 0c0-.9.4-2.2 2-4z" />
    <Rect x={8.5} y={11} width={7} height={9.5} rx={1.2} />
  </Line>
);

/** Luna: día de descanso. */
export const MoonIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
  </Line>
);

/** Sol: adorar y la luz del texto. */
export const SunIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={12} r={4} />
    <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Line>
);

/** Círculo mitad lleno: tema claro u oscuro. */
export const ContrastIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={12} r={8} />
    <Path d="M12 4a8 8 0 0 1 0 16z" fill={p.color} />
  </Line>
);

/** Alfiler de mapa: lugares. */
export const PinIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <Circle cx={12} cy={10} r={2.3} />
  </Line>
);

/** Mira de ubicación: centrar el mapa. */
export const LocateIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={12} r={6.5} />
    <Circle cx={12} cy={12} r={2} />
    <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </Line>
);

/** Ojo: observar el texto. */
export const EyeIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <Circle cx={12} cy={12} r={3} />
  </Line>
);

/** Brújula: panorama del pasaje. */
export const CompassIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={12} r={8.5} />
    <Path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Line>
);

/** Cruz. */
export const CrossIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 3v18M7 8h10" />
  </Line>
);

/** Manos juntas: pedir en oración. */
export const PrayIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 4c-1.3 1.5-2 3.4-2 5.5V14l-3.5 3.5V21" />
    <Path d="M12 4c1.3 1.5 2 3.4 2 5.5V14l3.5 3.5V21" />
    <Path d="M12 7.5V16" />
  </Line>
);

/** Lámpara de aceite con su llama: entender e interpretar. */
export const LampIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M3.5 13.5h12.5c2 0 3.5-1.5 4.5-3l-1-.5c-1 .8-2 1.2-3 1.2h-1.5" />
    <Path d="M3.5 13.5c0 2.8 2.5 4.5 6 4.5s6-1.7 6-4.5" />
    <Path d="M6.5 8.5c0-1.6 1-2.8 1.8-4 .8 1.2 1.8 2.4 1.8 4a1.8 1.8 0 0 1-3.6 0z" />
  </Line>
);

/** Pequeño globo terráqueo: lo que pasaba en el mundo. */
export const GlobeIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" />
  </Line>
);

/** Árbol genealógico: una persona arriba y dos abajo. */
export const TreeIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={5} r={2.6} />
    <Circle cx={6} cy={19} r={2.6} />
    <Circle cx={18} cy={19} r={2.6} />
    <Path d="M12 7.6V12M6 16.4V12h12v4.4" />
  </Line>
);

/** Reloj: búsquedas recientes. */
export const ClockIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={12} r={8.5} />
    <Path d="M12 7.5V12l3 2" />
  </Line>
);

/** Estrella de cuatro puntas: un hito alcanzado. Con «filled», rellena. */
export const StarIcon = ({ filled, ...p }: Props & { filled?: boolean }) => (
  <Line {...p}>
    <Path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z" fill={filled ? p.color : 'none'} />
    <Path d="M18 16.5v4M16 18.5h4" />
  </Line>
);

/** Dos páginas lado a lado con renglones: comparar versiones. */
export const CompareIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={3.5} y={4.5} width={7.5} height={15} rx={1.8} />
    <Rect x={13} y={4.5} width={7.5} height={15} rx={1.8} />
    <Path d="M5.8 8.5h3M5.8 11.5h3M5.8 14.5h2M15.3 8.5h3M15.3 11.5h2M15.3 14.5h3" />
  </Line>
);

/** Concordancia: renglones con la misma palabra marcada en cada uno. */
export const ConcordanceIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M4 6h3.5M11.5 6H20M4 12h7M15 12h5M4 18h2.5M10.5 18H20" />
    <Rect x={7.5} y={4.3} width={4} height={3.4} rx={1.2} />
    <Rect x={11} y={10.3} width={4} height={3.4} rx={1.2} />
    <Rect x={6.5} y={16.3} width={4} height={3.4} rx={1.2} />
  </Line>
);

/** Una palabra que se abre en dos: por qué difieren las versiones. */
export const ForkIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={5.5} r={2} />
    <Path d="M12 7.5v3.2c0 1.6-1 2.6-2.6 3.4L7.5 15v3.5M12 10.7c0 1.6 1 2.6 2.6 3.4l1.9.9v3.5" />
    <Path d="M5.5 18.5h4M14.5 18.5h4" />
  </Line>
);

/** Rollo de pergamino: diferencias entre manuscritos. */
export const ScrollIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M7 4.5h10.5a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H16" />
    <Path d="M7 4.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.5" />
    <Path d="M7 4.5a2 2 0 0 1 2 2v13" />
    <Path d="M11.5 11.5h3.5M11.5 14.5h3.5" />
  </Line>
);

/** Un arco de una promesa (círculo abierto) a su cumplimiento (círculo lleno): promesa y cumplimiento. */
export const PromiseIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M5.5 16.5C6.5 9 9 6 12 6s5.5 3 6.5 10.5" />
    <Circle cx={5.5} cy={18} r={2} />
    <Circle cx={18.5} cy={18} r={2} fill={p.color} />
  </Line>
);

/** Ondas a los lados de un punto: un evento en vivo. */
export const LiveIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={12} cy={12} r={2.2} fill={p.color} />
    <Path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" />
  </Line>
);

/** Tres esquinas de un código QR: unirse con la cámara. */
export const QrIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={4} y={4} width={6} height={6} rx={1.2} />
    <Rect x={14} y={4} width={6} height={6} rx={1.2} />
    <Rect x={4} y={14} width={6} height={6} rx={1.2} />
    <Path d="M14 14h2.5v2.5M20 14v.01M14 20h.01M17.5 20H20v-3" />
  </Line>
);

/** Una pantalla sobre su pie: proyectar en la iglesia. */
export const ScreenIcon = (p: Props) => (
  <Line {...p}>
    <Rect x={3.5} y={4.5} width={17} height={11.5} rx={1.8} />
    <Path d="M12 16v3.5M8.5 19.5h7" />
  </Line>
);

/** Reloj de arena: el tiempo de una dinámica. */
export const HourglassIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M7 3.5h10M7 20.5h10" />
    <Path d="M8 3.5c0 4 4 5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5-4 8.5s4 4.5 4 8.5" />
    <Path d="M10 18.5h4" />
  </Line>
);
