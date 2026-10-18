import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Basemap, Place, getBasemap } from '@/lib/data';
import { Colors, isDark, sans } from '@/lib/theme';

const TYPES: Record<string, string> = {
  settlement: 'Ciudad o pueblo',
  region: 'Región',
  mountain: 'Monte',
  'mountain range': 'Cordillera',
  'mountain ridge': 'Sierra',
  hill: 'Colina',
  river: 'Río',
  valley: 'Valle',
  campsite: 'Campamento del éxodo',
  island: 'Isla',
  spring: 'Fuente',
  'body of water': 'Mar o lago',
  'natural area': 'Paraje',
  wadi: 'Arroyo',
  tree: 'Árbol',
  pool: 'Estanque',
  road: 'Camino',
  well: 'Pozo',
  field: 'Campo',
  garden: 'Huerto',
  ford: 'Vado',
  cliff: 'Peña',
  rock: 'Peña',
  'stone heap': 'Majano',
  fortification: 'Fortaleza',
  mine: 'Mina',
  promontory: 'Promontorio',
  canal: 'Canal',
  'mountain pass': 'Paso de montaña',
  forest: 'Bosque',
};

/** Qué tan segura es la ubicación, según cuántos especialistas coinciden (OpenBible.info). */
export function confidenceLabel(conf: number, alternatives: number) {
  if (conf >= 800) return 'Ubicación bien establecida';
  if (conf >= 500) return alternatives ? 'Ubicación probable; hay otras propuestas' : 'Ubicación probable';
  return alternatives ? 'Ubicación discutida: los especialistas proponen varios lugares' : 'Ubicación incierta';
}

type Props = {
  places: Place[];
  colors: Colors;
  /** Versículo cuyos lugares se destacan (los demás del capítulo quedan más tenues). */
  verse?: number;
  height?: number;
  onVerse?: (verse: number) => void;
};

type View2 = { lon: number; lat: number; span: number };

const MIN_SPAN = 1.2; // grados: suficiente para ver Jerusalén y sus alrededores

function fit(places: Place[]): View2 {
  const lons = places.map((p) => p.lon);
  const lats = places.map((p) => p.lat);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const cos = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const span = Math.max(MIN_SPAN, (x1 - x0) * cos * 1.7, (y1 - y0) * 1.8);
  // Un poco a la derecha: las etiquetas van a la derecha de cada punto
  return { lon: (x0 + x1) / 2 + (span * 0.08) / cos, lat: (y0 + y1) / 2, span };
}

