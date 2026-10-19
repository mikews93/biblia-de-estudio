import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon } from '@/components/icons';
import { Version } from '@/lib/data';
import { serif, useColors, useSettings } from '@/lib/theme';

type Props = { versions: Version[]; onClose: () => void };

/** Lista de versiones disponibles. La NBLA y otras con licencia se añadirán cuando haya permiso. */
export default function VersionPicker({ versions, onClose }: Props) {
  const colors = useColors();
  const { settings, update } = useSettings();

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar versiones" />
      <Appear style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.muted }]}>Versión</Text>
        {versions.map((v) => {
          const on = settings.version === v.id;
          return (
            <Pressable
              key={v.id}
              onPress={() => {
                update({ version: v.id });
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : 'transparent' },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.abbr, { color: colors.accent, fontFamily: serif }]}>{v.abbr}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{v.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{v.credit.split(' · ').slice(1).join(' · ')}</Text>
              </View>
              {on && <CheckIcon color={colors.accent} size={18} strokeWidth={2.6} />}
            </Pressable>
          );
        })}
        <Text style={[styles.note, { color: colors.muted }]}>
          El hebreo, el griego, las referencias y el estudio con IA siguen la numeración de la Reina-Valera 1909.
        </Text>
      </Appear>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    width: 420,
    maxWidth: '94%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  abbr: { width: 56, fontSize: 15, fontWeight: '700' },
  note: { fontSize: 12, marginTop: 4, lineHeight: 17 },
});
