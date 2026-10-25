import { Redirect, Stack, router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { text } from '@/components/comunidad/ui';
import { ChurchIcon, HeartIcon, LampIcon, ListenIcon, SparkIcon, type IconProps } from '@/components/icons';
import { ENLACE_APORTES, ENLACE_IGLESIAS, FONDO, HAY_SOSTENER, cubierta } from '@/lib/sostener';
import { Colors, isDark, serif, useColors } from '@/lib/theme';

type Forma = {
  icon: (p: IconProps) => React.ReactNode;
  titulo: string;
  detalle: string;
  puntos: string[];
  boton: string;
  enlace: string | null;
  /** El botón abre una pantalla de la app en vez de un enlace externo. */
  ruta?: string;
  /** Un enlace dentro de la app debajo del botón. */
  extra?: { texto: string; accion: string; ruta: string };
};

const FORMAS: Forma[] = [
  {
    icon: HeartIcon,
    titulo: 'Círculo de sembradores',
    detalle: 'Un aporte pequeño cada mes, de 1, 3 o 5 dólares, mantiene encendida la lámpara de otros.',
    puntos: ['No desbloquea nada: la app es gratis para todos, siempre.', 'Ves en qué se gasta cada dólar, factura por factura.'],
    boton: 'Sembrar',
    enlace: ENLACE_APORTES,
  },
  {
    icon: ChurchIcon,
    titulo: 'Zarza para Iglesias',
    detalle: 'Tu iglesia aporta de 15 a 50 dólares al mes y su gente estudia con más preguntas al día.',
    puntos: [
      'Un espacio para el grupo: planes de lectura, célula en vivo y eventos.',
      'Un código QR para que los miembros entren sin pasos técnicos.',
      'Su nombre como iglesia anfitriona, con discreción.',
    ],
    boton: 'Postular mi iglesia',
    enlace: ENLACE_IGLESIAS,
    // La iglesia se postula en la app; el aporte se arregla después de aprobarla.
    ruta: '/iglesia/postular',
    extra: { texto: '¿Tu iglesia ya es anfitriona?', accion: 'Entra con su código', ruta: '/iglesia' },
  },
  {
    icon: ListenIcon,
    titulo: 'Padrinos de un libro',
    detalle: 'Una familia o una iglesia hace posible el audio dramatizado de un libro de la Biblia.',
    puntos: ['Cada capítulo cuesta unos 5.000 créditos de voz.', 'Una línea en los créditos del audio, nunca en el texto.'],
    boton: 'Apadrinar un libro',
    enlace: ENLACE_IGLESIAS,
  },
];

/** Sostén Zarza: cuánto cuesta el mes, cuánto cubrió la comunidad y las formas de ayudar. Solo en la web. */
export default function Sostener() {
  const colors = useColors();
  if (!HAY_SOSTENER) return <Redirect href="/" />;
  const parte = FONDO ? cubierta(FONDO) : null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Sostén Zarza' }} />
      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
            <LampIcon color={colors.accent} size={30} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Arde y no se consume</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 480 }]}>
            Zarza es gratis, sin anuncios y sin vender datos. La IA y las voces cuestan dinero cada mes: la comunidad lo sostiene para que
            nadie tenga que pagar por estudiar la Biblia.
          </Text>
          {FONDO && parte !== null && (
            <View style={styles.fondo}>
              <View style={[styles.bar, { backgroundColor: colors.border }]}>
                <View style={[styles.barFill, { width: `${Math.round(parte * 100)}%`, backgroundColor: colors.accent }]} />
              </View>
              <Text style={[text.small, { color: colors.text, fontWeight: '700' }]}>
                En {FONDO.mes} la comunidad mantiene encendida la lámpara: {Math.round(parte * 100)} %
              </Text>
              <Text style={[text.small, { color: colors.muted }]}>
                {usd(FONDO.cubierto)} de {usd(FONDO.gasto)} entre IA, voces y servidores
              </Text>
            </View>
          )}
        </View>
      </Appear>

      {FORMAS.map((f, i) => (
        <Appear key={f.titulo} delay={60 + i * 40}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
            <View style={styles.cardHead}>
              <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                <f.icon color={colors.accent} size={20} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{f.titulo}</Text>
            </View>
            <Text style={[text.body, { color: colors.text, marginTop: 10 }]}>{f.detalle}</Text>
            <View style={{ gap: 6, marginTop: 10 }}>
              {f.puntos.map((p) => (
                <View key={p} style={styles.point}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <Text style={[text.small, { color: colors.muted, flex: 1 }]}>{p}</Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={() => (f.ruta ? router.push(f.ruta as never) : f.enlace && Linking.openURL(f.enlace))}
              disabled={!f.enlace && !f.ruta}
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.button,
                f.enlace || f.ruta ? { backgroundColor: colors.accent } : { borderColor: colors.border, borderWidth: 1 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={{ color: f.enlace || f.ruta ? colors.background : colors.muted, fontWeight: '700', fontSize: 15 }}>
                {f.enlace || f.ruta ? f.boton : 'Muy pronto'}
              </Text>
            </Pressable>
            {f.extra && (
              <Pressable onPress={() => router.push(f.extra!.ruta as never)} accessibilityRole="link" style={styles.extra}>
                <Text style={[text.small, { color: colors.muted, textAlign: 'center' }]}>
                  {f.extra.texto} <Text style={{ color: colors.accent, fontWeight: '700' }}>{f.extra.accion}</Text>
                </Text>
              </Pressable>
            )}
          </View>
        </Appear>
      ))}

      <Appear delay={200}>
        <View style={[styles.note, { borderColor: colors.border }]}>
          <SparkIcon color={colors.muted} size={16} />
          <Text style={[text.small, { color: colors.muted, flex: 1 }]}>
            Si un mes no alcanza, solo se pausan las preguntas nuevas a la IA. La Biblia, los estudios ya preparados, los planes y el audio
            siguen abiertos para todos.
          </Text>
        </View>
      </Appear>
    </ScrollView>
  );
}

const usd = (n: number) => `${n.toLocaleString('es', { maximumFractionDigits: 0 })} USD`;

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 10, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: serif, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  fondo: { alignSelf: 'stretch', gap: 6, marginTop: 8, alignItems: 'center' },
  bar: { alignSelf: 'stretch', height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: serif, fontSize: 21, flex: 1 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  button: { marginTop: 16, borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
  extra: { marginTop: 10, paddingVertical: 4 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
});
