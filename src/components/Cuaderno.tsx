// Un cuaderno para escribir o dictar un texto largo. El dictado sigue escuchando frase tras frase hasta que se detiene.
// Lo usan «Del sermón a tu semana» (las notas del domingo) y el Taller desde un tema.
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorText, IconText } from '@/components/comunidad/ui';
import { LockIcon, MicIcon, PencilIcon } from '@/components/icons';
import { Colors, serif } from '@/lib/theme';
import { listen, voiceSupported } from '@/lib/voz';

type Props = {
  value: string;
  onChange: (t: string | ((t: string) => string)) => void;
  colors: Colors;
  max: number;
  /** El título del cuaderno, sobre el texto. */
  label: string;
  placeholder: string;
  accessibilityLabel: string;
  /** Lo que dice el botón de dictar mientras no escucha. */
  dictarLabel?: string;
  minHeight?: number;
  /** Se llama al empezar y al dejar de dictar. */
  onDictando?: (dictando: boolean) => void;
};

export default function Cuaderno({ value, onChange, colors, max, label, placeholder, accessibilityLabel, dictarLabel = 'Dictar', minHeight = 200, onDictando }: Props) {
  const [focus, setFocus] = useState(false);
  const [dictando, setDictandoState] = useState(false);
  const [oyendo, setOyendo] = useState('');
  const [problema, setProblema] = useState<string | null>(null);
  const activo = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const puedeDictar = voiceSupported();

  const setDictando = (d: boolean) => {
    setDictandoState(d);
    onDictando?.(d);
  };

  const escuchar = () => {
    stop.current = listen({
      onPartial: setOyendo,
      onFinal: ([t]) => {
        setOyendo('');
        if (t) onChange((n) => `${n}${n && !/\s$/.test(n) ? ' ' : ''}${t.charAt(0).toUpperCase()}${t.slice(1)}.`.slice(0, max));
      },
      onError: (m) => {
        setProblema(m);
        activo.current = false;
      },
      onEnd: () => {
        if (activo.current) escuchar();
        else {
          setDictando(false);
          setOyendo('');
        }
      },
    });
  };

  const alternar = () => {
    if (dictando) {
      activo.current = false;
      stop.current?.();
      setDictando(false);
      return;
    }
    setProblema(null);
    activo.current = true;
    setDictando(true);
    escuchar();
  };

  useEffect(
    () => () => {
      activo.current = false;
      stop.current?.();
    },
    [],
  );

  return (
    <View>
      <View style={[styles.cuaderno, { borderColor: focus || dictando ? colors.accent : colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.head}>
          <IconText icon={PencilIcon} color={colors.accent} size={14}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>{label}</Text>
          </IconText>
          <IconText icon={LockIcon} color={colors.muted} size={11} gap={4}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Solo tú</Text>
          </IconText>
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={max}
          style={[styles.input, { color: colors.text, minHeight }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          accessibilityLabel={accessibilityLabel}
        />
        {!!oyendo && <Text style={[styles.oyendo, { color: colors.muted }]}>{oyendo}…</Text>}
        <View style={[styles.foot, { borderColor: colors.border }]}>
          {puedeDictar ? (
            <Pressable
              onPress={alternar}
              style={({ pressed }) => [styles.dictar, { backgroundColor: dictando ? colors.accent : colors.accentSoft }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={dictando ? 'Dejar de dictar' : dictarLabel}
            >
              <MicIcon color={dictando ? colors.surface : colors.accent} size={16} />
              <Text style={{ color: dictando ? colors.surface : colors.accent, fontWeight: '700', fontSize: 13 }}>
                {dictando ? 'Escuchando… · Detener' : dictarLabel}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>También puedes dictar con el micrófono del teclado.</Text>
          )}
          <Text style={{ color: value.length > max * 0.9 ? colors.warm : colors.muted, fontSize: 12 }}>
            {value.length.toLocaleString('es')} / {max.toLocaleString('es')}
          </Text>
        </View>
      </View>
      <ErrorText>{problema}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  cuaderno: { borderWidth: 1, borderRadius: 18, paddingTop: 14, paddingHorizontal: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  input: { fontFamily: serif, fontSize: 17, lineHeight: 27, textAlignVertical: 'top', paddingVertical: 4 },
  oyendo: { fontFamily: serif, fontSize: 16, fontStyle: 'italic', marginBottom: 8 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    marginTop: 6,
  },
  dictar: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
});
