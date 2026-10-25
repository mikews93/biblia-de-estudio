// /ocasiones: mandarle un versículo a alguien según lo que vive (cumpleaños, duelo, enfermedad, examen…). Cada
// ocasión trae versículos escogidos y su fondo; con IA, la persona puede contar qué pasa y recibir otros.
import { useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';

import Appear from '@/components/Appear';
import { IconText } from '@/components/comunidad/ui';
import { ShareIcon, SparkIcon } from '@/components/icons';
import VerseImage from '@/components/VerseImage';
import { searchByIdea } from '@/lib/buscar';
import type { VerseToShare } from '@/lib/compartir';
import { fondoPorNombre, idsUnicos } from '@/lib/fondos';
import { OCASIONES, Ocasion, ocasionPorId, versiculosDe } from '@/lib/ocasiones';
import { parseRef } from '@/lib/refs';
import { serif, useColors } from '@/lib/theme';

type Sugerido = VerseToShare & { razon?: string };

export default function Ocasiones() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ ocasion?: string }>();
  const columns = width >= 900 ? 4 : 2;
  const [ocasion, setOcasion] = useState<Ocasion | undefined>(ocasionPorId(params.ocasion));
  const [versos, setVersos] = useState<VerseToShare[] | null>(null);
  const [historia, setHistoria] = useState('');
  const [ia, setIa] = useState<{ estado: 'listo' | 'buscando' | 'error'; items: Sugerido[]; error?: string }>({ estado: 'listo', items: [] });
  const [compartiendo, setCompartiendo] = useState<VerseToShare | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const listaY = useRef(0);

  useEffect(() => {
    if (!ocasion) return;
    let vivo = true;
    versiculosDe(ocasion).then((v) => vivo && setVersos(v));
    return () => {
      vivo = false;
    };
  }, [ocasion]);

  const elegir = (o: Ocasion) => {
    setVersos(null);
    setIa({ estado: 'listo', items: [] });
    setOcasion(o);
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, listaY.current - 12), animated: true }), 60);
  };

  const buscar = async () => {
    if (!ocasion || !historia.trim()) return;
    setIa({ estado: 'buscando', items: [] });
    try {
      const { results } = await searchByIdea(`${ocasion.consulta}. Lo que está pasando: ${historia.trim()}`, 'rv1909');
      const items = results.map((r): Sugerido => {
        const { start } = parseRef(r.ref);
        return { book: start.book, chapter: start.chapter, verse: start.verse, text: r.text, reference: r.label, version: r.version.toUpperCase(), razon: r.reason };
      });
      setIa({ estado: 'listo', items });
    } catch (e) {
      setIa({ estado: 'error', items: [], error: e instanceof Error ? e.message : 'No se pudo buscar' });
    }
  };

  const fondo = useMemo(() => fondoPorNombre(ocasion?.fondo), [ocasion]);

  const tarjeta = (v: Sugerido, i: number) => (
    <Appear key={`${v.book}.${v.chapter}.${v.verse}`} delay={i * 30}>
      <Pressable
        onPress={() => setCompartiendo(v)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.verse,
          { backgroundColor: colors.surface, borderColor: hovered ? colors.warm : colors.border },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Enviar ${v.reference}`}
      >
        <Text style={[styles.verseText, { color: colors.text }]}>«{v.text}»</Text>
        {v.razon ? <Text style={[styles.reason, { color: colors.muted }]}>{v.razon}</Text> : null}
        <View style={styles.verseFoot}>
          <Text style={[styles.ref, { color: colors.warm }]}>{v.reference}</Text>
          <IconText icon={ShareIcon} color={colors.accent} size={15}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Enviar</Text>
          </IconText>
        </View>
      </Pressable>
    </Appear>
  );

  return (
    <>
      <ScrollView ref={scroll} style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>¿A quién le hace falta hoy un versículo?</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          Elige lo que está viviendo esa persona. Te damos versículos para el momento y una imagen lista para enviarle.
        </Text>

        <View style={[styles.grid, { marginHorizontal: -6 }]}>
          {OCASIONES.map((o, i) => {
            const f = fondoPorNombre(o.fondo);
            const on = o.id === ocasion?.id;
            return (
              <Appear key={o.id} delay={i * 30} style={{ width: `${100 / columns}%`, padding: 6 }}>
                <Pressable
                  onPress={() => elegir(o)}
                  style={({ pressed }) => [styles.card, { borderColor: on ? colors.warm : colors.border, backgroundColor: f.background }, pressed && styles.pressed]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                  accessibilityLabel={`${o.nombre}. ${o.para}`}
                >
                  {f.svg && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                      <SvgXml xml={idsUnicos(f.svg(600, 400), `o${o.id}`)} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
                    </View>
                  )}
                  <Text style={[styles.cardName, { color: f.text, textShadowColor: f.sombra ?? 'transparent' }]}>{o.nombre}</Text>
                  <Text style={[styles.cardFor, { color: f.text, textShadowColor: f.sombra ?? 'transparent' }]} numberOfLines={2}>
                    {o.para}
                  </Text>
                </Pressable>
              </Appear>
            );
          })}
        </View>

        <View onLayout={(e) => (listaY.current = e.nativeEvent.layout.y)}>
          {ocasion && (
            <View style={styles.section}>
              <Text style={[styles.kicker, { color: colors.warm }]}>{ocasion.nombre.toUpperCase()}</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Versículos para enviar</Text>
              <Text style={[styles.lead, { color: colors.muted, marginBottom: 4 }]}>
                Toca uno: se abre la imagen con el fondo {fondo.name.toLowerCase()} y «{ocasion.dedicatoria}», y puedes cambiar lo que quieras.
              </Text>
              {versos === null ? <ActivityIndicator color={colors.muted} style={{ marginVertical: 20 }} /> : versos.map(tarjeta)}

              <View style={[styles.askBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconText icon={SparkIcon} color={colors.text} size={18} gap={8}>
                  <Text style={[styles.askTitle, { color: colors.text }]}>Cuéntanos qué está pasando</Text>
                </IconText>
                <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
                  Unas palabras bastan, por ejemplo «mi tía empieza la quimioterapia el lunes». Buscamos versículos para eso.
                </Text>
                <TextInput
                  value={historia}
                  onChangeText={setHistoria}
                  placeholder="Lo que vive esa persona"
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={300}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  accessibilityLabel="Lo que está pasando"
                />
                <Pressable
                  onPress={buscar}
                  disabled={!historia.trim() || ia.estado === 'buscando'}
                  style={[styles.primary, { backgroundColor: colors.accent }, (!historia.trim() || ia.estado === 'buscando') && { opacity: 0.5 }]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.surface, fontWeight: '700' }}>{ia.estado === 'buscando' ? 'Buscando…' : 'Buscar versículos'}</Text>
                </Pressable>
                {ia.estado === 'error' && <Text style={{ color: '#B3412E' }}>{ia.error}</Text>}
              </View>
              {ia.items.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>Para lo que contaste</Text>
                  {ia.items.map(tarjeta)}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      {compartiendo && ocasion && (
        <VerseImage verse={compartiendo} inicial={{ fondo: ocasion.fondo, dedicatoria: ocasion.dedicatoria }} onClose={() => setCompartiendo(null)} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 56, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 4, fontFamily: serif },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 14, maxWidth: 620 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { height: 116, borderRadius: 18, borderWidth: 2, padding: 14, justifyContent: 'flex-end', overflow: 'hidden' },
  cardName: { fontSize: 20, fontWeight: '700', fontFamily: serif, textShadowRadius: 8 },
  cardFor: { fontSize: 12.5, marginTop: 2, opacity: 0.92, textShadowRadius: 6 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  section: { marginTop: 20, gap: 10 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  sectionTitle: { fontSize: 22, fontWeight: '700', fontFamily: serif },
  verse: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 8 },
  verseText: { fontSize: 17, lineHeight: 26, fontFamily: serif },
  reason: { fontSize: 13.5, lineHeight: 19 },
  verseFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontWeight: '700', fontSize: 14 },
  askBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 10, marginTop: 8 },
  askTitle: { fontSize: 17, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70, fontSize: 15, textAlignVertical: 'top' },
  primary: { borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
});
