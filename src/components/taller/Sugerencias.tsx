import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Markdown } from '@/components/StudyPanel';
import { Source } from '@/lib/estudio';
import {
  Destino,
  Mensaje,
  Sugerencia,
  actualizarMensaje,
  agregarSugerencia,
  deshacerSugerencia,
  destinoSugerido,
  destinosDe,
  sugerenciasDe,
} from '@/lib/taller';
import { Colors } from '@/lib/theme';

type Hecho = { destino: string; previo: Record<string, string | undefined> };

const etiqueta = (d: Destino) => (d.id === 'idea' ? 'la idea central' : `«${d.label}»`);

/**
 * Una respuesta del modo Sugiéreme con un botón bajo cada idea para llevarla a un campo del mensaje. La IA no
 * escribe el mensaje: propone, y quien prepara elige qué le sirve y lo termina con sus palabras.
 */
export default function Sugerencias({
  text,
  sources,
  mensaje,
  colors,
  listo,
}: {
  text: string;
  sources: Source[];
  mensaje: Mensaje;
  colors: Colors;
  /** Mientras la respuesta llega no se ofrecen los botones. */
  listo: boolean;
}) {
  const [hechos, setHechos] = useState<Record<number, Hecho>>({});
  const [abierto, setAbierto] = useState<number | null>(null);
  const destinos = destinosDe(mensaje);
  const lines = text.split('\n');
  // Cada línea de lista con el título bajo el que vino.
  const titulos: string[] = [];
  lines.forEach((line, i) => titulos.push(line.match(/^#{1,3} (.+)/)?.[1] ?? titulos[i - 1] ?? ''));
  const ideas: (Sugerencia | undefined)[] = lines.map((line, i) =>
    /^#{1,3} /.test(line) ? undefined : sugerenciasDe(`## ${titulos[i]}\n${line}`, sources)[0],
  );
  const hayIdeas = ideas.some(Boolean);

  const rows = lines.map((line, i) => {
    if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
    const s = ideas[i];
    if (!s || !listo) return <Markdown key={i} text={line} colors={colors} />;

    const hecho = hechos[i];
    const sugerido = destinoSugerido(mensaje, s);
    const add = (destino: string) => {
      const r = agregarSugerencia(mensaje, destino, s);
      if (!r) return;
      actualizarMensaje(mensaje.id, r.cambio);
      setHechos((x) => ({ ...x, [i]: { destino, previo: r.previo } }));
      setAbierto(null);
    };
    const undo = () => {
      if (!hecho) return;
      actualizarMensaje(mensaje.id, deshacerSugerencia(mensaje, hecho.destino, hecho.previo));
      setHechos(({ [i]: _, ...rest }) => rest);
    };
    const d = (id?: string) => destinos.find((x) => x.id === id);
    const dSugerido = d(sugerido);

    return (
      <View key={i} style={styles.item}>
        <Markdown text={line} colors={colors} />
        <View style={styles.actions}>
          {hecho ? (
            <>
              <View style={[styles.done, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  ✓ En {d(hecho.destino) ? etiqueta(d(hecho.destino)!) : 'tu borrador'}
                </Text>
              </View>
              <Pressable onPress={undo} hitSlop={8} accessibilityRole="button" accessibilityLabel="Deshacer">
                <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Deshacer</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => (dSugerido ? add(dSugerido.id) : setAbierto(abierto === i ? null : i))}
                accessibilityRole="button"
                style={({ pressed }) => [styles.add, { borderColor: colors.accent, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  {dSugerido ? (dSugerido.id === 'idea' ? '＋ Usar como idea central' : `＋ Añadir a «${dSugerido.label}»`) : '＋ Añadir a…'}
                </Text>
              </Pressable>
              {dSugerido && (
                <Pressable onPress={() => setAbierto(abierto === i ? null : i)} hitSlop={8} accessibilityRole="button">
                  <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>{abierto === i ? 'Cerrar' : 'Otro campo'}</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
        {abierto === i && !hecho && (
          <View style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityLabel="Elegir campo">
            {(['Pasaje', 'Idea central', 'Bosquejo'] as const).map((grupo) => {
              const opciones = destinos.filter((x) => x.grupo === grupo && (x.id !== 'idea' || s.idea));
              if (!opciones.length) return null;
              return (
                <View key={grupo} style={{ marginBottom: 6 }}>
                  <Text style={[styles.group, { color: colors.muted }]}>{grupo.toUpperCase()}</Text>
                  <View style={styles.chips}>
                    {opciones.map((o) => (
                      <Pressable
                        key={o.id}
                        onPress={() => add(o.id)}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.chip,
                          { borderColor: o.id === sugerido ? colors.accent : colors.border, backgroundColor: pressed ? colors.accentSoft : 'transparent' },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={1}>
                          {o.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  });

  return (
    <View>
      {listo && hayIdeas && (
        <View style={[styles.tip, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>＋ </Text>
            Lleva a tu borrador las ideas que te sirvan y termínalas con tus palabras. Lo que ya escribiste no se borra.
          </Text>
        </View>
      )}
      {rows}
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  item: { marginBottom: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginLeft: 16, marginTop: -2 },
  add: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, maxWidth: '100%' },
  done: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '80%' },
  picker: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginLeft: 16, marginTop: 10 },
  group: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%' },
});
