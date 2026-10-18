import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, SectionTitle, text } from '@/components/comunidad/ui';
import { ago } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { Pasaje, TIPOS, Tipo, crearMensaje, duracion, pasajeLabel, tipoInfo, tituloDe, useTaller } from '@/lib/taller';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const ICONOS: Record<Tipo, string> = { reflexion: '❧', encuentro: '◎', sermon: '¶' };

/** El Taller: preparar reflexiones, encuentros de grupo y sermones. Desde el lector llega con un pasaje. */
export default function TallerScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ libro?: string; capitulo?: string; versiculo?: string }>();
  const { mensajes, ready } = useTaller();
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const pasaje: Pasaje | null =
    params.libro && params.capitulo
      ? { book: params.libro, chapter: Number(params.capitulo), from: params.versiculo ? Number(params.versiculo) : undefined }
      : null;

  const crear = async (tipo: Tipo) => {
    const id = await crearMensaje(tipo, pasaje);
    navigate(() => router.replace(`/taller/${id}`), 'forward');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Taller' }} />
      <Text style={[text.title, { color: colors.text }]}>Taller</Text>
      <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
        Prepara lo que vas a compartir: del pasaje a una idea central, de la idea a un bosquejo, y de ahí a presentarlo. La IA
        te pregunta y sugiere, pero el mensaje lo escribes tú.
      </Text>

      {pasaje && books.length > 0 && (
        <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text }}>
            Preparar con <Text style={{ fontWeight: '700' }}>{pasajeLabel(pasaje, books)}</Text>. Elige qué quieres preparar.
          </Text>
        </View>
      )}

      <SectionTitle>Preparar</SectionTitle>
      <View style={{ gap: 10 }}>
        {TIPOS.map((t) => (
          <Pressable
            key={t.tipo}
            onPress={() => crear(t.tipo)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.type, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.accent, fontSize: 22, fontFamily: serif }}>{ICONOS[t.tipo]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.typeName, { color: colors.text }]}>
                {t.nombre} <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '400' }}>· {t.duracion}</Text>
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{t.descripcion}</Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 22 }}>+</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => navigate(() => router.push('/taller/dinamicas'), 'forward')} style={{ marginTop: 14 }}>
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver las 23 dinámicas para grupos ›</Text>
      </Pressable>

      {ready && mensajes.length > 0 && (
        <>
          <SectionTitle>Mis mensajes</SectionTitle>
          <View style={{ gap: 10 }}>
            {mensajes.map((m) => {
              const mins = duracion(m);
              return (
                <Pressable key={m.id} onPress={() => navigate(() => router.push(`/taller/${m.id}`), 'forward')}>
                  <Card>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
                      {tipoInfo(m.tipo).nombre.toUpperCase()}
                      {m.pasaje && m.titulo ? ` · ${pasajeLabel(m.pasaje, books).toUpperCase()}` : ''}
                    </Text>
                    <Text style={[styles.msgTitle, { color: colors.text }]}>{tituloDe(m, books)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
                      {m.tema.trim() ? `${m.tema.trim()} · ` : ''}
                      {mins ? `${mins} min · ` : ''}editado {ago(m.actualizado)}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 28, lineHeight: 17 }}>
        Lo que preparas se guarda en este dispositivo. Los encuentros se pueden enviar a tus grupos.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 80, maxWidth: 640, width: '100%', alignSelf: 'center' },
  banner: { borderRadius: 12, padding: 14, marginTop: 16 },
  type: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  typeName: { fontSize: 17, fontWeight: '700' },
  msgTitle: { fontFamily: serif, fontSize: 19, fontWeight: '700', marginTop: 4 },
});
