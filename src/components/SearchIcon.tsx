import Svg, { Circle, Path } from 'react-native-svg';

/** Lupa. */
export default function SearchIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={2} />
      <Path d="M15.5 15.5 20 20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
