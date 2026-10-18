import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { signIn, signUp } from '@/lib/comunidad';
import { useColors } from '@/lib/theme';

import { Button, ErrorText, Field, text, useAction } from './ui';

/** Crear la cuenta con solo un nombre, o entrar con correo y contraseña desde otro dispositivo. */
export default function Welcome({ intro }: { intro?: string }) {
  const colors = useColors();
  const [mode, setMode] = useState<'nueva' | 'entrar'>('nueva');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run, setError } = useAction();

  const switchTo = (m: typeof mode) => {
    setMode(m);
    setError(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[text.body, { color: colors.text }]}>
        {intro ??
          'Lee la Biblia en compañía: crea un grupo privado para tu iglesia, tu célula o tu familia, sigan un plan de lectura juntos y oren unos por otros.'}
      </Text>

      {mode === 'nueva' ? (
        <>
          <Field
            label="¿Cómo te llamamos en tus grupos?"
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            autoComplete="name"
            maxLength={40}
            onSubmitEditing={() => run(() => signUp(name))}
          />
          <Button label="Empezar" onPress={() => run(() => signUp(name))} busy={busy} disabled={!name.trim()} />
          <ErrorText>{error}</ErrorText>
          <Button label="Ya tengo cuenta" kind="quiet" onPress={() => switchTo('entrar')} />
          <Text style={[text.small, { color: colors.muted }]}>
            Solo verán tu nombre las personas de tus grupos. Después puedes añadir un correo para entrar desde otro
            dispositivo.
          </Text>
        </>
      ) : (
        <>
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
            autoComplete="current-password"
            onSubmitEditing={() => run(() => signIn(email, password))}
          />
          <Button label="Entrar" onPress={() => run(() => signIn(email, password))} busy={busy} disabled={!email || !password} />
          <ErrorText>{error}</ErrorText>
          <Button label="Crear una cuenta nueva" kind="quiet" onPress={() => switchTo('nueva')} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, alignSelf: 'stretch' },
});
