import { useMemo, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { MindMap, MindNode, versesLabel } from '@/lib/mapaMental';
import { Colors, isDark, sans, serif } from '@/lib/theme';

// Dibujo del mapa mental. En pantallas anchas, la idea central va en medio con las ramas a los dos
// lados; en el teléfono, arriba, con las ramas en columna y sus ideas a la derecha.
// El texto se parte en líneas a mano para que cada caja mida lo mismo en todas las plataformas.

const LIGHT = ['#8A4B2A', '#2F6B5E', '#46598A', '#8A6A1F', '#7A3E6B', '#3E6B8A'];
const DARK = ['#E0A07A', '#7CC4B2', '#9DB0E0', '#E0C070', '#D59AC4', '#8CC2E0'];

type Box = { x: number; y: number; w: number; h: number; lines: string[]; size: number; caption?: string };
type Placed = { root: Box; branches: { box: Box; side: 1 | -1; leaves: Box[] }[]; width: number; height: number };

const PAD_X = 10;
const PAD_Y = 8;
const GAP = 8;
const GROUP_GAP = 18;

function wrap(text: string, width: number, size: number): string[] {
  const max = Math.max(8, Math.floor((width - PAD_X * 2) / (size * 0.52)));
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + word).length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

function box(n: MindNode | string, w: number, size: number): Box {
  const text = typeof n === 'string' ? n : n.text;
  const caption = typeof n === 'string' ? undefined : versesLabel(n) || undefined;
  const lines = wrap(text, w, size);
  const h = PAD_Y * 2 + lines.length * size * 1.3 + (caption ? 15 : 0);
  return { x: 0, y: 0, w, h, lines, size, caption };
}

/** Coloca las ideas de cada rama una debajo de otra y centra la rama a su altura. Devuelve la altura usada. */
function stack(
  branches: MindMap['branches'],
  top: number,
  branchX: number,
  branchW: number,
  leafX: number,
  leafW: number,
  side: 1 | -1,
  out: Placed['branches'],
) {
  let y = top;
  for (const b of branches) {
    const bb = box(b, branchW, 14);
    const leaves = b.leaves.map((l) => box(l, leafW, 13));
    const leavesH = leaves.reduce((s, l) => s + l.h, 0) + GAP * Math.max(0, leaves.length - 1);
    const groupH = Math.max(bb.h, leavesH);
    let ly = y + (groupH - leavesH) / 2;
    for (const l of leaves) {
      l.x = leafX;
      l.y = ly;
      ly += l.h + GAP;
    }
    bb.x = branchX;
    bb.y = y + (groupH - bb.h) / 2;
    out.push({ box: bb, side, leaves });
    y += groupH + GROUP_GAP;
  }
  return y - top - (branches.length ? GROUP_GAP : 0);
}

function layout(map: MindMap, width: number): Placed {
  const out: Placed['branches'] = [];
  if (width >= 720) {
    const rootW = 190;
    const branchW = 150;
    const gapX = 34;
    const leafW = Math.min(250, (width - rootW) / 2 - branchW - gapX * 2);
    const half = Math.ceil(map.branches.length / 2);
    const cx = width / 2;
    const right: Placed['branches'] = [];
    const left: Placed['branches'] = [];
    const hr = stack(map.branches.slice(0, half), 0, cx + rootW / 2 + gapX, branchW, cx + rootW / 2 + gapX * 2 + branchW, leafW, 1, right);
    const hl = stack(map.branches.slice(half), 0, cx - rootW / 2 - gapX - branchW, branchW, cx - rootW / 2 - gapX * 2 - branchW - leafW, leafW, -1, left);
    const root = box(map.title, rootW, 17);
    const height = Math.max(hr, hl, root.h);
    // Cada lado se centra en la altura total
    for (const [side, h] of [[right, hr], [left, hl]] as const) {
      const dy = (height - h) / 2;
      for (const b of side) {
        b.box.y += dy;
        b.leaves.forEach((l) => (l.y += dy));
      }
    }
    root.x = cx - rootW / 2;
    root.y = (height - root.h) / 2;
    return { root, branches: [...right, ...left], width, height };
  }
  const rootW = Math.min(width, 340);
  const root = box(map.title, rootW, 17);
  root.x = (width - rootW) / 2;
  const trunk = 16;
  const branchW = Math.round((width - trunk) * 0.38);
  const gapX = 22;
  const top = root.h + 24;
  const h = stack(map.branches, top, trunk, branchW, trunk + branchW + gapX, width - trunk - branchW - gapX, 1, out);
  return { root, branches: out, width, height: top + h };
}

/** Curva suave entre dos puntos, horizontal en los extremos. */
const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
};

