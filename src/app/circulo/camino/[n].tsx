import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { AvisoCrisis, HablarConAlguien } from '@/components/circulo/Ayuda';
import TextoPasaje from '@/components/circulo/TextoPasaje';
import Welcome from '@/components/comunidad/Welcome';
import { Button, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { CheckIcon, LockIcon } from '@/components/icons';
import { CAMINO, ETAPAS_CAMINO, type ProgresoCamino, crisisEn, fechaCorta } from '@/lib/camino';
import { useCaminoDiario } from '@/lib/caminoDiario';
import { estadoCamino, terminarEtapa } from '@/lib/circuloApi';
import { useAccount } from '@/lib/comunidad';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Una etapa del camino: lectura, pasajes y preguntas que se responden a solas y se quedan en el teléfono. */
export default function EtapaScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const etapa = CAMINO.find((e) => String(e.n) === n);
  const colors = useColors();
  const { usuario, ready } = useAccount();
  const { diario, escribir } = useCaminoDiario(usuario?.id);
  const [estado, setEstado] = useState<{ fecha: string | null; progreso: ProgresoCamino } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = useAction();

  const reload = useCallback(() => {
    if (!usuario || !etapa) return;
    estadoCamino().then(
      (e) => setEstado({ fecha: e.hechas.find((h) => h.etapa === etapa.n)?.fecha ?? null, progreso: e.progreso }),
      (e: Error) => setError(e.message),
    );
  }, [usuario, etapa]);
  useEffect(() => {
    reload();
  }, [reload]);

  if (!etapa) return <Text style={[text.body, { color: colors.text, margin: 40 }]}>Esa etapa no existe.</Text>;

  const respuestas = diario?.[etapa.n] ?? [];
  const completas = etapa.preguntas.every((_, i) => (respuestas[i] ?? '').trim().length > 0);
  const terminar = () => act.run(() => terminarEtapa(etapa.n)).then((ok) => ok && reload());

  let pie;
  if (ready && !usuario) pie = <Welcome intro="Entra con tu cuenta para llevar tu avance." />;
  else if (!estado || !diario) pie = error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />;
  else if (estado.fecha) {
    const sigue = estado.progreso.siguiente;
    pie = (
      <View style={[styles.hecha, { backgroundColor: colors.accentSoft }]}>
        <View style={styles.fila}>
          <View style={[styles.check, { backgroundColor: colors.accent }]}>
            <CheckIcon color={colors.surface} size={15} strokeWidth={2.6} />
          </View>
          <Text style={[styles.hechaTitulo, { color: colors.text }]}>Terminaste esta etapa el {fechaCorta(estado.fecha)}</Text>
        </View>
        <Text style={[text.body, { color: colors.text, marginTop: 8 }]}>
          {estado.progreso.completo
            ? 'Terminaste el camino. Puedes volver a tus respuestas cuando quieras: siguen aquí, solo para ti.'
            : sigue && !estado.progreso.abierta
              ? `La etapa ${sigue} se abre el ${fechaCorta(estado.progreso.abreEl!)}. Mientras tanto, vuelve a leer y ora con lo que escribiste.`
              : `La etapa ${sigue} ya te espera.`}
        </Text>
        <Button
          label={estado.progreso.completo ? 'Volver al camino' : sigue && estado.progreso.abierta ? `Ir a la etapa ${sigue}` : 'Volver al camino'}
          kind="outline"
          onPress={() =>
            navigate(
              () => (sigue && estado.progreso.abierta ? router.replace(`/circulo/camino/${sigue}` as never) : router.back()),
              'forward',
            )
          }
          style={{ marginTop: 12, alignSelf: 'flex-start' }}
        />
      </View>
    );
  } else if (estado.progreso.siguiente !== etapa.n || !estado.progreso.abierta) {
    pie = (
      <View style={[styles.hecha, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
        <View style={styles.fila}>
          <LockIcon color={colors.muted} size={16} />
          <Text style={[text.body, { color: colors.text, flex: 1 }]}>
            {estado.progreso.siguiente === etapa.n && estado.progreso.abreEl
              ? `Podrás terminar esta etapa desde el ${fechaCorta(estado.progreso.abreEl)}. Puedes ir leyendo y escribiendo.`
              : 'Primero termina las etapas anteriores.'}
          </Text>
        </View>
      </View>
    );
  } else {
    pie = (
      <View style={{ marginTop: 20 }}>
        <Button label="Terminé esta etapa" icon={CheckIcon} onPress={terminar} busy={act.busy} disabled={!completas} />
        <Text style={[text.small, { color: colors.muted, marginTop: 8, textAlign: 'center' }]}>
          {completas ? 'Solo se guarda que la terminaste, no lo que escribiste.' : `Responde las ${etapa.preguntas.length} preguntas para terminarla.`}
        </Text>
        <ErrorText>{act.error}</ErrorText>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Etapa ${etapa.n}` }} />
      <Appear>
        <Text style={[styles.kicker, { color: colors.warm }]}>
          ETAPA {etapa.n} DE {ETAPAS_CAMINO}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{etapa.titulo}</Text>
        <Text style={[styles.lema, { color: colors.muted }]}>{etapa.lema}</Text>
        {etapa.intro.map((p) => (
          <Text key={p} style={[styles.intro, { color: colors.text }]}>
            {p}
          </Text>
        ))}
      </Appear>

      <Appear delay={60}>
        <View style={{ gap: 12, marginTop: 20 }}>
          {etapa.pasajes.map((x) => (
            <View key={x.referencia} style={[styles.pasaje, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.stripe, { backgroundColor: colors.warm }]} />
              <Text style={[styles.kicker, { color: colors.warm }]}>{x.referencia.toUpperCase()}</Text>
              <TextoPasaje pasaje={x.pasaje} colors={colors} />
            </View>
          ))}
        </View>
      </Appear>

      <Appear delay={100}>
        <View style={[styles.privado, { borderTopColor: colors.border }]}>
          <Text style={[styles.kicker, { color: colors.muted }]}>PARA RESPONDER A SOLAS</Text>
          <View style={[styles.fila, { marginTop: 6 }]}>
            <LockIcon color={colors.muted} size={13} />
            <Text style={[text.small, { color: colors.muted, flex: 1 }]}>Se guarda solo en este teléfono, mientras escribes.</Text>
          </View>
        </View>
        <View style={{ gap: 18, marginTop: 14 }}>
          {etapa.preguntas.map((q, i) => {
            const valor = respuestas[i] ?? '';
            const crisis = crisisEn(valor);
            return (
              <View key={q}>
                <Text style={[styles.pregunta, { color: colors.text }]}>
                  <Text style={{ color: colors.warm }}>{i + 1}. </Text>
                  {q}
                </Text>
                <Field
                  value={valor}
                  onChangeText={(t) => escribir(etapa.n, i, t)}
                  multiline
                  maxLength={3000}
                  editable={!!diario}
                  placeholder="Escribe con honestidad. Nadie más lo leerá."
                  accessibilityLabel={`Pregunta ${i + 1}`}
                  style={{ marginTop: 8, minHeight: 96 }}
                />
                {crisis && <AvisoCrisis tipo={crisis} colors={colors} />}
              </View>
            );
          })}
        </View>
        {etapa.ayuda && <HablarConAlguien colors={colors} />}
      </Appear>

      {pie}
    </ScrollView>
  );
}

const shadow = (colors: Colors) => (isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' });

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 16, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 36, marginTop: 6 },
  lema: { fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 24, marginTop: 6 },
  intro: { fontSize: 16, lineHeight: 25, marginTop: 14 },
  pasaje: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, paddingLeft: 22, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  privado: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 26, paddingTop: 18 },
  pregunta: { fontFamily: serif, fontSize: 18, lineHeight: 25 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hecha: { borderRadius: 16, padding: 16, marginTop: 24 },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  hechaTitulo: { fontFamily: serif, fontSize: 18, flex: 1 },
});
