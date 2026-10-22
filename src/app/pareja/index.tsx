import * as Clipboard from 'expo-clipboard';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, LockIcon, PrayIcon } from '@/components/icons';
import Trenza from '@/components/pareja/Trenza';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Avatar, Button, Card, Chips, Field, SectionTitle, text } from '@/components/comunidad/ui';
import { useAccount } from '@/lib/comunidad';
import { DIAS_SEMANA } from '@/lib/pareja';
import {
  type Pareja,
  cambiarEtapa,
  elegirPlan,
  enlacePareja,
  guardarPedido,
  invitar,
  ore,
  salir,
  unirse,
  usePareja,
} from '@/lib/parejaApi';
import { DIAS_PLAN, type Etapa, type PlanPareja, planPareja, planesPara } from '@/lib/parejaPlanes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const ETAPAS: { value: Etapa; label: string }[] = [
  { value: 'novios', label: 'Somos novios' },
  { value: 'casados', label: 'Estamos casados' },
];

const go = (href: string) => navigate(() => router.push(href as never), 'forward');

/** «En pareja»: dos cuentas unidas que hacen juntas una semana de devocionales cortos. */
export default function ParejaScreen() {
  const colors = useColors();
  const { pareja, cuenta, listo, error, reload } = usePareja();

  // Lo que hizo el otro no llega solo: se pide de nuevo al volver a esta pantalla.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  let contenido;
  if (listo && !cuenta) {
    contenido = (
      <>
        <Portada colors={colors} />
        <Welcome intro="Para unirte a tu pareja, cada uno necesita una cuenta gratuita. Lo que escriban queda solo entre los dos." />
      </>
    );
  } else if (pareja === undefined) {
    contenido = error ? (
      <Text style={[text.body, { color: colors.text, marginTop: 40 }]}>{error}</Text>
    ) : (
      <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
    );
  } else if (!pareja) {
    contenido = <SinPareja colors={colors} />;
  } else if (!pareja.otro) {
    contenido = <Esperando pareja={pareja} colors={colors} />;
  } else {
    contenido = <Juntos pareja={pareja} colors={colors} />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'En pareja' }} />
      {contenido}
      <Ayuda colors={colors} />
    </ScrollView>
  );
}

