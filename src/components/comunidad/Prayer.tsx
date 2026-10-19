import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, PrayIcon } from '@/components/icons';
import { Peticion, ago, api } from '@/lib/comunidad';
import { useColors } from '@/lib/theme';

import { confirm } from './confirm';
import { Button, ErrorText, Field, IconText, SectionTitle, text, useAction } from './ui';

/** Peticiones de oración del grupo. En vez de «me gusta», cada quien dice «estoy orando». */
export default function Prayer({ group }: { group: string }) {
  const colors = useColors();
  const [items, setItems] = useState<Peticion[] | null>(null);
  const [draft, setDraft] = useState('');
  const { busy, error, run } = useAction();

  const load = useCallback(() => {
    api<{ peticiones: Peticion[] }>('peticiones', { grupo: group })
      .then((r) => setItems(r.peticiones))
      .catch(() => setItems([]));
  }, [group]);

  useEffect(load, [load]);

  const add = () =>
    run(async () => {
      await api('nuevaPeticion', { grupo: group, texto: draft });
      setDraft('');
      load();
    });

  const toggle = async (p: Peticion) => {
    // Respuesta inmediata en pantalla; el servidor confirma al recargar.
    setItems((list) =>
      list?.map((x) => (x.id === p.id ? { ...x, yoOrando: !p.yoOrando, orando: x.orando + (p.yoOrando ? -1 : 1) } : x)) ?? null,
    );
    await api('orar', { peticion: p.id, orando: !p.yoOrando }).catch(() => {});
    load();
  };

  const answered = async (p: Peticion) => {
    await api('editarPeticion', { peticion: p.id, respondida: !p.respondida }).catch(() => {});
    load();
  };

  const remove = async (p: Peticion) => {
    if (!(await confirm('¿Borrar esta petición?', 'Se borrará para todo el grupo.', 'Borrar'))) return;
    await api('editarPeticion', { peticion: p.id, borrar: true }).catch(() => {});
    load();
  };

  const open = items?.filter((p) => !p.respondida) ?? [];
  const done = items?.filter((p) => p.respondida) ?? [];

  const row = (p: Peticion) => (
    <View key={p.id} style={[styles.item, { borderColor: colors.border }]}>
      <Text style={[text.body, { color: colors.text }]}>{p.texto}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        {p.autor} · {ago(p.creado)}
      </Text>
      <View style={styles.actions}>
        {!p.respondida && (
          <Pressable
            onPress={() => toggle(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: p.yoOrando }}
            style={[styles.pray, { borderColor: colors.accent }, p.yoOrando && { backgroundColor: colors.accent }]}
          >
            <IconText icon={p.yoOrando ? CheckIcon : PrayIcon} color={p.yoOrando ? colors.surface : colors.accent} size={14} gap={5}>
              <Text style={{ color: p.yoOrando ? colors.surface : colors.accent, fontWeight: '700', fontSize: 13 }}>Estoy orando</Text>
            </IconText>
          </Pressable>
        )}
        <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>
          {p.orando > 0 ? `${p.orando} ${p.orando === 1 ? 'persona ora' : 'personas oran'} por esto` : ''}
        </Text>
        {p.mia && (
          <>
            <Pressable onPress={() => answered(p)} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                {p.respondida ? 'Reabrir' : 'Dios respondió'}
              </Text>
            </Pressable>
            <Pressable onPress={() => remove(p)} hitSlop={8}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Borrar</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ gap: 10 }}>
      <Field value={draft} onChangeText={setDraft} multiline maxLength={500} placeholder="¿Por qué podemos orar contigo?" />
      <Button label="Compartir petición" onPress={add} busy={busy} disabled={!draft.trim()} />
      <ErrorText>{error}</ErrorText>

      {items === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : items.length === 0 ? (
        <Text style={[text.body, { color: colors.muted }]}>Todavía no hay peticiones. Solo las ve tu grupo.</Text>
      ) : (
        <>
          {open.map(row)}
          {done.length > 0 && (
            <>
              <SectionTitle>Oraciones respondidas</SectionTitle>
              {done.map(row)}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  pray: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
});
