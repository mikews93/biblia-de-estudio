import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ExternalIcon } from '@/components/icons';
import { type Uso, uso } from '@/lib/cuidar';
import { Colors, isDark, serif } from '@/lib/theme';

/** Donde se ven las instalaciones de Google Play (no hay API sin la cuenta de servicio) y las visitas web. */
const PLAY_CONSOLE = 'https://play.google.com/console/u/0/developers/6093564815878360864/app/4972891834157725944/grow-overview';
const VERCEL_ANALYTICS = 'https://vercel.com/dashboard';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const lunes = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
};
const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es')} ${n === 1 ? uno : varios}`;

/**
 * «Cómo va Zarza» arriba de /cuidar: cuántas cuentas hay y cuántas se usan, con totales de api/_cuidar.ts cuidarUso.
 * No sabe de nadie en particular y no cuenta a quienes cuidan. Lo que pasa sin cuenta lo cuentan Play y Vercel.
 */
export default function UsoZarza({ colors }: { colors: Colors }) {
  const [data, setData] = useState<Uso | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    uso()
      .then(setData)
      .catch((e: Error) => setError(e.message || 'No se pudo cargar'));
  }, []);

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, !isDark(colors) && styles.sombra];
  if (!data) {
    return (
      <View style={card} accessibilityLabel="Cómo va Zarza">
        <Text style={[styles.kicker, { color: colors.muted }]}>CÓMO VA ZARZA</Text>
        {error ? (
          <Text style={{ color: colors.muted, fontSize: 13.5, marginTop: 8 }}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
        )}
      </View>
    );
  }

  const max = Math.max(1, ...data.semanas.map((s) => s.activas));
  const actual = data.semanas.length - 1;
  const grandes = [
    { valor: data.activas.semana, titulo: 'Activas', pie: '7 días' },
    { valor: data.cuentas.total, titulo: 'Cuentas', pie: data.cuentas.semana ? `+${data.cuentas.semana} esta semana` : 'ninguna nueva esta semana' },
    { valor: data.ia?.usos ?? 0, titulo: 'Preguntas IA', pie: data.ia ? plural(data.ia.personas, 'persona', 'personas') : '7 días' },
  ];
  const mas = [
    { label: 'Activas hoy', valor: data.activas.hoy },
    { label: 'Activas en 30 días', valor: data.activas.mes },
    { label: 'Cuentas nuevas en 30 días', valor: data.cuentas.mes },
    data.capitulos && { label: 'Capítulos leídos (7 días)', valor: data.capitulos.semana },
    data.ia && { label: 'Preguntas IA (30 días)', valor: data.ia.usosMes },
    data.invitadas !== null && { label: 'Llegaron con un enlace de amigo', valor: data.invitadas },
    data.enIglesias !== null && { label: 'En iglesias anfitrionas', valor: data.enIglesias },
    data.avisos && { label: 'Aparatos con avisos', valor: data.avisos.total, nota: data.avisos.sinCuenta ? `${data.avisos.sinCuenta} sin cuenta` : undefined },
  ].filter(Boolean) as { label: string; valor: number; nota?: string }[];

  return (
    <View style={card} accessibilityLabel="Cómo va Zarza">
      <View style={styles.head}>
        <Text style={[styles.kicker, { color: colors.muted }]}>CÓMO VA ZARZA</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>sin contar a quienes cuidan</Text>
      </View>

      <View style={styles.grandes}>
        {grandes.map((g) => (
          <View key={g.titulo} style={styles.grande}>
            <Text style={[styles.numero, { color: colors.text }]} testID={`uso-${g.titulo}`}>
              {g.valor.toLocaleString('es')}
            </Text>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{g.titulo}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
              {g.pie}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sub, { color: colors.muted }]}>Cuentas activas por semana</Text>
      <View style={styles.barras} accessibilityRole="summary">
        {data.semanas.map((s, i) => {
          const hoy = i === actual;
          return (
            <View key={s.semana} style={styles.columna} accessibilityLabel={`Semana del ${lunes(s.semana)}: ${s.activas} activas, ${s.nuevas} nuevas`}>
              <Text style={{ color: hoy ? colors.text : colors.muted, fontSize: 11, fontWeight: '700' }}>{s.activas || ''}</Text>
              <View style={styles.pista}>
                <View
                  style={[
                    styles.barra,
                    { height: `${s.activas ? Math.max(6, (s.activas / max) * 100) : 0}%`, backgroundColor: hoy ? colors.warm : colors.accentSoft },
                  ]}
                />
              </View>
              <Text style={{ color: colors.muted, fontSize: 10.5 }} numberOfLines={1}>
                {lunes(s.semana)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>{s.nuevas > 0 ? `+${s.nuevas}` : ' '}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 4 }}>Bajo cada semana, «+N» son las cuentas nuevas.</Text>

      <View style={[styles.lista, { borderColor: colors.border }]}>
        {mas.map((m) => (
          <View key={m.label} style={styles.fila}>
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{m.label}</Text>
            {m.nota && <Text style={{ color: colors.muted, fontSize: 12 }}>{m.nota}</Text>}
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', minWidth: 32, textAlign: 'right' }}>{m.valor.toLocaleString('es')}</Text>
          </View>
        ))}
      </View>

      <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 12 }}>
        Quien lee sin cuenta no aparece aquí. Las instalaciones están en Google Play y las visitas a la web en Vercel.
      </Text>
      <View style={styles.enlaces}>
        <Enlace label="Google Play" url={PLAY_CONSOLE} colors={colors} />
        <Enlace label="Visitas web" url={VERCEL_ANALYTICS} colors={colors} />
      </View>
    </View>
  );
}

function Enlace({ label, url, colors }: { label: string; url: string; colors: Colors }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.enlace, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
    >
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      <ExternalIcon color={colors.muted} size={13} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  sombra: { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  grandes: { flexDirection: 'row', gap: 12, marginTop: 14 },
  grande: { flex: 1, gap: 1 },
  numero: { fontFamily: serif, fontSize: 32, fontWeight: '700', lineHeight: 38 },
  sub: { fontSize: 12, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 128 },
  columna: { flex: 1, alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' },
  pista: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  barra: { width: '100%', borderRadius: 6 },
  lista: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 10, gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  enlaces: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
});
