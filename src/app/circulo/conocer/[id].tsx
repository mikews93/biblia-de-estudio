import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Reportar from '@/components/circulo/Reportar';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Avatar, Button, Chips, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { CheckIcon, CommentIcon, FlagIcon, HeartIcon, LockIcon, PeopleIcon, PrayIcon, ShieldIcon } from '@/components/icons';
import { CONOCERNOS, DIAS_CONOCER, type Pasaje } from '@/lib/circulo';
import { type Conocer, cambiarEtapa, cerrarConocer, enviarMensaje, leerConocer, pedirAcompanamiento, responderConocer } from '@/lib/circuloApi';
import { useAccount } from '@/lib/comunidad';
import { type Verse, getChapter } from '@/lib/data';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Vista = 'dias' | 'charla';
/** Abre donde hay algo que hacer: la pregunta de hoy si falta responderla, si no la conversación con mensajes nuevos. */
function vistaInicial(c: Conocer): Vista {
  const pendiente = !c.progreso.terminado && c.progreso.abierto && !c.dias[c.progreso.dia - 1]?.mia;
  return !pendiente && c.mensajesNuevos ? 'charla' : 'dias';
}

const go = (href: string) => navigate(() => router.push(href as never), 'forward');

/** «Conocernos»: siete días con la Palabra para dos personas del círculo que se eligieron, y su conversación. */
export default function ConocerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { usuario, ready } = useAccount();
  const [c, setC] = useState<Conocer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista | null>(null);

  const reload = useCallback(() => {
    if (!usuario || !id) return Promise.resolve();
    return leerConocer(id).then(
      (r) => {
        setC(r);
        setError(null);
        setVista((v) => v ?? vistaInicial(r));
      },
      (e: Error) => setError(e.message),
    );
  }, [usuario, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
      // Lo que escribe la otra persona no llega solo: se vuelve a pedir cada pocos segundos mientras se mira.
      const t = setInterval(() => reload(), 8000);
      return () => clearInterval(t);
    }, [reload]),
  );

  let contenido;
  if (ready && !usuario) contenido = <Welcome intro="Entra con tu cuenta para ver «Conocernos»." />;
  else if (!c)
    contenido = error ? (
      <Text style={[text.body, { color: colors.text, marginTop: 40 }]}>{error}</Text>
    ) : (
      <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
    );
  else {
    const nombre = c.otro.nombre.split(' ')[0];
    const actual: Vista = vista ?? vistaInicial(c);
    contenido = (
      <>
        <Appear style={styles.pair}>
          <View style={styles.avatars}>
            <Avatar name={usuario?.nombre ?? 'Tú'} foto={usuario?.foto} size={52} />
            <View style={[styles.avatarB, { borderColor: colors.background, backgroundColor: colors.background }]}>
              <Avatar name={c.otro.nombre} foto={c.otro.foto} size={52} />
            </View>
          </View>
          <Text style={[styles.kicker, { color: colors.warm, marginTop: 12 }]}>
            CONOCERNOS · {c.terminado ? 'CERRADO' : c.progreso.terminado ? 'SEMANA COMPLETA' : `DÍA ${c.progreso.dia} DE ${DIAS_CONOCER}`}
          </Text>
          <Text style={[styles.pairTitle, { color: colors.text }]}>Tú y {nombre}</Text>
          <Puntos hechos={c.dias.filter((d) => d.mia && d.suya).length} colors={colors} />
        </Appear>

        {c.terminado ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[text.body, { color: colors.text }]}>
              «Conocernos» terminó. Puedes releer lo que escribieron. Gracias por vivirlo con respeto.
            </Text>
          </View>
        ) : (
          <View style={{ marginBottom: 14 }}>
            <Chips
              options={[
                { value: 'dias' as Vista, label: 'Los siete días' },
                { value: 'charla' as Vista, label: c.mensajesNuevos ? `Conversación (${c.mensajesNuevos})` : 'Conversación' },
              ]}
              value={actual}
              onChange={setVista}
            />
          </View>
        )}

        {actual === 'charla' && !c.terminado ? (
          <Charla c={c} nombre={nombre} colors={colors} onDone={reload} />
        ) : (
          <Dias c={c} nombre={nombre} colors={colors} onDone={reload} onCharla={() => setVista('charla')} />
        )}

        {!c.terminado && <Cuidados c={c} nombre={nombre} colors={colors} onDone={reload} />}
      </>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Conocernos' }} />
      {contenido}
    </ScrollView>
  );
}

function Puntos({ hechos, colors }: { hechos: number; colors: Colors }) {
  return (
    <View style={styles.dots} accessibilityLabel={`${hechos} de ${DIAS_CONOCER} días hechos`}>
      {Array.from({ length: DIAS_CONOCER }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i < hechos ? colors.warm : colors.border }, i === DIAS_CONOCER - 1 && styles.dotLast]} />
      ))}
    </View>
  );
}

