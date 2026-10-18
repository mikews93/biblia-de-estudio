import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/lib/comunidad';
import { isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { PeopleIcon, SparkIcon } from './icons';
import { Button, text } from './ui';

type Props = {
  intro?: string;
  /** Título corto sobre el texto; si falta, solo se muestra el texto. */
  title?: string;
  /** «ia» para las funciones con IA; por defecto, comunidad. */
  kind?: 'comunidad' | 'ia';
  onReady?: () => void;
};

/**
 * Invitación a crear la cuenta o entrar, donde hace falta una (comunidad e IA). Lleva a las pantallas
 * /registro y /entrar, que al terminar vuelven aquí; si se pasa onReady, se llama al aparecer la cuenta
 * (por ejemplo, para reintentar el pedido a la IA).
 */
export default function Welcome({ intro, title, kind = 'comunidad', onReady }: Props) {
  const colors = useColors();
  const { usuario } = useAccount();
  const notified = useRef(false);
  const Icon = kind === 'ia' ? SparkIcon : PeopleIcon;

  useEffect(() => {
    if (usuario && onReady && !notified.current) {
      notified.current = true;
      onReady();
    }
  }, [usuario, onReady]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !isDark(colors) && { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' },
      ]}
    >
      <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
        <Icon color={colors.accent} size={26} />
      </View>
      {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
      <Text style={[text.body, styles.intro, { color: colors.text }]}>
        {intro ??
          'Lee la Biblia en compañía: crea un grupo privado para tu iglesia, tu célula o tu familia, sigan un plan de lectura juntos y oren unos por otros.'}
      </Text>
      <Button
        label="Crear cuenta gratis"
        onPress={() => navigate(() => router.push('/registro'), 'forward')}
        style={{ alignSelf: 'stretch', marginTop: 4 }}
      />
      <Pressable onPress={() => navigate(() => router.push('/entrar'), 'forward')} hitSlop={8} accessibilityRole="button">
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          ¿Ya tienes cuenta? <Text style={{ color: colors.accent, fontWeight: '700' }}>Entra</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', alignItems: 'center', gap: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  intro: { textAlign: 'center', maxWidth: 420 },
});
