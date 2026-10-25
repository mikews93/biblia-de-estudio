import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, HeartIcon, PrayIcon } from '@/components/icons';
import { Peticion, ago, api } from '@/lib/comunidad';
import { autorVisible } from '@/lib/pedirOracion';
import { useColors } from '@/lib/theme';

import { confirm } from './confirm';
import { ComponerPeticion, EnviarAnimo, MisAnimos } from './PedirOracion';
import { IconText, SectionTitle, text } from './ui';

/**
 * Peticiones de oración del grupo. En vez de «me gusta», cada quien dice «estoy orando» y puede enviar un ánimo que
 * solo lee quien pidió: no hay comentarios a la vista de todos, para que nadie exponga su dolor (src/lib/pedirOracion.ts).
 */
export default function Prayer({ group }: { group: string }) {
  const colors = useColors();
  const [items, setItems] = useState<Peticion[] | null>(null);
  const [animando, setAnimando] = useState<string | null>(null);
  const [viendo, setViendo] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ peticiones: Peticion[] }>('peticiones', { grupo: group })
      .then((r) => setItems(r.peticiones))
      .catch(() => setItems([]));
  }, [group]);

  useEffect(load, [load]);

  const toggle = async (p: Peticion) => {
    // Respuesta inmediata en pantalla; el servidor confirma al recargar.
    setItems((list) =>
      list?.map((x) => (x.id === p.id ? { ...x, yoOrando: !p.yoOrando, orando: x.orando + (p.yoOrando ? -1 : 1) } : x)) ?? null,
    );
    await api('orar', { peticion: p.id, orando: !p.yoOrando }).catch(() => {});
    load();
  };

  const edit = async (p: Peticion, cambio: Record<string, unknown>) => {
    await api('editarPeticion', { peticion: p.id, ...cambio }).catch(() => {});
    load();
  };

  const remove = async (p: Peticion) => {
    if (!(await confirm('¿Borrar esta petición?', 'Se borrará para todo el grupo, con sus ánimos.', 'Borrar'))) return;
    edit(p, { borrar: true });
  };

  const open = items?.filter((p) => !p.respondida) ?? [];
  const done = items?.filter((p) => p.respondida) ?? [];

  const row = (p: Peticion) => (
    <View key={p.id} style={[styles.item, { borderColor: colors.border }]} testID="peticion-grupo">
      <Text style={[text.body, { color: colors.text }]}>{p.texto}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        {p.mia ? (p.anonima ? 'Tú, sin tu nombre' : 'Tú') : autorVisible(p.autor)} · {ago(p.creado)}
      </Text>

      {p.mia && p.vencida && !p.respondida && (
        <View style={[styles.vencida, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>Pasó un mes: tu grupo ya no la ve.</Text>
          <Pressable onPress={() => edit(p, { renovar: true })} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Seguir pidiendo</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.actions}>
        {!p.respondida && !p.mia && (
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
        {!p.respondida && !p.mia && (
          <Pressable
            onPress={() => setAnimando(animando === p.id ? null : p.id)}
            accessibilityRole="button"
            style={[styles.pray, { borderColor: colors.border }]}
          >
            <IconText icon={p.yoAnime ? CheckIcon : HeartIcon} color={colors.warm} size={14} gap={5}>
              <Text style={{ color: colors.warm, fontWeight: '700', fontSize: 13 }}>{p.yoAnime ? 'Le enviaste ánimo' : 'Enviar ánimo'}</Text>
            </IconText>
          </Pressable>
        )}
        <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>
          {p.orando > 0 ? `${p.orando} ${p.orando === 1 ? 'persona ora' : 'personas oran'} por esto` : ''}
        </Text>
        {p.mia && (
          <>
            <Pressable onPress={() => edit(p, { respondida: !p.respondida })} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{p.respondida ? 'Reabrir' : 'Dios respondió'}</Text>
            </Pressable>
            <Pressable onPress={() => remove(p)} hitSlop={8}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Borrar</Text>
            </Pressable>
          </>
        )}
      </View>

      {p.mia && !!p.animos && (
        <Pressable onPress={() => setViendo(viendo === p.id ? null : p.id)} hitSlop={6} style={{ marginTop: 10 }} accessibilityRole="button">
          <IconText icon={HeartIcon} color={colors.warm} size={14} gap={6}>
            <Text style={{ color: colors.warm, fontWeight: '700', fontSize: 13 }}>
              {viendo === p.id ? 'Ocultar' : `${p.animos === 1 ? 'Te enviaron un ánimo' : `Te enviaron ${p.animos} ánimos`} ›`}
            </Text>
          </IconText>
        </Pressable>
      )}
      {viendo === p.id && <MisAnimos peticion={p.id} />}
      {animando === p.id && (
        <EnviarAnimo
          peticion={p.id}
          onCancelar={() => setAnimando(null)}
          onEnviado={() => {
            setAnimando(null);
            load();
          }}
        />
      )}
    </View>
  );

  return (
    <View style={{ gap: 10 }}>
      <ComponerPeticion grupo={group} boton="Compartir petición" onEnviada={load} />

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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  pray: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  vencida: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 10 },
});
