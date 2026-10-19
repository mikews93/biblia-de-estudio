import { Link, Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { signIn, signUp, useAccount } from '@/lib/comunidad';
import { facebook, facebookAvailable, resumeFacebook } from '@/lib/perfil';
import { verseHref } from '@/lib/routes';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { DevicesIcon, FacebookLogo, OpenBookIcon, PeopleIcon, SparkIcon } from './icons';
import { Button, Field, text, useAction } from './ui';

type Mode = 'entrar' | 'registro';

// Un versículo de la RV1909 al pie de cada pantalla, tal como se lee en la app.
const VERSE: Record<Mode, { text: string; cite: string; href: string }> = {
  registro: {
    text: '¡Mirad cuán bueno y cuán delicioso es habitar los hermanos igualmente en uno!',
    cite: 'Salmo 133:1',
    href: verseHref('psa', 133, 1),
  },
  entrar: {
    text: 'He aquí, yo estoy á la puerta y llamo.',
    cite: 'Apocalipsis 3:20',
    href: verseHref('rev', 3, 20),
  },
};

const BENEFITS = [
  { Icon: SparkIcon, title: 'Estudia con IA', body: 'Te explica el pasaje, el griego y el hebreo, y te acompaña en el Taller.' },
  { Icon: PeopleIcon, title: 'Lee en compañía', body: 'Grupos de tu iglesia, célula o familia, amigos y oración.' },
  { Icon: DevicesIcon, title: 'En todos tus dispositivos', body: 'Entra con tu correo desde el teléfono o el navegador.' },
];

/** Vuelve a la pantalla que pidió la cuenta; si se abrió el enlace directo, a Comunidad. */
function leave() {
  navigate(() => (router.canGoBack() ? router.back() : router.replace('/comunidades')), 'back');
}

/** Pantallas propias de entrar (/entrar) y crear la cuenta (/registro). Leer la Biblia nunca las pide. */
export default function AccountForm({ mode }: { mode: Mode }) {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { busy, error, run } = useAction();
  const signingUp = mode === 'registro';
  const longEnough = password.length >= 8;
  const complete = signingUp ? name.trim() && email.trim() && longEnough : email.trim() && password;
  const verse = VERSE[mode];
  const [fbReady, setFbReady] = useState(false);
  const fb = useAction();

  useEffect(() => {
    facebookAvailable().then(setFbReady);
    // Al volver de Facebook en esta misma pestaña (si el navegador no dejó abrir otra ventana).
    fb.run(async () => {
      if (await resumeFacebook()) leave();
    });
  }, []);

  const withFacebook = () => fb.run(async () => (await facebook('entrar')) && leave());

  const submit = () => {
    if (!complete || busy) return;
    run(() => (signingUp ? signUp(name, email, password) : signIn(email, password))).then((ok) => ok && leave());
  };

  const toggle = (
    <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8} style={styles.show} accessibilityRole="button">
      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '' }} />

      <Appear style={styles.hero}>
        <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
          <OpenBookIcon color={colors.accent} size={34} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{signingUp ? 'Crea tu cuenta' : 'Qué bueno verte'}</Text>
        <Text style={[text.body, styles.subtitle, { color: colors.muted }]}>
          {signingUp
            ? 'Es gratis. Leer la Biblia nunca necesita cuenta; con ella estudias con IA y lees en compañía.'
            : 'Entra con tu correo y tu contraseña para seguir donde lo dejaste.'}
        </Text>
      </Appear>

      <Appear delay={60}>
        <Tabs mode={mode} colors={colors} />
      </Appear>

      <Appear delay={120}>
        <View style={[styles.card, cardShadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {ready && usuario && !busy ? (
            <View style={{ gap: 14, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={[text.body, { color: colors.text, textAlign: 'center' }]}>
                Ya entraste como <Text style={{ fontWeight: '700' }}>{usuario.nombre}</Text>.
              </Text>
              <Button label="Continuar" onPress={leave} style={{ alignSelf: 'stretch' }} />
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {signingUp && (
                <Field
                  label="Tu nombre"
                  value={name}
                  onChangeText={setName}
                  placeholder="Así te verán tus grupos y amigos"
                  autoComplete="name"
                  textContentType="name"
                  maxLength={40}
                  returnKeyType="next"
                />
              )}
              <Field
                label="Correo"
                value={email}
                onChangeText={setEmail}
                placeholder="tu@correo.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="next"
              />
              <View style={{ gap: 8 }}>
                <Field
                  label="Contraseña"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={signingUp ? 'new-password' : 'current-password'}
                  textContentType={signingUp ? 'newPassword' : 'password'}
                  placeholder={signingUp ? 'Elige una contraseña' : 'Tu contraseña'}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  trailing={toggle}
                />
                {signingUp && (
                  <View style={styles.hint}>
                    <View
                      style={[
                        styles.check,
                        longEnough
                          ? { backgroundColor: colors.accent, borderColor: colors.accent }
                          : { borderColor: colors.border },
                      ]}
                    >
                      {longEnough && <Text style={{ color: colors.surface, fontSize: 10, fontWeight: '800' }}>✓</Text>}
                    </View>
                    <Text style={{ color: longEnough ? colors.text : colors.muted, fontSize: 13 }}>Al menos 8 caracteres</Text>
                  </View>
                )}
              </View>
              <Button
                label={signingUp ? 'Crear mi cuenta' : 'Entrar'}
                onPress={submit}
                busy={busy}
                disabled={!complete}
                style={{ marginTop: 4 }}
              />
              {error || fb.error ? (
                <View style={[styles.error, { backgroundColor: colors.accentSoft, borderLeftColor: colors.accent }]} accessibilityRole="alert">
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{error || fb.error}</Text>
                </View>
              ) : null}
              {fbReady && (
                <>
                  <View style={styles.or}>
                    <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                    <Text style={{ color: colors.muted, fontSize: 13 }}>o</Text>
                    <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                  </View>
                  <Pressable
                    // Se puede volver a tocar mientras espera, por si se cerró la ventana de Facebook.
                    onPress={withFacebook}
                    accessibilityRole="button"
                    style={[styles.facebook, { borderColor: colors.border, backgroundColor: colors.background }, fb.busy && { opacity: 0.6 }]}
                  >
                    {fb.busy ? <ActivityIndicator color={colors.accent} /> : <FacebookLogo size={22} />}
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Continuar con Facebook</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </Appear>

      {signingUp && (
        <Appear delay={180} style={styles.benefits}>
          {BENEFITS.map(({ Icon, title, body }) => (
            <View key={title} style={styles.benefit}>
              <View style={[styles.benefitIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon color={colors.accent} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
                <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{body}</Text>
              </View>
            </View>
          ))}
        </Appear>
      )}

      <Appear delay={240} style={styles.footer}>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <Text style={[styles.verse, { color: colors.text }]}>«{verse.text}»</Text>
        <Link href={verse.href as never} style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>
          {verse.cite} · RV1909
        </Link>
      </Appear>
    </ScrollView>
  );
}

/** Selector «Crear cuenta | Entrar»: cambia de pantalla sin apilarla. */
function Tabs({ mode, colors }: { mode: Mode; colors: Colors }) {
  const tab = (to: Mode, label: string) => {
    const on = mode === to;
    return (
      <Pressable
        onPress={() => !on && navigate(() => router.replace(`/${to}`), 'fade')}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={[
          styles.tab,
          on &&
            (isDark(colors)
              ? { backgroundColor: colors.accentSoft }
              : { backgroundColor: colors.surface, boxShadow: '0 1px 3px rgba(60, 40, 20, 0.12)' }),
        ]}
      >
        <Text style={{ color: on ? colors.text : colors.muted, fontWeight: on ? '700' : '600', fontSize: 14 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.tabs, { backgroundColor: isDark(colors) ? colors.surface : colors.accentSoft }]} accessibilityRole="tablist">
      {tab('registro', 'Crear cuenta')}
      {tab('entrar', 'Entrar')}
    </View>
  );
}

const cardShadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' };

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 64, maxWidth: 460, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 24 },
  emblem: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontFamily: serif, fontSize: 30, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: 8, maxWidth: 360 },
  tabs: { flexDirection: 'row', borderRadius: 24, padding: 4, marginBottom: 16 },
  tab: { flex: 1, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  show: { paddingHorizontal: 12, paddingVertical: 8 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 2 },
  check: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  facebook: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 24,
    minHeight: 46,
    paddingHorizontal: 20,
  },
  error: { borderRadius: 10, borderLeftWidth: 3, paddingHorizontal: 14, paddingVertical: 10 },
  benefits: { gap: 18, marginTop: 28, paddingHorizontal: 4 },
  benefit: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  benefitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', marginTop: 36, gap: 10 },
  rule: { width: 40, height: 2, borderRadius: 1, marginBottom: 6 },
  verse: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 360,
    ...(Platform.OS === 'web' ? { textWrap: 'balance' } : null),
  },
});
