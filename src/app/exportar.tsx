import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, CopyIcon, DocumentIcon, LockIcon, PrintIcon, ShareIcon } from '@/components/icons';
import { Button, text } from '@/components/comunidad/ui';
import { compartirDocumento } from '@/lib/compartirArchivo';
import { getBooks, getChapter } from '@/lib/data';
import { comoHtml, comoTexto, cuantos, nombreArchivo, PARTES, type Contenido, type Parte, reunir } from '@/lib/exportar';
import { Colors, sans, serif, useColors } from '@/lib/theme';

const web = Platform.OS === 'web' && typeof window !== 'undefined';

function descargar(contenido: string, nombre: string, tipo: string) {
  const blob = new Blob(['﻿', contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function imprimir(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

/** «Llévate lo tuyo»: notas, diario, oraciones y mensajes del Taller en Word, PDF o texto (src/lib/exportar.ts). */
export default function Exportar() {
  const colors = useColors();
  const [contenido, setContenido] = useState<Contenido | null>(null);
  const [elegidas, setElegidas] = useState<Parte[]>(PARTES.map((p) => p.value));
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    getBooks()
      .then((books) => reunir(books, (b, c) => getChapter(b, c)))
      .then(setContenido)
      .catch(() => setContenido({ versiculos: [], diario: [], oraciones: [], mensajes: [], borradores: 0 }));
  }, []);

  const flash = (t: string) => {
    setAviso(t);
    setTimeout(() => setAviso(null), 2600);
  };
  const conAlgo = contenido ? PARTES.filter((p) => cuantos(contenido, p.value) > 0).map((p) => p.value) : [];
  const partes = elegidas.filter((p) => conAlgo.includes(p));
  const nada = !!contenido && !conAlgo.length;
  const alternar = (p: Parte) => setElegidas((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p]));

  const word = () => {
    if (!contenido) return;
    descargar(comoHtml(contenido, partes), `${nombreArchivo()}.doc`, 'application/msword');
    flash('Listo: se descargó el documento.');
  };
  const pdf = () => contenido && imprimir(comoHtml(contenido, partes));
  const copiar = async () => {
    if (!contenido) return;
    await Clipboard.setStringAsync(comoTexto(contenido, partes));
    flash('Copiado. Pégalo en tus notas, un correo o donde quieras.');
  };
  const compartir = async () => {
    if (!contenido) return;
    try {
      await compartirDocumento(comoHtml(contenido, partes), nombreArchivo(), 'Lo mío en Zarza');
    } catch {
      await Share.share({ message: comoTexto(contenido, partes) }).catch(() => {});
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: '' }} />
      <View style={[styles.halo, { backgroundColor: colors.accentSoft }]}>
        <DocumentIcon color={colors.accent} size={28} />
      </View>
      <Text style={[text.title, { color: colors.text }]} accessibilityRole="header">
        Llévate lo tuyo
      </Text>
      <Text style={[text.body, { color: colors.muted }]}>
        Lo que escribes en Zarza es tuyo. Guárdalo en un documento para Word o Google Docs, en PDF o como texto, cuando
        quieras y sin cuenta.
      </Text>

      {!contenido ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
      ) : nada ? (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>Todavía no hay nada que guardar</Text>
          <Text style={[text.body, { color: colors.muted }]}>
            Cuando escribas una nota, resaltes un versículo, llenes tu diario, anotes una oración o prepares algo en el
            Taller, aparecerá aquí para que te lo lleves.
          </Text>
        </View>
      ) : (
        <Appear style={{ gap: 18, marginTop: 8 }}>
          <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {PARTES.map((p, i) => (
              <Opcion
                key={p.value}
                titulo={p.titulo}
                detalle={p.value === 'mensajes' && contenido.borradores ? `${p.detalle} ${contenido.borradores} sin terminar.` : p.detalle}
                n={cuantos(contenido, p.value)}
                marcada={partes.includes(p.value)}
                onPress={() => alternar(p.value)}
                colors={colors}
                borde={i > 0}
              />
            ))}
          </View>

          <View style={styles.actions}>
            {web ? (
              <>
                <Button label="Documento para Word" icon={DocumentIcon} onPress={word} disabled={!partes.length} />
                <Button label="Guardar en PDF" icon={PrintIcon} kind="outline" onPress={pdf} disabled={!partes.length} />
              </>
            ) : (
              <Button label="Guardar o enviar el documento" icon={ShareIcon} onPress={compartir} disabled={!partes.length} />
            )}
            <Button label="Copiar como texto" icon={CopyIcon} kind="outline" onPress={copiar} disabled={!partes.length} />
          </View>
          {web && (
            <Text style={[styles.hint, { color: colors.muted }]}>
              Para el PDF se abre la ventana de imprimir: elige «Guardar como PDF».
            </Text>
          )}
          {!!aviso && (
            <Text role="status" style={[styles.aviso, { color: colors.text, backgroundColor: colors.accentSoft }]}>
              {aviso}
            </Text>
          )}
        </Appear>
      )}

      <View style={styles.privacy}>
        <LockIcon color={colors.muted} size={15} />
        <Text style={[styles.hint, { color: colors.muted, flex: 1 }]}>
          El documento se arma en tu dispositivo. No se envía a ningún sitio.
        </Text>
      </View>
    </ScrollView>
  );
}

function Opcion({
  titulo,
  detalle,
  n,
  marcada,
  onPress,
  colors,
  borde,
}: {
  titulo: string;
  detalle: string;
  n: number;
  marcada: boolean;
  onPress: () => void;
  colors: Colors;
  borde: boolean;
}) {
  const vacia = n === 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={vacia}
      role="checkbox"
      aria-checked={marcada}
      aria-disabled={vacia}
      accessibilityLabel={`${titulo}: ${n}`}
      style={({ pressed }) => [styles.row, borde && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, (pressed || vacia) && { opacity: vacia ? 0.45 : 0.7 }]}
    >
      <View style={[styles.box, { borderColor: marcada ? colors.accent : colors.border, backgroundColor: marcada ? colors.accent : 'transparent' }]}>
        {marcada && <CheckIcon color={colors.background} size={14} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{titulo}</Text>
        <Text style={[styles.rowDetail, { color: colors.muted }]}>{vacia ? 'Aún no hay nada.' : detalle}</Text>
      </View>
      <Text style={[styles.count, { color: colors.muted }]}>{n}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' },
  halo: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: sans, fontSize: 15.5, fontWeight: '700' },
  rowDetail: { fontFamily: sans, fontSize: 13, lineHeight: 18 },
  count: { fontFamily: serif, fontSize: 18, fontWeight: '700', minWidth: 22, textAlign: 'right' },
  actions: { gap: 10 },
  hint: { fontFamily: sans, fontSize: 12.5, lineHeight: 18 },
  aviso: { fontFamily: sans, fontSize: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 18, gap: 6, marginTop: 8 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
});
