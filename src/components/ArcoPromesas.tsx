// El arco de las promesas: cada hilo es un arco que sale de su promesa y cae en su cumplimiento.
// Casi todos convergen en Cristo («todas las promesas de Dios son en él Sí», 2 Corintios 1:20).
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { CRISTO, FUTURO, HITOS, Hilo, Tema, TEMAS, arcos, posicion } from '@/lib/promesas';
import { Colors } from '@/lib/theme';

type Props = {
  hilos: Hilo[];
  colors: Colors;
  /** Tema elegido: sus arcos se destacan y los demás se apagan. */
  tema?: Tema;
  onHilo: (h: Hilo) => void;
  alto?: number;
};

const PIE = 40;
const IZQ = 10;
const DER = 14;

export default function ArcoPromesas({ hilos, colors, tema, onHilo, alto = 170 }: Props) {
  const [w, setW] = useState(0);
  const [encima, setEncima] = useState<string | undefined>();
  const lista = useMemo(() => arcos(hilos), [hilos]);
  const base = alto - PIE;
  const ancho = w - IZQ - DER;
  const x = (f: number) => IZQ + f * ancho;
  const xCristo = x(posicion(-5));
  const xCruz = x(CRISTO);

  // Los más largos detrás, para que los cortos (casi todos en la cruz) queden encima y se puedan tocar
  const orden = [...lista].sort((a, b) => b.hasta - b.desde - (a.hasta - a.desde));

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: alto }}>
      {w > 0 && (
        <Svg width={w} height={alto}>
          {/* La venida de Cristo: de Belén a la cruz */}
          <Rect x={xCristo - 3} y={10} width={xCruz - xCristo + 6} height={base - 10} rx={6} fill={colors.warmSoft} opacity={0.9} />
          <Line x1={IZQ} x2={w - DER} y1={base} y2={base} stroke={colors.border} strokeWidth={1.5} />
          {/* Lo que esperamos: más allá del siglo I, sin escala */}
          <Line
            x1={x(CRISTO + 0.06)}
            x2={w - DER}
            y1={base}
            y2={base}
            stroke={colors.muted}
            strokeWidth={1.5}
            strokeDasharray="2 4"
          />

          {orden.map(({ hilo, desde, hasta, futuro }) => {
            const x1 = x(desde);
            const x2 = x(hasta);
            const h = Math.min(base - 16, Math.max(14, (x2 - x1) * 0.62));
            const d = `M${x1},${base} C${x1},${base - h} ${x2},${base - h} ${x2},${base}`;
            const color = TEMAS[hilo.tema].color;
            const apagado = (tema && hilo.tema !== tema) || (encima && encima !== hilo.id);
            const resaltado = encima === hilo.id;
            const hover =
              Platform.OS === 'web'
                ? ({ onMouseEnter: () => setEncima(hilo.id), onMouseLeave: () => setEncima(undefined) } as object)
                : {};
            return (
              <G key={hilo.id} opacity={apagado ? 0.12 : 1}>
                <Path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={resaltado ? 2.6 : 1.5}
                  strokeOpacity={resaltado ? 1 : 0.7}
                  strokeDasharray={futuro ? '4 4' : undefined}
                />
                <Circle cx={x1} cy={base} r={2.6} fill={colors.surface} stroke={color} strokeWidth={1.4} />
                {!futuro && <Circle cx={x2} cy={base} r={2.4} fill={color} />}
                {/* Franja invisible más gruesa para poder tocar el arco */}
                <Path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  onPress={() => onHilo(hilo)}
                  {...hover}
                />
              </G>
            );
          })}

          {/* La cruz */}
          <Path
            d={`M${xCruz},${base - 22}v14M${xCruz - 4.5},${base - 17.5}h9`}
            stroke={colors.warm}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Lo que esperamos: una estrella al final del eje */}
          <Path
            d={estrella(x(FUTURO), base - 14, 6)}
            fill={colors.surface}
            stroke={TEMAS.esperanza.color}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />

          {HITOS.map(([nombre, año], i) => {
            const cx = x(posicion(año));
            return (
              <G key={nombre}>
                <Line x1={cx} x2={cx} y1={base + 2} y2={base + 6 + (i % 2) * 12} stroke={colors.border} strokeWidth={1} />
                <SvgText
                  x={cx < 30 ? cx - 4 : cx}
                  y={base + 16 + (i % 2) * 12}
                  fontSize={10}
                  fill={colors.muted}
                  textAnchor={cx < 30 ? 'start' : 'middle'}
                >
                  {nombre}
                </SvgText>
              </G>
            );
          })}
          <SvgText x={(xCristo + xCruz) / 2} y={base + 16} fontSize={10.5} fontWeight="700" fill={colors.warm} textAnchor="middle">
            Cristo
          </SvgText>
          <SvgText x={x(FUTURO)} y={base + 28} fontSize={10} fill={TEMAS.esperanza.color} textAnchor="end">
            Su venida
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

/** Estrella de cuatro puntas centrada en (cx, cy). */
function estrella(cx: number, cy: number, r: number) {
  const k = r * 0.32;
  return `M${cx},${cy - r}Q${cx + k},${cy - k} ${cx + r},${cy}Q${cx + k},${cy + k} ${cx},${cy + r}Q${cx - k},${cy + k} ${cx - r},${cy}Q${cx - k},${cy - k} ${cx},${cy - r}Z`;
}
