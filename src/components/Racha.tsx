// La racha devocional en pantalla: la tarjeta grande de Mi diario (cuántos días seguidos, los últimos siete días,
// cómo va hoy y la próxima insignia), la fila de insignias y la pastilla pequeña de Hoy y del final del devocional.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Resplandor from '@/components/Resplandor';
import Sello from '@/components/Sello';
import { ChevronRightIcon, FlameIcon, HeartIcon, MoonIcon } from '@/components/icons';
import { resplandorDe } from '@/lib/resplandor';
import type { Racha } from '@/lib/rachaTexto';
import { diasLabel, fechaLocal, siguienteHito, sumarDias } from '@/lib/rachaTexto';
import { avance, selloPorId, sellosPara, useSellos } from '@/lib/sellos';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { useTranquila } from '@/lib/tranquila';

type Props = { racha: Racha & { dias: string[] }; colors: Colors; onHoy?: () => void };

const LETRA = 'DLMXJVS';

const nombreDia = (fecha: string) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long' });
};

function estadoTexto(r: Racha) {
  switch (r.estado) {
    case 'hecha':
      return r.actual === 1 ? 'Hoy empezó tu racha. Mañana, otro paso.' : 'Hoy ya hiciste tu devocional. Mañana sigue la racha.';
    case 'libre':
      return 'Aún no haces el devocional de hoy. Si hoy no puedes, este será tu día libre de la semana.';
    case 'riesgo':
      return 'Hoy es el último día para no perder tu racha. Diez minutos bastan.';
    default:
      return r.mejor
        ? `Tu racha se reinició, pero lo vivido no se pierde: tu mejor racha fue de ${diasLabel(r.mejor)}. Hoy puede empezar otra.`
        : 'Haz tu devocional cada día. Si un día no puedes, tienes un día libre por semana.';
  }
}

/** La tarjeta de la racha: el número, los últimos siete días, cómo va hoy y la próxima insignia. */
export function RachaTarjeta(p: Props) {
  return useTranquila() ? null : <Tarjeta {...p} />;
}

