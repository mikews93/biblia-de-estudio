import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Chips, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { CheckIcon } from '@/components/icons';
import { MOTIVOS_REPORTE } from '@/lib/circulo';
import { reportar } from '@/lib/circuloApi';
import type { Colors } from '@/lib/theme';

/** Reportar a alguien (llega a los líderes del círculo) y, si se quiere, bloquearlo. */
export default function Reportar({ usuario, nombre, colors, onDone }: { usuario: string; nombre: string; colors: Colors; onDone: () => void }) {
  const [motivo, setMotivo] = useState(MOTIVOS_REPORTE[0]);
  const [detalle, setDetalle] = useState('');
  const [bloquear, setBloquear] = useState(true);
  const [hecho, setHecho] = useState(false);
  const act = useAction();
  if (hecho) {
    return (
      <View style={[styles.mutuo, { backgroundColor: colors.accentSoft, marginTop: 12 }]}>
        <Text style={[text.body, { color: colors.text }]}>Gracias. Los líderes del círculo lo revisarán. {bloquear ? `${nombre} ya no te verá.` : ''}</Text>
        <Button label="Listo" kind="quiet" onPress={onDone} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }
  return (
    <View style={[styles.reportar, { borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>¿Qué pasó?</Text>
      <View style={{ marginTop: 8 }}>
        <Chips options={MOTIVOS_REPORTE.map((m) => ({ value: m, label: m }))} value={motivo} onChange={setMotivo} />
      </View>
      <Field value={detalle} onChangeText={setDetalle} multiline maxLength={500} placeholder="Si quieres, cuéntalo (solo lo leen los líderes)" style={{ marginTop: 10, minHeight: 60 }} />
      <Pressable onPress={() => setBloquear(!bloquear)} accessibilityRole="checkbox" accessibilityState={{ checked: bloquear }} style={[styles.check, { marginTop: 10 }]}>
        <View style={[styles.box, { borderColor: bloquear ? colors.accent : colors.border, backgroundColor: bloquear ? colors.accent : 'transparent' }]}>
          {bloquear && <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />}
        </View>
        <Text style={[text.small, { color: colors.text, flex: 1 }]}>Bloquear a {nombre}: dejan de verse en toda la app.</Text>
      </Pressable>
      <View style={[styles.rowButtons, { marginTop: 12 }]}>
        <Button label="Enviar reporte" onPress={() => act.run(() => reportar(usuario, motivo, detalle, bloquear)).then((ok) => ok && setHecho(true))} busy={act.busy} style={{ flex: 1 }} />
        <Button label="Cancelar" kind="outline" onPress={onDone} style={{ flex: 1 }} />
      </View>
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  mutuo: { borderRadius: 14, padding: 14, marginTop: 4 },
  reportar: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 14 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
