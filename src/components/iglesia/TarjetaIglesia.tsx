import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChurchIcon, LampIcon, PeopleIcon } from '@/components/icons';
import Qr from '@/components/Qr';
import { IglesiaPublica, enlaceIglesia } from '@/lib/iglesias';
import { Colors, isDark, serif } from '@/lib/theme';

/** La iglesia anfitriona: su nombre, cuántos entraron con su código y cuántas preguntas al día da. */
export default function TarjetaIglesia({
  iglesia,
  colors,
  kicker,
  qr,
  children,
}: {
  iglesia: IglesiaPublica;
  colors: Colors;
  kicker: string;
  /** Muestra el QR y el código para invitar a otros miembros. */
  qr?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
      <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
        <ChurchIcon color={colors.accent} size={30} />
      </View>
      <Text style={[styles.kicker, { color: colors.accent }]}>{kicker}</Text>
      <Text style={[styles.name, { color: colors.text }]}>{iglesia.nombre}</Text>
      {!!iglesia.ciudad && <Text style={{ color: colors.muted, fontSize: 14 }}>{iglesia.ciudad}</Text>}
      <View style={styles.stats}>
        <Stat icon={<PeopleIcon color={colors.accent} size={16} />} colors={colors}>
          {iglesia.miembros} {iglesia.miembros === 1 ? 'persona' : 'personas'}
        </Stat>
        <Stat icon={<LampIcon color={colors.accent} size={16} />} colors={colors}>
          {iglesia.lampara} preguntas al día
        </Stat>
      </View>
      {qr && (
        <View style={[styles.qrWrap, { borderColor: colors.border }]}>
          <View style={styles.qr}>
            <Qr value={enlaceIglesia(iglesia.codigo)} size={156} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>Para invitar a otros miembros, que escaneen el código</Text>
          <Text style={[styles.code, { color: colors.text }]}>{iglesia.codigo}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

function Stat({ icon, colors, children }: { icon: ReactNode; colors: Colors; children: ReactNode }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {icon}
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 8, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kicker: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center' },
  name: { fontFamily: serif, fontSize: 27, fontWeight: '700', textAlign: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 7 },
  qrWrap: { alignSelf: 'stretch', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 18 },
  qr: { padding: 10, borderRadius: 16, backgroundColor: '#FFFFFF' },
  code: { fontSize: 22, fontWeight: '800', letterSpacing: 4 },
});