function Tarjeta({ racha, colors, onHoy }: Props) {
  const hoy = fechaLocal();
  const hechos = new Set(racha.dias);
  const libres = new Set(racha.descansos);
  const meta = siguienteHito(racha.actual);
  const proxima = meta ? selloPorId(`racha-${meta}`) : undefined;
  const viva = racha.actual > 0;
  const riesgo = racha.estado === 'riesgo';
  // Escondido: tocar la llama enciende la luz de la racha (src/lib/resplandor.ts).
  const luz = resplandorDe(racha.actual);
  const [brilla, setBrilla] = useState(false);
  // El día libre usado en los últimos seis días (el de antes ya no cuenta).
  const ultimoLibre = racha.descansos.filter((d) => d > sumarDias(hoy, -7)).at(-1);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: riesgo ? colors.warm : colors.border }]} testID="racha">
      <View style={styles.top}>
        <Pressable
          onPress={luz ? () => setBrilla(true) : undefined}
          disabled={!luz}
          style={({ pressed }) => [styles.medalla, { backgroundColor: viva ? colors.warmSoft : colors.accentSoft }, pressed && { transform: [{ scale: 0.94 }] }]}
          accessibilityRole={luz ? 'button' : undefined}
          accessibilityLabel={luz ? 'Llama de la racha' : undefined}
          testID="racha-llama"
        >
          <FlameIcon color={viva ? colors.warm : colors.muted} size={36} filled={racha.hoyHecho} strokeWidth={1.6} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: viva ? colors.warm : colors.muted }]}>RACHA DEVOCIONAL</Text>
          <View style={styles.numero}>
            <Text style={[styles.cifra, { color: colors.text }]} accessibilityLabel={`${diasLabel(racha.actual)} seguidos`}>
              {racha.actual}
            </Text>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{racha.actual === 1 ? 'día seguido' : 'días seguidos'}</Text>
          </View>
          {racha.mejor > racha.actual && (
            <Text style={{ color: colors.muted, fontSize: 13 }}>Tu mejor racha: {diasLabel(racha.mejor)}</Text>
          )}
          {racha.mejor > 0 && racha.mejor === racha.actual && racha.actual > 1 && (
            <Text style={{ color: colors.muted, fontSize: 13 }}>¡Tu mejor racha hasta hoy!</Text>
          )}
        </View>
      </View>

      <View style={styles.semana} accessibilityLabel="Los últimos siete días">
        {Array.from({ length: 7 }, (_, i) => {
          const fecha = sumarDias(hoy, i - 6);
          const hecho = hechos.has(fecha);
          const libre = libres.has(fecha);
          const esHoy = fecha === hoy;
          const [y, m, d] = fecha.split('-').map(Number);
          return (
            <View key={fecha} style={styles.dia}>
              <View
                style={[
                  styles.punto,
                  hecho
                    ? { backgroundColor: colors.warm, borderColor: colors.warm }
                    : { borderColor: esHoy ? colors.warm : colors.border, borderWidth: esHoy ? 2 : 1.5, borderStyle: libre ? 'dashed' : 'solid' },
                ]}
              >
                {hecho ? (
                  <FlameIcon color={colors.surface} size={15} filled />
                ) : libre ? (
                  <MoonIcon color={colors.muted} size={13} />
                ) : null}
              </View>
              <Text style={{ color: esHoy ? colors.text : colors.muted, fontSize: 11, fontWeight: esHoy ? '700' : '500', marginTop: 5 }}>
                {esHoy ? 'Hoy' : LETRA[new Date(y, m - 1, d).getDay()]}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.aviso, { backgroundColor: riesgo ? colors.warmSoft : colors.background }]}>
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{estadoTexto(racha)}</Text>
        {viva && ultimoLibre && (
          <View style={styles.libreFila}>
            <MoonIcon color={colors.muted} size={13} />
            <Text style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}>
              Usaste tu día libre el {nombreDia(ultimoLibre)}. Vuelve a estar libre el próximo {nombreDia(sumarDias(ultimoLibre, 7))}.
            </Text>
          </View>
        )}
      </View>

      {proxima && meta && (
        <Pressable
          onPress={() => navigate(() => router.push(`/sellos?sello=${proxima.id}` as never), 'forward')}
          style={({ pressed }) => [styles.proxima, pressed && { opacity: 0.75 }]}
          accessibilityRole="link"
          accessibilityLabel={`Próxima insignia: ${proxima.titulo}, ${racha.actual} de ${meta} días`}
        >
          <Sello dibujo={proxima.dibujo} colors={colors} ganado={false} parte={racha.actual / meta} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>PRÓXIMA INSIGNIA</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 1 }}>{proxima.titulo}</Text>
            <View style={[styles.barra, { backgroundColor: colors.accentSoft }]}>
              <View style={[styles.barraLlena, { backgroundColor: colors.warm, width: `${Math.max(4, (racha.actual / meta) * 100)}%` }]} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              {racha.actual} de {meta} días · {meta - racha.actual === 1 ? 'falta 1' : `faltan ${meta - racha.actual}`}
            </Text>
          </View>
          <ChevronRightIcon color={colors.muted} size={18} />
        </Pressable>
      )}

      {brilla && luz && <Resplandor nivel={luz} dias={racha.actual} onClose={() => setBrilla(false)} />}

      {onHoy && !racha.hoyHecho && (
        <Pressable
          onPress={onHoy}
          style={({ pressed }) => [styles.boton, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <View style={styles.botonTexto}>
            <HeartIcon color={colors.surface} size={18} strokeWidth={2} />
            <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>Haz el devocional de hoy</Text>
          </View>
          <Text style={{ color: colors.accentSoft, fontSize: 13 }}>10 min</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Las insignias de la racha, en fila: las ganadas en el tono cálido; las demás, con lo que falta. */
export function RachaInsignias(p: { colors: Colors }) {
  return useTranquila() ? null : <Insignias {...p} />;
}

function Insignias({ colors }: { colors: Colors }) {
  const estado = useSellos();
  const lista = sellosPara().filter((s) => s.familia === 'devocional');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insignias}>
      {lista.map((s) => {
        const a = avance(estado, s);
        return (
          <Pressable
            key={s.id}
            onPress={() => navigate(() => router.push(`/sellos?sello=${s.id}` as never), 'forward')}
            style={({ pressed }) => [styles.insignia, pressed && { opacity: 0.7 }]}
            accessibilityRole="link"
            accessibilityLabel={`${s.titulo}: ${a.ganado ? 'ganada' : `${a.n} de ${a.meta}`}`}
          >
            <Sello dibujo={s.dibujo} colors={colors} ganado={!!a.ganado} parte={a.parte} size={58} />
            <Text style={[styles.insigniaMeta, { color: a.ganado ? colors.warm : colors.text }]}>
              {s.tipo === 'racha' ? `${s.meta} días` : `${s.meta} en total`}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 14 }} numberOfLines={2}>
              {s.titulo}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** La racha en una pastilla: la llama y el número. */
type ChipProps = { dias: number; hecha: boolean; colors: Colors; claro?: boolean };

export function RachaChip(p: ChipProps) {
  return useTranquila() ? null : <Chip {...p} />;
}

function Chip({ dias, hecha, colors, claro }: ChipProps) {
  const tinta = claro ? colors.surface : colors.warm;
  return (
    <View
      style={[styles.chip, { backgroundColor: claro ? 'rgba(255,255,255,0.16)' : colors.warmSoft }]}
      accessibilityLabel={`Racha devocional: ${diasLabel(dias)}${hecha ? ', hoy ya hecho' : ''}`}
    >
      <FlameIcon color={tinta} size={14} filled={hecha} strokeWidth={2} />
      <Text style={{ color: tinta, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] }}>{dias}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 20, marginBottom: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  medalla: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  numero: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cifra: { fontFamily: serif, fontSize: 46, lineHeight: 52 },
  semana: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  dia: { alignItems: 'center', flex: 1 },
  punto: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  aviso: { borderRadius: 14, padding: 12, marginTop: 16 },
  libreFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  proxima: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  barra: { height: 6, borderRadius: 3, marginTop: 7, overflow: 'hidden' },
  barraLlena: { height: 6, borderRadius: 3 },
  boton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 16,
  },
  botonTexto: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insignias: { gap: 4, paddingVertical: 4, paddingRight: 8 },
  insignia: { width: 84, alignItems: 'center' },
  insigniaMeta: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
});
