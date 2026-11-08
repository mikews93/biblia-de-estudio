// La hoja de «Dramatizado» en un capítulo que no viene grabado con la app. Si alguien ya lo dramatizó, suena en
// seguida; si no, cuenta qué se va a preparar y lo prepara a pedido (api/dramatizado.ts), mostrando cada paso: el
// guion, las voces y sonidos y la mezcla. Mientras tanto se puede cerrar y seguir leyendo: queda listo para todos.
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import { DramaIcon, PlayIcon } from '@/components/audioIcons';
import Welcome from '@/components/comunidad/Welcome';
import { CheckIcon, MusicIcon, PeopleIcon, WavesIcon } from '@/components/icons';
import { playDramatizedRemote } from '@/lib/audio';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { type FaseDrama, useDramaGrabado } from '@/lib/dramaGrabado';
import { useVersionPodcast } from '@/lib/herramientas';
import { Colors } from '@/lib/theme';

type Props = { book: string; chapter: number; title: string; colors: Colors; onClose: () => void };

const PASOS: { fase: FaseDrama; titulo: string; detalle: string }[] = [
  { fase: 'guion', titulo: 'Guion', detalle: 'Dirige cada escena y reparte el texto entre el narrador y los personajes, sin cambiar una palabra' },
  { fase: 'voces', titulo: 'Voces y sonidos', detalle: 'Graba cada escena de corrido, con el ambiente, los sonidos y los efectos' },
  { fase: 'mezcla', titulo: 'Mezcla', detalle: 'Pone cada voz en su lugar, con el eco del sitio y la música de entrada y cierre' },
];

export default function DramatizarHoja({ book, chapter, title, colors, onClose }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const version = useVersionPodcast();
  const drama = useDramaGrabado(book, chapter, version.id);
  // Si ya estaba listo al abrir, suena directamente; si se preparó con la hoja abierta, se ofrece «Escuchar».
  const yaListo = drama.estado === 'listo' && drama.inicial ? drama : null;
  useEffect(() => {
    if (!yaListo) return;
    playDramatizedRemote(book, chapter, title, yaListo);
    onClose();
  }, [yaListo, book, chapter, title, onClose]);

  const escuchar = () => {
    if (drama.estado !== 'listo') return;
    playDramatizedRemote(book, chapter, title, drama);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <Appear from={24} style={[styles.sheet, wide ? styles.sheetWide : styles.sheetPhone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {!wide && <View style={[styles.grabber, { backgroundColor: colors.border }]} />}
        <View style={styles.head}>
          <View style={[styles.badge, { backgroundColor: colors.warmSoft }]}>
            <DramaIcon color={colors.warm} size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Audio dramatizado</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {title} · {version.sigla}
            </Text>
          </View>
        </View>

        {drama.estado === 'cargando' && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {drama.estado === 'ninguno' && (
          <>
            <Text style={[styles.body, { color: colors.text }]}>
              Este capítulo todavía no está dramatizado. Prepáralo y quedará listo para todos los que leen la {version.sigla}.
            </Text>
            <View style={styles.features}>
              <Feature colors={colors} icon={<PeopleIcon color={colors.accent} size={17} />} text="Narrador y personajes con su propia voz, la misma en toda la Biblia" />
              <Feature colors={colors} icon={<WavesIcon color={colors.accent} size={17} />} text="El lugar de cada escena: su eco, su ambiente y sus sonidos" />
              <Feature colors={colors} icon={<MusicIcon color={colors.accent} size={17} />} text="Música de entrada y de cierre (o solo voces, si lo prefieres)" />
            </View>
            <Pressable
              onPress={drama.record}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent }, pressed && styles.pressed]}
            >
              <DramaIcon color={colors.surface} size={20} />
              <Text style={[styles.primaryText, { color: colors.surface }]}>Dramatizar este capítulo</Text>
            </Pressable>
            <Text style={[styles.note, { color: colors.muted }]}>Tarda unos minutos. Cada cuenta puede dramatizar un capítulo al día.</Text>
          </>
        )}

        {drama.estado === 'grabando' && (
          <>
            <View style={styles.steps}>
              {PASOS.map((p, i) => {
                const actual = PASOS.findIndex((x) => x.fase === drama.fase);
                return (
                  <Paso
                    key={p.fase}
                    colors={colors}
                    titulo={p.titulo}
                    detalle={p.detalle}
                    estado={i < actual ? 'hecho' : i === actual ? 'ahora' : 'luego'}
                    progreso={p.fase === 'voces' && drama.fase === 'voces' && drama.total ? drama.hechas / drama.total : undefined}
                    ultimo={i === PASOS.length - 1}
                  />
                );
              })}
            </View>
            <Text style={[styles.note, { color: colors.muted }]}>Puedes cerrar esto y seguir leyendo. Cuando vuelvas a «Dramatizado», sonará.</Text>
            <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.secondary, { borderColor: colors.border }, pressed && styles.pressed]}>
              <Text style={[styles.secondaryText, { color: colors.text }]}>Seguir leyendo</Text>
            </Pressable>
          </>
        )}

        {drama.estado === 'listo' && !drama.inicial && (
          <>
            <Text style={[styles.body, { color: colors.text }]}>¡Listo! Ya quedó para todos los que leen la {version.sigla}.</Text>
            <Pressable onPress={escuchar} accessibilityRole="button" style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
              <PlayIcon color={colors.surface} size={20} />
              <Text style={[styles.primaryText, { color: colors.surface }]}>Escuchar · {Math.max(1, Math.round(drama.duracion / 60))} min</Text>
            </Pressable>
          </>
        )}

        {drama.estado === 'error' &&
          (drama.error === NEEDS_ACCOUNT ? (
            <Welcome
              kind="ia"
              title="Dramatiza este capítulo"
              intro="Preparar un capítulo con voces naturales cuesta, así que se hace con una cuenta gratuita. Al terminar, queda para todos."
              onReady={drama.record}
            />
          ) : (
            <>
              <Text style={[styles.body, { color: colors.text }]}>{drama.error}</Text>
              <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.secondary, { borderColor: colors.border }, pressed && styles.pressed]}>
                <Text style={[styles.secondaryText, { color: colors.text }]}>Entendido</Text>
              </Pressable>
            </>
          ))}
      </Appear>
    </Modal>
  );
}

