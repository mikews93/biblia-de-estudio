import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Button, ErrorText, Field, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { deleteAccount, protectAccount, rename, signOut, useAccount } from '@/lib/comunidad';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function AccountScreen() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const nameAction = useAction();
  const loginAction = useAction();
  const deleteAction = useAction();

  useEffect(() => {
    if (usuario) {
      setName(usuario.nombre);
      setEmail(usuario.correo ?? '');
    }
  }, [usuario?.id]);

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2000);
  };

  if (ready && !usuario) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Stack.Screen options={{ title: 'Tu cuenta' }} />
        <Welcome />
      </ScrollView>
    );
  }

  const out = async () => {
    const msg = usuario?.correo
      ? 'Podrás volver a entrar con tu correo y tu contraseña.'
      : 'Tu cuenta no tiene correo: si sales, no podrás volver a entrar en ella.';
    if (!(await confirm('¿Cerrar sesión en este dispositivo?', msg, 'Cerrar sesión'))) return;
    await signOut();
    navigate(() => router.replace('/comunidades'), 'back');
  };

  const remove = async () => {
    const ok = await confirm(
      '¿Borrar tu cuenta?',
      'Se borran tu nombre, tus notas, tus peticiones y tus lecturas compartidas, y sales de todos tus grupos. No se puede deshacer.',
      'Borrar cuenta',
    );
    if (!ok) return;
    if (await deleteAction.run(deleteAccount)) navigate(() => router.replace('/comunidades'), 'back');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Tu cuenta' }} />

      <Field label="Tu nombre en los grupos" value={name} onChangeText={setName} maxLength={40} />
      <Button
        label="Guardar nombre"
        kind="outline"
        onPress={() => nameAction.run(() => rename(name)).then((ok) => ok && flash('Nombre guardado'))}
        busy={nameAction.busy}
        disabled={!name.trim() || name.trim() === usuario?.nombre}
        style={{ marginTop: 10 }}
      />
      <ErrorText>{nameAction.error}</ErrorText>

      <SectionTitle>Entrar desde otro dispositivo</SectionTitle>
      <Text style={[text.body, { color: colors.text, marginBottom: 12 }]}>
        {usuario?.correo
          ? `Entras con ${usuario.correo}. Puedes cambiar el correo o la contraseña.`
          : 'Añade un correo y una contraseña para abrir tu cuenta en otro teléfono o en el navegador.'}
      </Text>
      <View style={{ gap: 10 }}>
        <Field
          label="Correo"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label={usuario?.correo ? 'Contraseña nueva' : 'Contraseña'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="Al menos 8 caracteres"
        />
        <Button
          label="Guardar correo y contraseña"
          onPress={() =>
            loginAction.run(() => protectAccount(email, password)).then((ok) => {
              if (ok) {
                setPassword('');
                flash('Listo: ya puedes entrar desde otro dispositivo');
              }
            })
          }
          busy={loginAction.busy}
          disabled={!email.trim() || password.length < 8}
        />
        <ErrorText>{loginAction.error}</ErrorText>
      </View>
      {saved && <Text style={{ color: colors.accent, marginTop: 12, fontWeight: '600' }}>{saved}</Text>}

      <SectionTitle>Sesión</SectionTitle>
      <View style={styles.row}>
        <Button label="Cerrar sesión" kind="quiet" onPress={out} />
        <Button label="Borrar mi cuenta" kind="quiet" onPress={remove} busy={deleteAction.busy} />
      </View>
      <ErrorText>{deleteAction.error}</ErrorText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
