import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import Appear from '@/components/Appear';
import { Avatar } from '@/components/Avatar';
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, GlobeIcon, TreeIcon } from '@/components/icons';
import { Book, formatRef, getBooks } from '@/lib/data';
import {
  FUENTE_GENEALOGIA,
  Persona,
  Personas,
  descripcion,
  getPersonas,
  getPersonasCapitulo,
  personaHref,
} from '@/lib/genealogia';
import {
  ERAS,
  Evento,
  FUENTE_HISTORIA,
  Periodo,
  REGION_COLORS,
  año,
  eventosDe,
  fechaEvento,
  fechaPeriodo,
  periodoDe,
} from '@/lib/historia';
import { PromesasDelPasaje } from '@/components/Promesas';
import { hilosEn } from '@/lib/promesas';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { studyKeep, useKept } from '@/lib/recordado';
import { navigate } from '@/lib/transition';

type Props = { book: string; bookName: string; chapter: number; verse?: number };
type Found = { persona: Persona; verses: number[] };

const MAX_PEOPLE = 8;

/** Trasfondo fijo del estudio (no lo genera la IA): qué pasaba en el mundo y las familias del pasaje. */
export default function StudyBackground({ book, bookName, chapter, verse }: Props) {
  const colors = useColors();
  // La sección abierta sigue abierta al volver de un enlace (src/lib/recordado.ts).
  const [open, setOpen] = useKept<'mundo' | 'familias' | null>(`${studyKeep(book, chapter, verse)}trasfondo`, null);
  const [people, setPeople] = useState<Found[]>([]);
  const [all, setAll] = useState<Personas | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const periodo = periodoDe(book, chapter);
  const eventos = useMemo(() => (periodo ? eventosDe(periodo) : []), [periodo]);
  // Promesas del versículo; si no hay, las del capítulo
  const promesas = useMemo(() => {
    const aqui = verse ? hilosEn(book, chapter, verse) : [];
    return aqui.length ? aqui : hilosEn(book, chapter);
  }, [book, chapter, verse]);

  useEffect(() => {
    let live = true;
    setPeople([]);
    Promise.all([getPersonasCapitulo(book, chapter), getPersonas()])
      .then(([rows, map]) => {
        if (!live) return;
        const found = rows
          .map(([id, verses]) => ({ persona: map.get(id), verses }))
          .filter((r): r is Found => !!r.persona);
        // En el estudio de un versículo, primero las personas de ese versículo
        const inVerse = verse ? found.filter((r) => r.verses.includes(verse)) : [];
        setPeople(inVerse.length ? [...inVerse, ...found.filter((r) => !inVerse.includes(r))] : found);
        setAll(map);
      })
      .catch(() => {});
    getBooks().then(setBooks, () => {});
    return () => {
      live = false;
    };
  }, [book, chapter, verse]);

  // El estudio no se cierra: se oculta y vuelve al regresar.
  const go = (href: string) => {
    navigate(() => router.push(href as never), 'forward');
  };
  const goRef = (ref: string) => {
    const [b, c, v] = ref.split('.');
    go(verseHref(b, Number(c), Number(v) || 1));
  };
  const toggle = (k: 'mundo' | 'familias') => setOpen((o) => (o === k ? null : k));
  const refLabel = (ref: string) => (books.length ? formatRef(ref, books) : ref);

  if (!periodo && !people.length && !promesas.length) return null;
  const regiones = [...new Set(eventos.map((e) => e.region))];

  return (
    <View style={styles.wrap}>
      <View style={styles.cards}>
        {periodo && (
          <EntryCard
            on={open === 'mundo'}
            onPress={() => toggle('mundo')}
            colors={colors}
            icon={<GlobeIcon color={colors.accent} />}
            kicker="EL MUNDO"
            title={periodo.sinFecha ? 'Antes de las fechas' : fechaPeriodo(periodo)}
            subtitle={regiones.slice(0, 3).join(' · ')}
            footer={
              <View style={styles.dots}>
                {regiones.map((r) => (
                  <View key={r} style={[styles.miniDot, { backgroundColor: REGION_COLORS[r] }]} />
                ))}
              </View>
            }
          />
        )}
        {!!people.length && (
          <EntryCard
            on={open === 'familias'}
            onPress={() => toggle('familias')}
            colors={colors}
            icon={<TreeIcon color={colors.accent} />}
            kicker="FAMILIAS"
            title={people.length === 1 ? '1 persona' : `${people.length} personas`}
            subtitle={people
              .slice(0, 3)
              .map((p) => p.persona.nombre)
              .join(', ')}
            footer={
              <View style={styles.faces}>
                {people.slice(0, 5).map((p, i) => (
                  <View key={p.persona.id} style={[styles.face, { marginLeft: i ? -8 : 0, borderColor: colors.surface }]}>
                    <Avatar persona={p.persona} colors={colors} size={22} />
                  </View>
                ))}
              </View>
            }
          />
        )}
      </View>

      {promesas.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <PromesasDelPasaje encontrados={promesas.slice(0, 4)} books={books} colors={colors} />
        </View>
      )}

      {open === 'mundo' && periodo && (
        <Appear style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <World periodo={periodo} eventos={eventos} colors={colors} onRef={goRef} refLabel={refLabel} />
          <Pressable
            onPress={() => go(`/historia?libro=${book}&cap=${chapter}`)}
            style={({ pressed }) => [styles.button, { borderColor: colors.accent }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver la línea de tiempo completa</Text>
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
          <Pressable
            onPress={() => go('/genealogia')}
            style={({ pressed }) => [styles.button, { borderColor: colors.accent }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Buscar a otra persona</Text>
          </Pressable>
          <Text style={[styles.source, { color: colors.muted }]}>{FUENTE_GENEALOGIA}</Text>
        </Appear>
      )}
    </View>
  );
}

function EntryCard({
  on,
  onPress,
  colors,
  icon,
  kicker,
  title,
  subtitle,
  footer,
}: {
  on: boolean;
  onPress: () => void;
  colors: Colors;
  icon: ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
  footer: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: on }}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: on ? colors.accent : colors.border,
          backgroundColor: on ? colors.accentSoft : colors.surface,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={styles.cardHead}>
        <View style={[styles.iconWrap, { backgroundColor: on ? colors.surface : colors.accentSoft }]}>{icon}</View>
        {on ? <ChevronUpIcon color={colors.muted} size={18} /> : <ChevronDownIcon color={colors.muted} size={18} />}
      </View>
      <Text style={[styles.kicker, { color: colors.accent }]}>{kicker}</Text>
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
        {subtitle}
      </Text>
      <View style={{ marginTop: 8 }}>{footer}</View>
    </Pressable>
  );
}

function World({
  periodo,
  eventos,
  colors,
  onRef,
  refLabel,
}: {
  periodo: Periodo;
  eventos: Evento[];
  colors: Colors;
  onRef: (ref: string) => void;
  refLabel: (ref: string) => string;
}) {
  const era = periodo.sinFecha ? ERAS[0] : ERAS.find((e) => periodo.desde >= e.desde && periodo.desde < e.hasta);
  return (
    <View>
      <Text style={[styles.kicker, { color: colors.accent }]}>QUÉ PASABA EN EL MUNDO</Text>
      <Text style={[styles.title, { color: colors.text }]}>{periodo.titulo}</Text>
      <View style={styles.pills}>
        {!periodo.sinFecha && (
          <View style={[styles.pill, { backgroundColor: colors.accent }]}>
            <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '700' }}>{fechaPeriodo(periodo)}</Text>
          </View>
        )}
        {era && (
          <View style={[styles.pill, { backgroundColor: `${era.color}22` }]}>
            <Text style={{ color: colors.text, fontSize: 12 }}>{era.titulo}</Text>
          </View>
        )}
      </View>
      {!!periodo.nota && <Text style={[styles.note, { color: colors.muted }]}>{periodo.nota}</Text>}
      {!periodo.sinFecha && <Timeline periodo={periodo} eventos={eventos} colors={colors} />}
      {eventos.map((e, i) => {
        const color = REGION_COLORS[e.region];
        return (
          <View key={e.titulo} style={[styles.event, { borderColor: colors.border }]}>
            <View style={[styles.num, { backgroundColor: color }]}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, letterSpacing: 0.6 }}>
                <Text style={{ color, fontWeight: '700' }}>{e.region.toUpperCase()}</Text>
                <Text style={{ color: colors.muted }}> · {fechaEvento(e)}</Text>
              </Text>
              <Text style={[styles.eventTitle, { color: colors.text }]}>{e.titulo}</Text>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, opacity: 0.85 }}>{e.texto}</Text>
              {e.ref && (
                <Pressable
                  onPress={() => onRef(e.ref!)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.refPill, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{refLabel(e.ref)} ›</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Año «redondo» para las marcas del eje: cada 10, 25, 50, 100… años. */
function ticks(min: number, max: number) {
  const step = [5, 10, 25, 50, 100, 250, 500, 1000].find((s) => (max - min) / s <= 4) ?? 1000;
  const out: number[] = [];
  for (let y = Math.ceil(min / step) * step; y <= max; y += step) out.push(y);
  return out;
}

/** Línea de tiempo a escala: la franja del periodo bíblico y un número por evento, como en la lista. */
function Timeline({ periodo, eventos, colors }: { periodo: Periodo; eventos: Evento[]; colors: Colors }) {
  const [w, setW] = useState(0);
  // Ventana alrededor del periodo; los eventos largos (un imperio) se recortan a ella
  const margen = Math.max(20, (periodo.hasta - periodo.desde) * 0.35);
  const lejos = margen * 5;
  const near = eventos.filter((e) => e.desde >= periodo.desde - lejos && e.desde <= periodo.hasta + lejos);
  const min = Math.min(periodo.desde - margen, ...near.map((e) => e.desde - 5));
  const max = Math.max(periodo.hasta + margen, ...near.map((e) => Math.min(e.hasta ?? e.desde, periodo.hasta + margen) + 5));
  const pad = 14;
  const x = (y: number) => pad + ((Math.min(max, Math.max(min, y)) - min) / (max - min)) * (w - pad * 2);
  const AXIS = 64;

  // Los números que caerían encima de otro suben a una segunda fila
  const lanes: number[] = [];
  const markers = eventos.map((e, i) => {
    const cx = x(e.desde);
    let lane = 0;
    while (lanes[lane] != null && cx - lanes[lane] < 20) lane++;
    lanes[lane] = cx;
    return { e, i, cx, cy: AXIS - 18 - lane * 20 };
  });
  const top = Math.min(...markers.map((m) => m.cy), AXIS - 18) - 12;
  const height = AXIS + 24 - top;

  return (
    <View style={{ marginTop: 14, marginBottom: 4 }} onLayout={(ev) => setW(ev.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height} viewBox={`0 ${top} ${w} ${height}`}>
          {eventos.map(
            (e) =>
              e.hasta &&
              x(e.hasta) - x(e.desde) > 4 && (
                <Rect
                  key={`b-${e.titulo}`}
                  x={x(e.desde)}
                  width={x(e.hasta) - x(e.desde)}
                  y={AXIS + 7}
                  height={3}
                  rx={1.5}
                  fill={REGION_COLORS[e.region]}
                  opacity={0.55}
                />
              ),
          )}
          <Line x1={pad} x2={w - pad} y1={AXIS} y2={AXIS} stroke={colors.border} strokeWidth={2} />
          {ticks(min, max).filter((t) => x(t) > 30 && x(t) < w - 30).map((t) => (
            <SvgText key={t} x={x(t)} y={AXIS + 22} fontSize={10} fill={colors.muted} textAnchor="middle">
              {año(t === 0 ? 1 : t)}
            </SvgText>
          ))}
          <Rect
            x={x(periodo.desde) - 4}
            width={Math.max(8, x(periodo.hasta) - x(periodo.desde) + 8)}
            y={AXIS - 5}
            height={10}
            rx={5}
            fill={colors.accent}
          />
          {markers.map(({ e, i, cx, cy }) => (
            <Line key={`l-${i}`} x1={cx} x2={cx} y1={cy + 8} y2={AXIS - 1} stroke={REGION_COLORS[e.region]} strokeWidth={1} opacity={0.6} />
          ))}
          {markers.map(({ e, i, cx, cy }) => (
            <Circle key={`c-${i}`} cx={cx} cy={cy} r={9} fill={REGION_COLORS[e.region]} stroke={colors.surface} strokeWidth={2} />
          ))}
          {markers.map(({ i, cx, cy }) => (
            <SvgText key={`t-${i}`} x={cx} y={cy + 3.5} fontSize={10} fontWeight="700" fill="#fff" textAnchor="middle">
              {i + 1}
            </SvgText>
          ))}
        </Svg>
      )}
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
  people: Found[];
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
      <View style={{ marginTop: 8 }}>
        {shown.map(({ persona, verses }, i) => (
          <Pressable
            key={persona.id}
            onPress={() => onPerson(persona)}
            style={({ pressed }) => [
              styles.person,
              { borderColor: colors.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Avatar persona={persona} colors={colors} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17 }}>{persona.nombre}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                {descripcion(persona, all)}
              </Text>
            </View>
            <View style={[styles.versePill, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {verses.length === 1 ? `v. ${verses[0]}` : `${verses.length} vv.`}
              </Text>
            </View>
            <ChevronRightIcon color={colors.muted} size={18} />
          </Pressable>
        ))}
      </View>
      {people.length > MAX_PEOPLE && !allShown && (
        <Pressable onPress={() => setAllShown(true)} style={{ paddingVertical: 10 }}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Ver las {people.length} personas</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, marginBottom: 4 },
  cards: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 12, minWidth: 0 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: serif, fontSize: 17, fontWeight: '600', marginTop: 1 },
  dots: { flexDirection: 'row', gap: 4, height: 22, alignItems: 'center' },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  faces: { flexDirection: 'row', height: 22 },
  face: { borderWidth: 2, borderRadius: 13 },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, marginTop: 12 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  title: { fontSize: 21, fontFamily: serif, fontWeight: '600', marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  event: { flexDirection: 'row', gap: 12, paddingTop: 14, marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  num: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  eventTitle: { fontSize: 16, fontWeight: '700', marginTop: 2, marginBottom: 2 },
  refPill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  versePill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  button: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 10, alignItems: 'center', marginTop: 18 },
  source: { fontSize: 11, lineHeight: 16, marginTop: 12, textAlign: 'center' },
});
