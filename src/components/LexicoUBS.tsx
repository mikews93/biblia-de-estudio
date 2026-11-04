// El sentido de una palabra griega o hebrea según el diccionario de las Sociedades Bíblicas Unidas (ya en español):
// el que tiene en este versículo arriba, y los demás debajo. Va en la tarjeta de la palabra y en el interlineal.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { getLexico } from '@/lib/data';
import { type EntradaLexico, type Sentido, LEXICO_UBS, sentidoEn, vecesSentido } from '@/lib/fuentesAbiertas';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = {
  strong: string;
  /** El versículo de la palabra, para marcar el sentido que tiene aquí. */
  en?: { book: string; chapter: number; verse: number };
  colors: Colors;
  /** Al ir a /fuentes, por ejemplo para cerrar la ventana de la palabra. */
  onNavigate?: () => void;
};

/** Las notas de UBS citan versículos como ⟦jhn.21.15⟧: aquí basta con el texto, sin los números. */
const sinRefs = (t: string) =>
  t
    .replace(/(\s*⟦[^⟧]*⟧)+/g, '')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .trim();

export default function LexicoUBS({ strong, en, colors, onNavigate }: Props) {
  const [loaded, setLoaded] = useState<{ strong: string; entradas: EntradaLexico[] } | null>(null);
  const [otros, setOtros] = useState(false);
  const [nota, setNota] = useState(false);

  useEffect(() => {
    let vivo = true;
    setOtros(false);
    setNota(false);
    getLexico(strong).then(
      (entradas) => vivo && setLoaded({ strong, entradas }),
      () => vivo && setLoaded({ strong, entradas: [] }),
    );
    return () => {
      vivo = false;
    };
  }, [strong]);

  if (!loaded || loaded.strong !== strong || !loaded.entradas.length) return null;

  // Todos los sentidos de las entradas del número, con el de este versículo primero.
  const todos: Sentido[] = loaded.entradas.flatMap((e) => e.s);
  const aqui = en ? sentidoEn(todos, en.book, en.chapter, en.verse) : -1;
  const principal = aqui >= 0 ? todos[aqui] : todos.length === 1 ? todos[0] : null;
  const resto = todos.filter((s) => s !== principal).sort((a, b) => vecesSentido(b) - vecesSentido(a));
  const comentario = principal && sinRefs(principal[2]);

  return (
    <View style={[styles.box, { borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.muted }]}>{LEXICO_UBS.nombre}</Text>
      {principal && (
        <View style={{ marginTop: 6 }}>
          {aqui >= 0 && (
            <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.pillText, { color: colors.text }]}>En este versículo</Text>
            </View>
          )}
          <SentidoView sentido={principal} colors={colors} grande />
          {!!comentario && (
            <>
              <Pressable onPress={() => setNota(!nota)} accessibilityRole="button" style={styles.toggle}>
                <Text style={[styles.toggleText, { color: colors.accent }]}>{nota ? 'Ocultar la nota' : 'Leer la nota'}</Text>
                {nota ? <ChevronUpIcon color={colors.accent} size={15} /> : <ChevronDownIcon color={colors.accent} size={15} />}
              </Pressable>
              {nota && <Text style={[styles.nota, { color: colors.text }]}>{comentario}</Text>}
            </>
          )}
        </View>
      )}
      {resto.length > 0 && (
        <>
          <Pressable onPress={() => setOtros(!otros)} accessibilityRole="button" style={styles.toggle}>
            <Text style={[styles.toggleText, { color: colors.accent }]}>
              {principal
                ? `${otros ? 'Ocultar' : 'Ver'} ${resto.length === 1 ? 'el otro sentido' : `los otros ${resto.length} sentidos`}`
                : `${otros ? 'Ocultar' : 'Ver'} ${resto.length === 1 ? 'su sentido' : `sus ${resto.length} sentidos`}`}
            </Text>
            {otros ? <ChevronUpIcon color={colors.accent} size={15} /> : <ChevronDownIcon color={colors.accent} size={15} />}
          </Pressable>
          {otros &&
            resto.map((s, i) => (
              <View key={i} style={[styles.otro, { borderColor: colors.border }]}>
                <SentidoView sentido={s} colors={colors} />
              </View>
            ))}
        </>
      )}
      <Pressable
        onPress={() => {
          onNavigate?.();
          navigate(() => router.push('/fuentes' as never), 'forward');
        }}
        accessibilityRole="link"
      >
        <Text style={[styles.credit, { color: colors.muted }]}>Sociedades Bíblicas Unidas · CC BY-SA 4.0 · Fuentes</Text>
      </Pressable>
    </View>
  );
}

function SentidoView({ sentido, colors, grande }: { sentido: Sentido; colors: Colors; grande?: boolean }) {
  const [glosas, definicion, , dominio] = sentido;
  const veces = vecesSentido(sentido);
  return (
    <View>
      {glosas.length > 0 && (
        <Text style={[grande ? styles.glosasGrande : styles.glosas, { color: grande ? colors.accent : colors.text }]}>
          {glosas.join(', ')}
        </Text>
      )}
      {!!definicion && <Text style={[styles.def, { color: colors.text }]}>{sinRefs(definicion)}</Text>}
      <Text style={[styles.meta, { color: colors.muted }]}>
        {[dominio, veces ? `${veces.toLocaleString('es')} ${veces === 1 ? 'vez' : 'veces'}` : ''].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 14 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  pill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  pillText: { fontSize: 11.5, fontWeight: '700' },
  glosasGrande: { fontFamily: serif, fontSize: 18, fontWeight: '600' },
  glosas: { fontSize: 14.5, fontWeight: '700' },
  def: { fontSize: 14.5, lineHeight: 21, marginTop: 3 },
  meta: { fontSize: 12, marginTop: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
  toggleText: { fontWeight: '700', fontSize: 13.5 },
  nota: { fontSize: 13.5, lineHeight: 20, marginTop: 6 },
  otro: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  credit: { fontSize: 11, marginTop: 12 },
});
