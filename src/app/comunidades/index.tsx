import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Welcome from '@/components/comunidad/Welcome';
import { Button, Card, Field, Meter, SectionTitle, text } from '@/components/comunidad/ui';
import { ResumenGrupo, tipoLabel, useAccount } from '@/lib/comunidad';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function Comunidades() {
  const colors = useColors();
  const { ready, usuario, grupos } = useAccount();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');

  const join = () => {
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean) navigate(() => router.push(`/unirse/${clean}`), 'forward');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen
        options={{
          title: 'Comunidades',
          headerRight: () =>
            usuario ? (
              <Pressable onPress={() => navigate(() => router.push('/comunidades/cuenta'), 'forward')} hitSlop={8} style={{ marginRight: 16 }}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Tu cuenta</Text>
              </Pressable>
            ) : null,
        }}
      />

      {!ready ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : !usuario ? (
        <>
          <Text style={[text.title, { color: colors.text, marginBottom: 12 }]}>Leer juntos</Text>
          <Welcome />
        </>
      ) : (
        <>
          <Text style={[text.title, { color: colors.text }]}>Hola, {usuario.nombre}</Text>

          <SectionTitle>Tus grupos</SectionTitle>
          {grupos === null ? (
            <ActivityIndicator color={colors.accent} />
          ) : grupos.length === 0 ? (
            <Text style={[text.body, { color: colors.muted }]}>
              Todavía no estás en ningún grupo. Crea uno e invita a tu célula o a tu familia, o únete con el código que te
              compartieron.
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {grupos.map((g) => (
                <GroupCard key={g.id} group={g} />
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Button label="Crear un grupo" onPress={() => navigate(() => router.push('/comunidades/nuevo'), 'forward')} />
            {joining ? (
              <View style={styles.joinRow}>
                <Field
                  value={code}
                  onChangeText={setCode}
                  placeholder="Código de invitación"
                  autoCapitalize="characters"
                  autoFocus
                  onSubmitEditing={join}
                  style={{ letterSpacing: 2 }}
                />
                <Button label="Unirme" onPress={join} disabled={!code.trim()} />
              </View>
            ) : (
              <Button label="Unirme con un código" kind="outline" onPress={() => setJoining(true)} />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function GroupCard({ group }: { group: ResumenGrupo }) {
  const colors = useColors();
  const reading = group.lectura;
  return (
    <Pressable onPress={() => navigate(() => router.push(`/comunidades/${group.id}`), 'forward')} accessibilityRole="link">
      <Card>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
          {tipoLabel(group.tipo).toUpperCase()} · {group.miembros} {group.miembros === 1 ? 'PERSONA' : 'PERSONAS'}
        </Text>
        <Text style={[styles.groupName, { color: colors.text }]}>{group.nombre}</Text>
        {reading?.estado === 'activo' && (
          <Text style={{ color: colors.text, marginTop: 6 }}>
            Hoy: {reading.nombre} {reading.capitulos.join('–')}
          </Text>
        )}
        {reading?.estado === 'terminado' && (
          <Text style={{ color: colors.accent, marginTop: 6 }}>Terminaron {reading.nombre} juntos</Text>
        )}
        <View style={{ marginTop: 12 }}>
          <Meter value={group.leyeronHoy} max={group.miembros} colors={colors} />
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
            {group.leyeronHoy === 0
              ? 'Nadie ha leído todavía hoy'
              : `${group.leyeronHoy} de ${group.miembros} ${reading?.estado === 'activo' ? 'leyeron la lectura de hoy' : 'leyeron hoy'}`}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  groupName: { fontFamily: serif, fontSize: 21, fontWeight: '700', marginTop: 4 },
  actions: { gap: 12, marginTop: 28 },
  joinRow: { gap: 10 },
});
