import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CloudCheckIcon, CloudUpIcon, DevicesIcon, OfflineIcon, RefreshIcon } from '@/components/icons';
import { ago, useAccount } from '@/lib/comunidad';
import { useDiario } from '@/lib/diario';
import { useAllHighlights } from '@/lib/highlights';
import { useNotes } from '@/lib/notas';
import { usePlans } from '@/lib/planes';
import { useProgress } from '@/lib/progress';
import { alUnirseALaCuenta, conectar, Estado, sincronizar, useSincronia } from '@/lib/sincronia';
import { useCards } from '@/lib/tarjetas';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';
// Los almacenes se registran al importarse: este archivo se carga con la app, así que todos están desde el inicio.
import '@/lib/misPreguntas';
import '@/lib/taller';

/** Cada cuánto se mira si otro dispositivo cambió algo, con la app abierta. */
const CADA = 4 * 60_000;

/**
 * Sin interfaz salvo un aviso: une la sincronía a la cuenta al entrar o salir, sincroniza al volver a la app
 * y cada pocos minutos, y la primera vez avisa que el progreso quedó guardado (o que llegó de la cuenta).
 */
export default function SincroniaCuenta() {
  const colors = useColors();
  const { ready, llave, usuario } = useAccount();
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (ready) conectar(llave, usuario?.id ?? null);
  }, [ready, llave, usuario?.id]);

  useEffect(
    () =>
      alUnirseALaCuenta((traidas) => {
        setAviso(traidas ? 'Trajimos tu progreso de la cuenta' : 'Tu progreso quedó guardado en tu cuenta');
        setTimeout(() => setAviso(null), 3500);
      }),
    [],
  );

  useEffect(() => {
    if (!llave) return;
    let last = Date.now();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - last > 30_000) {
        last = Date.now();
        sincronizar();
      }
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        last = Date.now();
        sincronizar();
      }
    }, CADA);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [llave]);

  if (!aviso) return null;
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={[styles.toast, { backgroundColor: colors.text }]} accessibilityLiveRegion="polite" testID="aviso-sincronia">
        <CloudCheckIcon color={colors.background} size={18} />
        <Text style={{ color: colors.background, fontWeight: '700' }}>{aviso}</Text>
      </View>
    </View>
  );
}

const TEXTOS: Record<Exclude<Estado, 'sin-cuenta'>, { titulo: string; corto: string }> = {
  'al-dia': { titulo: 'Todo guardado en tu cuenta', corto: 'Guardado en tu cuenta' },
  guardando: { titulo: 'Guardando en tu cuenta…', corto: 'Guardando…' },
  pendiente: { titulo: 'Guardando en tu cuenta…', corto: 'Guardando…' },
  'sin-conexion': { titulo: 'Sin conexión', corto: 'Sin conexión: se guardará al volver' },
  error: { titulo: 'No se pudo guardar', corto: 'No se pudo guardar' },
};

function EstadoIcono({ estado, colors, size = 22 }: { estado: Estado; colors: Colors; size?: number }) {
  if (estado === 'sin-conexion') return <OfflineIcon color={colors.muted} size={size} />;
  if (estado === 'guardando' || estado === 'pendiente') return <CloudUpIcon color={colors.accent} size={size} />;
  if (estado === 'error') return <RefreshIcon color={colors.accent} size={size} />;
  return <CloudCheckIcon color={colors.accent} size={size} />;
}

/** Cómo se lee el estado de la sincronía (para el botón del perfil en Hoy), o null sin cuenta. */
export function useEstadoNube(): string | null {
  const { usuario } = useAccount();
  const { estado } = useSincronia();
  if (!usuario || estado === 'sin-cuenta') return null;
  return TEXTOS[estado].corto;
}

/** Insignia con una nube sobre la foto del botón del perfil en Hoy: el estado de la sincronía. */
export function NubeEstado() {
  const colors = useColors();
  const { usuario } = useAccount();
  const { estado } = useSincronia();
  if (!usuario || estado === 'sin-cuenta') return null;
  const tinta = estado === 'error' ? colors.surface : estado === 'sin-conexion' ? colors.muted : colors.accent;
  return (
    <View
      pointerEvents="none"
      testID="nube-estado"
      style={[styles.badge, { backgroundColor: estado === 'error' ? colors.accent : colors.surface, borderColor: colors.background }]}
    >
      {estado === 'sin-conexion' ? (
        <OfflineIcon color={tinta} size={13} strokeWidth={2.2} />
      ) : estado === 'guardando' || estado === 'pendiente' ? (
        <CloudUpIcon color={tinta} size={13} strokeWidth={2.2} />
      ) : (
        <CloudCheckIcon color={tinta} size={13} strokeWidth={2.2} />
      )}
    </View>
  );
}

