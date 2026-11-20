// Aviso de derechos de una versión con licencia (NBLA, LBLA, NVI, NTV, NIV), con los enlaces que piden sus editores.
// Va junto al texto cada vez que se muestra: arriba del capítulo en forma corta y, al terminar el texto, completo.
// Las versiones libres no muestran nada (su crédito ya sale en el pie del lector).
import { Linking, StyleSheet, Text, View } from 'react-native';

import { LICENSED, type Licensed } from '@/lib/licenciadas';
import type { Colors } from '@/lib/theme';

/** La versión con licencia por su id («nbla») o su sigla («NBLA»); null si es libre. */
export function versionConDerechos(idOSigla: string | null | undefined): Licensed | null {
  if (!idOSigla) return null;
  const k = idOSigla.toLowerCase();
  return LICENSED.find((v) => v.id === k || v.abbr.toLowerCase() === k) ?? null;
}

/** «Copyright © 2005 by The Lockman Foundation»: el tramo del aviso con el año y el titular. */
export function titularDe(v: Licensed) {
  return v.credit.split(' · ')[1] ?? v.credit;
}

type Props = {
  /** Id o sigla de la versión que se muestra. */
  version: string | null | undefined;
  colors: Colors;
  /** «corto»: una línea con sigla, titular y enlace; «completo»: el aviso entero con todos los enlaces. */
  forma?: 'corto' | 'completo';
  /** Aviso tal como lo da la API (API.Bible o YouVersion), si llegó con el capítulo y dice algo distinto. */
  deLaApi?: string | null;
  align?: 'center' | 'left';
};

export default function AvisoDerechos({ version, colors, forma = 'completo', deLaApi, align = 'center' }: Props) {
  const v = versionConDerechos(version);
  if (!v) return null;
  const abrir = (url: string) => Linking.openURL(url).catch(() => {});
  const ta = { textAlign: align } as const;

  if (forma === 'corto') {
    const enlace = v.links[0];
    return (
      <Text style={[styles.corto, ta, { color: colors.muted }]} accessibilityRole="text" testID="aviso-derechos-corto">
        {v.abbr} · {titularDe(v).replace(/^Copyright /, '')} · Usado con permiso
        {enlace ? (
          <>
            {' · '}
            <Text
              style={[styles.enlace, { color: colors.accent }]}
              onPress={() => abrir(enlace.url)}
              accessibilityRole="link"
            >
              {enlace.label.replace(/ \(.*\)$/, '')}
            </Text>
          </>
        ) : null}
      </Text>
    );
  }

  const api = deLaApi && !v.credit.includes(deLaApi.trim()) ? deLaApi.trim() : null;
  return (
    <View
      style={[
        styles.caja,
        {
          borderColor: colors.border,
          alignItems: align === 'center' ? 'center' : 'flex-start',
        },
      ]}
      testID="aviso-derechos"
    >
      <Text style={[styles.nombre, ta, { color: colors.text }]}>
        {v.name} ({v.abbr})
      </Text>
      <Text style={[styles.texto, ta, { color: colors.muted }]}>{v.credit.split(' · ').slice(1).join('. ')}</Text>
      {api ? <Text style={[styles.texto, ta, { color: colors.muted }]}>{api}</Text> : null}
      <View style={[styles.enlaces, { justifyContent: align === 'center' ? 'center' : 'flex-start' }]}>
        {v.links.map((l) => (
          <Text
            key={l.url}
            style={[styles.enlace, { color: colors.accent }]}
            onPress={() => abrir(l.url)}
            accessibilityRole="link"
          >
            {l.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  corto: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  caja: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  nombre: { fontSize: 13, fontWeight: '700' },
  texto: { fontSize: 12, lineHeight: 17 },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 2 },
  enlace: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});