function Dias({ c, nombre, colors, onDone, onCharla }: { c: Conocer; nombre: string; colors: Colors; onDone: () => void; onCharla: () => void }) {
  const actual = c.progreso.dia;
  const pasados = c.dias.filter((d) => d.mia && d.suya && (c.progreso.terminado || d.dia !== actual)).reverse();
  return (
    <>
      {c.progreso.terminado && !c.terminado ? (
        <QueSigue c={c} nombre={nombre} colors={colors} onCharla={onCharla} />
      ) : (
        !c.terminado && <Hoy c={c} nombre={nombre} colors={colors} onDone={onDone} />
      )}
      {pasados.map((d) => {
        const contenido = CONOCERNOS[d.dia - 1];
        return (
          <View key={d.dia} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kicker, { color: colors.muted }]}>
              DÍA {d.dia} · {contenido.referencia.toUpperCase()}
            </Text>
            <Text style={[styles.cardTitle, { color: colors.text, marginTop: 4 }]}>{contenido.titulo}</Text>
            <Text style={[text.small, { color: colors.muted, marginTop: 6, fontStyle: 'italic' }]}>{contenido.pregunta}</Text>
            <Respuesta quien="Tú" texto={d.mia!} colors={colors} />
            <Respuesta quien={nombre} texto={d.suya!} colors={colors} warm />
          </View>
        );
      })}
    </>
  );
}

function Respuesta({ quien, texto, colors, warm }: { quien: string; texto: string; colors: Colors; warm?: boolean }) {
  return (
    <View style={[styles.respuesta, { borderColor: warm ? colors.warm : colors.border }]}>
      <Text style={[styles.kicker, { color: warm ? colors.warm : colors.muted }]}>{quien.toUpperCase()}</Text>
      <Text style={[styles.respuestaTexto, { color: colors.text }]}>{texto}</Text>
    </View>
  );
}

