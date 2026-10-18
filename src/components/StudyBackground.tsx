import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import Appear from '@/components/Appear';
import {
  FUENTE_GENEALOGIA,
  Persona,
  Personas,
  descripcion,
  getPersonas,
  getPersonasCapitulo,
  personaHref,
} from '@/lib/genealogia';
import { Evento, FUENTE_HISTORIA, Periodo, REGION_COLORS, eventosDe, fechaEvento, fechaPeriodo, periodoDe } from '@/lib/historia';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = { book: string; bookName: string; chapter: number; verse?: number; onClose: () => void };

const MAX_PEOPLE = 10;

/** Trasfondo fijo del estudio (no lo genera la IA): qué pasaba en el mundo y las familias del pasaje. */
export default function StudyBackground({ book, bookName, chapter, verse, onClose }: Props) {
  const colors = useColors();
  const [open, setOpen] = useState<'mundo' | 'familias' | null>(null);
  const [people, setPeople] = useState<{ persona: Persona; verses: number[] }[]>([]);
  const [all, setAll] = useState<Personas | null>(null);
  const periodo = periodoDe(book, chapter);

  useEffect(() => {
    let live = true;
    setPeople([]);
    Promise.all([getPersonasCapitulo(book, chapter), getPersonas()])
      .then(([rows, map]) => {
        if (!live) return;
        const found = rows
          .map(([id, verses]) => ({ persona: map.get(id), verses }))
          .filter((r): r is { persona: Persona; verses: number[] } => !!r.persona);
        // En el estudio de un versículo, primero las personas de ese versículo
        const inVerse = verse ? found.filter((r) => r.verses.includes(verse)) : [];
        setPeople(inVerse.length ? [...inVerse, ...found.filter((r) => !inVerse.includes(r))] : found);
        setAll(map);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [book, chapter, verse]);

  const go = (href: string) => {
    onClose();
    navigate(() => router.push(href as never), 'forward');
  };
  const toggle = (k: 'mundo' | 'familias') => setOpen((o) => (o === k ? null : k));

  if (!periodo && !people.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {periodo && (
          <Chip
            on={open === 'mundo'}
            onPress={() => toggle('mundo')}
            colors={colors}
            label={periodo.sinFecha ? 'Las primeras civilizaciones' : `El mundo en ${fechaPeriodo(periodo)}`}
          />
        )}
        {!!people.length && (
          <Chip
            on={open === 'familias'}
            onPress={() => toggle('familias')}
            colors={colors}
            label={`Familias y genealogías (${people.length})`}
          />
        )}
      </View>

      {open === 'mundo' && periodo && (
        <Appear style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <World periodo={periodo} colors={colors} onRef={(r) => goRef(r, go)} />
          <Pressable onPress={() => go(`/historia?libro=${book}&cap=${chapter}`)} style={styles.more}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver la línea de tiempo completa ›</Text>
          </Pressable>
          <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_HISTORIA}</Text>
        </Appear>
      )}

      {open === 'familias' && all && (
        <Appear style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Families
            people={people}
            all={all}
            colors={colors}
            place={verse ? `${bookName} ${chapter}:${verse}` : `${bookName} ${chapter}`}
            onPerson={(p) => go(personaHref(p))}
          />
          <Pressable onPress={() => go('/genealogia')} style={styles.more}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Buscar a otra persona ›</Text>
          </Pressable>
          <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_GENEALOGIA}</Text>
        </Appear>
      )}
    </View>
  );
}

function goRef(ref: string, go: (href: string) => void) {
  const [b, c, v] = ref.split('.');
  go(verseHref(b, Number(c), Number(v) || 1));
}

function Chip({ label, on, onPress, colors }: { label: string; on: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ expanded: on }}
      style={[
        styles.chip,
        { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
      ]}
    >
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{on ? '▴' : '▾'}</Text>
    </Pressable>
  );
}

