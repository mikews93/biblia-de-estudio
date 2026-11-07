import {useCurrentFrame} from 'remotion';
import {ease, progress} from '../motion';
import {c, fonts} from '../theme';

type Props = {
  text: string;
  /** Words to land in the accent colour; they also land LAST, on the beat. */
  accent?: string[];
  start?: number;
  size: number;
  color?: string;
  /** Frame at which the line leaves (exit is faster than entry). */
  exitAt?: number;
  align?: 'left' | 'center';
  maxWidth?: number;
};

/** Each word rises out of its own line mask; 3 frames apart (~100 ms). */
export const KineticText = ({text, accent = [], start = 0, size, color = c.ink, exitAt, align = 'left', maxWidth}: Props) => {
  const f = useCurrentFrame();
  const words = text.split(' ');
  const isAccent = (w: string) => accent.some((a) => w.toLowerCase().startsWith(a.toLowerCase()));
  const plain = words.filter((w) => !isAccent(w)).length;
  let plainIdx = 0;
  let accentIdx = 0;
  const out = exitAt === undefined ? 0 : progress(f, exitAt, 10, ease.exitIn);
  return (
    <div
      style={{
        fontFamily: fonts.display,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: -size * 0.02,
        color,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: size * 0.26,
        maxWidth,
      }}
    >
      {words.map((w, i) => {
        const order = isAccent(w) ? plain + 2 + accentIdx++ : plainIdx++;
        const t = progress(f, start + order * 3, 18, ease.expoOut);
        return (
          <span key={i} style={{overflow: 'hidden', display: 'inline-block', paddingBottom: size * 0.12, marginBottom: -size * 0.12}}>
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${(1 - t) * 110 + out * -110}%)`,
                color: isAccent(w) ? c.brandLight : undefined,
                fontStyle: isAccent(w) ? 'italic' : undefined,
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};