function Feature({ colors, icon, text }: { colors: Colors; icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.feature}>
      <View style={[styles.featureIcon, { backgroundColor: colors.accentSoft }]}>{icon}</View>
      <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function Paso({
  colors,
  titulo,
  detalle,
  estado,
  progreso,
  ultimo,
}: {
  colors: Colors;
  titulo: string;
  detalle: string;
  estado: 'hecho' | 'ahora' | 'luego';
  progreso?: number;
  ultimo: boolean;
}) {
  // Un pulso suave en el paso que se está haciendo.
  const pulso = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (estado !== 'ahora') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulso, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [estado, pulso]);
  const on = estado !== 'luego';
  return (
    <View style={styles.step} accessibilityLabel={`${titulo}: ${estado === 'hecho' ? 'hecho' : estado === 'ahora' ? 'en curso' : 'pendiente'}`}>
      <View style={styles.rail}>
        <Animated.View
          style={[
            styles.dotStep,
            {
              backgroundColor: estado === 'hecho' ? colors.warm : estado === 'ahora' ? colors.warmSoft : 'transparent',
              borderColor: on ? colors.warm : colors.border,
              transform: [{ scale: estado === 'ahora' ? pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) : 1 }],
            },
          ]}
        >
          {estado === 'hecho' && <CheckIcon color={colors.surface} size={13} />}
          {estado === 'ahora' && <View style={[styles.inner, { backgroundColor: colors.warm }]} />}
        </Animated.View>
        {!ultimo && <View style={[styles.line, { backgroundColor: estado === 'hecho' ? colors.warm : colors.border }]} />}
      </View>
      <View style={{ flex: 1, paddingBottom: ultimo ? 0 : 14 }}>
        <Text style={[styles.stepTitle, { color: on ? colors.text : colors.muted }]}>
          {titulo}
          {progreso !== undefined && <Text style={{ color: colors.muted, fontWeight: '500' }}>{`  ${Math.round(progreso * 100)} %`}</Text>}
        </Text>
        <Text style={[styles.stepDetail, { color: colors.muted }]}>{detalle}</Text>
        {progreso !== undefined && (
          <View style={[styles.bar, { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.fill, { backgroundColor: colors.warm, width: `${Math.max(4, Math.round(progreso * 100))}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    paddingBottom: 26,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  sheetPhone: { left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetWide: { top: '16%', alignSelf: 'center', width: 460, borderRadius: 18 },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: -2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 13, marginTop: 1 },
  center: { paddingVertical: 28, alignItems: 'center' },
  body: { fontSize: 15, lineHeight: 22 },
  features: { gap: 8 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, flex: 1 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 14, marginTop: 2 },
  primaryText: { fontSize: 15.5, fontWeight: '700' },
  secondary: { alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  note: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  steps: { paddingHorizontal: 2, paddingTop: 2 },
  step: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 22 },
  dotStep: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 2, flex: 1, marginVertical: 3, borderRadius: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700' },
  stepDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  fill: { height: 6, borderRadius: 3 },
});
