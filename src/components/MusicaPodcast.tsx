import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmbienteHoja, Barras } from '@/components/Ambiente';
import { MusicIcon } from '@/components/icons';
import { PISTAS, useAmbiente } from '@/lib/ambiente';
import { useMusicaPodcast } from '@/lib/musicaPodcast';
import { Colors } from '@/lib/theme';

/**
 * Debajo del reproductor del pódcast: la música de fondo, encendida o apagada, y qué pista suena. Al tocar el nombre
 * se abre la hoja de pistas y volumen de la música de ambiente; el interruptor la quita o la pone.
 */
export default function MusicaPodcast({ colors }: { colors: Colors }) {
  const musica = useMusicaPodcast();
  const { sonando } = useAmbiente();
  const [open, setOpen] = useState(false);
  const pista = PISTAS.find((p) => p.id === musica.pista);
  const suena = musica.encendida && sonando === musica.pista;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Música de fondo: ${musica.encendida ? pista?.nombre : 'apagada'}. Cambiar pista o volumen`}
        style={({ pressed }) => [
          styles.chip,
          suena ? { backgroundColor: colors.warmSoft, borderColor: 'transparent' } : { borderColor: colors.border, backgroundColor: colors.surface },
          pressed && { opacity: 0.7 },
        ]}
      >
        {suena ? <Barras color={colors.warm} size={14} /> : <MusicIcon color={colors.muted} size={15} />}
        <Text style={[styles.label, { color: suena ? colors.warm : colors.muted }]} numberOfLines={1}>
          Música de fondo{musica.encendida && pista ? ` · ${pista.nombre}` : ''}
        </Text>
      </Pressable>
      <Pressable
        onPress={musica.alternar}
        accessibilityRole="switch"
        aria-checked={musica.encendida}
        accessibilityState={{ checked: musica.encendida }}
        accessibilityLabel="Música de fondo"
        hitSlop={8}
        style={({ pressed }) => [
          styles.switch,
          { backgroundColor: musica.encendida ? colors.warm : colors.border },
          pressed && { opacity: 0.75 },
        ]}
      >
        <View style={[styles.knob, { backgroundColor: colors.surface }, musica.encendida && styles.knobOn]} />
      </Pressable>
      {open && (
        <AmbienteHoja
          colors={colors}
          onClose={() => setOpen(false)}
          onElegir={musica.cambiar}
          onApagar={() => musica.encendida && musica.alternar()}
          titulo="Debajo de Ana y Tomás"
          marcada={musica.encendida ? musica.pista : undefined}
          nota="Suena bajita mientras escuchas el pódcast y se va cuando lo pausas. La pista que elijas queda para los próximos."
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
  },
  label: { fontSize: 13, fontWeight: '700' },
  switch: { width: 40, height: 24, borderRadius: 12, padding: 3, justifyContent: 'center' },
  knob: { width: 18, height: 18, borderRadius: 9 },
  knobOn: { alignSelf: 'flex-end' },
});
