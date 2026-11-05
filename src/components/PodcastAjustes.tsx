// Debajo de los controles del reproductor, mientras suena un pódcast: la música de fondo, las voces del dispositivo y
// grabarlo con voces naturales. Tres botones con su ícono y su nombre; cada uno abre su hoja, para que el reproductor
// no crezca.
import { ReactNode, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmbienteHoja, Barras } from '@/components/Ambiente';
import { CloseIcon, TalkIcon } from '@/components/audioIcons';
import { MusicIcon, SparkIcon } from '@/components/icons';
import { VocesPanel } from '@/components/VocesPodcast';
import { PISTAS, useAmbiente } from '@/lib/ambiente';
import { useMusicaPodcast } from '@/lib/musicaPodcast';
import { ExtrasPodcast } from '@/lib/podcastExtras';
import { Colors } from '@/lib/theme';

type Props = {
  colors: Colors;
  /** Suena con la voz del dispositivo: se pueden cambiar las voces y grabarlo con voces naturales. */
  dispositivo: boolean;
  /** Lo que publicó la pantalla de este pódcast (estado de la grabación); sin ella no se ofrece grabar. */
  extras: ExtrasPodcast | null;
};

export default function PodcastAjustes({ colors, dispositivo, extras }: Props) {
  const musica = useMusicaPodcast();
  const { sonando } = useAmbiente();
  const [hoja, setHoja] = useState<'musica' | 'voces' | 'grabar' | null>(null);
  const pista = PISTAS.find((p) => p.id === musica.pista);
  const suena = musica.encendida && sonando === musica.pista;
  const grabado = dispositivo ? extras?.grabado : undefined;
  const grabando = grabado?.estado === 'grabando';
  const puedeGrabar = grabado?.estado === 'ninguno' || grabado?.estado === 'error' || grabando;

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Boton
        colors={colors}
        on={musica.encendida}
        icon={
          suena ? <Barras color={colors.warm} size={16} /> : <MusicIcon color={musica.encendida ? colors.warm : colors.muted} size={18} />
        }
        label="Música"
        detail={musica.encendida ? (pista?.nombre ?? '') : 'Apagada'}
        a11y={`Música de fondo: ${musica.encendida ? pista?.nombre : 'apagada'}. Cambiar`}
        onPress={() => setHoja('musica')}
      />
      {dispositivo && (
        <Boton
          colors={colors}
          icon={<TalkIcon color={colors.text} size={18} />}
          label="Voces"
          detail="Del teléfono"
          a11y="Cambiar las voces de Ana y Tomás"
          onPress={() => setHoja('voces')}
        />
      )}
      {puedeGrabar && (
        <Boton
          colors={colors}
          on={grabando}
          icon={grabando ? <ActivityIndicator color={colors.warm} size="small" /> : <SparkIcon color={colors.text} size={18} />}
          label={grabando ? 'Grabando…' : grabado?.estado === 'error' ? 'Reintentar' : 'Grabar'}
          detail="Voces naturales"
          a11y={grabando ? 'Grabando con voces naturales' : 'Grabar este pódcast con voces naturales'}
          onPress={() => setHoja('grabar')}
        />
      )}

      {hoja === 'musica' && (
        <AmbienteHoja
          colors={colors}
          onClose={() => setHoja(null)}
          onElegir={musica.cambiar}
          onApagar={() => musica.encendida && musica.alternar()}
          titulo="Debajo de Ana y Tomás"
          marcada={musica.encendida ? musica.pista : undefined}
          nota="Suena bajita mientras escuchas el pódcast y se va cuando lo pausas. Toca la que suena para apagarla. La pista que elijas queda para los próximos."
        />
      )}
      {hoja === 'voces' && (
        <Hoja colors={colors} kicker="Voces del teléfono" title="Ana y Tomás" onClose={() => setHoja(null)}>
          <Text style={[styles.nota, { color: colors.muted }]}>
            Escucha cada voz y elige la que te guste. No gastan nada y quedan para todos los pódcast.
          </Text>
          <VocesPanel />
        </Hoja>
      )}
      {hoja === 'grabar' && extras && grabado && (
        <Hoja colors={colors} kicker="Voces naturales" title="Escuchar con voces naturales" onClose={() => setHoja(null)}>
          <Text style={[styles.nota, { color: colors.muted }]}>
            {grabando
              ? 'Se está grabando. Tarda uno o dos minutos; puedes seguir escuchando o leyendo, y después queda lista para todos.'
              : grabado.estado === 'error'
                ? grabado.error
                : 'Nadie lo ha grabado aún. Se graba una vez, en uno o dos minutos, y queda lista para todos. Mientras tanto sigue sonando con la voz del teléfono.'}
          </Text>
          {!grabando && (
            <Pressable
              onPress={() => {
                extras.record();
                setHoja(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Grabar con voces naturales"
              style={({ pressed }) => [styles.grabar, { backgroundColor: colors.accent }, pressed && styles.pressed]}
            >
              <SparkIcon color={colors.surface} size={18} />
              <Text
                style={{
                  color: colors.surface,
                  fontWeight: '700',
                  fontSize: 15,
                }}
              >
                {grabado.estado === 'error' ? 'Intentar otra vez' : 'Grabar con voces naturales'}
              </Text>
            </Pressable>
          )}
        </Hoja>
      )}
    </View>
  );
}

function Boton(props: { colors: Colors; on?: boolean; icon: ReactNode; label: string; detail: string; a11y: string; onPress: () => void }) {
  const { colors } = props;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.a11y}
      style={({ pressed }) => [styles.boton, props.on && { backgroundColor: colors.warmSoft }, pressed && styles.pressed]}
    >
      <View style={styles.icono}>{props.icon}</View>
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.label, { color: props.on ? colors.warm : colors.text }]} numberOfLines={1}>
          {props.label}
        </Text>
        <Text style={[styles.detail, { color: colors.muted }]} numberOfLines={1}>
          {props.detail}
        </Text>
      </View>
    </Pressable>
  );
}

function Hoja(props: { colors: Colors; kicker: string; title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = props;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: colors.muted }]}>{props.kicker}</Text>
            <Text style={[styles.title, { color: colors.text }]}>{props.title}</Text>
          </View>
          <Pressable onPress={props.onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
            <CloseIcon color={colors.muted} size={20} />
          </Pressable>
        </View>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12 }}>
          {props.children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  boton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    minHeight: 44,
  },
  icono: { width: 22, alignItems: 'center' },
  label: { fontSize: 12.5, fontWeight: '700' },
  detail: { fontSize: 11 },
  pressed: { opacity: 0.7 },
  nota: { fontSize: 13.5, lineHeight: 19 },
  grabar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 440,
    maxWidth: '94%',
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { fontSize: 18, fontWeight: '700', marginTop: 2 },
});
