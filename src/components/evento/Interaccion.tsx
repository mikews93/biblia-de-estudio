// Interactuar durante el sermón o la reflexión: quien predica lanza una pregunta abierta (las respuestas forman un
// muro al mostrarlas) o un repaso de opción múltiple sobre el mensaje, y la congregación responde en el teléfono sin
// cuenta. El repaso usa la misma tarjeta que la sala de la célula (src/components/vivo/Repaso.tsx), jugado en grupo.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Button, ErrorText, Field, useAction } from '@/components/comunidad/ui';
import { CheckIcon, CloseIcon, CommentIcon, EyeIcon, LockIcon, StarIcon } from '@/components/icons';
import { Contados, TarjetaRepaso } from '@/components/vivo/Repaso';
import { Sheet, vivoText } from '@/components/vivo/piezas';
import { lanzarConfeti } from '@/lib/confeti';
import type { Book } from '@/lib/data';
import {
  type Evento,
  interactuarEvento,
  ocultarRespuesta,
  participanteId,
  repasoDelMensaje,
  responderEvento,
} from '@/lib/eventos';
import { LETRAS, type PreguntaRepaso, acertoElGrupo } from '@/lib/repaso';
import { isDark, serif, useColors } from '@/lib/theme';
import type { Respuestas, Tarjeta } from '@/lib/vivo';

/** Preguntas abiertas para empezar, que sirven para casi cualquier mensaje. */
const IDEAS = [
  '¿Qué te habló Dios en este mensaje?',
  '¿Qué vas a hacer esta semana con lo que escuchaste?',
  'En una palabra: ¿cómo describirías lo que Dios hizo por ti?',
  '¿Por quién vas a orar esta semana?',
];

const MAX_RESPUESTA = 280;

function useParticipante() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    participanteId().then(setId);
  }, []);
  return id;
}

