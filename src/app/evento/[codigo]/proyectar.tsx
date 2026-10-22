import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { LiveDot, useEventoEnVivo } from '@/components/evento/piezas';
import { CloseIcon } from '@/components/icons';
import Qr from '@/components/Qr';
import { Book, getBooks } from '@/lib/data';
import { codigoLegible, enlaceCorto, enlaceEvento, limpiarCodigo } from '@/lib/eventos';
import { pasajeLabel } from '@/lib/taller';
import { serif } from '@/lib/theme';

// La pantalla de la iglesia es oscura siempre, como en un auditorio con las luces bajas.
const FONDO = '#141312';
const TINTA = '#F2EEE8';
const SUAVE = '#A39E96';
const CALIDO = '#E2A868';

/** Para el proyector de la iglesia: el código grande, el QR para la cámara y el punto en que va el mensaje. */
export default function ProyectarScreen() {
  const { codigo: raw } = useLocalSearchParams<{ codigo: string }>();
  const codigo = limpiarCodigo(raw ?? '');
  const { evento } = useEventoEnVivo(codigo);
  const { width, height } = useWindowDimensions();
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const ancho = width > height * 1.1;
  const qr = Math.min(ancho ? height * 0.52 : width * 0.62, 420);
  const actual = evento && evento.estado === 'en-vivo' && evento.punto >= 0 ? evento.puntos[evento.punto] : null;
  const big = Math.min(width / (ancho ? 14 : 8), 92);

  return (
    <View style={[styles.screen, { backgroundColor: FONDO }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(`/evento/${codigo}`))} hitSlop={12} style={styles.close} accessibilityLabel="Salir">
        <CloseIcon color={SUAVE} size={24} />
      </Pressable>
      <View style={[styles.body, ancho && styles.bodyWide]}>
        <View style={[styles.qr, { padding: qr * 0.06 }]}>
          <Qr value={enlaceEvento(codigo)} size={qr} />
        </View>
        <View style={[styles.side, ancho ? { maxWidth: width * 0.45 } : { alignItems: 'center' }]}>
          <Text style={[styles.lead, { textAlign: ancho ? 'left' : 'center' }]}>Sigue el mensaje en tu teléfono</Text>
          <Text style={[styles.how, { textAlign: ancho ? 'left' : 'center' }]}>Apunta la cámara al código o entra en</Text>
          <Text style={[styles.url, { textAlign: ancho ? 'left' : 'center' }]}>{enlaceCorto(codigo).replace(/\/[A-Z0-9]+$/, '')}</Text>
          <Text style={[styles.code, { fontSize: big, textAlign: ancho ? 'left' : 'center' }]} accessibilityLabel={`Código ${codigo.split('').join(' ')}`}>
            {codigoLegible(codigo)}
          </Text>
          {evento && (
            <View style={[styles.now, !ancho && { alignItems: 'center' }]}>
              {actual ? (
                <>
                  <View style={styles.liveRow}>
                    <LiveDot color={CALIDO} size={8} />
                    <Text style={styles.liveText}>
                      PUNTO {evento.punto + 1} DE {evento.total}
                    </Text>
                  </View>
                  <Text style={[styles.point, { textAlign: ancho ? 'left' : 'center' }]}>{actual.titulo}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.liveText}>{pasajeLabel(evento.pasaje, books).toUpperCase()}</Text>
                  <Text style={[styles.point, { textAlign: ancho ? 'left' : 'center' }]}>{evento.titulo}</Text>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  close: { position: 'absolute', top: 20, right: 22, zIndex: 2 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 36 },
  bodyWide: { flexDirection: 'row', gap: 64 },
  qr: { backgroundColor: '#FFFFFF', borderRadius: 24 },
  side: { gap: 6 },
  lead: { color: TINTA, fontFamily: serif, fontSize: 34, lineHeight: 42, fontWeight: '700' },
  how: { color: SUAVE, fontSize: 20, marginTop: 10 },
  url: { color: TINTA, fontSize: 24, fontWeight: '600' },
  code: { color: CALIDO, fontWeight: '800', letterSpacing: 6, marginTop: 14, fontVariant: ['tabular-nums'] },
  now: { marginTop: 26, gap: 6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -6 },
  liveText: { color: SUAVE, fontSize: 15, fontWeight: '800', letterSpacing: 1.5 },
  point: { color: TINTA, fontFamily: serif, fontSize: 30, lineHeight: 38, fontWeight: '700' },
});
