import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronDownIcon, WavesIcon } from '@/components/icons';
import { callar, narrar } from '@/lib/narrador';
import { useColors } from '@/lib/theme';
import { Papel, Voz, elegirVoz, useVoces, useVozElegida } from '@/lib/voces';

/** Cuántas voces se ven antes de «Ver todas». */
const PRIMERAS = 4;

type Props = {
  papel: Papel;
  /** Lo que se oye al tocar «Escuchar». */
  muestra: string[];
  ritmo?: number;
  /** La voz que usa «Automática» cuando no es la primera de la lista (Tomás no repite la de Ana). */
  automatica?: Voz;
  /** Sin la nota de abajo (costo y dónde conseguir voces mejores). */
  sinNota?: boolean;
  testID?: string;
};

/**
 * Elegir una voz del propio dispositivo (no gasta nada) después de escucharla: «Automática» (la más natural que haya)
 * o una de la lista. Lo usan el despertador y el pódcast leído con la voz del teléfono.
 */
export default function ElegirVoz({ papel, muestra, ritmo, automatica, sinNota, testID }: Props) {
  const colors = useColors();
  const voces = useVocesPara(papel);
  const elegida = useVozElegida(papel);
  const [sonando, setSonando] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);

  useEffect(() => () => callar(), []);

  const auto = automatica ?? voces?.[0];
  const actual = voces?.find((v) => v.id === elegida) ?? auto;
  const escuchar = (v: Voz | undefined, clave: string) => {
    if (sonando === clave) {
      callar();
      setSonando(null);
      return;
    }
    setSonando(clave);
    narrar(muestra, (i) => i === null && setSonando((s) => (s === clave ? null : s)), 0, false, { voz: v?.id, ritmo });
  };

  if (voces && !voces.length) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 18 }]} testID={testID}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Este dispositivo no tiene voces en español</Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{consejoVoz()}</Text>
      </View>
    );
  }

  // La elegida siempre a la vista, aunque esté más abajo en la lista
  const primeras = (voces ?? []).slice(0, PRIMERAS);
  const elegidaAbajo = !todas && voces?.find((v) => v.id === elegida && !primeras.includes(v));
  const mostradas = todas ? (voces ?? []) : elegidaAbajo ? [...primeras, elegidaAbajo] : primeras;

  const fila = (v: Voz | null, i: number) => {
    const sel = v ? elegida === v.id : !elegida;
    const clave = v?.id ?? 'auto';
    const suena = sonando === clave;
    return (
      <View key={clave} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
        <Pressable
          onPress={() => elegirVoz(papel, v?.id ?? null)}
          accessibilityRole="radio"
          accessibilityState={{ checked: sel }}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }, pressed && { opacity: 0.8 }]}
          testID={v ? undefined : `${testID ?? 'voz'}-automatica`}
        >
          <View style={[styles.radio, { borderColor: sel ? colors.warm : colors.border }]}>
            {sel && <View style={[styles.radioDot, { backgroundColor: colors.warm }]} />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{v ? v.nombre : 'Automática'}</Text>
              {v?.calidad === 'natural' && (
                <View style={[styles.badge, { backgroundColor: colors.warmSoft }]}>
                  <Text style={{ color: colors.warm, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>NATURAL</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
              {v
                ? [v.genero && GENERO[v.genero], v.acento, v.sinInternet && 'sin internet'].filter(Boolean).join(' · ')
                : auto
                  ? `La más natural de aquí: ${auto.nombre}, ${auto.acento}`
                  : 'Buscando voces…'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => escuchar(v ?? auto, clave)}
          accessibilityRole="button"
          accessibilityLabel={suena ? 'Parar' : `Escuchar ${v ? v.nombre : 'la voz automática'}`}
          hitSlop={6}
          style={({ pressed }) => [
            styles.escuchar,
            { borderColor: suena ? colors.warm : colors.border, backgroundColor: suena ? colors.warmSoft : 'transparent' },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <WavesIcon color={suena ? colors.warm : colors.accent} size={16} />
          <Text style={{ color: suena ? colors.warm : colors.text, fontWeight: '700', fontSize: 13 }}>{suena ? 'Parar' : 'Escuchar'}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={testID}>
        {fila(null, 0)}
        {mostradas.map((v, i) => fila(v, i + 1))}
        {voces && voces.length > PRIMERAS && (
          <Pressable
            onPress={() => setTodas((t) => !t)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.verTodas, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.warm, fontWeight: '700', fontSize: 13 }}>{todas ? 'Ver menos' : `Ver todas (${voces.length})`}</Text>
            <View style={todas && { transform: [{ rotate: '180deg' }] }}>
              <ChevronDownIcon color={colors.warm} size={16} />
            </View>
          </Pressable>
        )}
      </View>
      {!sinNota && (
        <Text style={[styles.nota, { color: colors.muted }]}>
          {actual?.calidad === 'natural'
            ? 'Habla tu propio dispositivo: no tiene costo ni gasta nada del servidor.'
            : `Habla tu propio dispositivo, sin costo. ${consejoVoz()}`}
        </Text>
      )}
    </View>
  );
}

const GENERO = { mujer: 'Mujer', hombre: 'Hombre' } as const;

/** Para Ana primero las voces de mujer y para Tomás las de hombre; las que no se sabe, en medio. */
function useVocesPara(papel: Papel) {
  const voces = useVoces();
  const busca = papel === 'ana' ? 'mujer' : papel === 'tomas' ? 'hombre' : null;
  if (!voces || !busca) return voces;
  const orden = (v: Voz) => (v.genero === busca ? 0 : v.genero ? 2 : 1);
  return [...voces].sort((a, b) => orden(a) - orden(b));
}

/** Dónde conseguir una voz más natural en este dispositivo. */
export function consejoVoz() {
  const ua = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (Platform.OS === 'android' || /android/i.test(ua))
    return 'Para una voz más natural: Ajustes › Accesibilidad › Texto a voz, elige «Servicios de voz de Google» y descarga el español en alta calidad.';
  if (Platform.OS === 'ios' || /iphone|ipad|macintosh/i.test(ua))
    return 'Para una voz más natural: Ajustes › Accesibilidad › Contenido leído › Voces › Español, y descarga una voz «Mejorada».';
  return 'En el computador, Microsoft Edge trae voces muy naturales en español.';
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  escuchar: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  verTodas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nota: { fontSize: 12, lineHeight: 18, marginTop: 10, paddingHorizontal: 4 },
});
