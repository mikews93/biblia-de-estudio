import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Measure, Picture, getStudyContext } from '@/lib/data';
import { Colors, serif, useColors } from '@/lib/theme';

type Props = {
  book: string;
  chapter: number;
  verse?: number;
  /** Abre un versículo del capítulo (referencia «jhn.2.6»). */
  onOpen: (ref: string) => void;
  /** Abre el mapa con los lugares del capítulo. */
  onOpenMap: () => void;
};

/** Medidas antiguas con su equivalencia moderna e imágenes de objetos, lugares y mapas del pasaje. */
export default function StudyContext({ book, chapter, verse, onOpen, onOpenMap }: Props) {
  const colors = useColors();
  const key = `${book}.${chapter}`;
  const [loaded, setLoaded] = useState<{ key: string; medidas: Measure[]; imagenes: Picture[] } | null>(null);
  const [zoom, setZoom] = useState<Picture | null>(null);

  useEffect(() => {
    let alive = true;
    getStudyContext(book, chapter)
      .then((d) => alive && setLoaded({ key, ...d }))
      .catch(() => alive && setLoaded({ key, medidas: [], imagenes: [] }));
    return () => {
      alive = false;
    };
  }, [book, chapter, key]);

  const data = loaded?.key === key ? loaded : null;
  if (!data) return null;
  // En el estudio de un versículo solo lo que ese versículo menciona (los mapas del capítulo, siempre).
  const inVerse = (verses: number[]) => !verse || verses.includes(verse);
  const measures = data.medidas.filter((m) => inVerse(m.verses));
  const pictures = data.imagenes.filter((p) => (p.verses.length ? inVerse(p.verses) : true));
  if (!measures.length && !pictures.length) return null;

  const verseLinks = (verses: number[]) =>
    verse ? null : (
      <View style={styles.verses}>
        {verses.map((n) => (
          <Pressable
            key={n}
            onPress={() => onOpen(`${book}.${chapter}.${n}`)}
            hitSlop={6}
            accessibilityLabel={`Ir al versículo ${n}`}
          >
            <Text style={[styles.verse, { color: colors.accent, borderColor: colors.border }]}>v. {n}</Text>
          </Pressable>
        ))}
      </View>
    );

  return (
    <Appear>
      {!!measures.length && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.h2, { color: colors.text }]}>Medidas antiguas</Text>
          <Text style={[styles.lead, { color: colors.muted }]}>
            Lo que equivalen hoy las medidas que se nombran {verse ? 'en este versículo' : 'en el capítulo'}.
          </Text>
          {measures.map((m) => (
            <View key={m.id} style={[styles.measure, { borderColor: colors.border }]}>
              <View style={styles.measureTop}>
                <Text style={[styles.measureName, { color: colors.text }]}>
                  {m.name} <Text style={[styles.kind, { color: colors.muted }]}>· {m.kind.toLowerCase()}</Text>
                </Text>
                <Text style={[styles.value, { color: colors.accent }]}>{m.value}</Text>
              </View>
              <Text style={[styles.note, { color: colors.text }]}>{m.note}</Text>
              {verseLinks(m.verses)}
            </View>
          ))}
          <Text style={[styles.credit, { color: colors.muted }]}>
            Valores aproximados de los diccionarios bíblicos; variaban según la época y la región.
          </Text>
        </View>
      )}

      {!!pictures.length && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.h2, { color: colors.text }]}>Imágenes</Text>
          <Text style={[styles.lead, { color: colors.muted }]}>
            Objetos, lugares y mapas {verse ? 'del versículo' : 'del capítulo'}, con imágenes de licencia libre.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {pictures.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setZoom(p)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityLabel={`Ver imagen: ${p.title}`}
              >
                <Image
                  source={{ uri: p.img }}
                  style={[styles.thumb, { backgroundColor: colors.accentSoft }]}
                  resizeMode={p.kind === 'mapa' ? 'contain' : 'cover'}
                />
                <View style={styles.cardBody}>
                  <Text style={[styles.cardKind, { color: colors.accent }]}>{p.kind.toUpperCase()}</Text>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                    {p.title}
                  </Text>
                  {!verse && !!p.verses.length && (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      v. {p.verses.join(', ')}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
          {pictures.some((p) => p.kind === 'lugar') && (
            <Pressable onPress={onOpenMap} hitSlop={8} accessibilityRole="link">
              <Text style={[styles.mapLink, { color: colors.accent }]}>Ver los lugares en el mapa ›</Text>
            </Pressable>
          )}
        </View>
      )}

      {zoom && <Viewer picture={zoom} colors={colors} onClose={() => setZoom(null)} />}
    </Appear>
  );
}

function Viewer({ picture: p, colors, onClose }: { picture: Picture; colors: Colors; onClose: () => void }) {
  const source = p.page.includes('commons.wikimedia.org') ? 'Wikimedia Commons' : 'Wikipedia';
  const credit = [p.author, p.license, source].filter(Boolean).join(' · ');
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.viewerBackdrop} onPress={onClose} accessibilityLabel="Cerrar imagen">
        <Pressable style={[styles.viewer, { backgroundColor: colors.background }]} onPress={() => {}}>
          <Image
            source={{ uri: p.img }}
            style={{ width: '100%', aspectRatio: p.w && p.h ? Math.max(p.w / p.h, 0.6) : 4 / 3 }}
            resizeMode="contain"
            accessibilityLabel={p.title}
          />
          <View style={{ padding: 16 }}>
            <Text style={[styles.viewerTitle, { color: colors.text }]}>{p.title}</Text>
            <Text style={[styles.note, { color: colors.text, marginTop: 6 }]}>{p.caption}</Text>
            <Pressable onPress={() => Linking.openURL(p.page)} accessibilityRole="link">
              <Text style={[styles.credit, { color: colors.muted, textAlign: 'left' }]}>
                {credit} <Text style={{ color: colors.accent }}>Ver fuente ›</Text>
              </Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.close, { borderColor: colors.accent }]}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Cerrar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 20, paddingTop: 4 },
  h2: { fontSize: 19, fontFamily: serif, fontWeight: '600', marginTop: 14, marginBottom: 2 },
  lead: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  measure: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  measureTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  measureName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  kind: { fontSize: 13, fontWeight: '400' },
  value: { fontSize: 15, fontWeight: '700', textAlign: 'right', flexShrink: 0, maxWidth: '55%' },
  note: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  verses: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  verse: {
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  mapLink: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  credit: { fontSize: 12, lineHeight: 17, marginTop: 10, textAlign: 'center' },
  row: { gap: 12, paddingVertical: 4, paddingRight: 8 },
  card: { width: 200, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  thumb: { width: '100%', height: 130 },
  cardBody: { padding: 10 },
  cardKind: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  cardTitle: { fontSize: 14, fontWeight: '600', marginTop: 2, lineHeight: 19 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  viewer: { borderRadius: 14, overflow: 'hidden', maxWidth: 720, width: '100%', alignSelf: 'center', maxHeight: '95%' },
  viewerTitle: { fontSize: 19, fontFamily: serif, fontWeight: '600' },
  close: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
});
