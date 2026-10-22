// La semana de la pareja como un cordón de tres dobleces (Eclesiastés 4:12): dos hilos, uno por cada uno, que se
// cruzan alrededor de un hilo firme en el centro. Cada cruce es un día del plan y se anuda cuando los dos
// respondieron. Nunca muestra quién respondió y quién no: solo lo que hicieron juntos.
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { DIAS_PLAN } from '@/lib/parejaPlanes';
import { Colors, serif } from '@/lib/theme';

type Props = {
  colors: Colors;
  /** Días (1 a 7) que los dos ya hicieron. */
  hechos: number[];
  /** El día que toca, para marcarlo; ninguno si terminaron. */
  hoy?: number;
  /** Sin días: solo el dibujo (la portada antes de unirse). */
  decorativa?: boolean;
  alto?: number;
};

export default function Trenza({ colors, hechos, hoy, decorativa, alto = 72 }: Props) {
  const [ancho, setAncho] = useState(0);
  const n = DIAS_PLAN;
  const medio = alto / 2;
  const paso = ancho / n;
  const amp = Math.min(alto * 0.3, 20);
  const r = Math.min(13, paso * 0.3);

  // Los dos hilos: senos opuestos que valen cero (se cruzan) en el centro de cada día.
  const hilo = (signo: 1 | -1) => {
    if (!ancho) return '';
    let d = '';
    for (let x = 0; x <= ancho; x += 3) {
      const y = medio + signo * amp * Math.sin((Math.PI * (x - paso / 2)) / paso);
      d += `${x === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };

  return (
    <View
      onLayout={(e) => setAncho(Math.round(e.nativeEvent.layout.width))}
      style={{ height: alto, width: '100%' }}
      accessibilityLabel={decorativa ? undefined : `${hechos.length} de ${n} días hechos juntos`}
    >
      {ancho > 0 && (
        <Svg width={ancho} height={alto}>
          <Path d={`M0 ${medio}H${ancho}`} stroke={colors.warm} strokeWidth={2.4} strokeLinecap="round" />
          <Path d={hilo(1)} stroke={colors.accent} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.85} />
          <Path d={hilo(-1)} stroke={colors.muted} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.7} />
          {!decorativa &&
            Array.from({ length: n }, (_, i) => {
              const dia = i + 1;
              const cx = paso * (i + 0.5);
              const hecho = hechos.includes(dia);
              const esHoy = dia === hoy;
              const encuentro = dia === n;
              const radio = encuentro ? r + 2 : r;
              return (
                <G key={dia}>
                  <Circle
                    cx={cx}
                    cy={medio}
                    r={radio}
                    fill={hecho ? colors.accent : colors.surface}
                    stroke={hecho ? colors.accent : esHoy ? colors.warm : colors.border}
                    strokeWidth={esHoy && !hecho ? 2.2 : 1.5}
                    strokeDasharray={esHoy && !hecho ? '3 2.5' : undefined}
                  />
                  {hecho ? (
                    <Path
                      d={`M${cx - radio * 0.38} ${medio + 0.5}l${radio * 0.26} ${radio * 0.28} ${radio * 0.5} -${radio * 0.56}`}
                      stroke={colors.surface}
                      strokeWidth={2.4}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <SvgText
                      x={cx}
                      y={medio + radio * 0.36}
                      fontSize={radio * 0.95}
                      fontFamily={serif}
                      fill={esHoy ? colors.warm : colors.muted}
                      textAnchor="middle"
                    >
                      {encuentro ? '♥' : String(dia)}
                    </SvgText>
                  )}
                </G>
              );
            })}
        </Svg>
      )}
    </View>
  );
}
