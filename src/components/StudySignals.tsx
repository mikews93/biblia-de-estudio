import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import { IconText } from '@/components/comunidad/ui';
import { CheckIcon, ChevronDownIcon, FlagIcon, HeartIcon, PeopleIcon } from '@/components/icons';
import { Markdown, Sources } from '@/components/StudyText';
import { Source, askStudy } from '@/lib/estudio';
import { Frecuente, MOTIVOS, Motivo, Pasaje, Senales, leerSenales, marcarAyudo, quitarRaro, reportarRaro } from '@/lib/senales';
import { Colors, getSettings } from '@/lib/theme';
import CitasRevisadas from '@/components/CitasRevisadas';

type Props = {
  pasaje: Pasaje;
  colors: Colors;
  /** Las preguntas frecuentes solo se muestran en el modo general (no en el Modo Jóvenes). */
  frecuentes: boolean;
  onOpen: (ref: string) => void;
  onCite: (source: Source) => void;
};

/**
 * Debajo de un estudio guardado para todos: las preguntas que otros hicieron de este pasaje (aprobadas en /cuidar,
 * con su respuesta preparada una vez) y las señales de un toque, «Me ayudó» y «Algo suena raro».
 */
export default function StudySignals({ pasaje, colors, frecuentes, onOpen, onCite }: Props) {
  const id = `${pasaje.book}.${pasaje.chapter}.${pasaje.verse ?? ''}.${pasaje.word ?? ''}.${pasaje.enfoque}`;
  // Las señales llegan con el pasaje al que pertenecen: al cambiar de pasaje no se muestran las del anterior.
  const [loaded, setLoaded] = useState<{ id: string; data: Senales } | null>(null);
  const data = loaded?.id === id ? loaded.data : null;
  const setData = (d: Senales) => setLoaded({ id, data: d });

  useEffect(() => {
    let alive = true;
    leerSenales(pasaje)
      .then((d) => alive && d && setLoaded({ id, data: d }))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return null;
  return (
    <Appear>
      {frecuentes && data.frecuentes.length > 0 && (
        <FaqList items={data.frecuentes} pasaje={pasaje} colors={colors} onOpen={onOpen} onCite={onCite} />
      )}
      <Feedback data={data} setData={setData} pasaje={pasaje} colors={colors} />
    </Appear>
  );
}

function FaqList({ items, pasaje, colors, onOpen, onCite }: { items: Frecuente[]; pasaje: Pasaje; colors: Colors; onOpen: (ref: string) => void; onCite: (s: Source) => void }) {
  return (
    <View style={[styles.faq, { borderColor: colors.border }]}>
      <IconText icon={PeopleIcon} color={colors.accent} size={14}>
        <Text style={[styles.kicker, { color: colors.accent }]}>PREGUNTAS QUE OTROS HICIERON</Text>
      </IconText>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Varias personas preguntaron lo mismo al estudiar este pasaje. La respuesta se prepara una vez para todos.
      </Text>
      <View style={{ gap: 8, marginTop: 12 }}>
        {items.map((f) => (
          <FaqItem key={f.id} item={f} pasaje={pasaje} colors={colors} onOpen={onOpen} onCite={onCite} />
        ))}
      </View>
    </View>
  );
}

function FaqItem({ item, pasaje, colors, onOpen, onCite }: { item: Frecuente; pasaje: Pasaje; colors: Colors; onOpen: (ref: string) => void; onCite: (s: Source) => void }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; sources: Source[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const load = () => {
    setError(null);
    setBusy(true);
    abort.current = new AbortController();
    askStudy(
      { book: pasaje.book, chapter: pasaje.chapter, frecuente: item.id, messages: [], version: getSettings().version },
      (text, sources) => setAnswer({ text, sources }),
      abort.current.signal,
    )
      .then(setAnswer)
      .catch((e) => {
        if (!abort.current?.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo preparar la respuesta.');
      })
      .finally(() => setBusy(false));
  };
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !answer && !busy) load();
  };

  return (
    <View style={[styles.item, { backgroundColor: colors.surface, borderColor: open ? colors.accent : colors.border }]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        aria-expanded={open}
        style={({ pressed }) => [styles.itemHead, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.itemText, { color: colors.text }]}>
          {item.texto}
          {item.versiculo && !pasaje.verse ? <Text style={{ color: colors.muted }}>{`  · v. ${item.versiculo}`}</Text> : null}
        </Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDownIcon color={colors.muted} size={18} />
        </View>
      </Pressable>
      {open && (
        <View style={styles.itemBody}>
          {answer?.text ? (
            <>
              <Markdown text={answer.text} colors={colors} sources={answer.sources} onCite={onCite} onOpenRef={onOpen} />
              {!busy && !!answer.sources.length && <Sources sources={answer.sources} colors={colors} onOpen={onOpen} />}
              {!busy && <CitasRevisadas text={answer.text} sources={answer.sources} colors={colors} onOpen={onOpen} />}
            </>
          ) : error ? (
            <Pressable onPress={load} accessibilityRole="button">
              <Text style={{ color: colors.text, fontSize: 14 }}>
                {error} <Text style={{ color: colors.accent, fontWeight: '700' }}>Reintentar</Text>
              </Text>
            </Pressable>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={{ color: colors.muted, fontSize: 13 }}>Buscando la respuesta en las fuentes…</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Feedback({ data, setData, pasaje, colors }: { data: Senales; setData: (d: Senales) => void; pasaje: Pasaje; colors: Colors }) {
  const [reporting, setReporting] = useState(false);
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [nota, setNota] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<Senales | null>) => {
    setError(null);
    setSending(true);
    try {
      const d = await fn();
      if (d) setData(d);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const helped = data.mio.ayudo;
  const ayudo = () => {
    // Se ve al instante; si falla, vuelve como estaba.
    const before = data;
    setData({ ...data, ayudo: data.ayudo + (helped ? -1 : 1), mio: { ...data.mio, ayudo: !helped } });
    marcarAyudo(pasaje, helped)
      .then((d) => d && setData(d))
      .catch(() => setData(before));
  };
  const send = async () => {
    if (!motivo) return;
    if (await run(() => reportarRaro(pasaje, motivo, nota))) {
      setReporting(false);
      setMotivo(null);
      setNota('');
    }
  };

  return (
    <View style={[styles.feedback, { borderColor: colors.border }]}>
      <Text style={[styles.question, { color: colors.muted }]}>¿Te sirvió este {pasaje.enfoque === 'devocional' ? 'devocional' : 'estudio'}?</Text>
      <View style={styles.row}>
        <Pressable
          onPress={ayudo}
          accessibilityRole="button"
          aria-selected={helped}
          accessibilityLabel={helped ? 'Quitar «Me ayudó»' : 'Me ayudó'}
          style={({ pressed }) => [
            styles.pill,
            { borderColor: helped ? colors.accent : colors.border, backgroundColor: helped ? colors.accentSoft : 'transparent' },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconText icon={(p) => <HeartIcon {...p} filled={helped} />} color={helped ? colors.accent : colors.text} size={15}>
            <Text style={[styles.pillText, { color: helped ? colors.accent : colors.text }]}>
              Me ayudó{data.ayudo > 0 ? ` · ${data.ayudo}` : ''}
            </Text>
          </IconText>
        </Pressable>
        {data.mio.raro ? (
          <Pressable
            onPress={() => run(() => quitarRaro(pasaje))}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Quitar mi aviso"
            style={({ pressed }) => [styles.pill, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <IconText icon={CheckIcon} color={colors.muted} size={15}>
              <Text style={[styles.pillText, { color: colors.muted }]}>Avisaste · Quitar</Text>
            </IconText>
          </Pressable>
        ) : (
          !reporting && (
            <Pressable
              onPress={() => setReporting(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.pill, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
            >
              <IconText icon={FlagIcon} color={colors.muted} size={15}>
                <Text style={[styles.pillText, { color: colors.muted }]}>Algo suena raro</Text>
              </IconText>
            </Pressable>
          )
        )}
      </View>
      {data.mio.raro && (
        <Text style={[styles.thanks, { color: colors.muted }]}>Gracias. Quienes cuidan Zarza lo revisan con la Biblia en la mano.</Text>
      )}
      {reporting && (
        <Appear style={[styles.report, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.reportTitle, { color: colors.text }]}>¿Qué suena raro?</Text>
          <View style={styles.motivos}>
            {MOTIVOS.map((m) => {
              const on = m.value === motivo;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setMotivo(m.value)}
                  accessibilityRole="radio"
                  aria-checked={on}
                  style={[styles.motivo, { borderColor: on ? colors.accent : colors.border }, on && { backgroundColor: colors.accentSoft }]}
                >
                  <Text style={{ color: on ? colors.accent : colors.text, fontSize: 13, fontWeight: on ? '700' : '500' }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={nota}
            onChangeText={setNota}
            placeholder="Cuéntalo en una línea (opcional)"
            placeholderTextColor={colors.muted}
            maxLength={300}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
          {error && <Text style={{ color: colors.text, fontSize: 13 }}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable onPress={() => setReporting(false)} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.muted, fontWeight: '600' }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={send}
              disabled={!motivo || sending}
              accessibilityRole="button"
              style={({ pressed }) => [styles.send, { backgroundColor: motivo ? colors.accent : colors.border }, pressed && { opacity: 0.8 }]}
            >
              <Text style={{ color: motivo ? colors.surface : colors.muted, fontWeight: '700' }}>{sending ? 'Enviando…' : 'Avisar'}</Text>
            </Pressable>
          </View>
        </Appear>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  faq: { marginTop: 28, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  hint: { fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  itemText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  itemBody: { paddingHorizontal: 14, paddingBottom: 14 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  feedback: { marginTop: 28, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 10 },
  question: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  pillText: { fontSize: 13.5, fontWeight: '600' },
  thanks: { fontSize: 12.5, textAlign: 'center', maxWidth: 360 },
  report: { alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 10 },
  reportTitle: { fontSize: 15, fontWeight: '700' },
  motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motivo: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18 },
  send: { borderRadius: 18, paddingHorizontal: 18, paddingVertical: 9 },
});
