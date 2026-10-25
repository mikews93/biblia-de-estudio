import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Avatar, Button, ErrorText, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { FlagIcon, HeartIcon, LockIcon } from '@/components/icons';
import { etapaCorta } from '@/lib/circulo';
import { type PanelLider, type PersonaLider, aprobar, panelLider, rangoEdad, revisar } from '@/lib/circuloApi';
import { ago, useAccount } from '@/lib/comunidad';
import { Colors, serif, useColors } from '@/lib/theme';

/** Lo que ve quien lidera un círculo: pedidos para entrar, reportes y las personas. Nunca las conversaciones. */
export default function LiderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { usuario, ready } = useAccount();
  const [panel, setPanel] = useState<PanelLider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!usuario || !id) return;
    panelLider(id).then(
      (p) => {
        setPanel(p);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [usuario, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  let contenido;
  if (ready && !usuario) contenido = <Welcome intro="Entra con tu cuenta de líder." />;
  else if (!panel)
    contenido = error ? (
      <Text style={[text.body, { color: colors.text, marginTop: 40 }]}>{error}</Text>
    ) : (
      <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
    );
  else {
    const c = panel.circulo;
    const activos = panel.miembros.filter((m) => !m.pausado).length;
    contenido = (
      <>
        <Appear style={styles.head}>
          <Text style={[styles.kicker, { color: colors.warm }]}>LIDERAS · {c.iglesia.toUpperCase()}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{c.nombre}</Text>
          <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>{rangoEdad(c)}</Text>
          <View style={[styles.stats, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Stat valor={`${activos}/${c.max}`} etiqueta="personas" colors={colors} />
            <Stat valor={panel.pendientes.length} etiqueta={panel.pendientes.length === 1 ? 'pedido' : 'pedidos'} colors={colors} />
            <Stat valor={panel.conociendose} etiqueta={panel.conociendose === 1 ? 'pareja conociéndose' : 'parejas conociéndose'} colors={colors} />
          </View>
        </Appear>

        <View style={[styles.nota, { backgroundColor: colors.accentSoft }]}>
          <LockIcon color={colors.accent} size={16} strokeWidth={2} />
          <Text style={[text.small, { color: colors.text, flex: 1, lineHeight: 19 }]}>
            No ves las marcas ni los mensajes de nadie: son privados. Solo ves los pedidos, los reportes y a quienes piden que los acompañes.
          </Text>
        </View>

        {panel.reportes.length > 0 && (
          <>
            <SectionTitle>Reportes por revisar</SectionTitle>
            <View style={{ gap: 10 }}>
              {panel.reportes.map((r) => (
                <View key={r.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.warm }]}>
                  <View style={styles.row}>
                    <FlagIcon color={colors.warm} size={16} />
                    <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>Sobre {r.a}</Text>
                    <Text style={[text.small, { color: colors.muted }]}>{ago(r.creado)}</Text>
                  </View>
                  <Text style={[text.body, { color: colors.text, marginTop: 6 }]}>{r.motivo}</Text>
                  {!!r.detalle && <Text style={[styles.detalle, { color: colors.text, borderColor: colors.border }]}>«{r.detalle}»</Text>}
                  <Text style={[text.small, { color: colors.muted, marginTop: 6 }]}>Lo reportó {r.de}. Conversa con los dos antes de decidir.</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <SectionTitle>Pedidos para entrar</SectionTitle>
        {panel.pendientes.length ? (
          <View style={{ gap: 10 }}>
            {panel.pendientes.map((p) => (
              <Pedido key={p.id} p={p} colors={colors} onDone={reload} />
            ))}
          </View>
        ) : (
          <Text style={[text.body, { color: colors.muted }]}>No hay pedidos nuevos.</Text>
        )}

        <SectionTitle>Personas del círculo</SectionTitle>
        <View style={{ gap: 10 }}>
          {panel.miembros.map((m) => (
            <Miembro key={m.id} m={m} reportes={panel.reportes.filter((r) => r.aId === m.id).length} colors={colors} onDone={reload} />
          ))}
          {!panel.miembros.length && <Text style={[text.body, { color: colors.muted }]}>Todavía no hay nadie aprobado.</Text>}
        </View>
      </>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Liderar el círculo' }} />
      {contenido}
    </ScrollView>
  );
}

function Stat({ valor, etiqueta, colors }: { valor: number | string; etiqueta: string; colors: Colors }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontFamily: serif, fontSize: 24 }}>{valor}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>{etiqueta}</Text>
    </View>
  );
}

function Quien({ p, colors }: { p: PersonaLider; colors: Colors }) {
  return (
    <View style={styles.row}>
      <Avatar name={p.nombre} foto={p.foto} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{p.nombre}</Text>
        <Text style={[text.small, { color: colors.muted, marginTop: 2 }]}>{[`${p.edad} años`, etapaCorta(p.etapa)].filter(Boolean).join(' · ')}</Text>
        {!!p.correo && (
          <Text style={[text.small, { color: colors.muted }]} numberOfLines={1} selectable>
            {p.correo}
          </Text>
        )}
      </View>
      {p.etapa === 'abierto' && <HeartIcon color={colors.warm} size={16} />}
    </View>
  );
}

function Pedido({ p, colors, onDone }: { p: PersonaLider; colors: Colors; onDone: () => void }) {
  const act = useAction();
  const decidir = async (si: boolean) => {
    if (!si && !(await confirm(`¿No aprobar a ${p.nombre}?`, 'Se le avisará que esta vez no fue aprobado y que puede hablar con un líder.', 'No aprobar'))) return;
    if (await act.run(() => aprobar(p.id, si))) onDone();
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Quien p={p} colors={colors} />
      {!!p.bio && <Text style={[text.body, { color: colors.text, marginTop: 10 }]}>{p.bio}</Text>}
      <Text style={[text.small, { color: colors.muted, marginTop: 10, lineHeight: 19 }]}>
        Aprueba solo a quien conoces de la iglesia, o después de hablar en persona.
      </Text>
      <View style={[styles.buttons, { marginTop: 12 }]}>
        <Button label="Aprobar" onPress={() => decidir(true)} busy={act.busy} style={{ flex: 1 }} />
        <Button label="No aprobar" kind="outline" onPress={() => decidir(false)} style={{ flex: 1 }} />
      </View>
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

function Miembro({ m, reportes, colors, onDone }: { m: PersonaLider & { pausado: boolean }; reportes: number; colors: Colors; onDone: () => void }) {
  const act = useAction();
  const hacer = async (que: 'reactivar' | 'pausar' | 'quitar' | 'revisado') => {
    if (que === 'quitar' && !(await confirm(`¿Quitar a ${m.nombre} del círculo?`, 'Se borran sus marcas y se cierra su «Conocernos». Podrá pedir entrar de nuevo.', 'Quitar'))) return;
    if (que === 'pausar' && !(await confirm(`¿Pausar a ${m.nombre}?`, 'No verá el círculo hasta que lo reactives, y se cierra su «Conocernos».', 'Pausar'))) return;
    if (await act.run(() => revisar(m.id, que))) onDone();
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: m.pausado ? colors.warm : colors.border }]}>
      <Quien p={m} colors={colors} />
      {(m.pausado || reportes > 0) && (
        <Text style={[text.small, { color: colors.warm, marginTop: 8 }]}>
          {m.pausado ? 'En pausa. ' : ''}
          {reportes ? `${reportes} ${reportes === 1 ? 'reporte' : 'reportes'} sin revisar.` : ''}
        </Text>
      )}
      <View style={[styles.buttons, { marginTop: 8 }]}>
        {m.pausado ? (
          <Button label="Reactivar" kind="quiet" onPress={() => hacer('reactivar')} busy={act.busy} />
        ) : (
          <>
            {reportes > 0 && <Button label="Marcar revisado" kind="quiet" onPress={() => hacer('revisado')} busy={act.busy} />}
            <Button label="Pausar" kind="quiet" onPress={() => hacer('pausar')} />
          </>
        )}
        <Button label="Quitar" kind="quiet" onPress={() => hacer('quitar')} />
      </View>
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 12, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  head: { alignItems: 'center', marginTop: 8, marginBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontFamily: serif, fontSize: 28, marginTop: 4, textAlign: 'center' },
  stats: { flexDirection: 'row', alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingVertical: 14, marginTop: 16 },
  nota: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 14, padding: 14 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detalle: { borderLeftWidth: 3, paddingLeft: 10, marginTop: 8, fontFamily: serif, fontSize: 15, lineHeight: 22 },
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
