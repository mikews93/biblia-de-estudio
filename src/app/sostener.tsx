import { Redirect, Stack, router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { text } from '@/components/comunidad/ui';
import { ChurchIcon, ExternalIcon, FlagIcon, HeartIcon, InviteIcon, LampIcon, ListenIcon, PrayIcon, SparkIcon, type IconProps } from '@/components/icons';
import {
  CORREO_SOSTENER,
  ENLACE_CANCELAR,
  ENLACE_GITHUB,
  ENLACE_IGLESIAS,
  FONDO,
  HAY_SOSTENER,
  STRIPE_MENSUAL,
  STRIPE_UNA_VEZ,
  cubierta,
  mesCubierto,
} from '@/lib/sostener';
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
  /** Montos al mes y otras formas de pagar en vez de un solo botón. */
  pagos?: Pago[];
};

type Pago = { boton: string; nota: string; enlace: string | null };

/** Formas de sostener sin dinero: para que nadie sienta que vale menos por no poder dar (Marcos 12:42-44). */
const SIN_DINERO: { icon: (p: IconProps) => React.ReactNode; titulo: string; detalle: string; ruta?: string }[] = [
  { icon: PrayIcon, titulo: 'Ora por Zarza', detalle: 'Por quienes la usan, por sabiduría al hacerla y por quien la necesita y aún no la conoce.' },
  { icon: InviteIcon, titulo: 'Invita a un amigo', detalle: 'Con tu enlace, para que estudie contigo.', ruta: '/invitar' },
  { icon: FlagIcon, titulo: 'Cuéntanos qué falla o qué falta', detalle: 'Cada reporte hace la app mejor para todos.', ruta: '/acerca' },
  { icon: ChurchIcon, titulo: 'Cuéntale a tu pastor', detalle: 'Si a tu iglesia le sirve, puede ser anfitriona.', ruta: '/iglesia/postular' },
];

const FORMAS: Forma[] = [
  {
    icon: HeartIcon,
    titulo: 'Círculo de sembradores',
    detalle: 'Un aporte pequeño cada mes, de 1, 3 o 5 dólares, mantiene encendida la lámpara de otros.',
    puntos: ['No desbloquea nada: la app es gratis para todos, siempre.', 'Ves en qué se gasta cada dólar, factura por factura.'],
    boton: 'Sembrar',
    enlace: null,
    pagos: [
      { boton: 'Una sola vez, lo que quieras', nota: 'Con tarjeta, Apple Pay o Google Pay', enlace: STRIPE_UNA_VEZ },
      { boton: 'Patrocinar en GitHub', nota: 'Para quien ya usa GitHub · sin comisión', enlace: ENLACE_GITHUB },
    ],
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
  const cubierto = mesCubierto();

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
                {FONDO.sembradores ? ` · ${FONDO.sembradores} ${FONDO.sembradores === 1 ? 'sembrador' : 'sembradores'}` : ''}
              </Text>
              {!!FONDO.partidas?.length && (
                <View style={[styles.partidas, { borderColor: colors.border }]} testID="partidas">
                  {FONDO.partidas.map((p) => (
                    <View key={p.concepto} style={styles.partida}>
                      <Text style={[text.small, { color: colors.muted, flex: 1 }]}>{p.concepto}</Text>
                      <Text style={[text.small, { color: colors.text, fontWeight: '600' }]}>{usd(p.monto)}</Text>
                    </View>
                  ))}
                </View>
              )}
              {FONDO.logro && (
                <Text style={[text.small, { color: colors.text, textAlign: 'center' }]}>
                  <Text style={{ fontWeight: '700' }}>Lo que hizo posible: </Text>
                  {FONDO.logro}
                </Text>
              )}
            </View>
          )}
          {cubierto && (
            <View style={[styles.cubierto, { backgroundColor: colors.accentSoft }]} testID="mes-cubierto">
              <Text style={[text.body, { color: colors.text, textAlign: 'center', fontWeight: '700' }]}>Este mes ya está cubierto</Text>
              <Text style={[text.small, { color: colors.text, textAlign: 'center', lineHeight: 19 }]}>
                Gracias{FONDO?.sembradores ? ` a ${FONDO.sembradores} sembradores` : ''}: Zarza sigue gratis para todos. Como en Éxodo 36, ya
                hay lo suficiente, así que no hace falta dar más este mes.
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
            {f.pagos ? (
              <View style={styles.pagos}>
                {cubierto && (
                  <Text style={[text.small, { color: colors.muted, textAlign: 'center' }]}>
                    Este mes no hace falta. Si quieres sembrar para los meses que vienen, aquí está.
                  </Text>
                )}
                <Mensual colors={colors} />
                {f.pagos.map((p) => (
                  <BotonPago key={p.boton} pago={p} colors={colors} />
                ))}
              </View>
            ) : (
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
            )}
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

      <Appear delay={190}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]} testID="sin-dinero">
          <Text style={[styles.cardTitle, { color: colors.text }]}>No todo se sostiene con dinero</Text>
          <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
            Zarza también se sostiene con oración, con amigos que llegan y con quien avisa cuando algo falla. Todo cuenta igual.
          </Text>
          <View style={{ marginTop: 12 }}>
            {SIN_DINERO.map((f, i) => {
              const contenido = (
                <>
                  <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                    <f.icon color={colors.accent} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{f.titulo}</Text>
                    <Text style={[text.small, { color: colors.muted, marginTop: 2, lineHeight: 18 }]}>{f.detalle}</Text>
                  </View>
                  {f.ruta && <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>}
                </>
              );
              const borde = i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border };
              return f.ruta ? (
                <Pressable
                  key={f.titulo}
                  onPress={() => router.push(f.ruta as never)}
                  accessibilityRole="link"
                  style={({ pressed }) => [styles.sinDinero, borde, pressed && { opacity: 0.7 }]}
                >
                  {contenido}
                </Pressable>
              ) : (
                <View key={f.titulo} style={[styles.sinDinero, borde]}>
                  {contenido}
                </View>
              );
            })}
          </View>
        </View>
      </Appear>

      <Appear delay={210}>
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

