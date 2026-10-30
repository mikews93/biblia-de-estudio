// Junto al evento en vivo: a qué grupos avisar cuando empieza. Quienes están en ellos reciben «empezó en vivo» con
// el enlace para seguirlo; si el evento ya empezó, al elegir un grupo se le avisa al momento.
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GroupTypeIcon } from '@/components/comunidad/MisGrupos';
import { ErrorText, useAction } from '@/components/comunidad/ui';
import { BellIcon, CheckIcon } from '@/components/icons';
import { useAccount } from '@/lib/comunidad';
import { type Evento, gruposEvento } from '@/lib/eventos';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function AvisarGrupos({ evento }: { evento: Evento }) {
  const colors = useColors();
  const { grupos } = useAccount();
  const [elegidos, setElegidos] = useState<string[]>(evento.grupos ?? []);
  const [guardando, setGuardando] = useState<string | null>(null);
  const { error, run } = useAction();
  const vivo = evento.estado === 'en-vivo';

  const cambiar = (id: string) => {
    const antes = elegidos;
    const nuevos = antes.includes(id) ? antes.filter((g) => g !== id) : [...antes, id];
    setElegidos(nuevos);
    setGuardando(id);
    run(async () => {
      try {
        const e = await gruposEvento(evento, nuevos);
        setElegidos(e.grupos ?? nuevos);
      } catch (err) {
        setElegidos(antes);
        throw err;
      } finally {
        setGuardando(null);
      }
    });
  };

  if (!grupos) return null;
  return (
    <View style={[styles.box, { backgroundColor: colors.background, borderColor: colors.border }]} testID="avisar-grupos">
      <View style={styles.head}>
        <BellIcon color={colors.warm} size={18} strokeWidth={2} />
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 }}>Avisar a mis grupos</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
        {grupos.length === 0
          ? 'Cuando estés en un grupo, podrás avisarle aquí que empezaste en vivo.'
          : vivo
            ? 'Ya estás en vivo: al elegir un grupo le llega el aviso ahora mismo.'
            : 'Cuando empieces en vivo, a quienes estén en los grupos que elijas les llega un aviso para seguirte.'}
      </Text>
      {grupos.length === 0 ? (
        <Pressable onPress={() => navigate(() => router.push('/grupos/nuevo'), 'forward')} hitSlop={6} accessibilityRole="link">
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Crear un grupo</Text>
        </Pressable>
      ) : (
        <View style={styles.chips}>
          {grupos.map((g) => {
            const on = elegidos.includes(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => cambiar(g.id)}
                disabled={guardando !== null}
                accessibilityRole="checkbox"
                aria-checked={on}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: on ? colors.warm : colors.border, backgroundColor: on ? colors.warmSoft : colors.surface },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {guardando === g.id ? (
                  <ActivityIndicator size="small" color={colors.warm} />
                ) : on ? (
                  <CheckIcon color={colors.warm} size={15} strokeWidth={2.2} />
                ) : (
                  <GroupTypeIcon tipo={g.tipo} color={colors.muted} size={15} />
                )}
                <Text style={{ color: colors.text, fontWeight: on ? '700' : '500', fontSize: 14 }} numberOfLines={1}>
                  {g.nombre}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 12, maxWidth: '100%' },
});
