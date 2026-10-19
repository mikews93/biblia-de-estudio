// Íconos de línea de las pantallas de cuenta y de comunidad (base común en ../iconLine.tsx).
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Line, type IconProps as Props } from '../iconLine';

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

/** Nube con flecha hacia abajo: descargar para leer sin conexión. */
export const DownloadIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M7 17.5H6a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 16 8a4.5 4.5 0 0 1 2 8.6" />
    <Path d="M12 11v9M8.8 17l3.2 3.2 3.2-3.2" />
  </Line>
);

/** Nube tachada: sin conexión. */
export const OfflineIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M8.5 7.4A5.5 5.5 0 0 1 16 9a4.5 4.5 0 0 1 3.4 7.4M16 18H6a4 4 0 0 1-.6-7.95c.1-.5.3-1 .5-1.5" />
    <Path d="M3.5 3.5l17 17" />
  </Line>
);

/** Marca de listo. */
export const CheckIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M5 12.5l4.2 4.2L19 7" />
  </Line>
);

/** Cámara: cambiar la foto del perfil. */
export const CameraIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M4.5 8h2.8l1.6-2.5h6.2L16.7 8h2.8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8z" />
    <Circle cx={12} cy={13.2} r={3.4} />
  </Line>
);

/** Templo con su cruz: la iglesia de la persona. */
export const ChurchIcon = (p: Props) => (
  <Line {...p}>
    <Path d="M12 2.5v4M10.3 4.2h3.4" />
    <Path d="M5 20.5V12l7-5.5 7 5.5v8.5z" />
    <Path d="M10 20.5v-4a2 2 0 0 1 4 0v4" />
  </Line>
);



/** Llave: entrar con correo y contraseña. */
export const KeyIcon = (p: Props) => (
  <Line {...p}>
    <Circle cx={8} cy={14} r={4} />
    <Path d="M11 11.2l8.5-8.2M16.5 6l2.5 2.5M14.3 8.2l2 2" />
  </Line>
);

/** El logo de Facebook (la «f» blanca sobre su círculo azul), como lo pide su guía de marca. */
export const FacebookLogo = ({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={12} fill="#0866FF" />
    <Path
      fill="#FFFFFF"
      d="M13.4 24v-8.5h2.9l.5-3.4h-3.4V9.9c0-1 .3-1.6 1.7-1.6h1.8v-3a24 24 0 0 0-2.6-.2c-2.6 0-4.4 1.6-4.4 4.5v2.5H7v3.4h2.9V24z"
    />
  </Svg>
);
