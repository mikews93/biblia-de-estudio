import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { inviteUrl } from '@/lib/comunidad';
import { useColors } from '@/lib/theme';

import { Button, Card, text } from './ui';

/** El código y el enlace para invitar al grupo. */
export default function Invite({ name, code, highlight }: { name: string; code: string; highlight?: boolean }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(code);
  const message = `Te invito a leer la Biblia con «${name}». Únete aquí: ${url}`;
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);

  const copy = async () => {
    await Clipboard.setStringAsync(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card style={highlight ? { borderColor: colors.accent, borderWidth: 1.5 } : undefined}>
      <Text style={[text.body, { color: colors.text, fontWeight: '700' }]}>
        {highlight ? 'Tu grupo está listo. Invita a los demás' : 'Invitar al grupo'}
      </Text>
      <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>
        Solo entra quien tenga el enlace o el código. Nadie puede encontrar el grupo buscándolo.
      </Text>
      <Text style={[styles.code, { color: colors.accent }]} selectable>
        {code}
      </Text>
      <View style={styles.row}>
        <Button label={copied ? 'Enlace copiado' : 'Copiar enlace'} kind="outline" onPress={copy} style={{ flex: 1 }} />
        {canShare && (
          <Button label="Compartir" onPress={() => Share.share({ message, url }).catch(() => {})} style={{ flex: 1 }} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 28, fontWeight: '700', letterSpacing: 6, textAlign: 'center', marginVertical: 16, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: 10 },
});
