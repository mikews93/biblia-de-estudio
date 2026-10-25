import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { NoEstasSolo } from '@/components/ParaTi';
import { CommentIcon, CheckIcon } from '@/components/icons';
import { Consejo, MENSAJE_CONFIANZA, Respuesta, consejo, tocaPreguntar } from '@/lib/acompanar';
import type { Oracion } from '@/lib/oraciones';
import { todayKey } from '@/lib/planes';
import { anotar, completar, useSeguimiento } from '@/lib/seguimiento';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const OPCIONES: { value: Respuesta; label: string }[] = [
  { value: 'mejor', label: 'Un poco mejor' },
  { value: 'igual', label: 'Igual' },
  { value: 'dificil', label: 'Más difícil' },
];

/**
 * «¿Cómo sigues?»: una vez por semana, como mucho, por una petición del diario que es una carga. Según la respuesta
 * anima a hablarlo con un pastor, un mentor o alguien de confianza (src/lib/acompanar.ts). En Hoy no se nombra la
 * petición: alguien puede estar mirando la pantalla.
 */
export default function ComoSigues({ oraciones, ocultos, colors }: { oraciones: Oracion[]; ocultos: string[]; colors: Colors }) {
  const historial = useSeguimiento();
  const hoy = todayKey();
  const toca = useMemo(() => (historial ? tocaPreguntar(oraciones, historial, hoy, ocultos) : null), [oraciones, historial, hoy, ocultos]);
  // Lo que se está mostrando: se fija al responder, para que la tarjeta no desaparezca al anotar
  const [abierta, setAbierta] = useState<{ id: string; created: number; respuesta?: Respuesta; consejo?: Consejo; hablo?: boolean | 'no' } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [cerrada, setCerrada] = useState(false);

  const actual = abierta ?? (toca ? { id: toca.oracion.id, created: toca.oracion.created } : null);
  if (!actual || cerrada) return null;

  const responder = (respuesta: Respuesta) => {
    const previas = (historial ?? []).filter((p) => p.oracion === actual.id);
    setAbierta({ ...actual, respuesta, consejo: consejo(respuesta, previas, hoy) });
    anotar({ fecha: hoy, oracion: actual.id, respuesta });
  };
  const ahoraNo = () => {
    anotar({ fecha: hoy, oracion: null });
    setCerrada(true);
  };
  const hablo = (si: boolean) => {
    setAbierta({ ...actual, hablo: si ? true : 'no' });
    if (si) completar(actual.id, { hablo: true });
  };
  const escribir = async () => {
    try {
      if (Platform.OS === 'web' && !navigator.share) throw new Error('web');
      await Share.share({ message: MENSAJE_CONFIANZA });
    } catch {
      await Clipboard.setStringAsync(MENSAJE_CONFIANZA);
      setCopiado(true);
    }
  };

  const c = actual.consejo;
  const fecha = new Date(actual.created).toLocaleDateString('es', { day: 'numeric', month: 'long' });
  const invitarAHablar = c && (c.hablar || actual.hablo === 'no') && actual.hablo !== true;

  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="como-sigues">
        <Text style={[styles.kicker, { color: colors.warm }]}>Un momento para ti</Text>
        {!c ? (
          <>
            <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]}>¿Cómo sigues con lo que estás orando?</Text>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
              Por la petición que escribiste el {fecha}. Tu respuesta se queda en este teléfono.
            </Text>
            <View style={styles.opciones}>
              {OPCIONES.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => responder(o.value)}
                  style={({ pressed }) => [styles.opcion, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={ahoraNo} hitSlop={8} style={styles.ahoraNo} accessibilityRole="button">
              <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Ahora no</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.consejo, { color: colors.text, fontFamily: serif }]}>
              {actual.hablo === true
                ? 'Qué bien. Sigue apoyándote en esa persona: dejar que te acompañen también es fe.'
                : actual.hablo === 'no'
                  ? 'Está bien. Dios no te pide cargarlo en silencio: hablarlo con alguien que te ame y ore contigo ayuda de verdad.'
                  : c.texto}
            </Text>

            {c.preguntarSiHablo && actual.hablo === undefined && (
              <View style={styles.fila}>
                <Pressable
                  onPress={() => hablo(true)}
                  style={({ pressed }) => [styles.boton, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Sí, ya hablé con alguien</Text>
                </Pressable>
                <Pressable
                  onPress={() => hablo(false)}
                  style={({ pressed }) => [styles.boton, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Todavía no</Text>
                </Pressable>
              </View>
            )}

            {invitarAHablar && (
              <View style={[styles.hablar, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>
                  Piensa en una persona: tu pastor, tu líder de célula, un mentor o un amigo maduro en la fe. Este mensaje no dice
                  de qué se trata; eso lo cuentas tú cuando estén juntos.
                </Text>
                <Text style={[styles.mensaje, { color: colors.muted, fontFamily: serif, borderColor: colors.border }]}>«{MENSAJE_CONFIANZA}»</Text>
                <Pressable
                  onPress={escribir}
                  style={({ pressed }) => [styles.escribir, { backgroundColor: colors.accent }, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  {copiado ? <CheckIcon color={colors.surface} size={16} strokeWidth={2.4} /> : <CommentIcon color={colors.surface} size={16} />}
                  <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 14 }}>{copiado ? 'Copiado: pégalo en tu chat' : 'Escribirle a alguien'}</Text>
                </Pressable>
              </View>
            )}

            {actual.respuesta === 'mejor' && (
              <Pressable
                onPress={() => navigate(() => router.push('/diario?vista=oraciones' as never), 'forward')}
                hitSlop={6}
                style={{ marginTop: 12 }}
                accessibilityRole="link"
              >
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Ver mi petición ›</Text>
              </Pressable>
            )}

            <Pressable onPress={() => setCerrada(true)} hitSlop={8} style={styles.ahoraNo} accessibilityRole="button">
              <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Listo</Text>
            </Pressable>
          </>
        )}
      </View>
      {c?.lineas && <NoEstasSolo colors={colors} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  titulo: { fontSize: 22, lineHeight: 29, marginTop: 8 },
  consejo: { fontSize: 18, lineHeight: 27, marginTop: 8 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  opcion: { flexGrow: 1, alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  ahoraNo: { alignSelf: 'center', marginTop: 14 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  boton: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  hablar: { borderRadius: 16, padding: 16, marginTop: 14 },
  mensaje: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', borderLeftWidth: 2, paddingLeft: 12, marginTop: 10 },
  escribir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 12, marginTop: 14 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
