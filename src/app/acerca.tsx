import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Button, text } from '@/components/comunidad/ui';
import { CheckIcon, CloudCheckIcon, CommentIcon, CopyIcon, DevicesIcon, type IconProps, RefreshIcon } from '@/components/icons';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import {
  commitCorto,
  compilacion,
  estado as estadoDe,
  type Estado,
  etiqueta,
  fechaLegible,
  nombrePlataforma,
  type Publicada,
  textoParaReportar,
  ultimaPublicada,
} from '@/lib/version';

const CORREO = 'hola@zarzabiblia.com';
const mono = Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', ios: 'Menlo', default: 'monospace' });

/**
 * Acerca de Zarza: qué versión corre en este teléfono, si hay una más nueva, y los datos para copiar al reportar un fallo.
 * Se llega desde el pie de Hoy y desde Tu perfil (src/lib/version.ts).
 */
export default function AcercaScreen() {
  const colors = useColors();
  const c = useMemo(() => compilacion(), []);
  const [publicada, setPublicada] = useState<Publicada | null | undefined>(undefined);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    ultimaPublicada().then(setPublicada);
  }, []);
  const comprobar = () => {
    setPublicada(undefined);
    ultimaPublicada().then(setPublicada);
  };

  const copiar = async () => {
    await Clipboard.setStringAsync(textoParaReportar(c));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  };

  const reportar = () => {
    const cuerpo = `Cuéntanos qué pasó y dónde:\n\n\n—\n${textoParaReportar(c)}`;
    Linking.openURL(`mailto:${CORREO}?subject=${encodeURIComponent(`Fallo en Zarza ${etiqueta(c)}`)}&body=${encodeURIComponent(cuerpo)}`);
  };

  const filas: [string, string, boolean?][] = [
    ['Versión', c.version],
    ...(c.build ? [['Compilación', c.build] as [string, string]] : []),
    ['Commit', c.commit ? commitCorto(c.commit) : 'sin dato', true],
    ['Compilada', fechaLegible(c.fecha) || 'sin dato'],
    ['Dónde corre', nombrePlataforma(c)],
    ...(c.rama && c.rama !== 'main' ? [['Rama', c.rama, true] as [string, string, boolean]] : []),
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Acerca de Zarza' }} />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={[styles.nombre, { color: colors.text }]}>Zarza</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center' }]}>Biblia de estudio</Text>
          <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.chipText, { color: colors.accent }]} selectable>
              Versión {etiqueta(c)}
            </Text>
          </View>
        </View>
      </Appear>

      <Appear delay={40}>
        <EstadoCard colors={colors} estado={publicada === undefined ? undefined : estadoDe(c, publicada)} publicada={publicada} nativa={c.plataforma !== 'web'} onComprobar={comprobar} />
      </Appear>

      <Appear delay={70}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <CardHead colors={colors} Icon={DevicesIcon} titulo="Esta copia de la app" />
          <View style={{ marginTop: 6 }}>
            {filas.map(([k, v, code], i) => (
              <View key={k} style={[styles.fila, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                <Text style={[styles.clave, { color: colors.muted }]}>{k}</Text>
                <Text style={[styles.valor, { color: colors.text }, code && { fontFamily: mono, fontSize: 14 }]} selectable numberOfLines={2}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Appear>

      <Appear delay={100}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <CardHead colors={colors} Icon={CommentIcon} titulo="¿Encontraste un fallo?" />
          <Text style={[text.body, { color: colors.muted, marginTop: 8 }]}>
            Copia estos datos y pégalos al contarnos qué pasó. Así sabemos en qué versión ocurrió y si ya está corregido.
          </Text>
          <View style={styles.botones}>
            <Button label={copiado ? 'Copiado' : 'Copiar datos'} icon={copiado ? CheckIcon : CopyIcon} onPress={copiar} />
            <Button label="Escribirnos" kind="outline" onPress={reportar} />
          </View>
        </View>
      </Appear>

      <Text style={[text.small, { color: colors.muted, textAlign: 'center', marginTop: 4 }]}>
        Zarza · {CORREO}
      </Text>
    </ScrollView>
  );
}

function EstadoCard({
  colors,
  estado,
  publicada,
  nativa,
  onComprobar,
}: {
  colors: Colors;
  estado: Estado | undefined;
  publicada: Publicada | null | undefined;
  nativa: boolean;
  onComprobar: () => void;
}) {
  const nueva = estado === 'nueva';
  const titulo =
    estado === undefined
      ? 'Buscando versiones nuevas…'
      : estado === 'al-dia'
        ? 'Tienes la versión más reciente'
        : nueva
          ? nativa
            ? 'Hay cambios más nuevos en la web'
            : 'Hay una versión más nueva'
          : 'No pudimos comprobar si hay una nueva';
  const detalle =
    estado === undefined
      ? 'Un momento.'
      : estado === 'al-dia'
        ? 'Todo lo que ya corregimos está en tu teléfono.'
        : nueva
          ? nativa
            ? `Publicados el ${fechaLegible(publicada!.fecha)}. Llegarán a esta app con su próxima versión; mientras, la web ya los tiene.`
            : `Publicada el ${fechaLegible(publicada!.fecha)}. Actualiza para tener lo último que corregimos.`
          : 'Revisa tu conexión e inténtalo de nuevo.';

  return (
    <View
      style={[
        styles.card,
        styles.estado,
        nueva ? { backgroundColor: colors.accent, borderColor: colors.accent } : { backgroundColor: colors.surface, borderColor: colors.border },
        shadow(colors),
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.estadoIcon, { backgroundColor: nueva ? 'rgba(255,255,255,0.18)' : colors.accentSoft }]}>
        {estado === undefined ? (
          <ActivityIndicator color={colors.accent} />
        ) : nueva ? (
          <RefreshIcon color={colors.background} size={22} />
        ) : estado === 'al-dia' ? (
          <CloudCheckIcon color={colors.accent} size={22} />
        ) : (
          <RefreshIcon color={colors.accent} size={22} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.estadoTitulo, { color: nueva ? colors.background : colors.text }]}>{titulo}</Text>
        <Text style={[text.small, { color: nueva ? colors.background : colors.muted, lineHeight: 19, opacity: nueva ? 0.9 : 1 }]}>{detalle}</Text>
        {nueva && !nativa && (
          <Pressable
            onPress={() => window.location.reload()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.actualizar, { backgroundColor: colors.background }, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Actualizar ahora</Text>
          </Pressable>
        )}
        {estado === 'desconocido' && (
          <Pressable onPress={onComprobar} accessibilityRole="button" hitSlop={8} style={{ marginTop: 6 }}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Volver a comprobar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function CardHead({ colors, Icon, titulo }: { colors: Colors; Icon: (p: IconProps) => React.ReactNode; titulo: string }) {
  return (
    <View style={styles.cardHead}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <Icon color={colors.accent} size={18} />
      </View>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{titulo}</Text>
    </View>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, gap: 12, maxWidth: 600, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 4, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  logo: { width: 76, height: 76, borderRadius: 20, marginBottom: 8 },
  nombre: { fontFamily: serif, fontSize: 30, fontWeight: '700' },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 10 },
  chipText: { fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: serif, fontSize: 20, flex: 1 },
  estado: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  estadoIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  estadoTitulo: { fontSize: 16, fontWeight: '700' },
  actualizar: { alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9, marginTop: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 11 },
  clave: { fontSize: 14 },
  valor: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
});
