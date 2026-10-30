// «Del diccionario bíblico»: la tarjeta del buscador que explica una palabra de la Biblia (Getsemaní, el efod, la
// gracia) en español sencillo, con sus pasajes clave. La explicación sale de los diccionarios de Easton y Smith y del
// índice por temas de Nave (src/lib/diccionario.ts) y se guarda para todos.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { ChevronDownIcon, ChevronUpIcon, DictionaryIcon } from '@/components/icons';
import { openRef, preguntarHref } from '@/components/Preguntar';
import { getExplicacion } from '@/lib/comentarios';
import { type Explicacion, type Palabra, conArticulo } from '@/lib/diccionario';
import { formatRef } from '@/lib/refs';
import { Colors, isDark, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const OBRAS = { easton: 'Easton (1897)', smith: 'Smith (1863)', nave: 'Nave (1896)' } as const;

type Estado = { id: string; explicacion?: Explicacion | null; error?: string };

export default function DiccionarioCard({
  palabra,
  books,
  colors,
  preguntar = true,
}: {
  palabra: Palabra;
  books: { id: string; name: string }[];
  colors: Colors;
  /** Sin el botón de preguntar: cuando ya se está respondiendo una pregunta encima. */
  preguntar?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>({ id: palabra.id });
  const [abierta, setAbierta] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    getExplicacion(palabra.id).then(
      (explicacion) => vivo && setEstado({ id: palabra.id, explicacion }),
      (e: Error) => vivo && setEstado({ id: palabra.id, error: e.message }),
    );
    return () => {
      vivo = false;
    };
  }, [palabra.id, intento]);

  // Lo de otra palabra no se enseña mientras llega la nueva.
  const actual = estado.id === palabra.id ? estado : { id: palabra.id };
  const ex = actual.explicacion;
  if (ex === null) return null;
  const cargando = !ex && !actual.error;
  const diccionarios = ex?.fuentes.filter((f) => f !== 'nave').map((f) => OBRAS[f]) ?? [];
  const credito = [
    diccionarios.length ? `${diccionarios.length > 1 ? 'los diccionarios bíblicos de' : 'el diccionario bíblico de'} ${diccionarios.join(' y ')}` : '',
    ex?.fuentes.includes('nave') ? `el índice por temas de ${OBRAS.nave}` : '',
  ]
    .filter(Boolean)
    .join(' y ');
  // Las copias de las que salen (pipeline/build_diccionario.py) piden atribución.
  const datos = [diccionarios.length ? 'NEUU' : '', ex?.fuentes.includes('nave') ? 'BibleData' : ''].filter(Boolean).join(' y ');

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
          <DictionaryIcon color={colors.warm} size={15} />
          <Text style={[styles.kicker, { color: colors.warm }]}>Del diccionario bíblico</Text>
        </View>
        <Text style={[styles.title, { color: colors.text, fontFamily: serif }]}>{palabra.nombre}</Text>

        {cargando ? (
          <View style={{ gap: 9, paddingVertical: 6 }} accessibilityLabel="Buscando en el diccionario">
            {(['92%', '84%', '58%'] as const).map((w) => (
              <View key={w} style={[styles.skeleton, { backgroundColor: colors.border, width: w }]} />
            ))}
          </View>
        ) : actual.error ? (
          <View style={{ gap: 10 }}>
            <Text style={[styles.body, { color: colors.muted }]}>{actual.error}</Text>
            <Pressable onPress={() => setIntento((n) => n + 1)} hitSlop={6} accessibilityRole="button">
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Intentar otra vez</Text>
            </Pressable>
          </View>
        ) : (
          ex && (
            <>
              <Text style={[styles.body, { color: colors.text }]}>{ex.breve}</Text>

              {ex.pasajes.length > 0 && (
                <View style={styles.pasajes}>
                  {ex.pasajes.map((g) => (
                    <View key={g.tema} style={styles.grupo}>
                      <Text style={[styles.grupoTitulo, { color: colors.muted }]}>{g.tema}</Text>
                      <View style={styles.chips}>
                        {g.refs.map((r) => (
                          <Pressable
                            key={r}
                            onPress={() => openRef(r)}
                            accessibilityRole="link"
                            style={({ pressed }) => [styles.chip, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
                          >
                            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>{formatRef(r, books)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {ex.mas.length > 0 && (
                <>
                  {abierta && (
                    <Appear style={{ gap: 10, marginTop: 4 }}>
                      {ex.mas.map((p) => (
                        <Text key={p} style={[styles.body, { color: colors.text }]}>
                          {p}
                        </Text>
                      ))}
                    </Appear>
                  )}
                  <Pressable
                    onPress={() => setAbierta((a) => !a)}
                    hitSlop={6}
                    accessibilityRole="button"
                    aria-expanded={abierta}
                    style={styles.mas}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{abierta ? 'Leer menos' : 'Leer más'}</Text>
                    {abierta ? <ChevronUpIcon color={colors.accent} size={15} /> : <ChevronDownIcon color={colors.accent} size={15} />}
                  </Pressable>
                </>
              )}

              {preguntar && (
                <Pressable
                  onPress={() => navigate(() => router.push(preguntarHref(`¿Qué dice la Biblia sobre ${conArticulo(palabra.nombre)}?`) as never), 'forward')}
                  style={({ pressed }) => [styles.preguntar, { borderColor: colors.border }, pressed && styles.pressed]}
                  accessibilityRole="link"
                >
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Pregúntale a la Biblia sobre esto ›</Text>
                </Pressable>
              )}

              <Text style={[styles.note, { color: colors.muted }]}>
                Explicado con IA a partir de {credito}, de dominio público (datos de {datos}, CC BY 4.0). Toca un pasaje para leerlo.
              </Text>
            </>
          )
        )}
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 26, lineHeight: 32, marginTop: -2 },
  body: { fontSize: 16, lineHeight: 24 },
  skeleton: { height: 14, borderRadius: 7 },
  pasajes: { gap: 12, marginTop: 4 },
  grupo: { gap: 6 },
  grupoTitulo: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, minHeight: 34, justifyContent: 'center' },
  mas: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  preguntar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  note: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 2 },
});
