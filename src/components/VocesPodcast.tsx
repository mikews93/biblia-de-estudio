import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ElegirVoz from '@/components/ElegirVoz';
import { Speaker, pickAutoVoices } from '@/lib/podcast';
import { useColors } from '@/lib/theme';
import { Voz, useVoces } from '@/lib/voces';

const MUESTRAS: Record<Speaker, string[]> = {
  ana: ['Hola, soy Ana.', 'Hoy conversamos sobre este capítulo y lo que nos dice para la vida.'],
  tomas: ['Y yo soy Tomás.', 'Vamos a ver qué dice el texto, versículo por versículo.'],
};

/**
 * Las voces del teléfono con que Ana y Tomás leen el pódcast (no gastan nada). Se elige cada una después de
 * escucharla; queda guardada en el dispositivo para todos los pódcast. Se abre desde «Voces» en el reproductor.
 */
export function VocesPanel() {
  const colors = useColors();
  const [quien, setQuien] = useState<Speaker>('ana');
  const automaticas = useAutoVoces();
  return (
    <View style={{ marginTop: 8 }}>
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(['ana', 'tomas'] as const).map((s) => {
          const on = quien === s;
          return (
            <Pressable
              key={s}
              onPress={() => setQuien(s)}
              accessibilityRole="tab"
              aria-selected={on}
              style={[styles.tab, on && { backgroundColor: colors.accentSoft }]}
            >
              <Text
                style={{
                  color: on ? colors.text : colors.muted,
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                {s === 'ana' ? 'Voz de Ana' : 'Voz de Tomás'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: 10 }}>
        <ElegirVoz key={quien} papel={quien} muestra={MUESTRAS[quien]} automatica={automaticas[quien]} testID={`voz-${quien}`} />
      </View>
    </View>
  );
}

/** La voz que el dispositivo pone sola a cada uno, si nadie eligió otra. */
function useAutoVoces() {
  const voces = useVoces();
  const [auto, setAuto] = useState<Record<Speaker, Voz | undefined>>({
    ana: undefined,
    tomas: undefined,
  });
  useEffect(() => {
    if (!voces) return;
    pickAutoVoices().then((v) =>
      setAuto({
        ana: voces.find((x) => x.id === v.ana.voice),
        tomas: voces.find((x) => x.id === v.tomas.voice),
      }),
    );
  }, [voces]);
  return auto;
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
});
