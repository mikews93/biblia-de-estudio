import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chapterHref } from '@/lib/routes';
import { getLastRead, serif, useColors } from '@/lib/theme';
import { fixedInTransition, navigate } from '@/lib/transition';

type Tab = { key: 'hoy' | 'leer' | 'planes' | 'taller' | 'comunidad'; label: string; icon: string };

const TABS: Tab[] = [
  { key: 'hoy', label: 'Hoy', icon: '⌂' },
  { key: 'leer', label: 'Leer', icon: '¶' },
  { key: 'planes', label: 'Planes', icon: '☷' },
  { key: 'taller', label: 'Taller', icon: '✎' },
  { key: 'comunidad', label: 'Comunidad', icon: '◎' },
];

function current(path: string): Tab['key'] {
  if (path === '/' || path === '/notas' || path === '/repaso') return 'hoy';
  if (/^\/(planes|grupos|unirse)(\/|$)/.test(path)) return 'planes';
  if (/^\/(comunidades|amigo|cuenta)(\/|$)/.test(path)) return 'comunidad';
  if (path.startsWith('/taller')) return 'taller';
  return 'leer';
}

/** Barra de abajo para saltar entre Hoy, la lectura, los planes, el Taller y la comunidad. */
export default function TabBar() {
  const colors = useColors();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const active = current(path);
  // Al presentar un mensaje la pantalla es toda para el texto.
  if (path.endsWith('/presentar')) return null;

  const go = async (key: Tab['key']) => {
    if (key === active && key !== 'leer' && (key !== 'hoy' || path === '/')) return;
    if (key === 'hoy') navigate(() => router.dismissTo('/'), 'back');
    if (key === 'planes') navigate(() => router.push('/planes'), 'fade');
    if (key === 'comunidad') navigate(() => router.push('/comunidades' as never), 'fade');
    if (key === 'taller') navigate(() => router.push('/taller'), 'fade');
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
        fixedInTransition('pestanas'),
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
