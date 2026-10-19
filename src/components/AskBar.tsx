import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, TextInputKeyPressEvent, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Colors } from '@/lib/theme';

const MIN = 48;
const MAX = 148;

type Props = {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  /** Mientras la IA responde: el botón pasa a «Detener» si hay onStop. */
  busy: boolean;
  onStop?: () => void;
  /** Si todavía no se puede preguntar (el estudio no ha llegado). */
  disabled?: boolean;
  sendLabel?: string;
  colors: Colors;
};

/** Avión de papel: enviar. Relleno para que se lea bien dentro del círculo. */
export function SendIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.6 10.6 19.3 3.9c.9-.4 1.8.5 1.4 1.4l-6.7 15.7c-.4.9-1.7.8-2-.1l-1.6-5.7-5.7-1.6c-.9-.3-1-1.6-.1-2Z"
        fill={color}
      />
    </Svg>
  );
}

function StopIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Rect x={1} y={1} width={12} height={12} rx={3} fill={color} />
    </Svg>
  );
}

/**
 * Caja para preguntarle a la IA: crece con el texto hasta unas cinco líneas, envía con Intro (Mayús+Intro
 * hace salto de línea en el ordenador) y, mientras responde, deja detener la respuesta.
 */
export default function AskBar({ value, onChange, onSend, placeholder, busy, onStop, disabled, sendLabel = 'Enviar pregunta', colors }: Props) {
  const [height, setHeight] = useState(MIN);
  const [focus, setFocus] = useState(false);
  const canSend = !busy && !disabled && !!value.trim();
  const stopping = busy && !!onStop;

  const send = () => {
    if (!canSend) return;
    onSend();
    setHeight(MIN);
  };

  const onKeyPress = (e: TextInputKeyPressEvent) => {
    if (Platform.OS !== 'web') return;
    const ev = e.nativeEvent as { key: string; shiftKey?: boolean; isComposing?: boolean };
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View
        style={[
          styles.field,
          { backgroundColor: colors.background, borderColor: focus ? colors.accent : colors.border },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          onKeyPress={onKeyPress}
          onSubmitEditing={send}
          submitBehavior={Platform.OS === 'web' ? undefined : 'submit'}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          // En la web crece sola (field-sizing); en el teléfono, con la altura del contenido.
          onContentSizeChange={
            Platform.OS === 'web' ? undefined : (e) => setHeight(Math.min(MAX, Math.max(MIN, Math.ceil(e.nativeEvent.contentSize.height))))
          }
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          maxLength={600}
          multiline
          editable={!disabled}
          returnKeyType="send"
          style={[
            styles.input,
            { color: colors.text },
            Platform.OS === 'web'
              ? ({ outlineStyle: 'none', fieldSizing: 'content', minHeight: MIN, maxHeight: MAX, resize: 'none' } as object)
              : { height },
          ]}
        />
        <Pressable
          onPress={stopping ? onStop : send}
          disabled={!stopping && !canSend}
          accessibilityRole="button"
          accessibilityLabel={stopping ? 'Detener respuesta' : sendLabel}
          hitSlop={6}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: stopping ? colors.text : canSend ? colors.accent : colors.border },
            pressed && styles.pressed,
          ]}
        >
          {stopping ? <StopIcon color={colors.surface} /> : <SendIcon color={colors.surface} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 26,
    paddingLeft: 6,
    paddingRight: 5,
    paddingVertical: 4,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  input: { flex: 1, fontSize: 16, lineHeight: 22, paddingHorizontal: 12, paddingTop: 13, paddingBottom: 13, textAlignVertical: 'top' },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
});
