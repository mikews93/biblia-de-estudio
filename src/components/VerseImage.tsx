import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { ComponentRef, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  IMAGE_SIZE,
  IMAGE_STYLES,
  ImageFormat,
  VerseToShare,
  downloadImage,
  drawVerseImage,
  shareImageOnWeb,
  shareVerse,
  verseFontSize,
} from '@/lib/compartir';
import { sans, serif, useColors } from '@/lib/theme';

type Props = { verse: VerseToShare; onClose: () => void };

/**
 * Hoja para compartir un versículo como imagen (cuadrada para publicaciones o vertical para historias)
 * o como texto. La vista previa es la misma imagen que se comparte.
 */
export default function VerseImage({ verse, onClose }: Props) {
  const colors = useColors();
  const { width: screen } = useWindowDimensions();
  const [format, setFormat] = useState<ImageFormat>('cuadrado');
  const [styleIndex, setStyleIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const preview = useRef<ComponentRef<typeof View>>(null);

  const style = IMAGE_STYLES[styleIndex];
  const size = IMAGE_SIZE[format];
  const previewWidth = Math.min(format === 'cuadrado' ? 320 : 240, screen - 64);
  const scale = previewWidth / size.width;
  const fontSize = verseFontSize(verse.text, format) * scale;
  const caption = `${verse.reference}${verse.version ? ` (${verse.version})` : ''}`;

  const copy = async () => {
    await Clipboard.setStringAsync(`«${verse.text}» ${caption}`);
    setNote('Versículo copiado');
  };

  const share = async (download = false) => {
    setBusy(true);
    setNote(null);
    try {
      if (Platform.OS === 'web') {
        const blob = await drawVerseImage(verse, format, style);
        if (download) {
          downloadImage(blob, verse);
          setNote('Imagen descargada');
        } else if ((await shareImageOnWeb(blob, verse)) === 'descargada') {
          setNote('Este navegador no comparte imágenes: la descargamos para que la subas.');
        }
      } else {
        const uri = await captureRef(preview, { format: 'png', quality: 1, width: size.width, height: size.height });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: verse.reference });
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'No se pudo compartir la imagen');
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={[styles.chip, { borderColor: on ? colors.accent : colors.border }, on && { backgroundColor: colors.accentSoft }]}
    >
      <Text style={{ color: on ? colors.accent : colors.text, fontWeight: on ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Compartir {verse.reference}</Text>

          <View
            ref={preview}
            collapsable={false}
            style={[
              styles.preview,
              { width: previewWidth, height: size.height * scale, backgroundColor: style.background, paddingHorizontal: 110 * scale },
            ]}
          >
            <View style={{ width: 72 * scale, height: Math.max(1, 4 * scale), backgroundColor: style.accent, marginBottom: 56 * scale }} />
            <Text style={{ color: style.text, fontFamily: serif, fontSize, lineHeight: fontSize * 1.4, textAlign: 'center' }}>
              «{verse.text}»
            </Text>
            <Text style={{ color: style.accent, fontFamily: sans, fontWeight: '700', fontSize: 40 * scale, marginTop: 56 * scale }}>
              {caption}
            </Text>
            <Text style={[styles.site, { color: style.muted, fontSize: 28 * scale, bottom: 90 * scale }]}>
              biblia.migueblanco.com
            </Text>
          </View>

          <View style={styles.row}>
            {chip('Publicación', format === 'cuadrado', () => setFormat('cuadrado'))}
            {chip('Historia', format === 'historia', () => setFormat('historia'))}
          </View>
          <View style={styles.row}>
            {IMAGE_STYLES.map((s, i) => (
              <Pressable
                key={s.name}
                onPress={() => setStyleIndex(i)}
                accessibilityRole="radio"
                accessibilityLabel={s.name}
                accessibilityState={{ checked: i === styleIndex }}
                style={[styles.swatch, { backgroundColor: s.background, borderColor: i === styleIndex ? colors.accent : colors.border }]}
              >
                <Text style={{ color: s.accent, fontFamily: serif, fontSize: 18 }}>A</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => share()}
            disabled={busy}
            style={[styles.primary, { backgroundColor: colors.accent }, busy && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>
              {busy ? 'Preparando…' : 'Compartir imagen'}
            </Text>
          </Pressable>
          <View style={styles.row}>
            {Platform.OS === 'web' && (
              <Pressable onPress={() => share(true)} disabled={busy} hitSlop={8}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Descargar</Text>
              </Pressable>
            )}
            <Pressable onPress={() => shareVerse(verse)} hitSlop={8}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Compartir como texto</Text>
            </Pressable>
            <Pressable onPress={copy} hitSlop={8}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Copiar</Text>
            </Pressable>
          </View>
          {note && <Text style={{ color: colors.muted, textAlign: 'center' }}>{note}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  body: { alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingBottom: 36 },
  title: { fontSize: 16, fontWeight: '700' },
  preview: { alignItems: 'center', justifyContent: 'center', borderRadius: 6, overflow: 'hidden' },
  site: { position: 'absolute', fontFamily: sans },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  primary: { borderRadius: 24, paddingVertical: 13, alignSelf: 'stretch', alignItems: 'center' },
});
