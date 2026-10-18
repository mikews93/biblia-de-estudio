import Svg, { Path, Rect } from 'react-native-svg';

/** Micrófono para dictar. */
export default function MicIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={3} width={6} height={11} rx={3} fill={color} />
      <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
