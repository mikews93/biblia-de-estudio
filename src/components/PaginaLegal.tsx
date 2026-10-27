import { Link, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { text } from '@/components/comunidad/ui';
import { type IconProps } from '@/components/icons';
import { Colors, isDark, serif, useColors } from '@/lib/theme';

export type Parte = {
  icon: (p: IconProps) => React.ReactNode;
  titulo: string;
  puntos: string[];
};

/**
 * La forma de las páginas legales (Privacidad, Términos): una tarjeta de entrada con su emblema y fecha, y una tarjeta
 * por parte con sus puntos. Al final enlaza a la otra página.
 */
export default function PaginaLegal({
  titulo,
  pantalla,
  emblema: Emblema,
  resumen,
  actualizada,
  partes,
  otra,
}: {
  titulo: string;
  /** El título de la barra de arriba. */
  pantalla: string;
  emblema: (p: IconProps) => React.ReactNode;
  resumen: string;
  actualizada: string;
  partes: Parte[];
  otra: { href: '/privacidad' | '/terminos'; antes: string; nombre: string };
}) {
  const colors = useColors();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: pantalla }} />
      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
            <Emblema color={colors.accent} size={28} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{titulo}</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 460 }]}>{resumen}</Text>
          <Text style={[text.small, { color: colors.muted }]}>Actualizada el {actualizada}</Text>
        </View>
      </Appear>

      {partes.map((p, i) => (
        <Appear key={p.titulo} delay={40 + i * 30}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
            <View style={styles.cardHead}>
              <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                <p.icon color={colors.accent} size={18} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{p.titulo}</Text>
            </View>
            <View style={{ gap: 8, marginTop: 10 }}>
              {p.puntos.map((t) => (
                <View key={t} style={styles.point}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <Text style={[text.body, { color: colors.text, flex: 1 }]}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </Appear>
      ))}

      <Text style={[text.small, { color: colors.muted, textAlign: 'center', marginTop: 8 }]}>
        {otra.antes}{' '}
        <Link href={otra.href} style={{ color: colors.accent, fontWeight: '600' }}>
          {otra.nombre}
        </Link>
      </Text>
    </ScrollView>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors)
    ? null
    : {
        boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)',
      };

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 64,
    gap: 12,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  emblem: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: serif, fontSize: 20, flex: 1 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
});
