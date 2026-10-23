// Estudio en grupo dentro de la lectura en vivo: el estudio Profundo del capítulo que quien guía lleva a todas
// las pantallas por secciones, el tablero de dudas del grupo (con «yo también») que se le preguntan al estudio,
// y las rondas en las que cada uno responde en secreto hasta que quien guía revela las respuestas.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Avatar, Button, Field } from '@/components/comunidad/ui';
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CommentIcon,
  EyeIcon,
  LampIcon,
  LiveIcon,
  LockIcon,
  RefreshIcon,
  SparkIcon,
  StarIcon,
  TalkIcon,
} from '@/components/icons';
import { Markdown } from '@/components/StudyText';
import { lanzarConfeti } from '@/lib/confeti';
import { parseRef } from '@/lib/data';
import type { ModoRepaso, PreguntaRepaso } from '@/lib/repaso';
import { type Source, type Turn, askStudy } from '@/lib/estudio';
import { verseHref } from '@/lib/routes';
import { isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import {
  type Fuente,
  type Persona,
  type PreguntaSala,
  type Respuestas,
  type Tarjeta,
  ordenPreguntas,
  preguntasDe,
  seccionesDelEstudio,
  toneOf,
} from '@/lib/vivo';

import { Faces, Segmented, Sheet, vivoText } from './piezas';

// --- El estudio Profundo del capítulo (el mismo que se guarda para todos) ---

type Estudio = { text: string; sources: Source[] };
const estudios = new Map<string, Promise<Estudio>>();

/** Pide el estudio Profundo una vez por capítulo y versión; si ya está guardado para todos, llega al instante. */
function estudioDe(libro: string, capitulo: number, version: string) {
  const key = `${libro}.${capitulo}.${version}`;
  let p = estudios.get(key);
  if (!p) {
    p = askStudy(
      {
        book: libro,
        chapter: capitulo,
        messages: [],
        enfoque: 'profundo',
        version,
      },
      () => {},
    );
    p.catch(() => estudios.delete(key));
    estudios.set(key, p);
  }
  return p;
}

export function useEstudio(libro: string | undefined, capitulo: number | undefined, version: string, enabled: boolean) {
  const [state, setState] = useState<{
    key: string;
    estudio: Estudio | null;
    error: string | null;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const key = libro && capitulo ? `${libro}.${capitulo}.${version}` : '';
  useEffect(() => {
    if (!enabled || !libro || !capitulo) return;
    let gone = false;
    estudioDe(libro, capitulo, version).then(
      (estudio) => !gone && setState({ key, estudio, error: null }),
      (e) =>
        !gone &&
        setState({
          key,
          estudio: null,
          error: e instanceof Error ? e.message : String(e),
        }),
    );
    return () => {
      gone = true;
    };
  }, [enabled, libro, capitulo, version, key, retry]);
  const current = state?.key === key ? state : null;
  return {
    estudio: current?.estudio ?? null,
    error: current?.error ?? null,
    loading: enabled && !current,
    retry: () => setRetry((n) => n + 1),
  };
}

/** Le pregunta al estudio del capítulo una duda del grupo, como una pregunta de seguimiento del panel. */
export async function preguntarAlEstudio(
  libro: string,
  capitulo: number,
  version: string,
  pregunta: string,
  onUpdate: (text: string) => void,
) {
  const base = await estudioDe(libro, capitulo, version);
  const history: Turn[] = [
    { role: 'assistant', text: base.text, sources: base.sources },
    { role: 'user', text: pregunta },
  ];
  return askStudy(
    {
      book: libro,
      chapter: capitulo,
      messages: history,
      enfoque: 'profundo',
      version,
    },
    (text) => onUpdate(text),
  );
}

const openRef = (ref: string) => {
  const { start } = parseRef(ref);
  navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
};

// --- Tarjeta: una sección del estudio o su respuesta, en la pantalla de todos ---

const LONG = 700;

export function TarjetaEstudio({
  tarjeta: t,
  lead,
  escribiendo,
  onClose,
}: {
  tarjeta: Pick<Tarjeta, 'titulo' | 'texto' | 'fuentes' | 'pregunta'>;
  lead: boolean;
  /** Mientras la IA responde (solo lo ve quien guía, antes de mandarlo a todos). */
  escribiendo?: boolean;
  onClose?: () => void;
}) {
  const colors = useColors();
  const long = (t.texto?.length ?? 0) > LONG;
  const [open, setOpen] = useState(!long || lead);
  const answer = t.pregunta !== undefined && t.pregunta !== null;
  const sources = (t.fuentes ?? []) as Source[];

  return (
    <Appear from={10}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.warmSoft }]}>
            {answer || escribiendo ? <SparkIcon color={colors.warm} size={16} /> : <LampIcon color={colors.warm} size={16} />}
          </View>
          <Text style={[vivoText.kicker, { color: colors.warm, flex: 1 }]} numberOfLines={1}>
            {escribiendo ? 'EL ESTUDIO ESTÁ RESPONDIENDO' : answer ? 'EL ESTUDIO RESPONDE' : 'DEL ESTUDIO'}
          </Text>
          {escribiendo && <ActivityIndicator color={colors.warm} size="small" />}
          {lead && onClose && !escribiendo && (
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Quitar la tarjeta de todas las pantallas"
            >
              <CloseIcon color={colors.muted} size={18} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t.titulo}</Text>
        {!!t.texto && (
          <View style={[!open && styles.folded]}>
            <Markdown text={t.texto} colors={colors} sources={sources} />
          </View>
        )}
        {long && !open && (
          <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={[styles.more, { borderColor: colors.border }]}>
            <Text
              style={{
                color: colors.accent,
                fontWeight: '700',
                fontSize: 13.5,
              }}
            >
              Leer todo
            </Text>
            <ChevronDownIcon color={colors.accent} size={16} />
          </Pressable>
        )}
        {open && sources.length > 0 && <FuentesChips fuentes={sources} />}
      </View>
    </Appear>
  );
}

