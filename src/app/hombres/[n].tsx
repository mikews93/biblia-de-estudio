import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { AvisoCrisis } from '@/components/circulo/Ayuda';
import TextoPasaje from '@/components/circulo/TextoPasaje';
import { Button, Field, text } from '@/components/comunidad/ui';
import { CheckIcon, LockIcon, PeopleIcon, StarIcon } from '@/components/icons';
import { crisisEn, fechaCorta } from '@/lib/camino';
import { HOMBRES, SEMANAS_HOMBRES, invitacionHombres, progresoHombres } from '@/lib/hombres';
import { useHombresDiario } from '@/lib/hombresDiario';
import { todayKey } from '@/lib/temporadas';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const URL = 'https://zarzabiblia.com/hombres';

/** Una semana de «Hombres de pie»: lectura, pasajes, preguntas a solas y el reto de la semana. */
export default function SemanaHombresScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const semana = HOMBRES.find((s) => String(s.n) === n);
  const colors = useColors();
  const { diario, escribir, terminar, marcarReto } = useHombresDiario();
  const [copiado, setCopiado] = useState(false);

  if (!semana) return <Text style={[text.body, { color: colors.text, margin: 40 }]}>Esa semana no existe.</Text>;

  const respuestas = diario?.respuestas[semana.n] ?? [];
  const fecha = diario?.hechas[semana.n] ?? null;
  const prog = diario ? progresoHombres(Object.keys(diario.hechas).map(Number)) : null;
  const abierta = !!fecha || prog?.siguiente === semana.n;
  const reto = !!diario?.retos[semana.n];
  const sigue = prog?.siguiente ?? null;

  const invitar = async () => {
    const message = invitacionHombres(URL);
    try {
      if (Platform.OS === 'web' && !navigator.share) throw new Error('web');
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Semana ${semana.n}` }} />
      <Appear>
        <Text style={[styles.kicker, { color: colors.warm }]}>
          HOMBRES DE PIE · SEMANA {semana.n} DE {SEMANAS_HOMBRES}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{semana.titulo}</Text>
        <Text style={[styles.lema, { color: colors.muted }]}>{semana.lema}</Text>
        {semana.intro.map((p) => (
          <Text key={p} style={[styles.intro, { color: colors.text }]}>
            {p}
          </Text>
        ))}
      </Appear>

      <Appear delay={60}>
        <View style={{ gap: 12, marginTop: 20 }}>
          {semana.pasajes.map((x) => (
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
          {semana.preguntas.map((q, i) => {
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
                  onChangeText={(t) => escribir(semana.n, i, t)}
                  multiline
                  maxLength={3000}
                  editable={!!diario}
                  placeholder="Escribe con honestidad. Nadie más lo leerá."
                  accessibilityLabel={`Pregunta ${i + 1}`}
                  style={{ marginTop: 8, minHeight: 88 }}
                />
                {crisis && <AvisoCrisis tipo={crisis} colors={colors} />}
              </View>
            );
          })}
        </View>
      </Appear>

      <Appear delay={130}>
        <View style={[styles.reto, { backgroundColor: colors.warmSoft, borderColor: colors.warm }]}>
          <Text style={[styles.kicker, { color: colors.warm }]}>EL RETO DE LA SEMANA</Text>
          <Text style={[styles.retoTexto, { color: colors.text }]}>{semana.reto}</Text>
          {semana.invitar && (
            <Button
              label={copiado ? 'Invitación copiada' : 'Invitar a un hombre'}
              icon={PeopleIcon}
              kind="outline"
              onPress={invitar}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            />
          )}
          {semana.hijos && (
            <Button
              label="Historias para leer con tus hijos"
              icon={(p) => <StarIcon {...p} />}
              kind="outline"
              onPress={() => navigate(() => router.push('/ninos' as never), 'forward')}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            />
          )}
          <Pressable
            onPress={() => marcarReto(semana.n, !reto)}
            disabled={!diario}
            accessibilityRole="checkbox"
            aria-checked={reto}
            style={[styles.fila, { marginTop: 14 }]}
          >
            <View style={[styles.box, { borderColor: reto ? colors.accent : colors.warm, backgroundColor: reto ? colors.accent : 'transparent' }]}>
              {reto && <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />}
            </View>
            <Text style={[text.body, { color: colors.text, flex: 1 }]}>Cumplí el reto</Text>
          </Pressable>
        </View>
      </Appear>

      {diario &&
        (fecha ? (
          <View style={[styles.hecha, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.hechaTitulo, { color: colors.text }]}>Terminaste esta semana el {fechaCorta(fecha)}</Text>
            <Button
              label={sigue ? `Ir a la semana ${sigue}` : 'Volver a Hombres de pie'}
              kind="outline"
              onPress={() => navigate(() => (sigue ? router.replace(`/hombres/${sigue}` as never) : router.back()), 'forward')}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            />
          </View>
        ) : abierta ? (
          <View style={{ marginTop: 22 }}>
            <Button label="Terminé esta semana" icon={CheckIcon} onPress={() => terminar(semana.n, todayKey())} />
            <Text style={[text.small, { color: colors.muted, marginTop: 8, textAlign: 'center' }]}>
              Puedes terminarla aunque el reto siga en marcha. Lo que importa es que se haga vida.
            </Text>
          </View>
        ) : (
          <Text style={[text.small, { color: colors.muted, marginTop: 22, textAlign: 'center' }]}>Primero termina las semanas anteriores.</Text>
        ))}
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
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reto: { borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 26 },
  retoTexto: { fontFamily: serif, fontSize: 19, lineHeight: 27, marginTop: 8 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  hecha: { borderRadius: 16, padding: 16, marginTop: 24 },
  hechaTitulo: { fontFamily: serif, fontSize: 18 },
});
