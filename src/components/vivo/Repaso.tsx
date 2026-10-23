// El repaso relámpago de la sala en vivo: preguntas de opción múltiple que todos responden a la vez. Se juega en
// grupo (el grupo acierta junto), con puntos y podio, o por equipos; los puntos duran solo esa sesión.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Avatar, Button } from '@/components/comunidad/ui';
import { ArrowRightIcon, CheckIcon, CloseIcon, EyeIcon, PeopleIcon, StarIcon } from '@/components/icons';
import { lanzarConfeti } from '@/lib/confeti';
import { type Herramienta, askStudy } from '@/lib/estudio';
import { LETRAS, type ModoRepaso, NOMBRES_EQUIPOS, type PreguntaRepaso, acertoElGrupo, parseRepaso } from '@/lib/repaso';
import { isDark, serif, useColors } from '@/lib/theme';
import { type Persona, type Respuestas, type Tarjeta, TONOS } from '@/lib/vivo';

import { Progreso } from './Estudio';
import { LIVE_RED, vivoText } from './piezas';

const BIEN = TONOS[1];
const EQUIPO_TONOS = [TONOS[0], TONOS[2]];

export const MODOS: [ModoRepaso, string, string][] = [
  ['grupo', 'En grupo', 'Todos contra el reloj, juntos'],
  ['puntos', 'Con puntos', 'Más puntos por responder rápido, y podio'],
  ['equipos', 'Por equipos', 'Dos equipos parejos, sin nadie último'],
];

const repasos = new Map<string, Promise<PreguntaRepaso[]>>();

/** Las preguntas del repaso del capítulo: se preparan una vez y quedan guardadas para todos. */
export function repasoDe(libro: string, capitulo: number) {
  const key = `${libro}.${capitulo}`;
  let p = repasos.get(key);
  if (!p) {
    p = askStudy({ book: libro, chapter: capitulo, messages: [], herramienta: 'repaso' as Herramienta }, () => {}).then((r) => {
      const qs = parseRepaso(r.text);
      if (!qs.length) throw new Error('No salió bien el repaso. Inténtalo otra vez.');
      return qs;
    });
    p.catch(() => repasos.delete(key));
    repasos.set(key, p);
  }
  return p;
}

