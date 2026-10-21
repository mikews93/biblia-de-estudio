import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, CloseIcon, HourglassIcon, LampIcon, PeopleIcon, TalkIcon } from '@/components/icons';
import { MOMENTOS, dinamica } from '@/lib/dinamicas';
import { serif, useColors } from '@/lib/theme';
import { type Tarjeta, clock, useCountdown } from '@/lib/vivo';

import { vivoText } from './piezas';

type Props = {
  tarjeta: Tarjeta;
  skew: number;
  lead: boolean;
  onStep: (paso: number) => void;
  onTimer: (reloj: 'iniciar' | 'parar') => void;
  onClose: () => void;
};

function kickerOf(t: Tarjeta) {
  if (t.tipo === 'pregunta') return 'PARA CONVERSAR';
  if (t.tipo === 'parte') return 'DEL ENCUENTRO';
  const momento = MOMENTOS.find((m) => m.momento === dinamica(t.dinamica ?? undefined)?.momento);
  return `DINÁMICA${momento ? ` · ${momento.label.toUpperCase()}` : ''}`;
}

/**
 * Lo que quien guía pone en la pantalla de todos: una dinámica con sus pasos, una pregunta o una parte del
 * encuentro preparado en el Taller. El reloj es el mismo en cada teléfono. Quien sigue puede plegarla.
 */
export default function TarjetaVivo({ tarjeta: t, skew, lead, onStep, onTimer, onClose }: Props) {
  const colors = useColors();
  const [folded, setFolded] = useState(false);
  const left = useCountdown(t.fin, skew);
  const Icon = t.tipo === 'pregunta' ? TalkIcon : t.tipo === 'parte' ? LampIcon : PeopleIcon;
  const done = left === 0;
  const steps = t.pasos;

  return (
    <Appear from={10}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: '0 6px 24px rgba(0,0,0,0.08)' }]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.warmSoft }]}>
            <Icon color={colors.warm} size={17} />
          </View>
          <Text style={[vivoText.kicker, { color: colors.warm, flex: 1 }]} numberOfLines={1}>
            {kickerOf(t)}
          </Text>
          {left !== null && (
            <View
              style={[styles.timer, { backgroundColor: done ? 'rgba(200,70,47,0.12)' : colors.accentSoft }]}
              accessibilityLabel={done ? 'Se acabó el tiempo' : `Quedan ${clock(left)}`}
            >
              <HourglassIcon color={done ? '#C8462F' : colors.text} size={14} strokeWidth={2} />
              <Text style={[styles.timerText, { color: done ? '#C8462F' : colors.text }]}>{done ? 'Tiempo' : clock(left)}</Text>
            </View>
          )}
          {!lead && (
            <Pressable accessibilityRole="button" onPress={() => setFolded(!folded)} hitSlop={10} accessibilityLabel={folded ? 'Abrir la tarjeta' : 'Plegar la tarjeta'}>
              {folded ? <ChevronDownIcon color={colors.muted} size={20} /> : <ChevronUpIcon color={colors.muted} size={20} />}
            </Pressable>
          )}
          {lead && (
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} accessibilityLabel="Quitar la tarjeta de todas las pantallas">
              <CloseIcon color={colors.muted} size={18} />
            </Pressable>
          )}
        </View>

        <Text style={[styles.title, { color: colors.text, fontSize: t.tipo === 'pregunta' ? 22 : 20 }]}>{t.titulo}</Text>

        {!folded && (
          <>
            {!!t.texto && <Text style={[styles.body, { color: colors.text }]}>{t.texto}</Text>}
            {steps.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {steps.map((s, i) => {
                  const now = i === t.paso;
                  return (
                    <Pressable accessibilityRole="button"
                      key={i}
                      disabled={!lead}
                      onPress={() => onStep(i)}
                      accessibilityLabel={`Paso ${i + 1}${now ? ', el de ahora' : ''}`}
                      style={[styles.step, now && { backgroundColor: colors.warmSoft }]}
                    >
                      <View style={[styles.num, { backgroundColor: now ? colors.warm : colors.accentSoft }]}>
                        <Text style={{ color: now ? '#FFFFFF' : colors.muted, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.stepText, { color: now ? colors.text : colors.muted }, now && { fontWeight: '600' }]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {lead && (
              <View style={styles.controls}>
                {steps.length > 1 && (
                  <View style={styles.stepper}>
                    <Pressable accessibilityRole="button"
                      onPress={() => onStep(t.paso - 1)}
                      disabled={t.paso === 0}
                      accessibilityLabel="Paso anterior"
                      style={[styles.round, { borderColor: colors.border, opacity: t.paso === 0 ? 0.4 : 1 }]}
                    >
                      <ChevronLeftIcon color={colors.text} size={18} />
                    </Pressable>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>
                      Paso {t.paso + 1} de {steps.length}
                    </Text>
                    <Pressable accessibilityRole="button"
                      onPress={() => onStep(t.paso + 1)}
                      disabled={t.paso >= steps.length - 1}
                      accessibilityLabel="Paso siguiente"
                      style={[styles.round, { backgroundColor: colors.accent, opacity: t.paso >= steps.length - 1 ? 0.4 : 1 }]}
                    >
                      <ChevronRightIcon color={colors.surface} size={18} />
                    </Pressable>
                  </View>
                )}
                <Pressable
                  onPress={() => onTimer(left !== null && !done ? 'parar' : 'iniciar')}
                  style={[styles.timerButton, { borderColor: colors.border }]}
                  accessibilityRole="button"
                >
                  <HourglassIcon color={colors.text} size={15} strokeWidth={2} />
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                    {left !== null && !done ? 'Parar el reloj' : `Reloj de ${t.minutos ?? 5} min`}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4 },
  timerText: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  title: { fontFamily: serif, fontWeight: '700', lineHeight: 30, marginTop: 12 },
  body: { fontFamily: serif, fontSize: 17, lineHeight: 26, marginTop: 8 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: 8, marginHorizontal: -8 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepText: { flex: 1, fontSize: 15.5, lineHeight: 22 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  timerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});
