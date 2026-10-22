import { type ReactNode, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import { ChevronDownIcon, ChevronRightIcon, GridIcon, ListenIcon } from '@/components/icons';
import ToolButton from '@/components/ToolButton';
import { Colors } from '@/lib/theme';

export type ChapterTool = {
  key: string;
  label: string;
  /** Una línea para las listas: qué hace. */
  hint: string;
  icon: (color: string) => ReactNode;
  onPress: () => void;
  /** Un interruptor (el interlineal): encendido o apagado. */
  on?: boolean;
};

export type ToolGroup = { key: 'escuchar' | 'original' | 'explorar'; title: string; tools: ChapterTool[] };

export type Variant = 'pestanas' | 'puertas' | 'mesa';

type Props = { groups: ToolGroup[]; colors: Colors; variant: Variant };

/** Las herramientas del capítulo, agrupadas: escuchar, el idioma original y explorar. */
export default function ChapterTools({ groups, colors, variant }: Props) {
  const shown = groups.filter((g) => g.tools.length);
  if (variant === 'pestanas') return <Pestanas groups={shown} colors={colors} />;
  if (variant === 'puertas') return <Puertas groups={shown} colors={colors} />;
  return <Mesa groups={shown} colors={colors} />;
}

/* ───────────── A · Pestañas: una familia a la vez ───────────── */

function Pestanas({ groups, colors }: { groups: ToolGroup[]; colors: Colors }) {
  const [active, setActive] = useState<ToolGroup['key']>(groups[0]?.key ?? 'escuchar');
  const group = groups.find((g) => g.key === active) ?? groups[0];
  if (!group) return null;
  return (
    <View style={styles.pestanas}>
      <View style={[styles.segment, { backgroundColor: colors.accentSoft }]} accessibilityRole="tablist">
        {groups.map((g) => {
          const on = g.key === group.key;
          return (
            <Pressable
              key={g.key}
              onPress={() => setActive(g.key)}
              style={[styles.segmentItem, on && [styles.segmentOn, { backgroundColor: colors.surface }]]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentText, { color: on ? colors.text : colors.muted }]}>{g.title}</Text>
            </Pressable>
          );
        })}
      </View>
      <View key={group.key} style={styles.tabRow}>
        {group.tools.map((t, i) => (
          <ToolButton
            key={t.key}
            index={i}
            width={84}
            label={t.on ? `${t.label} ✓` : t.label}
            hint={t.hint}
            icon={t.icon}
            colors={colors}
            onPress={t.onPress}
            strong={t.on}
          />
        ))}
      </View>
    </View>
  );
}

/* ───────────── B · Puertas: tres botones y una hoja ───────────── */

