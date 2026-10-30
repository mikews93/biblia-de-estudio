// «Mis grupos» en tu perfil: los grupos en que estás, con sus avisos y la opción de darte de baja, y los atajos
// para crear uno o unirte con un código. Toca (o mantén pulsado) un grupo para ver lo que puedes hacer.
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { confirm } from '@/components/comunidad/confirm';
import { Button, ErrorText, Field, useAction } from '@/components/comunidad/ui';
import { BellIcon, BellOffIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, ChurchIcon, ExitIcon, HomeIcon, PeopleIcon, PlusIcon, type IconProps } from '@/components/icons';
import { ResumenGrupo, TipoGrupo, leaveGroup, setGroupAlerts, tipoLabel, useAccount } from '@/lib/comunidad';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const TYPE_ICON: Record<TipoGrupo, (p: IconProps) => React.ReactNode> = {
  iglesia: ChurchIcon,
  celula: PeopleIcon,
  familia: HomeIcon,
  amigos: PeopleIcon,
};

export const GroupTypeIcon = ({ tipo, ...p }: IconProps & { tipo: TipoGrupo }) => {
  const Icon = TYPE_ICON[tipo] ?? PeopleIcon;
  return <Icon {...p} />;
};

export default function MisGrupos() {
  const colors = useColors();
  const { grupos } = useAccount();
  const [open, setOpen] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const go = (href: string) => navigate(() => router.push(href as never), 'forward');

  const join = () => {
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Los códigos de una lectura en vivo tienen 6 letras; los de un grupo, 8.
    if (clean.length === 6) go(`/vivo/${clean}`);
    else if (clean) go(`/unirse/${clean}`);
  };

  return (
    <View style={[styles.card, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]} testID="mis-grupos">
      <View style={styles.head}>
        <PeopleIcon color={colors.accent} size={20} />
        <Text style={[styles.title, { color: colors.text }]}>Mis grupos</Text>
        {grupos && grupos.length > 0 && (
          <View style={[styles.count, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{grupos.length}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -4 }}>
        Toca un grupo para abrirlo, silenciar sus avisos o darte de baja.
      </Text>

      {grupos === null ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
      ) : grupos.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.background }]}>
          <PeopleIcon color={colors.muted} size={26} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 8 }}>Aún no estás en ningún grupo</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 2 }}>
            Crea uno para tu célula, tu familia o tu iglesia, o únete con el código que te compartieron.
          </Text>
        </View>
      ) : (
        <View style={[styles.list, { borderColor: colors.border }]}>
          {grupos.map((g, i) => (
            <GroupRow
              key={g.id}
              group={g}
              first={i === 0}
              open={open === g.id}
              onToggle={() => setOpen(open === g.id ? null : g.id)}
              onOpen={() => go(`/grupos/${g.id}`)}
              colors={colors}
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Button label="Crear un grupo" icon={PlusIcon} onPress={() => go('/grupos/nuevo')} style={{ flexGrow: 1, flexBasis: 180 }} />
        {!joining && (
          <Button label="Unirme con un código" kind="outline" onPress={() => setJoining(true)} style={{ flexGrow: 1, flexBasis: 180 }} />
        )}
      </View>
      {joining && (
        <View style={styles.joinRow}>
          <View style={{ flex: 1 }}>
            <Field
              value={code}
              onChangeText={setCode}
              placeholder="Código de invitación"
              autoCapitalize="characters"
              autoFocus
              onSubmitEditing={join}
              style={{ letterSpacing: 2 }}
            />
          </View>
          <Button label="Unirme" onPress={join} disabled={!code.trim()} />
        </View>
      )}
    </View>
  );
}

function GroupRow({
  group: g,
  first,
  open,
  onToggle,
  onOpen,
  colors,
}: {
  group: ResumenGrupo;
  first: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
  colors: Colors;
}) {
  const alerts = g.avisos !== false;
  const mute = useAction();
  const exit = useAction();

  const leave = async () => {
    const ok = await confirm(
      `¿Darte de baja de ${g.nombre}?`,
      g.soyAdmin
        ? 'Dejarás de ver sus notas, peticiones y lecturas. Si nadie más lo administra, pasa a quien lleva más tiempo. Podrás volver con el enlace de invitación.'
        : 'Dejarás de ver sus notas, peticiones y lecturas. Podrás volver con el enlace de invitación.',
      'Darme de baja',
    );
    if (ok) exit.run(() => leaveGroup(g.id));
  };

  const meta = [tipoLabel(g.tipo), `${g.miembros} ${g.miembros === 1 ? 'persona' : 'personas'}`, g.soyAdmin ? 'administras' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[!first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, open && { backgroundColor: colors.background }]}>
      <Pressable
        onPress={onToggle}
        onLongPress={onToggle}
        accessibilityRole="button"
        aria-expanded={open}
        accessibilityLabel={`${g.nombre}, ${meta}`}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.tile, { backgroundColor: colors.accentSoft }]}>
          <GroupTypeIcon tipo={g.tipo} color={colors.text} size={20} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {g.nombre}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {!alerts && <BellOffIcon color={colors.muted} size={17}/>}
        {open ? <ChevronUpIcon color={colors.muted} size={18} /> : <ChevronDownIcon color={colors.muted} size={18} />}
      </Pressable>
      {open && (
        <View style={styles.menu}>
          <MenuItem icon={ChevronRightIcon} label="Abrir el grupo" onPress={onOpen} colors={colors} />
          <MenuItem
            icon={alerts ? BellOffIcon : BellIcon}
            label={alerts ? 'Silenciar sus avisos' : 'Recibir sus avisos'}
            busy={mute.busy}
            onPress={() => mute.run(() => setGroupAlerts(g.id, !alerts))}
            colors={colors}
          />
          <MenuItem icon={ExitIcon} label="Darme de baja" onPress={leave} busy={exit.busy} colors={colors} danger />
          <ErrorText>{mute.error ?? exit.error}</ErrorText>
        </View>
      )}
    </View>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onPress,
  busy,
  danger,
  colors,
}: {
  icon: (p: IconProps) => React.ReactNode;
  label: string;
  onPress: () => void;
  busy?: boolean;
  danger?: boolean;
  colors: Colors;
}) {
  const tint = danger ? colors.warm : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
    >
      {busy ? <ActivityIndicator color={tint} size="small" /> : <Icon color={tint} size={17} strokeWidth={2} />}
      <Text style={{ color: tint, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' };

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: serif, fontSize: 19, fontWeight: '700', flex: 1 },
  count: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  empty: { borderRadius: 16, padding: 18, alignItems: 'center' },
  list: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: serif, fontSize: 17, fontWeight: '700' },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
