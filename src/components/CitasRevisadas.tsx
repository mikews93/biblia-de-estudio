import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, ShieldIcon } from '@/components/icons';
import { getBooks, getChapter } from '@/lib/data';
import type { Source } from '@/lib/estudio';
import { licensedById } from '@/lib/licenciadas';
import { Colors, sans, serif, useSettings } from '@/lib/theme';
import { buscarCitas, esProblema, refDe, type Revision, revisarCitas } from '@/lib/verificarCitas';

const sigla = (v: string) => licensedById(v)?.abbr ?? v.toUpperCase();

/**
 * Debajo de una respuesta de la IA: sus citas revisadas con el texto de la Biblia. Si todas existen y dicen lo que
 * la IA dice que dicen, queda en una línea discreta; si alguna no, se abre sola y enseña lo que dice de verdad.
 */
export default function CitasRevisadas({
  text,
  sources,
  colors,
  onOpen,
}: {
  text: string;
  sources?: Source[];
  colors: Colors;
  onOpen?: (ref: string) => void;
}) {
  const { settings } = useSettings();
  const [revision, setRevision] = useState<Revision[] | null>(null);
  const [abierto, setAbierto] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const books = await getBooks();
      const citas = buscarCitas(text, books, sources);
      if (!citas.length) return [];
      const versiones = [...new Set([settings.version, 'rv1909'])];
      const nombre = (id: string) => books.find((b) => b.id === id)?.name ?? id;
      return revisarCitas(citas, getChapter, versiones, nombre);
    })()
      .catch(() => [])
      .then((r) => vivo && setRevision(r));
    return () => {
      vivo = false;
    };
  }, [text, sources, settings.version]);

  const problemas = useMemo(() => revision?.filter(esProblema) ?? [], [revision]);
  if (!revision?.length) return null;
  const conFrase = revision.filter((r) => r.cita.frase).length;
  const abiertoAhora = abierto ?? problemas.length > 0;
  const n = revision.length;

  const resumen = problemas.length
    ? `${problemas.length === 1 ? 'Una cita' : `${problemas.length} citas`} para mirar de ${n}`
    : n === 1
      ? 'Revisamos la cita con el texto de la Biblia'
      : `Revisamos las ${n} citas con el texto de la Biblia`;

  return (
    <View
      testID="citas-revisadas"
      style={[
        styles.box,
        { borderColor: problemas.length ? colors.accent : colors.border, backgroundColor: problemas.length ? colors.accentSoft : 'transparent' },
      ]}
    >
      <Pressable
        onPress={() => setAbierto(!abiertoAhora)}
        accessibilityRole="button"
        aria-expanded={abiertoAhora}
        style={({ pressed }) => [styles.head, pressed && { opacity: 0.7 }]}
      >
        <ShieldIcon color={problemas.length ? colors.accent : colors.muted} size={16} />
        <Text style={[styles.headText, { color: problemas.length ? colors.text : colors.muted }]}>{resumen}</Text>
        {abiertoAhora ? <ChevronUpIcon color={colors.muted} size={15} /> : <ChevronDownIcon color={colors.muted} size={15} />}
      </Pressable>
      {abiertoAhora && (
        <View style={styles.list}>
          {[...problemas, ...revision.filter((r) => !esProblema(r))].map((r, i) => (
            <Fila key={i} r={r} colors={colors} onOpen={onOpen} />
          ))}
          {!problemas.length && conFrase > 0 && (
            <Text style={[styles.note, { color: colors.muted }]}>
              Las palabras entre comillas están en el versículo que se cita.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function Fila({ r, colors, onOpen }: { r: Revision; colors: Colors; onOpen?: (ref: string) => void }) {
  const mal = esProblema(r);
  const ref =
    r.estado === 'otro-versiculo' ? refDe({ ...r.cita.pasaje, verse: r.verso, verseEnd: r.verso }) : r.estado === 'no-existe' ? null : refDe(r.cita.pasaje);
  let detalle: string;
  switch (r.estado) {
    case 'bien':
      detalle = `Dice eso en la ${sigla(r.version)}.`;
      break;
    case 'existe':
      detalle = 'El pasaje existe.';
      break;
    case 'no-existe':
      detalle = `Este pasaje no existe: ${r.detalle}`;
      break;
    case 'otro-versiculo':
      detalle = `Esas palabras están en el versículo ${r.verso}, no en el que se cita.`;
      break;
    case 'no-coincide':
      detalle = `El versículo no dice eso. En la ${sigla(r.version)} dice:`;
      break;
  }
  const cuerpo = (
    <>
      <View style={[styles.mark, { backgroundColor: mal ? colors.accent : colors.accentSoft }]}>
        {mal ? <Text style={[styles.bang, { color: colors.background }]}>!</Text> : <CheckIcon color={colors.accent} size={12} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.label, { color: colors.text }]}>{r.cita.texto}</Text>
        {!!r.cita.frase && mal && (
          <Text style={[styles.frase, { color: colors.muted }]} numberOfLines={3}>
            «{r.cita.frase}»
          </Text>
        )}
        <Text style={[styles.detail, { color: mal ? colors.text : colors.muted }]}>{detalle}</Text>
        {r.estado === 'no-coincide' && (
          <Text style={[styles.real, { color: colors.text }]} numberOfLines={4}>
            «{r.texto}»
          </Text>
        )}
      </View>
      {ref && onOpen && <ChevronRightIcon color={colors.muted} size={15} />}
    </>
  );
  if (!ref || !onOpen) return <View style={styles.row}>{cuerpo}</View>;
  return (
    <Pressable
      onPress={() => onOpen(ref)}
      accessibilityRole="link"
      accessibilityLabel={`${r.cita.texto}: leer en su capítulo`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      {cuerpo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, marginTop: 12, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  headText: { flex: 1, fontFamily: sans, fontSize: 13.5, fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingBottom: 10, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  bang: { fontFamily: sans, fontSize: 12, fontWeight: '800' },
  label: { fontFamily: sans, fontSize: 14, fontWeight: '700' },
  frase: { fontFamily: serif, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  detail: { fontFamily: sans, fontSize: 13, lineHeight: 18 },
  real: { fontFamily: serif, fontSize: 14.5, lineHeight: 21 },
  note: { fontFamily: sans, fontSize: 12, lineHeight: 17 },
});