/** El botón de la pestaña Estudio para lanzar un repaso, con la forma de jugarlo. */
export function LanzarRepaso({ libro, capitulo, onPut }: { libro: string; capitulo: number; onPut: (preguntas: PreguntaRepaso[], modo: ModoRepaso) => void }) {
  const colors = useColors();
  const [modo, setModo] = useState<ModoRepaso>('grupo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      onPut(await repasoDe(libro, capitulo), modo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <View style={[styles.launch, { backgroundColor: colors.warmSoft }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <StarIcon color={colors.warm} size={20} strokeWidth={2} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15.5 }}>Repaso relámpago</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Preguntas de opción múltiple sobre el capítulo</Text>
        </View>
      </View>
      <View style={styles.modes}>
        {MODOS.map(([m, label, detail]) => {
          const on = m === modo;
          return (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              onPress={() => setModo(m)}
              style={[styles.mode, { backgroundColor: on ? colors.surface : 'transparent', borderColor: on ? colors.warm : 'transparent' }]}
            >
              <Text style={{ color: on ? colors.text : colors.muted, fontWeight: '800', fontSize: 13 }}>{label}</Text>
              <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 15, marginTop: 2 }} numberOfLines={2}>
                {detail}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!!error && <Text style={{ color: LIVE_RED, fontSize: 13, marginBottom: 8 }}>{error}</Text>}
      <Button label={busy ? 'Preparando las preguntas…' : 'Empezar el repaso'} icon={StarIcon} busy={busy} onPress={go} />
    </View>
  );
}

type Props = {
  tarjeta: Tarjeta;
  respuestas: Respuestas | null;
  presentes: Persona[];
  guia: string;
  me: string | null;
  lead: boolean;
  /** En un evento de iglesia no se sabe quiénes están: se muestra solo cuántos respondieron. */
  respondieron?: number;
  /** Quién juega junto: «El grupo» en la sala, «La iglesia» en un evento. */
  quien?: string;
  onAnswer: (opcion: number) => Promise<boolean>;
  onReveal: () => void;
  onNext: (paso: number) => void;
  onClose: () => void;
};

export function TarjetaRepaso({ tarjeta: t, respuestas, presentes, guia, me, lead, respondieron, quien = 'El grupo', onAnswer, onReveal, onNext, onClose }: Props) {
  const colors = useColors();
  const dark = isDark(colors);
  const preguntas = t.preguntas ?? [];
  const q = preguntas[t.paso];
  const ronda = `${t.id}:${t.paso}`;
  const mine = respuestas?.ronda === ronda ? respuestas : null;
  const quienes = mine?.quienes ?? [];
  const reveladas = t.reveladas ?? [];
  const revealed = reveladas.includes(t.paso);
  const votos = respuestas?.votos?.[t.paso] ?? [0, 0, 0, 0];
  const last = t.paso === preguntas.length - 1;
  const done = last && revealed;
  // Lo que eligió cada uno se queda en su teléfono (el servidor no lo publica hasta revelar).
  const [elegidas, setElegidas] = useState<Record<string, number>>({});
  const [sending, setSending] = useState<number | null>(null);
  const elegida = elegidas[ronda];
  const answered = !!me && quienes.includes(me);
  const modo = t.modo ?? 'grupo';

  const choose = async (i: number) => {
    if (!me || answered || revealed || sending !== null) return;
    setSending(i);
    if (await onAnswer(i)) setElegidas((e) => ({ ...e, [ronda]: i }));
    setSending(null);
  };

  const aciertosGrupo = reveladas.filter((p) => acertoElGrupo(respuestas?.votos?.[p] ?? [], preguntas[p]?.correcta ?? -1)).length;
  const yo = respuestas?.marcador?.find((f) => f.usuario === me);
  const puntosEquipo = useMemo(() => {
    const n = [0, 0];
    for (const f of respuestas?.marcador ?? []) if (f.equipo === 0 || f.equipo === 1) n[f.equipo] += f.puntos;
    return n;
  }, [respuestas?.marcador]);
  const miEquipo = me && t.equipos ? t.equipos[me] : undefined;

  // Al terminar, confeti en todos los teléfonos (una vez por repaso).
  const celebrado = useRef(false);
  useEffect(() => {
    if (done && !celebrado.current) {
      celebrado.current = true;
      lanzarConfeti('fuegos');
    }
  }, [done]);

  if (!q) return null;

  return (
    <Appear from={10}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.warmSoft }]}>
            <StarIcon color={colors.warm} size={16} strokeWidth={2} />
          </View>
          <Text style={[vivoText.kicker, { color: colors.warm, flex: 1 }]} numberOfLines={1}>
            REPASO RELÁMPAGO
          </Text>
          <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '800' }}>{MODOS.find(([m]) => m === modo)?.[1]}</Text>
          </View>
          {lead && (
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} accessibilityLabel="Quitar la tarjeta de todas las pantallas">
              <CloseIcon color={colors.muted} size={18} />
            </Pressable>
          )}
        </View>

        {/* Una marca por pregunta: verde si el grupo la acertó, la de ahora con borde */}
        <View style={styles.dots} accessibilityLabel={`Pregunta ${t.paso + 1} de ${preguntas.length}`}>
          {preguntas.map((p, i) => {
            const shown = reveladas.includes(i);
            const ok = shown && acertoElGrupo(respuestas?.votos?.[i] ?? [], p.correcta);
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: shown ? (ok ? (dark ? BIEN.dark : BIEN.light) : colors.accentSoft) : colors.background, borderColor: i === t.paso ? colors.warm : colors.border },
                ]}
              >
                {shown && ok ? (
                  <CheckIcon color={BIEN.ink} size={12} strokeWidth={2.6} />
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>
                )}
              </View>
            );
          })}
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '700', marginLeft: 'auto' }}>
            {t.paso + 1} de {preguntas.length}
          </Text>
        </View>

        <Text style={[styles.question, { color: colors.text }]}>{q.texto}</Text>

        <View style={{ gap: 8 }}>
          {q.opciones.map((o, i) => {
            const correct = revealed && q.correcta === i;
            const picked = elegida === i;
            const wrong = revealed && picked && !correct;
            const total = votos.reduce((a, b) => a + b, 0);
            const bg = correct ? (dark ? BIEN.dark : BIEN.light) : picked && !revealed ? colors.warmSoft : colors.background;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${LETRAS[i]}: ${o}${correct ? ', la correcta' : ''}${picked ? ', tu respuesta' : ''}`}
                accessibilityState={{ selected: picked, disabled: !me || answered || revealed }}
                onPress={() => choose(i)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: bg,
                    borderColor: wrong ? LIVE_RED : correct ? BIEN.ink : picked ? colors.warm : colors.border,
                    opacity: revealed && !correct && !picked ? 0.6 : 1,
                  },
                  pressed && !answered && !revealed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                {revealed && total > 0 && (
                  <View
                    style={[styles.votes, { width: `${(votos[i] / total) * 100}%`, backgroundColor: correct ? 'rgba(47,107,69,0.14)' : 'rgba(127,127,127,0.10)' }]}
                  />
                )}
                <View style={[styles.letter, { backgroundColor: correct ? BIEN.ink : picked ? colors.warm : colors.accentSoft }]}>
                  {sending === i ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : correct ? (
                    <CheckIcon color="#FFFFFF" size={14} strokeWidth={2.6} />
                  ) : (
                    <Text style={{ color: picked ? '#FFFFFF' : colors.text, fontWeight: '800', fontSize: 13 }}>{LETRAS[i]}</Text>
                  )}
                </View>
                <Text style={{ color: colors.text, fontSize: 15.5, lineHeight: 21, flex: 1, fontWeight: correct ? '700' : '500' }}>{o}</Text>
                {revealed && (
                  <Text style={{ color: correct ? BIEN.ink : colors.muted, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] }}>{votos[i]}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {!revealed && (
          <>
            {me && answered && (
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12 }}>
                {elegida !== undefined ? `Elegiste la ${LETRAS[elegida]}. ` : 'Ya respondiste. '}Espera a que se revele.
              </Text>
            )}
            {!me && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12 }}>Entra con tu cuenta para jugar.</Text>}
            {respondieron === undefined ? (
              <Progreso clave={ronda} presentes={presentes} quienes={quienes} guia={guia} />
            ) : (
              <Contados n={respondieron} />
            )}
            {lead && <Button label="Revelar la respuesta" icon={EyeIcon} onPress={onReveal} style={{ marginTop: 14 }} />}
          </>
        )}

        {revealed && (
          <Appear from={6}>
            <View style={[styles.result, { borderColor: colors.border }]}>
              {!!q.cita && <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '700' }}>{q.cita}</Text>}
              {modo === 'grupo' && (
                <Text style={[styles.resultText, { color: acertoElGrupo(votos, q.correcta) ? BIEN.ink : colors.text }]}>
                  {acertoElGrupo(votos, q.correcta) ? `¡${quien} acertó!` : `Esta costó: ${votos[q.correcta]} de ${votos.reduce((a, b) => a + b, 0)} acertaron`}
                </Text>
              )}
              {modo === 'puntos' && yo && (
                <Text style={[styles.resultText, { color: colors.text }]}>
                  {elegida === q.correcta ? '¡Bien! ' : ''}Llevas {yo.puntos.toLocaleString('es')} puntos
                </Text>
              )}
              {modo === 'equipos' && <Equipos puntos={puntosEquipo} mio={miEquipo} />}
            </View>
          </Appear>
        )}

        {done && <Final quien={quien} modo={modo} aciertos={aciertosGrupo} total={preguntas.length} marcador={respuestas?.marcador ?? []} equipos={puntosEquipo} me={me} />}
        {revealed && modo === 'puntos' && !done && <Podio marcador={respuestas?.marcador ?? []} me={me} compact />}

        {lead && revealed && !last && (
          <Button label="Siguiente pregunta" icon={ArrowRightIcon} iconAfter onPress={() => onNext(t.paso + 1)} style={{ marginTop: 14 }} />
        )}
      </View>
    </Appear>
  );
}

/** Cuántos respondieron, cuando no se sabe cuántos están (la congregación de un evento). */
export function Contados({ n }: { n: number }) {
  const colors = useColors();
  return (
    <View style={styles.contados}>
      <PeopleIcon color={n ? colors.warm : colors.muted} size={16} />
      <Text style={{ color: n ? colors.text : colors.muted, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] }} accessibilityLiveRegion="polite">
        {n === 0 ? 'Nadie ha respondido todavía' : n === 1 ? '1 persona respondió' : `${n.toLocaleString('es')} personas respondieron`}
      </Text>
    </View>
  );
}

function Equipos({ puntos, mio }: { puntos: number[]; mio?: number }) {
  const colors = useColors();
  const dark = isDark(colors);
  const max = Math.max(1, ...puntos);
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {NOMBRES_EQUIPOS.map((name, i) => {
        const tone = EQUIPO_TONOS[i];
        return (
          <View key={name} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PeopleIcon color={dark ? colors.text : tone.ink} size={15} />
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13.5, flex: 1 }}>
                {name}
                {mio === i ? ' (el tuyo)' : ''}
              </Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13.5, fontVariant: ['tabular-nums'] }}>{puntos[i].toLocaleString('es')}</Text>
            </View>
            <View style={[styles.teamBar, { backgroundColor: colors.accentSoft }]}>
              <View style={[styles.teamFill, { width: `${(puntos[i] / max) * 100}%`, backgroundColor: dark ? tone.ink : tone.ink }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Podio({ marcador, me, compact }: { marcador: NonNullable<Respuestas['marcador']>; me: string | null; compact?: boolean }) {
  const colors = useColors();
  const dark = isDark(colors);
  const top = marcador.slice(0, compact ? 3 : 5);
  if (!top.length) return null;
  return (
    <View style={{ gap: 6, marginTop: 12 }}>
      {top.map((f, i) => (
        <View key={f.usuario} style={[styles.rank, { backgroundColor: f.usuario === me ? colors.warmSoft : colors.background, borderColor: colors.border }]}>
          <Text style={[styles.place, { color: i === 0 ? colors.warm : colors.muted }]}>{i + 1}</Text>
          <Avatar name={f.nombre} size={24} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={1}>
            {f.usuario === me ? 'Tú' : f.nombre.split(' ')[0]}
          </Text>
          <Text style={{ color: dark ? colors.text : colors.muted, fontWeight: '800', fontSize: 13.5, fontVariant: ['tabular-nums'] }}>{f.puntos.toLocaleString('es')}</Text>
        </View>
      ))}
    </View>
  );
}

/** El final del repaso: lo que acertó el grupo, el podio o el equipo que ganó. */
function Final({
  quien,
  modo,
  aciertos,
  total,
  marcador,
  equipos,
  me,
}: {
  quien: string;
  modo: ModoRepaso;
  aciertos: number;
  total: number;
  marcador: NonNullable<Respuestas['marcador']>;
  equipos: number[];
  me: string | null;
}) {
  const colors = useColors();
  const ganador = equipos[0] === equipos[1] ? null : equipos[0] > equipos[1] ? 0 : 1;
  return (
    <Appear from={10}>
      <View style={[styles.final, { backgroundColor: colors.warmSoft }]}>
        <Text style={[vivoText.kicker, { color: colors.warm }]}>RESULTADO</Text>
        {modo === 'grupo' && (
          <Text style={[styles.finalTitle, { color: colors.text }]}>
            {quien} acertó {aciertos} de {total}
          </Text>
        )}
        {modo === 'equipos' && (
          <Text style={[styles.finalTitle, { color: colors.text }]}>{ganador === null ? '¡Empate entre los equipos!' : `¡Ganó el ${NOMBRES_EQUIPOS[ganador]}!`}</Text>
        )}
        {modo === 'puntos' && (
          <>
            <Text style={[styles.finalTitle, { color: colors.text }]}>
              {marcador[0] ? `¡${marcador[0].usuario === me ? 'Ganaste' : `Ganó ${marcador[0].nombre.split(' ')[0]}`}!` : 'Nadie respondió'}
            </Text>
            <Podio marcador={marcador} me={me} />
          </>
        )}
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
          {modo === 'grupo' ? 'Lo que cuesta, vale la pena conversarlo.' : 'Los puntos son solo de hoy. Lo que queda es lo que aprendieron juntos.'}
        </Text>
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 20, boxShadow: '0 6px 24px rgba(0,0,0,0.08)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  question: { fontFamily: serif, fontWeight: '700', fontSize: 21, lineHeight: 29, marginTop: 12, marginBottom: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, overflow: 'hidden' },
  votes: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  letter: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  result: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12 },
  resultText: { fontFamily: serif, fontSize: 18, fontWeight: '700', marginTop: 4 },
  teamBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  teamFill: { height: 8, borderRadius: 4 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  place: { width: 18, fontWeight: '900', fontSize: 15, textAlign: 'center' },
  final: { borderRadius: 16, padding: 16, marginTop: 16 },
  finalTitle: { fontFamily: serif, fontSize: 22, fontWeight: '700', marginTop: 6 },
  contados: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  launch: { borderRadius: 16, padding: 14, marginBottom: 14 },
  modes: { flexDirection: 'row', gap: 6, marginVertical: 12 },
  mode: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 9 },
});
