import { Stack, router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import Appear from '@/components/Appear';
import { Button, ErrorText, SectionTitle, useAction } from '@/components/comunidad/ui';
import { CandleIcon, CardsIcon, ChevronRightIcon, CommentIcon, FlameIcon, type IconProps, OpenBookIcon, PlusSquareIcon, ShareIcon, SunIcon } from '@/components/icons';
import { Ajustes, Soporte, Tipo, activar, buildEstado, cambiar, desactivar, permiso, probar, soporte, useAvisos } from '@/lib/avisos';
import { dailyMessage, horaLabel } from '@/lib/avisosTexto';
import { diasLabel } from '@/lib/despertarTexto';
import { useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { dateKey, usePlans } from '@/lib/planes';
import { useProgress } from '@/lib/progress';
import { useCards } from '@/lib/tarjetas';
import { Colors, getLastRead, isDark, sans, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const PRESETS = [
  { hora: 6 * 60, label: 'Al despertar' },
  { hora: 7 * 60 + 30, label: 'Desayuno' },
  { hora: 12 * 60 + 30, label: 'Mediodía' },
  { hora: 18 * 60, label: 'Tarde' },
  { hora: 21 * 60, label: 'Antes de dormir' },
];

const TIPOS: { tipo: Tipo; icon: (p: IconProps) => ReactNode; title: string; detail: string }[] = [
  { tipo: 'lectura', icon: OpenBookIcon, title: 'Lectura del día', detail: 'Lo que toca en tu plan o donde te quedaste. Si ya leíste, no te escribimos.' },
  { tipo: 'tarjetas', icon: CardsIcon, title: 'Tarjetas para repasar', detail: 'Cuántas tarjetas te esperan ese día para no olvidar lo estudiado.' },
  { tipo: 'reto', icon: CandleIcon, title: 'Desafío de temporada', detail: 'El día y la lectura de Adviento, Cuaresma o Año Nuevo, si te uniste.' },
  { tipo: 'racha', icon: FlameIcon, title: 'Racha devocional', detail: 'La noche del último día de tu racha, a las 8, si aún no hiciste el devocional.' },
  { tipo: 'comunidad', icon: CommentIcon, title: 'Comunidad', detail: 'Comentarios, me gusta, invitaciones de amistad y quién se une a tus grupos. Llegan al momento.' },
];

/** Notificaciones: recordatorio diario a la hora elegida y avisos de la comunidad (web instalada). */
export default function NotificationsScreen() {
  const colors = useColors();
  const avisos = useAvisos();
  const { usuario } = useAccount();
  const [support, setSupport] = useState<Soporte>('si');
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const [flash, setFlash] = useState<string | null>(null);
  const turnOn = useAction();
  const test = useAction();
  const change = useAction();
  const on = Boolean(avisos.endpoint);

  useEffect(() => {
    setSupport(soporte());
    setPerm(permiso());
  }, [avisos.endpoint]);

  const say = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2600);
  };

  const enable = () => turnOn.run(activar).then((ok) => (ok ? say('¡Listo! Ya están activas en este dispositivo.') : setPerm(permiso())));
  const update = (patch: Partial<Pick<Ajustes, 'hora' | 'avisos'>>) => change.run(() => cambiar(patch));
  const step = (delta: number) => update({ hora: (avisos.hora + delta + 1440) % 1440 });
  const { hora, parte } = horaLabel(avisos.hora);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Notificaciones' }} />

      <Appear>
        <View style={styles.hero}>
          <Bell colors={colors} active={on} />
          <Text style={[styles.title, { color: colors.text }]}>Un recordatorio amable</Text>
          <Text style={[styles.lead, { color: colors.muted }]}>
            Cada día, a la hora que elijas, te recordamos tu lectura. Y si tienes cuenta, te avisamos cuando alguien te
            comenta, le gusta lo que compartes o te invita.
          </Text>
        </View>
      </Appear>

      <Appear delay={40}>
        <StatusCard
          colors={colors}
          support={support}
          perm={perm}
          on={on}
          busy={turnOn.busy}
          onEnable={enable}
          onDisable={() => desactivar().then(() => say('Desactivadas en este dispositivo.'))}
        />
        <ErrorText>{turnOn.error}</ErrorText>
        {flash && <Text style={[styles.flash, { color: colors.accent }]}>{flash}</Text>}
      </Appear>

      <Appear delay={80}>
        <SectionTitle>Recordatorio diario</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.clock}>
            <RoundButton label="−" a11y="Quince minutos antes" colors={colors} onPress={() => step(-15)} />
            <View style={{ alignItems: 'center', minWidth: 150 }} accessibilityLabel={`Hora del recordatorio: ${hora} ${parte}`}>
              <Text style={[styles.time, { color: colors.text }]} testID="hora-recordatorio">
                {hora}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>{parte}</Text>
            </View>
            <RoundButton label="+" a11y="Quince minutos después" colors={colors} onPress={() => step(15)} />
          </View>
          <View style={styles.presets}>
            {PRESETS.map((p) => {
              const sel = p.hora === avisos.hora;
              return (
                <Pressable
                  key={p.hora}
                  onPress={() => update({ hora: p.hora })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  style={({ pressed }) => [
                    styles.preset,
                    { borderColor: sel ? colors.accent : colors.border, backgroundColor: sel ? colors.accentSoft : 'transparent' },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={{ color: sel ? colors.accent : colors.text, fontWeight: '700', fontSize: 14 }}>
                    {horaLabel(p.hora).hora}
                  </Text>
                  <Text style={{ color: sel ? colors.accent : colors.muted, fontSize: 12 }}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Appear>

      <Appear delay={110}>
        <Preview colors={colors} hora={avisos.hora} avisos={avisos.avisos} />
      </Appear>

      <Appear delay={140}>
        <SectionTitle>Qué te avisamos</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 4 }]}>
          {TIPOS.map((t, i) => {
            const needsAccount = t.tipo === 'comunidad' && !usuario;
            return (
              <View key={t.tipo} style={[styles.toggle, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                <View style={[styles.toggleIcon, { backgroundColor: colors.accentSoft }]}>
                  <t.icon color={colors.accent} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                    {needsAccount ? 'Necesitas una cuenta para recibir avisos de la comunidad.' : t.detail}
                  </Text>
                  {needsAccount && (
                    <Pressable onPress={() => navigate(() => router.push('/entrar'), 'forward')} accessibilityRole="link">
                      <Text style={{ color: colors.accent, fontWeight: '700', marginTop: 6 }}>Entrar o crear cuenta ›</Text>
                    </Pressable>
                  )}
                </View>
                <Switch
                  value={avisos.avisos[t.tipo] && !needsAccount}
                  disabled={needsAccount}
                  onValueChange={(v) => void update({ avisos: { [t.tipo]: v } as Record<Tipo, boolean> })}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.surface}
                  {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.surface } as object) : {})}
                  accessibilityLabel={t.title}
                />
              </View>
            );
          })}
        </View>
        <ErrorText>{change.error}</ErrorText>
      </Appear>

      <Appear delay={155}>
        <SectionTitle>Despertador</SectionTitle>
        <Pressable
          onPress={() => navigate(() => router.push('/despertador' as never), 'forward')}
          accessibilityRole="link"
          style={({ pressed }) => [styles.card, styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
        >
          <View style={[styles.toggleIcon, { backgroundColor: colors.warmSoft }]}>
            <SunIcon color={colors.warm} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Despertar con la Biblia</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
              {avisos.despertar.activo
                ? `Suena a las ${horaLabel(avisos.despertar.hora).hora} ${horaLabel(avisos.despertar.hora).parte} · ${diasLabel(avisos.despertar.dias).toLowerCase()}`
                : 'Un aviso a la hora de levantarte que abre la app con música suave y el versículo del día.'}
            </Text>
          </View>
          <ChevronRightIcon color={colors.muted} size={18} />
        </Pressable>
      </Appear>

      {on && (
        <Appear delay={170}>
          <View style={styles.actions}>
            <Button
              label="Enviarme una de prueba"
              kind="outline"
              busy={test.busy}
              onPress={() => test.run(probar).then((ok) => ok && say('Enviada. Debería llegarte en unos segundos.'))}
            />
          </View>
          <ErrorText>{test.error}</ErrorText>
        </Appear>
      )}

      <Text style={[styles.foot, { color: colors.muted }]}>
        Las notificaciones se activan en cada dispositivo. En iPhone y iPad solo llegan con la app agregada a la pantalla
        de inicio, desde iOS 16.4. Nunca te mandamos más de un recordatorio al día.
      </Text>
    </ScrollView>
  );
}

function StatusCard({
  colors,
  support,
  perm,
  on,
  busy,
  onEnable,
  onDisable,
}: {
  colors: Colors;
  support: Soporte;
  perm: NotificationPermission;
  on: boolean;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (support === 'ios-instalar') return <InstallGuide colors={colors} />;
  if (support !== 'si') {
    const msg: Record<Exclude<Soporte, 'si' | 'ios-instalar'>, { title: string; body: string }> = {
      'ios-viejo': {
        title: 'Hace falta iOS 16.4 o posterior',
        body: 'Tu iPhone aún no puede recibir notificaciones de apps web. Actualízalo en Ajustes › General › Actualización de software.',
      },
      no: {
        title: 'Este navegador no las admite',
        body: 'Prueba con Chrome, Edge, Firefox o Safari actualizados. Instalar la app también ayuda.',
      },
      nativo: {
        title: 'Pronto en esta app',
        body: 'Por ahora las notificaciones funcionan en la versión web instalada (zarzabiblia.com).',
      },
    };
    return <Notice colors={colors} tone="muted" title={msg[support].title} body={msg[support].body} />;
  }
  if (on) {
    return (
      <View style={[styles.status, { backgroundColor: colors.accentSoft }]}>
        <View style={[styles.dot, { backgroundColor: colors.accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Activas en este dispositivo</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>Los cambios se guardan al momento.</Text>
        </View>
        <Pressable onPress={onDisable} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Desactivar</Text>
        </Pressable>
      </View>
    );
  }
  if (perm === 'denied') {
    return (
      <Notice
        colors={colors}
        tone="warn"
        title="Están bloqueadas en el navegador"
        body="Abre los ajustes del sitio (el candado junto a la dirección, o Ajustes › Notificaciones en el teléfono), permite las notificaciones de esta página y vuelve aquí."
      >
        <Button label="Intentar de nuevo" kind="outline" onPress={onEnable} busy={busy} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
      </Notice>
    );
  }
  return (
    <View style={[styles.cta, { backgroundColor: colors.accent }]}>
      <Text style={[styles.ctaTitle, { color: colors.surface }]}>Elige la hora y actívalas</Text>
      <Text style={{ color: colors.accentSoft, marginTop: 4, lineHeight: 20 }}>
        {Platform.OS === 'web' ? 'El navegador' : 'El teléfono'} te pedirá permiso. Puedes cambiarlas o apagarlas cuando quieras.
      </Text>
      <Pressable
        onPress={onEnable}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.ctaButton, { backgroundColor: colors.surface }, (pressed || busy) && { opacity: 0.8 }]}
      >
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 15 }}>{busy ? 'Activando…' : 'Activar notificaciones'}</Text>
      </Pressable>
    </View>
  );
}

/** En Safari del iPhone: cómo agregar la app a la pantalla de inicio, que es lo que permite recibirlas. */
function InstallGuide({ colors }: { colors: Colors }) {
  const steps: { icon: ReactNode; text: ReactNode }[] = [
    {
      icon: <ShareIcon color={colors.accent} size={22} />,
      text: (
        <>
          Toca <Text style={{ fontWeight: '700' }}>Compartir</Text> en la barra de Safari.
        </>
      ),
    },
    {
      icon: <PlusSquareIcon color={colors.accent} size={22} />,
      text: (
        <>
          Elige <Text style={{ fontWeight: '700' }}>Agregar a pantalla de inicio</Text>.
        </>
      ),
    },
    {
      icon: <Text style={{ color: colors.accent, fontFamily: serif, fontSize: 18, fontWeight: '700' }}>B</Text>,
      text: (
        <>
          Abre la Biblia desde su ícono y vuelve a <Text style={{ fontWeight: '700' }}>Notificaciones</Text>.
        </>
      ),
    },
  ];
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="guia-iphone">
      <Text style={[styles.kicker, { color: colors.accent }]}>En iPhone y iPad</Text>
      <Text style={[styles.ctaTitle, { color: colors.text, marginTop: 6 }]}>Primero, agrega la app a tu pantalla de inicio</Text>
      <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
        Apple solo permite notificaciones a las apps web instaladas, desde iOS 16.4.
      </Text>
      <View style={{ marginTop: 14, gap: 12 }}>
        {steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={[styles.stepIcon, { backgroundColor: colors.accentSoft }]}>{s.icon}</View>
            <Text style={{ color: colors.text, flex: 1, fontSize: 15, lineHeight: 21 }}>
              <Text style={{ color: colors.muted }}>{i + 1}. </Text>
              {s.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Cómo se verá el recordatorio de mañana con lo que hay en este dispositivo. */
function Preview({ colors, hora, avisos }: { colors: Colors; hora: number; avisos: Record<Tipo, boolean> }) {
  const plans = usePlans();
  const cards = useCards();
  const progress = useProgress();
  const [books, setBooks] = useState<Book[]>([]);
  const [last, setLast] = useState<{ book: string; chapter: number } | null>(null);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    getLastRead().then(setLast);
  }, []);

  const tomorrow = dateKey(new Date(Date.now() + 86_400_000));
  const aviso = useMemo(() => {
    const estado = buildEstado({ plans, cards, days: progress.days, books, last, today: dateKey(new Date()) });
    const prefs = { lectura: avisos.lectura, tarjetas: avisos.tarjetas, reto: avisos.reto };
    return dailyMessage(estado, prefs, tomorrow);
  }, [plans, cards, progress, books, last, avisos, tomorrow]);
  const { hora: h, parte } = horaLabel(hora);
  const dark = isDark(colors);

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
        Así se verá mañana a las {h} {parte}:
      </Text>
      <View
        style={[
          styles.bubble,
          { backgroundColor: dark ? '#2A2622' : '#FFFFFFEE', borderColor: colors.border },
          Platform.OS === 'web' && ({ boxShadow: dark ? '0 6px 24px rgba(0,0,0,.45)' : '0 6px 24px rgba(60,40,20,.12)' } as object),
        ]}
        testID="vista-previa"
      >
        <View style={[styles.appIcon, { backgroundColor: '#8A4B2A' }]}>
          <Text style={{ color: '#FBF8F3', fontFamily: serif, fontWeight: '700', fontSize: 18 }}>B</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>BIBLIA DE ESTUDIO</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>ahora</Text>
          </View>
          {aviso ? (
            <>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 3, fontFamily: sans }}>{aviso.title}</Text>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 19, marginTop: 1 }}>{aviso.body}</Text>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 19, marginTop: 4 }}>
              Con estos avisos apagados no te escribiremos por la mañana. Solo llegarán los de la comunidad.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function Notice({
  colors,
  tone,
  title,
  body,
  children,
}: {
  colors: Colors;
  tone: 'muted' | 'warn';
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: tone === 'warn' ? '#D9A441' : colors.border },
        tone === 'warn' && { borderLeftWidth: 4 },
      ]}
    >
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
      <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>{body}</Text>
      {children}
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

