import { router } from 'expo-router';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronDownIcon, ChevronLeftIcon } from '@/components/icons';
import SearchIcon from '@/components/SearchIcon';
import { chrome } from '@/lib/chrome';
import { serif, useColors, useSettings } from '@/lib/theme';
import { fixedInTransition, navigate } from '@/lib/transition';

export const HEADER_HEIGHT = 52;

type Props = { title: string; progress: number; onSettings: () => void };

/**
 * Cabecera del lector: libro y capítulo, buscar, modo estudio y ajustes. Se aparta hacia arriba al bajar
 * leyendo (src/lib/chrome.ts) y deja a la vista la línea de avance del capítulo.
 */
export default function ReaderHeader({ title, progress, onSettings }: Props) {
  const colors = useColors();
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const translateY = chrome.interpolate({ inputRange: [0, 1], outputRange: [0, -HEADER_HEIGHT] });
  const fade = chrome.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' });
  const back = Platform.OS !== 'web' && router.canGoBack();

  return (
    <>
      <Animated.View
        style={[
          styles.wrap,
          { paddingTop: insets.top, backgroundColor: colors.background, transform: [{ translateY }] },
          fixedInTransition('cabecera'),
        ]}
      >
        <Animated.View style={[styles.row, { opacity: fade }]}>
          {back && (
            <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Atrás" style={styles.iconButton}>
              <ChevronLeftIcon color={colors.text} size={24} />
            </Pressable>
          )}
          <Pressable
            onPress={() => navigate(() => router.push('/libros'))}
            accessibilityRole="button"
            accessibilityLabel={`${title}. Elegir libro y capítulo`}
            style={({ pressed }) => [styles.title, pressed && styles.pressed]}
          >
            <Text style={[styles.titleText, { color: colors.text, fontFamily: serif }]} numberOfLines={1}>
              {title}
            </Text>
            {!!title && <ChevronDownIcon color={colors.muted} size={16} strokeWidth={2} />}
          </Pressable>

          <View style={styles.right}>
            <Pressable
              onPress={() => navigate(() => router.push('/buscar'), 'forward')}
              accessibilityRole="search"
              accessibilityLabel="Buscar"
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <SearchIcon color={colors.text} size={20} />
            </Pressable>
            <Pressable
              onPress={() => update({ study: !settings.study })}
              style={({ pressed }) => [
                styles.studyToggle,
                { borderColor: colors.accent },
                settings.study && { backgroundColor: colors.accent },
                pressed && styles.pressed,
              ]}
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.study }}
              accessibilityLabel="Modo estudio"
            >
              <Text style={[styles.studyText, { color: settings.study ? colors.surface : colors.accent }]}>Estudio</Text>
            </Pressable>
            <Pressable
              onPress={onSettings}
              accessibilityRole="button"
              accessibilityLabel="Ajustes de lectura"
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Text style={[styles.aa, { color: colors.text, fontFamily: serif }]}>Aa</Text>
            </Pressable>
          </View>
        </Animated.View>
        <View style={[styles.track, { backgroundColor: colors.border }, fixedInTransition('progreso')]}>
          <View style={[styles.bar, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
        </View>
      </Animated.View>
      {/* La franja de la hora y la batería queda tapada aunque la cabecera suba. */}
      {insets.top > 0 && <View style={[styles.notch, { height: insets.top, backgroundColor: colors.background }]} />}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  row: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 4 },
  pressed: { opacity: 0.6 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, height: 40, flexShrink: 1 },
  titleText: { fontSize: 19, fontWeight: '600', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  studyToggle: { height: 30, borderWidth: 1.5, borderRadius: 15, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  studyText: { fontWeight: '700', fontSize: 13, lineHeight: 16 },
  aa: { fontSize: 18, lineHeight: 22 },
  track: { height: 2 },
  bar: { height: 2 },
  notch: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11 },
});
