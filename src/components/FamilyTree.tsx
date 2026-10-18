import { ComponentRef, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { personaColor } from '@/components/Avatar';

import { Persona, Personas, hermanosDe, relacion } from '@/lib/genealogia';
import { Colors, serif } from '@/lib/theme';

type Props = {
  persona: Persona;
  all: Personas;
  colors: Colors;
  onSelect: (id: number) => void;
};

const W = 104;
const H = 48;
const GX = 10;
const GY = 40;
const PAD = 8;
/** Máximo de hermanos, cónyuges e hijos que se dibujan (menos en el teléfono); el resto aparece como «+N» y en las listas. */
const LIMITS = { narrow: { sibs: 1, spouses: 1, kids: 3 }, wide: { sibs: 3, spouses: 2, kids: 5 } };

type Node = { key: string; x: number; row: number; label: string; persona?: Persona; focus?: boolean };

/** Árbol familiar centrado en una persona: abuelos, padres, hermanos, cónyuges e hijos. */
export default function FamilyTree({ persona, all, colors, onSelect }: Props) {
  const [width, setWidth] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const { sibs: MAX_SIBS, spouses: MAX_SPOUSES, kids: MAX_KIDS } = width && width < 560 ? LIMITS.narrow : LIMITS.wide;
  const get = (ids: number[]) => ids.map((id) => all.get(id)).filter((p): p is Persona => !!p);

  const parents = get([...persona.padres, ...persona.madres]).slice(0, 2);
  const sibs = get(hermanosDe(persona, all));
  // Primero los más nombrados en la Biblia (Sara antes que Cetura); la fuente no da el orden de nacimiento
  const byMentions = (a: Persona, b: Persona) => b.versiculos - a.versiculos;
  const spouses = get(persona.conyuges).sort(byMentions);
  const kids = get(persona.hijos).sort(byMentions);
  const grand = parents.map((p) => get([...p.padres, ...p.madres]).slice(0, 2));

  const hasGrand = grand.some((g) => g.length);
  const rowOf = { grand: 0, parents: hasGrand ? 1 : 0, focus: (hasGrand ? 1 : 0) + (parents.length ? 1 : 0) };
  const kidsRow = rowOf.focus + 1;
  const rows = kidsRow + (kids.length ? 1 : 0);

  const nodes: Node[] = [];
  const step = W + GX;
  const more = (n: number, key: string, x: number, row: number) =>
    nodes.push({ key, x, row, label: `+${n} más` });

  // Fila de la persona: hermanos a la izquierda, cónyuges a la derecha
  let x = 0;
  const shownSibs = sibs.slice(0, MAX_SIBS);
  if (sibs.length > MAX_SIBS) {
    more(sibs.length - MAX_SIBS, 'more-sibs', x, rowOf.focus);
    x += step;
  }
  const sibNodes = shownSibs.map((p) => {
    const n: Node = { key: `s${p.id}`, x, row: rowOf.focus, label: relacion.hermano(p), persona: p };
    x += step;
    return n;
  });
  const focusX = x;
  nodes.push(...sibNodes, { key: `f${persona.id}`, x: focusX, row: rowOf.focus, label: '', persona, focus: true });
  x += step;
  const spouseNodes = spouses.slice(0, MAX_SPOUSES).map((p) => {
    const n: Node = { key: `c${p.id}`, x, row: rowOf.focus, label: relacion.conyuge(p), persona: p };
    x += step;
    return n;
  });
  nodes.push(...spouseNodes);
  if (spouses.length > MAX_SPOUSES) more(spouses.length - MAX_SPOUSES, 'more-spouses', x, rowOf.focus);

  // Padres centrados sobre los hermanos y la persona
  const siblingsCenter = ((sibNodes[0]?.x ?? focusX) + focusX) / 2;
  const parentNodes = parents.map((p, i) => ({
    key: `p${p.id}`,
    x: siblingsCenter + (parents.length === 2 ? (i === 0 ? -step / 2 : step / 2) : 0),
    row: rowOf.parents,
    label: relacion.padre(p, persona),
    persona: p,
  }));
  nodes.push(...parentNodes);

  // Abuelos sobre cada padre
  const grandNodes = grand.map((g, i) =>
    g.map((p, j) => ({
      key: `g${p.id}-${i}`,
      x: parentNodes[i].x + (g.length === 2 ? (j === 0 ? -step / 2 : step / 2) : 0) + (parents.length === 2 ? (i === 0 ? -step / 2 : step / 2) : 0),
      row: rowOf.grand,
      label: relacion.abuelo(p),
      persona: p,
    })),
  );
  grandNodes.forEach((g) => nodes.push(...g));

  // Hijos debajo de la persona (y de su cónyuge, si consta)
  const kidsCenter = spouseNodes.length ? (focusX + spouseNodes[0].x) / 2 : focusX;
  const shownKids = kids.slice(0, MAX_KIDS);
  const kidCount = shownKids.length + (kids.length > MAX_KIDS ? 1 : 0);
  const kidNodes = shownKids.map((p, i) => ({
    key: `h${p.id}`,
    x: kidsCenter + (i - (kidCount - 1) / 2) * step,
    row: kidsRow,
    label: relacion.hijo(p),
    persona: p,
  }));
  nodes.push(...kidNodes);
  if (kids.length > MAX_KIDS) more(kids.length - MAX_KIDS, 'more-kids', kidsCenter + ((kidCount - 1) / 2) * step, kidsRow);

  // Se desplaza todo para que empiece en PAD y se centra si sobra ancho
  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x));
  const treeWidth = maxX - minX + W + PAD * 2;
  const canvas = Math.max(treeWidth, width);
  const dx = PAD - minX + (canvas - treeWidth) / 2;
  const height = rows * H + (rows - 1) * GY + PAD * 2;
  const top = (row: number) => PAD + row * (H + GY);
  const cx = (n: { x: number }) => n.x + dx + W / 2;

  // Líneas: matrimonio entre los padres (con un punto), tronco hasta el bus y bajada a cada hijo con esquinas redondeadas
  const paths: string[] = [];
  const rings: { x: number; y: number }[] = [];
  const R = 8;
  const marriage = (a: number, b: number, y: number) => {
    paths.push(`M${a + W / 2} ${y} H${b - W / 2}`);
    rings.push({ x: (a + b) / 2, y });
  };
  const family = (couple: Node[], children: { x: number }[], row: number) => {
    if (!couple.length || !children.length) return;
    const y = top(row) + H / 2;
    let trunk = cx(couple[0]);
    if (couple.length > 1) {
      marriage(cx(couple[0]), cx(couple[couple.length - 1]), y);
      trunk = (cx(couple[0]) + cx(couple[1])) / 2;
    }
    const startY = couple.length > 1 ? y : top(row) + H;
    const bus = top(row + 1) - GY / 2;
    const end = top(row + 1);
    children.map(cx).forEach((c) => {
      if (Math.abs(c - trunk) < 1) return paths.push(`M${trunk} ${startY} V${end}`);
      const dir = c > trunk ? 1 : -1;
      const r = Math.min(R, Math.abs(c - trunk) / 2);
      paths.push(
        `M${trunk} ${startY} V${bus - r} Q${trunk} ${bus} ${trunk + dir * r} ${bus} ` +
          `H${c - dir * r} Q${c} ${bus} ${c} ${bus + r} V${end}`,
      );
    });
  };
  grandNodes.forEach((g, i) => family(g, [parentNodes[i]], rowOf.grand));
  family(parentNodes, [...sibNodes, { x: focusX }], rowOf.parents);
  if (spouseNodes.length) marriage(cx({ x: focusX }), cx(spouseNodes[spouseNodes.length - 1]), top(rowOf.focus) + H / 2);
  const kidTargets = [...kidNodes, ...(kids.length > MAX_KIDS ? [nodes[nodes.length - 1]] : [])];
  family([{ key: 'f', x: focusX, row: rowOf.focus, label: '' }, ...spouseNodes.slice(0, 1)], kidTargets, rowOf.focus);

  // Si el árbol no cabe, se abre centrado en la persona
  const focusCenter = focusX + dx + W / 2;
  useEffect(() => {
    if (width && canvas > width) scroll.current?.scrollTo({ x: Math.max(0, focusCenter - width / 2), animated: false });
  }, [persona.id, width, canvas, focusCenter]);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: canvas, height }}>
          <Svg width={canvas} height={height} style={StyleSheet.absoluteFill}>
            {paths.map((d, i) => (
              <Path key={i} d={d} stroke={colors.muted} strokeWidth={1.4} fill="none" opacity={0.45} />
            ))}
            {rings.map((r, i) => (
              <Circle key={`r${i}`} cx={r.x} cy={r.y} r={4} fill={colors.accent} stroke={colors.surface} strokeWidth={2} />
            ))}
          </Svg>
          {nodes.map((n) => {
            const box = { left: n.x + dx, top: top(n.row) };
            if (!n.persona) {
              return (
                <View
                  key={n.key}
                  style={[styles.node, box, { borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.background }]}
                >
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>{n.label}</Text>
                </View>
              );
            }
            const p = n.persona;
            const tint = personaColor(p, colors);
            return (
              <Pressable
                key={n.key}
                onPress={() => !n.focus && onSelect(p.id)}
                disabled={n.focus}
                accessibilityLabel={n.label ? `${n.label}: ${p.nombre}` : p.nombre}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.node,
                  box,
                  n.focus
                    ? [styles.focus, { backgroundColor: colors.accent, borderColor: colors.accent, shadowColor: colors.accent }]
                    : { backgroundColor: colors.surface, borderColor: hovered ? tint : colors.border },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                {!n.focus && <View style={[styles.stripe, { backgroundColor: tint }]} />}
                {!!n.label && (
                  <Text numberOfLines={1} style={[styles.label, { color: n.focus ? colors.surface : tint }]}>
                    {n.label.toUpperCase()}
                  </Text>
                )}
                <Text numberOfLines={1} style={[styles.name, { color: n.focus ? colors.surface : colors.text }]}>
                  {p.nombre}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
    width: W,
    height: H,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  focus: { shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  name: { fontFamily: serif, fontSize: 15, fontWeight: '600' },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 1 },
});
