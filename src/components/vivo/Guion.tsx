// Un mensaje del Taller llevado en vivo, parte por parte. Quien guía ve en qué parte va, cuánto lleva en ella y
// en todo el mensaje, y sus notas de esa parte (solo en su teléfono). Los demás ven en qué parte van.
// También aquí: la versión en que se lee, con el aviso de derechos que piden sus editores.
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, HourglassIcon } from '@/components/icons';
import { type Version, getVersions } from '@/lib/data';
import { avance, minutosPlaneados, segundosDesde } from '@/lib/guion';
import { licensedById } from '@/lib/licenciadas';
import type { Mensaje } from '@/lib/taller';
import { serif, useColors } from '@/lib/theme';
import { type Guion, clock } from '@/lib/vivo';

import { LIVE_RED, vivoText } from './piezas';

/** Vuelve a pintar cada segundo mientras `activo`: para los relojes que cuentan hacia arriba. */
export function useTic(activo = true) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [activo]);
}

let versiones: Promise<Version[]> | null = null;

/** La abreviatura y el aviso de derechos de una versión («NBLA», «RV1909»). */
export function useVersion(id: string) {
  const [all, setAll] = useState<Version[]>([]);
  useEffect(() => {
    versiones ??= getVersions().catch(() => {
      versiones = null;
      return [];
    });
    versiones.then(setAll);
  }, []);
  const v = all.find((x) => x.id === id);
  const licensed = licensedById(id);
  return { abbr: v?.abbr ?? licensed?.abbr ?? id.toUpperCase(), licensed };
}

/** El aviso que piden los editores de una versión con derechos, con sus enlaces. Nada en las versiones libres. */
export function CreditoVersion({ version, style }: { version: string; style?: object }) {
  const colors = useColors();
  const licensed = licensedById(version);
  if (!licensed) return null;
  return (
    <Text style={[{ color: colors.muted, fontSize: 11.5, lineHeight: 16 }, style]}>
      {licensed.credit}
      {licensed.links.map((l) => (
        <Text key={l.url} onPress={() => Linking.openURL(l.url)} role="link" style={{ color: colors.accent }}>
          {` · ${l.label}`}
        </Text>
      ))}
    </Text>
  );
}

