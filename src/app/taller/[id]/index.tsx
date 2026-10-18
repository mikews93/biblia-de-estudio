import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { confirm } from '@/components/comunidad/confirm';
import { Button, Card, Chips, ErrorText, Field, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { DinamicaCard, DinamicaPicker } from '@/components/taller/Dinamicas';
import TallerIA, { Modo, Paso } from '@/components/taller/TallerIA';
import { api, useAccount } from '@/lib/comunidad';
import { Book, Verse, getBooks, getChapter } from '@/lib/data';
import { Momento, dinamica } from '@/lib/dinamicas';
import { chapterHref, verseHref } from '@/lib/routes';
import {
  Mensaje,
  PLANTILLAS,
  Seccion,
  actualizarMensaje,
  actualizarSeccion,
  applyTemplate,
  borrarMensaje,
  comoTexto,
  duplicarMensaje,
  duracion,
  enPasaje,
  hojaDelGrupo,
  ideaCentral,
  nuevaSeccion,
  parsePasaje,
  pasajeLabel,
  revisionPara,
  tipoInfo,
  tituloDe,
  useTaller,
} from '@/lib/taller';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Step = 'pasaje' | 'idea' | 'bosquejo' | 'revisar' | 'compartir';

const STEPS: { step: Step; label: string }[] = [
  { step: 'pasaje', label: '1 Pasaje' },
  { step: 'idea', label: '2 Idea central' },
  { step: 'bosquejo', label: '3 Bosquejo' },
  { step: 'revisar', label: '4 Revisar' },
  { step: 'compartir', label: '5 Presentar' },
];

const OBSERVAR = [
  '¿Quién habla, a quién, dónde y cuándo?',
  '¿Qué pasa o qué se enseña?',
  '¿Qué palabras o ideas se repiten?',
  '¿Qué conectores aparecen: «pero», «por tanto», «para que»?',
  '¿Qué viene antes y después del pasaje?',
];

export default function MensajeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { mensajes, ready } = useTaller();
  const [books, setBooks] = useState<Book[]>([]);
  const [step, setStep] = useState<Step>('pasaje');
  const [ia, setIa] = useState<{ modo: Modo; paso: Paso } | null>(null);
  const m = mensajes.find((x) => x.id === id);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  // Uno con pasaje ya elegido empieza en la idea central.
  useEffect(() => {
    if (m?.pasaje && !m.tema && !m.observacion && step === 'pasaje') setStep('idea');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id]);

  if (!ready) return <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />;
  if (!m) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: 'Taller' }} />
        <Text style={[text.body, { color: colors.text }]}>Este mensaje ya no existe en este dispositivo.</Text>
        <Button label="Volver al Taller" kind="outline" onPress={() => router.replace('/taller')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const set = (patch: Partial<Mensaje>) => actualizarMensaje(m.id, patch);
  const iaPaso: Paso = step === 'compartir' ? 'revisar' : step;
  const askAI = (modo: Modo) => setIa({ modo, paso: iaPaso });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: tipoInfo(m.tipo).nombre }} />
      <View style={[styles.steps, { borderColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepsInner}>
          {STEPS.map((s) => {
            const on = s.step === step;
            return (
              <Pressable
                key={s.step}
                onPress={() => setStep(s.step)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.stepTab, on && { borderBottomColor: colors.accent }]}
              >
                <Text style={{ color: on ? colors.text : colors.muted, fontWeight: '700' }}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={[styles.kicker, { color: colors.muted }]}>
          {tipoInfo(m.tipo).nombre.toUpperCase()}
          {m.pasaje && m.titulo.trim() ? ` · ${pasajeLabel(m.pasaje, books).toUpperCase()}` : ''}
        </Text>
        <Text style={[text.title, { color: colors.text }]}>{tituloDe(m, books)}</Text>

        {step === 'pasaje' && <PasajeStep m={m} books={books} set={set} />}
        {step === 'idea' && <IdeaStep m={m} set={set} />}
        {step === 'bosquejo' && <BosquejoStep m={m} mensajes={mensajes} set={set} />}
        {step === 'revisar' && <RevisarStep m={m} set={set} onReview={() => askAI('revisar')} />}
        {step === 'compartir' && <CompartirStep m={m} books={books} />}

        {step !== 'compartir' && (
          <View style={[styles.aiBox, { borderColor: colors.border }]}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>✦ ACOMPAÑANTE</Text>
            {m.pasaje ? (
              <View style={styles.aiRow}>
                <Button label="Pregúntame" kind="outline" onPress={() => askAI('preguntar')} style={{ flex: 1 }} />
                <Button
                  label={step === 'revisar' ? 'Revisa mi borrador' : 'Sugiéreme'}
                  kind="outline"
                  onPress={() => askAI(step === 'revisar' ? 'revisar' : 'sugerir')}
                  style={{ flex: 1 }}
                />
              </View>
            ) : (
              <Text style={{ color: colors.muted, marginTop: 6 }}>Elige un pasaje para que la IA te acompañe.</Text>
            )}
          </View>
        )}

        <View style={styles.nav}>
          {step !== 'pasaje' ? (
            <Button label="‹ Anterior" kind="quiet" onPress={() => setStep(STEPS[STEPS.findIndex((s) => s.step === step) - 1].step)} />
          ) : (
            <View />
          )}
          {step !== 'compartir' && (
            <Button label="Siguiente ›" onPress={() => setStep(STEPS[STEPS.findIndex((s) => s.step === step) + 1].step)} />
          )}
        </View>
      </ScrollView>
      {ia && m.pasaje && (
        <TallerIA mensaje={m} paso={ia.paso} modo={ia.modo} title={pasajeLabel(m.pasaje, books)} onClose={() => setIa(null)} />
      )}
    </View>
  );
}

type StepProps = { m: Mensaje; set: (patch: Partial<Mensaje>) => void };

function PasajeStep({ m, books, set }: StepProps & { books: Book[] }) {
  const colors = useColors();
  // Sin los libros cargados, pasajeLabel daría el código interno («jhn 3:16»): se rellena cuando llegan.
  const [input, setInput] = useState(books.length ? pasajeLabel(m.pasaje, books) : '');
  const [error, setError] = useState<string | null>(null);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [whole, setWhole] = useState(false);
  const p = m.pasaje;

  useEffect(() => {
    if (books.length && m.pasaje && !input) setInput(pasajeLabel(m.pasaje, books));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length]);

  useEffect(() => {
    setVerses(null);
    if (p) getChapter(p.book, p.chapter).then((v) => setVerses(v.filter(([n]) => enPasaje(p, n)))).catch(() => {});
  }, [p?.book, p?.chapter, p?.from, p?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => {
    if (!input.trim()) return;
    const parsed = parsePasaje(input, books);
    if (!parsed) {
      setError('No reconozco ese pasaje. Prueba con «Juan 3:1-16» o «Salmos 23».');
      return;
    }
    setError(null);
    set({ pasaje: parsed });
    setInput(pasajeLabel(parsed, books));
  };

  return (
    <View style={{ marginTop: 16, gap: 14 }}>
      <Field
        label="Pasaje"
        value={input}
        onChangeText={setInput}
        onBlur={apply}
        onSubmitEditing={apply}
        placeholder="Por ejemplo, Lucas 15:11-32"
        autoCapitalize="words"
        returnKeyType="done"
      />
      <ErrorText>{error}</ErrorText>
      {p && (
        <Card>
          {verses ? (
            <Text style={{ fontFamily: serif, fontSize: 16, lineHeight: 26, color: colors.text }} numberOfLines={whole ? undefined : 6}>
              {verses.map(([n, t]) => (
                <Text key={n}>
                  <Text style={{ color: colors.accent, fontSize: 11 }}>{n} </Text>
                  {t}{' '}
                </Text>
              ))}
            </Text>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
          {verses && verses.length > 3 && (
            <Pressable onPress={() => setWhole(!whole)} style={{ marginTop: 6 }}>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>{whole ? 'Ver menos' : 'Ver todo el pasaje'}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => navigate(() => router.push(p.from ? verseHref(p.book, p.chapter, p.from) : chapterHref(p.book, p.chapter)), 'forward')}
            style={{ marginTop: 10 }}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Estudiar en el lector: original, referencias, comentario ›</Text>
          </Pressable>
        </Card>
      )}
      <Field label="Título (opcional)" value={m.titulo} onChangeText={(titulo) => set({ titulo })} placeholder="Cómo lo llamarás" />
      <SectionTitle>Observar</SectionTitle>
      {OBSERVAR.map((q) => (
        <Text key={q} style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
          • {q}
        </Text>
      ))}
      <Field
        multiline
        value={m.observacion}
        onChangeText={(observacion) => set({ observacion })}
        placeholder="Lo que ves en el texto, palabras del original, referencias que te ayudan…"
        style={{ minHeight: 120 }}
      />
    </View>
  );
}

function IdeaStep({ m, set }: StepProps) {
  const colors = useColors();
  const idea = ideaCentral(m);
  return (
    <View style={{ marginTop: 16, gap: 14 }}>
      <Text style={[text.body, { color: colors.muted }]}>
        Un mensaje edifica cuando tiene una sola idea que sale del texto. Si no cabe en una frase, todavía no está clara.
      </Text>
      <Field label="Tema: ¿de qué habla el pasaje?" value={m.tema} onChangeText={(tema) => set({ tema })} placeholder="Por ejemplo, el amor del Padre" />
      <Field
        label="Complemento: ¿qué dice de eso?"
        value={m.complemento}
        onChangeText={(complemento) => set({ complemento })}
        placeholder="…sale a buscarnos antes de que lleguemos"
        multiline
        style={{ minHeight: 60 }}
      />
      {idea ? (
        <View style={[styles.idea, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>IDEA CENTRAL</Text>
          <Text style={{ color: colors.text, fontFamily: serif, fontSize: 19, lineHeight: 27, marginTop: 4 }}>{idea}</Text>
        </View>
      ) : null}
      <Field
        label="La necesidad: ¿qué debilidad o necesidad humana toca?"
        value={m.necesidad}
        onChangeText={(necesidad) => set({ necesidad })}
        multiline
        style={{ minHeight: 60 }}
        placeholder="Lo que compartimos con los primeros lectores"
      />
      <Field
        label="La gracia: ¿cómo responde Dios?"
        value={m.gracia}
        onChangeText={(gracia) => set({ gracia })}
        multiline
        style={{ minHeight: 60 }}
        placeholder="Lo que Dios hace en Cristo, no solo «esfuérzate más»"
      />
      <Field
        label="Tiempo disponible (minutos)"
        value={String(m.minutos || '')}
        onChangeText={(v) => set({ minutos: Number(v.replace(/\D/g, '')) || 0 })}
        keyboardType="number-pad"
        style={{ width: 100 }}
      />
    </View>
  );
}

const MOMENTO_DE: Record<string, Momento> = {
  Conexión: 'conectar',
  Bienvenida: 'conectar',
  'Mirar arriba': 'texto',
  Edificación: 'texto',
  'Mirar adelante': 'aplicar',
  Oración: 'aplicar',
  Evangelismo: 'aplicar',
};

function BosquejoStep({ m, mensajes, set }: StepProps & { mensajes: Mensaje[] }) {
  const colors = useColors();
  const [picking, setPicking] = useState<Seccion | null>(null);
  const opciones = PLANTILLAS.filter((p) => p.tipo === m.tipo);
  const total = duracion(m);
  const encuentro = m.tipo === 'encuentro';
  // Lo que quedó del encuentro anterior, para «Mirar atrás».
  const anterior = mensajes
    .filter((x) => x.tipo === 'encuentro' && x.id !== m.id && x.seguimiento.trim() && x.creado < m.creado)
    .sort((a, b) => b.creado.localeCompare(a.creado))[0];

  const move = (i: number, dir: -1 | 1) => {
    const next = [...m.secciones];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    set({ secciones: next });
  };

  const changeTemplate = async (id: string) => {
    if (id === m.plantilla) return;
    const written = m.secciones.some((s) => s.texto.trim() || s.paraGrupo?.trim());
    if (written && !(await confirm('¿Cambiar de estructura?', 'Lo que escribiste se mantiene, en el mismo orden de las partes.', 'Cambiar'))) return;
    set(applyTemplate(m, id));
  };

  return (
    <View style={{ marginTop: 16, gap: 14 }}>
      <Text style={[styles.label, { color: colors.muted }]}>ESTRUCTURA</Text>
      <Chips options={opciones.map((p) => ({ value: p.id, label: p.nombre }))} value={m.plantilla} onChange={changeTemplate} />
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{PLANTILLAS.find((p) => p.id === m.plantilla)?.descripcion}</Text>
      {ideaCentral(m) ? (
        <Text style={{ color: colors.text, fontFamily: serif, fontSize: 16, fontStyle: 'italic' }}>Idea central: {ideaCentral(m)}</Text>
      ) : null}

      {m.secciones.map((s, i) => {
        const d = dinamica(s.dinamica);
        return (
          <Card key={s.id}>
            <View style={styles.secHead}>
              <View style={{ flex: 1 }}>
                <Field
                  value={s.titulo}
                  onChangeText={(titulo) => actualizarSeccion(m.id, s.id, { titulo })}
                  style={styles.secTitle}
                  accessibilityLabel="Título de la parte"
                />
              </View>
              <View style={styles.secTools}>
                <Tool label="↑" disabled={i === 0} onPress={() => move(i, -1)} hint="Subir" />
                <Tool label="↓" disabled={i === m.secciones.length - 1} onPress={() => move(i, 1)} hint="Bajar" />
                <Tool
                  label="✕"
                  hint="Quitar"
                  onPress={async () => {
                    const empty = !s.texto.trim() && !s.paraGrupo?.trim();
                    if (empty || (await confirm(`¿Quitar «${s.titulo}»?`, 'Se borra lo que escribiste en esta parte.', 'Quitar'))) {
                      set({ secciones: m.secciones.filter((x) => x.id !== s.id) });
                    }
                  }}
                />
              </View>
            </View>
            {!!s.ayuda && <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 }}>{s.ayuda}</Text>}
            {encuentro && /mirar atr/i.test(s.titulo) && anterior && (
              <View style={[styles.previous, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>LA VEZ ANTERIOR</Text>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{anterior.seguimiento.trim()}</Text>
              </View>
            )}
            {encuentro && (
              <>
                {d ? (
                  <DinamicaCard d={d} compact action={{ label: 'Cambiar dinámica', onPress: () => setPicking(s) }} />
                ) : (
                  <Button label="+ Añadir dinámica" kind="quiet" onPress={() => setPicking(s)} style={{ alignSelf: 'flex-start' }} />
                )}
                <View style={{ height: 10 }} />
                <Field
                  label="Para el grupo"
                  multiline
                  value={s.paraGrupo ?? ''}
                  onChangeText={(paraGrupo) => actualizarSeccion(m.id, s.id, { paraGrupo })}
                  placeholder="Preguntas o instrucciones que verá el grupo"
                />
                <View style={{ height: 10 }} />
              </>
            )}
            <Field
              label={encuentro ? 'Notas del líder' : 'Borrador'}
              multiline
              value={s.texto}
              onChangeText={(texto) => actualizarSeccion(m.id, s.id, { texto })}
              placeholder={encuentro ? 'Solo las ves tú' : 'Escríbelo con tus palabras'}
              style={{ minHeight: encuentro ? 70 : 110 }}
            />
            <View style={styles.secFoot}>
              <Field
                label="Min"
                value={String(s.minutos || '')}
                onChangeText={(v) => actualizarSeccion(m.id, s.id, { minutos: Number(v.replace(/\D/g, '')) || 0 })}
                keyboardType="number-pad"
                style={{ width: 70, paddingVertical: 8 }}
              />
              {encuentro && (
                <View style={{ flex: 1 }}>
                  <Field
                    label="Guía esta parte"
                    value={s.responsable ?? ''}
                    onChangeText={(responsable) => actualizarSeccion(m.id, s.id, { responsable })}
                    placeholder="Nombre"
                    style={{ paddingVertical: 8 }}
                  />
                </View>
              )}
            </View>
          </Card>
        );
      })}
      <Button label={m.tipo === 'sermon' ? '+ Añadir punto' : '+ Añadir parte'} kind="outline" onPress={() => set({ secciones: [...m.secciones, nuevaSeccion(m.tipo)] })} />
      <Text style={{ color: total > m.minutos && m.minutos ? '#B3412E' : colors.muted, fontSize: 14 }}>
        {encuentro
          ? `Duración planeada: ${total} min de ${m.minutos} disponibles.`
          : `Lo escrito se lee en unos ${total} min (a unas 130 palabras por minuto) de ${m.minutos} disponibles.`}
      </Text>
      {picking && (
        <DinamicaPicker
          initial={MOMENTO_DE[picking.titulo]}
          onPick={(d) => {
            actualizarSeccion(m.id, picking.id, { dinamica: d.id, minutos: Math.max(picking.minutos, d.minutos) });
            setPicking(null);
          }}
          onClear={picking.dinamica ? () => (actualizarSeccion(m.id, picking.id, { dinamica: undefined }), setPicking(null)) : undefined}
          onClose={() => setPicking(null)}
        />
      )}
    </View>
  );
}

function Tool({ label, onPress, disabled, hint }: { label: string; onPress: () => void; disabled?: boolean; hint: string }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityLabel={hint} style={[styles.tool, disabled && { opacity: 0.3 }]}>
      <Text style={{ color: colors.muted, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function RevisarStep({ m, set, onReview }: StepProps & { onReview: () => void }) {
  const colors = useColors();
  const items = revisionPara(m.tipo);
  const done = items.filter((r) => m.revision.includes(r.id)).length;
  const toggle = (id: string) => set({ revision: m.revision.includes(id) ? m.revision.filter((x) => x !== id) : [...m.revision, id] });
  return (
    <View style={{ marginTop: 16, gap: 10 }}>
      <Text style={[text.body, { color: colors.muted }]}>
        Repasa cada punto con honestidad ({done} de {items.length}). Si quieres otra mirada, pide a la IA que revise tu borrador.
      </Text>
      {items.map((r) => {
        const on = m.revision.includes(r.id);
        return (
          <Pressable
            key={r.id}
            onPress={() => toggle(r.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={[styles.check, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface }]}
          >
            <View style={[styles.box, { borderColor: colors.accent }, on && { backgroundColor: colors.accent }]}>
              {on && <Text style={{ color: colors.surface, fontSize: 13, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text style={{ color: colors.text, flex: 1, fontSize: 15, lineHeight: 21 }}>{r.texto}</Text>
          </Pressable>
        );
      })}
      {m.pasaje && <Button label="✦ Revisa mi borrador" kind="outline" onPress={onReview} style={{ marginTop: 6 }} />}
      <SectionTitle>Después de presentarlo</SectionTitle>
      <Field
        multiline
        value={m.seguimiento}
        onChangeText={(seguimiento) => set({ seguimiento })}
        placeholder={
          m.tipo === 'encuentro'
            ? 'Los «Yo voy a…» y las peticiones del grupo. Aparecerán en «Mirar atrás» del próximo encuentro.'
            : 'Qué funcionó, qué cambiarías, qué respondió la gente'
        }
        style={{ minHeight: 100 }}
      />
    </View>
  );
}

async function compartirTexto(message: string) {
  try {
    await Share.share({ message });
    return false;
  } catch {
    await Clipboard.setStringAsync(message);
    return true;
  }
}

function CompartirStep({ m, books }: { m: Mensaje; books: Book[] }) {
  const colors = useColors();
  const { usuario, grupos } = useAccount();
  const [note, setNote] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<string>('');
  const { busy, error, run } = useAction();
  const encuentro = m.tipo === 'encuentro';
  const hoja = hojaDelGrupo(m, books, (id) => dinamica(id)?.nombre);
  const conexion = m.secciones[0];
  const preguntaConexion = conexion?.paraGrupo?.trim() || (conexion && dinamica(conexion.dinamica)?.pasos.join(' '));

  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote(null), 2200);
  };

  const share = async (message: string) => {
    if (await compartirTexto(message)) flash('Copiado. Pégalo en WhatsApp o donde quieras.');
  };

  const copy = async (message: string) => {
    await Clipboard.setStringAsync(message);
    flash('Copiado.');
  };

  const send = () =>
    run(async () => {
      await api('compartirGuia', { grupo, titulo: tituloDe(m, books), pasaje: pasajeLabel(m.pasaje, books), texto: hoja });
      flash('Enviado. El grupo lo verá en la pestaña «Reunión».');
    });

  return (
    <View style={{ marginTop: 16, gap: 12 }}>
      <Button label="▶ Presentar" onPress={() => navigate(() => router.push(`/taller/${m.id}/presentar`), 'forward')} />
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        Pantalla completa con letra grande, una parte a la vez, temporizador y el pasaje a un toque.
      </Text>

      {encuentro && (
        <>
          <SectionTitle>Hoja para el grupo</SectionTitle>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>Lleva las partes, las dinámicas y lo que escribiste «para el grupo». Tus notas de líder no se incluyen.</Text>
          <Card>
            {hoja.split('\n').map((line, i) =>
              line.startsWith('## ') ? (
                <Text key={i} style={[styles.sheetHeading, { color: colors.accent }]}>
                  {line.slice(3)}
                </Text>
              ) : line.trim() ? (
                <Text key={i} style={{ color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: i === 0 ? serif : undefined, fontWeight: i === 0 ? '700' : '400' }}>
                  {line}
                </Text>
              ) : null,
            )}
          </Card>
          {usuario && grupos?.length ? (
            <>
              <Chips options={grupos.map((g) => ({ value: g.id, label: g.nombre }))} value={grupo} onChange={setGrupo} />
              <Button label="Enviar a mi grupo" onPress={send} busy={busy} disabled={!grupo} />
              <ErrorText>{error}</ErrorText>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14 }}>Crea o únete a un grupo en Comunidad para enviarle la hoja.</Text>
          )}
          <Button label="Compartir la hoja como texto" kind="outline" onPress={() => share(hoja.replace(/^## /gm, ''))} />
          {preguntaConexion && (
            <Button
              label="Enviar antes la pregunta para conectar"
              kind="quiet"
              onPress={() => share(`Para nuestro próximo encuentro, vayan pensando: ${preguntaConexion}`)}
            />
          )}
        </>
      )}

      <SectionTitle>Compartir</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Compartir texto" kind="outline" onPress={() => share(comoTexto(m, books))} style={{ flex: 1 }} />
        <Button label="Copiar" kind="outline" onPress={() => copy(comoTexto(m, books))} style={{ flex: 1 }} />
      </View>
      {note && <Text style={{ color: colors.accent, fontWeight: '600' }}>{note}</Text>}

      <View style={styles.footer}>
        <Button
          label="Duplicar"
          kind="quiet"
          onPress={async () => {
            const copyId = await duplicarMensaje(m.id);
            if (copyId) navigate(() => router.replace(`/taller/${copyId}`), 'forward');
          }}
        />
        <Button
          label="Borrar"
          kind="quiet"
          onPress={async () => {
            if (await confirm('¿Borrar este mensaje?', 'No se puede deshacer.', 'Borrar')) {
              borrarMensaje(m.id);
              navigate(() => router.replace('/taller'), 'back');
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { borderBottomWidth: StyleSheet.hairlineWidth },
  stepsInner: { paddingHorizontal: 16, gap: 20, maxWidth: 640, width: '100%', alignSelf: 'center' },
  stepTab: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  page: { padding: 20, paddingBottom: 80, maxWidth: 640, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  idea: { borderRadius: 14, padding: 16 },
  aiBox: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 28, paddingTop: 16 },
  aiRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  secTitle: { fontFamily: serif, fontSize: 18, fontWeight: '700', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 4, backgroundColor: 'transparent' },
  secTools: { flexDirection: 'row', gap: 4 },
  tool: { paddingHorizontal: 6, paddingVertical: 4 },
  secFoot: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'flex-end' },
  previous: { borderRadius: 10, padding: 10, marginBottom: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sheetHeading: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
});
