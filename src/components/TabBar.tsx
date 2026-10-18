import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chapterHref } from '@/lib/routes';
import { getLastRead, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Tab = { key: 'hoy' | 'leer' | 'planes' | 'comunidad'; label: string; icon: string };

const TABS: Tab[] = [
  { key: 'hoy', label: 'Hoy', icon: '⌂' },
  { key: 'leer', label: 'Leer', icon: '¶' },
  { key: 'planes', label: 'Planes', icon: '☷' },
  { key: 'comunidad', label: 'Comunidad', icon: '◎' },
];

// Los planes en grupo viven en /grupos hasta que exista la pantalla de planes (/planes).
const PLANES = '/grupos';

function current(path: string): Tab['key'] {
  if (path === '/') return 'hoy';
  if (/^\/(planes|grupos|unirse)(\/|$)/.test(path)) return 'planes';
  if (/^\/(comunidades|amigo|cuenta)(\/|$)/.test(path)) return 'comunidad';
  return 'leer';
}

/** Barra de abajo para saltar entre Hoy, la lectura, los planes y la comunidad. */
export default function TabBar() {
  const colors = useColors();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const active = current(path);

  const go = async (key: Tab['key']) => {
    if (key === active && key !== 'leer') return;
    if (key === 'hoy') navigate(() => router.dismissTo('/'), 'back');
    if (key === 'planes') navigate(() => router.push(PLANES as never), 'fade');
    if (key === 'comunidad') navigate(() => router.push('/comunidades' as never), 'fade');
    if (key === 'leer') {
      if (active === 'leer') return;
      const last = await getLastRead();
      navigate(() => router.push(chapterHref(last?.book ?? 'jhn', last?.chapter ?? 1)), 'forward');
    }
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 6) },
      ]}
      accessibilityRole="tablist"
    >
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => go(t.key)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
          >
            <Text style={{ fontFamily: serif, fontSize: 20, lineHeight: 24, color: on ? colors.accent : colors.muted }}>{t.icon}</Text>
            <Text style={[styles.label, { color: on ? colors.accent : colors.muted, fontWeight: on ? '700' : '500' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  label: { fontSize: 11, marginTop: 1 },
});
