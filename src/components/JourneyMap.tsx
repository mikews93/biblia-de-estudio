import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, LayoutChangeEvent, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { ExpandIcon, LocateIcon } from '@/components/icons';
import { Basemap, Place, getBasemap } from '@/lib/data';
import { ResolvedStop } from '@/lib/recorridos';
import { Colors, isDark, sans } from '@/lib/theme';

type Pt = { lon: number; lat: number };
type Camera = { cx: number; cy: number; span: number };

type Props = {
  colors: Colors;
  height: number;
  /** Paradas del recorrido, en orden. Sin paradas, el mapa solo resalta los lugares del versículo. */
  stops?: ResolvedStop[];
  /** Última parada alcanzada (-1: aún no empieza). */
  current?: number;
  /** Lugares del capítulo: los del versículo que suena se destacan. */
  places?: Place[];
  highlighted?: string[];
  onStop?: (index: number) => void;
  onPlace?: (place: Place) => void;
  /** Mapa pequeño y quieto (la lista de recorridos). */
  still?: boolean;
};

const MIN_SPAN = 1.1;

/** Mapa que sigue la lectura: la cámara se desliza hasta la parada que suena y un marcador recorre el camino. */
export default function JourneyMap({ colors, height, stops = [], current = -1, places = [], highlighted = [], onStop, onPlace, still }: Props) {
  const [base, setBase] = useState<Basemap | null>(null);
  const [width, setWidth] = useState(0);
  const [follow, setFollow] = useState(true);
  const hlKey = highlighted.join();
  const dark = isDark(colors);
  const palette = {
    sea: dark ? '#162029' : '#DAE5EC',
    land: dark ? '#24211D' : '#F5F0E6',
    coast: dark ? '#3A464E' : '#B4C4CF',
    river: dark ? '#32536A' : '#8EB2CA',
    route: colors.warm,
  };

  useEffect(() => {
    getBasemap().then(setBase).catch(() => setBase({ bbox: [0, 0, 0, 0], land: [], water: [], rivers: [] }));
  }, []);

  // Proyección fija para todo el recorrido (x = lon·cos φ0, y = −lat): el fondo se calcula una vez y la cámara solo lo
  // traslada y escala. Así se puede animar en un teléfono sin volver a proyectar diez mil puntos en cada cuadro.
  const all: Pt[] = stops.length ? stops : places;
  const lat0 = all.length ? all.reduce((s, p) => s + p.lat, 0) / all.length : 32;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const X = (lon: number) => lon * cos;
  const Y = (lat: number) => -lat;

  const backdrop = useMemo(() => {
    if (!base || !all.length) return null;
    const pad = 14;
    const [lo0, lo1] = [Math.min(...all.map((p) => p.lon)) - pad, Math.max(...all.map((p) => p.lon)) + pad];
    const [la0, la1] = [Math.min(...all.map((p) => p.lat)) - pad, Math.max(...all.map((p) => p.lat)) + pad];
    const visible = (pts: [number, number][]) => pts.some(([x, y]) => x >= lo0 && x <= lo1 && y >= la0 && y <= la1);
    const d = (pts: [number, number][], close: boolean) =>
      pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(3)} ${Y(y).toFixed(3)}`).join('') + (close ? 'Z' : '');
    return {
      land: base.land.filter(visible).map((r) => d(r, true)).join(''),
      water: base.water.filter((w) => visible(w.points)).map((w) => d(w.points, true)).join(''),
      rivers: base.rivers.filter((r) => visible(r.points)).map((r) => d(r.points, false)).join(''),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, stops, places, cos]);

  // Lo que la cámara quiere mostrar: la parada actual con la anterior y la siguiente, o los lugares del versículo.
  const focus: Pt[] = useMemo(() => {
    if (still) return all;
    if (stops.length) {
      if (current < 0) return stops.slice(0, 2);
      return stops.slice(Math.max(0, current - 1), current + 2);
    }
    const hl = places.filter((p) => highlighted.includes(p.id));
    return hl.length ? hl : places;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, current, places, hlKey, still]);

  const fit = (pts: Pt[]): Camera | null => {
    if (!pts.length || !width) return null;
    const xs = pts.map((p) => X(p.lon));
    const ys = pts.map((p) => Y(p.lat));
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // Arriba queda la tarjeta con el nombre de la parada: el encuadre usa solo el espacio de debajo.
    const top = still ? 0 : Math.min(118, height * 0.28);
    const room = height - top - 12;
    const min = still ? 2 : stops.length ? MIN_SPAN : 2.6;
    const span = Math.max(min, (x1 - x0) * 1.4, (y1 - y0) * 1.4 * (width / room));
    const k = width / span;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - (top + room / 2 - height / 2) / k, span };
  };

  const target = useRef<Camera | null>(null);
  const [cam, setCam] = useState<Camera | null>(null);
  const [pos, setPos] = useState(Math.max(0, current));
  const posTarget = useRef(Math.max(0, current));
  const frame = useRef<number | null>(null);
  const camRef = useRef<Camera | null>(null);
  const posRef = useRef(Math.max(0, current));

  // Bucle de animación: solo corre mientras la cámara o el marcador no han llegado.
  const run = () => {
    if (frame.current !== null) return;
    const step = () => {
      let moving = false;
      const t = target.current;
      const c = camRef.current;
      if (t && c) {
        const next = {
          cx: c.cx + (t.cx - c.cx) * 0.12,
          cy: c.cy + (t.cy - c.cy) * 0.12,
          span: c.span * Math.pow(t.span / c.span, 0.12),
        };
        const done = Math.abs(t.cx - next.cx) < t.span / 2000 && Math.abs(t.cy - next.cy) < t.span / 2000 && Math.abs(t.span / next.span - 1) < 0.002;
        camRef.current = done ? t : next;
        moving ||= !done;
      }
      const p = posRef.current;
      const goal = posTarget.current;
      if (p !== goal) {
        const delta = goal - p;
        const next = Math.abs(delta) < 0.004 ? goal : p + Math.sign(delta) * Math.min(Math.abs(delta), Math.max(0.006, Math.abs(delta) * 0.06));
        posRef.current = next;
        moving ||= next !== goal;
      }
      setCam(camRef.current);
      setPos(posRef.current);
      frame.current = moving ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
  };
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  // Al llegar a otra parada: el marcador avanza solo el último tramo (si se saltó varias, aparece en la anterior).
  useEffect(() => {
    const goal = Math.max(0, current);
    if (Math.abs(goal - posRef.current) > 1.01) posRef.current = goal > posRef.current ? goal - 1 : goal;
    posTarget.current = goal;
    if (still) posRef.current = goal;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, still]);

  useEffect(() => {
    if (!follow) return;
    const f = fit(focus);
    if (!f) return;
    target.current = f;
    if (!camRef.current || still) {
      camRef.current = f;
      setCam(f);
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, follow, width, height]);

  const k = cam && width ? width / cam.span : 0;
  const sx = (lon: number) => (cam ? (X(lon) - cam.cx) * k + width / 2 : 0);
  const sy = (lat: number) => (cam ? (Y(lat) - cam.cy) * k + height / 2 : 0);

  // Arrastrar mueve el mapa y deja de seguir la lectura hasta que se toca «Seguir».
  const drag = useRef<{ cam: Camera; k: number } | null>(null);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => !still && Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          if (camRef.current && width) drag.current = { cam: camRef.current, k: width / camRef.current.span };
        },
        onPanResponderMove: (_, g) => {
          const d = drag.current;
          if (!d) return;
          setFollow(false);
          const next = { ...d.cam, cx: d.cam.cx - g.dx / d.k, cy: d.cam.cy - g.dy / d.k };
          camRef.current = next;
          target.current = next;
          setCam(next);
        },
        onPanResponderRelease: () => {
          drag.current = null;
        },
      }),
    [still, width],
  );

  const zoom = (factor: number) => {
    const c = camRef.current;
    if (!c) return;
    setFollow(false);
    target.current = { ...(target.current ?? c), span: Math.min(70, Math.max(0.25, (target.current ?? c).span * factor)) };
    run();
  };
  const showAll = () => {
    setFollow(false);
    target.current = fit(all);
    run();
  };

  // Curva suave entre dos paradas (no una recta): se lee como un camino y separa ida y vuelta por el mismo sitio.
  const curve = (a: Pt, b: Pt, bend = 1) => {
    const [x0, y0, x1, y1] = [sx(a.lon), sy(a.lat), sx(b.lon), sy(b.lat)];
    const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const f = 0.16 * bend;
    return { x0, y0, x1, y1, cx: mx - ((y1 - y0) / (len || 1)) * len * f, cy: my + ((x1 - x0) / (len || 1)) * len * f, len };
  };
  const at = (c: ReturnType<typeof curve>, t: number) => ({
    x: (1 - t) ** 2 * c.x0 + 2 * (1 - t) * t * c.cx + t * t * c.x1,
    y: (1 - t) ** 2 * c.y0 + 2 * (1 - t) * t * c.cy + t * t * c.y1,
  });
  const partial = (c: ReturnType<typeof curve>, t: number) => {
    const q = { x: c.x0 + (c.cx - c.x0) * t, y: c.y0 + (c.cy - c.y0) * t };
    const e = at(c, t);
    return `M${c.x0.toFixed(1)} ${c.y0.toFixed(1)}Q${q.x.toFixed(1)} ${q.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  };
  const full = (c: ReturnType<typeof curve>) =>
    `M${c.x0.toFixed(1)} ${c.y0.toFixed(1)}Q${c.cx.toFixed(1)} ${c.cy.toFixed(1)} ${c.x1.toFixed(1)} ${c.y1.toFixed(1)}`;

  const segments = stops.slice(1).map((b, i) => ({ c: curve(stops[i], b, i % 2 ? -1 : 1), sea: b.sea, to: i + 1 }));
  const whole = Math.floor(pos);
  const frac = pos - whole;
  const traveled = segments.filter((s) => s.to <= whole).map((s) => full(s.c)).join('');
  const going = segments.find((s) => s.to === whole + 1);
  const ahead = segments.filter((s) => s.to > whole + (frac > 0 ? 1 : 0)).map((s) => full(s.c)).join('');
  const marker = stops.length
    ? going && frac > 0
      ? { ...at(going.c, frac), sea: going.sea }
      : { x: sx(stops[whole]?.lon ?? 0), y: sy(stops[whole]?.lat ?? 0), sea: false }
    : null;

  // Etiquetas sin pisarse: primero la parada actual, luego las cercanas a ella.
  const labels = useMemo(() => {
    const shown = new Set<number | string>();
    if (!cam || !width) return shown;
    const boxes: [number, number, number, number][] = [];
    const place = (id: number | string, x: number, y: number, name: string, size: number) => {
      const box: [number, number, number, number] = [x + 8, y - 9, x + 10 + name.length * size * 0.58, y + 7];
      if (box[0] < 0 || box[2] > width - (still ? 0 : 50) || box[1] < (still ? 0 : 64) || box[3] > height - 4) return;
      if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return;
      boxes.push(box);
      shown.add(id);
    };
    if (stops.length) {
      const order = stops.map((_, i) => i).sort((a, b) => Math.abs(a - current) - Math.abs(b - current) || a - b);
      const seen = new Set<string>();
      for (const i of order) {
        const key = `${stops[i].lon},${stops[i].lat}`;
        if (seen.has(key) && i !== current) continue;
        seen.add(key);
        place(i, sx(stops[i].lon), sy(stops[i].lat), stops[i].name, i === current ? 13 : 11);
      }
    } else {
      const order = [...places].sort((a, b) => Number(highlighted.includes(b.id)) - Number(highlighted.includes(a.id)) || b.conf - a.conf);
      for (const p of order) place(p.id, sx(p.lon), sy(p.lat), p.name, highlighted.includes(p.id) ? 13 : 11);
    }
    return shown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam, width, height, stops, current, places, hlKey]);

  // Halo que late alrededor de la parada o el lugar que suena
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, still]);
  const halos: { x: number; y: number }[] = still
    ? []
    : stops.length
      ? marker && frac === 0 && current >= 0
        ? [marker]
        : []
      : places.filter((p) => highlighted.includes(p.id)).map((p) => ({ x: sx(p.lon), y: sy(p.lat) }));

  const ready = !!(backdrop && cam && width);
  const stroke = (px: number) => px / (k || 1);
  const textLayers = (key: string, x: number, y: number, label: string, strong: boolean, onPress?: () => void) =>
    [palette.land, strong ? colors.text : colors.muted].map((fill, layer) => (
      <SvgText
        key={`${key}-${layer}`}
        x={x + 9}
        y={y + 4}
        fontSize={strong ? 13 : 11}
        fontFamily={sans}
        fontWeight={strong ? '700' : '500'}
        fill={fill}
        stroke={layer ? undefined : palette.land}
        strokeWidth={layer ? 0 : 3.5}
        strokeLinejoin="round"
        onPress={onPress}
      >
        {label}
      </SvgText>
    ));

  return (
    <View
      style={[styles.frame, { height, backgroundColor: palette.sea, borderColor: colors.border }, still && styles.still]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
    >
      {!ready ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: height / 2 - 10 }} />
      ) : (
        <Svg width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill={palette.sea} />
          <G transform={`translate(${width / 2 - cam!.cx * k} ${height / 2 - cam!.cy * k}) scale(${k})`}>
            <Path d={backdrop!.land} fill={palette.land} stroke={palette.coast} strokeWidth={stroke(0.8)} />
            <Path d={backdrop!.water} fill={palette.sea} stroke={palette.coast} strokeWidth={stroke(0.8)} />
            <Path d={backdrop!.rivers} fill="none" stroke={palette.river} strokeWidth={stroke(1.3)} />
          </G>

          {stops.length > 0 && (
            <>
              <Path d={ahead} fill="none" stroke={colors.muted} strokeWidth={1.6} strokeDasharray="2 5" strokeLinecap="round" opacity={0.75} />
              {going && frac > 0 && (
                <Path d={full(going.c)} fill="none" stroke={colors.muted} strokeWidth={1.6} strokeDasharray="2 5" strokeLinecap="round" opacity={0.75} />
              )}
              <Path d={traveled} fill="none" stroke={palette.land} strokeWidth={still ? 4 : 6} strokeLinecap="round" opacity={0.9} />
              <Path d={traveled} fill="none" stroke={palette.route} strokeWidth={still ? 2.2 : 3} strokeLinecap="round" strokeLinejoin="round" />
              {going && frac > 0 && <Path d={partial(going.c, frac)} fill="none" stroke={palette.route} strokeWidth={3} strokeLinecap="round" />}
              {stops.map((st, i) => {
                const done = i <= whole;
                const on = i === current;
                // Paradas repetidas (Capernaum, el mar) se dibujan una vez: con la visita más avanzada
                const twin = stops.findIndex((o, j) => j !== i && Math.hypot(sx(o.lon) - sx(st.lon), sy(o.lat) - sy(st.lat)) < 4 && (j === current || (j <= whole) > done || ((j <= whole) === done && j > i && j !== current && i !== current)));
                if (twin >= 0 && !on) return null;
                return (
                  <G key={i} onPress={onStop ? () => onStop(i) : undefined}>
                    <Circle cx={sx(st.lon)} cy={sy(st.lat)} r={16} fill="transparent" />
                    <Circle
                      cx={sx(st.lon)}
                      cy={sy(st.lat)}
                      r={on ? 6.5 : still ? 2.6 : 4.2}
                      fill={done ? palette.route : colors.surface}
                      stroke={done ? colors.surface : colors.muted}
                      strokeWidth={done ? 1.6 : 1.4}
                    />
                  </G>
                );
              })}
              {!still &&
                stops.map((st, i) => (labels.has(i) ? textLayers(`s${i}`, sx(st.lon), sy(st.lat), st.name, i === current, onStop ? () => onStop(i) : undefined) : null))}
              {marker && !still && current >= 0 && (
                <G>
                  <Circle cx={marker.x} cy={marker.y} r={11} fill={palette.route} opacity={0.22} />
                  <Circle cx={marker.x} cy={marker.y} r={7.5} fill={palette.route} stroke={colors.surface} strokeWidth={2} />
                  {marker.sea ? (
                    // Una vela: el tramo va por mar
                    <Path d={`M${marker.x - 4} ${marker.y + 2}h8l-1.6 2.2h-4.8zM${marker.x} ${marker.y + 1.4}v-5.6l3.4 5.6z`} fill={colors.surface} />
                  ) : (
                    <Circle cx={marker.x} cy={marker.y} r={2.2} fill={colors.surface} />
                  )}
                </G>
              )}
            </>
          )}

          {!stops.length &&
            places.map((p) => {
              const on = highlighted.includes(p.id);
              return (
                <G key={p.id} onPress={onPlace ? () => onPlace(p) : undefined}>
                  <Circle cx={sx(p.lon)} cy={sy(p.lat)} r={16} fill="transparent" />
                  <Circle
                    cx={sx(p.lon)}
                    cy={sy(p.lat)}
                    r={on ? 6.5 : 3.4}
                    fill={on ? palette.route : colors.muted}
                    stroke={colors.surface}
                    strokeWidth={1.6}
                    opacity={on ? 1 : 0.65}
                  />
                </G>
              );
            })}
          {!stops.length &&
            places.map((p) => (labels.has(p.id) ? textLayers(p.id, sx(p.lon), sy(p.lat), p.name, highlighted.includes(p.id), onPlace ? () => onPlace(p) : undefined) : null))}
        </Svg>
      )}

      {ready &&
        halos.map((h, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.halo,
              {
                left: h.x - 22,
                top: h.y - 22,
                borderColor: palette.route,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
              },
            ]}
          />
        ))}

      {!still && (
        <View style={styles.controls}>
          {(
            [
              ['+', () => zoom(0.6), 'Acercar'],
              ['−', () => zoom(1.6), 'Alejar'],
            ] as const
          ).map(([label, press, a]) => (
            <Pressable
              key={label}
              onPress={press}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={a}
            >
              <Text style={{ color: colors.text, fontSize: 19, lineHeight: 21 }}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={showAll}
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={stops.length ? 'Ver todo el recorrido' : 'Ver todos los lugares'}
          >
            <ExpandIcon color={colors.text} size={17} />
          </Pressable>
        </View>
      )}
      {!still && !follow && (
        <Pressable
          onPress={() => setFollow(true)}
          style={({ pressed }) => [styles.follow, { backgroundColor: colors.accent }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Volver a seguir la lectura"
        >
          <LocateIcon color={colors.surface} size={16} />
          <Text style={[styles.followText, { color: colors.surface }]}>Seguir la lectura</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  still: { borderRadius: 12 },
  controls: { position: 'absolute', right: 10, top: 10, gap: 8 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  halo: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  follow: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  followText: { fontSize: 13, fontWeight: '700' },
});