function Bell({ colors, active }: { colors: Colors; active: boolean }) {
  return (
    <View style={[styles.bellWrap, { backgroundColor: colors.accentSoft }]}>
      <Svg width={46} height={46} viewBox="0 0 48 48">
        <Path
          d="M24 6c-6.6 0-11 5-11 11.5v7.2c0 1.6-.6 3.1-1.7 4.3L9 31.5c-.9 1-.2 2.5 1.1 2.5h27.8c1.3 0 2-1.5 1.1-2.5L36.7 29c-1.1-1.2-1.7-2.7-1.7-4.3v-7.2C35 11 30.6 6 24 6Z"
          fill={colors.accent}
        />
        <Path d="M19.5 37.5a4.5 4.5 0 0 0 9 0" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" fill="none" />
        {active && <Circle cx={36} cy={11} r={6} fill="#4C9A6A" stroke={colors.accentSoft} strokeWidth={3} />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 80, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
  bellWrap: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 28, marginTop: 14, textAlign: 'center' },
  lead: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 480 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  cta: { borderRadius: 20, padding: 20 },
  ctaTitle: { fontFamily: serif, fontSize: 22 },
  ctaButton: { marginTop: 16, borderRadius: 24, paddingVertical: 13, alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flash: { marginTop: 10, fontWeight: '600', textAlign: 'center' },
  clock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  time: { fontFamily: serif, fontSize: 52, lineHeight: 60, fontVariant: ['tabular-nums'] },
  round: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18, justifyContent: 'center' },
  preset: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 92 },
  bubble: { flexDirection: 'row', gap: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  appIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  toggleIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: 24, alignItems: 'center' },
  foot: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 28 },
});
