import { useState } from 'react';
import { Image, ImageProps, Platform } from 'react-native';

import { SITIO } from '@/lib/sitio';
import { sized, standardThumb, viaApp } from '@/lib/wikimedia';

// En la web, el mismo sitio (también en vistas previas y localhost); en la app nativa, zarzabiblia.com.
const ORIGIN = Platform.OS === 'web' ? '' : SITIO;

type Props = Omit<ImageProps, 'source' | 'onError'> & {
  /** La dirección de Wikimedia Commons que traen los datos. */
  url: string;
  /** El ancho que basta para mostrarla (un ancho estándar de Wikimedia: 330, 500, 960…). */
  width?: number;
  /** El ancho de la imagen según los datos, para no pedir una miniatura más ancha que el archivo. */
  originalWidth?: number;
  /** Cuando no carga ni por el servidor de la app ni directo desde Wikimedia. */
  onFail?: () => void;
};

/**
 * Una imagen de Wikimedia Commons pedida al servidor de la app (src/lib/wikimedia.ts). Si el servidor no responde,
 * prueba directo con Wikimedia antes de rendirse.
 */
export default function ImagenCommons({ url, width, originalWidth, onFail, ...rest }: Props) {
  const src = width ? sized(url, width, originalWidth) : url;
  const tries = [viaApp(src, ORIGIN), standardThumb(src)].filter((u, i, all) => all.indexOf(u) === i);
  const [attempt, setAttempt] = useState(0);
  const [key, setKey] = useState(src);
  if (key !== src) {
    setKey(src);
    setAttempt(0);
  }
  return (
    <Image
      {...rest}
      source={{ uri: tries[Math.min(attempt, tries.length - 1)] }}
      onError={() => (attempt + 1 < tries.length ? setAttempt(attempt + 1) : onFail?.())}
    />
  );
}
