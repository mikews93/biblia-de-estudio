import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AmbienteBoton from '@/components/Ambiente';
import { IconText } from '@/components/comunidad/ui';
import { LiveDot } from '@/components/evento/piezas';
import ParaLlevar from '@/components/ParaLlevar';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, LiveIcon, MegaphoneIcon, PeopleIcon } from '@/components/icons';
import { CreditoVersion, Tramos, useVersion } from '@/components/vivo/Guion';
import { useAmbienteEnPantalla } from '@/lib/ambiente';
import { useAccount } from '@/lib/comunidad';
import { Book, Verse, getBooks, getChapter } from '@/lib/data';
import { dinamica } from '@/lib/dinamicas';
import { citasDeParte } from '@/lib/guion';
import { codigoLegible, interactuarEvento, moverEvento, useMisEventos } from '@/lib/eventos';
import { anunciosDe, enPasaje, ideaCentral, pasajeLabel, tituloDe, useTaller } from '@/lib/taller';
import { sans, serif, useColors, useSettings } from '@/lib/theme';

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
  // El pasaje en la versión en que lees (las con derechos se piden en el momento), o la RV1909 si no se puede.
  const { settings } = useSettings();
  const [shown, setShown] = useState(settings.version);
  const { abbr } = useVersion(shown);
  // La dinámica que se mandó a los teléfonos de la congregación, por parte.
  const [mandada, setMandada] = useState<string | null>(null);
  // Pads debajo de la voz mientras se presenta; se apagan al salir de presentar.
  useAmbienteEnPantalla();
  // Si el mensaje se publicó como evento, al avanzar aquí avanza también en los teléfonos de la congregación.
  const { usuario } = useAccount();
  const { eventos } = useMisEventos(!!usuario);
  const evento = m?.evento ? eventos?.find((e) => e.codigo === m.evento!.codigo) : undefined;
  const [vivo, setVivo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const enVivo = vivo || evento?.estado === 'en-vivo';
  const sincronizar = (punto: number, estado?: 'en-vivo') => {
    // Un evento publicado antes de escribir los anuncios no tiene ese último punto: se queda en el anterior.
    if (!evento || punto >= evento.puntos.length) return;
    setFallo(false);
    moverEvento(evento.codigo, { punto, ...(estado ? { estado } : {}) }).catch(() => setFallo(true));
  };

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
    if (!p) return;
    const elegir = (v: Verse[]) => setVerses(v.filter(([n]) => enPasaje(p, n)));
    getChapter(p.book, p.chapter, settings.version)
      .then((v) => (setShown(settings.version), elegir(v)))
      .catch(() => getChapter(p.book, p.chapter).then((v) => (setShown('rv1909'), elegir(v))))
      .catch(() => {});
  }, [p?.book, p?.chapter, p?.from, p?.to, settings.version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return <Stack.Screen options={{ headerShown: false }} />;

  const sections = m.secciones;
  // Los anuncios, si los hay, son la última pantalla: después de la última parte.
  const anuncios = anunciosDe(m);
  const total = sections.length + (anuncios.length ? 1 : 0);
  const enAnuncios = anuncios.length > 0 && index === sections.length;
  const s = index >= 0 && !enAnuncios ? sections[index] : null;
  const go = (n: number) => {
    const next = Math.max(-1, Math.min(total - 1, n));
    setIndex(next);
    setSectionStart(elapsed);
    if (enVivo) sincronizar(next);
  };
  const inSection = elapsed - sectionStart;
  const over = s && s.minutos ? inSection > s.minutos * 60 : false;
  const d = dinamica(s?.dinamica);
  const clave = s && d ? `${s.id}:${d.id}` : null;
  const mandar = () => {
    if (!evento || !d || !s) return;
    setFallo(false);
    interactuarEvento(evento.codigo, { nueva: { tipo: 'dinamica', dinamica: d.id, ...(s.minutos > 0 && { minutos: Math.min(s.minutos, 60) }) } })
      .then(() => setMandada(clave))
      .catch(() => setFallo(true));
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Salir de presentar">
          <CloseIcon color={colors.muted} size={22} />
        </Pressable>
        <Pressable onPress={() => setRunning(!running)} accessibilityLabel={running ? 'Pausar' : 'Seguir'} style={styles.timer}>
          <Text style={{ color: over ? '#B3412E' : colors.text, fontFamily: sans, fontSize: 16, fontVariant: ['tabular-nums'] }}>
            {s ? `${clock(inSection)}${s.minutos ? ` / ${s.minutos}:00` : ''}` : enAnuncios ? clock(inSection) : clock(elapsed)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{running ? `Total ${clock(elapsed)}` : 'En pausa'}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <AmbienteBoton colors={colors} />
          <Pressable onPress={() => setSize((n) => Math.max(16, n - 2))} hitSlop={8} accessibilityLabel="Letra más pequeña">
            <Text style={{ color: colors.muted, fontSize: 15 }}>A−</Text>
          </Pressable>
          <Pressable onPress={() => setSize((n) => Math.min(40, n + 2))} hitSlop={8} accessibilityLabel="Letra más grande">
            <Text style={{ color: colors.muted, fontSize: 19 }}>A+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tramos}>
        <Tramos partes={anuncios.length ? [...sections, { minutos: 0 }] : sections} parte={index} enLaParte={inSection} alto={4} />
      </View>

      {evento && (
        <View style={styles.eventRow}>
          {enVivo ? (
            <View style={[styles.eventChip, { backgroundColor: colors.warmSoft }]}>
              <LiveDot color={colors.warm} size={6} />
              <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 12, letterSpacing: 0.8 }}>
                {fallo ? 'SIN CONEXIÓN CON EL EVENTO' : `EN VIVO · ${codigoLegible(evento.codigo)}`}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setVivo(true);
                sincronizar(index, 'en-vivo');
              }}
              accessibilityRole="button"
              style={[styles.eventChip, { borderWidth: 1, borderColor: colors.border }]}
            >
              <LiveIcon color={colors.accent} size={15} strokeWidth={2} />
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Empezar el evento en vivo · {codigoLegible(evento.codigo)}</Text>
            </Pressable>
          )}
        </View>
      )}

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
                {enVivo &&
                  (mandada === clave ? (
                    <View style={[styles.mandar, { backgroundColor: colors.warmSoft }]}>
                      <CheckIcon color={colors.warm} size={15} strokeWidth={2.4} />
                      <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 13.5 }}>En los teléfonos de todos</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={mandar}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.mandar, { backgroundColor: colors.warm }, pressed && { opacity: 0.8 }]}
                    >
                      <PeopleIcon color="#FFFFFF" size={16} />
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Mandarla a los teléfonos</Text>
                    </Pressable>
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
            {!!s.claves?.trim() && (
              <View style={[styles.claves, { borderColor: colors.border }]}>
                {s.claves
                  .split('\n')
                  .map((c) => c.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
                  .filter(Boolean)
                  .map((c, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.warm, marginTop: size * 0.5 }} />
                      <Text style={{ color: colors.text, fontSize: size * 0.85, lineHeight: size * 1.25, flex: 1 }}>{c}</Text>
                    </View>
                  ))}
              </View>
            )}
            {!s.texto.trim() && !s.paraGrupo?.trim() && !s.claves?.trim() && !d && (
              <Text style={{ color: colors.muted, fontSize: size * 0.8, marginTop: 16 }}>{s.ayuda}</Text>
            )}
            {index === sections.length - 1 && (
              <ParaLlevar titulo={tituloDe(m, books)} pasaje={m.pasaje} citas={sections.flatMap((x) => citasDeParte(x, books))} books={books} colors={colors} para="presentar" />
            )}
          </>
        ) : enAnuncios ? (
          <View style={{ paddingTop: 24 }}>
            <View style={styles.anunciosHead}>
              <View style={[styles.megafono, { backgroundColor: colors.warmSoft }]}>
                <MegaphoneIcon color={colors.warm} size={size * 1.05} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.counter, { color: colors.muted }]}>AL TERMINAR</Text>
                <Text style={[styles.title, { color: colors.accent, marginTop: 2 }]}>Anuncios</Text>
              </View>
            </View>
            <View style={{ marginTop: 18, gap: 12 }}>
              {anuncios.map((a, i) => (
                <View key={i} style={[styles.anuncio, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.anuncioMarca, { backgroundColor: colors.warm }]} />
                  <Text style={{ color: colors.text, fontFamily: serif, fontSize: size, lineHeight: size * 1.4, flex: 1 }}>{a}</Text>
                </View>
              ))}
            </View>
            {evento && enVivo && index >= evento.puntos.length && (
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 16 }}>
                La congregación no ve los anuncios porque el evento se publicó antes de escribirlos. Vuelve a publicarlo desde «Presentarlo en vivo» para que les lleguen.
              </Text>
            )}
          </View>
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
          <IconText icon={ChevronLeftIcon} color={colors.text} size={18} gap={4}>
            <Text style={{ color: colors.text, fontSize: 16 }}>Anterior</Text>
          </IconText>
        </Pressable>
        {m.pasaje && (
          <Pressable onPress={() => setShowPassage(true)} style={[styles.passageBtn, { borderColor: colors.accent }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Pasaje</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => go(index + 1)}
          disabled={index >= total - 1}
          style={[styles.navBtn, { alignItems: 'flex-end' }, index >= total - 1 && { opacity: 0.3 }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{anuncios.length && index === sections.length - 1 ? 'Anuncios' : 'Siguiente'}</Text>
            <ChevronRightIcon color={colors.text} size={18} strokeWidth={2} />
          </View>
        </Pressable>
      </View>

      {showPassage && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowPassage(false)}>
          <Pressable style={styles.backdrop} onPress={() => setShowPassage(false)}>
            <View style={[styles.passage, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.accent, fontWeight: '700', marginBottom: 10 }}>
                {pasajeLabel(m.pasaje, books)} · {abbr}
              </Text>
              <ScrollView>
                <Text style={{ color: colors.text, fontFamily: serif, fontSize: size * 0.9, lineHeight: size * 1.4 }}>
                  {verses?.map(([n, t]) => (
                    <Text key={n}>
                      <Text style={{ color: colors.accent, fontSize: size * 0.5 }}>{n} </Text>
                      {t}{' '}
                    </Text>
                  ))}
                </Text>
                <CreditoVersion version={shown} style={{ marginTop: 12 }} />
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
  eventRow: { alignItems: 'center', paddingBottom: 4 },
  tramos: { paddingHorizontal: 20, paddingBottom: 8, maxWidth: 820, width: '100%', alignSelf: 'center' },
  mandar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  eventChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  body: { padding: 24, paddingBottom: 40, maxWidth: 820, width: '100%', alignSelf: 'center' },
  counter: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { fontFamily: serif, fontSize: 30, fontWeight: '700', marginTop: 6 },
  box: { borderRadius: 14, padding: 16, marginTop: 16 },
  anunciosHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  megafono: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  anuncio: { flexDirection: 'row', alignItems: 'stretch', gap: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, overflow: 'hidden' },
  anuncioMarca: { width: 4, borderRadius: 2 },
  claves: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 8 },
  bottom: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10 },
  navBtn: { flex: 1, paddingVertical: 10 },
  passageBtn: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  passage: { borderRadius: 16, padding: 20, maxHeight: '80%', maxWidth: 760, width: '100%', alignSelf: 'center' },
});
