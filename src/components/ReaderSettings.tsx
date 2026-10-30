import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon, ContrastIcon, DownloadIcon } from '@/components/icons';
import { navigate } from '@/lib/transition';

import { Settings, sans, serif, themeSwatches, useColors, useSettings } from '@/lib/theme';

export default function ReaderSettings({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const { settings, update } = useSettings();

  const segment = <K extends keyof Settings>(key: K, options: [Settings[K], string][]) => (
    <View style={[styles.segment, { backgroundColor: colors.accentSoft }]}>
      {options.map(([value, label]) => {
        const on = settings[key] === value;
        return (
          <Pressable
            key={String(value)}
            onPress={() => update({ [key]: value } as Partial<Settings>)}
            style={[styles.segmentItem, on && { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            aria-selected={on}
          >
            <Text style={{ color: on ? colors.text : colors.muted, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar ajustes" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.muted }]}>Tema</Text>
        <View style={styles.swatches}>
          {themeSwatches.map((t) => {
            const on = settings.theme === t.name;
            const c = t.colors;
            return (
              <Pressable key={t.name} onPress={() => update({ theme: t.name })} style={styles.swatchWrap}>
                <View
                  style={[
                    styles.swatch,
                    { borderColor: on ? colors.accent : colors.border, borderWidth: on ? 2 : 1 },
                    c ? { backgroundColor: c.background } : { backgroundColor: colors.background },
                  ]}
                >
                  {c ? (
                    <Text style={{ fontFamily: serif, fontSize: 18, color: c.text }}>Aa</Text>
                  ) : (
                    <ContrastIcon color={colors.text} size={20} />
                  )}
                </View>
                <Text style={{ color: on ? colors.text : colors.muted, fontSize: 12, marginTop: 4 }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>Tamaño</Text>
        <View style={styles.sizeRow}>
          <Pressable
            onPress={() => update({ fontSize: Math.max(14, settings.fontSize - 1) })}
            style={[styles.sizeButton, { borderColor: colors.border }]}
            accessibilityLabel="Letra más pequeña"
          >
            <Text style={{ color: colors.text, fontSize: 14 }}>A</Text>
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              color: colors.text,
              fontFamily: settings.font === 'serif' ? serif : sans,
              fontSize: settings.fontSize,
            }}
          >
            En el principio era el Verbo
          </Text>
          <Pressable
            onPress={() => update({ fontSize: Math.min(30, settings.fontSize + 1) })}
            style={[styles.sizeButton, { borderColor: colors.border }]}
            accessibilityLabel="Letra más grande"
          >
            <Text style={{ color: colors.text, fontSize: 22 }}>A</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>Letra</Text>
        {segment('font', [
          ['serif', 'Clásica'],
          ['sans', 'Moderna'],
        ])}

        <Text style={[styles.label, { color: colors.muted }]}>Texto</Text>
        {segment('layout', [
          ['parrafo', 'Párrafo'],
          ['versiculo', 'Un versículo por línea'],
        ])}

        <Text style={[styles.label, { color: colors.muted }]}>Pantalla al leer</Text>
        {segment('pantallaEncendida', [
          [true, 'Siempre encendida'],
          [false, 'Se apaga sola'],
        ])}

        <Pressable
          onPress={() => {
            onClose();
            navigate(() => router.push('/descargas' as never), 'forward');
          }}
          style={({ pressed }) => [styles.link, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          accessibilityRole="link"
        >
          <DownloadIcon color={colors.accent} size={20} />
          <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>Leer sin conexión</Text>
          <ChevronRightIcon color={colors.accent} size={18} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    top: 64,
    right: 12,
    width: 340,
    maxWidth: '94%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchWrap: { alignItems: 'center' },
  swatch: { width: 64, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sizeButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 14 },
});