/** Las partes como una barra de tramos: las que pasaron llenas, la de ahora a medias según su tiempo. */
export function Tramos({ partes, parte, enLaParte, alto = 5 }: { partes: { minutos?: number }[]; parte: number; enLaParte: number; alto?: number }) {
  const colors = useColors();
  const total = minutosPlaneados(partes);
  return (
    <View style={[styles.tramos, { gap: partes.length > 12 ? 2 : 4 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {partes.map((p, i) => {
        const lleno = i < parte ? 1 : i === parte ? (p.minutos ? Math.min(1, enLaParte / 60 / p.minutos) : 0.5) : 0;
        return (
          <View
            key={i}
            style={{
              flexGrow: total ? Math.max(p.minutos ?? 0, total / partes.length / 3) : 1,
              flexBasis: 0,
              height: alto,
              borderRadius: alto,
              overflow: 'hidden',
              backgroundColor: colors.accentSoft,
            }}
          >
            <View style={{ width: `${lleno * 100}%`, height: '100%', backgroundColor: i === parte ? colors.warm : colors.accent, opacity: i < parte ? 0.55 : 1 }} />
          </View>
        );
      })}
    </View>
  );
}

/** Lo que escribió quien guía para una parte: sus notas y sus puntos para hablar. Nunca sale de su teléfono. */
function MisNotas({ m, parte, colors }: { m: Mensaje; parte: number; colors: ReturnType<typeof useColors> }) {
  const s = m.secciones[parte];
  if (!s) return null;
  const claves = (s.claves ?? '')
    .split('\n')
    .map((c) => c.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
  if (!s.texto.trim() && !claves.length) {
    return <Text style={{ color: colors.muted, fontSize: 13.5, marginTop: 10 }}>No escribiste notas para esta parte.</Text>;
  }
  return (
    <ScrollView style={[styles.notas, { borderColor: colors.border }]} nestedScrollEnabled>
      {!!s.texto.trim() && <Text style={{ color: colors.text, fontFamily: serif, fontSize: 15, lineHeight: 22 }}>{s.texto.trim()}</Text>}
      {claves.map((c, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 9, marginTop: 7 }}>
          <View style={[styles.punto, { backgroundColor: colors.warm }]} />
          <Text style={{ color: colors.text, fontSize: 14.5, lineHeight: 20, flex: 1 }}>{c}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * La barra de quien guía: en qué parte va, cuánto lleva en ella (contra los minutos que planeó) y en todo el
 * mensaje, las notas de la parte si el mensaje está en este teléfono, y los botones para pasar de parte.
 */
export function BarraGuion({
  guion: g,
  skew,
  mensaje,
  onParte,
}: {
  guion: Guion;
  skew: number;
  mensaje?: Mensaje;
  onParte: (parte: number) => void;
}) {
  const colors = useColors();
  const [notas, setNotas] = useState(false);
  useTic();
  const enLaParte = segundosDesde(g.desde, skew);
  const total = segundosDesde(g.inicio, skew);
  const p = g.parte >= 0 ? g.partes[g.parte] : null;
  const plan = minutosPlaneados(g.partes);
  const pasado = !!p?.minutos && enLaParte > p.minutos * 60;
  const ultima = g.parte >= g.partes.length - 1;
  const Chevron = notas ? ChevronUpIcon : ChevronDownIcon;

  return (
    <View
      style={[styles.barra, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={p ? `Parte ${g.parte + 1} de ${g.partes.length}: ${p.titulo}` : `Antes de empezar: ${g.titulo}`}
    >
      <Tramos partes={g.partes} parte={g.parte} enLaParte={enLaParte} />
      <View style={styles.fila}>
        <Text style={[vivoText.kicker, { color: colors.warm, flex: 1 }]} numberOfLines={1}>
          {p ? `PARTE ${g.parte + 1} DE ${g.partes.length}` : 'ANTES DE EMPEZAR'}
        </Text>
        {p && (
          <View
            style={[styles.reloj, { backgroundColor: pasado ? 'rgba(200,70,47,0.12)' : colors.accentSoft }]}
            accessibilityLabel={`Llevas ${clock(enLaParte)} en esta parte${p.minutos ? ` de ${p.minutos} minutos` : ''}`}
          >
            <HourglassIcon color={pasado ? LIVE_RED : colors.text} size={13} strokeWidth={2} />
            <Text style={[styles.relojTexto, { color: pasado ? LIVE_RED : colors.text }]}>
              {clock(enLaParte)}
              {p.minutos ? <Text style={{ color: pasado ? LIVE_RED : colors.muted, fontWeight: '600' }}> / {p.minutos}:00</Text> : null}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.fila}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={2}>
            {p ? p.titulo : g.titulo}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
            {p
              ? `Total ${clock(total)}${plan ? ` de ${plan} min` : ''} · ${Math.round(avance(g, enLaParte) * 100)} %`
              : `${g.partes.length} partes${plan ? ` · ${plan} min` : ''}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onParte(g.parte - 1)}
          disabled={g.parte < 0}
          accessibilityLabel="Parte anterior"
          style={[styles.redondo, { borderColor: colors.border }, g.parte < 0 && { opacity: 0.35 }]}
        >
          <ChevronLeftIcon color={colors.text} size={18} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onParte(g.parte + 1)}
          disabled={ultima}
          accessibilityLabel={p ? 'Parte siguiente' : 'Empezar la parte 1'}
          style={[p ? styles.redondo : styles.empezar, { backgroundColor: colors.warm, borderColor: colors.warm }, ultima && { opacity: 0.35 }]}
        >
          {!p && <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Empezar</Text>}
          <ChevronRightIcon color="#FFFFFF" size={18} />
        </Pressable>
      </View>
      {mensaje && p && (
        <>
          <Pressable onPress={() => setNotas(!notas)} accessibilityRole="button" aria-expanded={notas} hitSlop={6} style={styles.verNotas}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{notas ? 'Ocultar mis notas' : 'Mis notas de esta parte'}</Text>
            <Chevron color={colors.accent} size={14} />
          </Pressable>
          {notas && <MisNotas m={mensaje} parte={g.parte} colors={colors} />}
        </>
      )}
    </View>
  );
}

/** Para quien sigue: en qué parte del mensaje van. */
export function ChipGuion({ guion: g, skew }: { guion: Guion; skew: number }) {
  const colors = useColors();
  useTic(g.parte >= 0);
  const p = g.parte >= 0 ? g.partes[g.parte] : null;
  return (
    <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.fila}>
        <Text style={[vivoText.kicker, { color: colors.warm }]}>{p ? `PARTE ${g.parte + 1} DE ${g.partes.length}` : 'EMPIEZA PRONTO'}</Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={1}>
          {p ? p.titulo : g.titulo}
        </Text>
      </View>
      <Tramos partes={g.partes} parte={g.parte} enLaParte={segundosDesde(g.desde, skew)} alto={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  tramos: { flexDirection: 'row', width: '100%' },
  barra: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
    maxWidth: 520,
    width: '100%',
    boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reloj: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  relojTexto: { fontSize: 13.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  titulo: { fontFamily: serif, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  redondo: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empezar: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, borderRadius: 20, borderWidth: 1, paddingLeft: 14, paddingRight: 10 },
  verNotas: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  notas: { maxHeight: 180, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  punto: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  chip: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, gap: 8, marginBottom: 16 },
});
