import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, ChevronRightIcon, ExternalIcon, ShieldIcon } from '@/components/icons';
import { getBooks, getChapter } from '@/lib/data';
import type { Source } from '@/lib/estudio';
import { licensedById } from '@/lib/licenciadas';
import { Colors, sans, serif, useSettings } from '@/lib/theme';
import {
  buscarCitas,
  esPasaje,
  esAviso,
  esProblema,
  mismoPasaje,
  pasajeDeFuente,
  refDe,
  type Revision,
  revisarCitas,
} from '@/lib/verificarCitas';

const sigla = (v: string) => licensedById(v)?.abbr ?? v.toUpperCase();

/** De varias revisiones de un mismo pasaje, la que más importa: un aviso antes que un «dice eso». */
const peso = (r: Revision) => (esProblema(r) ? 2 : r.estado === 'bien' ? 1 : 0);
const peor = (rs: Revision[]) => rs.reduce<Revision | undefined>((a, r) => (!a || peso(r) > peso(a) ? r : a), undefined);

/**
 * Las fuentes de una respuesta de la IA y, con `text`, la revisión de sus citas con el texto de la Biblia, en una
 * sola lista: cada pasaje lleva su marca (✓ o !) y lo que no cuadra se explica en su propia fila. Las citas escritas
 * en la respuesta que no son una fuente van al final. Sin `text` es solo la lista de fuentes.
 */
export default function Fuentes({
  sources = [],
  text,
  colors,
  onOpen,
}: {
  sources?: Source[];
  text?: string;
  colors: Colors;
  onOpen?: (ref: string) => void;
}) {
  const { settings } = useSettings();
  const [revision, setRevision] = useState<Revision[] | null>(null);
  const [pasajes, setPasajes] = useState<Set<number>>(new Set());

  useEffect(() => {
    let vivo = true;
    (async () => {
      const books = await getBooks();
      if (vivo) setPasajes(new Set(sources.filter((s) => esPasaje(s, books)).map((s) => s.n)));
      if (!text) return [];
      const citas = buscarCitas(text, books, sources);
      if (!citas.length) return [];
      const versiones = [...new Set([settings.version, 'rv1909'])];
      const nombre = (id: string) => books.find((b) => b.id === id)?.name ?? id;
      // Las comillas junto a una fuente ⟦n⟧ que no cuadran no se enseñan: lo citado puede ser otra cosa.
      return (await revisarCitas(citas, getChapter, versiones, nombre)).filter((r) => !esProblema(r) || esAviso(r));
    })()
      .catch(() => [])
      .then((r) => vivo && setRevision(r));
    return () => {
      vivo = false;
    };
  }, [text, sources, settings.version]);

  // Cada revisión va con su fuente (por número o por ser el mismo pasaje); las que no tienen fuente, aparte.
  const { porFuente, sueltas } = useMemo(() => {
    const porFuente = new Map<number, Revision[]>();
    const usadas = new Set<Revision>();
    for (const s of sources) {
      if (!pasajes.has(s.n) || !s.ref) continue;
      const p = pasajeDeFuente(s.ref);
      const suyas = (revision ?? []).filter((r) => r.cita.fuente === s.n || (p && mismoPasaje(r.cita.pasaje, p)));
      suyas.forEach((r) => usadas.add(r));
      if (suyas.length) porFuente.set(s.n, suyas);
    }
    const sueltas = (revision ?? []).filter((r) => !usadas.has(r));
    return { porFuente, sueltas: [...sueltas.filter(esProblema), ...sueltas.filter((r) => !esProblema(r))] };
  }, [sources, revision, pasajes]);

  if (!sources.length && !sueltas.length) return null;

  const todas = revision ?? [];
  const problemas = todas.filter(esProblema).length;
  const n = todas.length;
  const resumen = !n
    ? null
    : problemas
      ? `${problemas === 1 ? 'Una cita' : `${problemas} citas`} para mirar de ${n}`
      : n === 1
        ? 'Revisamos la cita con el texto de la Biblia'
        : `Revisamos las ${n} citas con el texto de la Biblia`;

  return (
    <View testID="fuentes" style={[styles.box, { borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.muted }]}>{sources.length ? 'FUENTES' : 'CITAS'}</Text>
      {resumen && (
        <View
          testID="citas-resumen"
          style={[styles.summary, problemas ? [styles.summaryMal, { backgroundColor: colors.warmSoft }] : null]}
          accessibilityRole="summary"
        >
          <ShieldIcon color={problemas ? colors.warm : colors.muted} size={15} />
          <Text style={[styles.summaryText, { color: problemas ? colors.text : colors.muted }]}>{resumen}</Text>
        </View>
      )}
      {sources.map((s) => (
        <Fila
          key={s.n}
          numero={String(s.n)}
          label={s.label}
          r={peor(porFuente.get(s.n) ?? [])}
          comentario={!pasajes.has(s.n) && !!s.nota}
          ref_={s.ref}
          url={s.url}
          colors={colors}
          onOpen={onOpen}
        />
      ))}
      {!!sueltas.length && (
        <>
          {!!sources.length && <Text style={[styles.sub, { color: colors.muted }]}>CITADAS EN EL TEXTO</Text>}
          {sueltas.map((r, i) => (
            <Fila key={`c${i}`} numero="·" label={r.cita.texto} r={r} ref_={refDe(r.cita.pasaje)} colors={colors} onOpen={onOpen} />
          ))}
        </>
      )}
    </View>
  );
}