/** Mapa de los lugares de un pasaje dibujado sobre costas, lagos y ríos (sin teselas: funciona sin conexión a otros servidores). */
export default function PlaceMap({ places, colors, verse, height = 280, onVerse }: Props) {
  const [base, setBase] = useState<Basemap | null>(null);
  const [width, setWidth] = useState(0);
  const focus = useMemo(() => {
    const inVerse = verse ? places.filter((p) => p.verses.includes(verse)) : [];
    return inVerse.length ? inVerse : places;
  }, [places, verse]);
  const [view, setView] = useState<View2 | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    getBasemap().then(setBase).catch(() => setBase({ bbox: [0, 0, 0, 0], land: [], water: [], rivers: [] }));
  }, []);
  useEffect(() => {
    if (focus.length) setView(fit(focus));
    setSelected(focus.length === 1 ? focus[0].id : null);
  }, [focus]);

  const dark = isDark(colors);
  const palette = {
    sea: dark ? '#17232C' : '#DCE7EE',
    land: dark ? '#26221D' : '#F6F1E7',
    coast: dark ? '#3E4A52' : '#B7C7D2',
    river: dark ? '#35556B' : '#8FB3CB',
  };

  // Proyección equirectangular corregida por la latitud del centro: suficiente a escala regional.
  const proj = useMemo(() => {
    if (!view || !width) return null;
    const cos = Math.cos((view.lat * Math.PI) / 180);
    const k = width / view.span;
    const spanLat = height / k;
    return {
      x: (lon: number) => (lon - view.lon) * cos * k + width / 2,
      y: (lat: number) => (view.lat - lat) * k + height / 2,
      lonRange: [view.lon - view.span / cos / 1.8, view.lon + view.span / cos / 1.8],
      latRange: [view.lat - spanLat / 1.8, view.lat + spanLat / 1.8],
    };
  }, [view, width, height]);

  const paths = useMemo(() => {
    if (!proj || !base) return null;
    const [lo0, lo1] = proj.lonRange;
    const [la0, la1] = proj.latRange;
    // Solo las figuras cuyo rectángulo toca la vista
    const visible = (pts: [number, number][]) => {
      let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
      for (const [x, y] of pts) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      return x1 >= lo0 && x0 <= lo1 && y1 >= la0 && y0 <= la1;
    };
    const d = (pts: [number, number][], close: boolean) =>
      pts.map(([x, y], i) => `${i ? 'L' : 'M'}${proj.x(x).toFixed(1)} ${proj.y(y).toFixed(1)}`).join('') + (close ? 'Z' : '');
    return {
      land: base.land.filter(visible).map((r) => d(r, true)).join(''),
      water: base.water.filter((w) => visible(w.points)).map((w) => d(w.points, true)).join(''),
      rivers: base.rivers.filter((r) => visible(r.points)).map((r) => d(r.points, false)).join(''),
    };
  }, [proj, base]);

  // Etiquetas sin solaparse: primero las del versículo y las mejor ubicadas.
  const labels = useMemo(() => {
    if (!proj) return new Set<string>();
    const shown = new Set<string>();
    const boxes: [number, number, number, number][] = [];
    // Los puntos también son obstáculos: una etiqueta no tapa otro lugar
    const dots = places.map((p) => [p.id, proj.x(p.lon), proj.y(p.lat)] as const);
    const order = [...places].sort(
      (a, b) => Number(focus.includes(b)) - Number(focus.includes(a)) || Number(b.id === selected) - Number(a.id === selected) || b.conf - a.conf,
    );
    for (const p of order) {
      const x = proj.x(p.lon) + 7;
      const y = proj.y(p.lat) - 7;
      const box: [number, number, number, number] = [x, y, x + p.name.length * 6.6, y + 14];
      if (box[2] > width || box[0] < 0 || y < 0 || box[3] > height) continue;
      if (box[2] > width - 48 && box[1] < 124) continue; // botones de zoom
      if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      if (dots.some(([id, dx, dy]) => id !== p.id && dx + 4 > box[0] && dx - 4 < box[2] && dy + 4 > box[1] && dy - 4 < box[3])) continue;
      boxes.push(box);
      shown.add(p.id);
    }
    return shown;
  }, [proj, places, focus, selected, width, height]);

  const zoom = (factor: number) => view && setView({ ...view, span: Math.min(60, Math.max(0.3, view.span * factor)) });
  const sel = places.find((p) => p.id === selected) ?? null;

  if (!places.length) return null;

  return (
    <View>
      <View
        style={[styles.frame, { height, borderColor: colors.border, backgroundColor: palette.sea }]}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        {!base || !proj || !paths ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: height / 2 - 10 }} />
        ) : (
          <Svg width={width} height={height}>
            <Rect x={0} y={0} width={width} height={height} fill={palette.sea} />
            <Path d={paths.land} fill={palette.land} stroke={palette.coast} strokeWidth={0.8} />
            <Path d={paths.water} fill={palette.sea} stroke={palette.coast} strokeWidth={0.8} />
            <Path d={paths.rivers} fill="none" stroke={palette.river} strokeWidth={1.4} />
            {sel?.alt.map((a, i) => (
              <G key={i}>
                <Line
                  x1={proj.x(sel.lon)}
                  y1={proj.y(sel.lat)}
                  x2={proj.x(a.lon)}
                  y2={proj.y(a.lat)}
                  stroke={colors.accent}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <Circle cx={proj.x(a.lon)} cy={proj.y(a.lat)} r={5} fill="none" stroke={colors.accent} strokeWidth={1.5} strokeDasharray="2 2" />
              </G>
            ))}
            {places.map((p) => {
              const strong = focus.includes(p);
              const on = p.id === selected;
              return (
                <G key={p.id} onPress={() => setSelected(on ? null : p.id)}>
                  <Circle cx={proj.x(p.lon)} cy={proj.y(p.lat)} r={14} fill="transparent" />
                  <Circle
                    cx={proj.x(p.lon)}
                    cy={proj.y(p.lat)}
                    r={on ? 6 : strong ? 4.5 : 3}
                    fill={strong || on ? colors.accent : colors.muted}
                    stroke={colors.surface}
                    strokeWidth={1.5}
                    opacity={strong || on ? 1 : 0.7}
                  />
                </G>
              );
            })}
            {/* Las etiquetas van después de todos los puntos para quedar encima. Dos capas: un contorno del color
                de la tierra y encima el texto, para que se lea sobre costas y ríos. */}
            {places
              .filter((p) => labels.has(p.id))
              .map((p) => {
                const strong = focus.includes(p) || p.id === selected;
                return [palette.land, strong ? colors.text : colors.muted].map((fill, layer) => (
                  <SvgText
                    key={`${p.id}-${layer}`}
                    x={proj.x(p.lon) + 7}
                    y={proj.y(p.lat) + 4}
                    fontSize={strong ? 12 : 11}
                    fontFamily={sans}
                    fontWeight={strong ? '700' : '400'}
                    fill={fill}
                    stroke={layer ? undefined : palette.land}
                    strokeWidth={layer ? 0 : 3}
                    onPress={() => setSelected(p.id === selected ? null : p.id)}
                  >
                    {p.name}
                  </SvgText>
                ));
              })}
          </Svg>
        )}
        <View style={styles.zoom}>
          {[
            ['+', 0.6, 'Acercar'],
            ['−', 1.6, 'Alejar'],
          ].map(([label, f, a]) => (
            <Pressable
              key={label as string}
              onPress={() => zoom(f as number)}
              style={[styles.zoomBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityLabel={a as string}
            >
              <Text style={{ color: colors.text, fontSize: 18, lineHeight: 20 }}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setView(fit(focus))}
            style={[styles.zoomBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="Volver a centrar"
          >
            <Text style={{ color: colors.text, fontSize: 14 }}>◎</Text>
          </Pressable>
        </View>
      </View>

      {sel ? (
        <View style={[styles.card, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.name, { color: colors.text }]}>{sel.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {TYPES[sel.type] ?? 'Lugar'} · {confidenceLabel(sel.conf, sel.alt.length)}
          </Text>
          {sel.alt.length > 0 && (
            <Text style={{ color: colors.text, fontSize: 13, marginTop: 6 }}>
              {sel.alt.length === 1 ? 'Otra propuesta aparece' : `Otras ${sel.alt.length} propuestas aparecen`} con un círculo
              punteado en el mapa.
            </Text>
          )}
          <View style={styles.verses}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Versículos:</Text>
            {sel.verses.map((v) => (
              <Pressable
                key={v}
                onPress={() => onVerse?.(v)}
                disabled={!onVerse}
                style={[styles.verseChip, { borderColor: v === verse ? colors.accent : colors.border }]}
              >
                <Text style={{ color: v === verse ? colors.accent : colors.text, fontSize: 13, fontWeight: '600' }}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <Text style={[styles.hint, { color: colors.muted }]}>Toca un punto para ver el lugar y dónde se menciona.</Text>
      )}
      <Text style={[styles.credit, { color: colors.muted }]}>
        Lugares: OpenBible.info Bible Geocoding Data (CC BY 4.0). Costas: Natural Earth. Ríos y lagos: © colaboradores de
        OpenStreetMap (ODbL).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  zoom: { position: 'absolute', right: 8, top: 8, gap: 6 },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: 10, padding: 12, marginTop: 10 },
  name: { fontSize: 17, fontWeight: '700' },
  verses: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  verseChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  hint: { fontSize: 13, marginTop: 10 },
  credit: { fontSize: 11, marginTop: 12 },
});
