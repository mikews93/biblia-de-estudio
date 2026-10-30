// «Quiero hablar con alguien» del camino de preparación: a quién acudir y, si lo escrito habla de hacerse daño o de
// abuso, la línea de ayuda del país. No diagnostica ni avisa a nadie: es solo para quien la lee.
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, text } from '@/components/comunidad/ui';
import { HeartIcon } from '@/components/icons';
import { LINEAS_VIDA } from '@/lib/camino';
import { emergencias, paisDe, telefonoBonito } from '@/lib/pareja';
import { Colors, serif } from '@/lib/theme';

const pais = () => {
  try {
    return paisDe(Intl.DateTimeFormat().resolvedOptions().locale) ?? '';
  } catch {
    return '';
  }
};
const bonito = (tel: string) => (tel.startsWith('*') ? tel : tel.length === 10 ? `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}` : telefonoBonito(tel));
const llamar = (tel: string) => Linking.openURL(`tel:${tel.replace('*', '%2A')}`).catch(() => {});

/** La línea de prevención del país, o emergencias. */
function LineaVida({ colors }: { colors: Colors }) {
  const p = pais();
  const linea = LINEAS_VIDA.find((l) => l.pais === p);
  const tel = linea?.tel ?? emergencias(p);
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[text.body, { color: colors.text }]}>{linea ? linea.linea : 'Línea de emergencias'}</Text>
      <Text style={[styles.numero, { color: colors.accent }]}>{bonito(tel)}</Text>
      {linea?.nota && <Text style={[text.small, { color: colors.muted }]}>{linea.nota}</Text>}
      <Button label="Llamar ahora" onPress={() => llamar(tel)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
    </View>
  );
}

/** Aparece bajo una respuesta que habla de hacerse daño o de abuso. */
export function AvisoCrisis({ tipo, colors }: { tipo: 'vida' | 'abuso'; colors: Colors }) {
  return (
    <View style={[styles.aviso, { backgroundColor: colors.warmSoft, borderColor: colors.warm }]} accessibilityRole="alert">
      <Text style={[styles.titulo, { color: colors.text }]}>{tipo === 'vida' ? 'No estás solo ni sola' : 'Eso no es tu culpa'}</Text>
      <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>
        {tipo === 'vida'
          ? 'Si estás pensando en hacerte daño, habla hoy con alguien. Hay personas listas para escucharte ahora mismo.'
          : 'Si alguien te lastima, te amenaza o te obliga, busca ayuda para ti. Dios no quiere que vivas con miedo.'}
      </Text>
      {tipo === 'vida' ? (
        <LineaVida colors={colors} />
      ) : (
        <Button label="Ver líneas de ayuda" onPress={() => router.push('/pareja/ayuda' as never)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      )}
    </View>
  );
}

/** Siempre visible en las etapas que tocan heridas o hábitos: a quién acudir. */
export function HablarConAlguien({ colors }: { colors: Colors }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <View style={[styles.hablar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable onPress={() => setAbierto(!abierto)} accessibilityRole="button" aria-expanded={abierto} style={styles.fila}>
        <View style={[styles.icono, { backgroundColor: colors.accentSoft }]}>
          <HeartIcon color={colors.accent} size={16} strokeWidth={2} />
        </View>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 }}>Quiero hablar con alguien</Text>
        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>{abierto ? 'Cerrar' : 'Ver'}</Text>
      </Pressable>
      {abierto && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={[text.body, { color: colors.text }]}>
            Habla con tu pastor, un líder o un matrimonio de confianza de tu iglesia. Cuéntales que estás haciendo el camino de
            preparación y que algo te pesa: es una buena razón para pedir una conversación.
          </Text>
          <Text style={[text.body, { color: colors.text }]}>
            Si hay abuso, adicción, depresión o miedo que no se va, busca también a un psicólogo o consejero profesional. Pedir
            ayuda no es falta de fe.
          </Text>
          <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>Si estás en peligro o piensas en hacerte daño:</Text>
          <LineaVida colors={colors} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
  titulo: { fontFamily: serif, fontSize: 18 },
  numero: { fontSize: 26, fontWeight: '700', letterSpacing: 1, marginTop: 2, fontVariant: ['tabular-nums'] },
  hablar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, marginTop: 18 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
