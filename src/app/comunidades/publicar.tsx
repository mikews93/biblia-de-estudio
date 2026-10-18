import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Welcome from '@/components/comunidad/Welcome';
import { Button, Chips, ErrorText, Field, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { useAccount } from '@/lib/comunidad';
import { Audiencia, publish } from '@/lib/social';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Kind = 'pregunta' | 'reflexion';

/** Escribir una pregunta para la comunidad o algo que aprendiste. */
export default function Publicar() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [kind, setKind] = useState<Kind>('pregunta');
  const [audience, setAudience] = useState<Audiencia>('todos');
  const [draft, setDraft] = useState('');
  const { busy, error, run } = useAction();

  const send = () =>
    run(async () => {
      const { id } = await publish({ tipo: kind, audiencia: audience, texto: draft });
      navigate(() => router.replace(`/comunidades/publicacion/${id}`), 'forward');
    });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Publicar' }} />
      {ready && !usuario ? (
        <Welcome intro="Crea tu cuenta para publicar en la comunidad." />
      ) : (
        <View style={{ gap: 14 }}>
          <Chips
            options={[
              { value: 'pregunta', label: 'Una pregunta' },
              { value: 'reflexion', label: 'Algo que aprendí' },
            ]}
            value={kind}
            onChange={setKind}
          />
          <Field
            value={draft}
            onChangeText={setDraft}
            placeholder={
              kind === 'pregunta'
                ? '¿Qué quieres preguntar? Por ejemplo: ¿cómo entienden Juan 3:5?'
                : '¿Qué te enseñó Dios hoy en su Palabra?'
            }
            multiline
            autoFocus
            maxLength={1000}
            style={{ minHeight: 140 }}
          />
          <SectionTitle>¿Quién lo ve?</SectionTitle>
          <Chips
            options={[
              { value: 'todos', label: 'Toda la comunidad' },
              { value: 'amigos', label: 'Mis amigos' },
            ]}
            value={audience}
            onChange={setAudience}
          />
          <Button label="Publicar" onPress={send} busy={busy} disabled={!draft.trim()} style={{ marginTop: 10 }} />
          <ErrorText>{error}</ErrorText>
          <Text style={[text.small, { color: colors.muted }]}>
            Escribe con amor y respeto. Cualquiera puede reportar lo que no edifica.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
});
