import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, useAction } from '@/components/comunidad/ui';
import { LiveIcon } from '@/components/icons';
import type { Book } from '@/lib/data';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { type Sala, type SalaDelGrupo, vivoApi } from '@/lib/vivo';

import { LIVE_RED, Pulse, vivoText } from './piezas';

/**
 * En la pantalla del grupo: «En vivo ahora» si alguien guía una lectura (se revisa cada 15 s), o la invitación
 * a empezar una con la lectura de hoy.
 */
export default function EnVivoGrupo({ group, books, passage }: { group: string; books: Book[]; passage?: { book: string; chapter: number } }) {
  const colors = useColors();
  const [sala, setSala] = useState<SalaDelGrupo | null | undefined>(undefined);
  const { busy, error, run } = useAction();

  useFocusEffect(
    useCallback(() => {
      let gone = false;
      const check = () =>
        vivoApi<{ sala: SalaDelGrupo | null }>('salaDelGrupo', { grupo: group })
          .then((r) => !gone && setSala(r.sala))
          .catch(() => !gone && setSala((s) => s ?? null));
      check();
      const t = setInterval(check, 15_000);
      return () => {
        gone = true;
        clearInterval(t);
      };
    }, [group]),
  );

  const enter = (codigo: string) => navigate(() => router.push(`/vivo/${codigo}`), 'forward');
  const start = () =>
    run(async () => {
      const p = passage ?? { book: 'jhn', chapter: 1 };
      const r = await vivoApi<Sala>('crearSala', { grupo: group, libro: p.book, capitulo: p.chapter });
      enter(r.sala.codigo);
    });

  if (sala === undefined) return null;

  if (sala) {
    const name = books.find((b) => b.id === sala.estado.libro)?.name ?? '';
    return (
      <Pressable
        onPress={() => enter(sala.codigo)}
        accessibilityRole="button"
        accessibilityLabel={`En vivo ahora: ${name} ${sala.estado.capitulo}. Entrar a la lectura`}
        style={({ pressed }) => [styles.live, { backgroundColor: colors.surface, borderColor: LIVE_RED }, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.liveHead}>
          <Pulse />
          <Text style={[vivoText.kicker, { color: LIVE_RED }]}>EN VIVO AHORA</Text>
        </View>
        <Text style={[styles.passage, { color: colors.text }]}>
          {name} {sala.estado.capitulo}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>
          Guía {sala.guia.split(' ')[0]} · {sala.presentes} {sala.presentes === 1 ? 'persona leyendo' : 'personas leyendo'}
        </Text>
        <View style={[styles.enter, { backgroundColor: LIVE_RED }]}>
          <LiveIcon color="#FFFFFF" size={17} strokeWidth={2} />
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Entrar a la lectura</Text>
        </View>
      </Pressable>
    );
  }

  const name = passage ? books.find((b) => b.id === passage.book)?.name : null;
  return (
    <View style={[styles.invite, { backgroundColor: colors.warmSoft }]}>
      <View style={styles.inviteRow}>
        <View style={[styles.icon, { backgroundColor: colors.surface }]}>
          <LiveIcon color={colors.warm} size={22} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.inviteTitle, { color: colors.text }]}>Leer juntos en vivo</Text>
          <Text style={{ color: colors.text, opacity: 0.8, fontSize: 14, lineHeight: 20, marginTop: 2 }}>
            En la reunión, pasas la hoja y todos la ven en su teléfono, con las dinámicas en pantalla.
          </Text>
        </View>
      </View>
      <Button
        label={name ? `Empezar con ${name} ${passage!.chapter}` : 'Empezar en vivo'}
        icon={LiveIcon}
        onPress={start}
        busy={busy}
        style={{ marginTop: 14 }}
      />
      <Pressable accessibilityRole="button" onPress={() => navigate(() => router.push(`/vivo?grupo=${group}`), 'forward')} style={{ alignSelf: 'center', marginTop: 10 }}>
        <Text style={{ color: colors.warm, fontWeight: '700', fontSize: 13.5 }}>Elegir otro pasaje</Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  live: { borderRadius: 18, borderWidth: 1.5, padding: 16, marginTop: 20 },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passage: { fontFamily: serif, fontSize: 24, fontWeight: '700', marginTop: 8 },
  enter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 24, paddingVertical: 12, marginTop: 14 },
  invite: { borderRadius: 18, padding: 16, marginTop: 20 },
  inviteRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  inviteTitle: { fontFamily: serif, fontSize: 19, fontWeight: '700' },
});
