import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chips } from '@/components/comunidad/ui';
import { CloseIcon } from '@/components/icons';
import { APERTURA_LABEL, DINAMICAS, Dinamica, MOMENTOS, Momento } from '@/lib/dinamicas';
import { serif, useColors } from '@/lib/theme';

/** Una dinámica con sus pasos. Compacta muestra solo el nombre y el resumen hasta que se abre. */
export function DinamicaCard({ d, compact, action }: { d: Dinamica; compact?: boolean; action?: { label: string; onPress: () => void } }) {
  const colors = useColors();
  const [open, setOpen] = useState(!compact);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.cardHead}>
          <Text style={[styles.name, { color: colors.text }]}>{d.nombre}</Text>
          <Text style={{ color: colors.muted }}>{open ? '−' : '+'}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          {d.minutos} min · {APERTURA_LABEL[d.apertura]} · {d.grupo}
        </Text>
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{d.objetivo}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 8 }}>
          {d.pasos.map((p, i) => (
            <View key={i} style={styles.step}>
              <Text style={{ color: colors.accent, fontWeight: '700', width: 18 }}>{i + 1}</Text>
              <Text style={{ color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 }}>{p}</Text>
            </View>
          ))}
          {d.encaja && <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>Encaja con: {d.encaja}</Text>}
          {d.fuente && (
            <Pressable onPress={() => d.fuente?.url && Linking.openURL(d.fuente.url)} disabled={!d.fuente.url}>
              <Text style={{ color: d.fuente.url ? colors.accent : colors.muted, fontSize: 12, marginTop: 6 }}>
                Idea de: {d.fuente.nombre}
                {d.fuente.url ? ' ↗' : ''}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {action && (
        <Pressable onPress={action.onPress} style={[styles.use, { borderColor: colors.accent }]} accessibilityRole="button">
          <Text style={{ color: colors.accent, fontWeight: '700' }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** El catálogo filtrado por momento del encuentro. */
export function Catalogo({ onPick, initial }: { onPick?: (d: Dinamica) => void; initial?: Momento }) {
  const [momento, setMomento] = useState<Momento | 'todas'>(initial ?? 'todas');
  const list = momento === 'todas' ? DINAMICAS : DINAMICAS.filter((d) => d.momento === momento);
  return (
    <View style={{ gap: 12 }}>
      <Chips
        options={[{ value: 'todas' as const, label: `Todas (${DINAMICAS.length})` }, ...MOMENTOS.map((m) => ({ value: m.momento, label: m.label }))]}
        value={momento}
        onChange={setMomento}
      />
      {list.map((d) => (
        <DinamicaCard key={d.id} d={d} compact action={onPick ? { label: 'Usar esta', onPress: () => onPick(d) } : undefined} />
      ))}
    </View>
  );
}

/** Ventana para elegir la dinámica de una parte del encuentro. */
export function DinamicaPicker({ onPick, onClear, onClose, initial }: { onPick: (d: Dinamica) => void; onClear?: () => void; onClose: () => void; initial?: Momento }) {
  const colors = useColors();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ height: '8%', minHeight: 32 }} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Elegir dinámica</Text>
            {onClear && (
              <Pressable onPress={onClear} hitSlop={8} style={{ marginRight: 16 }}>
                <Text style={{ color: colors.muted }}>Sin dinámica</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
              <CloseIcon color={colors.muted} size={22} />
            </Pressable>
          </View>
          <Text style={{ color: colors.muted, paddingHorizontal: 20, marginBottom: 8 }}>Todas se hacen sin materiales.</Text>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
            <Catalogo onPick={onPick} initial={initial} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontFamily: serif, fontSize: 18, fontWeight: '700', flex: 1 },
  step: { flexDirection: 'row', gap: 6, marginTop: 6 },
  use: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 6 },
  sheetTitle: { fontFamily: serif, fontSize: 22, fontWeight: '700', flex: 1 },
});
