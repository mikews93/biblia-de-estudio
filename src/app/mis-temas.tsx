import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { SectionTitle, text } from '@/components/comunidad/ui';
import { CheckIcon, LockIcon } from '@/components/icons';
import { useOraciones } from '@/lib/oraciones';
import { temasVivos } from '@/lib/paraTi';
import { TEMAS, TemaId, temaPorId } from '@/lib/temas';
import { serif, useColors, useSettings } from '@/lib/theme';

/**
 * «Mis temas»: encender o apagar «Para ti» en Hoy, elegir a mano por qué estás orando estos días y ver (y quitar) lo
 * que el teléfono reconoce en el diario de oración. Nada de esto sale del dispositivo, salvo los ajustes de la cuenta.
 */
export default function MisTemas() {
  const colors = useColors();
  const { settings, update } = useSettings();
  const ajustes = settings.paraTi;
  const oraciones = useOraciones();
  const cambiar = (patch: Partial<typeof ajustes>) => update({ paraTi: { ...ajustes, ...patch } });

  // Lo que se reconoce en el diario, sin contar lo elegido a mano
  const reconocidos = useMemo(
    () => temasVivos(oraciones, { ...ajustes, temas: [] }, undefined, Infinity).filter((t) => !ajustes.temas.includes(t.tema.id)),
    [oraciones, ajustes],
  );

  const elegir = (id: TemaId) => {
    const on = ajustes.temas.includes(id);
    cambiar({
      temas: on ? ajustes.temas.filter((t) => t !== id) : [...ajustes.temas, id],
      ocultos: ajustes.ocultos.filter((t) => t !== id),
    });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Mis temas' }} />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>Para ti en Hoy</Text>
            <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
              Un versículo para lo que estás orando y un plan que te puede ayudar, debajo del versículo de todos.
            </Text>
          </View>
          <Switch
            value={ajustes.activo}
            onValueChange={(v) => cambiar({ activo: v })}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.surface}
            {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.surface } as object) : {})}
            accessibilityLabel="Para ti en Hoy"
          />
        </View>
      </Appear>

      <Appear delay={40}>
        <View style={[styles.privado, { backgroundColor: colors.accentSoft }]}>
          <LockIcon color={colors.accent} size={18} />
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }}>
            Se decide en tu teléfono. Tus oraciones no se envían a nadie para elegir nada, no guardamos tus temas en un servidor
            y no medimos cuánto tiempo pasas en la app.
          </Text>
        </View>
      </Appear>

      {ajustes.activo && (
        <>
          <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Preguntarme cómo sigo</Text>
              <Text style={[text.small, { color: colors.muted, marginTop: 4, lineHeight: 19 }]}>
                Cuando oras por una carga, Hoy te pregunta de vez en cuando cómo vas, como mucho una vez por semana, y te anima a
                hablarlo con alguien de confianza. Sin avisos y sin presión.
              </Text>
            </View>
            <Switch
              value={ajustes.acompanar !== false}
              onValueChange={(v) => cambiar({ acompanar: v })}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.surface}
              {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.surface } as object) : {})}
              accessibilityLabel="Preguntarme cómo sigo"
            />
          </View>

          <SectionTitle>¿Por qué estás orando estos días?</SectionTitle>
          <Text style={[text.small, { color: colors.muted, marginTop: -4, marginBottom: 12 }]}>
            Elige los que quieras. Pesan más que lo que el teléfono reconoce en tu diario.
          </Text>
          <View style={styles.temas}>
            {TEMAS.filter((t) => t.id !== 'gratitud').map((t) => {
              const on = ajustes.temas.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => elegir(t.id)}
                  style={({ pressed }) => [
                    styles.tema,
                    { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  {on && <CheckIcon color={colors.accent} size={15} strokeWidth={2.4} />}
                  <Text style={{ color: on ? colors.accent : colors.text, fontWeight: on ? '700' : '500', fontSize: 14 }}>{t.nombre}</Text>
                </Pressable>
              );
            })}
          </View>

          {reconocidos.length > 0 && (
            <>
              <SectionTitle>Lo que se reconoce en tu diario</SectionTitle>
              <View style={[styles.lista, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {reconocidos.map((t, i) => (
                  <View key={t.tema.id} style={[styles.fila, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t.tema.nombre}</Text>
                      {t.motivo.tipo !== 'elegido' && (
                        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                          «{t.motivo.titulo}»
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => cambiar({ ocultos: [...ajustes.ocultos, t.tema.id] })}
                      style={({ pressed }) => [styles.boton, { borderColor: colors.border }, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`No mostrar ${t.tema.nombre}`}
                    >
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>No mostrar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}

          {ajustes.ocultos.length > 0 && (
            <>
              <SectionTitle>No mostrar</SectionTitle>
              <View style={[styles.lista, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {ajustes.ocultos.map((id, i) => (
                  <View key={id} style={[styles.fila, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{temaPorId(id)?.nombre ?? id}</Text>
                    <Pressable
                      onPress={() => cambiar({ ocultos: ajustes.ocultos.filter((t) => t !== id) })}
                      style={({ pressed }) => [styles.boton, { borderColor: colors.accent }, pressed && styles.pressed]}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Volver a mostrar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}

      <Text style={[text.small, { color: colors.muted, marginTop: 24, lineHeight: 19 }]}>
        Los versículos y los planes están elegidos a mano, no por una IA. Cada tema termina mirando a Jesús, que dijo: «Venid
        a mí todos los que estáis trabajados y cargados, que yo os haré descansar» (Mateo 11:28).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  title: { fontSize: 24 },
  privado: { flexDirection: 'row', gap: 12, borderRadius: 14, padding: 14, alignItems: 'flex-start' },
  temas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tema: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  lista: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  boton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
