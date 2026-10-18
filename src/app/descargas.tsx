import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, DownloadIcon, OfflineIcon } from '@/components/comunidad/icons';
import { SectionTitle, text } from '@/components/comunidad/ui';
import { useOnline } from '@/lib/conexion';
import { Book, Version, getVersions } from '@/lib/data';
import {
  ORIGINAL,
  REFERENCIAS,
  cancel,
  download,
  downloadedBytes,
  formatBytes,
  packBytes,
  remove,
  removeAll,
  textPack,
  useDownloads,
} from '@/lib/descargas';
import { Colors, isDark, serif, useColors, useSettings } from '@/lib/theme';

type Downloads = ReturnType<typeof useDownloads>;
type Option = { label: string; ids: string[] };

/** Leer sin conexión: qué está guardado en este dispositivo, descargar versiones y libros, y qué necesita internet. */
export default function Descargas() {
  const colors = useColors();
  const online = useOnline();
  const d = useDownloads();
  const { settings } = useSettings();
  const [versions, setVersions] = useState<Version[]>([]);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    getVersions().then(setVersions).catch(() => {});
  }, []);

  const ids = (t?: Book['testament']) => d.books.filter((b) => !t || b.testament === t).map((b) => b.id);
  const saved = downloadedBytes(d);
  const anything = Object.keys(d.index).length > 0;
  // La versión que se lee va primero
  const ordered = [...versions].sort((a, b) => Number(b.id === settings.version) - Number(a.id === settings.version));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Sin conexión' }} />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
            {online ? <DownloadIcon color={colors.accent} size={28} /> : <OfflineIcon color={colors.accent} size={28} />}
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Lee sin conexión</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 460 }]}>
            Descarga las traducciones completas que quieras. Se guardan en este dispositivo y se abren aunque no tengas internet: en el avión, en el campo o con pocos datos.
          </Text>
          <View style={styles.pills}>
            <View style={[styles.pill, { backgroundColor: colors.accentSoft }]} accessibilityLabel={online ? 'Con conexión' : 'Sin conexión'}>
              <View style={[styles.dot, { backgroundColor: online ? '#3F8F5A' : colors.muted }]} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{online ? 'Con conexión' : 'Sin conexión'}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                {anything ? `${formatBytes(saved)} guardados` : 'Nada descargado aún'}
              </Text>
            </View>
            {d.free != null && d.free < 2e9 && (
              <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{formatBytes(d.free)} libres</Text>
              </View>
            )}
          </View>
        </View>
      </Appear>

      {d.ready && !d.supported && (
        <Appear delay={40}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Muy pronto en la app del teléfono</Text>
            <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
              Por ahora las descargas funcionan en la web, abierta en el navegador o instalada en la pantalla de inicio. Los capítulos que ya leíste se pueden volver a abrir sin conexión.
            </Text>
          </View>
        </Appear>
      )}

      {d.supported && (
        <>
          <SectionTitle>Versiones de la Biblia</SectionTitle>
          {!d.ready && <ActivityIndicator color={colors.accent} />}
          {d.ready &&
            ordered.map((v, i) => (
              <Appear key={v.id} delay={40 + i * 20}>
                <PackCard
                  d={d}
                  online={online}
                  pack={textPack(v.id)}
                  title={v.name}
                  tag={v.id === settings.version ? 'La que lees' : v.abbr}
                  subtitle={v.credit.replace(`${v.name} · `, '')}
                  quiet={v.id !== settings.version}
                  options={[{ label: 'Descargar la traducción completa', ids: ids() }]}
                />
              </Appear>
            ))}

          <SectionTitle>Para estudiar</SectionTitle>
          {d.ready && (
            <>
              <Appear delay={60}>
                <PackCard
                  d={d}
                  online={online}
                  pack={ORIGINAL}
                  title="Texto original"
                  tag="Interlineal"
                  subtitle="Cada palabra en hebreo o en griego, con su significado y su forma (STEPBible, CC BY 4.0). Es lo que más ocupa."
                  options={[
                    { label: 'Hebreo y griego', ids: ids() },
                    { label: 'Solo griego · NT', ids: ids('NT') },
                    { label: 'Solo hebreo · AT', ids: ids('AT') },
                  ]}
                />
              </Appear>
              <Appear delay={80}>
                <PackCard
                  d={d}
                  online={online}
                  pack={REFERENCIAS}
                  title="Referencias cruzadas"
                  tag="Versículos"
                  subtitle="Otros pasajes que hablan de lo mismo, en el panel de cada versículo (OpenBible.info, CC BY)."
                  options={[{ label: 'Descargar', ids: ids() }]}
                />
              </Appear>
            </>
          )}
        </>
      )}

      <SectionTitle>Necesitan conexión</SectionTitle>
      <Appear delay={100}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 6 }]}>
          {NEEDS_NET.map(([title, detail], i) => (
            <View key={title} style={[styles.netRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
              <Text style={{ color: colors.accent, fontFamily: serif, fontSize: 18, width: 26 }}>{NEEDS_NET_ICONS[i]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{title}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </Appear>

      {anything && (
        <Pressable
          onPress={() => {
            if (!confirmAll) return setConfirmAll(true);
            setConfirmAll(false);
            removeAll();
          }}
          style={({ pressed }) => [styles.clearAll, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: confirmAll ? '#B3412E' : colors.muted, fontWeight: '600' }}>
            {confirmAll ? `Toca otra vez para borrar ${formatBytes(saved)}` : 'Borrar todo lo descargado'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const NEEDS_NET: [string, string][] = [
  ['Estudiar con IA', 'El estudio del pasaje, las preguntas, el resumen en audio, las tarjetas y el mapa mental.'],
  ['Comunidad y grupos', 'Publicaciones, amigos, grupos de lectura y oración.'],
  ['Buscar por idea', 'Buscar una cita, como «Juan 3:16», sí funciona sin conexión.'],
  ['Comentarios', 'Los que ya abriste quedan guardados; los nuevos se traen de internet.'],
];
const NEEDS_NET_ICONS = ['✦', '◎', '⌕', '❡'];

function PackCard({
  d,
  online,
  pack,
  title,
  tag,
  subtitle,
  options,
  quiet,
}: {
  d: Downloads;
  online: boolean;
  pack: string;
  title: string;
  tag: string;
  subtitle: string;
  options: Option[];
  /** Botón de descarga discreto (las versiones que no se leen). */
  quiet?: boolean;
}) {
  const colors = useColors();
  const have = d.index[pack] ?? [];
  const job = d.jobs[pack];
  const all = d.books.map((b) => b.id);
  const complete = all.length > 0 && all.every((id) => have.includes(id));
  const missing = (ids: string[]) => ids.filter((id) => !have.includes(id));
  const fullSize = packBytes(d.manifest, pack, all);
  const pending = job ? job.books.filter((id) => !have.includes(id)).length : 0;
  const pct = job?.total ? Math.round((job.done / job.total) * 100) : 0;
  const status = complete ? 'Descargada' : have.length ? `${have.length} de ${all.length} libros` : null;

  return (
    <View testID={`paquete-${pack}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: complete ? colors.accent : colors.border }, shadow(colors)]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tag, { color: colors.accent }]}>{tag}</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {status && (
          <View style={[styles.status, { backgroundColor: complete ? colors.accent : colors.accentSoft }]}>
            {complete && <CheckIcon color={colors.surface} size={14} />}
            <Text style={{ color: complete ? colors.surface : colors.accent, fontSize: 12, fontWeight: '700' }}>{status}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }}>{subtitle}</Text>

      {job && !job.error && (
        <View style={{ marginTop: 14 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
          <View style={[styles.bar, { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.barFill, { backgroundColor: colors.accent, width: `${Math.max(3, pct)}%` }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
              Descargando… {pct} %
              <Text style={{ color: colors.muted, fontWeight: '400' }}>
                {'  '}
                {job.books.length - pending} de {job.books.length} {job.books.length === 1 ? 'libro' : 'libros'}
              </Text>
            </Text>
            <Pressable onPress={() => cancel(pack)} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Detener</Text>
            </Pressable>
          </View>
        </View>
      )}

      {job?.error && (
        <View style={[styles.errorBox, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, flex: 1 }}>{job.error}</Text>
          <Pressable onPress={() => download(pack, job.books)} disabled={!online} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13, opacity: online ? 1 : 0.5 }}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {!job && (
        <View style={styles.actions}>
          {complete ? (
            <ActionButton label={`Quitar · ${formatBytes(fullSize)}`} kind="outline" colors={colors} onPress={() => remove(pack, all)} />
          ) : (
            options
              .filter((o) => missing(o.ids).length > 0)
              .map((o, i) => (
                <ActionButton
                  key={o.label}
                  label={`${o.label} · ${formatBytes(packBytes(d.manifest, pack, missing(o.ids)))}`}
                  kind={i === 0 && !quiet ? 'primary' : 'soft'}
                  disabled={!online}
                  colors={colors}
                  onPress={() => download(pack, o.ids)}
                />
              ))
          )}
        </View>
      )}
      {!job && !online && !complete && (
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Conéctate a internet para descargar.</Text>
      )}

    </View>
  );
}

function ActionButton({
  label,
  kind,
  disabled,
  colors,
  onPress,
}: {
  label: string;
  kind: 'primary' | 'soft' | 'outline';
  disabled?: boolean;
  colors: Colors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        kind === 'primary' && { backgroundColor: colors.accent },
        kind === 'soft' && { backgroundColor: colors.accentSoft },
        kind === 'outline' && { borderWidth: 1.5, borderColor: colors.border },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
      ]}
    >
      {kind !== 'outline' && <DownloadIcon color={kind === 'primary' ? colors.surface : colors.accent} size={18} />}
      <Text style={{ color: kind === 'primary' ? colors.surface : kind === 'soft' ? colors.accent : colors.text, fontWeight: '700', fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 64, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 10, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: serif, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tag: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { fontFamily: serif, fontSize: 20, marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12, marginTop: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 },
  netRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
  clearAll: { alignSelf: 'center', padding: 12, marginTop: 4 },
});
