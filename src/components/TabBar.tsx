import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeIcon, LecternIcon, OpenBookIcon, PeopleIcon, PlansIcon } from '@/components/icons';
import { chrome, setChromeHidden } from '@/lib/chrome';
import { chapterHref } from '@/lib/routes';
import { Colors, getLastRead, useColors } from '@/lib/theme';
import { fixedInTransition, navigate } from '@/lib/transition';

type Tab = { key: 'hoy' | 'leer' | 'planes' | 'taller' | 'comunidad'; label: string; icon: typeof HomeIcon };

const TABS: Tab[] = [
  { key: 'hoy', label: 'Hoy', icon: HomeIcon },
  { key: 'leer', label: 'Leer', icon: OpenBookIcon },
  { key: 'planes', label: 'Planes', icon: PlansIcon },
  { key: 'taller', label: 'Taller', icon: LecternIcon },
  { key: 'comunidad', label: 'Comunidad', icon: PeopleIcon },
];

function current(path: string): Tab['key'] {
  if (path === '/' || path === '/notas' || path === '/diario' || path === '/repaso' || path === '/descargas') return 'hoy';
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
  const [height, setHeight] = useState(0);

  // Las barras ocultas al leer vuelven en cuanto se cambia de pantalla.
  useEffect(() => setChromeHidden(false), [path]);

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
    // Al bajar leyendo la barra se encoge hasta desaparecer (src/lib/chrome.ts) y el texto gana ese espacio.
    <Animated.View
      style={[
        styles.clip,
        height > 0 && { height: chrome.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) },
        fixedInTransition('pestanas'),
      ]}
    >
      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - height) > 0.5) setHeight(h);
        }}
        style={[
          styles.bar,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 6) },
          { transform: [{ translateY: chrome.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }] },
        ]}
        accessibilityRole="tablist"
      >
        {TABS.map((t) => (
          <TabButton key={t.key} tab={t} on={t.key === active} colors={colors} onPress={() => go(t.key)} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/** Una pestaña: el ícono se asienta sobre una píldora suave cuando está activa. */
function TabButton({ tab, on, colors, onPress }: { tab: Tab; on: boolean; colors: Colors; onPress: () => void }) {
  const t = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: on ? 1 : 0, speed: 18, bounciness: 6, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [on, t]);
  const Icon = tab.icon;
  const color = on ? colors.accent : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={tab.label}
    >
      <View style={styles.iconSlot}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.indicator,
            { backgroundColor: colors.accentSoft, opacity: t, transform: [{ scaleX: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] },
          ]}
        />
        <View style={styles.icon}>
          <Icon color={color} size={22} />
        </View>
      </View>
      <Text style={[styles.label, { color, fontWeight: on ? '700' : '500' }]}>{tab.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  iconSlot: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center' },
  indicator: { borderRadius: 15 },
  // Por encima de la píldora: en la web lo posicionado se pinta sobre lo que no lo está.
  icon: { position: 'relative', zIndex: 1 },
  label: { fontSize: 11, marginTop: 2, lineHeight: 14 },
});
