// La base de todos los íconos de línea de la app: caja de 24 × 24, trazo de 1,7 y puntas redondas.
// Cada familia (icons.tsx, comunidad/icons.tsx, audioIcons.tsx, IconoHistoria.tsx) dibuja sobre esta misma base,
// así un ícono de cualquier pantalla se ve igual de grueso y del mismo estilo que los demás.
import Svg from 'react-native-svg';

export type IconProps = { color: string; size?: number; strokeWidth?: number };

export const STROKE = 1.7;

export const Line = ({ size = 22, color, strokeWidth = STROKE, children }: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);
