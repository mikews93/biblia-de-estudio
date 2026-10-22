// Piezas de Promesa y cumplimiento que se usan en varias pantallas: la tarjeta de un hilo y el aviso del pasaje.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRightIcon, PromiseIcon } from '@/components/icons';
import { Book, formatRef } from '@/lib/data';
import { Encontrado, Hilo, ROLES, TEMAS, espera, extremos, promesaHref, textoEspera } from '@/lib/promesas';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Referencia corta: «Isaías 7:14». Sin libros todavía, el código. */
export const etiquetaRef = (ref: string | undefined, books: Book[]) => (!ref ? 'Historia' : books.length ? formatRef(ref, books) : ref);

export const abrirHilo = (h: Hilo) => navigate(() => router.push(promesaHref(h) as never), 'forward');

/** De la promesa al cumplimiento, en una línea: ○ Isaías 7:14 ── unos 750 años ──● Mateo 1:22-23 */
export function MiniHilo({ hilo, books, colors }: { hilo: Hilo; books: Book[]; colors: Colors }) {
  const { promesa, cumple } = extremos(hilo);
  const color = TEMAS[hilo.tema].color;
  const años = espera(hilo);
  const fin = cumple ?? hilo.pasos[hilo.pasos.length - 1];
  const medio = hilo.tema === 'esperanza' ? 'aún por cumplirse' : hilo.esperaTexto ?? (años != null ? textoEspera(años).replace(/ después$/, '') : 'desde el principio');
  return (
    <View>
      <View style={styles.mini}>
        <View style={[styles.nodoAbierto, { borderColor: color, backgroundColor: colors.surface }]} />
        <View style={[styles.miniLinea, { backgroundColor: color, opacity: 0.45 }, hilo.tema === 'esperanza' && styles.punteada]} />
        {!!medio && (
          <Text style={[styles.miniMedio, { color: colors.muted, backgroundColor: colors.surface }]} numberOfLines={1}>
            {medio}
          </Text>
        )}
        <View style={[styles.miniLinea, { backgroundColor: color, opacity: 0.45 }, hilo.tema === 'esperanza' && styles.punteada]} />
        <View
          style={[
            styles.nodoLleno,
            hilo.tema === 'esperanza'
              ? { borderColor: color, backgroundColor: colors.surface, borderStyle: 'dashed' }
              : { borderColor: color, backgroundColor: color },
          ]}
        />
      </View>
      <View style={styles.miniRefs}>
        <Text style={[styles.miniRef, { color: colors.text }]} numberOfLines={1}>
          {etiquetaRef(promesa.ref, books)}
        </Text>
        <Text style={[styles.miniRef, { color: colors.text, textAlign: 'right' }]} numberOfLines={1}>
          {etiquetaRef(fin.ref, books)}
        </Text>
      </View>
    </View>
  );
}

export function HiloCard({ hilo, books, colors }: { hilo: Hilo; books: Book[]; colors: Colors }) {
  const tema = TEMAS[hilo.tema];
  return (
    <Pressable
      onPress={() => abrirHilo(hilo)}
      accessibilityRole="link"
      accessibilityLabel={hilo.titulo}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: hovered ? tema.color : colors.border },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={[styles.franja, { backgroundColor: tema.color }]} />
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{hilo.titulo}</Text>
        {hilo.citado && (
          <View style={[styles.badge, { backgroundColor: colors.warmSoft }]}>
            <Text style={{ color: colors.warm, fontSize: 10.5, fontWeight: '700' }}>CITADA EN EL NT</Text>
          </View>
        )}
      </View>
      <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 12 }} numberOfLines={2}>
        {hilo.resumen}
      </Text>
      <MiniHilo hilo={hilo} books={books} colors={colors} />
    </Pressable>
  );
}

/** En el lector y en el estudio: los hilos de promesa que pasan por este pasaje. */
export function PromesasDelPasaje({
  encontrados,
  books,
  colors,
  onNavigate,
}: {
  encontrados: Encontrado[];
  books: Book[];
  colors: Colors;
  onNavigate?: () => void;
}) {
  if (!encontrados.length) return null;
  return (
    <View style={[styles.pasaje, { backgroundColor: colors.warmSoft }]}>
      <View style={styles.pasajeHead}>
        <PromiseIcon color={colors.warm} size={18} />
        <Text style={[styles.pasajeKicker, { color: colors.warm }]}>PROMESA Y CUMPLIMIENTO</Text>
      </View>
      {encontrados.map(({ hilo, paso }, i) => {
        const { promesa, cumple } = extremos(hilo);
        const anuncia = paso.rol === 'promesa' || paso.rol === 'figura' || paso.rol === 'eco';
        const otro = anuncia ? cumple : promesa === paso ? undefined : promesa;
        return (
          <Pressable
            key={hilo.id}
            onPress={() => {
              onNavigate?.();
              abrirHilo(hilo);
            }}
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.pasajeFila,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: 16.5 }}>{hilo.titulo}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                {ROLES[paso.rol]} aquí
                {otro?.ref ? ` · ${otro === cumple ? 'se cumple en' : 'anunciada en'} ${etiquetaRef(otro.ref, books)}` : ''}
              </Text>
            </View>
            <ChevronRightIcon color={colors.muted} size={18} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  mini: { flexDirection: 'row', alignItems: 'center', height: 16 },
  nodoAbierto: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  nodoLleno: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  miniLinea: { flex: 1, height: 2 },
  punteada: { opacity: 0.3 },
  miniMedio: { fontSize: 11, paddingHorizontal: 6, maxWidth: '60%' },
  miniRefs: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  miniRef: { fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  franja: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  cardTitle: { flex: 1, fontFamily: serif, fontSize: 19, fontWeight: '600', lineHeight: 24 },
  badge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 3 },
  pasaje: { borderRadius: 16, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  pasajeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  pasajeKicker: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.3 },
  pasajeFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
});
