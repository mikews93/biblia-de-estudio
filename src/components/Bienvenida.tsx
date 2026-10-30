import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Button } from '@/components/comunidad/ui';
import { BooksIcon, CheckIcon, ContrastIcon, FlameIcon, HeartIcon, type IconProps, LecternIcon, MoonIcon, PeopleIcon, PlansIcon, SparkIcon, SunIcon } from '@/components/icons';
import { METAS, type Meta, SOBRE_VERSION, bienvenidaVista } from '@/lib/bienvenida';
import { type Version, getVersions } from '@/lib/data';
import { type ThemeName, isDark, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const ICONO_META: Record<Meta, (p: IconProps) => React.ReactNode> = {
  leer: PlansIcon,
  estudiar: SparkIcon,
  ensenar: LecternIcon,
  grupo: PeopleIcon,
  orar: HeartIcon,
};

const TEMAS: { value: ThemeName; label: string; icon: (p: IconProps) => React.ReactNode }[] = [
  { value: 'auto', label: 'Como el teléfono', icon: ContrastIcon },
  { value: 'claro', label: 'Claro', icon: SunIcon },
  { value: 'sepia', label: 'Sepia', icon: BooksIcon },
  { value: 'oscuro', label: 'Oscuro', icon: MoonIcon },
];

const PASOS = 3;

/**
 * La bienvenida de la primera vez (src/lib/bienvenida.ts): 1) la versión, 2) qué quieres hacer, 3) la letra y el tema,
 * con una vista previa. Todo se puede cambiar después y cada paso se puede saltar.
 */
export default function Bienvenida({ onDone }: { onDone: () => void }) {
  const colors = useColors();
  const { settings, update } = useSettings();
  const [paso, setPaso] = useState(0);
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    getVersions()
      .then((v) => setVersiones(v))
      .catch(() => {});
  }, []);

  const terminar = (ir: boolean) => {
    bienvenidaVista();
    onDone();
    const destino = ir && meta ? METAS.find((m) => m.value === meta)?.href : null;
    if (destino) navigate(() => router.push(destino as never), 'forward');
  };
  const siguiente = () => (paso < PASOS - 1 ? setPaso(paso + 1) : terminar(true));

  const libres = versiones.filter((v) => !v.licensed);
  const conDerechos = versiones.filter((v) => v.licensed);

  return (
    <Modal visible animationType="fade" onRequestClose={() => terminar(false)}>
      <View style={[styles.fondo, { backgroundColor: colors.background }]}>
        <View style={styles.barra}>
          <View style={styles.puntos} accessibilityLabel={`Paso ${paso + 1} de ${PASOS}`}>
            {Array.from({ length: PASOS }, (_, i) => (
              <View key={i} style={[styles.punto, { backgroundColor: i <= paso ? colors.accent : colors.border }, i === paso && styles.puntoActivo]} />
            ))}
          </View>
          <Pressable onPress={() => terminar(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Saltar la bienvenida">
            <Text style={[styles.saltar, { color: colors.muted }]}>Saltar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.page} key={paso}>
          {paso === 0 && (
            <>
              <Appear style={{ alignItems: 'center', gap: 10 }}>
                <View style={[styles.halo, { backgroundColor: colors.warmSoft }]}>
                  <FlameIcon color={colors.warm} size={38} />
                </View>
                <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                  Te damos la bienvenida a Zarza
                </Text>
                <Text style={[styles.tagline, { color: colors.warm }]}>Arde y no se consume</Text>
                <Text style={[styles.lead, { color: colors.muted }]}>Una Biblia para leer cada día y estudiar a fondo, gratis. Primero, ¿en qué versión quieres leer?</Text>
              </Appear>
              <Appear delay={60} style={styles.opciones}>
                {libres.map((v) => (
                  <Opcion
                    key={v.id}
                    on={settings.version === v.id}
                    onPress={() => update({ version: v.id })}
                    titulo={v.name}
                    sigla={v.abbr}
                    detalle={SOBRE_VERSION[v.id] ?? v.credit}
                  />
                ))}
              </Appear>
              {conDerechos.length > 0 && (
                <Text style={[styles.nota, { color: colors.muted }]}>
                  {`También puedes leer ${conDerechos.map((v) => v.abbr).join(', ')} desde el lector, con internet.`}
                </Text>
              )}
            </>
          )}

          {paso === 1 && (
            <>
              <Appear style={{ gap: 8 }}>
                <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                  ¿Qué te gustaría hacer?
                </Text>
                <Text style={[styles.lead, { color: colors.muted }]}>Te llevamos ahí al terminar. Lo demás está en «Todo en Zarza», desde Hoy.</Text>
              </Appear>
              <Appear delay={60} style={styles.opciones}>
                {METAS.map((m) => (
                  <Opcion key={m.value} on={meta === m.value} onPress={() => setMeta(meta === m.value ? null : m.value)} titulo={m.titulo} detalle={m.detalle} icon={ICONO_META[m.value]} />
                ))}
              </Appear>
            </>
          )}

          {paso === 2 && (
            <>
              <Appear style={{ gap: 8 }}>
                <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                  Que se lea bien
                </Text>
                <Text style={[styles.lead, { color: colors.muted }]}>Elige el tamaño de la letra y los colores. Lo cambias cuando quieras con «Aa» en el lector.</Text>
              </Appear>
              <Appear delay={40} style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }, !isDark(colors) && styles.sombra]}>
                <Text style={[styles.previewRef, { color: colors.accent }]}>SALMO 119:105</Text>
                <Text style={{ fontFamily: settings.font === 'serif' ? serif : undefined, fontSize: settings.fontSize, lineHeight: settings.fontSize * 1.6, color: colors.text }}>
                  Lámpara es a mis pies tu palabra, y lumbrera a mi camino.
                </Text>
              </Appear>
              <Appear delay={80} style={[styles.tamano, { borderColor: colors.border }]}>
                <Pressable
                  onPress={() => update({ fontSize: Math.max(14, settings.fontSize - 1) })}
                  style={({ pressed }) => [styles.aa, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Letra más pequeña"
                >
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>A</Text>
                </Pressable>
                <View style={styles.regla} accessibilityLabel={`Tamaño de letra ${settings.fontSize}`}>
                  {Array.from({ length: 9 }, (_, i) => 14 + i * 2).map((n) => (
                    <View key={n} style={[styles.marca, { backgroundColor: settings.fontSize >= n ? colors.accent : colors.border, height: 6 + (n - 14) * 0.8 }]} />
                  ))}
                </View>
                <Pressable
                  onPress={() => update({ fontSize: Math.min(30, settings.fontSize + 1) })}
                  style={({ pressed }) => [styles.aa, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Letra más grande"
                >
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>A</Text>
                </Pressable>
              </Appear>
              <Appear delay={110} style={styles.temas}>
                {TEMAS.map((t) => {
                  const on = settings.theme === t.value;
                  return (
                    <Pressable
                      key={t.value}
                      onPress={() => update({ theme: t.value })}
                      accessibilityRole="radio"
                      aria-selected={on}
                      style={({ pressed }) => [
                        styles.tema,
                        { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <t.icon color={on ? colors.background : colors.text} size={18} />
                      <Text style={{ color: on ? colors.background : colors.text, fontSize: 13.5, fontWeight: '700' }}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </Appear>
            </>
          )}
        </ScrollView>

        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <View style={styles.pie}>
            {paso > 0 ? <Button label="Atrás" kind="quiet" onPress={() => setPaso(paso - 1)} /> : <View />}
            <Button label={paso < PASOS - 1 ? 'Seguir' : meta ? 'Empezar' : 'Ir a Hoy'} onPress={siguiente} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Opcion({
  on,
  onPress,
  titulo,
  sigla,
  detalle,
  icon: Icon,
}: {
  on: boolean;
  onPress: () => void;
  titulo: string;
  sigla?: string;
  detalle: string;
  icon?: (p: IconProps) => React.ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-selected={on}
      accessibilityLabel={`${titulo}. ${detalle}`}
      style={({ pressed }) => [
        styles.opcion,
        { backgroundColor: colors.surface, borderColor: on ? colors.accent : colors.border, borderWidth: on ? 1.5 : StyleSheet.hairlineWidth },
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      {Icon ? (
        <View style={[styles.opcionIcono, { backgroundColor: colors.accentSoft }]}>
          <Icon color={colors.accent} size={20} />
        </View>
      ) : (
        <View style={[styles.sigla, { backgroundColor: on ? colors.accent : colors.accentSoft }]}>
          <Text style={{ color: on ? colors.background : colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>{sigla}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.opcionTitulo, { color: colors.text }]}>{titulo}</Text>
        <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 18, marginTop: 2 }}>{detalle}</Text>
      </View>
      <View style={[styles.check, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : 'transparent' }]}>
        {on && <CheckIcon color={colors.background} size={14} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
  barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6, maxWidth: 560, width: '100%', alignSelf: 'center' },
  puntos: { flexDirection: 'row', gap: 6 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  puntoActivo: { width: 24 },
  saltar: { fontSize: 15, fontWeight: '600' },
  page: { padding: 20, paddingTop: 16, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  halo: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 38, fontWeight: '700', textAlign: 'center' },
  tagline: { fontFamily: serif, fontStyle: 'italic', fontSize: 17 },
  lead: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  opciones: { gap: 10 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 },
  opcionIcono: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sigla: { minWidth: 52, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  opcionTitulo: { fontSize: 16, fontWeight: '700' },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  nota: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  preview: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 8 },
  sombra: { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' } as never,
  previewRef: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2 },
  tamano: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aa: { width: 52, height: 52, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  regla: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 24 },
  marca: { width: 4, borderRadius: 2 },
  temas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tema: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 13 },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
