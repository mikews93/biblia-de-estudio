import { ComponentRef, ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type GestureResponderEvent, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CandleIcon, CloseIcon, type IconProps, MoonIcon, MusicIcon, SunriseIcon, WavesIcon } from '@/components/icons';
import { PISTAS, playAmbiente, saveVolumen, setVolumen, stopAmbiente, toggleAmbiente, useAmbiente } from '@/lib/ambiente';
import { Colors, serif } from '@/lib/theme';

const ICONOS: Record<string, (p: IconProps) => ReactNode> = {
  quietud: WavesIcon,
  amanecer: SunriseIcon,
  noche: MoonIcon,
  presencia: CandleIcon,
};

/**
 * Botón de la música de ambiente para la cabecera de una pantalla de estudio. Apagado es un ícono discreto; sonando
 * muestra la pista con unas barras que respiran, en ámbar. Al tocarlo se abre la elección de pista y el volumen.
 * La pantalla que lo lleva llama a useAmbienteEnPantalla, para que la música se apague al salir de ella.
 */
export default function AmbienteBoton({ colors, label = true }: { colors: Colors; label?: boolean }) {
  const { sonando } = useAmbiente();
  const [open, setOpen] = useState(false);
  const on = !!sonando;
  const pista = PISTAS.find((p) => p.id === sonando);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        onLongPress={toggleAmbiente}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={on ? `Música de ambiente: ${pista?.nombre}. Cambiar o apagar` : 'Poner música de ambiente'}
        style={({ pressed }) => [
          styles.button,
          on
            ? { backgroundColor: colors.warmSoft, borderColor: 'transparent' }
            : { borderColor: colors.border, backgroundColor: colors.surface },
          !label && !on && styles.round,
          pressed && { opacity: 0.7 },
        ]}
      >
        {on ? <Barras color={colors.warm} /> : <MusicIcon color={colors.muted} size={16} />}
        {label && (
          <Text style={[styles.buttonText, { color: on ? colors.warm : colors.muted }]} numberOfLines={1}>
            {on ? pista?.nombre : 'Ambiente'}
          </Text>
        )}
      </Pressable>
      {open && <AmbienteHoja colors={colors} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Tres barras que suben y bajan despacio: «está sonando». Quietas si se pidió reducir el movimiento. */
export function Barras({ color, size = 16 }: { color: string; size?: number }) {
  const [vals] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.4)));
  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled || reduce) return;
        loops = vals.map((v, i) =>
          Animated.loop(
            Animated.sequence([
              Animated.timing(v, { toValue: 1, duration: 700 + i * 260, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
              Animated.timing(v, { toValue: 0.3, duration: 800 + i * 200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
            ]),
          ),
        );
        loops.forEach((l, i) => setTimeout(() => !cancelled && l.start(), i * 180));
      });
    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
    };
  }, [vals]);
  const w = Math.max(2, Math.round(size / 6));
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: w * 0.8 }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{ width: w, height: size * 0.9, borderRadius: w, backgroundColor: color, transform: [{ scaleY: v }], transformOrigin: 'bottom' }}
        />
      ))}
    </View>
  );
}

/** La elección de pista y el volumen. */
function AmbienteHoja({ colors, onClose }: { colors: Colors; onClose: () => void }) {
  const { sonando, elegida, volumen } = useAmbiente();

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar música de ambiente" />
      <Appear style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: colors.muted }]}>Música de ambiente</Text>
            <Text style={[styles.title, { color: colors.text }]}>Para estudiar en calma</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
            <CloseIcon color={colors.muted} size={20} />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {PISTAS.map((p) => {
            const on = sonando === p.id;
            const Icono = ICONOS[p.id] ?? MusicIcon;
            return (
              <Pressable
                key={p.id}
                onPress={() => (on ? stopAmbiente() : playAmbiente(p.id))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${p.nombre}: ${p.detalle}${on ? '. Sonando, toca para apagar' : ''}`}
                style={({ pressed }) => [
                  styles.card,
                  { borderColor: on ? colors.warm : colors.border, backgroundColor: on ? colors.warmSoft : colors.background },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.tile, { backgroundColor: on ? colors.surface : colors.accentSoft }]}>
                    <Icono color={on ? colors.warm : colors.text} size={20} />
                  </View>
                  {on ? <Barras color={colors.warm} size={14} /> : !sonando && elegida === p.id ? <View style={[styles.dot, { backgroundColor: colors.muted }]} /> : null}
                </View>
                <Text style={[styles.name, { color: on ? colors.warm : colors.text }]}>{p.nombre}</Text>
                <Text style={[styles.detail, { color: colors.muted }]} numberOfLines={2}>
                  {p.detalle}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.volRow, { opacity: sonando ? 1 : 0.55 }]}>
          <Text style={[styles.volLabel, { color: colors.muted }]}>Volumen</Text>
          <Deslizador value={volumen} onChange={setVolumen} onEnd={saveVolumen} colors={colors} />
        </View>

        <View style={styles.foot}>
          <Text style={[styles.note, { color: colors.muted }]}>
            Pads suaves hechos para la app. Siguen mientras estudias, bajan solos si escuchas la lectura y se apagan al salir.
          </Text>
          {sonando && (
            <Pressable
              onPress={stopAmbiente}
              accessibilityRole="button"
              style={({ pressed }) => [styles.off, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Apagar</Text>
            </Pressable>
          )}
        </View>
      </Appear>
    </Modal>
  );
}

/** Barra de volumen: se toca o se arrastra. */
function Deslizador({ value, onChange, onEnd, colors }: { value: number; onChange: (v: number) => void; onEnd: () => void; colors: Colors }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const box = useRef({ x: 0, w: 1 });
  const at = (pageX: number) => onChange((pageX - box.current.x) / box.current.w);
  // El responder de la vista (no PanResponder): se mide al tocar y se sigue el dedo o el ratón.
  const handlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      const x = e.nativeEvent.pageX;
      ref.current?.measureInWindow((px, _py, w) => {
        box.current = { x: px, w: Math.max(1, w) };
        at(x);
      });
    },
    onResponderMove: (e: GestureResponderEvent) => at(e.nativeEvent.pageX),
    onResponderRelease: onEnd,
    onResponderTerminate: onEnd,
  };
  const pct = `${Math.round(value * 100)}%` as const;

  return (
    <View
      ref={ref}
      style={styles.slider}
      {...handlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Volumen de la música de ambiente"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        onChange(value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1));
        onEnd();
      }}
    >
      <View style={[styles.track, { backgroundColor: colors.accentSoft }]}>
        <View style={[styles.fill, { width: pct, backgroundColor: colors.warm }]} />
      </View>
      <View style={[styles.thumb, { left: pct, backgroundColor: colors.surface, borderColor: colors.warm }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  round: { width: 30, paddingHorizontal: 0, justifyContent: 'center' },
  buttonText: { fontSize: 12.5, fontWeight: '700', maxWidth: 92 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 440,
    maxWidth: '94%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  kicker: { fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: serif, fontSize: 21, fontWeight: '700', marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  name: { fontFamily: serif, fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 12, lineHeight: 16 },
  volRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  volLabel: { fontSize: 12.5, fontWeight: '600' },
  slider: { flex: 1, height: 32, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5 },
  thumb: { position: 'absolute', width: 20, height: 20, marginLeft: -10, borderRadius: 10, borderWidth: 2 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: { flex: 1, fontSize: 12, lineHeight: 17 },
  off: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
});