function World({ periodo, colors, onRef }: { periodo: Periodo; colors: Colors; onRef: (ref: string) => void }) {
  const eventos = useMemo(() => eventosDe(periodo), [periodo]);
  return (
    <View>
      <Text style={[styles.kicker, { color: colors.accent }]}>QUÉ PASABA EN EL MUNDO</Text>
      <Text style={[styles.title, { color: colors.text }]}>{periodo.titulo}</Text>
      {!periodo.sinFecha && <Text style={{ color: colors.muted }}>{fechaPeriodo(periodo)}</Text>}
      {!!periodo.nota && <Text style={[styles.note, { color: colors.muted }]}>{periodo.nota}</Text>}
      {!periodo.sinFecha && <MiniTimeline periodo={periodo} eventos={eventos} colors={colors} />}
      {eventos.map((e) => (
        <View key={e.titulo} style={styles.event}>
          <View style={[styles.dot, { backgroundColor: REGION_COLORS[e.region] }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              <Text style={{ color: REGION_COLORS[e.region], fontWeight: '700' }}>{e.region}</Text> · {fechaEvento(e)}
            </Text>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{e.titulo}</Text>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{e.texto}</Text>
            {e.ref && (
              <Pressable onPress={() => onRef(e.ref!)} hitSlop={6}>
                <Text style={{ color: colors.accent, fontSize: 13, marginTop: 2 }}>Ver el pasaje relacionado ›</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Banda del periodo bíblico y un punto por cada evento, a escala. */
function MiniTimeline({ periodo, eventos, colors }: { periodo: Periodo; eventos: Evento[]; colors: Colors }) {
  const [w, setW] = useState(0);
  // Ventana alrededor del periodo; los eventos largos (un imperio) se recortan a ella
  const margen = Math.max(25, (periodo.hasta - periodo.desde) * 0.4);
  const cerca = eventos.filter((e) => e.desde >= periodo.desde - margen * 4 && e.desde <= periodo.hasta + margen * 4);
  const min = Math.min(periodo.desde - margen, ...cerca.map((e) => e.desde));
  const max = Math.max(periodo.hasta + margen, ...cerca.map((e) => Math.min(e.hasta ?? e.desde, periodo.hasta + margen)));
  const span = Math.max(max - min, 10);
  const pad = 8;
  const clamp = (y: number) => Math.min(max, Math.max(min, y));
  const x = (y: number) => pad + ((clamp(y) - min) / span) * (w - pad * 2);
  return (
    <View style={{ marginTop: 12, marginBottom: 6 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={44}>
          <Line x1={pad} x2={w - pad} y1={30} y2={30} stroke={colors.border} strokeWidth={2} />
          <Rect
            x={x(periodo.desde) - 3}
            width={Math.max(6, x(periodo.hasta) - x(periodo.desde) + 6)}
            y={24}
            height={12}
            rx={6}
            fill={colors.accent}
            opacity={0.85}
          />
          {eventos
            .filter((e) => (e.hasta ?? e.desde) >= min && e.desde <= max)
            .map((e) =>
            e.hasta && x(e.hasta) - x(e.desde) > 6 ? (
              <Rect
                key={e.titulo}
                x={x(e.desde)}
                width={x(e.hasta!) - x(e.desde)}
                y={8}
                height={6}
                rx={3}
                fill={REGION_COLORS[e.region]}
                opacity={0.8}
              />
            ) : (
              <Circle key={e.titulo} cx={x(e.desde)} cy={11} r={4.5} fill={REGION_COLORS[e.region]} />
            ),
          )}
        </Svg>
      )}
      <View style={styles.axis}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{fechaEvento({ desde: min, region: 'Egipto', titulo: '', texto: '' })}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{fechaEvento({ desde: max, region: 'Egipto', titulo: '', texto: '' })}</Text>
      </View>
    </View>
  );
}

function Families({
  people,
  all,
  colors,
  place,
  onPerson,
}: {
  people: { persona: Persona; verses: number[] }[];
  all: Personas;
  colors: Colors;
  place: string;
  onPerson: (p: Persona) => void;
}) {
  const [allShown, setAllShown] = useState(false);
  const shown = allShown ? people : people.slice(0, MAX_PEOPLE);
  return (
    <View>
      <Text style={[styles.kicker, { color: colors.accent }]}>FAMILIAS Y GENEALOGÍAS</Text>
      <Text style={[styles.title, { color: colors.text }]}>Personas de {place}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>Toca una persona para ver su árbol familiar y su linaje.</Text>
      {shown.map(({ persona, verses }) => (
        <Pressable
          key={persona.id}
          onPress={() => onPerson(persona)}
          style={[styles.person, { borderColor: colors.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17 }}>{persona.nombre}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{descripcion(persona, all)}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {verses.length === 1 ? `v. ${verses[0]}` : `vv. ${verses.slice(0, 3).join(', ')}${verses.length > 3 ? '…' : ''}`} ›
          </Text>
        </Pressable>
      ))}
      {people.length > MAX_PEOPLE && !allShown && (
        <Pressable onPress={() => setAllShown(true)} style={{ paddingVertical: 10 }}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Ver las {people.length} personas</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginTop: 10 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 19, fontFamily: serif, fontWeight: '600', marginTop: 2 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  event: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  more: { paddingTop: 14 },
  source: { fontSize: 11, lineHeight: 16, marginTop: 10 },
});
