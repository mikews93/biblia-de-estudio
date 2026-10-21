// Piezas de «Del sermón a tu semana» (src/lib/semanas.ts) que se ven en varias pantallas.

import { StyleSheet, Text, View } from 'react-native';

import { CheckIcon, LecternIcon } from '@/components/icons';
import { DIAS, type Semana, diaDeHoy, fechaDia } from '@/lib/semanas';
import { Colors, serif } from '@/lib/theme';

const INICIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/**
 * El camino de la semana: el domingo (el atril del sermón) y los cinco días que salen de él, unidos por una línea.
 * Sin semana, es la ilustración de lo que se va a preparar.
 */
export function Ruta({ semana, colors, size = 34 }: { semana?: Semana; colors: Colors; size?: number }) {
  const hoy = semana ? diaDeHoy(semana) : -1;
  const letras = semana
    ? Array.from({ length: DIAS }, (_, i) => INICIAL[fechaDia(semana, i).getDay()])
    : ['L', 'M', 'X', 'J', 'V'];
  return (
    <View style={styles.ruta} accessibilityLabel={semana ? `${Object.keys(semana.hechos).length} de ${DIAS} días hechos` : undefined}>
      <View style={[styles.linea, { backgroundColor: colors.border, top: size / 2 - 1, left: size / 2, right: size / 2 }]} />
      <View style={styles.paso}>
        <View style={[styles.punto, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.warm }]}>
          <LecternIcon color={colors.surface} size={size * 0.5} strokeWidth={2} />
        </View>
        <Text style={[styles.letra, { color: colors.warm }]}>D</Text>
      </View>
      {letras.map((l, i) => {
        const hecho = !!semana?.hechos[i];
        const esHoy = hoy === i;
        return (
          <View key={i} style={styles.paso}>
            <View
              style={[
                styles.punto,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: hecho ? colors.accent : colors.surface,
                  borderColor: hecho || esHoy ? colors.accent : colors.border,
                  borderWidth: esHoy && !hecho ? 2 : 1.5,
                },
              ]}
            >
              {hecho ? (
                <CheckIcon color={colors.surface} size={size * 0.45} strokeWidth={2.6} />
              ) : (
                <Text style={{ fontFamily: serif, fontSize: size * 0.42, color: esHoy ? colors.accent : colors.muted }}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.letra, { color: esHoy ? colors.text : colors.muted, fontWeight: esHoy ? '700' : '500' }]}>{l}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ruta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  linea: { position: 'absolute', height: 2 },
  paso: { alignItems: 'center' },
  punto: { alignItems: 'center', justifyContent: 'center' },
  letra: { fontSize: 11, marginTop: 6, fontWeight: '600' },
});