function Puertas({ groups, colors }: { groups: ToolGroup[]; colors: Colors }) {
  const [sheet, setSheet] = useState<'escuchar' | 'mas' | null>(null);
  const listen = groups.find((g) => g.key === 'escuchar');
  const original = groups.find((g) => g.key === 'original');
  const toggle = original?.tools.find((t) => t.on !== undefined);
  const originalAudio = original?.tools.filter((t) => t !== toggle) ?? [];
  const explore = groups.find((g) => g.key === 'explorar');
  const listenTools = listen ? [listen.tools[0], ...originalAudio, ...listen.tools.slice(1)] : originalAudio;

  return (
    <View style={styles.puertas}>
      <Door colors={colors} icon={(c) => <ListenIcon color={c} size={19} />} label="Escuchar" onPress={() => setSheet('escuchar')} chevron />
      {toggle && <Door colors={colors} icon={toggle.icon} label="Interlineal" onPress={toggle.onPress} on={toggle.on} />}
      {explore && <Door colors={colors} icon={(c) => <GridIcon color={c} size={18} />} label="Más" onPress={() => setSheet('mas')} chevron />}
      {sheet && (
        <Sheet
          colors={colors}
          title={sheet === 'escuchar' ? 'Escuchar el capítulo' : 'Herramientas del capítulo'}
          tools={sheet === 'escuchar' ? listenTools : explore?.tools ?? []}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  );
}

function Door({ colors, icon, label, onPress, on, chevron }: { colors: Colors; icon: (c: string) => ReactNode; label: string; onPress: () => void; on?: boolean; chevron?: boolean }) {
  const isSwitch = on !== undefined;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.door,
        { backgroundColor: on ? colors.warmSoft : colors.surface, borderColor: on ? colors.warm : hovered ? colors.accent : colors.border },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityState={isSwitch ? { checked: on } : undefined}
      accessibilityLabel={label}
    >
      {icon(on ? colors.warm : colors.accent)}
      <Text style={[styles.doorText, { color: on ? colors.warm : colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      {chevron && <ChevronDownIcon color={colors.muted} size={13} strokeWidth={2.2} />}
    </Pressable>
  );
}

function Sheet({ colors, title, tools, onClose }: { colors: Colors; title: string; tools: ChapterTool[]; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <Appear from={24} style={[styles.sheet, wide ? styles.sheetWide : styles.sheetPhone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {!wide && <View style={[styles.grabber, { backgroundColor: colors.border }]} />}
        <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
        <View style={{ gap: 2 }}>
          {tools.map((t) => (
            <ToolRow
              key={t.key}
              tool={t}
              colors={colors}
              onPress={() => {
                onClose();
                t.onPress();
              }}
            />
          ))}
        </View>
      </Appear>
    </Modal>
  );
}

function ToolRow({ tool, colors, onPress }: { tool: ChapterTool; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.toolRow, (hovered || pressed) && { backgroundColor: colors.accentSoft }]}
      accessibilityRole="button"
      accessibilityLabel={tool.hint}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}>{tool.icon(colors.accent)}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{tool.label}</Text>
        <Text style={[styles.rowHint, { color: colors.muted }]} numberOfLines={2}>
          {tool.hint}
        </Text>
      </View>
      <ChevronRightIcon color={colors.muted} size={18} />
    </Pressable>
  );
}

/* ───────────── C · Mesa: todo a la vista, por familias ───────────── */

function Mesa({ groups, colors }: { groups: ToolGroup[]; colors: Colors }) {
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  if (wide)
    return (
      <View style={[styles.mesa, styles.mesaWide]}>
        {groups.map((g, gi) => (
          <View key={g.key} style={[styles.mesaGroup, styles.mesaGroupWide, gi > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
            <Text style={[styles.mesaTitle, { color: colors.muted }]}>{g.title}</Text>
            <View style={styles.chips}>
              {g.tools.map((t, i) => (
                <Appear key={t.key} delay={(gi * 3 + i) * 30} from={6}>
                  <Chip tool={t} colors={colors} />
                </Appear>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  return (
    <View style={[styles.mesaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {groups.map((g, gi) => (
        <View key={g.key} style={[styles.mesaLine, gi > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
          <Text style={[styles.mesaTitle, styles.mesaLabel, { color: colors.muted }]}>{g.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mesaChips}>
            {g.tools.map((t, i) => (
              <Appear key={t.key} delay={(gi * 3 + i) * 30} from={6}>
                <Chip tool={t} colors={colors} small />
              </Appear>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function Chip({ tool, colors, small }: { tool: ChapterTool; colors: Colors; small?: boolean }) {
  const isSwitch = tool.on !== undefined;
  const on = !!tool.on;
  return (
    <Pressable
      onPress={tool.onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.chip,
        small && styles.chipSmall,
        { backgroundColor: on ? colors.warmSoft : colors.surface, borderColor: on ? colors.warm : hovered ? colors.accent : colors.border },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityState={isSwitch ? { checked: on } : undefined}
      accessibilityLabel={tool.hint}
    >
      {tool.icon(on ? colors.warm : colors.accent)}
      <Text style={[styles.chipText, { color: on ? colors.warm : colors.text }]} numberOfLines={1}>
        {tool.label}
      </Text>
      {isSwitch && <Switch on={on} colors={colors} />}
    </Pressable>
  );
}

function Switch({ on, colors }: { on: boolean; colors: Colors }) {
  return (
    <View style={[styles.switch, { backgroundColor: on ? colors.warm : colors.border }]}>
      <View style={[styles.knob, { backgroundColor: colors.surface, transform: [{ translateX: on ? 12 : 0 }] }]} />
    </View>
  );
}

const shadow = Platform.select({
  web: { boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } as object,
  default: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});

const styles = StyleSheet.create({
  // A
  pestanas: { alignSelf: 'stretch', alignItems: 'center', marginTop: 18, gap: 14 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3, width: '100%', maxWidth: 420 },
  segmentItem: { flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentOn: shadow,
  segmentText: { fontSize: 13, fontWeight: '700' },
  tabRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, minHeight: 74 },
  // B
  puertas: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14, width: '100%', maxWidth: 420 },
  door: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 4 },
  doorText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    paddingBottom: 24,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  sheetPhone: { left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetWide: { top: '18%', alignSelf: 'center', width: 440, borderRadius: 18 },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 4 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4, paddingHorizontal: 4 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowHint: { fontSize: 12.5, marginTop: 1, lineHeight: 17 },
  // C
  mesa: { width: '100%', maxWidth: 420, marginTop: 16, gap: 14 },
  mesaWide: { maxWidth: 860, flexDirection: 'row', gap: 0, justifyContent: 'center' },
  mesaGroup: { gap: 8 },
  mesaGroupWide: { paddingHorizontal: 18, flexShrink: 1 },
  mesaTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, borderRadius: 19, borderWidth: 1, paddingLeft: 11, paddingRight: 14 },
  chipSmall: { height: 34, borderRadius: 17, paddingLeft: 9, paddingRight: 12, gap: 6 },
  mesaCard: { width: '100%', maxWidth: 420, marginTop: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  mesaLine: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingVertical: 9 },
  mesaLabel: { width: 84, paddingLeft: 0 },
  mesaChips: { gap: 6, paddingRight: 12 },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  switch: { width: 28, height: 16, borderRadius: 8, padding: 2, marginLeft: 2 },
  knob: { width: 12, height: 12, borderRadius: 6 },
});
