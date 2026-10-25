// Los círculos de solteros de una iglesia anfitriona, en /cuidar: abrirlos (por edades, de hasta 30 personas) y nombrar
// a sus líderes por correo. Quien cuida Zarza también puede abrir el panel de cualquier círculo.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { confirm } from '@/components/comunidad/confirm';
import { Button, ErrorText, Field, useAction } from '@/components/comunidad/ui';
import { CloseIcon, PeopleIcon, ShieldIcon } from '@/components/icons';
import { type CirculoCuidado, borrarCirculo, circulosDeIglesia, nombrarLider, nuevoCirculo, quitarLider, rangoEdad } from '@/lib/circuloApi';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function CirculosIglesia({ iglesia, colors }: { iglesia: string; colors: Colors }) {
  const [circulos, setCirculos] = useState<CirculoCuidado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [min, setMin] = useState('18');
  const [max, setMax] = useState('');
  const act = useAction();

  const reload = useCallback(
    () =>
      circulosDeIglesia(iglesia).then(
        (c) => {
          setCirculos(c);
          setError(null);
        },
        (e: Error) => setError(e.message),
      ),
    [iglesia],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const crear = () =>
    act.run(async () => {
      await nuevoCirculo(iglesia, nombre, min, max);
      setNombre('');
      setMax('');
      await reload();
    });

  return (
    <View style={[styles.wrap, { borderTopColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.muted }]}>CÍRCULOS DE SOLTEROS</Text>
      {circulos === null ? (
        error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
      ) : (
        <View style={{ gap: 10, marginTop: 10 }}>
          {circulos.map((c) => (
            <Circulo key={c.id} c={c} colors={colors} onDone={reload} />
          ))}
          {!circulos.length && (
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Todavía no hay círculos. En una iglesia grande, abre varios por edades para que nadie quede entre desconocidos.
            </Text>
          )}
        </View>
      )}
      <View style={[styles.nuevo, { borderColor: colors.border }]}>
        <Field label="Nuevo círculo" value={nombre} onChangeText={setNombre} placeholder="Jóvenes adultos" />
        <View style={styles.edades}>
          <View style={{ flex: 1 }}>
            <Field label="Edad mínima" value={min} onChangeText={(t) => setMin(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Edad máxima" value={max} onChangeText={(t) => setMax(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="Sin tope" />
          </View>
        </View>
        <Button label="Abrir círculo" icon={PeopleIcon} kind="outline" onPress={crear} busy={act.busy} disabled={!nombre.trim()} />
        <ErrorText>{act.error}</ErrorText>
      </View>
    </View>
  );
}

function Circulo({ c, colors, onDone }: { c: CirculoCuidado; colors: Colors; onDone: () => void }) {
  const [correo, setCorreo] = useState('');
  const act = useAction();
  const agregar = () =>
    act.run(async () => {
      await nombrarLider(c.id, correo);
      setCorreo('');
      onDone();
    });
  const borrar = async () => {
    if (!(await confirm(`¿Cerrar ${c.nombre}?`, 'Se borran el círculo, sus respuestas y sus conversaciones. No se puede deshacer.', 'Cerrar círculo'))) return;
    if (await act.run(() => borrarCirculo(c.id))) onDone();
  };
  return (
    <View style={[styles.circulo, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17 }}>{c.nombre}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
            {rangoEdad(c)} · {c.miembros}/{c.max} personas{c.miembros ? ` (${c.hombres} H, ${c.mujeres} M)` : ''}
            {c.pendientes ? ` · ${c.pendientes} por aprobar` : ''}
          </Text>
          {c.hermanas.length > 0 && <Text style={{ color: colors.warm, fontSize: 12, marginTop: 2 }}>Con {c.hermanas.join(', ')}</Text>}
        </View>
        <Button label="Panel" icon={ShieldIcon} kind="quiet" onPress={() => navigate(() => router.push(`/circulo/lider/${c.id}` as never), 'forward')} />
      </View>
      <View style={styles.lideres}>
        {c.lideres.map((l) => (
          <View key={l.id} style={[styles.lider, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontSize: 13 }}>{l.nombre}</Text>
            <Pressable onPress={() => act.run(() => quitarLider(c.id, l.id)).then(onDone)} hitSlop={8} accessibilityLabel={`Quitar a ${l.nombre} como líder`}>
              <CloseIcon color={colors.muted} size={14} />
            </Pressable>
          </View>
        ))}
        {!c.lideres.length && <Text style={{ color: colors.warm, fontSize: 13 }}>Sin líder: nadie puede aprobar pedidos todavía.</Text>}
      </View>
      <View style={styles.edades}>
        <View style={{ flex: 1 }}>
          <Field value={correo} onChangeText={setCorreo} placeholder="Correo del líder" autoCapitalize="none" keyboardType="email-address" />
        </View>
        <Button label="Nombrar" kind="outline" onPress={agregar} busy={act.busy} disabled={!correo.includes('@')} />
      </View>
      <Button label="Cerrar círculo" kind="quiet" onPress={borrar} style={{ alignSelf: 'flex-start' }} />
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 14 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  nuevo: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 14, gap: 10 },
  edades: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  circulo: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lideres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lider: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
});
