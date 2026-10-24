// Presentar un mensaje del Taller (también los de «Mis sermones»): en pantalla completa, en vivo en la iglesia o
// con el grupo. Cada camino lleva a su pantalla; el evento de la iglesia se publica aquí de un toque si no existía.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, useAction } from '@/components/comunidad/ui';
import { ChevronRightIcon, ChurchIcon, type IconProps, PeopleIcon, PlayIcon } from '@/components/icons';
import { Sheet } from '@/components/vivo/piezas';
import { useVersion } from '@/components/vivo/Guion';
import { useAccount } from '@/lib/comunidad';
import type { Book } from '@/lib/data';
import { codigoLegible, publicarMensaje, useMisEventos } from '@/lib/eventos';
import type { Mensaje } from '@/lib/taller';
import { serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function ComoPresentar({ m, books, onClose }: { m: Mensaje; books: Book[]; onClose: () => void }) {
  const { settings } = useSettings();
  const { abbr } = useVersion(settings.version);
  const { usuario } = useAccount();
  const { eventos } = useMisEventos(!!usuario);
  const evento = eventos?.find((e) => e.codigo === m.evento?.codigo) ?? eventos?.find((e) => e.mensaje === m.id);
  const { busy, error, run } = useAction();
  const ir = (href: string) => {
    onClose();
    navigate(() => router.push(href as never), 'forward');
  };

  // Antes de presentarlo en la iglesia se pone al día el evento: los cambios del mensaje y la versión en que lees.
  const enLaIglesia = () =>
    run(async () => {
      await publicarMensaje(m, books, settings.version);
      ir(`/taller/${m.id}/presentar`);
    });

  return (
    <Sheet title="¿Cómo lo vas a presentar?" kicker="PRESENTAR" onClose={onClose}>
      <View style={{ gap: 10 }}>
        <Opcion
          icon={PlayIcon}
          titulo="Yo, en pantalla completa"
          detalle="Letra grande, una parte a la vez, con el reloj de cada parte y el pasaje a un toque."
          onPress={() => ir(`/taller/${m.id}/presentar`)}
        />
        <Opcion
          icon={ChurchIcon}
          titulo="En la iglesia, en vivo"
          detalle={`La congregación lo sigue en el teléfono con un código o un QR: ve el punto en que vas, abre los versículos en ${abbr} y hace las dinámicas que le mandes.`}
          extra={evento ? `Evento ${codigoLegible(evento.codigo)}` : undefined}
          onPress={usuario ? enLaIglesia : () => ir('/entrar')}
          busy={busy}
          aviso={usuario ? undefined : 'Necesitas una cuenta gratuita para publicarlo.'}
        />
        <Opcion
          icon={PeopleIcon}
          titulo="Con mi grupo o célula"
          detalle="Cada uno lo sigue en su teléfono. Tú llevas cada parte con su reloj: todos van a sus versículos y ven su dinámica."
          onPress={() => ir(`/vivo?taller=${m.id}`)}
        />
      </View>
      <ErrorText>{error}</ErrorText>
      {usuario && (
        <Button
          label="Elegir qué ve la congregación"
          kind="quiet"
          onPress={() => ir(`/taller/${m.id}?paso=compartir`)}
          style={{ alignSelf: 'flex-start', marginTop: 6 }}
        />
      )}
    </Sheet>
  );
}

function Opcion({
  icon: Icon,
  titulo,
  detalle,
  extra,
  aviso,
  busy,
  onPress,
}: {
  icon: (p: IconProps) => React.ReactNode;
  titulo: string;
  detalle: string;
  extra?: string;
  aviso?: string;
  busy?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.opcion,
        { backgroundColor: hovered ? colors.accentSoft : colors.surface, borderColor: colors.border },
        (pressed || busy) && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.icono, { backgroundColor: colors.warmSoft }]}>
        <Icon color={colors.warm} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.titulo, { color: colors.text }]}>{titulo}</Text>
        <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, marginTop: 3 }}>{detalle}</Text>
        {extra && <Text style={{ color: colors.warm, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 6 }}>{extra.toUpperCase()}</Text>}
        {aviso && <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: '600', marginTop: 6 }}>{aviso}</Text>}
      </View>
      <ChevronRightIcon color={colors.muted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  icono: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: serif, fontSize: 18, fontWeight: '700' },
});
