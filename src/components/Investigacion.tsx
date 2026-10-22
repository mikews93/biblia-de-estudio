import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CommentaryIcon,
  ConcordanceIcon,
  type IconProps,
  LinkIcon,
  ScrollIcon,
  SearchIcon,
} from '@/components/icons';
import type { Paso } from '@/lib/estudio';
import { Colors, serif } from '@/lib/theme';

const TIPOS: Record<Paso['tipo'], { icon: ((p: IconProps) => ReactNode) | string; haciendo: string; hecho: string }> = {
  leer: { icon: ScrollIcon, haciendo: 'Leyendo', hecho: 'Leyó' },
  buscar: { icon: SearchIcon, haciendo: 'Buscando en toda la Biblia', hecho: 'Buscó en toda la Biblia' },
  referencias: { icon: LinkIcon, haciendo: 'Siguiendo las referencias de', hecho: 'Referencias de' },
  comentarios: { icon: CommentaryIcon, haciendo: 'Consultando los comentarios de', hecho: 'Comentarios de' },
  original: { icon: 'α', haciendo: 'Mirando el original de', hecho: 'Original de' },
  concordancia: { icon: ConcordanceIcon, haciendo: 'Buscando dónde más aparece', hecho: 'Concordancia de' },
};

function Icon({ tipo, color, size = 14 }: { tipo: Paso['tipo']; color: string; size?: number }) {
  const I = TIPOS[tipo].icon;
  if (typeof I === 'string') return <Text style={{ color, fontFamily: serif, fontSize: size, lineHeight: size + 2 }}>{I}</Text>;
  return <I color={color} size={size} strokeWidth={2} />;
}

/**
 * Lo que la IA consultó para responder una pregunta (otros pasajes, búsquedas, comentarios…). Mientras investiga,
 * la lista va creciendo con el paso en curso; con la respuesta escrita queda plegada en una línea que se abre.
 */
export default function Investigacion({ pasos, working, colors }: { pasos: Paso[]; working: boolean; colors: Colors }) {
  const [open, setOpen] = useState(false);
  if (!pasos.length) return null;

  if (working) {
    return (
      <Appear style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHead}>
          <Pulse color={colors.accent} />
          <Text style={[styles.kicker, { color: colors.accent }]}>INVESTIGANDO</Text>
        </View>
        {pasos.map((p, i) => {
          const current = i === pasos.length - 1;
          return (
            <Appear key={i} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: current ? colors.accentSoft : 'transparent', borderColor: current ? colors.accent : colors.border }]}>
                <Icon tipo={p.tipo} color={current ? colors.accent : colors.muted} size={13} />
              </View>
              <Text style={[styles.rowText, { color: current ? colors.text : colors.muted }]} numberOfLines={2}>
                {current ? TIPOS[p.tipo].haciendo : TIPOS[p.tipo].hecho} <Text style={{ fontWeight: '700' }}>{p.texto}</Text>
                {current ? '…' : ''}
              </Text>
              {current ? <ActivityIndicator size="small" color={colors.accent} /> : <CheckIcon color={colors.accent} size={14} strokeWidth={2.6} />}
            </Appear>
          );
        })}
        <Text style={[styles.hint, { color: colors.muted }]}>Responderá cuando termine de leer.</Text>
      </Appear>
    );
  }

  return (
    <View style={styles.folded}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.toggle, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
      >
        <SearchIcon color={colors.accent} size={13} strokeWidth={2.2} />
        <Text style={[styles.toggleText, { color: colors.muted }]}>
          Investigó en {pasos.length} {pasos.length === 1 ? 'fuente' : 'fuentes'} más
        </Text>
        {open ? <ChevronUpIcon color={colors.muted} size={14} /> : <ChevronDownIcon color={colors.muted} size={14} />}
      </Pressable>
      {open && (
        <Appear style={styles.chips}>
          {pasos.map((p, i) => (
            <View key={i} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Icon tipo={p.tipo} color={colors.accent} size={12} />
              <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                {TIPOS[p.tipo].hecho} {p.texto}
              </Text>
            </View>
          ))}
        </Appear>
      )}
    </View>
  );
}

/** Un punto que late mientras la IA investiga. */
function Pulse({ color }: { color: string }) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return (
    <Animated.View
      style={[
        styles.pulse,
        { backgroundColor: color, opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, marginTop: 16, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 14, lineHeight: 19 },
  hint: { fontSize: 12, marginTop: 2 },
  folded: { marginTop: 14, marginBottom: 4 },
  toggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  toggleText: { fontSize: 12.5, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipText: { fontSize: 12.5, flexShrink: 1 },
});
