import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon, LiveIcon } from '@/components/icons';
import { ResumenGrupo, tipoLabel, useAccount } from '@/lib/comunidad';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import Welcome from './Welcome';
import { Button, Card, Field, Meter, text } from './ui';

/**
 * Planes de lectura en grupo: tus grupos con la lectura de hoy, crear uno o unirte con un código.
 * Vive en la pestaña Planes, junto a los planes personales.
 */
export default function GroupPlans() {
  const colors = useColors();
  const { ready, usuario, grupos } = useAccount();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');

  const join = () => {
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Los códigos de una lectura en vivo tienen 6 letras; los de un grupo, 8.
    if (clean.length === 6) navigate(() => router.push(`/vivo/${clean}`), 'forward');
    else if (clean) navigate(() => router.push(`/unirse/${clean}`), 'forward');
  };

  if (!ready) return <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />;
  if (!usuario) {
    return (
      <Welcome intro="Lee en compañía: crea un grupo privado para tu iglesia, tu célula o tu familia, sigan un plan de lectura juntos y oren unos por otros." />
    );
  }
  return (
    <View>
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
        <Button label="Crear un grupo" onPress={() => navigate(() => router.push('/grupos/nuevo'), 'forward')} />
        {joining ? (
          <View style={styles.joinRow}>
            <Field
              value={code}
              onChangeText={setCode}
              placeholder="Código del grupo o de la lectura en vivo"
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
        <Pressable
          onPress={() => navigate(() => router.push('/vivo'), 'forward')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.live, { backgroundColor: colors.warmSoft }, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.liveIcon, { backgroundColor: colors.surface }]}>
            <LiveIcon color={colors.warm} size={20} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Lectura en vivo</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>Guía la lectura de la reunión o entra con un código</Text>
          </View>
          <ChevronRightIcon color={colors.muted} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function GroupCard({ group }: { group: ResumenGrupo }) {
  const colors = useColors();
  const reading = group.lectura;
  return (
    <Pressable onPress={() => navigate(() => router.push(`/grupos/${group.id}`), 'forward')} accessibilityRole="link">
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
  groupName: { fontFamily: serif, fontSize: 21, fontWeight: '700', marginTop: 4 },
  actions: { gap: 12, marginTop: 28 },
  joinRow: { gap: 10 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, marginTop: 4 },
  liveIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
