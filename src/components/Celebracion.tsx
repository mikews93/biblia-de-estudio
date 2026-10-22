// La celebración de un sello nuevo: breve, con su versículo, y una sola vez. No sale en las pantallas que se
// proyectan o se comparten en vivo, para no interrumpir a nadie: espera a que la persona salga de ellas.
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import Sello from './Sello';
import { hechos, DIAS, useSemanas } from '@/lib/semanas';
import { useOraciones } from '@/lib/oraciones';
import { useProgress } from '@/lib/progress';
import { celebrado, huellasDe, iniciar, porCelebrar, semanasConMeta, useSellos, type Sello as SelloDef } from '@/lib/sellos';
import { leerAlmacen } from '@/lib/sincronia';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Pantallas donde no se interrumpe: se proyectan o se siguen en grupo. */
const SIN_FIESTA = [/^\/vivo\/./, /\/proyectar$/, /\/presentar$/, /^\/evento\//];

export default function Celebracion() {
  const colors = useColors();
  const estado = useSellos();
  const pathname = usePathname();
  const [sello, setSello] = useState<SelloDef | null>(null);
  const [t] = useState(() => new Animated.Value(0));
  const [giro] = useState(() => new Animated.Value(0));

  useHuellasGuardadas();

  const pendiente = porCelebrar(estado);
  const quieto = SIN_FIESTA.some((r) => r.test(pathname));

  useEffect(() => {
    if (sello || !pendiente || quieto) return;
    // Un respiro: que primero se vea lo que se acaba de hacer
    const id = setTimeout(() => setSello(pendiente), 700);
    return () => clearTimeout(id);
  }, [pendiente, sello, quieto]);

  useEffect(() => {
    if (!sello) return;
    t.setValue(0);
    giro.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) {
          t.setValue(1);
          giro.setValue(1);
          return;
        }
        const native = Platform.OS !== 'web';
        Animated.parallel([
          Animated.timing(t, { toValue: 1, duration: 260, useNativeDriver: native }),
          Animated.spring(giro, { toValue: 1, friction: 5, tension: 70, useNativeDriver: native }),
        ]).start();
      });
    AccessibilityInfo.announceForAccessibility?.(`Nuevo sello: ${sello.titulo}`);
  }, [sello, t, giro]);

  if (!sello) return null;

  const cerrar = (ver?: boolean) => {
    const id = sello.id;
    Animated.timing(t, { toValue: 0, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setSello(null);
      celebrado(id);
    });
    if (ver) navigate(() => router.push(`/sellos?sello=${id}` as never), 'forward');
  };

  const scale = giro.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const rotate = giro.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] });
  const rayos = t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.fondo, { opacity: t }]} testID="celebracion">
      <Pressable style={StyleSheet.absoluteFill} onPress={() => cerrar()} accessibilityLabel="Cerrar" />
      <View
        style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityViewIsModal
        accessibilityRole="alert"
      >
        <View style={styles.medalla}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: t, transform: [{ scale: rayos }] }]}>
            <Rayos color={colors.warm} />
          </Animated.View>
          <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
            <Sello dibujo={sello.dibujo} colors={colors} ganado size={132} />
          </Animated.View>
        </View>
        <Text style={[styles.kicker, { color: colors.warm }]}>Nuevo sello</Text>
        <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]}>{sello.titulo}</Text>
        <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 4 }}>{sello.logro}</Text>
        <View style={[styles.versiculo, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 25, textAlign: 'center' }}>
            «{sello.versiculo.texto}»
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>{sello.versiculo.ref}</Text>
        </View>
        <View style={styles.botones}>
          <Pressable
            onPress={() => cerrar(true)}
            style={({ pressed }) => [styles.boton, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver mis sellos</Text>
          </Pressable>
          <Pressable
            onPress={() => cerrar()}
            style={({ pressed }) => [styles.boton, { backgroundColor: colors.accent }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.surface, fontWeight: '700' }}>Amén</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

/** Destellos alrededor del sello. */
function Rayos({ color }: { color: string }) {
  const rayos = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r1 = i % 2 ? 76 : 72;
    const r2 = i % 2 ? 84 : 92;
    return `M${90 + r1 * Math.cos(a)} ${90 + r1 * Math.sin(a)}L${90 + r2 * Math.cos(a)} ${90 + r2 * Math.sin(a)}`;
  }).join('');
  return (
    <Svg width={180} height={180} viewBox="0 0 180 180">
      <Path d={rayos} stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={0.55} />
    </Svg>
  );
}

/**
 * Huellas que salen de lo que la app ya guarda: los días con la Palabra, las semanas con la meta cumplida, las
 * oraciones respondidas y las semanas del sermón completas. La primera vez se suman sin celebrar.
 */
function useHuellasGuardadas() {
  const progreso = useProgress();
  const oraciones = useOraciones();
  const { semanas } = useSemanas();
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [p, o, s] = (await Promise.all([leerAlmacen('progreso'), leerAlmacen('oraciones'), leerAlmacen('semanas')])) as [
        { days: string[] } | undefined,
        { id: string; respondida?: unknown }[] | undefined,
        Parameters<typeof hechos>[0][] | undefined,
      ];
      if (!vivo) return;
      const dias = p?.days ?? [];
      await huellasDe('dia', dias);
      await huellasDe('meta', semanasConMeta(dias));
      await huellasDe('respondida', (o ?? []).filter((x) => x.respondida).map((x) => x.id));
      await huellasDe('sermon', (s ?? []).filter((w) => hechos(w) >= DIAS).map((w) => w.id));
      await iniciar();
    })().catch(() => {});
    return () => {
      vivo = false;
    };
  }, [progreso, oraciones, semanas]);
}

const styles = StyleSheet.create({
  fondo: { backgroundColor: 'rgba(10,10,10,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 },
  tarjeta: { width: '100%', maxWidth: 380, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, padding: 24, paddingTop: 20, alignItems: 'center' },
  medalla: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  titulo: { fontSize: 28, marginTop: 4, textAlign: 'center' },
  versiculo: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 16, width: '100%' },
  botones: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' },
  boton: { flex: 1, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
