import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, SectionTitle, text } from '@/components/comunidad/ui';
import { EstadoPill } from '@/components/evento/piezas';
import { ChurchIcon, QrIcon } from '@/components/icons';
import { ago, useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { CODIGO_LARGO, codigoLegible, cuantasNotas, limpiarCodigo, useEventosSeguidos, useMisEventos } from '@/lib/eventos';
import { pasajeLabel } from '@/lib/taller';
import { isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Unirse a un evento con el código que se ve en la iglesia, y los eventos que ya se siguieron con sus notas. */
export default function EventosScreen() {
  const colors = useColors();
  const { usuario } = useAccount();
  const { seguidos, ready } = useEventosSeguidos();
  const { eventos: mios } = useMisEventos(!!usuario);
  const [books, setBooks] = useState<Book[]>([]);
  const [codigo, setCodigo] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const listo = codigo.length === CODIGO_LARGO;
  const abrir = (c = codigo) => navigate(() => router.push(`/evento/${c}`), 'forward');
  const go = (href: string) => navigate(() => router.push(href as never), 'forward');
  const lista = Object.values(seguidos).sort((a, b) => b.visto - a.visto);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Eventos' }} />
      <View style={[styles.join, { backgroundColor: colors.surface, borderColor: colors.border }, !isDark(colors) && styles.shadow]}>
        <View style={[styles.emblem, { backgroundColor: colors.warmSoft }]}>
          <ChurchIcon color={colors.warm} size={26} />
        </View>
        <Text style={[styles.joinTitle, { color: colors.text }]}>¿Estás en la iglesia?</Text>
        <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 400 }]}>
          Escribe el código que ves en la pantalla para seguir el mensaje, abrir los versículos y tomar tus notas.
        </Text>
        <TextInput
          value={codigoLegible(codigo).trim()}
          onChangeText={(t) => setCodigo(limpiarCodigo(t))}
          onSubmitEditing={() => listo && abrir()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="ABC 234"
          placeholderTextColor={colors.border}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODIGO_LARGO + 1}
          accessibilityLabel="Código del evento"
          style={[
            styles.code,
            { color: colors.text, borderColor: focused ? colors.accent : colors.border, backgroundColor: colors.background },
            focused && { boxShadow: `0 0 0 3px ${colors.accentSoft}` },
            { outlineStyle: 'none' } as object,
          ]}
        />
        <Button label="Seguir el evento" onPress={() => abrir()} disabled={!listo} style={{ alignSelf: 'stretch' }} />
        <View style={styles.qrHint}>
          <QrIcon color={colors.muted} size={16} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>Si hay un código QR, ábrelo con la cámara del teléfono.</Text>
        </View>
      </View>

      {usuario && mios && mios.length > 0 && (
        <>
          <SectionTitle>Publicados por mí</SectionTitle>
          <View style={{ gap: 10 }}>
            {mios.map((e) => (
              <Pressable key={e.codigo} onPress={() => abrir(e.codigo)} accessibilityRole="link">
                <Card style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <EstadoPill estado={e.estado} colors={colors} />
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{e.titulo}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                      {codigoLegible(e.codigo)} · {e.total} {e.total === 1 ? 'punto' : 'puntos'} · {ago(e.actualizado)}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {ready && lista.length > 0 && (
        <>
          <SectionTitle>Eventos que seguí</SectionTitle>
          <View style={{ gap: 10 }}>
            {lista.map((s) => {
              const n = cuantasNotas(s);
              const pasaje = pasajeLabel(s.pasaje, books);
              return (
                <Pressable key={s.codigo} onPress={() => abrir(s.codigo)} accessibilityRole="link">
                  <Card>
                    {!!pasaje && <Text style={[styles.kicker, { color: colors.warm }]}>{pasaje.toUpperCase()}</Text>}
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{s.titulo}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                      {s.autor}
                      {s.iglesia ? ` · ${s.iglesia}` : ''} · {new Date(s.visto).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={{ color: n ? colors.text : colors.muted, fontSize: 14, marginTop: 8, fontWeight: n ? '600' : '400' }}>
                      {n ? `${n} ${n === 1 ? 'nota' : 'notas'} tuyas` : 'Sin notas todavía'}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <SectionTitle>¿Predicas o diriges?</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={[text.body, { color: colors.text }]}>
          Prepara tu mensaje en el Taller y, en el paso «Presentar», publícalo como evento. La congregación lo sigue en vivo con un
          código o un QR mientras tú avanzas.
        </Text>
        <Button label="Ir al Taller" kind="outline" onPress={() => go('/taller')} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 80, maxWidth: 640, width: '100%', alignSelf: 'center' },
  join: { alignItems: 'center', gap: 14, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  shadow: { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 8px 28px rgba(60, 40, 20, 0.07)' },
  emblem: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  joinTitle: { fontFamily: serif, fontSize: 24, fontWeight: '700' },
  code: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    marginTop: 6,
  },
  qrHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  itemTitle: { fontFamily: serif, fontSize: 19, fontWeight: '700', marginTop: 6 },
});
