// Toda la Biblia conectada: el fondo con los 141 001 arcos (una imagen pintada en pipeline/arcos_imagen.mjs) y, encima,
// los arcos del libro o capítulo elegido. Debajo, la fila de los 66 libros: se toca o se desliza el dedo para elegir uno.
import { memo, useCallback, useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { type Arco, ESPECTRO, libroEn, semicirculo } from '@/lib/conexiones';
import { Colors } from '@/lib/theme';

const FONDO = { claro: require('../../assets/arcos/claro.webp'), oscuro: require('../../assets/arcos/oscuro.webp') };

type Props = {
  books: { id: string; name: string; abbr: string; chapters: number }[];
  inicio: number[];
  total: number;
  colors: Colors;
  oscuro: boolean;
  /** Arcos del libro o capítulo elegido, que se dibujan encima en ámbar. */
  arcos: Arco[];
  libro?: number;
  /** Capítulo elegido, contado desde 0 en toda la Biblia. */
  capitulo?: number;
  onLibro: (libro: number) => void;
};

const BARRA = 10;
const ETIQUETAS = 26;

export default function ArcosBiblia({ books, inicio, total, colors, oscuro, arcos, libro, capitulo, onLibro }: Props) {
  const [w, setW] = useState(0);
  const [previa, setPrevia] = useState<number | undefined>();
  const base = Math.round(w / 2);
  const alto = base + 4 + BARRA + ETIQUETAS;
  const x = useCallback((i: number) => ((i + 0.5) / total) * w, [total, w]);
  const elegido = libro != null;

  const bajo = (lx: number) => libroEn(inicio, total, lx / Math.max(1, w));
  const hover =
    Platform.OS === 'web'
      ? ({
          onPointerMove: (e: { nativeEvent: { offsetX?: number } }) =>
            e.nativeEvent.offsetX != null && setPrevia(bajo(e.nativeEvent.offsetX)),
          onPointerLeave: () => setPrevia(undefined),
        } as object)
      : {};
  const mostrado = previa ?? libro;
  const nt = books.findIndex((b) => b.id === 'mat');
  const xNT = nt > 0 ? (inicio[nt] / total) * w : w;

  return (
    <View
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      style={{ height: w ? alto : 200, cursor: 'pointer' } as object}
      accessibilityLabel="Arcos de las referencias cruzadas de toda la Biblia. Toca la fila de libros para elegir uno."
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => setPrevia(bajo(e.nativeEvent.locationX))}
      onResponderMove={(e) => setPrevia(bajo(e.nativeEvent.locationX))}
      onResponderRelease={(e) => {
        setPrevia(undefined);
        onLibro(bajo(e.nativeEvent.locationX));
      }}
      onResponderTerminate={() => setPrevia(undefined)}
      {...hover}
    >
      {w > 0 && (
        <>
          <Image
            source={oscuro ? FONDO.oscuro : FONDO.claro}
            style={{ position: 'absolute', left: 0, top: 0, width: w, height: base, opacity: elegido ? 0.14 : 1 }}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
          />
          <Svg width={w} height={alto} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Resaltados arcos={arcos} x={x} base={base} color={colors.warm} />
            {capitulo != null && (
              <Line x1={x(capitulo)} x2={x(capitulo)} y1={base - 6} y2={base + 4 + BARRA} stroke={colors.text} strokeWidth={1.6} />
            )}
            {books.map((b, i) => {
              const x1 = (inicio[i] / total) * w;
              const x2 = ((inicio[i] + b.chapters) / total) * w;
              const on = i === libro;
              const fill = on ? colors.warm : i === previa ? colors.text : colors.muted;
              const opacity = on || i === previa ? 1 : i % 2 ? 0.28 : 0.5;
              return <Rect key={b.id} x={x1} y={base + 4} width={Math.max(0.6, x2 - x1 - 0.5)} height={BARRA} rx={1.5} fill={fill} opacity={opacity} />;
            })}
            {/* Del Antiguo al Nuevo Testamento */}
            {nt > 0 && (
              <Line
                x1={(inicio[nt] / total) * w}
                x2={(inicio[nt] / total) * w}
                y1={base + 4 + BARRA + 3}
                y2={base + 4 + BARRA + 17}
                stroke={colors.border}
                strokeWidth={1}
              />
            )}
          </Svg>
          {mostrado == null ? (
            <View style={[styles.etiquetas, { top: base + 7 + BARRA }]} pointerEvents="none">
              <Text style={[styles.etiqueta, { color: colors.muted, width: xNT }]} numberOfLines={1}>
                Antiguo Testamento
              </Text>
              <Text style={[styles.etiqueta, { color: colors.muted, width: w - xNT }]} numberOfLines={1}>
                {w - xNT > 110 ? 'Nuevo Testamento' : 'Nuevo'}
              </Text>
            </View>
          ) : (
            <View
              pointerEvents="none"
              style={[
                styles.globo,
                {
                  backgroundColor: previa != null ? colors.text : colors.warm,
                  top: base + 6 + BARRA,
                  left: Math.max(0, Math.min(w - 128, ((inicio[mostrado] + books[mostrado].chapters / 2) / total) * w - 64)),
                },
              ]}
            >
              <Text style={[styles.globoTexto, { color: colors.background }]} numberOfLines={1}>
                {books[mostrado].name}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

/** Los arcos del libro o capítulo elegido en tres trazos (pocas, muchas y muchísimas conexiones): pocos nodos en el teléfono. */
const Resaltados = memo(function Resaltados({ arcos, x, base, color }: { arcos: Arco[]; x: (i: number) => number; base: number; color: string }) {
  // En una pantalla angosta no caben miles de arcos distintos: se quedan los más fuertes, algo más de uno por píxel de alto
  const visibles = useMemo(() => {
    const max = Math.round(base * 1.4);
    return arcos.length <= max ? arcos : [...arcos].sort((p, q) => q.n - p.n).slice(0, max);
  }, [arcos, base]);
  const trazos = useMemo(() => {
    const d = ['', '', ''];
    for (const { a, b, n } of visibles) d[n >= 6 ? 2 : n >= 2 ? 1 : 0] += semicirculo(x(a), x(b), base);
    return d;
  }, [visibles, x, base]);
  // Un libro entero trae cientos de arcos: más tenues, para que se sigan viendo uno por uno
  const k = visibles.length > 600 ? 0.32 : visibles.length > 250 ? 0.55 : 1;
  return (
    <G>
      <Path d={trazos[0]} fill="none" stroke={color} strokeWidth={0.8} strokeOpacity={0.3 * k} />
      <Path d={trazos[1]} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.55 * k} />
      <Path d={trazos[2]} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={Math.min(1, 0.95 * k + 0.1)} />
    </G>
  );
});

/** Cerca ←→ lejos: los colores del fondo según cuánto cruza cada arco. */
export function LeyendaDistancia({ colors, oscuro }: { colors: Colors; oscuro: boolean }) {
  const stops = oscuro ? ESPECTRO.oscuro : ESPECTRO.claro;
  return (
    <View style={styles.leyenda}>
      <Text style={[styles.leyendaTexto, { color: colors.muted }]}>Cerca</Text>
      <Svg width={96} height={6}>
        <Defs>
          <LinearGradient id="espectro" x1="0" x2="1" y1="0" y2="0">
            {stops.map((c, i) => (
              <Stop key={i} offset={i / (stops.length - 1)} stopColor={`rgb(${c.join(',')})`} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={96} height={6} rx={3} fill="url(#espectro)" />
      </Svg>
      <Text style={[styles.leyendaTexto, { color: colors.muted }]}>Lejos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  etiquetas: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  etiqueta: { fontSize: 10.5, letterSpacing: 0.3, textAlign: 'center' },
  globo: { position: 'absolute', width: 128, alignItems: 'center', borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  globoTexto: { fontSize: 12, fontWeight: '700' },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leyendaTexto: { fontSize: 11 },
});
