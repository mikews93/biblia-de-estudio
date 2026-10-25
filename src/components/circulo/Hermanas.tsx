// Para quien lidera un círculo: cuántos hombres y mujeres hay (solo números) y las iglesias hermanas que suma. En casi
// todas las iglesias hay menos hombres que mujeres (investigacion/mas-mujeres-que-hombres.md); unir iglesias de la misma
// ciudad hace el grupo más parejo y que un «no» no cierre todas las puertas.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirm } from '@/components/comunidad/confirm';
import { Button, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { ChurchIcon, CloseIcon } from '@/components/icons';
import { type IglesiaCirculo, quitarHermana, sumarHermana } from '@/lib/circuloApi';
import { Colors, serif } from '@/lib/theme';

/** Por debajo de esta parte, el grupo se siente disparejo. */
const PAREJO = 0.4;

export function Balance({ hombres, mujeres, colors }: { hombres: number; mujeres: number; colors: Colors }) {
  const total = hombres + mujeres;
  if (!total) return null;
  const h = hombres / total;
  const consejo =
    total < 4
      ? null
      : h < PAREJO
        ? 'Hay pocos hombres. Invítalos en persona, sobre todo a los que vienen con su familia, o suma una iglesia hermana. «Hombres de pie» es un buen primer paso para ellos.'
        : h > 1 - PAREJO
          ? 'Hay pocas mujeres. Suma una iglesia hermana para que el grupo sea más parejo.'
          : null;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.muted }]}>HOMBRES Y MUJERES</Text>
      <View style={styles.cifras}>
        <Text style={[styles.cifra, { color: colors.text }]}>
          {hombres} <Text style={styles.cifraLabel}>{hombres === 1 ? 'hombre' : 'hombres'}</Text>
        </Text>
        <Text style={[styles.cifra, { color: colors.text }]}>
          {mujeres} <Text style={styles.cifraLabel}>{mujeres === 1 ? 'mujer' : 'mujeres'}</Text>
        </Text>
      </View>
      <View style={[styles.barra, { backgroundColor: colors.border }]} accessibilityLabel={`${hombres} hombres y ${mujeres} mujeres`}>
        {hombres > 0 && <View style={{ flex: hombres, backgroundColor: colors.accent }} />}
        {mujeres > 0 && <View style={{ flex: mujeres, backgroundColor: colors.warm }} />}
      </View>
      {consejo && <Text style={[text.small, { color: colors.text, marginTop: 10, lineHeight: 19 }]}>{consejo}</Text>}
      <Text style={[text.small, { color: colors.muted, marginTop: 6 }]}>Sin contar los pedidos. Nadie más ve estos números.</Text>
    </View>
  );
}

export function Hermanas({
  circulo,
  iglesias,
  max,
  colors,
  onDone,
}: {
  circulo: string;
  iglesias: IglesiaCirculo[];
  max: number;
  colors: Colors;
  onDone: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const act = useAction();
  const hermanas = iglesias.filter((i) => !i.propia);
  const sumar = () =>
    act.run(async () => {
      await sumarHermana(circulo, codigo);
      setCodigo('');
      onDone();
    });
  const quitar = async (i: IglesiaCirculo) => {
    const ok = await confirm(
      `¿Quitar a ${i.nombre}?`,
      'Quienes ya entraron desde esa iglesia se quedan en el círculo. Solo deja de recibir pedidos nuevos de ella.',
      'Quitar',
    );
    if (ok && (await act.run(() => quitarHermana(circulo, i.id)))) onDone();
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.muted }]}>IGLESIAS HERMANAS</Text>
      <Text style={[styles.titulo, { color: colors.text }]}>Un círculo entre iglesias de tu ciudad</Text>
      <Text style={[text.small, { color: colors.muted, marginTop: 4, lineHeight: 19 }]}>
        Con más iglesias, el grupo es más grande y más parejo, y un «no» no cierra todas las puertas. Pide el código de Zarza al
        pastor de la otra iglesia: sus solteros verán este círculo y podrán pedir entrar. Sus líderes pueden ayudarte a acompañar.
      </Text>
      <View style={styles.chips}>
        {iglesias.map((i) => (
          <View key={i.id} style={[styles.chip, { borderColor: i.propia ? colors.accent : colors.border, backgroundColor: colors.background }]}>
            <ChurchIcon color={i.propia ? colors.accent : colors.muted} size={13} />
            <Text style={{ color: colors.text, fontSize: 13 }}>
              {i.nombre}
              {i.ciudad ? <Text style={{ color: colors.muted }}> · {i.ciudad}</Text> : null}
            </Text>
            {!i.propia && (
              <Pressable onPress={() => quitar(i)} hitSlop={8} accessibilityLabel={`Quitar a ${i.nombre}`}>
                <CloseIcon color={colors.muted} size={14} />
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {hermanas.length < max ? (
        <View style={styles.sumar}>
          <View style={{ flex: 1 }}>
            <Field
              value={codigo}
              onChangeText={setCodigo}
              placeholder="Código de la otra iglesia"
              autoCapitalize="characters"
              accessibilityLabel="Código de la otra iglesia"
            />
          </View>
          <Button label="Sumar" kind="outline" onPress={sumar} busy={act.busy} disabled={codigo.trim().length < 3} />
        </View>
      ) : (
        <Text style={[text.small, { color: colors.muted, marginTop: 10 }]}>Ya suma {max} iglesias hermanas, el máximo.</Text>
      )}
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, marginTop: 14 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  titulo: { fontFamily: serif, fontSize: 18, marginTop: 6 },
  cifras: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cifra: { fontFamily: serif, fontSize: 22 },
  cifraLabel: { fontFamily: undefined, fontSize: 13, fontWeight: '600' },
  barra: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  sumar: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 12 },
});
