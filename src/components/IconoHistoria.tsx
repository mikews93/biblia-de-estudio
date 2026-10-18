// Iconos de línea para los acontecimientos de la línea de tiempo (mismo trazo que comunidad/icons.tsx).
import { ReactNode } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Icono } from '@/lib/iconos';

const DIBUJOS: Record<Icono, ReactNode> = {
  // Corona de tres puntas
  corona: <Path d="M4 17.5h16M4.5 17.5 3.5 8l5 4 3.5-6 3.5 6 5-4-1 9.5" />,
  // Espada con guarda
  espada: (
    <>
      <Path d="M18.5 3.5 9 13l2 2 9.5-9.5V3.5z" />
      <Path d="M7 11.5l5.5 5.5M8.5 15.5 5 19M4 18l2 2" />
    </>
  ),
  // Rollo abierto
  pergamino: (
    <>
      <Path d="M7 4.5h11a2 2 0 0 1 0 4h-1.5V17a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 17v-1h11v1a2.5 2.5 0 0 0 2.5 2.5" />
      <Path d="M7 4.5A2 2 0 0 0 5 6.5V16M9 9h4.5M9 12h4.5" />
    </>
  ),
  // Pluma de escribir
  pluma: (
    <>
      <Path d="M19.5 4.5C13 5 8.5 9.5 7 16.5l-2 3" />
      <Path d="M19.5 4.5c-.5 6.5-5 11-11.5 12.5M10 13l3.5-3.5" />
    </>
  ),
  // Estela de piedra con inscripción
  estela: (
    <>
      <Path d="M6.5 20.5V8a5.5 5.5 0 0 1 11 0v12.5M4.5 20.5h15" />
      <Path d="M9.5 9.5h5M9.5 12.5h5M9.5 15.5h3.5" />
    </>
  ),
  // Templo con columnas
  templo: (
    <>
      <Path d="M3.5 9.5 12 4l8.5 5.5zM4.5 20h15M3.5 22h17" />
      <Path d="M6.5 12v6M10 12v6M14 12v6M17.5 12v6" />
    </>
  ),
  // Pirámide escalonada / monumento
  piramide: (
    <>
      <Path d="M2.5 20 12 4.5 21.5 20z" />
      <Path d="M7 13h10M5 16.5h14" />
    </>
  ),
  // Muralla con almenas
  muralla: <Path d="M3.5 20V8h3v2.5h3V8h5v2.5h3V8h3v12zM10 20v-4.5a2 2 0 0 1 4 0V20" />,
  // Ciudad: torres y casas
  ciudad: (
    <>
      <Path d="M3 20.5h18M5 20.5V11l4-3 4 3v9.5M13 20.5V6.5h6v14" />
      <Path d="M8 13.5h2M8 17h2M15.5 9.5h1M15.5 13h1M15.5 16.5h1" />
    </>
  ),
  // Lámpara de aceite: sabiduría y enseñanza
  lampara: (
    <>
      <Path d="M3.5 13.5c0 2.5 3.5 4 8 4s7-1.5 8.5-4.5H16c-1-1.5-3-2.5-5-2.5-3.5 0-7.5 1.5-7.5 3z" />
      <Path d="M20 13c1-.5 1.5-1.5 1-2.5M12 8.5c-1-1.5 0-3.5 1-4.5.5 1.5 1.5 2.5 1 4-.3 1-1.3 1.5-2 .5z" />
    </>
  ),
  // Barco de vela
  barco: (
    <>
      <Path d="M3 16h18l-2.5 4h-13zM12 16V3.5" />
      <Path d="M12 4.5l6.5 9H12M12 6 6.5 13.5H12" />
    </>
  ),
  // Llama
  fuego: (
    <Path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.5 2.5-5.5 3.5-8.5 1 1.5 1.5 3 1.5 4.5 1-2 2.5-5 1.5-8 4 2.5 6.5 7 6.5 12 0 3.4-2.6 6-6.5 6zM12 21c-1.7 0-3-1.2-3-3 0-2 1.7-3 2.5-4.5 1.5 1.3 3.5 2.6 3.5 4.5 0 1.8-1.3 3-3 3z" />
  ),
  // Corona de laurel
  laurel: (
    <>
      <Path d="M8.5 20C4.5 18 3 14 4 8.5M15.5 20c4-2 5.5-6 4.5-11.5" />
      <Path d="M4.3 12.5c1.7-.2 2.9.6 3.2 2M3.9 9c1.5-.5 2.8 0 3.4 1.3M5.5 16c1.6-.6 2.9-.1 3.4 1.2M19.7 12.5c-1.7-.2-2.9.6-3.2 2M20.1 9c-1.5-.5-2.8 0-3.4 1.3M18.5 16c-1.6-.6-2.9-.1-3.4 1.2" />
    </>
  ),
  // Shofar: el cuerno de los profetas y las trompetas
  shofar: (
    <>
      <Path d="M3.5 16.5c5 .5 9.5-2 11.5-7.5l.8-4c1.6-.7 3.6-.3 4.9 1.2-.7 7.5-7 13.5-16 13.8z" />
      <Path d="M15.8 5c.9.9 2.6 1.4 4.9 1.2M3.5 16.5l.7 3.5" />
    </>
  ),
  // Tienda de los patriarcas
  tienda: (
    <>
      <Path d="M2.5 20 12 5l9.5 15zM12 5 9 20M12 5l3 15" />
      <Path d="M10.5 3.5 12 5l1.5-1.5" />
    </>
  ),
  // Montaña (Sinaí)
  montana: (
    <>
      <Path d="M2.5 20 9.5 8l3.5 6 2.5-4 6 10z" />
      <Path d="M7.5 11.5 9.5 13l2-1.5" />
    </>
  ),
  // Olas: el mar abierto
  olas: (
    <Path d="M3 8.5c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0M3 13c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0M3 17.5c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0" />
  ),
  // Arpa (lira de David)
  arpa: (
    <>
      <Path d="M6 20.5V4.5c4 0 6 1.5 8 4.5s3.5 6 5 6.5V20.5z" />
      <Path d="M9 7v13.5M12 9v11.5M15 12.5v8" />
    </>
  ),
  // Espiga de trigo
  espiga: (
    <>
      <Path d="M12 21V6" />
      <Path d="M12 6c-1.5-1-1.5-2.5 0-3.5 1.5 1 1.5 2.5 0 3.5zM12 10c-2.5 0-3.5-1.5-3.5-3 2 0 3.5 1 3.5 3zm0 0c2.5 0 3.5-1.5 3.5-3-2 0-3.5 1-3.5 3zM12 14c-2.5 0-3.5-1.5-3.5-3 2 0 3.5 1 3.5 3zm0 0c2.5 0 3.5-1.5 3.5-3-2 0-3.5 1-3.5 3z" />
    </>
  ),
  // Cadena: destierro y prisión
  cadena: (
    <>
      <Path d="M10 14a3.5 3.5 0 0 1 0-5l2.5-2.5a3.5 3.5 0 0 1 5 5L16 13" />
      <Path d="M14 10a3.5 3.5 0 0 1 0 5l-2.5 2.5a3.5 3.5 0 0 1-5-5L8 11" />
    </>
  ),
  // Estrella
  estrella: <Path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z" />,
  // Cruz
  cruz: <Path d="M12 3v18M7 8h10" />,
  // Paloma: el Espíritu y la iglesia
  paloma: (
    <>
      <Path d="M3.5 13.5c3 .5 5.5 0 7.5-2l3.5-4.5c1-1.3 3-1.3 4 0l1.5 1.5-2 .5c.5 4.5-2.5 8.5-8 8.5-3 0-5.5-1.5-6.5-4z" />
      <Path d="M11 11.5c-.5-3-2-5.5-4.5-7 0 3 1 5.5 3 7.5" />
    </>
  ),
  punto: <Circle cx={12} cy={12} r={3.5} />,
};

export default function IconoHistoria({ icono, color, size = 14, grosor = 1.8 }: { icono: Icono; color: string; size?: number; grosor?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round">
      {DIBUJOS[icono]}
    </Svg>
  );
}
