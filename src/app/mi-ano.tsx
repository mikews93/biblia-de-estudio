// /mi-ano: «Mi año con la Palabra», el resumen del año al estilo de los «Wrapped» con una tarjeta vertical para
// compartir en Historias. Sale solo de lo que la app guarda (src/lib/miAno.ts).
import { Stack, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import Appear from '@/components/Appear';
import { IconText } from '@/components/comunidad/ui';
import { ShareIcon } from '@/components/icons';
import MiAnoTarjeta from '@/components/MiAnoTarjeta';
import { IMAGE_SIZE } from '@/lib/compartir';
import { useDiario } from '@/lib/diario';
import { useAllHighlights } from '@/lib/highlights';
import { hayAlgo, resumenDelAño } from '@/lib/miAno';
import { Tarjeta, drawMiAno, tarjetaDe } from '@/lib/miAnoImagen';
import { useNotes } from '@/lib/notas';
import { useOraciones } from '@/lib/oraciones';
import { useProgress } from '@/lib/progress';
import { useSellos } from '@/lib/sellos';
import { serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function MiAno() {
  const colors = useColors();
  const { settings } = useSettings();
  const { width, height } = useWindowDimensions();
  const progreso = useProgress();
  const sellos = useSellos();
  const resaltados = useAllHighlights();
  const notas = useNotes();
  const diario = useDiario();
  const oraciones = useOraciones();
  const resumen = resumenDelAño({ progreso, sellos, resaltados, notas, diario, oraciones });
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const vista = useRef<ComponentRef<typeof View>>(null);
  const clave = JSON.stringify(resumen);

  useEffect(() => {
    let vivo = true;
    tarjetaDe(resumen, settings.version).then((t) => vivo && setTarjeta(t));
    return () => {
      vivo = false;
    };
  }, [clave, settings.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const ancho = Math.min(340, width - 40, ((height - 260) * 9) / 16);
  const ir = (href: string) => navigate(() => router.push(href as never), 'forward');

  const compartir = async (descargar = false) => {
    if (!tarjeta) return;
    setBusy(true);
    setNota(null);
    try {
      const nombre = `mi-ano-con-la-palabra-${resumen.año}.png`;
      if (Platform.OS === 'web') {
        const file = new File([await drawMiAno(tarjeta)], nombre, { type: 'image/png' });
        if (!descargar && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] }).catch((e) => {
            if ((e as Error).name !== 'AbortError') throw e;
          });
        } else {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = nombre;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setNota(descargar ? 'Imagen descargada' : 'Este navegador no comparte imágenes: la descargamos para que la subas.');
        }
      } else {
        const { width: w, height: h } = IMAGE_SIZE.historia;
        const uri = await captureRef(vista, { format: 'png', quality: 1, width: w, height: h });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Mi año con la Palabra' });
      }
    } catch (e) {
      setNota(e instanceof Error ? e.message : 'No se pudo compartir');
    } finally {
      setBusy(false);
    }
  };

  const detalle: { n: number | string; label: string }[] = [
    ...(tarjeta?.libro ? [{ n: tarjeta.libro, label: 'el libro al que más volviste' }] : []),
    { n: resumen.semanasMeta, label: resumen.semanasMeta === 1 ? 'semana con la meta de 5 días' : 'semanas con la meta de 5 días' },
    { n: resumen.notas, label: resumen.notas === 1 ? 'nota en un versículo' : 'notas en versículos' },
    { n: resumen.diario, label: resumen.diario === 1 ? 'día en el diario' : 'días en el diario' },
    { n: resumen.compartidos, label: resumen.compartidos === 1 ? 'versículo compartido' : 'versículos compartidos' },
    { n: resumen.sellos, label: resumen.sellos === 1 ? 'sello ganado' : 'sellos ganados' },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: `Mi ${resumen.año}` }} />
      <Text style={[styles.kicker, { color: colors.warm }]}>MI AÑO CON LA PALABRA</Text>
      <Text style={[styles.title, { color: colors.text }]}>Tu {resumen.año} con la Palabra</Text>

      {!hayAlgo(resumen) ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.lead, { color: colors.text }]}>
            Tu año empieza hoy. Cada día que leas, resaltes un versículo, ores o descubras una palabra en hebreo o griego, se va sumando aquí.
          </Text>
          <Pressable onPress={() => ir('/')} style={[styles.primary, { backgroundColor: colors.accent }]} accessibilityRole="button">
            <Text style={{ color: colors.surface, fontWeight: '700' }}>Empezar con la lectura de hoy</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.layout, width >= 900 && styles.wide]}>
          <Appear style={{ alignItems: 'center' }}>
            <View style={[styles.frame, { borderColor: colors.border }]}>
              {tarjeta ? <MiAnoTarjeta tarjeta={tarjeta} width={ancho} viewRef={vista} /> : <ActivityIndicator style={{ width: ancho, height: (ancho * 16) / 9 }} />}
            </View>
          </Appear>
          <View style={styles.side}>
            <Text style={[styles.lead, { color: colors.muted }]}>
              Lo que Dios fue haciendo contigo este año, en números. Compártelo en tus Historias: a alguien le puede dar ganas de empezar.
            </Text>
            <Pressable
              onPress={() => compartir()}
              disabled={busy || !tarjeta}
              style={[styles.primary, { backgroundColor: colors.accent }, (busy || !tarjeta) && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <IconText icon={ShareIcon} color={colors.surface} size={18} gap={8}>
                <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>{busy ? 'Preparando…' : 'Compartir mi año'}</Text>
              </IconText>
            </Pressable>
            {Platform.OS === 'web' && (
              <Pressable onPress={() => compartir(true)} disabled={busy || !tarjeta} hitSlop={8} style={{ alignSelf: 'center' }}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Descargar</Text>
              </Pressable>
            )}
            {nota && <Text style={{ color: colors.muted, textAlign: 'center' }}>{nota}</Text>}
            <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.listTitle, { color: colors.text }]}>Y además</Text>
              {detalle.map((d) => (
                <View key={d.label} style={[styles.item, { borderColor: colors.border }]}>
                  <Text style={[styles.itemN, { color: colors.warm }]}>{d.n}</Text>
                  <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', fontFamily: serif, marginTop: 4, marginBottom: 16 },
  lead: { fontSize: 15, lineHeight: 22 },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, gap: 16 },
  layout: { gap: 20 },
  wide: { flexDirection: 'row', alignItems: 'flex-start', gap: 36, justifyContent: 'center' },
  frame: { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  side: { gap: 14, maxWidth: 440, width: '100%', alignSelf: 'center' },
  primary: { borderRadius: 24, paddingVertical: 13, alignItems: 'center' },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, marginTop: 6 },
  listTitle: { fontFamily: serif, fontSize: 19, fontWeight: '700', paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  itemN: { fontFamily: serif, fontSize: 22, fontWeight: '700', minWidth: 44 },
});
