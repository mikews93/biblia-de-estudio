import { ComponentRef, Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IMAGE_SIZE, ImageFormat, ImageStyle, verseFontSize } from '@/lib/compartir';
import { sans, serif } from '@/lib/theme';

type Props = {
  text: string;
  caption: string;
  format: ImageFormat;
  look: ImageStyle;
  width: number;
  viewRef?: Ref<ComponentRef<typeof View>>;
};

/** La imagen del versículo dibujada con vistas: la vista previa al compartir y las imágenes del muro. */
export default function VerseArt({ text, caption, format, look, width, viewRef }: Props) {
  const size = IMAGE_SIZE[format];
  const scale = width / size.width;
  const fontSize = verseFontSize(text, format) * scale;
  return (
    <View
      ref={viewRef}
      collapsable={false}
      style={[styles.art, { width, height: size.height * scale, backgroundColor: look.background, paddingHorizontal: 110 * scale }]}
    >
      <View style={{ width: 72 * scale, height: Math.max(1, 4 * scale), backgroundColor: look.accent, marginBottom: 56 * scale }} />
      <Text style={{ color: look.text, fontFamily: serif, fontSize, lineHeight: fontSize * 1.4, textAlign: 'center' }}>
        «{text}»
      </Text>
      <Text style={{ color: look.accent, fontFamily: sans, fontWeight: '700', fontSize: 40 * scale, marginTop: 56 * scale }}>
        {caption}
      </Text>
      <Text style={[styles.site, { color: look.muted, fontSize: 28 * scale, bottom: 90 * scale }]}>biblia.migueblanco.com</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', justifyContent: 'center', borderRadius: 6, overflow: 'hidden' },
  site: { position: 'absolute', fontFamily: sans },
});