function FuentesChips({ fuentes }: { fuentes: Fuente[] }) {
  const colors = useColors();
  return (
    <View style={styles.chips}>
      {fuentes.map((f) => (
        <Pressable
          key={f.n}
          accessibilityRole="link"
          disabled={!f.ref && !f.url}
          onPress={() => (f.ref ? openRef(f.ref) : f.url && Linking.openURL(f.url))}
          style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.background }]}
        >
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>{f.n}</Text>
          <Text style={{ color: colors.text, fontSize: 12.5 }} numberOfLines={1}>
            {f.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// --- La meta del grupo: que respondan todos ---

/**
 * Cuántos respondieron de los que están, sin esperar a quien guía si no responde. Cuando responden todos, el
 * grupo cumple su meta: confeti en cada teléfono, una sola vez por pregunta.
 */
export function useMetaGrupo(clave: string, presentes: Persona[], quienes: string[], guia: string) {
  const esperados = presentes.filter((p) => p.id !== guia || quienes.includes(p.id));
  const todos = quienes.length > 0 && esperados.length > 0 && esperados.every((p) => quienes.includes(p.id));
  const celebrada = useRef<string | null>(null);
  useEffect(() => {
    if (todos && celebrada.current !== clave) {
      celebrada.current = clave;
      lanzarConfeti();
    }
  }, [todos, clave]);
  return { esperados: Math.max(esperados.length, quienes.length), todos };
}

export function Progreso({ clave, presentes, quienes, guia }: { clave: string; presentes: Persona[]; quienes: string[]; guia: string }) {
  const colors = useColors();
  const { esperados, todos } = useMetaGrupo(clave, presentes, quienes, guia);
  const answered = presentes.filter((p) => quienes.includes(p.id));
  return (
    <>
      <View style={styles.progress}>
        {answered.length > 0 && <Faces people={answered} size={22} />}
        <Text style={{ color: todos ? colors.warm : colors.muted, fontSize: 13, fontWeight: todos ? '800' : '600', flex: 1 }} accessibilityLiveRegion="polite">
          {quienes.length === 0
            ? 'Nadie ha respondido todavía'
            : todos
              ? `¡Respondieron ${esperados === 2 ? 'los dos' : esperados > 2 ? `los ${esperados}` : 'todos'}!`
              : `${quienes.length} de ${esperados} respondieron`}
        </Text>
        {todos && <StarIcon color={colors.warm} size={18} strokeWidth={2} />}
      </View>
      <View style={[styles.bar, { backgroundColor: colors.accentSoft }]}>
        <View style={[styles.barFill, { backgroundColor: colors.warm, width: `${esperados ? Math.min(1, quienes.length / esperados) * 100 : 0}%` }]} />
      </View>
    </>
  );
}

// --- Tarjeta: una pregunta que cada uno responde en secreto ---

export function TarjetaRonda({
  tarjeta: t,
  respuestas,
  presentes,
  guia,
  me,
  lead,
  onAnswer,
  onReveal,
  onClose,
}: {
  tarjeta: Tarjeta;
  respuestas: Respuestas | null;
  presentes: Persona[];
  /** Quien guía: no se le espera para la meta del grupo, pero si responde también cuenta. */
  guia: string;
  me: string | null;
  lead: boolean;
  onAnswer: (texto: string) => Promise<boolean>;
  onReveal: (revelar: boolean) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const dark = isDark(colors);
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [busy, setBusy] = useState(false);
  const quienes = useMemo(() => (respuestas && respuestas.ronda === t.id ? respuestas.quienes : []), [respuestas, t.id]);
  const lista = respuestas && respuestas.ronda === t.id ? respuestas.lista : null;
  const mine = !!me && quienes.includes(me);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    if (await onAnswer(text)) {
      setSent(text);
      setEditing(false);
    }
    setBusy(false);
  };

  return (
    <Appear from={10}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.warmSoft }]}>
            <TalkIcon color={colors.warm} size={16} />
          </View>
          <Text style={[vivoText.kicker, { color: colors.warm, flex: 1 }]} numberOfLines={1}>
            {t.revelada ? 'LO QUE RESPONDIÓ EL GRUPO' : 'RESPONDE EN SECRETO'}
          </Text>
          {t.anonima && (
            <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
              <LockIcon color={colors.muted} size={12} />
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11.5,
                  fontWeight: '700',
                }}
              >
                Anónimo
              </Text>
            </View>
          )}
          {lead && (
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Quitar la tarjeta de todas las pantallas"
            >
              <CloseIcon color={colors.muted} size={18} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.title, styles.question, { color: colors.text }]}>{t.titulo}</Text>

        {!t.revelada && (
          <>
            {me && (editing || !mine) ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                <Field
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Escribe lo que piensas…"
                  multiline
                  maxLength={600}
                  accessibilityLabel="Tu respuesta"
                />
                <Button
                  label={mine ? 'Cambiar mi respuesta' : 'Enviar mi respuesta'}
                  icon={CheckIcon}
                  busy={busy}
                  disabled={!draft.trim()}
                  onPress={send}
                />
              </View>
            ) : me ? (
              <View style={[styles.sent, { backgroundColor: colors.warmSoft }]}>
                <CheckIcon color={colors.warm} size={18} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    Tu respuesta está guardada
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 13,
                      lineHeight: 18,
                      marginTop: 2,
                    }}
                    numberOfLines={3}
                  >
                    {sent ?? 'Se verá cuando se revelen todas.'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDraft(sent ?? '');
                    setEditing(true);
                  }}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      color: colors.accent,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    Cambiar
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>
                <Text onPress={() => router.push('/entrar')} style={{ color: colors.accent, fontWeight: '700' }}>
                  Entra con tu cuenta
                </Text>{' '}
                para responder.
              </Text>
            )}

            <Progreso clave={t.id ?? ''} presentes={presentes} quienes={quienes} guia={guia} />
            {lead && (
              <Button
                label="Revelar las respuestas"
                icon={EyeIcon}
                disabled={quienes.length === 0}
                onPress={() => onReveal(true)}
                style={{ marginTop: 14 }}
              />
            )}
          </>
        )}

        {t.revelada && lista && (
          <View style={styles.answers}>
            {lista.length === 0 && <Text style={{ color: colors.muted }}>Nadie respondió esta vez.</Text>}
            {lista.map((r, i) => {
              const tone = r.usuario ? toneOf(r.usuario) : null;
              return (
                <Appear key={`${r.usuario ?? i}-${i}`} from={8} delay={i * 70}>
                  <View
                    style={[
                      styles.answer,
                      {
                        backgroundColor: tone ? (dark ? tone.dark : tone.light) : colors.accentSoft,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.answerText, { color: colors.text }]}>{r.texto}</Text>
                    <View style={styles.answerWho}>
                      {r.nombre ? (
                        <>
                          <Avatar name={r.nombre} size={20} />
                          <Text
                            style={{
                              color: dark ? colors.text : tone?.ink,
                              fontWeight: '700',
                              fontSize: 12.5,
                            }}
                          >
                            {r.usuario === me ? 'Tú' : r.nombre.split(' ')[0]}
                          </Text>
                        </>
                      ) : (
                        <Text
                          style={{
                            color: colors.muted,
                            fontWeight: '600',
                            fontSize: 12.5,
                          }}
                        >
                          Alguien del grupo
                        </Text>
                      )}
                    </View>
                  </View>
                </Appear>
              );
            })}
            {lead && (
              <Pressable accessibilityRole="button" onPress={() => onReveal(false)} style={styles.hide}>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: '600',
                    fontSize: 13,
                  }}
                >
                  Ocultar y seguir respondiendo
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Appear>
  );
}

// --- La pestaña «Estudio» de quien guía: las secciones del estudio Profundo ---

export type TarjetaNueva =
  | { tipo: 'estudio'; titulo: string; texto: string; fuentes: Fuente[] }
  | { tipo: 'ronda'; titulo: string; anonima: boolean }
  | { tipo: 'repaso'; preguntas: PreguntaRepaso[]; modo: ModoRepaso };

export function EstudioTab({
  libro,
  capitulo,
  nombre,
  version,
  onPut,
}: {
  libro: string;
  capitulo: number;
  nombre: string;
  version: string;
  onPut: (t: TarjetaNueva) => void;
}) {
  const colors = useColors();
  const { estudio, error, loading, retry } = useEstudio(libro, capitulo, version, true);
  const secciones = useMemo(() => (estudio ? seccionesDelEstudio(estudio.text, estudio.sources) : []), [estudio]);
  const [anonima, setAnonima] = useState(false);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.muted, marginTop: 12, textAlign: 'center' }}>Preparando el estudio de {nombre}…</Text>
      </View>
    );
  }
  if (error || !estudio) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: colors.muted, textAlign: 'center', marginBottom: 14 }}>{error ?? 'No se pudo abrir el estudio.'}</Text>
        <Button label="Reintentar" kind="outline" icon={RefreshIcon} onPress={retry} />
      </View>
    );
  }
  const aplicar = secciones.find((s) => /aplicar/i.test(s.titulo));
  const preguntas = aplicar ? preguntasDe(aplicar.texto) : [];

  return (
    <View>
      <Text
        style={{
          color: colors.muted,
          fontSize: 14,
          lineHeight: 20,
          marginBottom: 12,
        }}
      >
        El estudio Profundo de {nombre}. Manda una sección y aparece en el teléfono de cada uno.
      </Text>
      {secciones.map((s) => (
        <View key={s.titulo} style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15.5 }}>{s.titulo}</Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 13,
                lineHeight: 18,
                marginTop: 4,
              }}
              numberOfLines={2}
            >
              {s.texto
                .replace(/⟦\d+⟧|[#*]+/g, '')
                .replace(/^\s*- /gm, '')
                .trim()}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mostrar «${s.titulo}» a todos`}
            onPress={() =>
              onPut({
                tipo: 'estudio',
                titulo: s.titulo,
                texto: s.texto,
                fuentes: s.fuentes,
              })
            }
            style={({ pressed }) => [styles.send, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}
          >
            <LiveIcon color={colors.surface} size={16} strokeWidth={2} />
          </Pressable>
        </View>
      ))}

      {preguntas.length > 0 && (
        <>
          <Text style={[vivoText.kicker, { color: colors.muted, marginTop: 18, marginBottom: 4 }]}>QUE TODOS RESPONDAN</Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 13.5,
              lineHeight: 19,
              marginBottom: 10,
            }}
          >
            Las preguntas del estudio: cada uno escribe en secreto y tú revelas las respuestas juntas.
          </Text>
          {preguntas.map((q) => (
            <Pressable
              key={q}
              accessibilityRole="button"
              onPress={() => onPut({ tipo: 'ronda', titulo: q, anonima })}
              style={({ pressed }) => [
                styles.ask,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.warmSoft : colors.surface,
                },
              ]}
            >
              <TalkIcon color={colors.warm} size={18} />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14.5,
                  lineHeight: 20,
                  flex: 1,
                  fontFamily: serif,
                }}
              >
                {q}
              </Text>
            </Pressable>
          ))}
          <AnonimaSwitch value={anonima} onChange={setAnonima} />
        </>
      )}
    </View>
  );
}

export function AnonimaSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.switchRow}>
      <View style={[styles.switch, { backgroundColor: value ? colors.warm : colors.border }]}>
        <View
          style={[
            styles.knob,
            {
              backgroundColor: '#FFFFFF',
              transform: [{ translateX: value ? 16 : 0 }],
            },
          ]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Respuestas anónimas</Text>
        <Text style={{ color: colors.muted, fontSize: 12.5 }}>Al revelarlas no se ve quién escribió cada una.</Text>
      </View>
    </Pressable>
  );
}

// --- El tablero de dudas del grupo ---

export function PreguntasSheet({
  preguntas,
  me,
  lead,
  guia,
  respondiendo,
  onAsk,
  onSupport,
  onRemove,
  onTalk,
  onStudy,
  onClose,
}: {
  preguntas: PreguntaSala[];
  me: string | null;
  lead: boolean;
  guia: string;
  respondiendo: string | null;
  onAsk: (texto: string) => Promise<boolean>;
  onSupport: (p: PreguntaSala) => void;
  onRemove: (p: PreguntaSala) => void;
  onTalk: (p: PreguntaSala) => void;
  onStudy: (p: PreguntaSala) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'abiertas' | 'vistas'>('abiertas');
  const ordered = ordenPreguntas(preguntas);
  const abiertas = ordered.filter((p) => !p.respondida);
  const vistas = ordered.filter((p) => p.respondida);
  const list = tab === 'abiertas' ? abiertas : vistas;

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    if (await onAsk(text)) setDraft('');
    setBusy(false);
  };

  return (
    <Sheet title="Preguntas del grupo" kicker="ESTUDIO EN GRUPO" onClose={onClose}>
      {me ? (
        <View style={{ gap: 10, marginBottom: 16 }}>
          <Field
            value={draft}
            onChangeText={setDraft}
            placeholder="¿Qué te quedó dando vueltas del capítulo?"
            multiline
            maxLength={280}
            accessibilityLabel="Tu pregunta para el grupo"
          />
          <Button label="Dejar mi pregunta" icon={CommentIcon} busy={busy} disabled={!draft.trim()} onPress={send} />
        </View>
      ) : (
        <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 16 }}>
          <Text onPress={() => router.push('/entrar')} style={{ color: colors.accent, fontWeight: '700' }}>
            Entra con tu cuenta
          </Text>{' '}
          para dejar preguntas y apoyar las de otros.
        </Text>
      )}

      {vistas.length > 0 && (
        <Segmented
          options={[
            ['abiertas', `Por ver (${abiertas.length})`],
            ['vistas', `Ya las vimos (${vistas.length})`],
          ]}
          value={tab}
          onChange={setTab}
        />
      )}

      {list.length === 0 && (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <CommentIcon color={colors.muted} size={26} />
          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            {tab === 'abiertas'
              ? `Aquí aparecen las dudas de todos. ${lead ? 'Tú eliges cuál ver y se la puedes preguntar al estudio.' : `${guia.split(' ')[0]} elige cuál ver con el grupo.`}`
              : 'Todavía no han visto ninguna.'}
          </Text>
        </View>
      )}

      {list.map((p) => {
        const mine = p.autor === me;
        const supported = !!me && p.apoyos.includes(me);
        const thinking = respondiendo === p.id;
        return (
          <View
            key={p.id}
            style={[
              styles.qCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: p.respondida ? 0.75 : 1,
              },
            ]}
          >
            <View style={styles.qTop}>
              <Text style={[styles.qText, { color: colors.text }]}>{p.texto}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Yo también, ${p.apoyos.length + 1} ${p.apoyos.length === 0 ? 'persona' : 'personas'}`}
                accessibilityState={{ selected: supported }}
                disabled={!me || mine}
                onPress={() => onSupport(p)}
                style={[
                  styles.vote,
                  {
                    borderColor: supported ? colors.warm : colors.border,
                    backgroundColor: supported ? colors.warmSoft : 'transparent',
                  },
                ]}
              >
                <ArrowUpIcon color={supported ? colors.warm : colors.muted} size={15} strokeWidth={2.2} />
                <Text
                  style={{
                    color: supported ? colors.warm : colors.text,
                    fontWeight: '800',
                    fontSize: 13,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {p.apoyos.length + 1}
                </Text>
              </Pressable>
            </View>
            <View style={styles.qFoot}>
              <Text style={{ color: colors.muted, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
                {mine ? 'Tu pregunta' : p.nombre.split(' ')[0]}
                {p.apoyos.length > 0 ? ` · ${p.apoyos.length} también ${p.apoyos.length === 1 ? 'la tiene' : 'la tienen'}` : ''}
                {p.respondida ? ' · Ya la vieron' : ''}
              </Text>
              {(mine || lead) && (
                <Pressable accessibilityRole="button" accessibilityLabel="Quitar la pregunta" onPress={() => onRemove(p)} hitSlop={8}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: '600',
                      fontSize: 12.5,
                    }}
                  >
                    Quitar
                  </Text>
                </Pressable>
              )}
            </View>
            {lead && (
              <View style={styles.qActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onTalk(p)}
                  style={({ pressed }) => [
                    styles.qButton,
                    { borderColor: colors.border },
                    pressed && { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <TalkIcon color={colors.text} size={15} />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    Conversarla
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!respondiendo}
                  onPress={() => onStudy(p)}
                  style={({ pressed }) => [
                    styles.qButton,
                    {
                      backgroundColor: colors.warmSoft,
                      borderColor: colors.warmSoft,
                      opacity: respondiendo && !thinking ? 0.5 : 1,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {thinking ? <ActivityIndicator color={colors.warm} size="small" /> : <SparkIcon color={colors.warm} size={15} />}
                  <Text
                    style={{
                      color: colors.warm,
                      fontWeight: '800',
                      fontSize: 13,
                    }}
                  >
                    {thinking ? 'Respondiendo…' : 'Preguntar al estudio'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </Sheet>
  );
}

/** El botón del tablero: redondo en los mandos de quien guía, o flotando junto al aviso de quien sigue. */
export function BotonPreguntas({
  count,
  onPress,
  compact,
  floating,
}: {
  count: number;
  onPress: () => void;
  compact?: boolean;
  floating?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Preguntas del grupo${count ? `, ${count} por ver` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.qRound : styles.qPill,
        floating
          ? { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 6px 20px rgba(0,0,0,0.10)' }
          : { backgroundColor: colors.accentSoft },
        pressed && { opacity: 0.8 },
      ]}
    >
      <CommentIcon color={colors.text} size={19} />
      {!compact && <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13.5 }}>Preguntas</Text>}
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.warm, borderColor: colors.surface }]}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: serif,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 28,
    marginTop: 12,
    marginBottom: 4,
  },
  question: { fontSize: 22, lineHeight: 30, marginBottom: 12 },
  folded: { maxHeight: 220, overflow: 'hidden' },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 12,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill: { height: 6, borderRadius: 3 },
  answers: { gap: 10, marginTop: 4 },
  answer: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  answerText: { fontFamily: serif, fontSize: 16.5, lineHeight: 24 },
  answerWho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  hide: { alignSelf: 'center', paddingVertical: 8 },
  loading: { alignItems: 'center', paddingVertical: 36 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ask: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  switch: { width: 40, height: 24, borderRadius: 12, padding: 2 },
  knob: { width: 20, height: 20, borderRadius: 10 },
  empty: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 22,
  },
  qCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  qTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  qText: { fontFamily: serif, fontSize: 16.5, lineHeight: 23, flex: 1 },
  vote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  qFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  qActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  qButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    height: 38,
  },
  qRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
});
