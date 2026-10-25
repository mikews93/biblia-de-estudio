// Vista previa del carrusel para Historias (solo web): las láminas que se van a compartir, dibujadas con el mismo
// canvas, y la pregunta con que empieza.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ImageLook, VerseToShare } from '@/lib/compartir';
import { GANCHOS, drawLaminas, laminasDe, nombreLamina } from '@/lib/laminas';
import { useColors } from '@/lib/theme';

type Props = { verse: VerseToShare; look: ImageLook; gancho: string; onGancho: (t: string) => void; alto: number };

export default function Laminas({ verse, look, gancho, onGancho, alto }: Props) {
  const colors = useColors();
  const [urls, setUrls] = useState<string[] | null>(null);
  const kinds = laminasDe(look);
  const ancho = Math.round((Math.min(300, Math.max(200, alto * 0.3)) * 9) / 16);
  const clave = JSON.stringify([look.fondo.name, look.letra.id, look.destacadas, look.dedicatoria, look.original, look.contexto, gancho]);

  useEffect(() => {
    let vivo = true;
    let hechas: string[] = [];
    // Se espera un poco: escribir la pregunta no redibuja en cada letra.
    const t = setTimeout(() => {
      drawLaminas(verse, look, gancho)
        .then((blobs) => {
          hechas = blobs.map((b) => URL.createObjectURL(b));
          if (vivo) setUrls(hechas);
        })
        .catch(() => vivo && setUrls([]));
    }, 280);
    return () => {
      vivo = false;
      clearTimeout(t);
      setTimeout(() => hechas.forEach((u) => URL.revokeObjectURL(u)), 2000);
    };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.row}>
        {kinds.map((k, i) => (
          <View key={k} style={{ gap: 6, alignItems: 'center' }}>
            <View style={[styles.frame, { width: ancho, height: (ancho * 16) / 9, borderColor: colors.border, backgroundColor: look.fondo.background }]}>
              {urls?.[i] ? (
                <Image source={{ uri: urls[i] }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`Lámina ${i + 1}: ${nombreLamina[k]}`} />
              ) : (
                <ActivityIndicator color={look.fondo.muted} />
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }}>
              {i + 1}. {nombreLamina[k]}
            </Text>
          </View>
        ))}
      </ScrollView>
      {!kinds.includes('fondo') && (
        <Text style={[styles.hint, { color: colors.muted }]}>En «Estudio» elige una palabra original o un contexto y se suma una lámina.</Text>
      )}
      <View style={[styles.box, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Pregunta para empezar</Text>
        <TextInput
          value={gancho}
          onChangeText={onGancho}
          placeholder="Lo que hace que alguien quiera deslizar"
          placeholderTextColor={colors.muted}
          maxLength={80}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          accessibilityLabel="Pregunta para empezar"
        />
        <View style={styles.chips}>
          {GANCHOS.map((g) => {
            const on = g === gancho;
            return (
              <Pressable
                key={g}
                onPress={() => onGancho(g)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                aria-checked={on}
                style={[styles.chip, { borderColor: on ? colors.warm : colors.border }, on && { backgroundColor: colors.warmSoft }]}
              >
                <Text style={{ color: on ? colors.warm : colors.text, fontWeight: on ? '700' : '500', fontSize: 13.5 }}>{g}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 10 },
  strip: { alignSelf: 'stretch', flexGrow: 0 },
  row: { gap: 10, paddingHorizontal: 4, flexGrow: 1, justifyContent: 'center' },
  frame: { borderRadius: 10, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
  box: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
