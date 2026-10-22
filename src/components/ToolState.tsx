import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconText } from '@/components/comunidad/ui';
import Welcome from '@/components/comunidad/Welcome';
import { RefreshIcon } from '@/components/icons';
import { NeedsConnection } from '@/components/SinConexion';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { Colors } from '@/lib/theme';

type Props = {
  colors: Colors;
  busy: boolean;
  error: string | null;
  /** Lo que se ve mientras la IA trabaja y todavía no hay nada que mostrar */
  waiting: string | null;
  onRetry: () => void;
};

/** Espera, error y reintento comunes a las herramientas de estudio del capítulo. */
export function ToolState({ colors, busy, error, waiting, onRetry }: Props) {
  if (error === NEEDS_CONNECTION) {
    return (
      <View style={styles.box}>
        <NeedsConnection title="Se prepara con IA, en internet" intro="El resumen en audio, las tarjetas y el mapa mental se hacen con IA. Los que ya preparaste siguen aquí; para uno nuevo hace falta conexión." />
      </View>
    );
  }
  if (error === NEEDS_ACCOUNT) {
    return (
      <View style={styles.box}>
        <Welcome kind="ia" title="Se prepara con IA" intro="El resumen en audio, las tarjetas y el mapa mental se hacen con IA a partir del capítulo. Solo necesitas una cuenta gratuita." onReady={onRetry} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.box}>
        <Text style={{ color: colors.text, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={onRetry} style={[styles.retry, { borderColor: colors.accent }]} accessibilityRole="button">
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }
  if (busy && waiting) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>{waiting}</Text>
      </View>
    );
  }
  return null;
}

/** Aviso de fuentes y opción de pedir una versión nueva. */
export function ToolFooter({ colors, done, onRegenerate, text }: { colors: Colors; done: boolean; onRegenerate: () => void; text?: string }) {
  return (
    <View style={{ alignItems: 'center', marginTop: 24, gap: 10 }}>
      <Text style={[styles.disclaimer, { color: colors.muted }]}>
        {text ??
          'Generado con IA solo a partir de la Reina-Valera 1909, el griego de STEPBible y las referencias de OpenBible.info. Los números llevan a la fuente de cada idea.'}
      </Text>
      {done && (
        <Pressable onPress={onRegenerate} accessibilityRole="button" hitSlop={8}>
          <IconText icon={RefreshIcon} color={colors.accent} size={14}>
            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Preparar otra versión</Text>
          </IconText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  retry: { marginTop: 12, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  disclaimer: { fontSize: 12, lineHeight: 17, textAlign: 'center', maxWidth: 520 },
});
