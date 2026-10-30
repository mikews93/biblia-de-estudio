// /preguntar?q=…: «Pregúntale a la Biblia». La respuesta completa a una pregunta del buscador, en partes cortas
// (En corto, Lo que dice la Biblia, Cómo lo han entendido, Para pensar), con sus fuentes y preguntas para seguir.
// &n=fondo pide la respuesta A fondo. Sin «q», las preguntas que muchos hacen y la caja para preguntar.
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import AskBar from '@/components/AskBar';
import Welcome from '@/components/comunidad/Welcome';
import Investigacion from '@/components/Investigacion';
import { NivelToggle, Preparadas, openRef, preguntarHref } from '@/components/Preguntar';
import { Markdown, SourcePeek, Sources } from '@/components/StudyText';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import type { Source } from '@/lib/estudio';
import { MAX_PREGUNTA, type Nivel, conversacion, separar, useConversacion } from '@/lib/preguntar';
import { serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import CitasRevisadas from '@/components/CitasRevisadas';

export default function Preguntar() {
  const colors = useColors();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ q?: string; n?: string }>();
  const texto = (params.q ?? '').trim().slice(0, MAX_PREGUNTA);
  const nivel: Nivel = params.n === 'fondo' ? 'fondo' : 'sencillo';
  const c = useMemo(() => (texto.length >= 6 ? conversacion(texto, nivel) : null), [texto, nivel]);
  const estado = useConversacion(c);
  const [question, setQuestion] = useState('');
  const [peek, setPeek] = useState<Source | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const preguntar = (q: string) => {
    const t = q.trim();
    if (t.length < 3) return;
    setQuestion('');
    setPeek(null);
    if (!c) {
      navigate(() => router.push(preguntarHref(t) as never), 'forward');
      return;
    }
    c.preguntar(t.slice(0, 600));
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
  };
  const cambiarNivel = (n: Nivel) => {
    if (n !== nivel) router.setParams({ n: n === 'fondo' ? 'fondo' : undefined });
  };

  const turns = estado?.turns ?? [];
  const last = turns[turns.length - 1];
  const sugerencias = last?.role === 'assistant' && !estado?.working ? separar(last.text).sugerencias : [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Appear style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.overline, { color: colors.muted }]}>Pregúntale a la Biblia</Text>
            {!c && <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>¿Qué quieres saber?</Text>}
          </View>
          {c && <NivelToggle nivel={nivel} onChange={cambiarNivel} colors={colors} />}
        </Appear>

        {!c && (
          <>
            <Text style={[styles.intro, { color: colors.muted }]}>
              Escribe o dicta tu pregunta. Zarza la investiga en la Biblia, los comentarios y las teologías de la app, y te responde
              con citas que puedes tocar.
            </Text>
            <Text style={[styles.section, { color: colors.muted }]}>Preguntas que muchos hacen</Text>
            <Preparadas colors={colors} onPick={(t) => navigate(() => router.push(preguntarHref(t) as never), 'forward')} />
          </>
        )}

        {c &&
          turns.map((t, i) => {
            if (t.role === 'user') {
              return (
                <Appear key={i} style={[styles.bubble, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.bubbleText, { color: colors.text }]}>{t.text}</Text>
                </Appear>
              );
            }
            const { cuerpo } = separar(t.text);
            const working = !!estado?.working && i === turns.length - 1;
            return (
              <View key={i} style={{ gap: 12 }}>
                {i === 0 && (
                  <Appear style={[styles.bubble, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[styles.bubbleText, { color: colors.text }]}>{texto}</Text>
                  </Appear>
                )}
                <Investigacion pasos={t.pasos ?? []} working={working && !cuerpo.trim()} colors={colors} />
                {!!cuerpo.trim() && (
                  <Markdown text={cuerpo} colors={colors} ornate sources={t.sources} onCite={setPeek} onOpenRef={openRef} />
                )}
                {working && !cuerpo.trim() && !t.pasos?.length && <Esperando colors={colors} />}
                {t.cortada && <Text style={[styles.note, { color: colors.muted }]}>La respuesta se cortó.</Text>}
                {!working && !!t.sources?.length && <Sources sources={t.sources} colors={colors} onOpen={openRef} />}
                {!working && !!cuerpo.trim() && <CitasRevisadas text={cuerpo} sources={t.sources} colors={colors} onOpen={openRef} />}
              </View>
            );
          })}

        {c && turns.length === 0 && !estado?.error && <Esperando colors={colors} pregunta={texto} />}

        {estado?.error === NEEDS_ACCOUNT ? (
          <Welcome
            kind="ia"
            title="Pregúntale a la Biblia"
            intro="Para responder tus propias preguntas, Zarza necesita una cuenta gratuita. Las preguntas que muchos hacen se leen sin cuenta."
            onReady={() => c?.preguntar()}
          />
        ) : estado?.error ? (
          <Appear style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{estado.error}</Text>
            <Pressable onPress={() => c?.preguntar()} style={[styles.retry, { backgroundColor: colors.accentSoft }]} accessibilityRole="button">
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Intentar otra vez</Text>
            </Pressable>
          </Appear>
        ) : null}

        {sugerencias.length > 0 && (
          <Appear style={{ gap: 8 }}>
            {sugerencias.map((s) => (
              <Pressable
                key={s}
                onPress={() => preguntar(s)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.sugerencia, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21, flex: 1 }}>{s}</Text>
              </Pressable>
            ))}
          </Appear>
        )}

        {c && !!turns.length && (
          <Text style={[styles.note, { color: colors.muted }]}>
            Generado con IA a partir de la Biblia y las fuentes de la app: comentarios clásicos y teologías de dominio público. Puede equivocarse: toca los números para ver de dónde sale cada idea.
            {settings.modo === 'jovenes' ? ' Si algo te inquieta, conversa con tus padres o tu líder.' : ''}
          </Text>
        )}
      </ScrollView>

      {peek && <SourcePeek source={peek} version={settings.version} colors={colors} onOpen={openRef} onClose={() => setPeek(null)} />}

      <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.barInner}>
          <AskBar
            value={question}
            onChange={setQuestion}
            onSend={() => preguntar(question)}
            placeholder={c ? 'Sigue preguntando…' : '¿Qué dice la Biblia sobre…?'}
            busy={!!estado?.working}
            onStop={c && turns.length > 1 ? () => c.detener() : undefined}
            colors={colors}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Mientras la IA empieza a investigar: la pregunta y unas líneas que laten. */
function Esperando({ colors, pregunta }: { colors: ReturnType<typeof useColors>; pregunta?: string }) {
  return (
    <View style={{ gap: 12 }}>
      {pregunta && (
        <View style={[styles.bubble, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.bubbleText, { color: colors.text }]}>{pregunta}</Text>
        </View>
      )}
      <View style={{ gap: 10, paddingTop: 4 }}>
        {(['86%', '94%', '62%'] as const).map((w) => (
          <View key={w} style={[styles.skeleton, { backgroundColor: colors.border, width: w }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 8, paddingBottom: 40, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overline: { fontSize: 14 },
  title: { fontSize: 32, lineHeight: 38, marginTop: 2 },
  intro: { fontSize: 15, lineHeight: 22 },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  bubble: { alignSelf: 'flex-end', maxWidth: '86%', borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  note: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  errorCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20, alignItems: 'center' },
  retry: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 20, marginTop: 14 },
  sugerencia: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, flexDirection: 'row' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  skeleton: { height: 14, borderRadius: 7 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  barInner: { maxWidth: 720, width: '100%', alignSelf: 'center' },
});
