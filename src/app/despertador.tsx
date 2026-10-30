import * as Clipboard from 'expo-clipboard';
import { Stack, router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import Appear from '@/components/Appear';
import { Button, ErrorText, SectionTitle, useAction } from '@/components/comunidad/ui';
import ElegirVoz from '@/components/ElegirVoz';
import { BellIcon, LinkIcon, OpenBookIcon, SunIcon, type IconProps } from '@/components/icons';
import { ALARMA_NATIVA, pedirAlarmaExacta, useAlarmaExacta } from '@/lib/alarma';
import { Soporte, lecturaPendiente, soporte } from '@/lib/avisos';
import { horaLabel } from '@/lib/avisosTexto';
import { Book, getBooks } from '@/lib/data';
import { guardarDespertador, useDespertador } from '@/lib/despertar';
import { DIAS, Despertador, ENTRE_SEMANA, ModoDespertar, TODOS_LOS_DIAS, diasLabel } from '@/lib/despertarTexto';
import { todayKey, usePlans } from '@/lib/planes';
import { origenCompartir } from '@/lib/sitio';
import { Colors, getLastRead, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { RITMO_DESPERTAR } from '@/lib/voces';

const PRESETS = [5 * 60, 5 * 60 + 30, 6 * 60, 6 * 60 + 30, 7 * 60];

/** Ajustes del despertador: hora, días y qué suena. La experiencia de la mañana está en /despertar. */
export default function DespertadorScreen() {
  const colors = useColors();
  const dark = isDark(colors);
  const d = useDespertador();
  const plans = usePlans();
  const [books, setBooks] = useState<Book[]>([]);
  const [last, setLast] = useState<{ book: string; chapter: number } | null>(null);
  const [support, setSupport] = useState<Soporte>('si');
  const [copiado, setCopiado] = useState(false);
  const save = useAction();
  const exacta = useAlarmaExacta();

  useEffect(() => {
    setSupport(soporte());
    getBooks().then(setBooks).catch(() => {});
    getLastRead().then(setLast);
  }, []);

  const lectura = useMemo(() => (books.length ? lecturaPendiente(plans, books, last, todayKey()) : null), [plans, books, last]);
  const lecturaTitulo = lectura ? `${books.find((b) => b.id === lectura[0])?.name ?? ''} ${lectura[1]}` : null;
  const puede = ALARMA_NATIVA || support === 'si';
  const update = (patch: Partial<Despertador>) =>
    save.run(() => guardarDespertador(patch, { endpoint: d.endpoint, despertar: d }, lecturaTitulo ?? undefined));
  const { hora, parte } = horaLabel(d.hora);
  const enlace = `${origenCompartir()}/despertar`;

  const copiar = async () => {
    await Clipboard.setStringAsync(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  };

  const toggleDia = (bit: number) => {
    const next = d.dias ^ (1 << bit);
    if (next) update({ dias: next });
  };

  const MODOS: { modo: ModoDespertar; icon: (p: IconProps) => ReactNode; title: string; detail: string }[] = [
    { modo: 'versiculo', icon: SunIcon, title: 'El versículo del día', detail: 'Música suave y, al momento, te lo leemos en voz alta.' },
    {
      modo: 'lectura',
      icon: OpenBookIcon,
      title: lecturaTitulo ? `Tu lectura: ${lecturaTitulo}` : 'Tu lectura del día',
      detail: 'El capítulo que toca en tu plan o donde te quedaste, leído sobre la música.',
    },
    { modo: 'musica', icon: BellIcon, title: 'Solo música', detail: 'Unos minutos de quietud; tú decides cuándo leer.' },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Despertador' }} />

      <Appear>
        <View style={styles.hero}>
          <Horizonte dark={dark} />
          <Text style={[styles.title, { color: colors.text }]}>Despertar con la Biblia</Text>
          <Text style={[styles.lead, { color: colors.muted }]}>
            A la hora que elijas, el teléfono te avisa. Al tocar el aviso amanece en la pantalla, suena música suave y
            empiezas el día con la Palabra.
          </Text>
        </View>
      </Appear>

      {!puede && (
        <Appear delay={40}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
              {support === 'ios-instalar' ? 'Primero, agrega la app a tu pantalla de inicio' : 'Este navegador no puede recibir el aviso'}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
              {support === 'ios-instalar'
                ? 'En iPhone y iPad el aviso solo llega a la app instalada (iOS 16.4 o posterior). Mira cómo en Notificaciones.'
                : 'Prueba con Chrome, Edge, Firefox o Safari actualizados. Mientras tanto, puedes usar el enlace de abajo con una rutina del teléfono.'}
            </Text>
            <Button
              label="Ir a Notificaciones"
              kind="outline"
              onPress={() => navigate(() => router.push('/notificaciones'), 'forward')}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            />
          </View>
        </Appear>
      )}

      {puede && (
        <Appear delay={40}>
          <View style={[styles.master, { backgroundColor: d.activo ? colors.accent : colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: d.activo ? colors.surface : colors.text, fontWeight: '700', fontSize: 16 }}>
                {d.activo ? `Suena a las ${hora} ${parte}` : 'El despertador está apagado'}
              </Text>
              <Text style={{ color: d.activo ? colors.accentSoft : colors.muted, fontSize: 13, marginTop: 3 }}>
                {d.activo ? diasLabel(d.dias) : 'Actívalo y elige la hora.'}
              </Text>
            </View>
            <Switch
              value={d.activo}
              disabled={save.busy}
              onValueChange={(v) => void update({ activo: v })}
              trackColor={{ false: colors.border, true: dark ? '#E2A868' : '#94561A' }}
              thumbColor={colors.surface}
              {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.surface } as object) : {})}
              accessibilityLabel="Despertador"
              testID="despertador-activo"
            />
          </View>
          <ErrorText>{save.error}</ErrorText>
          {ALARMA_NATIVA && d.activo && !exacta && (
            <View style={[styles.aviso, { backgroundColor: colors.accentSoft, borderColor: colors.border }]} testID="alarma-exacta">
              <BellIcon color={colors.accent} size={20} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Puede sonar unos minutos tarde</Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 }}>
                  Android pide permitir «Alarmas y recordatorios» para que suene justo a su hora.
                </Text>
                <Button label="Permitir" kind="outline" onPress={() => void pedirAlarmaExacta()} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
              </View>
            </View>
          )}
        </Appear>
      )}

      <Appear delay={80}>
        <SectionTitle>Hora</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.clock}>
            <RoundButton label="−" a11y="Cinco minutos antes" colors={colors} onPress={() => update({ hora: (d.hora - 5 + 1440) % 1440 })} />
            <View style={{ alignItems: 'center', minWidth: 150 }} accessibilityLabel={`Hora del despertador: ${hora} ${parte}`}>
              <Text style={[styles.time, { color: colors.text }]} testID="hora-despertador">
                {hora}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>{parte}</Text>
            </View>
            <RoundButton label="+" a11y="Cinco minutos después" colors={colors} onPress={() => update({ hora: (d.hora + 5) % 1440 })} />
          </View>
          <View style={styles.presets}>
            {PRESETS.map((p) => {
              const sel = p === d.hora;
              return (
                <Pressable
                  key={p}
                  onPress={() => update({ hora: p })}
                  accessibilityRole="radio"
                  aria-checked={sel}
                  style={({ pressed }) => [
                    styles.preset,
                    { borderColor: sel ? colors.accent : colors.border, backgroundColor: sel ? colors.accentSoft : 'transparent' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={{ color: sel ? colors.accent : colors.text, fontWeight: '700', fontSize: 14 }}>{horaLabel(p).hora}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.daysHead}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{diasLabel(d.dias)}</Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={() => update({ dias: TODOS_LOS_DIAS })} accessibilityRole="button" hitSlop={6}>
                <Text style={{ color: colors.warm, fontWeight: '700', fontSize: 13 }}>Todos</Text>
              </Pressable>
              <Pressable onPress={() => update({ dias: ENTRE_SEMANA })} accessibilityRole="button" hitSlop={6}>
                <Text style={{ color: colors.warm, fontWeight: '700', fontSize: 13 }}>Lun a vie</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.days}>
            {DIAS.map((dia) => {
              const on = Boolean(d.dias & (1 << dia.bit));
              return (
                <Pressable
                  key={dia.bit}
                  onPress={() => toggleDia(dia.bit)}
                  accessibilityRole="checkbox"
                  aria-checked={on}
                  accessibilityLabel={dia.nombre}
                  style={({ pressed }) => [
                    styles.day,
                    { backgroundColor: on ? colors.accent : 'transparent', borderColor: on ? colors.accent : colors.border },
                    pressed && { transform: [{ scale: 0.92 }] },
                  ]}
                >
                  <Text style={{ color: on ? colors.surface : colors.muted, fontWeight: '700', fontSize: 15 }}>{dia.corto}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Appear>

      <Appear delay={120}>
        <SectionTitle>Qué suena al tocar el aviso</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 6 }]}>
          {MODOS.map((m, i) => {
            const sel = d.modo === m.modo;
            return (
              <Pressable
                key={m.modo}
                onPress={() => update({ modo: m.modo })}
                accessibilityRole="radio"
                aria-checked={sel}
                style={({ pressed }) => [
                  styles.option,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={[styles.optionIcon, { backgroundColor: sel ? colors.warmSoft : colors.accentSoft }]}>
                  <m.icon color={sel ? colors.warm : colors.accent} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{m.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{m.detail}</Text>
                </View>
                <View style={[styles.radio, { borderColor: sel ? colors.warm : colors.border }]}>
                  {sel && <View style={[styles.radioDot, { backgroundColor: colors.warm }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        {d.modo === 'versiculo' && (
          <View style={{ marginTop: 22 }}>
            <SectionTitle>La voz que te saluda</SectionTitle>
            <ElegirVoz papel="despertar" muestra={MUESTRA} ritmo={RITMO_DESPERTAR} testID="voz-despertar" />
          </View>
        )}
        <Button
          label="Probar ahora"
          icon={SunIcon}
          onPress={() => navigate(() => router.push(`/despertar?modo=${d.modo}` as never), 'forward')}
          style={{ marginTop: 16, alignSelf: 'center', paddingHorizontal: 28 }}
        />
      </Appear>

      <Appear delay={160}>
        <SectionTitle>Cómo suena</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 16 }]}>
          {ALARMA_NATIVA ? (
            <Paso colors={colors} n={1} title="Como una alarma del teléfono">
              Suena con su propio sonido de amanecer, a su minuto y sin internet. Al tocarla se abre Zarza con la música.
            </Paso>
          ) : (
            <>
              <Paso colors={colors} n={1} title="Llega como notificación">
                Con el sonido de notificaciones del teléfono y una vibración larga. Se queda hasta que la toques, y puedes
                pedir «10 minutos más».
              </Paso>
              <Paso colors={colors} n={2} title="Al tocarla, amanece">
                Se abre Zarza, la música sube de a poco y empieza lo que elegiste. Sube el volumen de multimedia antes de
                dormir.
              </Paso>
            </>
          )}
          <View style={[styles.rutina, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>¿Ya tienes una rutina en el teléfono?</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
              Si tu rutina de la mañana (Modos y rutinas de Samsung, Atajos del iPhone, Google Home) puede abrir un enlace,
              que abra este: amanece la pantalla y la música empieza sola.
            </Text>
            <Pressable
              onPress={copiar}
              accessibilityRole="button"
              accessibilityLabel="Copiar el enlace del despertador"
              style={({ pressed }) => [styles.link, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && { opacity: 0.8 }]}
              testID="copiar-enlace"
            >
              <LinkIcon color={colors.warm} size={18} />
              <Text style={{ color: colors.text, flex: 1, fontSize: 14 }} numberOfLines={1}>
                {enlace.replace(/^https?:\/\//, '')}
              </Text>
              <Text style={{ color: colors.warm, fontWeight: '700', fontSize: 13 }}>{copiado ? 'Copiado' : 'Copiar'}</Text>
            </Pressable>
          </View>
        </View>
      </Appear>

      <Text style={[styles.foot, { color: colors.muted }]}>
        El despertador es aparte del recordatorio diario de lectura: puedes tener los dos, a horas distintas.
      </Text>
    </ScrollView>
  );
}

const MUESTRA = ['Buenos días.', 'Este es el día que hizo Jehová: nos gozaremos y alegraremos en él.'];

function Paso({ colors, n, title, children }: { colors: Colors; n: number; title: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={[styles.step, { backgroundColor: colors.warmSoft }]}>
        <Text style={{ color: colors.warm, fontWeight: '800' }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{children}</Text>
      </View>
    </View>
  );
}

function RoundButton({ label, a11y, colors, onPress }: { label: string; a11y: string; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.round, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Text style={{ color: colors.accent, fontSize: 24, fontWeight: '600', lineHeight: 26 }}>{label}</Text>
    </Pressable>
  );
}

/** Un sol que asoma en el horizonte. */
function Horizonte({ dark }: { dark: boolean }) {
  const sun = dark ? '#E2A868' : '#D98B3A';
  return (
    <View style={styles.horizon}>
      <Svg width={120} height={84} viewBox="0 0 120 84">
        <Defs>
          <LinearGradient id="cieloMini" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sun} stopOpacity={0} />
            <Stop offset="1" stopColor={sun} stopOpacity={dark ? 0.32 : 0.26} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={120} height={60} rx={0} fill="url(#cieloMini)" />
        <Circle cx={60} cy={60} r={22} fill={sun} />
        <Path
          d="M60 22v-10M33 33l-7-7M87 33l7-7M22 56h-10M98 56h10"
          stroke={sun}
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        <Rect x={0} y={60} width={120} height={24} fill={dark ? '#131313' : '#F9F8F6'} />
        <Path d="M8 60h104" stroke={dark ? '#E6E3DE' : '#2A2826'} strokeWidth={3} strokeLinecap="round" />
        <Path d="M30 70h60M46 78h28" stroke={dark ? '#9D9A94' : '#6A6660'} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 80, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', paddingTop: 4, paddingBottom: 18 },
  horizon: { width: 120, height: 84 },
  title: { fontFamily: serif, fontSize: 28, marginTop: 12, textAlign: 'center' },
  lead: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 480 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  master: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  clock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  time: { fontFamily: serif, fontSize: 52, lineHeight: 60, fontVariant: ['tabular-nums'] },
  round: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18, justifyContent: 'center' },
  preset: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', minWidth: 64 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 18 },
  daysHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 6 },
  day: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  optionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  step: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  aviso: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginTop: 10 },
  rutina: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  foot: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 28 },
});