/** Tarjeta del perfil: qué se guarda en la cuenta y cuándo se sincronizó. */
export function ProgresoCuenta() {
  const colors = useColors();
  const { estado, error, ultima } = useSincronia();
  const progress = useProgress();
  const notes = useNotes();
  const highlights = useAllHighlights();
  const plans = usePlans();
  const cards = useCards();
  const diario = useDiario();
  const [, setTick] = useState(0);
  const girando = estado === 'guardando' || estado === 'pendiente';

  // El «hace 2 min» se mantiene al día con la pantalla abierta.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const chapters = Object.values(progress.chapters).reduce((s, c) => s + c.length, 0);
  const marks = Object.keys(notes).length + Object.keys(highlights).length;
  const stats = [
    { n: chapters, label: chapters === 1 ? 'capítulo leído' : 'capítulos leídos' },
    { n: marks, label: marks === 1 ? 'nota o resaltado' : 'notas y resaltados' },
    { n: plans.length, label: plans.length === 1 ? 'plan' : 'planes' },
  ];
  const extra = [
    Object.keys(cards).length ? `${Object.keys(cards).length} tarjetas` : null,
    diario.length ? `${diario.length} ${diario.length === 1 ? 'entrada' : 'entradas'} del diario` : null,
  ].filter(Boolean);
  const t = estado === 'sin-cuenta' ? TEXTOS['al-dia'] : TEXTOS[estado];
  const detalle =
    estado === 'error'
      ? (error ?? 'Lo intentaremos otra vez en un momento.')
      : estado === 'sin-conexion'
        ? 'Lo que hagas se queda en este dispositivo y se guarda al volver la conexión.'
        : ultima && !girando
          ? `Sincronizado ${ago(new Date(ultima).toISOString())}`
          : 'Tu progreso viaja contigo a todos tus dispositivos.';

  return (
    <View style={[styles.card, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]} testID="progreso-cuenta">
      <View style={styles.head}>
        <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
          <EstadoIcono estado={estado} colors={colors} size={24} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{t.titulo}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }} accessibilityLiveRegion="polite">
            {detalle}
          </Text>
        </View>
        <Pressable
          onPress={() => sincronizar()}
          disabled={girando}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sincronizar ahora"
          style={({ pressed }) => [styles.refresh, { borderColor: colors.border }, pressed && styles.pressed]}
        >
          {girando ? <ActivityIndicator size="small" color={colors.accent} /> : <RefreshIcon color={colors.accent} size={18} />}
        </Pressable>
      </View>

      <View style={[styles.stats, { borderColor: colors.border }]}>
        {stats.map((s, i) => (
          <View key={s.label} style={[styles.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
            <Text style={[styles.number, { color: colors.text }]}>{s.n}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.foot}>
        <DevicesIcon color={colors.muted} size={18} />
        <Text style={{ flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          {extra.length ? `También ${extra.join(' y ')}, ` : 'También '}
          tus ajustes de lectura, el Taller y tus preguntas del Estudio. Solo tú los ves.
        </Text>
      </View>
    </View>
  );
}

const INVITE_KEY = 'invitacion-cuenta';

/** En Hoy, sin cuenta y con algo leído: invita a crear una para no perder el progreso. */
export function InvitacionCuenta({ chapters }: { chapters: number }) {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [closed, setClosed] = useState(() => {
    try {
      return Platform.OS === 'web' && globalThis.localStorage?.getItem(INVITE_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!ready || usuario || closed || chapters < 1) return null;
  const close = () => {
    setClosed(true);
    try {
      globalThis.localStorage?.setItem(INVITE_KEY, '1');
    } catch {}
  };
  return (
    <View style={[styles.invite, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="invitacion-cuenta">
      <View style={[styles.inviteIcon, { backgroundColor: colors.accentSoft }]}>
        <CloudCheckIcon color={colors.accent} size={24} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Guarda tu progreso</Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
          {chapters === 1 ? 'Ya leíste un capítulo.' : `Ya leíste ${chapters} capítulos.`} Con una cuenta gratis, lo leído, tus planes, notas y
          resaltados quedan a salvo y te siguen en el teléfono y el computador.
        </Text>
        <View style={styles.inviteRow}>
          <Pressable
            onPress={() => navigate(() => router.push('/registro'), 'forward')}
            style={({ pressed }) => [styles.inviteButton, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Crear cuenta</Text>
          </Pressable>
          <Pressable onPress={() => navigate(() => router.push('/entrar'), 'forward')} style={styles.inviteQuiet} accessibilityRole="button">
            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Ya tengo cuenta</Text>
          </Pressable>
          <Pressable onPress={close} style={styles.inviteQuiet} accessibilityRole="button">
            <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Ahora no</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' };

const styles = StyleSheet.create({
  toastWrap: {
    position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    zIndex: 50,
  },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, boxShadow: '0 6px 24px rgba(0,0,0,0.18)' },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emblem: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 18, fontWeight: '700' },
  refresh: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  number: { fontFamily: serif, fontSize: 26, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 2, textAlign: 'center' },
  foot: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  invite: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  inviteIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  inviteRow: { flexDirection: 'row', gap: 4, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' },
  inviteButton: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  inviteQuiet: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
});
