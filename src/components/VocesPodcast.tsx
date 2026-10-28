import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ElegirVoz from '@/components/ElegirVoz';
import { Speaker, pickAutoVoices } from '@/lib/podcast';
import { useColors } from '@/lib/theme';
import { Voz, useVoces, useVozElegida } from '@/lib/voces';

const MUESTRAS: Record<Speaker, string[]> = {
  ana: ['Hola, soy Ana.', 'Hoy conversamos sobre este capítulo y lo que nos dice para la vida.'],
  tomas: ['Y yo soy Tomás.', 'Vamos a ver qué dice el texto, versículo por versículo.'],
};

/**
 * Las voces del teléfono con que Ana y Tomás leen el pódcast (no gastan nada). Se elige cada una después de
 * escucharla; queda guardada en el dispositivo para todos los pódcast.
 */
export default function VocesPodcast() {
  const colors = useColors();
  const voces = useVoces();
  const [abierto, setAbierto] = useState(false);
  const [quien, setQuien] = useState<Speaker>('ana');
  const [auto, setAuto] = useState<Record<Speaker, Voz | undefined>>({ ana: undefined, tomas: undefined });
  const ana = useVozElegida('ana');
  const tomas = useVozElegida('tomas');

  useEffect(() => {
    if (!voces) return;
    pickAutoVoices().then((v) =>
      setAuto({ ana: voces.find((x) => x.id === v.ana.voice), tomas: voces.find((x) => x.id === v.tomas.voice) }),
    );
  }, [voces]);

  const nombre = (s: Speaker, id: string | null) => voces?.find((v) => v.id === id)?.nombre ?? auto[s]?.nombre ?? '…';
  const resumen = `Ana: ${nombre('ana', ana)} · Tomás: ${nombre('tomas', tomas)}`;

  return (
    <View style={{ marginTop: 10 }}>
      <Pressable
        onPress={() => setAbierto((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.7 }]}
        testID="voces-podcast"
      >
        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
          {resumen}
        </Text>
        <Text style={{ color: colors.warm, fontSize: 12, fontWeight: '700' }}>{abierto ? 'Listo' : 'Cambiar voces'}</Text>
      </Pressable>
      {abierto && (
        <View style={{ marginTop: 8 }}>
          <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['ana', 'tomas'] as const).map((s) => {
              const on = quien === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setQuien(s)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.tab, on && { backgroundColor: colors.accentSoft }]}
                >
                  <Text style={{ color: on ? colors.text : colors.muted, fontWeight: '700', fontSize: 14 }}>
                    {s === 'ana' ? 'Voz de Ana' : 'Voz de Tomás'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: 10 }}>
            <ElegirVoz key={quien} papel={quien} muestra={MUESTRAS[quien]} automatica={auto[quien]} testID={`voz-${quien}`} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 4 },
  tabs: { flexDirection: 'row', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 4, gap: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
});
