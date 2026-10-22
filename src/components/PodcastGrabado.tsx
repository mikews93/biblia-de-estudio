// Tarjeta de la versión del pódcast con voces naturales: la escucha si ya está grabada (en la app o bajo demanda),
// la graba si nadie lo ha hecho todavía, o muestra que se está grabando.
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayIcon, TalkIcon } from '@/components/audioIcons';
import { playRecordedPodcast } from '@/lib/audio';
import { usePodcastGrabado } from '@/lib/podcastGrabado';
import { useColors } from '@/lib/theme';

type Props = {
  book: string;
  chapter: number;
  title: string;
  inApp: boolean;
  scriptReady: boolean;
  /** El pódcast de «La historia de una palabra» (book es entonces su clave en el reproductor y chapter, 0). */
  palabra?: string;
};

export function PodcastGrabado({ book, chapter, title, inApp, scriptReady, palabra }: Props) {
  const colors = useColors();
  const grabado = usePodcastGrabado(book, chapter, palabra);

  if (inApp || grabado.estado === 'listo') {
    return (
      <Card
        onPress={() => playRecordedPodcast(book, chapter, title, grabado.estado === 'listo' && !inApp ? grabado : undefined)}
        label="Escuchar la versión grabada con voces naturales"
        title="Versión grabada"
        detail="Con voces naturales, lista para escuchar"
        icon={<TalkIcon color={colors.surface} size={20} />}
        end={<PlayIcon color={colors.accent} size={22} />}
        filled
      />
    );
  }
  if (grabado.estado === 'grabando') {
    return (
      <Card
        label="Grabando con voces naturales"
        title="Grabando con voces naturales…"
        detail="Tarda uno o dos minutos. Puedes seguir aquí o leer; después queda lista para todos."
        icon={<ActivityIndicator color={colors.surface} />}
      />
    );
  }
  if (!scriptReady || grabado.estado === 'cargando') return null;
  return (
    <Card
      onPress={grabado.record}
      label="Grabar este pódcast con voces naturales"
      title={grabado.estado === 'error' ? 'No se pudo grabar' : 'Escuchar con voces naturales'}
      detail={
        grabado.estado === 'error'
          ? grabado.error
          : 'Nadie lo ha grabado aún. Se graba una vez, en uno o dos minutos, y queda lista para todos.'
      }
      icon={<TalkIcon color={colors.surface} size={20} />}
      end={<Text style={{ color: colors.accent, fontWeight: '700' }}>{grabado.estado === 'error' ? 'Reintentar' : 'Grabar'}</Text>}
    />
  );
}

function Card(props: { onPress?: () => void; label: string; title: string; detail: string; icon: ReactNode; end?: ReactNode; filled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={props.onPress}
      disabled={!props.onPress}
      accessibilityRole={props.onPress ? 'button' : undefined}
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.card,
        props.filled
          ? { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.accent }]}>{props.icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{props.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{props.detail}</Text>
      </View>
      {props.end}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginTop: 20,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
