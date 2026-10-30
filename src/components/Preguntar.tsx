// Piezas de «Pregúntale a la Biblia» (src/lib/preguntar.ts): la tarjeta del buscador con la respuesta corta, el
// selector Sencillo / A fondo y la lista de preguntas que muchos hacen.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { ChevronRightIcon, SparkIcon } from '@/components/icons';
import { Markdown } from '@/components/StudyText';
import { NEEDS_ACCOUNT, useAccount } from '@/lib/comunidad';
import { parseRef } from '@/lib/data';
import {
  CATEGORIAS,
  type Categoria,
  type Nivel,
  PREPARADAS,
  conversacion,
  enCorto,
  preparadaDe,
  separar,
  useConversacion,
} from '@/lib/preguntar';
import { verseHref } from '@/lib/routes';
import { Colors, isDark, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export const preguntarHref = (texto: string, nivel: Nivel = 'sencillo') =>
  `/preguntar?q=${encodeURIComponent(texto)}${nivel === 'fondo' ? '&n=fondo' : ''}`;

export const openRef = (ref: string) => {
  const { start } = parseRef(ref);
  navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
};

/**
 * La pregunta escrita en el buscador: la respuesta corta en cuanto llega, con sus versículos clave, y el botón para
 * leerla completa. La conversación es la misma que abre /preguntar, así que no se pide dos veces.
 */
export function PreguntaCard({ texto, colors }: { texto: string; colors: Colors }) {
  const { llave, ready } = useAccount();
  const preparada = !!preparadaDe(texto);
  // Sin cuenta solo se piden las preparadas (se leen gratis); las demás esperan a que entre.
  const puede = ready && (!!llave || preparada);
  const c = useMemo(() => (puede ? conversacion(texto, 'sencillo') : null), [puede, texto]);
  const estado = useConversacion(c);
  const last = estado?.turns[estado.turns.length - 1];
  const respuesta = last?.role === 'assistant' ? last : null;
  const corto = respuesta ? enCorto(separar(respuesta.text).cuerpo) : '';
  const investigando = !!estado?.working && !corto;
  const abrir = () => navigate(() => router.push(preguntarHref(texto) as never), 'forward');

  if (!ready) return null;
  if (!c || estado?.error === NEEDS_ACCOUNT) {
    return (
      <Appear>
        <Welcome
          kind="ia"
          title="Pregúntale a la Biblia"
          intro="Con tu cuenta gratis, Zarza investiga tu pregunta en la Biblia, los comentarios y las teologías de la app, y te responde con citas que puedes tocar. Mientras tanto, abajo tienes los pasajes que hablan de esto."
          onReady={abrir}
        />
      </Appear>
    );
  }

  return (
    <Appear>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          !isDark(colors) && { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' },
        ]}
      >
        <View style={styles.head}>
          <SparkIcon color={colors.warm} size={15} />
          <Text style={[styles.kicker, { color: colors.warm }]}>Pregunta</Text>
        </View>
        {corto ? (
          <Markdown text={corto.replace(/^## En corto\n/, '')} colors={colors} sources={respuesta?.sources} onOpenRef={openRef} />
        ) : estado?.error ? (
          <Text style={[styles.body, { color: colors.text }]}>{estado.error}</Text>
        ) : (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.warm} />
            <Text style={[styles.waitingText, { color: colors.muted }]}>
              {investigando && respuesta?.pasos?.length
                ? `Leyendo ${respuesta.pasos[respuesta.pasos.length - 1].texto}…`
                : 'Buscando la respuesta en la Biblia…'}
            </Text>
          </View>
        )}
        <Pressable
          onPress={estado?.error && !corto ? () => c.preguntar() : abrir}
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent }, pressed && styles.pressed]}
          accessibilityRole={estado?.error && !corto ? 'button' : 'link'}
        >
          <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>
            {estado?.error && !corto ? 'Intentar otra vez' : 'Ver la respuesta completa ›'}
          </Text>
        </Pressable>
        <Text style={[styles.note, { color: colors.muted }]}>Responde con la Biblia y las fuentes de la app. Puede equivocarse: revisa las citas.</Text>
      </View>
    </Appear>
  );
}

/** Sencillo o A fondo: una píldora con el nivel activo en ámbar. */
export function NivelToggle({ nivel, onChange, colors }: { nivel: Nivel; onChange: (n: Nivel) => void; colors: Colors }) {
  return (
    <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="tablist">
      {(
        [
          ['sencillo', 'Sencillo'],
          ['fondo', 'A fondo'],
        ] as const
      ).map(([id, label]) => {
        const on = id === nivel;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="tab"
            aria-selected={on}
            style={[styles.toggleItem, on && { backgroundColor: colors.warm }]}
          >
            <Text style={{ color: on ? colors.background : colors.muted, fontWeight: on ? '700' : '600', fontSize: 13 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Las preguntas que muchos hacen, por tema. Sus respuestas se guardan para todos y se leen sin cuenta. */
export function Preparadas({ colors, onPick }: { colors: Colors; onPick: (texto: string) => void }) {
  const [cat, setCat] = useState<Categoria | null>(null);
  const [todas, setTodas] = useState(false);
  const lista = PREPARADAS.filter((p) => !cat || p.cat === cat);
  const vistas = todas || cat ? lista : lista.filter((_, i) => i % 5 === 0 || i % 5 === 2).slice(0, 5);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.chips}>
        {[{ id: null, label: 'Todas' } as const, ...CATEGORIAS].map((c) => {
          const on = c.id === cat;
          return (
            <Pressable
              key={c.label}
              onPress={() => setCat(c.id)}
              accessibilityRole="button"
              aria-selected={on}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={{ color: on ? colors.surface : colors.text, fontSize: 14, fontWeight: on ? '700' : '400' }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {vistas.map((p, i) => (
          <Pressable
            key={p.id}
            onPress={() => onPick(p.texto)}
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.rowText, { color: colors.text, fontFamily: serif }]}>{p.texto}</Text>
            <ChevronRightIcon color={colors.muted} size={16} />
          </Pressable>
        ))}
      </View>
      {!todas && !cat && (
        <Pressable onPress={() => setTodas(true)} hitSlop={6} accessibilityRole="button">
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Ver las {PREPARADAS.length} preguntas</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  body: { fontSize: 16, lineHeight: 24 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  waitingText: { fontSize: 15, flex: 1 },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  note: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  toggle: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, padding: 3 },
  toggleItem: { height: 34, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
  rowText: { flex: 1, fontSize: 17, lineHeight: 23 },
});