/** Sembrar cada mes: un botón por monto, con el del medio sugerido. */
function Mensual({ colors }: { colors: Colors }) {
  if (!STRIPE_MENSUAL.length) return null;
  const sugerido = STRIPE_MENSUAL[Math.floor(STRIPE_MENSUAL.length / 2)].monto;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: colors.muted }]}>CADA MES</Text>
      <View style={styles.montos}>
        {STRIPE_MENSUAL.map(({ monto, enlace }) => {
          const lleno = monto === sugerido;
          return (
            <Pressable
              key={monto}
              onPress={() => Linking.openURL(enlace)}
              accessibilityRole="link"
              accessibilityLabel={`Sembrar ${monto} dólares cada mes`}
              style={({ pressed }) => [
                styles.monto,
                lleno ? { backgroundColor: colors.accent } : { borderColor: colors.accent, borderWidth: 1 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.montoValor, { color: lleno ? colors.background : colors.accent }]}>{monto} USD</Text>
              <Text style={[styles.montoMes, { color: lleno ? colors.background : colors.muted }]}>al mes</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[text.small, { color: colors.muted, textAlign: 'center' }]}>
        Tarjeta o billetera digital · cancelas cuando quieras, sin explicar nada.{' '}
        <Text
          onPress={() =>
            Linking.openURL(ENLACE_CANCELAR ?? `mailto:${CORREO_SOSTENER}?subject=${encodeURIComponent('Cambiar mi aporte a Zarza')}`)
          }
          accessibilityRole="link"
          style={{ color: colors.accent, fontWeight: '600' }}
        >
          {ENLACE_CANCELAR ? 'Cambiar mi aporte' : 'Escríbenos'}
        </Text>
      </Text>
    </View>
  );
}

/** Un botón de pago con su nota debajo. Sin enlace queda apagado y dice «Muy pronto». */
function BotonPago({ pago, colors }: { pago: Pago; colors: Colors }) {
  const abierto = !!pago.enlace;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => pago.enlace && Linking.openURL(pago.enlace)}
        disabled={!abierto}
        accessibilityRole="link"
        accessibilityLabel={abierto ? pago.boton : `${pago.boton}: muy pronto`}
        style={({ pressed }) => [
          styles.button,
          styles.pago,
          { borderColor: abierto ? colors.accent : colors.border, borderWidth: 1 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={{ color: abierto ? colors.accent : colors.muted, fontWeight: '700', fontSize: 15 }}>
          {pago.boton}
        </Text>
        {abierto ? (
          <ExternalIcon color={colors.accent} size={15} />
        ) : (
          <Text style={[styles.pronto, { color: colors.muted, borderColor: colors.border }]}>Muy pronto</Text>
        )}
      </Pressable>
      <Text style={[text.small, { color: colors.muted, textAlign: 'center' }]}>{pago.nota}</Text>
    </View>
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
  pagos: { marginTop: 16, gap: 14 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  montos: { flexDirection: 'row', gap: 10 },
  monto: { flex: 1, borderRadius: 18, paddingVertical: 12, alignItems: 'center' },
  montoValor: { fontSize: 17, fontWeight: '800' },
  montoMes: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  pago: { marginTop: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pronto: { fontSize: 11, fontWeight: '600', borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
  partidas: { alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 4, gap: 4 },
  partida: { flexDirection: 'row', gap: 10 },
  cubierto: { alignSelf: 'stretch', borderRadius: 16, padding: 14, gap: 4, marginTop: 6 },
  sinDinero: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
});
