import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon } from '@/components/icons';
import { Version } from '@/lib/data';
import { OFFLINE_DAYS } from '@/lib/licenciadas';
import { serif, useColors, useSettings } from '@/lib/theme';

type Props = {
  versions: Version[];
  onClose: () => void;
  /** Abierta desde el estudio con IA: explica qué versión cita la IA con cada una. */
  estudio?: boolean;
};

/** Lista de versiones: primero las libres y después las que llegan con permiso por API.Bible o YouVersion. */
export default function VersionPicker({ versions, onClose, estudio }: Props) {
  const colors = useColors();
  const { settings, update } = useSettings();

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar versiones" />
      <Appear style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.muted }]}>{estudio ? 'Versión del estudio' : 'Versión'}</Text>
        {estudio && (
          <Text style={[styles.intro, { color: colors.text }]}>
            La IA responde y cita con la versión que elijas. También cambia la del lector.
          </Text>
        )}
        <ScrollView style={styles.list} contentContainerStyle={{ gap: 8 }}>
          {versions.map((v, i) => {
            const on = settings.version === v.id;
            const pressable = (
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
                aria-selected={on}
              >
                <Text style={[styles.abbr, { color: colors.accent, fontFamily: serif }]}>{v.abbr}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{v.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {estudio && v.licensed
                      ? 'Los versículos del estudio se muestran en esta; la IA trabaja con la RV1909'
                      : v.licensed
                        ? v.credit.split(' · ')[1]
                        : v.credit.split(' · ').slice(1).join(' · ')}
                  </Text>
                </View>
                {on && <CheckIcon color={colors.accent} size={18} strokeWidth={2.6} />}
              </Pressable>
            );
            // Antes de la primera versión con derechos, su propio título
            if (!v.licensed || versions[i - 1]?.licensed) return pressable;
            return (
              <View key={v.id} style={{ gap: 8 }}>
                <Text style={[styles.label, styles.group, { color: colors.muted }]}>Con permiso de sus editores · en línea</Text>
                {pressable}
              </View>
            );
          })}
        </ScrollView>
        <Text style={[styles.note, { color: colors.muted }]}>
          El hebreo, el griego, las referencias y el estudio con IA siguen la numeración de la Reina-Valera 1909.
          {versions.some((v) => v.licensed) && ' Las versiones con permiso se leen con conexión'}
          {versions.some((v) => v.guardable) &&
            ` (los últimos capítulos que leas de ${versions
              .filter((v) => v.guardable)
              .map((v) => v.abbr)
              .join(', ')} quedan guardados ${OFFLINE_DAYS} días)`}
          {versions.some((v) => v.licensed) && '; la IA y el audio usan siempre las libres.'}
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
    maxHeight: '86%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  list: { flexGrow: 0 },
  group: { marginTop: 8 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  abbr: { width: 56, fontSize: 15, fontWeight: '700' },
  note: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
