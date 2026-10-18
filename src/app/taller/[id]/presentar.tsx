import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Book, Verse, getBooks, getChapter } from '@/lib/data';
import { dinamica } from '@/lib/dinamicas';
import { enPasaje, ideaCentral, pasajeLabel, tituloDe, useTaller } from '@/lib/taller';
import { sans, serif, useColors } from '@/lib/theme';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Modo presentar: una parte a la vez con letra grande, temporizador por parte y el pasaje a un toque. */
export default function PresentarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mensajes } = useTaller();
  const m = mensajes.find((x) => x.id === id);
  const [books, setBooks] = useState<Book[]>([]);
  const [index, setIndex] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [sectionStart, setSectionStart] = useState(0);
  const [running, setRunning] = useState(true);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [showPassage, setShowPassage] = useState(false);
  const [size, setSize] = useState(22);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const p = m?.pasaje;
  useEffect(() => {
    if (p) getChapter(p.book, p.chapter).then((v) => setVerses(v.filter(([n]) => enPasaje(p, n)))).catch(() => {});
  }, [p?.book, p?.chapter, p?.from, p?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return <Stack.Screen options={{ headerShown: false }} />;

  const sections = m.secciones;
  const s = index >= 0 ? sections[index] : null;
  const go = (n: number) => {
    setIndex(Math.max(-1, Math.min(sections.length - 1, n)));
    setSectionStart(elapsed);
  };
  const inSection = elapsed - sectionStart;
  const over = s && s.minutos ? inSection > s.minutos * 60 : false;
  const d = dinamica(s?.dinamica);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Salir de presentar">
          <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
        </Pressable>
        <Pressable onPress={() => setRunning(!running)} accessibilityLabel={running ? 'Pausar' : 'Seguir'} style={styles.timer}>
          <Text style={{ color: over ? '#B3412E' : colors.text, fontFamily: sans, fontSize: 16, fontVariant: ['tabular-nums'] }}>
            {s ? `${clock(inSection)}${s.minutos ? ` / ${s.minutos}:00` : ''}` : clock(elapsed)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{running ? `Total ${clock(elapsed)}` : 'En pausa'}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={() => setSize((n) => Math.max(16, n - 2))} hitSlop={8} accessibilityLabel="Letra más pequeña">
            <Text style={{ color: colors.muted, fontSize: 15 }}>A−</Text>
          </Pressable>
          <Pressable onPress={() => setSize((n) => Math.min(40, n + 2))} hitSlop={8} accessibilityLabel="Letra más grande">
            <Text style={{ color: colors.muted, fontSize: 19 }}>A+</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {s ? (
          <>
            <Text style={[styles.counter, { color: colors.muted }]}>
              {index + 1} DE {sections.length}
              {s.responsable?.trim() ? ` · GUÍA ${s.responsable.trim().toUpperCase()}` : ''}
            </Text>
            <Text style={[styles.title, { color: colors.accent }]}>{s.titulo}</Text>
            {d && (
              <View style={[styles.box, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: size * 0.8 }}>{d.nombre}</Text>
                {d.pasos.map((step, i) => (
                  <Text key={i} style={{ color: colors.text, fontSize: size * 0.72, lineHeight: size * 1.1, marginTop: 4 }}>
                    {i + 1}. {step}
                  </Text>
                ))}
              </View>
            )}
            {!!s.paraGrupo?.trim() && (
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: size, lineHeight: size * 1.45, marginTop: 16 }}>{s.paraGrupo.trim()}</Text>
            )}
            {!!s.texto.trim() && (
              <Text
                style={{
                  color: s.paraGrupo?.trim() ? colors.muted : colors.text,
                  fontFamily: serif,
                  fontSize: s.paraGrupo?.trim() ? size * 0.8 : size,
                  lineHeight: (s.paraGrupo?.trim() ? size * 0.8 : size) * 1.5,
                  marginTop: 16,
                }}
              >
                {s.texto.trim()}
              </Text>
            )}
            {!s.texto.trim() && !s.paraGrupo?.trim() && !d && (
              <Text style={{ color: colors.muted, fontSize: size * 0.8, marginTop: 16 }}>{s.ayuda}</Text>
            )}
          </>
        ) : (
          <View style={{ paddingTop: 40 }}>
            <Text style={[styles.counter, { color: colors.muted }]}>{pasajeLabel(m.pasaje, books).toUpperCase()}</Text>
            <Text style={{ color: colors.text, fontFamily: serif, fontSize: size * 1.5, fontWeight: '700', marginTop: 8 }}>{tituloDe(m, books)}</Text>
            {ideaCentral(m) ? (
              <Text style={{ color: colors.accent, fontFamily: serif, fontSize: size, lineHeight: size * 1.4, marginTop: 20, fontStyle: 'italic' }}>
                {ideaCentral(m)}
              </Text>
            ) : null}
            <Text style={{ color: colors.muted, marginTop: 28 }}>Toca «Siguiente» para empezar. El temporizador marca cada parte.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottom, { borderColor: colors.border }]}>
        <Pressable onPress={() => go(index - 1)} disabled={index < 0} style={[styles.navBtn, index < 0 && { opacity: 0.3 }]}>
          <Text style={{ color: colors.text, fontSize: 16 }}>‹ Anterior</Text>
        </Pressable>
        {m.pasaje && (
          <Pressable onPress={() => setShowPassage(true)} style={[styles.passageBtn, { borderColor: colors.accent }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Pasaje</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => go(index + 1)}
          disabled={index >= sections.length - 1}
          style={[styles.navBtn, { alignItems: 'flex-end' }, index >= sections.length - 1 && { opacity: 0.3 }]}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Siguiente ›</Text>
        </Pressable>
      </View>

      {showPassage && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowPassage(false)}>
          <Pressable style={styles.backdrop} onPress={() => setShowPassage(false)}>
            <View style={[styles.passage, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.accent, fontWeight: '700', marginBottom: 10 }}>{pasajeLabel(m.pasaje, books)} · RV1909</Text>
              <ScrollView>
                <Text style={{ color: colors.text, fontFamily: serif, fontSize: size * 0.9, lineHeight: size * 1.4 }}>
                  {verses?.map(([n, t]) => (
                    <Text key={n}>
                      <Text style={{ color: colors.accent, fontSize: size * 0.5 }}>{n} </Text>
                      {t}{' '}
                    </Text>
                  ))}
                </Text>
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  timer: { alignItems: 'center' },
  body: { padding: 24, paddingBottom: 40, maxWidth: 820, width: '100%', alignSelf: 'center' },
  counter: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { fontFamily: serif, fontSize: 30, fontWeight: '700', marginTop: 6 },
  box: { borderRadius: 14, padding: 16, marginTop: 16 },
  bottom: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10 },
  navBtn: { flex: 1, paddingVertical: 10 },
  passageBtn: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  passage: { borderRadius: 16, padding: 20, maxHeight: '80%', maxWidth: 760, width: '100%', alignSelf: 'center' },
});
