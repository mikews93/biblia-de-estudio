// Personas y lugares con ficha (fichas.ts): su icono y una fila de botones para abrirlas desde el lector.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PinIcon } from '@/components/icons';
import { CapituloRow, Tipo } from '@/lib/fichas';
import { Colors, serif } from '@/lib/theme';

/** Inicial (personas), figura (pueblos) o alfiler (lugares). */
export function Icono({ tipo, nombre, colors, size = 36 }: { tipo: Tipo; nombre: string; colors: Colors; size?: number }) {
  if (tipo === 'm' || tipo === 'f') return <Avatar persona={{ nombre, sexo: tipo }} colors={colors} size={size} solid={size > 40} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: size > 40 ? colors.accent : colors.accentSoft }}>
      {tipo === 'l' ? (
        <PinIcon color={size > 40 ? colors.surface : colors.accent} size={size * 0.5} />
      ) : (
        <Text style={{ color: size > 40 ? colors.surface : colors.accent, fontFamily: serif, fontSize: size * 0.46, fontWeight: '700' }}>{nombre.charAt(0)}</Text>
      )}
    </View>
  );
}

/** «En este versículo: David · Belén», debajo de la cabecera de la barra del versículo. */
export default function FichaChips({ rows, colors, onOpen }: { rows: CapituloRow[]; colors: Colors; onOpen: (f: { id: string; nombre: string }) => void }) {
  if (!rows.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {rows.map(([id, nombre, tipo]) => (
        <Pressable
          key={id}
          onPress={() => onOpen({ id, nombre })}
          style={({ pressed }) => [styles.chip, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.7 }]}
          accessibilityRole="link"
          accessibilityLabel={`Ficha de ${nombre}`}
        >
          <Icono tipo={tipo} nombre={nombre} colors={colors} size={22} />
          <Text style={{ color: colors.text, fontFamily: serif, fontSize: 15 }}>{nombre.split(' (')[0]}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginTop: 10 },
  row: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 16, paddingLeft: 4, paddingRight: 11, paddingVertical: 4 },
});