function Fila({
  numero,
  label,
  r,
  comentario,
  ref_,
  url,
  colors,
  onOpen,
}: {
  numero: string;
  label: string;
  r?: Revision;
  comentario?: boolean;
  ref_?: string;
  url?: string;
  colors: Colors;
  onOpen?: (ref: string) => void;
}) {
  const mal = !!r && esProblema(r);
  // La que está en otro versículo abre ese versículo; la que no existe no abre nada.
  const ref =
    r?.estado === 'otro-versiculo'
      ? refDe({ ...r.cita.pasaje, verse: r.verso, verseEnd: r.verso })
      : r?.estado === 'no-existe'
        ? undefined
        : ref_;
  let detalle: string | null = null;
  switch (r?.estado) {
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
  const marca = !r ? null : mal ? (
    <View style={[styles.mark, { backgroundColor: colors.warm }]}>
      <Text style={[styles.bang, { color: colors.background }]}>!</Text>
    </View>
  ) : (
    <View style={[styles.mark, { backgroundColor: colors.accentSoft }]}>
      <CheckIcon color={colors.text} size={11} strokeWidth={2.4} />
    </View>
  );
  // Lo que está bien solo lleva la marca; quien no ve la pantalla lo oye en la etiqueta.
  const estado = !r ? '' : mal ? 'cita para mirar' : r.estado === 'bien' ? `dice eso en la ${sigla(r.version)}` : 'el pasaje existe';

  const cuerpo = (
    <>
      <Text style={[styles.number, { color: mal ? colors.warm : colors.muted }]}>{numero}</Text>
      <View style={styles.main}>
        <View style={styles.line}>
          <Text style={[styles.label, { color: colors.text }, mal && styles.labelMal]}>{label}</Text>
          {comentario && (
            <Text style={[styles.tag, { color: colors.muted, borderColor: colors.border }]}>comentario</Text>
          )}
        </View>
        {mal && !!r?.cita.frase && (
          <Text style={[styles.frase, { color: colors.muted }]} numberOfLines={3}>
            «{r.cita.frase}»
          </Text>
        )}
        {!!detalle && <Text style={[styles.detail, { color: mal ? colors.text : colors.muted }]}>{detalle}</Text>}
        {r?.estado === 'no-coincide' && (
          <Text style={[styles.real, { color: colors.text }]} numberOfLines={4}>
            «{r.texto}»
          </Text>
        )}
      </View>
      {marca}
      {ref && onOpen ? (
        <ChevronRightIcon color={colors.muted} size={15} />
      ) : !ref && url ? (
        <ExternalIcon color={colors.muted} size={14} />
      ) : (
        <View style={{ width: 15 }} />
      )}
    </>
  );
  const fila = [styles.row, mal && [styles.rowMal, { backgroundColor: colors.warmSoft }]];
  const accion = ref && onOpen ? () => onOpen(ref) : !ref && url ? () => Linking.openURL(url) : null;
  if (!accion) return <View style={fila}>{cuerpo}</View>;
  return (
    <Pressable
      onPress={accion}
      accessibilityRole="link"
      accessibilityLabel={ref ? `${label}${estado ? `, ${estado}` : ''}: leer en su capítulo` : `${label}: abrir la obra`}
      style={({ pressed }) => [fila, pressed && { opacity: 0.6 }]}
    >
      {cuerpo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12, gap: 2 },
  title: { fontFamily: sans, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  sub: { fontFamily: sans, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.1, marginTop: 12, marginBottom: 2 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingVertical: 6, marginBottom: 2 },
  summaryMal: { paddingVertical: 9, paddingHorizontal: 10, marginHorizontal: -10, marginBottom: 6 },
  summaryText: { flex: 1, fontFamily: sans, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderRadius: 12 },
  rowMal: { paddingHorizontal: 10, marginHorizontal: -10, marginVertical: 4 },
  number: { fontFamily: sans, fontWeight: '700', fontSize: 14, width: 20, textAlign: 'right', lineHeight: 21 },
  main: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  label: { fontFamily: sans, fontSize: 15, lineHeight: 21 },
  labelMal: { fontWeight: '700' },
  tag: {
    fontFamily: sans,
    fontSize: 10.5,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  mark: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bang: { fontFamily: sans, fontSize: 11.5, fontWeight: '800', lineHeight: 14 },
  frase: { fontFamily: serif, fontSize: 14.5, fontStyle: 'italic', lineHeight: 21 },
  detail: { fontFamily: sans, fontSize: 13, lineHeight: 18 },
  real: { fontFamily: serif, fontSize: 15, lineHeight: 22 },
});