/** Lo que la congregación ve (y quien predica maneja) mientras hay algo para responder. */
export function InteraccionEvento({ evento, propio, onCambio }: { evento: Evento; propio: boolean; onCambio: (e: Evento) => void }) {
  const i = evento.interaccion;
  const me = useParticipante();
  // Lo que este teléfono ya respondió, por pregunta (el servidor solo publica cuántos).
  const [mias, setMias] = useState<Record<string, number | string>>({});
  const { error, run } = useAction();
  if (!i || evento.estado !== 'en-vivo') return null;
  const clave = `${i.id}:${i.paso}`;
  const cambiar = (c: Parameters<typeof interactuarEvento>[1]) => run(async () => onCambio(await interactuarEvento(evento.codigo, c)));
  const r = evento.resultados;

  if (i.tipo === 'repaso') {
    const tarjeta: Tarjeta = {
      id: i.id,
      tipo: 'repaso',
      titulo: i.titulo,
      texto: null,
      pasos: [],
      paso: i.paso,
      dinamica: null,
      minutos: null,
      fin: null,
      preguntas: i.preguntas,
      reveladas: i.reveladas,
      modo: 'grupo',
    };
    const respuestas: Respuestas = { ronda: clave, quienes: me && clave in mias ? [me] : [], lista: null, votos: r?.votos };
    return (
      <View style={{ marginTop: 18 }}>
        <TarjetaRepaso
          key={i.id}
          tarjeta={tarjeta}
          respuestas={respuestas}
          presentes={[]}
          guia=""
          me={me}
          lead={propio}
          respondieron={r?.respondieron ?? 0}
          quien="La iglesia"
          onAnswer={async (opcion) => {
            if (typeof opcion !== 'number') return false;
            try {
              await responderEvento(evento.codigo, i.id, { opcion });
              setMias((m) => ({ ...m, [clave]: opcion }));
              return true;
            } catch {
              return false;
            }
          }}
          onReveal={() => cambiar({ revelar: true })}
          onNext={(paso) => cambiar({ paso })}
          onClose={() => cambiar({ quitar: true })}
        />
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

  return (
    <PreguntaAbierta
      key={i.id}
      evento={evento}
      propio={propio}
      mia={typeof mias[clave] === 'string' ? (mias[clave] as string) : null}
      onEnviada={(t) => setMias((m) => ({ ...m, [clave]: t }))}
      onCambio={onCambio}
    />
  );
}

function PreguntaAbierta({
  evento,
  propio,
  mia,
  onEnviada,
  onCambio,
}: {
  evento: Evento;
  propio: boolean;
  mia: string | null;
  onEnviada: (t: string) => void;
  onCambio: (e: Evento) => void;
}) {
  const colors = useColors();
  const i = evento.interaccion!;
  const revelada = i.reveladas.includes(0);
  const r = evento.resultados;
  const muro = r?.muro ?? [];
  const [texto, setTexto] = useState(mia ?? '');
  const [editando, setEditando] = useState(!mia);
  const enviar = useAction();
  const manejar = useAction();
  const cambiar = (c: Parameters<typeof interactuarEvento>[1]) => manejar.run(async () => onCambio(await interactuarEvento(evento.codigo, c)));

  // Al mostrarse las respuestas, una lluvia suave en todos los teléfonos: lo que respondió la iglesia junta.
  useEffect(() => {
    if (revelada && muro.length > 0) lanzarConfeti('confeti');
  }, [revelada]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () =>
    enviar.run(async () => {
      const t = texto.trim();
      if (!t) return;
      await responderEvento(evento.codigo, i.id, { texto: t });
      onEnviada(t);
      setEditando(false);
    });

  return (
    <Appear from={10}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.warm }, !isDark(colors) && styles.cardShadow]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.warmSoft }]}>
            <CommentIcon color={colors.warm} size={16} strokeWidth={2} />
          </View>
          <Text style={[vivoText.kicker, { color: colors.warm, flex: 1 }]}>PREGUNTA PARA TODOS</Text>
          {propio && (
            <Pressable accessibilityRole="button" onPress={() => cambiar({ quitar: true })} hitSlop={10} accessibilityLabel="Quitar la pregunta de todas las pantallas">
              <CloseIcon color={colors.muted} size={18} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.question, { color: colors.text }]}>{i.titulo}</Text>

        {!propio && !revelada && (
          <>
            {editando ? (
              <View style={{ gap: 10 }}>
                <Field
                  value={texto}
                  onChangeText={(t) => setTexto(t.slice(0, MAX_RESPUESTA))}
                  placeholder="Tu respuesta…"
                  accessibilityLabel="Tu respuesta"
                  multiline
                  style={{ backgroundColor: colors.background, minHeight: 76 }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <LockIcon color={colors.muted} size={13} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, flexShrink: 1 }}>Sin tu nombre</Text>
                  </View>
                  <Button label={mia ? 'Cambiar' : 'Enviar'} onPress={send} busy={enviar.busy} disabled={!texto.trim()} />
                </View>
              </View>
            ) : (
              <View style={[styles.sent, { backgroundColor: colors.warmSoft }]}>
                <CheckIcon color={colors.warm} size={16} strokeWidth={2.4} />
                <Text style={{ color: colors.text, fontSize: 14.5, lineHeight: 20, flex: 1 }} numberOfLines={3}>
                  {mia}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => setEditando(true)} hitSlop={8}>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Cambiar</Text>
                </Pressable>
              </View>
            )}
            <ErrorText>{enviar.error}</ErrorText>
          </>
        )}

        {!revelada && <Contados n={r?.respondieron ?? 0} />}

        {propio && !revelada && (
          <>
            {muro.length > 0 && (
              <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 14 }}>
                Solo tú las ves hasta que las muestres. Toca el ojo para ocultar una del muro.
              </Text>
            )}
            <Muro evento={evento} propio onCambio={onCambio} />
            <Button
              label="Mostrar las respuestas a todos"
              icon={EyeIcon}
              onPress={() => cambiar({ revelar: true })}
              busy={manejar.busy}
              style={{ marginTop: 14 }}
            />
          </>
        )}

        {revelada && (
          <>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
              {muro.filter((m) => !m.oculta).length === 0
                ? 'Nadie respondió esta vez.'
                : `Lo que respondió la iglesia${r && r.respondieron > muro.length ? ` (las ${muro.length} más recientes de ${r.respondieron})` : ''}`}
            </Text>
            <Muro evento={evento} propio={propio} onCambio={onCambio} />
          </>
        )}
        <ErrorText>{manejar.error}</ErrorText>
      </View>
    </Appear>
  );
}

