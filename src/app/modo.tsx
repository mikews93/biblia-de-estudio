import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Button, ErrorText, Field } from '@/components/comunidad/ui';
import { BooksIcon, CheckIcon, LockIcon, PeopleIcon, SparkIcon, StarIcon, type IconProps } from '@/components/icons';
import { pinValido, ponerPin, revisarPin, tienePin } from '@/lib/jovenes';
import { Modo, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

// Elegir para quién se ve la app. Al entrar al Modo Jóvenes la Biblia pasa al Español Sencillo; al salir
// vuelve la versión que se leía antes. Un adulto puede poner un PIN para que el modo no se cambie sin querer.
const VERSION_ANTES = 'jovenes-version-antes';

export default function ModoScreen() {
  const colors = useColors();
  const { settings, update } = useSettings();
  const [pin, setPin] = useState(false);
  const [pidePin, setPidePin] = useState(false);
  const [intento, setIntento] = useState('');
  const [nuevoPin, setNuevoPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    tienePin().then(setPin);
  }, []);

  const cambiar = async (modo: Modo) => {
    if (modo === settings.modo) return;
    if (modo === 'jovenes') {
      await AsyncStorage.setItem(VERSION_ANTES, settings.version).catch(() => {});
      update({ modo, version: 'bes' });
    } else {
      const antes = await AsyncStorage.getItem(VERSION_ANTES).catch(() => null);
      update({ modo, version: antes ?? settings.version });
    }
    navigate(() => router.dismissTo('/'), 'back');
  };

  const salir = async () => {
    if (!pin) return cambiar('general');
    if (!pidePin) return setPidePin(true);
    if (!(await revisarPin(intento))) return setError('Ese no es el PIN.');
    await ponerPin(null);
    setPin(false);
    cambiar('general');
  };

  const guardarPin = async () => {
    if (!pinValido(nuevoPin)) return setError('El PIN son cuatro números.');
    await ponerPin(nuevoPin);
    setPin(true);
    setNuevoPin('');
    setError(null);
    setAviso('PIN guardado en este dispositivo.');
  };

  const jovenes = settings.modo === 'jovenes';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '' }} />
      <Appear>
        <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]}>¿Quién usa la app?</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6 }}>
          La Biblia es la misma para todos. Cambia cómo se acompaña la lectura.
        </Text>
      </Appear>

      <Appear delay={40}>
        <Opcion
          titulo="Para todos"
          detalle="Estudio profundo con IA, interlineal, Taller para preparar mensajes y la comunidad completa."
          activo={!jovenes}
          onPress={salir}
          testID="modo-general"
        />
      </Appear>

      {pidePin && (
        <Appear>
          <View style={[styles.pin, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LockIcon color={colors.accent} size={18} />
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Un adulto puso un PIN para salir</Text>
            </View>
            <Field value={intento} onChangeText={setIntento} placeholder="PIN" keyboardType="number-pad" maxLength={4} secureTextEntry autoFocus />
            <Button label="Salir del Modo Jóvenes" onPress={salir} disabled={intento.length !== 4} />
            <ErrorText>{error}</ErrorText>
          </View>
        </Appear>
      )}

      <Appear delay={80}>
        <Opcion
          titulo="Jóvenes"
          etiqueta="12 a 17 años"
          detalle="Para leer la Biblia con ganas, a tu ritmo."
          activo={jovenes}
          onPress={() => cambiar('jovenes')}
          testID="modo-jovenes"
          puntos={[
            { icon: (p) => <StarIcon {...p} />, texto: 'Misiones de 5 minutos con estrellas y sellos, sin rankings' },
            { icon: BooksIcon, texto: 'La Biblia en Español Sencillo (puedes cambiarla)' },
            { icon: SparkIcon, texto: 'La IA solo te hace preguntas, con palabras para tu edad' },
            { icon: PeopleIcon, texto: 'Comunidad solo con tus amigos y tu grupo, nada público' },
          ]}
        />
      </Appear>

      <Appear delay={120}>
        <View style={[styles.opcion, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.6 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.opcionTitulo, { color: colors.text, fontFamily: serif }]}>Niños</Text>
            <Text style={[styles.etiqueta, { color: colors.muted, borderColor: colors.border }]}>6 a 11 años</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            Historias ilustradas y narradas, con un adulto al lado. Muy pronto.
          </Text>
        </View>
      </Appear>

      {jovenes && !pidePin && (
        <Appear delay={160}>
          <View style={[styles.pin, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LockIcon color={colors.accent} size={18} />
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Para papás y líderes</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {pin
                ? 'Este dispositivo tiene un PIN: hace falta para volver a la app para todos.'
                : 'Pon un PIN de cuatro números para que el Modo Jóvenes no se cambie sin querer. Queda solo en este dispositivo.'}
            </Text>
            {!pin && (
              <>
                <Field value={nuevoPin} onChangeText={setNuevoPin} placeholder="Nuevo PIN" keyboardType="number-pad" maxLength={4} secureTextEntry />
                <Button label="Guardar PIN" kind="outline" onPress={guardarPin} disabled={nuevoPin.length !== 4} />
              </>
            )}
            <ErrorText>{error}</ErrorText>
            {aviso && <Text style={{ color: colors.accent, fontSize: 13 }}>{aviso}</Text>}
          </View>
        </Appear>
      )}
    </ScrollView>
  );
}

function Opcion({
  titulo,
  etiqueta,
  detalle,
  puntos,
  activo,
  onPress,
  testID,
}: {
  titulo: string;
  etiqueta?: string;
  detalle: string;
  puntos?: { icon: (p: IconProps) => React.ReactNode; texto: string }[];
  activo: boolean;
  onPress: () => void;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.opcion,
        { backgroundColor: colors.surface, borderColor: activo ? colors.warm : colors.border, borderWidth: activo ? 2 : 1 },
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: activo }}
      testID={testID}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[styles.opcionTitulo, { color: colors.text, fontFamily: serif }]}>{titulo}</Text>
        {etiqueta && <Text style={[styles.etiqueta, { color: colors.muted, borderColor: colors.border }]}>{etiqueta}</Text>}
        <View style={[styles.radio, { borderColor: activo ? colors.warm : colors.border, backgroundColor: activo ? colors.warm : 'transparent' }]}>
          {activo && <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />}
        </View>
      </View>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{detalle}</Text>
      {puntos && (
        <View style={{ gap: 10, marginTop: 14 }}>
          {puntos.map((p) => (
            <View key={p.texto} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.punto, { backgroundColor: colors.warmSoft }]}>
                <p.icon color={colors.warm} size={16} />
              </View>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{p.texto}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  titulo: { fontSize: 30 },
  opcion: { borderRadius: 20, padding: 18 },
  opcionTitulo: { fontSize: 22 },
  etiqueta: { fontSize: 12, fontWeight: '700', borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  radio: { marginLeft: 'auto', width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  punto: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pin: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