/** El día que toca: el pasaje, la pregunta y la respuesta de cada uno (la del otro se abre al responder los dos). */
function Hoy({ c, nombre, colors, onDone }: { c: Conocer; nombre: string; colors: Colors; onDone: () => void }) {
  const dia = c.progreso.dia;
  const contenido = CONOCERNOS[dia - 1];
  const r = c.dias[dia - 1];
  const [borrador, setBorrador] = useState(r.mia ?? '');
  const [editando, setEditando] = useState(!r.mia);
  const act = useAction();
  const ultimo = dia === DIAS_CONOCER;

  const guardar = async () => {
    if (await act.run(() => responderConocer(c.id, dia, borrador))) {
      setEditando(false);
      onDone();
    }
  };

  return (
    <View style={[styles.today, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.stripe, { backgroundColor: colors.warm }]} />
      <Text style={[styles.kicker, { color: colors.warm }]}>
        {c.progreso.abierto || r.mia ? 'HOY' : 'MAÑANA'} · DÍA {dia} DE {DIAS_CONOCER}
      </Text>
      <Text style={[styles.todayTitle, { color: colors.text }]}>{contenido.titulo}</Text>
      {!c.progreso.abierto && !r.mia ? (
        <Text style={[text.body, { color: colors.text, marginTop: 10 }]}>Hoy ya hicieron su día. El siguiente se abre mañana; mientras, pueden conversar.</Text>
      ) : (
        <>
          <TextoPasaje pasaje={contenido.pasaje} referencia={contenido.referencia} colors={colors} />
          {ultimo && (
            <View style={[styles.aviso, { backgroundColor: colors.warmSoft }]}>
              <PeopleIcon color={colors.warm} size={16} />
              <Text style={[text.small, { color: colors.text, flex: 1, lineHeight: 19 }]}>
                Hoy es para verse en persona: después del culto, en una actividad del círculo o con amigos. Respondan después.
              </Text>
            </View>
          )}
          <Text style={[styles.pregunta, { color: colors.text }]}>{contenido.pregunta}</Text>
          {editando ? (
            <>
              <Field value={borrador} onChangeText={setBorrador} multiline maxLength={1200} placeholder={`Escribe con calma. ${nombre} lo verá cuando también responda.`} style={{ marginTop: 10 }} />
              <View style={[styles.rowButtons, { marginTop: 10 }]}>
                <Button label="Guardar mi respuesta" onPress={guardar} busy={act.busy} disabled={!borrador.trim()} style={{ flex: 1 }} />
                {!!r.mia && <Button label="Cancelar" kind="outline" onPress={() => setEditando(false)} style={{ flex: 1 }} />}
              </View>
              <ErrorText>{act.error}</ErrorText>
            </>
          ) : (
            <>
              <Respuesta quien="Tú" texto={r.mia!} colors={colors} />
              {r.suya ? (
                <Respuesta quien={nombre} texto={r.suya} colors={colors} warm />
              ) : (
                <View style={[styles.aviso, { backgroundColor: colors.accentSoft }]}>
                  <LockIcon color={colors.accent} size={15} strokeWidth={2} />
                  <Text style={[text.small, { color: colors.text, flex: 1 }]}>Tu respuesta está guardada. Verás la de {nombre} cuando responda.</Text>
                </View>
              )}
              {!r.suya && <Button label="Cambiar mi respuesta" kind="quiet" onPress={() => setEditando(true)} style={{ alignSelf: 'flex-start', marginTop: 4 }} />}
            </>
          )}
          {r.suyaEspera && <Text style={[text.small, { color: colors.warm, marginTop: 10 }]}>{nombre} ya respondió. Responde para ver lo que escribió.</Text>}
          <View style={[styles.ora, { borderTopColor: colors.border }]}>
            <PrayIcon color={colors.muted} size={16} />
            <Text style={[text.small, { color: colors.muted, flex: 1, lineHeight: 19 }]}>{contenido.ora}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function TextoPasaje({ pasaje, referencia, colors }: { pasaje: Pasaje; referencia: string; colors: Colors }) {
  const [verses, setVerses] = useState<Verse[] | null>(null);
  useEffect(() => {
    getChapter(pasaje.book, pasaje.chapter).then(
      (all) => setVerses(all.filter(([v]) => v >= pasaje.from && v <= pasaje.to)),
      () => setVerses([]),
    );
  }, [pasaje.book, pasaje.chapter, pasaje.from, pasaje.to]);
  return (
    <View style={[styles.pasaje, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.muted, marginBottom: 8 }]}>{referencia.toUpperCase()} · RV1909</Text>
      {verses === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Text style={[styles.verseText, { color: colors.text }]}>
          {verses.map(([v, t]) => (
            <Text key={v}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{v} </Text>
              {t}{' '}
            </Text>
          ))}
        </Text>
      )}
    </View>
  );
}

/** Después de los siete días: decidir con libertad. */
function QueSigue({ c, nombre, colors, onCharla }: { c: Conocer; nombre: string; colors: Colors; onCharla: () => void }) {
  const act = useAction();
  const novios = async () => {
    if (await act.run(() => cambiarEtapa('relacion'))) go('/pareja');
  };
  const cerrar = async () => {
    if (await confirm('¿Cerrar «Conocernos»?', `Se le avisará a ${nombre} con delicadeza. Podrán seguir siendo hermanos en el círculo.`, 'Cerrar')) {
      await act.run(() => cerrarConocer(c.id));
      router.back();
    }
  };
  return (
    <View style={[styles.today, { backgroundColor: colors.warmSoft, borderColor: colors.warm }]}>
      <Text style={[styles.kicker, { color: colors.warm }]}>¡COMPLETARON LA SEMANA!</Text>
      <Text style={[styles.todayTitle, { color: colors.text }]}>¿Qué sigue?</Text>
      <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>
        Conversen con calma y oren. No hay prisa: pueden seguir conociéndose como amigos, dar el paso de ser novios o cerrar con gratitud.
      </Text>
      <View style={{ gap: 10, marginTop: 14 }}>
        <Button label="Somos novios: ir a «En pareja»" icon={HeartIcon} onPress={novios} busy={act.busy} />
        <Button label="Seguir conversando" icon={CommentIcon} kind="outline" onPress={onCharla} />
        <Button label="Cerrar con gratitud" kind="quiet" onPress={cerrar} />
      </View>
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

function Charla({ c, nombre, colors, onDone }: { c: Conocer; nombre: string; colors: Colors; onDone: () => void }) {
  const [texto, setTexto] = useState('');
  const [reportando, setReportando] = useState(false);
  const act = useAction();

  const enviar = async () => {
    if (await act.run(() => enviarMensaje(c.id, texto))) {
      setTexto('');
      onDone();
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 14 }]}>
      <View style={[styles.aviso, { backgroundColor: colors.accentSoft, marginTop: 0 }]}>
        <ShieldIcon color={colors.accent} size={16} />
        <Text style={[text.small, { color: colors.text, flex: 1, lineHeight: 19 }]}>
          Las primeras veces, véanse en la iglesia o en grupo. Nunca envíes dinero, fotos íntimas ni tu dirección.
        </Text>
      </View>
      <View style={{ gap: 8, marginTop: 14 }}>
        {!c.mensajes.length && (
          <Text style={[text.small, { color: colors.muted, textAlign: 'center', marginVertical: 18 }]}>
            Escríbele a {nombre}. Un buen comienzo: algo que te gustó de su respuesta.
          </Text>
        )}
        {c.mensajes.map((m) => (
          <View key={m.id} style={{ alignItems: m.mio ? 'flex-end' : 'flex-start' }}>
            <View style={[styles.burbuja, m.mio ? { backgroundColor: colors.accent } : { backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <Text style={{ color: m.mio ? colors.surface : colors.text, fontSize: 15, lineHeight: 21 }}>{m.texto}</Text>
            </View>
            {m.alerta && (
              <View style={[styles.alerta, { backgroundColor: colors.warmSoft, borderColor: colors.warm }]}>
                <FlagIcon color={colors.warm} size={14} />
                <Text style={[text.small, { color: colors.text, flex: 1, lineHeight: 18 }]}>
                  {m.alerta}. Ten cuidado: nunca envíes dinero ni fotos, y no pases a otra app tan pronto. Si te incomoda, repórtalo.
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
      <View style={[styles.composer, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Field value={texto} onChangeText={setTexto} multiline maxLength={1000} placeholder={`Mensaje para ${nombre}`} style={{ minHeight: 44 }} />
        </View>
        <Button label="Enviar" onPress={enviar} busy={act.busy} disabled={!texto.trim()} />
      </View>
      <ErrorText>{act.error}</ErrorText>
      {reportando ? (
        <Reportar usuario={c.otro.id} nombre={nombre} colors={colors} onDone={() => { setReportando(false); onDone(); }} />
      ) : (
        <Pressable onPress={() => setReportando(true)} accessibilityRole="button" hitSlop={6} style={styles.reportLink}>
          <FlagIcon color={colors.muted} size={14} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>Reportar o bloquear a {nombre}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Pedir acompañamiento, cerrar «Conocernos» y el recordatorio de cómo se cuida el círculo. */
function Cuidados({ c, nombre, colors, onDone }: { c: Conocer; nombre: string; colors: Colors; onDone: () => void }) {
  const act = useAction();
  const acompanar = async () => {
    if (await act.run(() => pedirAcompanamiento(c.id))) onDone();
  };
  const cerrar = async () => {
    if (await confirm('¿Cerrar «Conocernos»?', `Se le avisará a ${nombre} con delicadeza y la conversación terminará.`, 'Cerrar')) {
      if (await act.run(() => cerrarConocer(c.id))) router.back();
    }
  };
  return (
    <View style={[styles.ajustes, { borderTopColor: colors.border }]}>
      {c.acompanado ? (
        <View style={styles.row}>
          <CheckIcon color={colors.warm} size={16} strokeWidth={2.2} />
          <Text style={[text.small, { color: colors.text, flex: 1 }]}>Los líderes del círculo saben que quieren compañía. Les escribirán pronto.</Text>
        </View>
      ) : (
        <>
          <Text style={[text.small, { color: colors.muted, lineHeight: 19 }]}>
            ¿Les gustaría que un líder del círculo los acompañe, para verse en grupo o conversar? Solo se le avisa que se están conociendo; no ve sus mensajes.
          </Text>
          <Button label="Pedir que un líder nos acompañe" icon={ShieldIcon} kind="outline" onPress={acompanar} busy={act.busy} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </>
      )}
      <Button label="Cerrar «Conocernos»" kind="quiet" onPress={cerrar} style={{ alignSelf: 'flex-start', marginTop: 12 }} />
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 12, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  pair: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  avatars: { flexDirection: 'row' },
  avatarB: { marginLeft: -12, borderWidth: 3, borderRadius: 32 },
  pairTitle: { fontFamily: serif, fontSize: 28, marginTop: 2 },
  dots: { flexDirection: 'row', gap: 4, marginTop: 10 },
  dot: { width: 18, height: 4, borderRadius: 2 },
  dotLast: { width: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginBottom: 12 },
  cardTitle: { fontFamily: serif, fontSize: 20 },
  today: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 20, paddingLeft: 24, overflow: 'hidden', marginBottom: 14 },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  todayTitle: { fontFamily: serif, fontSize: 25, lineHeight: 31, marginTop: 6 },
  pasaje: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginTop: 14 },
  verseText: { fontFamily: serif, fontSize: 17, lineHeight: 27 },
  pregunta: { fontFamily: serif, fontSize: 19, lineHeight: 26, marginTop: 14, fontStyle: 'italic' },
  respuesta: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 12 },
  respuestaTexto: { fontFamily: serif, fontSize: 17, lineHeight: 25, marginTop: 4 },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, padding: 12, marginTop: 14 },
  rowButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  ora: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 16 },
  burbuja: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  alerta: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 6, maxWidth: '90%' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 14 },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  ajustes: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 20, paddingTop: 16 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
