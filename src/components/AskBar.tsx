import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, TextInputKeyPressEvent, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { MicIcon } from '@/components/icons';
import { Colors } from '@/lib/theme';
import { listen, voiceSupported } from '@/lib/voz';

const MIN = 48;
const MAX = 148;

// En la web, field-sizing también mide el texto de ejemplo: uno largo («¿Qué no entiendes de 1 Tesalonicenses 5:17?»)
// se partía en dos líneas y la caja vacía quedaba alta. El ejemplo va en una sola línea, con puntos suspensivos.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('askbar-estilo')) {
  const estilo = document.createElement('style');
  estilo.id = 'askbar-estilo';
  estilo.textContent =
    'textarea[data-askbar]::placeholder{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  document.head.appendChild(estilo);
}

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
  /** Botón de micrófono para dictar la pregunta (sale solo donde el teléfono o el navegador saben escuchar). */
  dictar?: boolean;
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

/** Lo dictado va detrás de lo ya escrito; si la caja estaba vacía, empieza con mayúscula. */
function unir(antes: string, dicho: string) {
  const a = antes.replace(/\s+$/, '');
  return a ? `${a} ${dicho}` : dicho.charAt(0).toUpperCase() + dicho.slice(1);
}

/** Dos ondas que salen del micrófono mientras escucha. */
function Ondas({ color }: { color: string }) {
  const [wave] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(wave, { toValue: 1, duration: 1400, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [wave]);
  const ring = (offset: number) => {
    const t = Animated.modulo(Animated.add(wave, offset), 1);
    return {
      opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
      transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
    };
  };
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.ring, { backgroundColor: color }, ring(0)]} />
      <Animated.View pointerEvents="none" style={[styles.ring, { backgroundColor: color }, ring(0.5)]} />
    </>
  );
}

/**
 * Caja para preguntarle a la IA: crece con el texto hasta unas cinco líneas, envía con Intro (Mayús+Intro
 * hace salto de línea en el ordenador) y, mientras responde, deja detener la respuesta. Con el micrófono se dicta
 * la pregunta: lo que se oye va saliendo en la caja y queda escrito para revisarlo antes de enviar.
 */
export default function AskBar({
  value,
  onChange,
  onSend,
  placeholder,
  busy,
  onStop,
  disabled,
  sendLabel = 'Enviar pregunta',
  dictar = true,
  colors,
}: Props) {
  const [height, setHeight] = useState(MIN);
  const [focus, setFocus] = useState(false);
  const [oyendo, setOyendo] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const parar = useRef<(() => void) | null>(null);
  const valor = useRef(value);
  useEffect(() => {
    valor.current = value;
  }, [value]);
  const puedeDictar = useMemo(() => dictar && voiceSupported(), [dictar]);
  const escuchando = oyendo !== null;
  const canSend = !busy && !disabled && !!value.trim() && !escuchando;
  // Mientras se dicta, la caja enseña lo escrito más lo que se va oyendo.
  const mostrado = escuchando && oyendo ? unir(value, oyendo) : value;
  const stopping = busy && !!onStop;

  useEffect(() => () => parar.current?.(), []);
  useEffect(() => {
    if (!problema) return;
    const t = setTimeout(() => setProblema(null), 5000);
    return () => clearTimeout(t);
  }, [problema]);

  const alternarDictado = () => {
    if (escuchando) {
      parar.current?.();
      return;
    }
    setProblema(null);
    setOyendo('');
    parar.current = listen({
      onPartial: setOyendo,
      onFinal: (options) => {
        if (options[0]) onChange(unir(valor.current, options[0]).slice(0, 600));
        setOyendo('');
      },
      onError: setProblema,
      onEnd: () => {
        setOyendo(null);
        parar.current = null;
      },
    });
  };

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
          value={mostrado}
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
          placeholder={escuchando ? 'Te escucho…' : placeholder}
          {...({ dataSet: { askbar: '' } } as object)}
          placeholderTextColor={colors.muted}
          maxLength={600}
          multiline
          editable={!disabled && !escuchando}
          returnKeyType="send"
          style={[
            styles.input,
            { color: colors.text },
            Platform.OS === 'web'
              ? ({
                  outlineStyle: 'none',
                  // Vacía mide una línea; con texto crece hasta MAX.
                  ...(mostrado ? { fieldSizing: 'content', minHeight: MIN, maxHeight: MAX } : { fieldSizing: 'fixed', height: MIN }),
                  resize: 'none',
                } as object)
              : { height },
          ]}
        />
        {puedeDictar && !stopping && (
          <View style={styles.micWrap}>
            {escuchando && <Ondas color={colors.accent} />}
            <Pressable
              onPress={alternarDictado}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={escuchando ? 'Dejar de escuchar' : 'Dictar la pregunta'}
              aria-selected={escuchando}
              hitSlop={4}
              style={({ pressed }) => [
                styles.mic,
                { backgroundColor: escuchando ? colors.accent : value.trim() ? 'transparent' : colors.accentSoft },
                pressed && styles.pressed,
              ]}
            >
              <MicIcon color={escuchando ? colors.surface : colors.accent} size={20} />
            </Pressable>
          </View>
        )}
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
          {stopping ? <StopIcon color={colors.surface} /> : <SendIcon color={canSend ? colors.surface : colors.muted} />}
        </Pressable>
      </View>
      {(escuchando || problema) && (
        <Text
          style={[styles.aviso, { color: problema ? colors.warm : colors.muted }]}
          accessibilityLiveRegion="polite"
          numberOfLines={2}
        >
          {problema ?? 'Habla con calma. Toca el micrófono otra vez cuando termines.'}
        </Text>
      )}
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
  micWrap: { width: 44, height: 44, marginBottom: 2, marginRight: 4, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  aviso: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 8, paddingHorizontal: 12, maxWidth: 720, alignSelf: 'center' },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
});
