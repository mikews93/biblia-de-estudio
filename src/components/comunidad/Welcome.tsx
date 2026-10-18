import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/lib/comunidad';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { Button, text } from './ui';

/**
 * Invitación a crear la cuenta o entrar, donde hace falta una (comunidad e IA). Lleva a las pantallas
 * /registro y /entrar, que al terminar vuelven aquí; si se pasa onReady, se llama al aparecer la cuenta
 * (por ejemplo, para reintentar el pedido a la IA).
 */
export default function Welcome({ intro, onReady }: { intro?: string; onReady?: () => void }) {
  const colors = useColors();
  const { usuario } = useAccount();
  const notified = useRef(false);

  useEffect(() => {
    if (usuario && onReady && !notified.current) {
      notified.current = true;
      onReady();
    }
  }, [usuario, onReady]);

  return (
    <View style={styles.wrap}>
      <Text style={[text.body, { color: colors.text }]}>
        {intro ??
          'Lee la Biblia en compañía: crea un grupo privado para tu iglesia, tu célula o tu familia, sigan un plan de lectura juntos y oren unos por otros.'}
      </Text>
      <Button label="Crear cuenta gratis" onPress={() => navigate(() => router.push('/registro'), 'forward')} />
      <Button label="Ya tengo cuenta" kind="outline" onPress={() => navigate(() => router.push('/entrar'), 'forward')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, alignSelf: 'stretch' },
});
