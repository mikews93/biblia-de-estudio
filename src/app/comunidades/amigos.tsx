import * as Clipboard from 'expo-clipboard';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import Welcome from '@/components/comunidad/Welcome';
import { Avatar, Button, Card, ErrorText, Field, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { shareMessage } from '@/lib/compartir';
import { useAccount } from '@/lib/comunidad';
import { PersonaBreve, Red, answerFriend, askFriend, friendUrl, network, removeFriend, setShareReadings, unblock } from '@/lib/social';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Tus amigos: tu código para que te agreguen, solicitudes, sugerencias de tus grupos y la lista. */
export default function Amigos() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [red, setRed] = useState<Red | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const add = useAction();

  const load = useCallback(() => {
    network()
      .then(setRed)
      .catch((e) => add.setError(e.message));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (usuario) load();
    }, [usuario?.id, load]),
  );

  const go = (id: string) => navigate(() => router.push(`/comunidades/persona/${id}`), 'forward');
  const act = (fn: () => Promise<unknown>) => fn().catch(() => {}).then(load);

  if (!ready) return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
  if (!usuario) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Stack.Screen options={{ title: 'Amigos' }} />
        <Welcome intro="Crea tu cuenta para agregar amigos y ver lo que leen." />
      </ScrollView>
    );
  }

  const url = red ? friendUrl(red.codigo) : '';
  const message = `Agrégame como amigo para leer la Biblia juntos: ${url}`;
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);

  const copy = async () => {
    await Clipboard.setStringAsync(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const addByCode = () =>
    add.run(async () => {
      const r = await askFriend({ codigo: code });
      setCode('');
      load();
      go(r.id);
    });

  const person = (p: PersonaBreve, right: React.ReactNode, note?: string) => (
    <View key={p.id} style={[styles.row, { borderColor: colors.border }]}>
      <Pressable onPress={() => go(p.id)} style={styles.who} accessibilityRole="link">
        <Avatar name={p.nombre} foto={p.foto} racha={p.racha} servicio={p.servicio} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{p.nombre}</Text>
          {note && <Text style={{ color: colors.muted, fontSize: 12 }}>{note}</Text>}
        </View>
      </Pressable>
      {right}
    </View>
  );

  const small = (label: string, onPress: () => void, primary?: boolean) => (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.small, primary ? { backgroundColor: colors.accent } : { borderColor: colors.border, borderWidth: 1 }]}
      accessibilityRole="button"
    >
      <Text style={{ color: primary ? colors.surface : colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Amigos' }} />

      {!red ? (
        <>
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
          <ErrorText>{add.error}</ErrorText>
        </>
      ) : (
        <>
          <Card>
            <Text style={[text.body, { color: colors.text, fontWeight: '700' }]}>Tu código de amistad</Text>
            <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>
              Compártelo con quien quieras: al abrir tu enlace te puede agregar.
            </Text>
            <Text style={[styles.code, { color: colors.accent }]} selectable>
              {red.codigo}
            </Text>
            <View style={styles.buttons}>
              <Button label={copied ? 'Enlace copiado' : 'Copiar enlace'} kind="outline" onPress={copy} style={{ flex: 1 }} />
              {canShare && <Button label="Compartir" onPress={() => shareMessage(message)} style={{ flex: 1 }} />}
            </View>
          </Card>

          <SectionTitle>Agregar con un código</SectionTitle>
          <View style={{ gap: 10 }}>
            <Field
              value={code}
              onChangeText={setCode}
              placeholder="Código de tu amigo"
              autoCapitalize="characters"
              onSubmitEditing={addByCode}
              style={{ letterSpacing: 2 }}
            />
            <Button label="Agregar" onPress={addByCode} busy={add.busy} disabled={!code.trim()} />
            <ErrorText>{add.error}</ErrorText>
          </View>

          {red.recibidas.length > 0 && (
            <>
              <SectionTitle>Quieren ser tus amigos</SectionTitle>
              {red.recibidas.map((p) =>
                person(
                  p,
                  <View style={styles.buttons}>
                    {small('Ahora no', () => act(() => answerFriend(p.id, false)))}
                    {small('Aceptar', () => act(() => answerFriend(p.id, true)), true)}
                  </View>,
                ),
              )}
            </>
          )}

          {red.sugerencias.length > 0 && (
            <>
              <SectionTitle>De tus grupos</SectionTitle>
              {red.sugerencias.map((p) => person(p, small('Agregar', () => act(() => askFriend({ usuario: p.id })), true), p.grupo))}
            </>
          )}

          <SectionTitle>Tus amigos ({red.amigos.length})</SectionTitle>
          {red.amigos.length === 0 ? (
            <Text style={[text.body, { color: colors.muted }]}>
              Todavía no tienes amigos aquí. Comparte tu código o agrega a alguien de tus grupos.
            </Text>
          ) : (
            red.amigos.map((p) => person(p, null))
          )}

          {red.enviadas.length > 0 && (
            <>
              <SectionTitle>Esperando respuesta</SectionTitle>
              {red.enviadas.map((p) => person(p, small('Cancelar', () => act(() => removeFriend(p.id)))))}
            </>
          )}

          {(red.bloqueadas?.length ?? 0) > 0 && (
            <>
              <SectionTitle>Personas bloqueadas</SectionTitle>
              {red.bloqueadas!.map((p) => person(p, small('Desbloquear', () => act(() => unblock(p.id)))))}
            </>
          )}

          <SectionTitle>Privacidad</SectionTitle>
          <View style={[styles.row, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Mostrar a mis amigos lo que leo</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                Cuando terminas un capítulo, tus amigos lo ven en su muro. Nadie más.
              </Text>
            </View>
            <Switch
              value={red.compartirLecturas}
              onValueChange={(v) => {
                setRed({ ...red, compartirLecturas: v });
                setShareReadings(v).catch(load);
              }}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  code: { fontSize: 28, fontWeight: '700', letterSpacing: 6, textAlign: 'center', marginVertical: 16, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  small: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
});
