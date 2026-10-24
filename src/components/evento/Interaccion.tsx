// Interactuar durante el sermón o la reflexión: quien predica lanza una pregunta abierta (las respuestas forman un
// muro al mostrarlas), un repaso de opción múltiple sobre el mensaje o una dinámica para hacer juntos, y la
// congregación la sigue en el teléfono sin cuenta. El repaso y la dinámica usan las mismas tarjetas que la sala de
// la célula (src/components/vivo/Repaso.tsx y TarjetaVivo.tsx).
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Button, ErrorText, Field, useAction } from '@/components/comunidad/ui';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CloseIcon, CommentIcon, EyeIcon, LockIcon, PeopleIcon, StarIcon } from '@/components/icons';
import { Contados, TarjetaRepaso } from '@/components/vivo/Repaso';
import { Rueda, useParada } from '@/components/vivo/Ruleta';
import { Segmented, Sheet, vivoText } from '@/components/vivo/piezas';
import TarjetaVivo from '@/components/vivo/TarjetaVivo';
import { lanzarConfeti } from '@/lib/confeti';
import type { Book } from '@/lib/data';
import { DINAMICAS, MOMENTOS, type Momento, dinamica } from '@/lib/dinamicas';
import {
  type Evento,
  interactuarEvento,
  ocultarRespuesta,
  participanteId,
  repasoDelMensaje,
  responderEvento,
} from '@/lib/eventos';
import { CATEGORIAS, GIROS, LETRAS, NIVELES, NOMBRES_EQUIPOS, type PreguntaRepaso, RULETA, acertoElGrupo, equipoDe } from '@/lib/repaso';
import { isDark, serif, useColors } from '@/lib/theme';
import { type Respuestas, type Tarjeta, clock, useCountdown } from '@/lib/vivo';

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

  if (i.tipo === 'dinamica') {
    // La misma tarjeta que en la célula: los pasos (quien predica marca el de ahora) y el reloj que ven todos.
    const tarjeta: Tarjeta = {
      id: i.id,
      tipo: 'dinamica',
      titulo: i.titulo,
      texto: i.objetivo ?? null,
      pasos: i.pasos ?? [],
      paso: i.paso,
      dinamica: i.dinamica ?? null,
      minutos: i.minutos ?? null,
      fin: i.fin ?? null,
    };
    return (
      <View style={{ marginTop: 18 }}>
        <TarjetaVivo
          key={i.id}
          tarjeta={tarjeta}
          skew={0}
          lead={propio}
          onStep={(paso) => cambiar({ paso })}
          onTimer={(reloj) => cambiar({ reloj })}
          onClose={() => cambiar({ quitar: true })}
        />
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

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
      modo: i.modo ?? 'grupo',
      ...(i.juego === 'ruleta' && {
        juego: 'ruleta' as const,
        casillas: i.casillas,
        giro: i.giro,
        // El equipo de este teléfono sale de su identificador (src/lib/repaso.ts, equipoDe).
        ...(i.modo === 'equipos' && me && { equipos: { [me]: equipoDe(me) } }),
      }),
    };
    const respuestas: Respuestas = { ronda: clave, quienes: me && clave in mias ? [me] : [], lista: null, votos: r?.votos, puntaje: r?.puntaje };
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
          onSpin={() => cambiar({ girar: true })}
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
        <Appear key={m.id} from={6} delay={Math.min(n, 12) * 40} style={{ maxWidth: '100%' }}>
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
  const [juego, setJuego] = useState<'repaso' | 'ruleta'>('repaso');
  const [modo, setModo] = useState<'grupo' | 'equipos'>('grupo');
  const [todas, setTodas] = useState<Partial<Record<'repaso' | 'ruleta', PreguntaRepaso[]>>>({});
  const preguntas = todas[juego] ?? null;
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

      <DinamicasParaLanzar evento={evento} onLanzar={(id) => poner({ tipo: 'dinamica', dinamica: id })} busy={lanzar.busy} />

      <View style={[styles.repaso, { backgroundColor: colors.warmSoft }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <StarIcon color={colors.warm} size={20} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15.5 }}>Juegos del mensaje</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
              Preguntas sobre los puntos{citas > 0 ? ` y sus ${citas === 1 ? 'cita' : `${citas} citas`}` : ''}.{' '}
              {juego === 'repaso'
                ? 'La iglesia acierta junta.'
                : 'La ruleta elige la categoría y la dificultad: lo que dice, qué significa, el tema y para la vida.'}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <Segmented
            options={[
              ['repaso', 'Repaso'],
              ['ruleta', 'Ruleta de preguntas'],
            ]}
            value={juego}
            onChange={(j) => {
              setJuego(j);
              setFuera([]);
            }}
          />
        </View>
        {juego === 'ruleta' && (
          <View style={styles.modes}>
            {(
              [
                ['grupo', 'Toda la iglesia', 'Suman puntos juntos'],
                ['equipos', 'Por equipos', 'Dos equipos al azar, parejos'],
              ] as const
            ).map(([m, label, detail]) => {
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
                  <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>{detail}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {!preguntas ? (
          <>
            <ErrorText>{preparar.error}</ErrorText>
            <Button
              label={preparar.busy ? 'Preparando las preguntas…' : juego === 'repaso' ? 'Preparar el repaso' : 'Preparar la ruleta'}
              icon={StarIcon}
              kind="outline"
              busy={preparar.busy}
              onPress={() => {
                const j = juego;
                preparar.run(async () => {
                  const qs = await repasoDelMensaje(evento, books, j);
                  setTodas((t) => ({ ...t, [j]: qs }));
                });
              }}
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
                      {juego === 'ruleta' && q.categoria && (
                        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 2 }}>
                          {CATEGORIAS.find((c) => c.id === q.categoria)?.nombre.toUpperCase()}
                          {q.nivel ? ` · ${NIVELES[q.nivel - 1].toUpperCase()}` : ''}
                        </Text>
                      )}
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
              label={juego === 'repaso' ? `Empezar el repaso (${elegidas.length})` : `Empezar la ruleta (${elegidas.length})`}
              icon={StarIcon}
              onPress={() =>
                poner(
                  juego === 'repaso'
                    ? { tipo: 'repaso', titulo: evento.titulo, preguntas: elegidas }
                    : { tipo: 'repaso', titulo: evento.titulo, preguntas: elegidas, juego: 'ruleta', modo },
                )
              }
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

/**
 * Mandar una dinámica a los teléfonos: primero las que pusiste en los puntos del mensaje (la del punto de ahora
 * arriba), y debajo el catálogo entero por momentos.
 */
function DinamicasParaLanzar({ evento, onLanzar, busy }: { evento: Evento; onLanzar: (id: string) => void; busy: boolean }) {
  const colors = useColors();
  const [todas, setTodas] = useState(false);
  const [momento, setMomento] = useState<Momento>('conectar');
  const delMensaje = evento.puntos
    .map((p, n) => ({ n, d: dinamica(p.dinamica) }))
    .filter((x): x is { n: number; d: NonNullable<ReturnType<typeof dinamica>> } => !!x.d)
    .sort((a, b) => Number(b.n === evento.punto) - Number(a.n === evento.punto));
  const Chevron = todas ? ChevronUpIcon : ChevronDownIcon;
  const fila = (d: NonNullable<ReturnType<typeof dinamica>>, sub: string, ahora = false) => (
    <Pressable
      key={`${sub}${d.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Mandar «${d.nombre}» a los teléfonos`}
      disabled={busy}
      onPress={() => onLanzar(d.id)}
      style={({ pressed }) => [styles.dinamica, { backgroundColor: colors.surface, borderColor: ahora ? colors.warm : colors.border }, pressed && { opacity: 0.75 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: ahora ? colors.warm : colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>{sub.toUpperCase()}</Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 1 }}>{d.nombre}</Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 17, marginTop: 2 }} numberOfLines={2}>
          {d.objetivo}
        </Text>
      </View>
      <View style={[styles.mandar, { backgroundColor: colors.warmSoft }]}>
        <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 12.5 }}>Mandar</Text>
      </View>
    </Pressable>
  );
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={[styles.section, { color: colors.muted }]}>UNA DINÁMICA PARA HACER JUNTOS</Text>
      <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 10 }}>
        Aparece en cada teléfono con sus pasos. Tú marcas el paso en que van y pones el reloj, el mismo para todos.
      </Text>
      <View style={{ gap: 8 }}>
        {delMensaje.map(({ n, d }) => fila(d, `${n === evento.punto ? 'Punto de ahora' : 'Punto'} ${n + 1} · ${d.minutos} min`, n === evento.punto))}
      </View>
      <Pressable onPress={() => setTodas(!todas)} accessibilityRole="button" accessibilityState={{ expanded: todas }} style={styles.verTodas} hitSlop={6}>
        <PeopleIcon color={colors.accent} size={15} />
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13.5 }}>
          {delMensaje.length ? 'Otra dinámica del catálogo' : `Elegir entre las ${DINAMICAS.length} dinámicas`}
        </Text>
        <Chevron color={colors.accent} size={14} />
      </Pressable>
      {todas && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <View style={styles.ideas}>
            {MOMENTOS.map((m) => {
              const on = m.momento === momento;
              return (
                <Pressable
                  key={m.momento}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setMomento(m.momento)}
                  style={[styles.idea, { borderColor: on ? colors.warm : colors.border, backgroundColor: on ? colors.warmSoft : 'transparent' }]}
                >
                  <Text style={{ color: on ? colors.text : colors.muted, fontWeight: '700', fontSize: 13 }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {DINAMICAS.filter((d) => d.momento === momento).map((d) => fila(d, `${d.minutos} min · ${d.grupo}`))}
        </View>
      )}
    </View>
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

  if (i.tipo === 'dinamica') return <DinamicaProyector evento={evento} big={big} />;

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

  if (i.juego === 'ruleta') return <RuletaProyector evento={evento} big={big} contados={contados} />;
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

/** La ruleta en la pantalla grande: gira a la vez que los teléfonos, luego la pregunta y el puntaje. */
function RuletaProyector({ evento, big, contados }: { evento: Evento; big: number; contados: string }) {
  const i = evento.interaccion!;
  const r = evento.resultados;
  const giro = i.giro ?? 0;
  const { parado, parar } = useParada(giro);
  const q = i.preguntas?.[i.paso];
  const revelada = i.reveladas.includes(i.paso);
  const casilla = i.casillas?.[i.paso] ?? null;
  const giros = Math.min(GIROS, i.preguntas?.length ?? 0);
  const fin = revelada && giro >= giros;
  const eq = r?.puntaje?.equipos ?? [0, 0];
  const marcador =
    i.modo === 'equipos'
      ? `${NOMBRES_EQUIPOS[0]} ${eq[0].toLocaleString('es')} · ${NOMBRES_EQUIPOS[1]} ${eq[1].toLocaleString('es')}`
      : `La iglesia: ${(r?.puntaje?.grupo ?? 0).toLocaleString('es')} puntos`;
  const ganador = eq[0] === eq[1] ? null : eq[0] > eq[1] ? 0 : 1;
  const verPregunta = !!q && parado && !fin;
  const c = casilla !== null ? RULETA[casilla] : null;
  return (
    <View style={proy.box}>
      <Text style={proy.kicker}>
        RULETA DE PREGUNTAS{giro > 0 ? ` · GIRO ${giro} DE ${giros}` : ''}
      </Text>
      {fin ? (
        <Text style={[proy.q, { fontSize: big, lineHeight: big * 1.22 }]}>
          {i.modo === 'equipos' ? (ganador === null ? '¡Empate!' : `¡Ganó el ${NOMBRES_EQUIPOS[ganador]}!`) : `La iglesia sumó ${(r?.puntaje?.grupo ?? 0).toLocaleString('es')} puntos`}
        </Text>
      ) : verPregunta && q && c ? (
        <>
          <Text style={[proy.count, { marginTop: 10 }]}>
            {CATEGORIAS.find((x) => x.id === c.categoria)?.nombre} · {NIVELES[c.nivel - 1]} · {c.puntos} puntos
          </Text>
          <Text style={[proy.q, { fontSize: big, lineHeight: big * 1.22 }]}>{q.texto}</Text>
          <View style={{ gap: 12, marginTop: 22, width: '100%' }}>
            {q.opciones.map((o, k) => {
              const ok = revelada && q.correcta === k;
              const votos = r?.votos?.[i.paso] ?? [];
              return (
                <View key={k} style={[proy.option, { borderColor: ok ? BIEN : '#3A3632', opacity: revelada && !ok ? 0.55 : 1 }]}>
                  <Text style={[proy.letter, { color: ok ? BIEN : CALIDO }]}>{LETRAS[k]}</Text>
                  <Text style={[proy.optText, { fontSize: Math.max(big * 0.5, 18) }]}>{o}</Text>
                  {revelada && <Text style={[proy.votes, { color: ok ? BIEN : SUAVE }]}>{votos[k] ?? 0}</Text>}
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      {!fin && (!verPregunta || revelada) && (
        <View style={{ marginTop: 18 }}>
          <Rueda casilla={casilla} giro={giro} onParada={parar} size={verPregunta ? 220 : 380} />
        </View>
      )}
      <Text style={proy.count}>{giro === 0 ? 'Prepárense: la ruleta está por girar' : verPregunta && !revelada ? contados : marcador}</Text>
    </View>
  );
}

/** La dinámica en grande: su nombre, el paso de ahora resaltado y el reloj. */
function DinamicaProyector({ evento, big }: { evento: Evento; big: number }) {
  const i = evento.interaccion!;
  const left = useCountdown(i.fin, 0);
  const pasos = i.pasos ?? [];
  return (
    <View style={proy.box}>
      <Text style={proy.kicker}>DINÁMICA{left !== null ? ` · ${left === 0 ? 'SE ACABÓ EL TIEMPO' : clock(left)}` : ''}</Text>
      <Text style={[proy.q, { fontSize: big, lineHeight: big * 1.22 }]}>{i.titulo}</Text>
      <View style={{ gap: 12, marginTop: 24, width: '100%', maxWidth: 900 }}>
        {pasos.map((p, k) => {
          const ahora = k === i.paso;
          return (
            <View key={k} style={[proy.option, { borderColor: ahora ? CALIDO : '#3A3632', opacity: ahora ? 1 : 0.55 }]}>
              <Text style={[proy.letter, { color: ahora ? CALIDO : SUAVE }]}>{k + 1}</Text>
              <Text style={[proy.optText, { fontSize: Math.max(big * (ahora ? 0.5 : 0.42), 17) }]}>{p}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Al terminar el repaso, fuegos en la pantalla grande. */
export function useFuegosAlTerminar(evento: Evento | null) {
  const i = evento?.interaccion;
  const fin =
    !!i &&
    i.tipo === 'repaso' &&
    i.reveladas.includes(i.paso) &&
    (i.juego === 'ruleta' ? (i.giro ?? 0) >= Math.min(GIROS, i.preguntas?.length ?? 0) : i.paso === (i.preguntas?.length ?? 0) - 1);
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
  idea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  repaso: { borderRadius: 16, padding: 14, marginTop: 22 },
  modes: { flexDirection: 'row', gap: 6, marginTop: 10 },
  mode: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 9 },
  q: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 10 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dinamica: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  mandar: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  verTodas: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12 },
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
