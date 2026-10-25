// El servicio en pantalla (src/lib/servicio.ts): la tarjeta de Mi diario con cuántas veces se ha servido (estudios
// profundos, mensajes preparados, veces guiando a otros), el nivel y lo que falta para el siguiente, y la fila de
// insignias de servicio. Tocar la estrella abre el cielo del nivel (components/Lucero.tsx).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SIN_FIESTA } from '@/components/Celebracion';
import Lucero from '@/components/Lucero';
import Sello from '@/components/Sello';
import { type IconProps, LecternIcon, LiveIcon, SparkIcon, StarIcon } from '@/components/icons';
import { avance, porCelebrar, sellosPara, useSellos } from '@/lib/sellos';
import { useServicio } from '@/lib/servicioUso';
import { Colors, serif } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const ir = (href: string) => navigate(() => router.push(href as never), 'forward');

export function ServicioTarjeta({ colors }: { colors: Colors }) {
  const s = useServicio();
  const [cielo, setCielo] = useState(false);
  const { nivel, siguiente } = s;
  const desde = nivel?.meta ?? 0;
  const parte = siguiente ? (s.total - desde) / (siguiente.meta - desde) : 1;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="servicio">
      <View style={styles.top}>
        <Pressable
          onPress={nivel ? () => setCielo(true) : undefined}
          disabled={!nivel}
          style={({ pressed }) => [
            styles.medalla,
            { backgroundColor: nivel ? colors.warmSoft : colors.accentSoft },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
          accessibilityRole={nivel ? 'button' : undefined}
          accessibilityLabel={nivel ? `Estrella del servicio: ${nivel.titulo}` : undefined}
          testID="servicio-estrella"
        >
          <StarIcon color={nivel ? colors.warm : colors.muted} size={34} filled={!!nivel} strokeWidth={1.6} />
          {nivel && (
            <View style={styles.estrellitas}>
              {Array.from({ length: nivel.nivel }, (_, i) => (
                <View key={i} style={[styles.estrellita, { backgroundColor: colors.warm }]} />
              ))}
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: nivel ? colors.warm : colors.muted }]}>TU SERVICIO</Text>
          <View style={styles.numero}>
            <Text style={[styles.cifra, { color: colors.text }]}>{s.total}</Text>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{s.total === 1 ? 'vez sirviendo' : 'veces sirviendo'}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{nivel ? `«${nivel.titulo}»` : 'El que quiera ser grande, sea el servidor.'}</Text>
        </View>
      </View>

      <View style={styles.partes}>
        <Parte n={s.profundos} titulo="Estudios profundos" icon={SparkIcon} colors={colors} onPress={() => ir('/juan/3')} />
        <Parte n={s.escritos} titulo="Mensajes preparados" icon={LecternIcon} colors={colors} onPress={() => ir('/taller')} />
        <Parte n={s.guiados} titulo="Veces guiando" icon={LiveIcon} colors={colors} onPress={() => ir('/taller')} />
      </View>

      {siguiente && (
        <View style={styles.proxima} accessibilityLabel={`Próximo nivel: ${siguiente.titulo}, ${s.total} de ${siguiente.meta}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>PRÓXIMO NIVEL</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {s.total} de {siguiente.meta}
            </Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 2 }}>{siguiente.titulo}</Text>
          <View style={[styles.barra, { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.barraLlena, { backgroundColor: colors.warm, width: `${Math.max(4, parte * 100)}%` }]} />
          </View>
        </View>
      )}

      <Text style={[styles.nota, { color: colors.muted }]}>
        Cada estudio profundo, cada mensaje que terminas en el Taller y cada vez que guías a otros (un evento, una lectura en vivo o un mensaje
        predicado) cuenta. En la comunidad, tu foto lleva una corona de estrellas.
      </Text>

      {cielo && nivel && <Lucero nivel={nivel} cuenta={s} onClose={() => setCielo(false)} />}
    </View>
  );
}

function Parte({
  n,
  titulo,
  icon: Icon,
  colors,
  onPress,
}: {
  n: number;
  titulo: string;
  icon: (p: IconProps) => ReactNode;
  colors: Colors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.parte, { backgroundColor: colors.background }, pressed && { opacity: 0.75 }]}
      accessibilityRole="link"
      accessibilityLabel={`${n} ${titulo.toLowerCase()}`}
    >
      <Icon color={colors.warm} size={18} />
      <Text style={[styles.parteN, { color: colors.text }]}>{n}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 14 }} numberOfLines={2}>
        {titulo}
      </Text>
    </Pressable>
  );
}

/** Las insignias de servicio, en fila. */
export function ServicioInsignias({ colors }: { colors: Colors }) {
  const estado = useSellos();
  const lista = sellosPara().filter((s) => s.familia === 'servicio');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insignias}>
      {lista.map((s) => {
        const a = avance(estado, s);
        return (
          <Pressable
            key={s.id}
            onPress={() => ir(`/sellos?sello=${s.id}`)}
            style={({ pressed }) => [styles.insignia, pressed && { opacity: 0.7 }]}
            accessibilityRole="link"
            accessibilityLabel={`${s.titulo}: ${a.ganado ? 'ganada' : `${a.n} de ${a.meta}`}`}
          >
            <Sello dibujo={s.dibujo} colors={colors} ganado={!!a.ganado} parte={a.parte} size={58} />
            <Text style={[styles.insigniaMeta, { color: a.ganado ? colors.warm : colors.text }]} numberOfLines={2}>
              {s.titulo}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 14 }} numberOfLines={2}>
              {a.ganado ? 'Ganada' : `${a.n} de ${a.meta}`}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 20, marginBottom: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  medalla: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  estrellitas: { position: 'absolute', bottom: 9, flexDirection: 'row', gap: 3 },
  estrellita: { width: 4, height: 4, borderRadius: 2 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  numero: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cifra: { fontFamily: serif, fontSize: 46, lineHeight: 52 },
  partes: { flexDirection: 'row', gap: 8, marginTop: 16 },
  parte: { flex: 1, borderRadius: 14, padding: 12, gap: 2 },
  parteN: { fontFamily: serif, fontSize: 24, lineHeight: 28, marginTop: 4 },
  proxima: { marginTop: 16 },
  barra: { height: 6, borderRadius: 3, marginTop: 7, overflow: 'hidden' },
  barraLlena: { height: 6, borderRadius: 3 },
  nota: { fontSize: 12, lineHeight: 17, marginTop: 14 },
  insignias: { gap: 4, paddingVertical: 4, paddingRight: 8 },
  insignia: { width: 92, alignItems: 'center' },
  insigniaMeta: { fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
});

const VISTO = 'servicio-visto';

/**
 * El cielo sale solo una vez al subir de nivel de servicio. Va montado sobre toda la app (src/app/_layout.tsx), junto
 * a la celebración de los sellos: espera a que no haya un sello por celebrar ni se esté proyectando o en vivo, y a que
 * Mis sellos haya revisado lo de antes.
 */
export function LuceroNuevo() {
  const s = useServicio();
  const sellos = useSellos();
  const pathname = usePathname();
  const [visto, setVisto] = useState<number | null>(null);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(VISTO)
      .then((v) => setVisto(Number(v) || 0))
      .catch(() => setVisto(0));
  }, []);
  const nivel = s.nivel?.nivel ?? 0;
  const libre = !porCelebrar(sellos) && !SIN_FIESTA.some((r) => r.test(pathname));
  const toca = sellos.iniciado && visto !== null && nivel > visto;
  useEffect(() => {
    if (!toca || !libre || abierto) return;
    const id = setTimeout(() => setAbierto(true), 1200);
    return () => clearTimeout(id);
  }, [toca, libre, abierto]);
  if (!abierto || !s.nivel) return null;
  const cerrar = () => {
    setAbierto(false);
    setVisto(nivel);
    AsyncStorage.setItem(VISTO, String(nivel)).catch(() => {});
  };
  return <Lucero nivel={s.nivel} cuenta={s} onClose={cerrar} />;
}
