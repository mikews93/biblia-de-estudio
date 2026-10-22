// /sellos: «Mis sellos». Lo que la persona ha vivido con la Palabra, agrupado por familias, sin puntos ni
// rankings. Cada sello abre su versículo y adónde ir para ganarlo. /sellos?sello=bereano abre uno.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import Sello from '@/components/Sello';
import { ChevronRightIcon, CloseIcon } from '@/components/icons';
import { verseHref } from '@/lib/routes';
import {
  avance,
  ganadosRecientes,
  getFamilias,
  selloPorId,
  sellosPara,
  siguienteSello,
  useSellos,
  type Estado,
  type Sello as SelloDef,
} from '@/lib/sellos';
import '@/lib/jovenes';
import '@/lib/ninos';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function MisSellos() {
  const colors = useColors();
  const params = useLocalSearchParams<{ sello?: string }>();
  const estado = useSellos();
  const { width } = useWindowDimensions();
  const [abierto, setAbierto] = useState<string | null>(params.sello ?? null);

  // En el Modo Jóvenes se suman los sellos de las misiones (src/lib/jovenes.ts). En el Espacio Niños se ven solo los
  // de las historias (src/lib/ninos.ts): los de estudio hablan de cosas que ese espacio no tiene.
  const { modo } = useSettings().settings;
  const lista = modo === 'ninos' ? sellosPara('ninos').filter((s) => s.publico === 'ninos') : sellosPara(modo === 'jovenes' ? 'jovenes' : 'todos');
  const ganados = ganadosRecientes(estado, lista);
  const proximo = siguienteSello(estado, lista);
  const porFila = width >= 900 ? 5 : width >= 560 ? 4 : 3;
  const sello = abierto ? selloPorId(abierto) : undefined;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Mis sellos' }} />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.pila} aria-hidden>
            {(ganados.length ? ganados.slice(0, 3) : lista.slice(0, 3)).map((s, i) => (
              <View key={s.id} style={[styles.pilaSello, { marginLeft: i ? -26 : 0, zIndex: 3 - i, transform: [{ rotate: `${(i - 1) * 8}deg` }] }]}>
                <Sello dibujo={s.dibujo} colors={colors} ganado={!!ganados.length} size={i === 0 ? 76 : 64} />
              </View>
            ))}
          </View>
          <Text style={[styles.cuenta, { color: colors.text, fontFamily: serif }]}>
            {ganados.length ? `${ganados.length} de ${lista.length} sellos` : 'Tu primer sello te espera'}
          </Text>
          <Text style={[styles.lema, { color: colors.muted }]}>
            Cada sello celebra algo que viviste con la Palabra, no lo rápido que vas. Sin puntos ni rankings: son solo tuyos.
          </Text>
          {proximo && (
            <Pressable
              onPress={() => setAbierto(proximo.sello.id)}
              style={({ pressed }) => [styles.proximo, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Más cerca: ${proximo.sello.titulo}, ${proximo.n} de ${proximo.meta}`}
            >
              <Sello dibujo={proximo.sello.dibujo} colors={colors} ganado={false} parte={proximo.parte} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>MÁS CERCA</Text>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 1 }}>{proximo.sello.titulo}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {proximo.n} de {proximo.meta} · {proximo.sello.como}
                </Text>
              </View>
              <ChevronRightIcon color={colors.muted} size={18} />
            </Pressable>
          )}
        </View>
      </Appear>

      {getFamilias().map((f, fi) => {
        const deFamilia = lista.filter((s) => s.familia === f.id);
        if (!deFamilia.length) return null;
        const hechos = deFamilia.filter((s) => estado.ganados[s.id]).length;
        return (
          <Appear key={f.id} delay={60 + fi * 30}>
            <View style={styles.familia}>
              <View style={styles.familiaHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.familiaTitulo, { color: colors.text, fontFamily: serif }]}>{f.titulo}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14, marginTop: 2 }}>{f.subtitulo}</Text>
                </View>
                <Text style={{ color: hechos ? colors.warm : colors.muted, fontWeight: '700', fontSize: 13 }}>
                  {hechos}/{deFamilia.length}
                </Text>
              </View>
              <View style={styles.rejilla}>
                {deFamilia.map((s) => (
                  <Casilla key={s.id} sello={s} estado={estado} colors={colors} ancho={`${100 / porFila}%`} onPress={() => setAbierto(s.id)} />
                ))}
              </View>
            </View>
          </Appear>
        );
      })}

      {sello && <Detalle sello={sello} estado={estado} colors={colors} onClose={() => setAbierto(null)} />}
    </ScrollView>
  );
}

function Casilla({
  sello,
  estado,
  colors,
  ancho,
  onPress,
}: {
  sello: SelloDef;
  estado: Estado;
  colors: Colors;
  ancho: `${number}%`;
  onPress: () => void;
}) {
  const a = avance(estado, sello);
  const ganado = !!a.ganado;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.casilla, { width: ancho }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${sello.titulo}. ${ganado ? 'Ganado' : sello.sinCuenta ? 'Por ganar' : `${a.n} de ${a.meta}`}`}
      testID={`sello-${sello.id}`}
    >
      <Sello dibujo={sello.dibujo} colors={colors} ganado={ganado} parte={sello.sinCuenta ? 0 : a.parte} size={80} />
      <Text style={[styles.casillaTitulo, { color: ganado ? colors.text : colors.muted }]} numberOfLines={2}>
        {sello.titulo}
      </Text>
      <Text style={{ color: ganado ? colors.warm : colors.muted, fontSize: 12, marginTop: 2, fontWeight: ganado ? '600' : '400' }}>
        {ganado ? fechaCorta(a.ganado!.fecha) : sello.sinCuenta ? 'Por ganar' : `${a.n} de ${a.meta}`}
      </Text>
    </Pressable>
  );
}

function Detalle({ sello, estado, colors, onClose }: { sello: SelloDef; estado: Estado; colors: Colors; onClose: () => void }) {
  const a = avance(estado, sello);
  const ganado = !!a.ganado;
  const ir = (href: string) => {
    onClose();
    navigate(() => router.push(href as never), 'forward');
  };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.fondo} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable style={[styles.hoja, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="detalle-sello">
          <Pressable onPress={onClose} style={styles.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
            <CloseIcon color={colors.muted} size={20} />
          </Pressable>
          <Sello dibujo={sello.dibujo} colors={colors} ganado={ganado} parte={sello.sinCuenta ? 0 : a.parte} size={120} />
          <Text style={[styles.kicker, { color: ganado ? colors.warm : colors.muted }]}>
            {ganado ? `Ganado el ${fechaLarga(a.ganado!.fecha)}` : 'Por ganar'}
          </Text>
          <Text style={[styles.detalleTitulo, { color: colors.text, fontFamily: serif }]}>{sello.titulo}</Text>
          <Text style={{ color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 4 }}>{ganado ? sello.logro : sello.como}</Text>
          {!ganado && !sello.sinCuenta && sello.meta > 1 && (
            <View style={{ width: '100%', marginTop: 14 }}>
              <View style={[styles.barra, { backgroundColor: colors.accentSoft }]}>
                <View style={[styles.barraLlena, { backgroundColor: colors.accent, width: `${Math.max(4, a.parte * 100)}%` }]} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                {a.n} de {a.meta}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => ir(verseHref(sello.versiculo.book, sello.versiculo.chapter, sello.versiculo.verse))}
            style={({ pressed }) => [styles.versiculo, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
            accessibilityRole="link"
          >
            <Text style={{ color: colors.text, fontFamily: serif, fontStyle: 'italic', fontSize: 17, lineHeight: 25, textAlign: 'center' }}>
              «{sello.versiculo.texto}»
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>{sello.versiculo.ref} ›</Text>
          </Pressable>
          <Pressable
            onPress={() => ir(sello.ir.href)}
            style={({ pressed }) => [styles.boton, { backgroundColor: ganado ? colors.accentSoft : colors.accent }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={{ color: ganado ? colors.accent : colors.surface, fontWeight: '700' }}>{sello.ir.label} ›</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const fecha = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fechaCorta = (s: string) => fecha(s).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
const fechaLarga = (s: string) => {
  const f = fecha(s);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (f.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return f.toLocaleDateString('es', opts);
};

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, gap: 26, maxWidth: 760, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 22, alignItems: 'center' },
  pila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 86 },
  pilaSello: {},
  cuenta: { fontSize: 28, marginTop: 10, textAlign: 'center' },
  lema: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 6, maxWidth: 440 },
  proximo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 12, marginTop: 18, alignSelf: 'stretch' },
  familia: {},
  familiaHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 6 },
  familiaTitulo: { fontSize: 22 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  casilla: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  casillaTitulo: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 17 },
  fondo: { flex: 1, backgroundColor: 'rgba(10,10,10,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  hoja: { width: '100%', maxWidth: 400, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center' },
  cerrar: { position: 'absolute', top: 12, right: 12, padding: 8, zIndex: 2 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },
  detalleTitulo: { fontSize: 28, marginTop: 4, textAlign: 'center' },
  barra: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barraLlena: { height: 8, borderRadius: 4 },
  versiculo: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 16, width: '100%' },
  boton: { borderRadius: 16, paddingVertical: 13, paddingHorizontal: 18, marginTop: 20, alignSelf: 'stretch', alignItems: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
