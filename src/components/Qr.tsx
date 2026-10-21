import qrcodeGenerator from 'qrcode-generator';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** Un código QR dibujado con SVG: oscuro sobre claro siempre, que es como lo leen las cámaras. */
export default function Qr({ value, size = 200, dark = '#1C1B19', light = '#FFFFFF' }: { value: string; size?: number; dark?: string; light?: string }) {
  const { n, d } = useMemo(() => {
    const qr = qrcodeGenerator(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { n: count + 4, d: path };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityLabel={`Código QR de ${value}`}>
      <Rect width={n} height={n} fill={light} />
      <Path d={d} fill={dark} />
    </Svg>
  );
}