type Props = { map: MindMap; colors: Colors; onVerse: (verse: number) => void };

export default function MindMapView({ map, colors, onVerse }: Props) {
  const [width, setWidth] = useState(0);
  const placed = useMemo(() => (width ? layout(map, width) : null), [map, width]);
  const palette = isDark(colors) ? DARK : LIGHT;

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  if (!placed) return <View onLayout={onLayout} style={{ width: '100%', minHeight: 200 }} />;

  const narrow = width < 720;
  const { root } = placed;
  const lastBranch = placed.branches[placed.branches.length - 1]?.box;

  const label = (b: Box, color: string, bold: boolean, family = sans) => (
    <>
      {b.lines.map((line, i) => (
        <SvgText
          key={i}
          x={b.x + PAD_X}
          y={b.y + PAD_Y + b.size * (1.3 * i + 1)}
          fontSize={b.size}
          fontWeight={bold ? '700' : '400'}
          fontFamily={family}
          fill={color}
        >
          {line}
        </SvgText>
      ))}
      {b.caption && (
        <SvgText x={b.x + PAD_X} y={b.y + b.h - PAD_Y - 2} fontSize={11} fontFamily={sans} fill={bold ? color : colors.muted} opacity={0.85}>
          {b.caption}
        </SvgText>
      )}
    </>
  );

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      <Svg width={width} height={placed.height + 4}>
        {/* Uniones: de la idea central a cada rama y de cada rama a sus ideas */}
        {narrow && lastBranch && (
          <Path
            d={`M${root.x + root.w / 2},${root.y + root.h} L${root.x + root.w / 2},${root.y + root.h + 12} L6,${root.y + root.h + 12} L6,${lastBranch.y + lastBranch.h / 2}`}
            stroke={colors.border}
            strokeWidth={2}
            fill="none"
          />
        )}
        {placed.branches.map(({ box: b, side, leaves }, i) => {
          const color = palette[i % palette.length];
          const bx = side === 1 ? b.x + b.w : b.x;
          return (
            <G key={`l${i}`}>
              {narrow ? (
                <Path d={`M6,${b.y + b.h / 2} L${b.x},${b.y + b.h / 2}`} stroke={color} strokeWidth={2} />
              ) : (
                <Path
                  d={curve(side === 1 ? root.x + root.w : root.x, root.y + root.h / 2, side === 1 ? b.x : b.x + b.w, b.y + b.h / 2)}
                  stroke={color}
                  strokeWidth={2.5}
                  fill="none"
                />
              )}
              {leaves.map((l, j) => (
                <Path
                  key={j}
                  d={curve(bx, b.y + b.h / 2, side === 1 ? l.x : l.x + l.w, l.y + l.h / 2)}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                  fill="none"
                />
              ))}
            </G>
          );
        })}

        <Rect x={root.x} y={root.y} width={root.w} height={root.h} rx={14} fill={colors.accent} />
        {label(root, colors.surface, true, serif)}

        {placed.branches.map(({ box: b, leaves }, i) => {
          const color = palette[i % palette.length];
          const n = map.branches[i];
          return (
            <G key={`n${i}`}>
              <G onPress={() => n.from && onVerse(n.from)}>
                <Rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill={color} />
                {label(b, isDark(colors) ? '#151311' : '#FFFFFF', true)}
              </G>
              {leaves.map((l, j) => (
                <G key={j} onPress={() => n.leaves[j].from && onVerse(n.leaves[j].from!)}>
                  <Rect x={l.x} y={l.y} width={l.w} height={l.h} rx={8} fill={colors.surface} stroke={color} strokeWidth={1.2} />
                  {label(l, colors.text, false)}
                </G>
              ))}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
