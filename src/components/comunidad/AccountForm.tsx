import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { signIn, signUp, useAccount } from '@/lib/comunidad';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { Button, ErrorText, Field, text, useAction } from './ui';

/** Vuelve a la pantalla que pidió la cuenta; si se abrió el enlace directo, a Comunidad. */
function leave() {
  navigate(() => (router.canGoBack() ? router.back() : router.replace('/comunidades')), 'back');
}

function go(to: '/entrar' | '/registro') {
  navigate(() => router.replace(to), 'fade');
}

/** Pantallas propias de entrar (/entrar) y crear la cuenta (/registro). Leer la Biblia nunca las pide. */
export default function AccountForm({ mode }: { mode: 'entrar' | 'registro' }) {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  const signingUp = mode === 'registro';
  const title = signingUp ? 'Crea tu cuenta' : 'Entra a tu cuenta';

  const submit = () =>
    run(() => (signingUp ? signUp(name, email, password) : signIn(email, password))).then((ok) => ok && leave());
  const complete = signingUp ? name.trim() && email.trim() && password.length >= 8 : email.trim() && password;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '' }} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      {ready && usuario && !busy ? (
        <View style={{ gap: 12 }}>
          <Text style={[text.body, { color: colors.text }]}>Ya entraste como {usuario.nombre}.</Text>
          <Button label="Continuar" onPress={leave} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Text style={[text.body, { color: colors.muted }]}>
            {signingUp
              ? 'Leer y estudiar la Biblia no necesita cuenta. Con una cuenta gratuita puedes usar la IA, unirte a grupos, agregar amigos y publicar en la comunidad.'
              : 'Entra con el correo y la contraseña de tu cuenta.'}
          </Text>
          {signingUp && (
            <Field
              label="Tu nombre"
              value={name}
              onChangeText={setName}
              placeholder="Como te verán tus grupos y amigos"
              autoComplete="name"
              maxLength={40}
            />
          )}
          <Field
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            placeholder={signingUp ? 'Al menos 8 caracteres' : undefined}
            onSubmitEditing={() => complete && submit()}
          />
          <Button label={signingUp ? 'Crear cuenta' : 'Entrar'} onPress={submit} busy={busy} disabled={!complete} />
          <ErrorText>{error}</ErrorText>
          <Button
            label={signingUp ? '¿Ya tienes cuenta? Entra' : '¿No tienes cuenta? Créala gratis'}
            kind="quiet"
            onPress={() => go(signingUp ? '/entrar' : '/registro')}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 12, paddingBottom: 60, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontFamily: serif, fontSize: 28, fontWeight: '700', marginBottom: 12 },
});