/** Las respuestas como notas sueltas en una pared; quien predica puede ocultarlas. */
function Muro({ evento, propio, onCambio }: { evento: Evento; propio?: boolean; onCambio: (e: Evento) => void }) {
  const colors = useColors();
  const dark = isDark(colors);
  const { run } = useAction();
  const muro = evento.resultados?.muro ?? [];
  if (!muro.length) return null;
  return (
    <View style={styles.wall}>
      {muro.map((m, n) => (
        <Appear key={m.id} from={6} delay={Math.min(n, 12) * 40}>
          <View
            style={[
              styles.note,
              { backgroundColor: n % 3 === 0 ? colors.warmSoft : dark ? colors.background : colors.accentSoft, opacity: m.oculta ? 0.45 : 1 },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: 14.5, lineHeight: 20, flexShrink: 1, textDecorationLine: m.oculta ? 'line-through' : 'none' }}>
              {m.texto}
            </Text>
            {propio && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={m.oculta ? 'Volver a mostrar esta respuesta' : 'Ocultar esta respuesta'}
                hitSlop={8}
                onPress={() => run(async () => onCambio(await ocultarRespuesta(evento.codigo, m.id, !m.oculta)))}
              >
                <EyeIcon color={colors.muted} size={15} />
              </Pressable>
            )}
          </View>
        </Appear>
      ))}
    </View>
  );
}

