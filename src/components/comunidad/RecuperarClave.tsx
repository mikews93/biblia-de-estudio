import { Link, Stack, router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, LockIcon } from '@/components/icons';
import { forgotPassword, resetLinkEmail, resetPassword } from '@/lib/comunidad';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { KeyIcon } from './icons';
import { Button, Field, text, useAction } from './ui';

/**
 * «¿Olvidaste tu contraseña?» (api/_recuperar.ts). En /recuperar se pide el enlace con el correo; el enlace del correo
 * abre /recuperar/<enlace>, donde se elige la nueva y se entra. Mismo aspecto que /entrar (AccountForm).
 */
export function PedirEnlace() {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = () => {
    if (!valid || busy) return;
    run(async () => {
      await forgotPassword(email);
      setSent(email.trim().toLowerCase());
    });
  };

  return (
    <Page
      colors={colors}
      icon={<KeyIcon color={colors.accent} size={32} />}
      title={sent ? 'Revisa tu correo' : '¿Olvidaste tu contraseña?'}
      subtitle={
        sent
          ? 'Si hay una cuenta con ese correo, te llegó un enlace para elegir una contraseña nueva.'
          : 'Escribe el correo de tu cuenta y te enviamos un enlace para elegir una nueva.'
      }
    >
      {sent ? (
        <View style={{ gap: 14 }}>
          <View style={[styles.sentTo, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Enviado a</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} selectable>
              {sent}
            </Text>
          </View>
          <Text style={[text.small, { color: colors.muted, lineHeight: 20 }]}>
            El enlace sirve una vez y vence en una hora. Si no lo ves en unos minutos, busca en «Spam» o «Promociones».
          </Text>
          <Button label="Volver a entrar" onPress={() => navigate(() => router.replace('/entrar'), 'back')} />
          <Pressable onPress={() => setSent(null)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center' }}>
            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>Usar otro correo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
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
            returnKeyType="send"
            onSubmitEditing={submit}
            autoFocus
          />
          <Button label="Enviar el enlace" onPress={submit} busy={busy} disabled={!valid} />
          {error ? <ErrorNote colors={colors}>{error}</ErrorNote> : null}
          <Link href="/entrar" replace style={{ color: colors.accent, fontWeight: '600', fontSize: 14, textAlign: 'center' }}>
            Ya la recordé
          </Link>
        </View>
      )}
    </Page>
  );
}

export function ElegirClave({ enlace }: { enlace: string }) {
  const colors = useColors();
  const [correo, setCorreo] = useState<string | null>(null);
  const [vencido, setVencido] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const { busy, error, run } = useAction();
  const longEnough = password.length >= 8;

  useEffect(() => {
    resetLinkEmail(enlace)
      .then((r) => setCorreo(r.correo))
      .catch((e: Error) => setVencido(e.message));
  }, [enlace]);

  const submit = () => {
    if (!longEnough || busy) return;
    run(async () => {
      await resetPassword(enlace, password);
      navigate(() => router.replace('/cuenta'), 'forward');
    });
  };

  if (vencido) {
    return (
      <Page colors={colors} icon={<LockIcon color={colors.accent} size={30} />} title="Este enlace ya no sirve" subtitle={vencido}>
        <Button label="Pedir un enlace nuevo" onPress={() => navigate(() => router.replace('/recuperar'), 'forward')} />
      </Page>
    );
  }
  if (!correo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
      </View>
    );
  }

  return (
    <Page
      colors={colors}
      icon={<KeyIcon color={colors.accent} size={32} />}
      title="Elige una contraseña nueva"
      subtitle={`Para ${correo}. Al guardarla entras en este dispositivo y se cierra la sesión en los demás.`}
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Field
            label="Contraseña nueva"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Elige una contraseña"
            returnKeyType="go"
            onSubmitEditing={submit}
            autoFocus
            trailing={
              <Pressable onPress={() => setShow((s) => !s)} hitSlop={8} style={styles.show} accessibilityRole="button">
                <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>{show ? 'Ocultar' : 'Mostrar'}</Text>
              </Pressable>
            }
          />
          <View style={styles.hint}>
            <View
              style={[
                styles.check,
                longEnough ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.border },
              ]}
            >
              {longEnough && <CheckIcon color={colors.surface} size={12} strokeWidth={2.6} />}
            </View>
            <Text style={{ color: longEnough ? colors.text : colors.muted, fontSize: 13 }}>Al menos 8 caracteres</Text>
          </View>
        </View>
        <Button label="Guardar y entrar" onPress={submit} busy={busy} disabled={!longEnough} />
        {error ? <ErrorNote colors={colors}>{error}</ErrorNote> : null}
      </View>
    </Page>
  );
}

function Page({
  colors,
  icon,
  title,
  subtitle,
  children,
}: {
  colors: Colors;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '' }} />
      <Appear style={styles.hero}>
        <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>{icon}</View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[text.body, styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
      </Appear>
      <Appear delay={80}>
        <View
          style={[
            styles.card,
            !isDark(colors) && { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' },
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {children}
        </View>
      </Appear>
    </ScrollView>
  );
}

function ErrorNote({ colors, children }: { colors: Colors; children: string }) {
  return (
    <View style={[styles.error, { backgroundColor: colors.accentSoft, borderLeftColor: colors.accent }]} accessibilityRole="alert">
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 64, maxWidth: 460, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 24, marginTop: 16 },
  emblem: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontFamily: serif, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 360,
    ...(Platform.OS === 'web' ? ({ textWrap: 'balance' } as object) : null),
  },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  sentTo: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  show: { paddingHorizontal: 12, paddingVertical: 8 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 2 },
  check: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  error: { borderRadius: 10, borderLeftWidth: 3, paddingHorizontal: 14, paddingVertical: 10 },
});
