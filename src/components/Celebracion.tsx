// La celebración de un sello nuevo: una tarjeta que baja desde arriba con el sello girando, se queda unos segundos
// y se va sola, una sola vez. No tapa la lectura ni detiene el audio; al tocarla se abre el sello con su versículo.
// No sale en las pantallas que se proyectan o se siguen en vivo: espera a que la persona salga de ellas.
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Sello from './Sello';
import { CloseIcon } from './icons';
import { hechos, DIAS, useSemanas } from '@/lib/semanas';
import { useOraciones } from '@/lib/oraciones';
import { useProgress } from '@/lib/progress';
import { celebrado, huellasDe, iniciar, porCelebrar, semanasConMeta, useSellos, type Sello as SelloDef } from '@/lib/sellos';
import { leerAlmacen } from '@/lib/sincronia';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Cuánto se queda a la vista (ms). */
const DURA = 7000;

/** Pantallas donde no se interrumpe: se proyectan o se siguen en grupo. */
const SIN_FIESTA = [/^\/vivo\/./, /\/proyectar$/, /\/presentar$/, /^\/evento\//];

export default function Celebracion() {
  const colors = useColors();
  const estado = useSellos();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
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

  const cerrar = (id: string, ver?: boolean) => {
    Animated.timing(t, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setSello((s) => (s?.id === id ? null : s));
      celebrado(id);
    });
    if (ver) navigate(() => router.push(`/sellos?sello=${id}` as never), 'forward');
  };

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
          Animated.spring(t, { toValue: 1, friction: 8, tension: 60, useNativeDriver: native }),
          Animated.spring(giro, { toValue: 1, friction: 4, tension: 50, delay: 120, useNativeDriver: native }),
        ]).start();
      });
    AccessibilityInfo.announceForAccessibility?.(`Nuevo sello: ${sello.titulo}. ${sello.logro}`);
    // Se va sola: celebra sin interrumpir la lectura ni el audio
    const id = setTimeout(() => cerrar(sello.id), DURA);
    return () => clearTimeout(id);
  }, [sello]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sello) return null;

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });
  const scale = giro.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const rotate = giro.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.capa, { top: insets.top + 10, opacity: t, transform: [{ translateY }] }]}
      testID="celebracion"
    >
      <Pressable
        onPress={() => cerrar(sello.id, true)}
        style={({ pressed }) => [styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.warm }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Nuevo sello: ${sello.titulo}. ${sello.logro} Ver mis sellos`}
      >
        <View style={styles.medalla}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.centro, { opacity: giro }]}>
            <Rayos color={colors.warm} />
          </Animated.View>
          <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
            <Sello dibujo={sello.dibujo} colors={colors} ganado size={62} />
          </Animated.View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.warm }]}>Nuevo sello</Text>
          <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]} numberOfLines={1}>
            {sello.titulo}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
            {sello.logro} <Text style={{ fontStyle: 'italic' }}>{sello.versiculo.ref}</Text>
          </Text>
        </View>
        <Pressable onPress={() => cerrar(sello.id)} hitSlop={10} style={styles.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
          <CloseIcon color={colors.muted} size={18} />
        </Pressable>
      </Pressable>
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
    <Svg width={92} height={92} viewBox="0 0 180 180">
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
  capa: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 50 },
  tarjeta: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  medalla: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  centro: { alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  titulo: { fontSize: 20, marginTop: 1 },
  cerrar: { alignSelf: 'flex-start', padding: 4 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
