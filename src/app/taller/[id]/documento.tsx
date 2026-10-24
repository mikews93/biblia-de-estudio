import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { confirm } from '@/components/comunidad/confirm';
import { Button, Field, text } from '@/components/comunidad/ui';
import { CheckIcon, CloseIcon, DocumentIcon, type IconProps, PencilIcon, PlayIcon, PlusIcon, PrintIcon, RepeatIcon, ShareIcon } from '@/components/icons';
import DocumentoVista from '@/components/taller/DocumentoVista';
import { Book, getBooks } from '@/lib/data';
import { descargarWord, documentoDe, documentoTexto, fechaLarga, imprimir, puedeImprimir } from '@/lib/documento';
import { anotarOcasion, borrarMensaje, duplicarMensaje, quitarOcasion, terminarMensaje, useTaller, volverABorrador } from '@/lib/taller';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** El documento final de un mensaje: para leerlo, imprimirlo o guardarlo en PDF, y para volver a predicarlo. */
export default function DocumentoScreen() {
  const { id, desde } = useLocalSearchParams<{ id: string; desde?: string }>();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { mensajes, ready } = useTaller();
  const [books, setBooks] = useState<Book[]>([]);
  const [nota, setNota] = useState<string | null>(null);
  const [anotando, setAnotando] = useState(false);
  const [fecha, setFecha] = useState(hoy());
  const [lugar, setLugar] = useState('');
  const m = mensajes.find((x) => x.id === id);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  if (!ready || !books.length) return <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />;
  if (!m) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: 'Documento' }} />
        <Text style={[text.body, { color: colors.text }]}>Este mensaje ya no existe en este dispositivo.</Text>
        <Button label="Volver al Taller" kind="outline" onPress={() => router.replace('/taller')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const d = documentoDe(m, books);
  const flash = (t: string) => {
    setNota(t);
    setTimeout(() => setNota(null), 2400);
  };
  const compartir = async () => {
    const message = documentoTexto(d);
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      flash('Copiado. Pégalo en WhatsApp o donde quieras.');
    }
  };
  const anotar = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return flash('Escribe la fecha como 2026-10-25.');
    anotarOcasion(m.id, { fecha, lugar });
    setAnotando(false);
    setLugar('');
    flash('Anotado.');
  };
  const adaptar = async () => {
    const copia = await duplicarMensaje(m.id);
    if (copia) navigate(() => router.replace(`/taller/${copia}`), 'forward');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, width >= 820 && { paddingTop: 32 }]}>
      <Stack.Screen options={{ title: m.terminado ? 'Mis sermones' : 'Documento' }} />

      <View style={styles.estado}>
        {m.terminado ? (
          <View style={[styles.chip, { backgroundColor: colors.warmSoft }]}>
            <CheckIcon color={colors.warm} size={14} strokeWidth={2.4} />
            <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>EN MIS SERMONES</Text>
          </View>
        ) : (
          <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
            <PencilIcon color={colors.muted} size={14} strokeWidth={2} />
            <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>BORRADOR</Text>
          </View>
        )}
      </View>

      <View style={styles.acciones}>
        {puedeImprimir && <Accion icon={PrintIcon} label="Imprimir" hint="Imprimir o guardar en PDF" onPress={() => imprimir(d)} />}
        {puedeImprimir && <Accion icon={DocumentIcon} label="Word" onPress={() => (descargarWord(d), flash('Descargado. Se abre en Word o Google Docs.'))} />}
        <Accion icon={ShareIcon} label="Compartir" onPress={compartir} />
        <Accion icon={PlayIcon} label="Presentar" onPress={() => navigate(() => router.push(`/taller/${m.id}/presentar`), 'forward')} />
        <Accion icon={PencilIcon} label="Editar" onPress={() => navigate(() => (desde === 'editor' ? router.back() : router.push(`/taller/${m.id}`)), 'back')} />
      </View>
      {nota && <Text style={{ color: colors.accent, fontWeight: '600', marginBottom: 10, textAlign: 'center' }}>{nota}</Text>}

      <DocumentoVista d={d} vacio="Sin escribir todavía." />

      {m.terminado ? (
        <View style={[styles.caja, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cajaTitulo, { color: colors.text }]}>Veces que lo prediqué</Text>
          {(m.ocasiones ?? []).length === 0 && !anotando && (
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
              Anota cuándo y dónde lo compartiste. Así sabrás dónde ya lo escucharon antes de repetirlo.
            </Text>
          )}
          {(m.ocasiones ?? []).map((o, i) => (
            <View key={`${o.fecha}${i}`} style={[styles.ocasion, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{fechaLarga(o.fecha)}</Text>
                {!!o.lugar && <Text style={{ color: colors.muted, fontSize: 14, marginTop: 1 }}>{o.lugar}</Text>}
              </View>
              <Pressable onPress={() => quitarOcasion(m.id, i)} hitSlop={8} accessibilityLabel={`Quitar ${fechaLarga(o.fecha)}`}>
                <CloseIcon color={colors.muted} size={16} />
              </Pressable>
            </View>
          ))}
          {anotando ? (
            <View style={{ gap: 10, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 140 }}>
                  <Field label="Fecha" value={fecha} onChangeText={setFecha} placeholder="2026-10-25" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Dónde (opcional)" value={lugar} onChangeText={setLugar} placeholder="Iglesia, célula, retiro…" onSubmitEditing={anotar} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Anotar" onPress={anotar} style={{ flex: 1 }} />
                <Button label="Cancelar" kind="quiet" onPress={() => setAnotando(false)} />
              </View>
            </View>
          ) : (
            <Button label="Anotar una vez que lo prediqué" icon={PlusIcon} kind="outline" onPress={() => (setFecha(hoy()), setAnotando(true))} style={{ marginTop: 12 }} />
          )}

          <View style={[styles.separador, { backgroundColor: colors.border }]} />
          <Text style={[styles.cajaTitulo, { color: colors.text }]}>Volver a predicarlo</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            Haz una copia como borrador para adaptarla a otra ocasión. Este queda tal como está.
          </Text>
          <Button label="Adaptarlo para otra ocasión" icon={RepeatIcon} kind="outline" onPress={adaptar} style={{ marginTop: 12 }} />
          <Button
            label="Pasarlo otra vez a borradores"
            kind="quiet"
            onPress={async () => {
              if (await confirm('¿Pasarlo a borradores?', 'Sale de «Mis sermones» hasta que lo vuelvas a terminar.', 'Pasar')) volverABorrador(m.id);
            }}
            style={{ marginTop: 4 }}
          />
        </View>
      ) : (
        <View style={[styles.caja, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cajaTitulo, { color: colors.text }]}>¿Ya está listo?</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            Mientras es borrador, todo lo que escribes se guarda solo. Al terminarlo pasa a «Mis sermones», para revisarlo o
            predicarlo otra vez.
          </Text>
          <Button
            label="Terminar y guardar en Mis sermones"
            icon={CheckIcon}
            onPress={() => (terminarMensaje(m.id), flash('Guardado en Mis sermones.'))}
            style={{ marginTop: 12 }}
          />
        </View>
      )}

      <Button
        label={m.terminado ? 'Borrar este sermón' : 'Descartar este borrador'}
        kind="quiet"
        onPress={async () => {
          const que = m.terminado ? 'sermón' : 'borrador';
          if (await confirm(`¿Borrar este ${que}?`, 'Se borra de este dispositivo y de tu cuenta. No se puede deshacer.', 'Borrar')) {
            borrarMensaje(m.id);
            navigate(() => router.replace('/taller'), 'back');
          }
        }}
        style={{ marginTop: 18, alignSelf: 'center' }}
      />
    </ScrollView>
  );
}

function Accion({ icon: Icon, label, hint, onPress }: { icon: (p: IconProps) => React.ReactNode; label: string; hint?: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ?? label}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.accion,
        { borderColor: colors.border, backgroundColor: hovered ? colors.accentSoft : colors.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon color={colors.accent} size={19} />
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 80, maxWidth: 820, width: '100%', alignSelf: 'center' },
  estado: { alignItems: 'center', marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  acciones: { flexDirection: 'row', gap: 8, marginBottom: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  accion: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4 },
  caja: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 18, marginTop: 18 },
  cajaTitulo: { fontFamily: serif, fontSize: 19, fontWeight: '700' },
  ocasion: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  separador: { height: StyleSheet.hairlineWidth, marginVertical: 18 },
});
