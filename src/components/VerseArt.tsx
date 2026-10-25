import { ComponentRef, Ref, useId, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { DEDICATORIA_SIZE, IMAGE_SIZE, ImageFormat, ImageLook, ORIGINAL_SIZE, siteBottom, verseFontSize } from '@/lib/compartir';
import { LETRA_DEDICATORIA, idsUnicos, palabras, useLetras } from '@/lib/fondos';
import { sans, serif } from '@/lib/theme';

type Props = {
  text: string;
  caption: string;
  format: ImageFormat;
  look: ImageLook;
  width: number;
  viewRef?: Ref<ComponentRef<typeof View>>;
  /** Tocar una palabra la destaca (solo en la vista previa de compartir). */
  onWordPress?: (index: number) => void;
};

/** La imagen del versículo dibujada con vistas: la vista previa al compartir y las imágenes del muro. */
export default function VerseArt({ text, caption, format, look, width, viewRef, onWordPress }: Props) {
  const { fondo, letra, destacadas = [], dedicatoria, original } = look;
  const size = IMAGE_SIZE[format];
  const scale = width / size.width;
  const fontSize = verseFontSize(text, format) * letra.escala * scale;
  const words = useMemo(() => palabras(text), [text]);
  // El dibujo se calcula al tamaño real de la imagen y se escala, para que se vea igual que la imagen descargada.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const xml = useMemo(() => {
    const svg = fondo.svg?.(size.width, size.height);
    return svg && idsUnicos(svg, `a${id}`);
  }, [fondo, size.width, size.height, id]);
  const shadow = fondo.sombra ? { textShadowColor: fondo.sombra, textShadowRadius: 18 * scale, textShadowOffset: { width: 0, height: 2 * scale } } : null;
  const dedic = dedicatoria?.trim();
  const letras = useLetras(!!letra.family || !!dedic);
  return (
    <View
      key={letras ? 'letras' : 'sistema'}
      ref={viewRef}
      collapsable={false}
      style={[styles.art, { width, height: size.height * scale, backgroundColor: fondo.background, paddingHorizontal: 110 * scale }]}
    >
      {xml && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgXml xml={xml} width="100%" height="100%" />
        </View>
      )}
      {dedic ? (
        <Text style={[{ color: fondo.accent, fontFamily: LETRA_DEDICATORIA, fontSize: DEDICATORIA_SIZE * scale, lineHeight: DEDICATORIA_SIZE * 1.2 * scale, marginBottom: 36 * scale, textAlign: 'center' }, shadow]}>
          {dedic}
        </Text>
      ) : null}
      <View style={{ width: 72 * scale, height: Math.max(1, 4 * scale), backgroundColor: fondo.accent, marginBottom: 56 * scale }} />
      <Text
        style={[
          {
            color: fondo.text,
            fontFamily: letra.family ?? serif,
            fontSize,
            lineHeight: fontSize * letra.interlinea,
            textAlign: 'center',
            textTransform: letra.mayusculas ? 'uppercase' : 'none',
          },
          shadow,
        ]}
      >
        {words.map((w, i) => (
          <Text
            key={i}
            onPress={onWordPress ? () => onWordPress(i) : undefined}
            suppressHighlighting
            style={destacadas.includes(i) ? { color: fondo.accent } : undefined}
          >
            {i ? ' ' : ''}
            {w}
          </Text>
        ))}
      </Text>
      <Text style={[{ color: fondo.accent, fontFamily: sans, fontWeight: '700', fontSize: 40 * scale, marginTop: 56 * scale }, shadow]}>
        {caption}
      </Text>
      {original && (
        <>
          <Text style={[{ color: fondo.text, fontFamily: serif, fontSize: ORIGINAL_SIZE * scale, lineHeight: ORIGINAL_SIZE * 1.25 * scale, marginTop: 48 * scale }, shadow]}>
            {original.palabra}
          </Text>
          <Text style={[{ color: fondo.muted, fontFamily: serif, fontStyle: 'italic', fontSize: 34 * scale, lineHeight: 34 * 1.3 * scale }, shadow]}>
            {original.translit} · {original.glosa}
          </Text>
        </>
      )}
      <Text style={[styles.site, { color: fondo.muted, fontSize: 28 * scale, bottom: (siteBottom(format) - 28) * scale }]}>biblia.migueblanco.com</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', justifyContent: 'center', borderRadius: 6, overflow: 'hidden' },
  site: { position: 'absolute', fontFamily: sans },
});