/** La presentación antes de unirse: qué es y cómo funciona. */
function Portada({ colors }: { colors: Colors }) {
  const puntos = [
    { icon: LockIcon, texto: 'Cada uno responde a solas. Lo que escribió el otro se abre cuando los dos respondieron.' },
    { icon: PrayIcon, texto: 'Cinco minutos al día: un pasaje, una pregunta y una oración del uno por el otro.' },
    { icon: CheckIcon, texto: 'Una semana por plan, con un encuentro de veinte minutos para conversar en persona.' },
  ];
  return (
    <Appear>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Trenza colors={colors} hechos={[]} decorativa alto={56} />
        <Text style={[styles.kicker, { color: colors.warm, marginTop: 14 }]}>DEVOCIONALES EN PAREJA</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Un rato con Dios, los dos</Text>
        <Text style={[styles.verse, { color: colors.muted }]}>«Cordón de tres dobleces no presto se rompe.» Eclesiastés 4:12</Text>
        <View style={{ gap: 12, marginTop: 18 }}>
          {puntos.map(({ icon: Icon, texto }) => (
            <View key={texto} style={styles.punto}>
              <View style={[styles.puntoIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon color={colors.accent} size={16} strokeWidth={2} />
              </View>
              <Text style={[text.body, { color: colors.text, flex: 1 }]}>{texto}</Text>
            </View>
          ))}
        </View>
      </View>
    </Appear>
  );
}

function SinPareja({ colors }: { colors: Colors }) {
  const [etapa, setEtapa] = useState<Etapa>('casados');
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState<'invitar' | 'unirse' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (que: 'invitar' | 'unirse') => {
    setBusy(que);
    setError(null);
    try {
      if (que === 'invitar') await invitar(etapa);
      else await unirse(codigo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Portada colors={colors} />
      <Appear delay={80}>
        <Card style={{ marginTop: 16 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Invita a tu pareja</Text>
          <Text style={[text.small, { color: colors.muted, marginTop: 4, marginBottom: 14 }]}>
            Los planes cambian según la etapa. Podrán cambiarla después.
          </Text>
          <Chips options={ETAPAS} value={etapa} onChange={setEtapa} />
          <Button label="Crear invitación" onPress={() => run('invitar')} busy={busy === 'invitar'} style={{ marginTop: 16 }} />
        </Card>
      </Appear>
      <Appear delay={140}>
        <Card style={{ marginTop: 12 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>¿Tu pareja ya te invitó?</Text>
          <Text style={[text.small, { color: colors.muted, marginTop: 4, marginBottom: 12 }]}>Escribe el código de seis letras que te mandó.</Text>
          <Field
            value={codigo}
            onChangeText={(t) => setCodigo(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABC234"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{ letterSpacing: 4, fontSize: 18, textAlign: 'center' }}
          />
          <Button label="Unirme" kind="outline" onPress={() => run('unirse')} busy={busy === 'unirse'} disabled={codigo.length < 6} style={{ marginTop: 12 }} />
        </Card>
      </Appear>
      {error && <Text style={[text.small, { color: colors.warm, marginTop: 12 }]}>{error}</Text>}
    </>
  );
}

function Esperando({ pareja, colors }: { pareja: Pareja; colors: Colors }) {
  const { usuario } = useAccount();
  const [copied, setCopied] = useState(false);
  const url = enlacePareja(pareja.codigo!);
  const message = `${usuario?.nombre ?? 'Tu pareja'} te invita a hacer devocionales en pareja en Zarza. Acepta aquí: ${url}`;
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);

  const copy = async () => {
    await Clipboard.setStringAsync(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const cancelar = async () => {
    if (await confirm('¿Cancelar la invitación?', 'El código dejará de funcionar. Podrás crear otro cuando quieras.', 'Cancelar invitación')) {
      await salir().catch(() => {});
    }
  };

  return (
    <>
      <Portada colors={colors} />
      <Appear delay={80}>
        <Card style={{ marginTop: 16, borderColor: colors.accent, borderWidth: 1.5 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Tu invitación está lista</Text>
          <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>
            Mándasela a tu pareja. Cuando la acepte, empiezan juntos «{planPareja(pareja.plan)?.titulo}».
          </Text>
          <Text style={[styles.code, { color: colors.accent }]} selectable>
            {pareja.codigo}
          </Text>
          <View style={styles.row}>
            <Button label={copied ? 'Enlace copiado' : 'Copiar enlace'} kind="outline" onPress={copy} style={{ flex: 1 }} />
            {canShare && <Button label="Compartir" onPress={() => Share.share({ message, url }).catch(() => {})} style={{ flex: 1 }} />}
          </View>
        </Card>
      </Appear>
      <Button label="Cancelar invitación" kind="quiet" onPress={cancelar} style={{ marginTop: 12, alignSelf: 'center' }} />
    </>
  );
}

function Juntos({ pareja, colors }: { pareja: Pareja; colors: Colors }) {
  const { usuario } = useAccount();
  const otro = pareja.otro!;
  const nombre = otro.nombre.split(' ')[0];
  const plan = planPareja(pareja.plan) ?? planesPara(pareja.etapa)[0];
  const prog = pareja.progreso!;
  const hechos = Object.keys(pareja.hechos ?? {}).map(Number);
  const c = pareja.cordon!;

  return (
    <>
      {/* Los dos, unidos por el cordón */}
      <Appear style={styles.pair}>
        <View style={styles.avatars}>
          <Avatar name={usuario?.nombre ?? 'Tú'} foto={usuario?.foto} size={52} />
          <View style={[styles.avatarB, { borderColor: colors.background, backgroundColor: colors.background }]}>
            <Avatar name={otro.nombre} foto={otro.foto} size={52} />
          </View>
        </View>
        <Text style={[styles.kicker, { color: colors.muted, marginTop: 12 }]}>{pareja.etapa === 'novios' ? 'NOVIOS' : 'MATRIMONIO'}</Text>
        <Text style={[styles.pairTitle, { color: colors.text }]}>Tú y {nombre}</Text>
      </Appear>

      <Appear delay={60}>
        <Hoy pareja={pareja} plan={plan} nombre={nombre} colors={colors} />
      </Appear>

      {/* La semana como un cordón: lo que hicieron juntos, nunca quién va adelante */}
      <Appear delay={110}>
        <Card style={{ marginTop: 14 }}>
          <View style={styles.cordonHead}>
            <Text style={[styles.kicker, { color: colors.muted }]}>SU CORDÓN</Text>
            <Text style={[text.small, { color: colors.muted }]}>
              {hechos.length} de {DIAS_PLAN} días
            </Text>
          </View>
          <Trenza colors={colors} hechos={hechos} hoy={prog.terminado ? undefined : prog.dia} />
          <View style={[styles.stats, { borderTopColor: colors.border }]}>
            <Stat valor={c.nudos} etiqueta={c.nudos === 1 ? 'día juntos' : 'días juntos'} colors={colors} />
            <Stat valor={c.semanas} etiqueta={c.semanas === 1 ? 'semana seguida' : 'semanas seguidas'} colors={colors} />
            <Stat valor={`${Math.min(c.estaSemana, DIAS_SEMANA)}/${DIAS_SEMANA}`} etiqueta="esta semana" colors={colors} />
          </View>
          <Text style={[text.small, { color: colors.muted, marginTop: 10, lineHeight: 19 }]}>
            {c.estaSemana >= DIAS_SEMANA
              ? 'Esta semana ya cuenta. Lo demás es regalo.'
              : c.gracia
                ? 'Una semana floja no rompe el cordón: la racha sigue.'
                : `Una semana cuenta con ${DIAS_SEMANA} días respondidos por los dos.`}
          </Text>
          {!!pareja.adivinanzas?.marcadas && (
            <View style={[styles.conocen, { borderTopColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.warm }]}>SE CONOCEN</Text>
              <Text style={[text.small, { color: colors.text, flex: 1, textAlign: 'right' }]}>
                {pareja.adivinanzas.aciertos} {pareja.adivinanzas.aciertos === 1 ? 'acierto' : 'aciertos'} de {pareja.adivinanzas.marcadas}{' '}
                {pareja.adivinanzas.marcadas === 1 ? 'adivinanza' : 'adivinanzas'}
              </Text>
            </View>
          )}
        </Card>
      </Appear>

      <Appear delay={150}>
        <Oracion pareja={pareja} nombre={nombre} colors={colors} />
      </Appear>

      <SectionTitle>Planes</SectionTitle>
      <View style={{ gap: 10 }}>
        {planesPara(pareja.etapa).map((p) => (
          <PlanItem key={p.id} plan={p} actual={p.id === plan.id} hechos={pareja.planes?.[p.id] ?? 0} colors={colors} />
        ))}
      </View>

      {!!plan.profundizar?.length && (
        <>
          <SectionTitle>Para profundizar</SectionTitle>
          {plan.profundizar.map((l) => (
            <View key={l.titulo} style={[styles.libro, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17 }}>
                {l.titulo} <Text style={{ color: colors.muted, fontSize: 14 }}>· {l.autor}</Text>
              </Text>
              <Text style={[text.small, { color: colors.muted, marginTop: 4, lineHeight: 19 }]}>{l.nota}</Text>
            </View>
          ))}
        </>
      )}

      <Ajustes pareja={pareja} nombre={nombre} colors={colors} />
    </>
  );
}

/** El día que toca: empezar, esperar a mañana o elegir otro plan. */
function Hoy({ pareja, plan, nombre, colors }: { pareja: Pareja; plan: PlanPareja; nombre: string; colors: Colors }) {
  const prog = pareja.progreso!;
  if (prog.terminado) {
    const siguiente = planesPara(pareja.etapa).find((p) => (pareja.planes?.[p.id] ?? 0) < DIAS_PLAN);
    return (
      <View style={[styles.today, { backgroundColor: colors.warmSoft, borderColor: colors.warm }]}>
        <Text style={[styles.kicker, { color: colors.warm }]}>¡TERMINARON EL PLAN!</Text>
        <Text style={[styles.todayTitle, { color: colors.text }]}>{plan.titulo}</Text>
        <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>
          Siete días de la mano. {siguiente ? `¿Siguen con «${siguiente.titulo}»?` : 'Pueden repasar lo que escribieron cuando quieran.'}
        </Text>
        {siguiente && <Button label={`Empezar «${siguiente.titulo}»`} onPress={() => elegirPlan(siguiente.id).catch(() => {})} style={{ marginTop: 14 }} />}
      </View>
    );
  }
  const encuentro = prog.dia === DIAS_PLAN;
  const dia = encuentro ? plan.encuentro : plan.dias[prog.dia - 1];
  const respondi = pareja.respondi?.includes(prog.dia);
  const respondio = pareja.respondio?.includes(prog.dia);
  const href = `/pareja/${plan.id}/${prog.dia}`;
  return (
    <Pressable
      onPress={() => go(href)}
      disabled={!prog.abierto && !respondi}
      accessibilityRole="button"
      style={({ pressed }) => [styles.today, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.9 }]}
    >
      <View style={[styles.stripe, { backgroundColor: colors.warm }]} />
      <Text style={[styles.kicker, { color: colors.warm }]}>
        {prog.abierto ? 'HOY' : 'MAÑANA'} · {encuentro ? 'ENCUENTRO DE LA SEMANA' : `DÍA ${prog.dia} DE ${DIAS_PLAN}`}
      </Text>
      <Text style={[styles.todayTitle, { color: colors.text }]}>{dia.titulo}</Text>
      <Text style={[text.small, { color: colors.muted, marginTop: 2 }]}>
        {dia.referencia} · {encuentro ? `${plan.encuentro.minutos} minutos juntos` : '5 minutos'} · {plan.titulo}
      </Text>
      {!prog.abierto ? (
        <Text style={[text.body, { color: colors.text, marginTop: 12 }]}>Hoy ya hicieron su día. El siguiente se abre mañana.</Text>
      ) : respondi && respondio ? null : respondi ? (
        <View style={[styles.estado, { backgroundColor: colors.accentSoft }]}>
          <LockIcon color={colors.accent} size={15} strokeWidth={2} />
          <Text style={[text.small, { color: colors.text, flex: 1 }]}>Tu respuesta está guardada. Verás la de {nombre} cuando responda.</Text>
        </View>
      ) : (
        <Button label={encuentro ? 'Ver el encuentro' : 'Empezar'} onPress={() => go(href)} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
      )}
      {respondio && !respondi && prog.abierto && (
        <Text style={[text.small, { color: colors.warm, marginTop: 10 }]}>{nombre} ya respondió. Responde para ver lo que escribió.</Text>
      )}
    </Pressable>
  );
}

function Stat({ valor, etiqueta, colors }: { valor: number | string; etiqueta: string; colors: Colors }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontFamily: serif, fontSize: 24 }}>{valor}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>{etiqueta}</Text>
    </View>
  );
}

/** Orar el uno por el otro: el pedido de cada uno y «oré por ti», una vez al día. */
function Oracion({ pareja, nombre, colors }: { pareja: Pareja; nombre: string; colors: Colors }) {
  const pedidos = pareja.pedidos ?? { mio: null, suyo: null };
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(pedidos.mio ?? '');
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    setBusy(true);
    await guardarPedido(borrador).catch(() => {});
    setBusy(false);
    setEditando(false);
  };

  return (
    <Card style={{ marginTop: 14 }}>
      <View style={styles.cordonHead}>
        <Text style={[styles.kicker, { color: colors.muted }]}>OREN EL UNO POR EL OTRO</Text>
        {pareja.oroHoy && (
          <View style={[styles.badge, { backgroundColor: colors.warmSoft }]}>
            <PrayIcon color={colors.warm} size={13} strokeWidth={2} />
            <Text style={{ color: colors.warm, fontSize: 12, fontWeight: '700' }}>{nombre} oró por ti hoy</Text>
          </View>
        )}
      </View>

      <Text style={[text.small, { color: colors.muted, marginTop: 12 }]}>Lo que {nombre} te pide</Text>
      <Text style={[styles.pedido, { color: pedidos.suyo ? colors.text : colors.muted }]}>
        {pedidos.suyo ? `«${pedidos.suyo}»` : 'Todavía no dejó un pedido. Puedes orar por su día.'}
      </Text>
      <Button
        label={pareja.oreHoy ? `Oraste hoy por ${nombre}` : `Oré por ${nombre}`}
        icon={pareja.oreHoy ? CheckIcon : PrayIcon}
        kind={pareja.oreHoy ? 'outline' : 'primary'}
        disabled={pareja.oreHoy}
        onPress={() => ore().catch(() => {})}
        style={{ marginTop: 12, alignSelf: 'flex-start' }}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[text.small, { color: colors.muted }]}>Tu pedido para {nombre}</Text>
      {editando ? (
        <>
          <Field value={borrador} onChangeText={setBorrador} multiline maxLength={300} placeholder="¿Por qué te gustaría que ore esta semana?" style={{ marginTop: 8 }} />
          <View style={[styles.row, { marginTop: 10 }]}>
            <Button label="Guardar" onPress={guardar} busy={busy} style={{ flex: 1 }} />
            <Button label="Cancelar" kind="outline" onPress={() => setEditando(false)} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <Pressable onPress={() => { setBorrador(pedidos.mio ?? ''); setEditando(true); }} accessibilityRole="button">
          <Text style={[styles.pedido, { color: pedidos.mio ? colors.text : colors.accent }]}>
            {pedidos.mio ? `«${pedidos.mio}»` : '+ Deja un pedido de oración'}
          </Text>
          {!!pedidos.mio && <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 4 }}>Cambiar</Text>}
        </Pressable>
      )}
    </Card>
  );
}

function PlanItem({ plan, actual, hechos, colors }: { plan: PlanPareja; actual: boolean; hechos: number; colors: Colors }) {
  const elegir = async () => {
    if (actual) return;
    const ok = await confirm(`¿Cambiar a «${plan.titulo}»?`, 'Lo que llevan del plan actual se guarda: pueden volver cuando quieran.', 'Cambiar');
    if (ok) elegirPlan(plan.id).catch(() => {});
  };
  return (
    <Pressable
      onPress={elegir}
      accessibilityRole="button"
      accessibilityState={{ selected: actual }}
      style={({ pressed }) => [
        styles.plan,
        { backgroundColor: colors.surface, borderColor: actual ? colors.accent : colors.border },
        actual && { borderWidth: 1.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontFamily: serif, fontSize: 18 }}>{plan.titulo}</Text>
        <Text style={[text.small, { color: colors.muted, marginTop: 3, lineHeight: 18 }]}>{plan.subtitulo}</Text>
        <View style={styles.planDots}>
          {Array.from({ length: DIAS_PLAN }, (_, i) => (
            <View key={i} style={[styles.planDot, { backgroundColor: i < hechos ? colors.accent : colors.border }]} />
          ))}
        </View>
      </View>
      <Text style={{ color: actual ? colors.accent : colors.muted, fontSize: 12, fontWeight: '700' }}>
        {actual ? 'ACTUAL' : hechos >= DIAS_PLAN ? 'HECHO' : hechos ? `${hechos}/${DIAS_PLAN}` : ''}
      </Text>
    </Pressable>
  );
}

function Ajustes({ pareja, nombre, colors }: { pareja: Pareja; nombre: string; colors: Colors }) {
  const desvincular = async () => {
    const ok = await confirm(
      `¿Desvincularte de ${nombre}?`,
      'Se borra todo lo que compartían: respuestas, pedidos y su cordón. No se puede deshacer.',
      'Desvincular',
    );
    if (ok) salir().catch(() => {});
  };
  const otraEtapa: Etapa = pareja.etapa === 'novios' ? 'casados' : 'novios';
  return (
    <View style={[styles.ajustes, { borderTopColor: colors.border }]}>
      <Text style={[text.small, { color: colors.muted, lineHeight: 19 }]}>
        Lo que escriben aquí solo lo ven ustedes dos. Estos devocionales no reemplazan la consejería pastoral o profesional.
      </Text>
      <View style={[styles.row, { marginTop: 10, flexWrap: 'wrap' }]}>
        <Button
          label={otraEtapa === 'casados' ? '¡Nos casamos!' : 'Cambiar a novios'}
          kind="quiet"
          onPress={() => cambiarEtapa(otraEtapa).catch(() => {})}
        />
        <Button label="Desvincular" kind="quiet" onPress={desvincular} />
      </View>
    </View>
  );
}

/** El enlace discreto a la ayuda: siempre al final, también antes de unirse. */
function Ayuda({ colors }: { colors: Colors }) {
  return (
    <Pressable onPress={() => go('/pareja/ayuda')} accessibilityRole="link" style={styles.ayuda} hitSlop={8}>
      <Text style={{ color: colors.muted, fontSize: 13, textDecorationLine: 'underline' }}>¿Te sientes inseguro o insegura en tu relación?</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 12, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  heroTitle: { fontFamily: serif, fontSize: 30, lineHeight: 36, marginTop: 6 },
  verse: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, lineHeight: 22, marginTop: 8 },
  punto: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  puntoIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: serif, fontSize: 20 },
  code: { fontSize: 30, fontWeight: '700', letterSpacing: 8, textAlign: 'center', marginVertical: 18, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: 10 },
  pair: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  avatars: { flexDirection: 'row' },
  avatarB: { marginLeft: -12, borderWidth: 3, borderRadius: 32 },
  pairTitle: { fontFamily: serif, fontSize: 28, marginTop: 2 },
  today: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 20, paddingLeft: 24, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  todayTitle: { fontFamily: serif, fontSize: 25, lineHeight: 31, marginTop: 6 },
  estado: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 12, padding: 12, marginTop: 14 },
  cordonHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 6 },
  conocen: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  pedido: { fontFamily: serif, fontSize: 17, lineHeight: 25, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16 },
  planDots: { flexDirection: 'row', gap: 4, marginTop: 10 },
  planDot: { width: 14, height: 4, borderRadius: 2 },
  libro: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 12 },
  ajustes: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 28, paddingTop: 16 },
  ayuda: { alignSelf: 'center', marginTop: 28, paddingVertical: 6 },
});
