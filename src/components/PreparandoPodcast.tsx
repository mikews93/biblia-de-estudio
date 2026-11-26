// Mientras se escribe el guion de un pódcast (casi un minuto: primero se lee el capítulo, el original y las fuentes, y
// después Ana y Tomás empiezan a conversar). Antes era una rueda y una frase: parecía colgado. Ahora dice en qué va, cuánto
// suele tardar y que se puede salir de la app sin perderlo.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { BooksIcon, RefreshIcon, TalkIcon } from '@/components/icons';
import { Colors } from '@/lib/theme';

/** Lo que suele tardar el guion (medido en el servidor: entre 40 y 55 s). */
const SUELE_S = 50;

const pasos = (palabra: boolean) =>
  [
    { desde: 0, texto: palabra ? 'Siguiendo la palabra en el original y sus pasajes' : 'Leyendo el capítulo, el original y las fuentes', icon: BooksIcon },
    { desde: 22, texto: 'Ana y Tomás preparan la conversación', icon: TalkIcon },
  ] as const;

/** Segundos desde que se montó, cada segundo. */
export function useSegundos(desde: number, activo = true) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activo, desde]);
  return Math.max(0, Math.floor((ahora - desde) / 1000));
}

export default function PreparandoPodcast({ colors, retomando, palabra = false }: { colors: Colors; retomando: boolean; palabra?: boolean }) {
  const PASOS = pasos(palabra);
  const [inicio] = useState(() => Date.now());
  const s = useSegundos(inicio);
  const paso = s >= PASOS[1].desde ? 1 : 0;
  // La barra avanza rápido al principio y se frena cerca del final: nunca llega sola al 100 %.
  const avance = Math.min(0.94, 1 - Math.exp(-s / (SUELE_S * 0.6)));
  const [ancho] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(ancho, { toValue: avance, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [avance, ancho]);

  const falta = Math.max(0, SUELE_S - s);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLiveRegion="polite" testID="preparando-podcast">
      {retomando ? (
        <View style={styles.row}>
          <RefreshIcon color={colors.warm} size={18} />
          <Text style={[styles.title, { color: colors.text }]}>Se cortó la conexión. Retomando…</Text>
        </View>
      ) : (
        <Text style={[styles.title, { color: colors.text }]}>Preparando el pódcast</Text>
      )}

      <View style={{ gap: 10, marginTop: 14 }}>
        {PASOS.map((p, i) => {
          const hecho = i < paso;
          const ahora = i === paso;
          const Icon = p.icon;
          return (
            <View key={p.texto} style={[styles.row, { opacity: hecho || ahora ? 1 : 0.45 }]}>
              <View style={[styles.dot, { backgroundColor: ahora ? colors.accentSoft : 'transparent', borderColor: colors.border }]}>
                {ahora ? <ActivityIndicator size="small" color={colors.accent} /> : <Icon color={hecho ? colors.accent : colors.muted} size={16} />}
              </View>
              <Text style={{ color: ahora ? colors.text : colors.muted, flex: 1, fontSize: 15 }}>{p.texto}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.track, { backgroundColor: colors.accentSoft }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: colors.accent, width: ancho.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>
      <Text style={[styles.small, { color: colors.muted, fontVariant: Platform.OS === 'web' ? undefined : ['tabular-nums'] }]}>
        {falta > 0 ? `Suele tardar menos de un minuto · faltan unos ${falta} s` : 'Ya casi: dando los últimos toques'}
      </Text>
      <Text style={[styles.small, { color: colors.muted, marginTop: 6 }]}>
        Puedes salir de la app: se sigue preparando y al volver lo encuentras listo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, padding: 18, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '700' },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 18 },
  fill: { height: 6, borderRadius: 3 },
  small: { fontSize: 13, marginTop: 10, lineHeight: 18 },
});
