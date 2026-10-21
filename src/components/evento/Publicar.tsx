// En el Taller, paso «Presentar»: publicar el mensaje como evento de iglesia para que la congregación lo siga en
// el teléfono. Se elige qué ve la congregación en cada punto y si los puntos aparecen a medida que se avanza.
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { confirm } from '@/components/comunidad/confirm';
import { Button, Card, ErrorText, Field, SectionTitle, useAction } from '@/components/comunidad/ui';
import { EstadoPill } from '@/components/evento/piezas';
import { ChevronDownIcon, ChevronUpIcon, LiveIcon, ScreenIcon, ShareIcon } from '@/components/icons';
import Qr from '@/components/Qr';
import { useAccount } from '@/lib/comunidad';
import type { Book } from '@/lib/data';
import { borrarEvento, codigoLegible, contenidoDe, desactualizado, enlaceCorto, enlaceEvento, publicarEvento, useMisEventos } from '@/lib/eventos';
import { Mensaje, actualizarMensaje, actualizarSeccion } from '@/lib/taller';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function PublicarEvento({ m, books }: { m: Mensaje; books: Book[] }) {
  const colors = useColors();
  const { usuario } = useAccount();
  const { eventos } = useMisEventos(!!usuario);
  const evento = eventos?.find((e) => e.codigo === m.evento?.codigo) ?? eventos?.find((e) => e.mensaje === m.id);
  const [conNotas, setConNotas] = useState(m.evento?.conNotas ?? false);
  const [gradual, setGradual] = useState(m.evento?.gradual ?? true);
  // Cerrado al llegar: el paso «Presentar» sigue siendo corto hasta que se quiera preparar el evento.
  const [editar, setEditar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const { busy, error, run } = useAction();
  const encuentro = m.tipo === 'encuentro';
  const contenido = contenidoDe(m, books, conNotas);
  const cambios = evento && (desactualizado(evento, m, books) || evento.gradual !== gradual || !!m.evento?.conNotas !== conNotas);

  const publicar = () =>
    run(async () => {
      const e = await publicarEvento({ mensaje: m.id, gradual, ...contenido });
      actualizarMensaje(m.id, { evento: { codigo: e.codigo, conNotas, gradual } });
      setEditar(false);
    });

  const abrir = (sub = '') => evento && navigate(() => router.push(`/evento/${evento.codigo}${sub}`), sub ? 'fade' : 'forward');

  const compartir = async () => {
    if (!evento) return;
    const message = `Sigue el mensaje «${evento.titulo}» en tu teléfono: ${enlaceEvento(evento.codigo)}`;
    try {
      if (Platform.OS === 'web' && !navigator.share) throw new Error('web');
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const quitar = async () => {
    if (!evento || !(await confirm('¿Borrar el evento?', 'El enlace dejará de funcionar. Las notas que tomó cada persona se quedan en su teléfono.', 'Borrar'))) return;
    await run(async () => {
      await borrarEvento(evento.codigo);
      actualizarMensaje(m.id, { evento: undefined });
      setEditar(true);
    });
  };

  return (
    <View style={{ gap: 12 }}>
      <SectionTitle>Evento en vivo</SectionTitle>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
        La congregación sigue tu bosquejo en el teléfono mientras predicas: ve el punto en que vas, abre los versículos con un
        toque y toma sus notas. Entra con un código o un QR, sin instalar nada.
      </Text>

      {!usuario ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>Para publicar un evento necesitas una cuenta gratuita.</Text>
          <Button label="Entrar o crear cuenta" kind="outline" onPress={() => navigate(() => router.push('/entrar'), 'forward')} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : (
        <>
          {evento && (
            <View style={[styles.live, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.liveTop}>
                <View style={[styles.qr, { borderColor: colors.border }]}>
                  <Qr value={enlaceEvento(evento.codigo)} size={104} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <EstadoPill estado={evento.estado} colors={colors} />
                  <Text style={[styles.code, { color: colors.text }]} accessibilityLabel={`Código ${evento.codigo}`}>
                    {codigoLegible(evento.codigo)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                    {enlaceCorto(evento.codigo)}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Button label="Abrir el evento" icon={LiveIcon} onPress={() => abrir()} style={{ flex: 1, minWidth: 180 }} />
                <Button label="Proyectar" icon={ScreenIcon} kind="outline" onPress={() => abrir('/proyectar')} style={{ flex: 1, minWidth: 180 }} />
              </View>
              <Button label={copiado ? 'Enlace copiado' : 'Compartir el enlace'} icon={ShareIcon} kind="quiet" onPress={compartir} style={{ alignSelf: 'flex-start' }} />
              {cambios && !editar && (
                <View style={[styles.notice, { backgroundColor: colors.warmSoft }]}>
                  <Text style={{ color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 }}>Cambiaste el mensaje después de publicarlo.</Text>
                  <Button label="Actualizar" kind="outline" onPress={publicar} busy={busy} />
                </View>
              )}
            </View>
          )}

          {!evento && !editar && (
            <Button label="Preparar el evento en vivo" icon={LiveIcon} kind="outline" onPress={() => setEditar(true)} />
          )}

          {evento && (
            <Pressable onPress={() => setEditar(!editar)} style={styles.toggleRow} accessibilityRole="button" accessibilityState={{ expanded: editar }}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Qué ve la congregación</Text>
              {editar ? <ChevronUpIcon color={colors.accent} size={16} /> : <ChevronDownIcon color={colors.accent} size={16} />}
            </Pressable>
          )}

          {editar && (
            <Card style={{ gap: 14 }}>
              <Opcion
                label="Mostrar los puntos a medida que avanzo"
                detalle="Los que vienen no se ven hasta que llegues a ellos. Al terminar se muestran todos."
                value={gradual}
                onChange={setGradual}
                colors={colors}
              />
              {!encuentro && (
                <Opcion
                  label="Incluir mis notas completas"
                  detalle="Si no, cada punto muestra su título, lo que escribas abajo y los versículos que citas en tus notas."
                  value={conNotas}
                  onChange={setConNotas}
                  colors={colors}
                />
              )}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              {m.secciones.map((s, i) => {
                const p = contenido.puntos[i];
                return (
                  <View key={s.id} style={{ gap: 8 }}>
                    <Text style={[styles.pointTitle, { color: colors.text }]}>
                      {i + 1}. {p.titulo}
                    </Text>
                    <Field
                      value={s.paraGrupo ?? ''}
                      onChangeText={(t) => actualizarSeccion(m.id, s.id, { paraGrupo: t })}
                      placeholder={encuentro ? 'Lo que ve el grupo en esta parte' : 'Para la congregación: una frase, una pregunta o un espacio para llenar (opcional)'}
                      accessibilityLabel={`Para la congregación, punto ${i + 1}`}
                      multiline
                      style={{ minHeight: 56 }}
                    />
                    {p.citas.length > 0 && <Text style={{ color: colors.muted, fontSize: 13 }}>Versículos: {p.citas.join(' · ')}</Text>}
                  </View>
                );
              })}
              <Button label={evento ? 'Guardar los cambios del evento' : 'Publicar como evento'} onPress={publicar} busy={busy} />
              {!evento && (
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                  Recibirás un código corto. El evento empieza cuando toques «Empezar en vivo» o al presentar el mensaje.
                </Text>
              )}
            </Card>
          )}
          <ErrorText>{error}</ErrorText>
          {evento && (
            <Button label="Borrar el evento" kind="quiet" onPress={quitar} style={{ alignSelf: 'flex-start' }} />
          )}
        </>
      )}
    </View>
  );
}

function Opcion({ label, detalle, value, onChange, colors }: { label: string; detalle: string; value: boolean; onChange: (v: boolean) => void; colors: Colors }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.option} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{detalle}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.surface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  live: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  liveTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qr: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 6, backgroundColor: '#FFFFFF' },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 3, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: StyleSheet.hairlineWidth },
  pointTitle: { fontFamily: serif, fontSize: 17, fontWeight: '700' },
});