/** La hoja de quien predica para lanzar algo: una pregunta abierta o el repaso del mensaje. */
export function LanzarInteraccion({ evento, books, onCambio, onClose }: { evento: Evento; books: Book[]; onCambio: (e: Evento) => void; onClose: () => void }) {
  const colors = useColors();
  const dark = isDark(colors);
  const [pregunta, setPregunta] = useState('');
  const [preguntas, setPreguntas] = useState<PreguntaRepaso[] | null>(null);
  const [fuera, setFuera] = useState<number[]>([]);
  const preparar = useAction();
  const lanzar = useAction();
  const elegidas = useMemo(() => (preguntas ?? []).filter((_, n) => !fuera.includes(n)), [preguntas, fuera]);
  const citas = new Set(evento.puntos.flatMap((p) => p.citas)).size;

  const poner = (nueva: Parameters<typeof interactuarEvento>[1]['nueva']) =>
    lanzar.run(async () => {
      onCambio(await interactuarEvento(evento.codigo, { nueva }));
      onClose();
    });

  return (
    <Sheet title="Que la iglesia responda" kicker="INTERACTUAR" onClose={onClose}>
      <Text style={[styles.section, { color: colors.muted }]}>UNA PREGUNTA ABIERTA</Text>
      <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 10 }}>
        Cada uno responde en su teléfono, sin su nombre. Tú ves las respuestas primero y las muestras como un muro, también en la pantalla.
      </Text>
      <Field
        value={pregunta}
        onChangeText={setPregunta}
        placeholder="Escribe la pregunta"
        accessibilityLabel="La pregunta para la iglesia"
        multiline
        style={{ backgroundColor: colors.surface, minHeight: 64 }}
      />
      <View style={styles.ideas}>
        {IDEAS.map((idea) => (
          <Pressable
            key={idea}
            accessibilityRole="button"
            onPress={() => setPregunta(idea)}
            style={[styles.idea, { borderColor: pregunta === idea ? colors.warm : colors.border, backgroundColor: pregunta === idea ? colors.warmSoft : 'transparent' }]}
          >
            <Text style={{ color: colors.text, fontSize: 13 }}>{idea}</Text>
          </Pressable>
        ))}
      </View>
      <Button
        label="Hacer la pregunta"
        icon={CommentIcon}
        onPress={() => poner({ tipo: 'pregunta', titulo: pregunta.trim() })}
        disabled={!pregunta.trim()}
        busy={lanzar.busy && !preguntas}
      />

      <View style={[styles.repaso, { backgroundColor: colors.warmSoft }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <StarIcon color={colors.warm} size={20} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15.5 }}>Repaso del mensaje</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
              Preguntas de opción múltiple sobre los puntos{citas > 0 ? ` y sus ${citas === 1 ? 'cita' : `${citas} citas`}` : ''}. La iglesia acierta junta.
            </Text>
          </View>
        </View>
        {!preguntas ? (
          <>
            <ErrorText>{preparar.error}</ErrorText>
            <Button
              label={preparar.busy ? 'Preparando las preguntas…' : 'Preparar el repaso'}
              icon={StarIcon}
              kind="outline"
              busy={preparar.busy}
              onPress={() => preparar.run(async () => setPreguntas(await repasoDelMensaje(evento, books)))}
              style={{ marginTop: 12 }}
            />
          </>
        ) : (
          <>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 12, marginBottom: 6 }}>Revisa las preguntas y quita las que no quieras usar.</Text>
            <View style={{ gap: 8 }}>
              {preguntas.map((q, n) => {
                const on = !fuera.includes(n);
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => setFuera((f) => (on ? [...f, n] : f.filter((x) => x !== n)))}
                    style={[styles.q, { backgroundColor: colors.surface, borderColor: on ? colors.warm : colors.border, opacity: on ? 1 : 0.55 }]}
                  >
                    <View style={[styles.check, { backgroundColor: on ? colors.warm : 'transparent', borderColor: on ? colors.warm : colors.border }]}>
                      {on && <CheckIcon color="#FFFFFF" size={12} strokeWidth={2.8} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, lineHeight: 19 }}>{q.texto}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 3 }}>
                        <Text style={{ color: dark ? colors.text : colors.warm, fontWeight: '800' }}>
                          {LETRAS[q.correcta]}) {q.opciones[q.correcta]}
                        </Text>
                        {q.cita ? ` · ${q.cita}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Button
              label={`Empezar el repaso (${elegidas.length})`}
              icon={StarIcon}
              onPress={() => poner({ tipo: 'repaso', titulo: evento.titulo, preguntas: elegidas })}
              disabled={elegidas.length === 0}
              busy={lanzar.busy}
              style={{ marginTop: 12 }}
            />
          </>
        )}
      </View>
      <ErrorText>{lanzar.error}</ErrorText>
    </Sheet>
  );
}

// --- En la pantalla de la iglesia ---

const TINTA = '#F2EEE8';
const SUAVE = '#A39E96';
const CALIDO = '#E2A868';
const BIEN = '#7FC79A';
const NOTAS = ['#2A2622', '#33291F', '#262A26'];

/** La interacción en grande para el proyector: la pregunta, cuántos respondieron y, revelado, el muro o los votos. */
export function InteraccionProyector({ evento, width }: { evento: Evento; width: number }) {
  const i = evento.interaccion;
  const r = evento.resultados;
  if (!i) return null;
  const big = Math.min(Math.max(width / 26, 26), 54);
  const n = r?.respondieron ?? 0;
  const contados = n === 0 ? 'Responde en tu teléfono' : n === 1 ? '1 persona respondió' : `${n.toLocaleString('es')} personas respondieron`;

  if (i.tipo === 'pregunta') {
    const revelada = i.reveladas.includes(0);
    const muro = (r?.muro ?? []).filter((m) => !m.oculta).slice(0, 24);
    return (
      <View style={proy.box}>
        <Text style={proy.kicker}>PREGUNTA PARA TODOS</Text>
        <Text style={[proy.q, { fontSize: big, lineHeight: big * 1.22 }]}>{i.titulo}</Text>
        {revelada ? (
          <View style={proy.wall}>
            {muro.map((m, k) => (
              <Appear key={m.id} from={8} delay={Math.min(k, 16) * 60}>
                <View style={[proy.note, { backgroundColor: NOTAS[k % NOTAS.length] }]}>
                  <Text style={[proy.noteText, { fontSize: Math.max(big * 0.42, 17) }]}>{m.texto}</Text>
                </View>
              </Appear>
            ))}
          </View>
        ) : (
          <Text style={proy.count}>{contados}</Text>
        )}
      </View>
    );
  }

  const q = i.preguntas?.[i.paso];
  if (!q) return null;
  const revelada = i.reveladas.includes(i.paso);
  const votos = r?.votos?.[i.paso] ?? [0, 0, 0, 0];
  const total = votos.reduce((a, b) => a + b, 0);
  const total_ = i.preguntas?.length ?? 0;
  const ultimo = i.paso === total_ - 1;
  const aciertos = i.reveladas.filter((p) => acertoElGrupo(r?.votos?.[p] ?? [], i.preguntas?.[p]?.correcta ?? -1)).length;
  return (
    <View style={proy.box}>
      <Text style={proy.kicker}>
        REPASO · PREGUNTA {i.paso + 1} DE {total_}
      </Text>
      <Text style={[proy.q, { fontSize: big, lineHeight: big * 1.22 }]}>{q.texto}</Text>
      <View style={{ gap: 12, marginTop: 22, width: '100%' }}>
        {q.opciones.map((o, k) => {
          const ok = revelada && q.correcta === k;
          return (
            <View key={k} style={[proy.option, { borderColor: ok ? BIEN : '#3A3632', opacity: revelada && !ok ? 0.55 : 1 }]}>
              {revelada && total > 0 && <View style={[proy.fill, { width: `${(votos[k] / total) * 100}%`, backgroundColor: ok ? 'rgba(127,199,154,0.18)' : 'rgba(255,255,255,0.06)' }]} />}
              <Text style={[proy.letter, { color: ok ? BIEN : CALIDO }]}>{LETRAS[k]}</Text>
              <Text style={[proy.optText, { fontSize: Math.max(big * 0.5, 18) }]}>{o}</Text>
              {revelada && <Text style={[proy.votes, { color: ok ? BIEN : SUAVE }]}>{votos[k]}</Text>}
            </View>
          );
        })}
      </View>
      <Text style={proy.count}>
        {revelada
          ? ultimo
            ? `La iglesia acertó ${aciertos} de ${total_}`
            : acertoElGrupo(votos, q.correcta)
              ? '¡La iglesia acertó!'
              : `${votos[q.correcta]} de ${total} acertaron${q.cita ? ` · ${q.cita}` : ''}`
          : contados}
      </Text>
    </View>
  );
}

/** Al terminar el repaso, fuegos en la pantalla grande. */
export function useFuegosAlTerminar(evento: Evento | null) {
  const i = evento?.interaccion;
  const fin = !!i && i.tipo === 'repaso' && i.paso === (i.preguntas?.length ?? 0) - 1 && i.reveladas.includes(i.paso);
  useEffect(() => {
    if (fin) lanzarConfeti('fuegos');
  }, [fin]);
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1.5, padding: 16, marginTop: 18 },
  cardShadow: { boxShadow: '0 6px 24px rgba(168, 100, 31, 0.12)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  question: { fontFamily: serif, fontWeight: '700', fontSize: 21, lineHeight: 29, marginTop: 12, marginBottom: 14 },
  sent: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  wall: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, maxWidth: '100%' },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 4, marginBottom: 6 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 },
  idea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  repaso: { borderRadius: 16, padding: 14, marginTop: 22 },
  q: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 10 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});

const proy = StyleSheet.create({
  box: { width: '100%', maxWidth: 1100, alignItems: 'center' },
  kicker: { color: SUAVE, fontSize: 15, fontWeight: '800', letterSpacing: 1.5 },
  q: { color: TINTA, fontFamily: serif, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  count: { color: CALIDO, fontSize: 22, fontWeight: '700', marginTop: 26, textAlign: 'center' },
  wall: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 28 },
  note: { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, maxWidth: 420 },
  noteText: { color: TINTA, lineHeight: 28 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 2, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  letter: { fontSize: 22, fontWeight: '900', width: 26 },
  optText: { color: TINTA, flex: 1, fontWeight: '600' },
  votes: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
