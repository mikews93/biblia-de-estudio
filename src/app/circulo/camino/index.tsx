import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { Button, Card, Meter, text } from '@/components/comunidad/ui';
import { CheckIcon, ChevronRightIcon, LockIcon, PeopleIcon, RouteIcon } from '@/components/icons';
import { CAMINO, ETAPAS_CAMINO, type ProgresoCamino, fechaCorta } from '@/lib/camino';
import { estadoCamino } from '@/lib/circuloApi';
import { useAccount } from '@/lib/comunidad';
import { Colors, isDark, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const go = (href: string) => navigate(() => router.push(href as never), 'forward');

type Estado = Awaited<ReturnType<typeof estadoCamino>>;

/** El camino de preparación: siete etapas antes de buscar pareja, que sirven aunque nunca se busque. */
export default function CaminoScreen() {
  const colors = useColors();
  const { usuario, ready } = useAccount();
  const { modo } = useSettings().settings;
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;
      estadoCamino().then(
        (e) => {
          setEstado(e);
          setError(null);
        },
        (e: Error) => setError(e.message),
      );
    }, [usuario]),
  );

  let contenido;
  if (modo === 'jovenes') contenido = null;
  else if (ready && !usuario) contenido = <Welcome intro="Para llevar tu avance en el camino necesitas una cuenta gratuita. Lo que escribes se queda en tu teléfono." />;
  else if (!estado)
    contenido = error ? (
      <Text style={[text.body, { color: colors.text, marginTop: 40 }]}>{error}</Text>
    ) : (
      <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
    );
  else contenido = <Etapas estado={estado} colors={colors} />;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Camino de preparación' }} />
      <Appear>
        <View style={[styles.hero, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
            <RouteIcon color={colors.accent} size={24} />
          </View>
          <Text style={[styles.kicker, { color: colors.warm, marginTop: 14 }]}>CAMINO DE PREPARACIÓN</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Primero el para qué, después el con quién</Text>
          <Text style={[styles.verse, { color: colors.muted }]}>
            «Buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.» Mateo 6:33
          </Text>
          <Text style={[text.body, { color: colors.text, marginTop: 14 }]}>
            Siete etapas para conocerte, sanar y tener claro tu llamado antes de buscar pareja. Sirven aunque nunca la busques.
          </Text>
          <View style={[styles.privado, { backgroundColor: colors.accentSoft }]}>
            <LockIcon color={colors.accent} size={15} strokeWidth={2} />
            <Text style={[text.small, { color: colors.text, flex: 1, lineHeight: 19 }]}>
              Lo que escribes se queda en este teléfono. Nadie lo lee: ni tu iglesia, ni los líderes, ni Zarza.
            </Text>
          </View>
        </View>
      </Appear>
      {contenido}
    </ScrollView>
  );
}

function Etapas({ estado, colors }: { estado: Estado; colors: Colors }) {
  const prog = estado.progreso;
  const hechas = new Map(estado.hechas.map((h) => [h.etapa, h.fecha]));
  return (
    <>
      <Appear delay={60}>
        <View style={styles.avance}>
          <Text style={[styles.kicker, { color: colors.muted }]}>
            {prog.completo ? 'CAMINO TERMINADO' : `${prog.hechas} DE ${ETAPAS_CAMINO} ETAPAS`}
          </Text>
          <View style={{ marginTop: 8 }}>
            <Meter value={prog.hechas} max={ETAPAS_CAMINO} colors={colors} />
          </View>
        </View>
      </Appear>
      <View style={{ gap: 10 }}>
        {CAMINO.map((e, i) => (
          <Appear key={e.n} delay={80 + i * 30}>
            <FilaEtapa n={e.n} titulo={e.titulo} lema={e.lema} fecha={hechas.get(e.n) ?? null} prog={prog} colors={colors} />
          </Appear>
        ))}
      </View>
      <Appear delay={320}>
        <Card style={{ marginTop: 18 }}>
          <View style={styles.cierre}>
            <View style={[styles.num, { borderColor: colors.border }]}>
              <PeopleIcon color={colors.muted} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Discernir en comunidad</Text>
              <Text style={[text.small, { color: colors.muted, marginTop: 4, lineHeight: 19 }]}>
                Con el camino terminado puedes usar «Me gustaría conocerte» en el Círculo de solteros de tu iglesia, acompañado por
                sus líderes.
              </Text>
            </View>
          </View>
          <Button label="Ir al Círculo de solteros" kind={prog.completo ? 'primary' : 'outline'} onPress={() => go('/circulo')} style={{ marginTop: 14 }} />
        </Card>
      </Appear>
    </>
  );
}

function FilaEtapa({
  n,
  titulo,
  lema,
  fecha,
  prog,
  colors,
}: {
  n: number;
  titulo: string;
  lema: string;
  fecha: string | null;
  prog: ProgresoCamino;
  colors: Colors;
}) {
  const actual = prog.siguiente === n;
  const abierta = !!fecha || (actual && prog.abierta);
  const estado = fecha
    ? `Terminada el ${fechaCorta(fecha)}`
    : actual
      ? prog.abierta
        ? 'Te espera hoy'
        : `Se abre el ${fechaCorta(prog.abreEl!)}`
      : 'Después de la anterior';
  return (
    <Pressable
      onPress={() => go(`/circulo/camino/${n}`)}
      disabled={!abierta}
      accessibilityRole="link"
      aria-disabled={!abierta}
      style={({ pressed }) => [
        styles.fila,
        actual && abierta && shadow(colors),
        { backgroundColor: colors.surface, borderColor: actual && abierta ? colors.warm : colors.border },
        !abierta && !actual && { opacity: 0.6 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.num,
          fecha ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: actual ? colors.warm : colors.border },
        ]}
      >
        {fecha ? (
          <CheckIcon color={colors.surface} size={16} strokeWidth={2.6} />
        ) : abierta || actual ? (
          <Text style={{ color: actual ? colors.warm : colors.muted, fontFamily: serif, fontSize: 17 }}>{n}</Text>
        ) : (
          <LockIcon color={colors.muted} size={14} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{titulo}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{lema}</Text>
        <Text style={{ color: actual && abierta ? colors.warm : colors.muted, fontSize: 12, fontWeight: '600', marginTop: 6 }}>{estado}</Text>
      </View>
      {abierta && <ChevronRightIcon color={colors.muted} size={20} />}
    </Pressable>
  );
}

const shadow = (colors: Colors) => (isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' });

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 12, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22, marginBottom: 18 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  heroTitle: { fontFamily: serif, fontSize: 28, lineHeight: 34, marginTop: 6 },
  verse: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, lineHeight: 22, marginTop: 8 },
  privado: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: 12, marginTop: 16 },
  avance: { marginBottom: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  num: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: serif, fontSize: 19 },
  cierre: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
});
