import { type ReactNode, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import { ChevronRightIcon, GridIcon, ListenIcon, SparkIcon } from '@/components/icons';
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

type Props = { groups: ToolGroup[]; onStudy: () => void; colors: Colors };

/**
 * La barra de herramientas del capítulo, bajo la cabecera del lector: Estudiar con IA, Escuchar, Pódcast, Interlineal
 * y Más. Lo de escuchar (lectura, dramatizado, en el idioma original) se elige en una hoja; lo demás (mapa, mapa mental,
 * tarjetas) va en «Más». Se aparta con la cabecera al bajar leyendo.
 */
export default function ChapterTools({ groups, onStudy, colors }: Props) {
  const [sheet, setSheet] = useState<'escuchar' | 'mas' | null>(null);
  const all = groups.flatMap((g) => g.tools);
  const podcast = all.find((t) => t.key === 'podcast');
  const interlinear = all.find((t) => t.on !== undefined);
  const listen = all.filter((t) => t.key !== 'podcast' && t !== interlinear && groups.find((g) => g.tools.includes(t))?.key !== 'explorar');
  const more = groups.find((g) => g.key === 'explorar')?.tools ?? [];

  const items: (ChapterTool & { strong?: boolean })[] = [
    { key: 'estudiar', label: 'Estudiar', hint: 'Estudiar este capítulo con IA: contexto, preguntas y fuentes', icon: (c) => <SparkIcon color={c} size={21} />, onPress: onStudy, strong: true },
    {
      key: 'escuchar',
      label: 'Escuchar',
      hint: listen.length > 1 ? 'Escuchar el capítulo: elegir lectura, dramatizado o idioma original' : 'Escuchar la lectura del capítulo',
      icon: (c) => <ListenIcon color={c} size={21} />,
      onPress: () => (listen.length > 1 ? setSheet('escuchar') : listen[0]?.onPress()),
    },
    ...(podcast ? [podcast] : []),
    ...(interlinear ? [interlinear] : []),
    ...(more.length ? [{ key: 'mas', label: 'Más', hint: 'Más herramientas del capítulo', icon: (c: string) => <GridIcon color={c} size={20} />, onPress: () => setSheet('mas') }] : []),
  ];

  return (
    <View style={styles.bar} accessibilityRole="toolbar">
      {items.map((t, i) => (
        <Item key={t.key} tool={t} strong={t.strong} colors={colors} index={i} />
      ))}
      {sheet && (
        <Sheet
          colors={colors}
          title={sheet === 'escuchar' ? 'Escuchar el capítulo' : 'Más herramientas'}
          tools={sheet === 'escuchar' ? listen : more}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  );
}

function Item({ tool, strong, colors, index }: { tool: ChapterTool; strong?: boolean; colors: Colors; index: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, speed: 40, bounciness: toValue === 1 ? 10 : 0, useNativeDriver: Platform.OS !== 'web' }).start();
  const isSwitch = tool.on !== undefined;
  const on = !!tool.on;
  const tint = strong ? colors.surface : on ? colors.warm : colors.accent;

  return (
    <Appear delay={index * 35} from={6} style={styles.slot}>
      <Pressable
        onPress={tool.onPress}
        onPressIn={() => spring(0.9)}
        onPressOut={() => spring(1)}
        style={styles.item}
        accessibilityRole={isSwitch ? 'switch' : 'button'}
        aria-checked={isSwitch ? on : undefined}
        accessibilityLabel={tool.hint}
      >
        {(state) => {
          const hovered = (state as { hovered?: boolean }).hovered;
          return (
            <>
              <Animated.View
                style={[
                  styles.icon,
                  {
                    backgroundColor: strong ? colors.accent : on ? colors.warmSoft : hovered ? colors.accentSoft : 'transparent',
                    borderColor: on ? colors.warm : 'transparent',
                    transform: [{ scale }],
                  },
                ]}
              >
                {tool.icon(tint)}
                {on && <View style={[styles.dot, { backgroundColor: colors.warm, borderColor: colors.background }]} />}
              </Animated.View>
              <Text
                style={[styles.label, { color: on ? colors.warm : strong || hovered ? colors.text : colors.muted }, strong && styles.labelStrong]}
                numberOfLines={1}
              >
                {tool.label}
              </Text>
            </>
          );
        }}
      </Pressable>
    </Appear>
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
            <Pressable
              key={t.key}
              onPress={() => {
                onClose();
                t.onPress();
              }}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, (hovered || pressed) && { backgroundColor: colors.accentSoft }]}
              accessibilityRole="button"
              accessibilityLabel={t.hint}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}>{t.icon(colors.accent)}</View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{t.label}</Text>
                <Text style={[styles.rowHint, { color: colors.muted }]} numberOfLines={2}>
                  {t.hint}
                </Text>
              </View>
              <ChevronRightIcon color={colors.muted} size={18} />
            </Pressable>
          ))}
        </View>
      </Appear>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignSelf: 'center', width: '100%', maxWidth: 460, paddingHorizontal: 6 },
  slot: { flex: 1 },
  item: { alignItems: 'center', gap: 5 },
  icon: { width: 40, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  label: { fontSize: 10.5, fontWeight: '600', letterSpacing: -0.1 },
  labelStrong: { fontWeight: '700' },
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowHint: { fontSize: 12.5, marginTop: 1, lineHeight: 17 },
});
