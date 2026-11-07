// Los videos de YouTube que la persona pega en «Lo que Dios te puso» (Preparar un mensaje), como fuente para la IA.
// La IA no puede ver un video: usa su transcripción, que la app saca sola (con Gemini, si el servidor tiene la clave)
// o que la persona copia desde YouTube y pega aquí. Ver src/lib/videos.ts y api/_videos.ts.

import { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayIcon } from '@/components/audioIcons';
import { Button, Field, IconText } from '@/components/comunidad/ui';
import { PencilIcon, SparkIcon, TrashIcon } from '@/components/icons';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { Colors, serif } from '@/lib/theme';
import { datosDeVideo, transcribeSolo, transcribirVideo } from '@/lib/transcribir';
import { MAX_TRANSCRIPCION, enlacesDeYoutube, idDeYoutube, miniatura } from '@/lib/videos';

/** Lo que se sabe de cada video, por su id de YouTube. */
export type VideoInfo = { transcripcion: string; titulo?: string; canal?: string };
export type Videos = Record<string, VideoInfo>;

/** Cuántas palabras debe tener lo pegado para tomarlo como transcripción (no un título o un enlace). */
const MIN_PALABRAS = 25;
const palabras = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const miles = (n: number) => n.toLocaleString('es');
/** El comienzo de la transcripción, en una sola línea, para reconocerla. */
const vista = (t: string) => {
  const una = t.replace(/\s+/g, ' ').trim();
  return una.length > 300 ? `${una.slice(0, 300).replace(/\s+\S*$/, '')}…` : una;
};

/** Los videos para la IA, en el orden del texto, con su transcripción si la tiene. */
export function videosParaPedir(texto: string, videos: Videos) {
  return enlacesDeYoutube(texto).map((url) => {
    const t = videos[idDeYoutube(url)!]?.transcripcion.trim();
    return { url, ...(t && { transcripcion: t.slice(0, MAX_TRANSCRIPCION) }) };
  });
}

export default function VideosFuente({ texto, videos, onCambiar, colors }: { texto: string; videos: Videos; onCambiar: (id: string, v: VideoInfo | null) => void; colors: Colors }) {
  const enlaces = enlacesDeYoutube(texto);
  const [solo, setSolo] = useState(false);
  useEffect(() => {
    if (enlaces.length) transcribeSolo().then(setSolo);
  }, [enlaces.length]);
  if (!enlaces.length)
    return (
      <Text style={[styles.nota, { color: colors.muted, marginTop: 8 }]}>
        ¿Te inspiró una predicación de YouTube? Pega aquí su enlace y la IA la usará como fuente.
      </Text>
    );
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={[styles.label, { color: colors.muted }]}>{enlaces.length === 1 ? 'EL VIDEO QUE COMPARTISTE' : 'LOS VIDEOS QUE COMPARTISTE'}</Text>
      <View style={{ gap: 12 }}>
        {enlaces.map((url) => {
          const id = idDeYoutube(url)!;
          return <Video key={id} url={url} id={id} info={videos[id]} onCambiar={(v) => onCambiar(id, v)} solo={solo} colors={colors} />;
        })}
      </View>
    </View>
  );
}

function Video({ url, id, info, onCambiar, solo, colors }: { url: string; id: string; info?: VideoInfo; onCambiar: (v: VideoInfo | null) => void; solo: boolean; colors: Colors }) {
  const [datos, setDatos] = useState<{ titulo?: string; canal?: string }>({});
  const [editando, setEditando] = useState(!info?.transcripcion);
  const [pegado, setPegado] = useState(info?.transcripcion ?? '');
  const [viendo, setViendo] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    datosDeVideo(url).then((d) => vivo && setDatos(d));
    return () => {
      vivo = false;
    };
  }, [url]);

  const titulo = info?.titulo ?? datos.titulo;
  const canal = info?.canal ?? datos.canal;
  const lista = !!info?.transcripcion && !editando;
  const n = palabras(info?.transcripcion ?? '');

  const sacar = async () => {
    setViendo(true);
    setError('');
    try {
      const t = await transcribirVideo(url);
      onCambiar({ transcripcion: t.transcripcion, titulo: t.titulo ?? titulo, canal: t.canal ?? canal });
      setPegado(t.transcripcion);
      setEditando(false);
    } catch (e) {
      const m = (e as Error).message;
      setError(m === NEEDS_ACCOUNT ? 'Para que la app vea el video necesitas una cuenta gratuita. También puedes pegar la transcripción.' : m);
    } finally {
      setViendo(false);
    }
  };

  const usar = () => {
    onCambiar({ transcripcion: pegado.trim(), titulo, canal });
    setEditando(false);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: lista ? colors.accent : colors.border }]}>
      <View style={styles.head}>
        <Pressable
          onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${id}`)}
          accessibilityRole="link"
          accessibilityLabel={`Ver en YouTube${titulo ? `: ${titulo}` : ''}`}
          style={({ pressed }) => [styles.mini, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.8 }]}
        >
          <Image source={{ uri: miniatura(id) }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          <View style={styles.play}>
            <PlayIcon color="#fff" size={14} />
          </View>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.kicker, { color: colors.muted }]}>YOUTUBE</Text>
          <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={2}>
            {titulo ?? 'Video de YouTube'}
          </Text>
          {!!canal && (
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
              {canal}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.estado, { backgroundColor: lista ? colors.accentSoft : colors.warmSoft }]}>
        <Text style={{ color: lista ? colors.text : colors.warm, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
          {lista ? `La IA lo usará como fuente · ${miles(n)} palabras` : 'La IA no puede ver videos: necesita lo que se dice en él.'}
        </Text>
      </View>

      {lista ? (
        <>
          <Text style={[styles.vista, { color: colors.muted }]} numberOfLines={3}>
            «{vista(info!.transcripcion)}»
          </Text>
          <View style={styles.acciones}>
            <Pressable onPress={() => setEditando(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cambiar la transcripción">
              <IconText icon={PencilIcon} color={colors.accent} size={14}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Cambiar</Text>
              </IconText>
            </Pressable>
            <Pressable
              onPress={() => {
                onCambiar(null);
                setPegado('');
                setEditando(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Quitar la transcripción"
            >
              <IconText icon={TrashIcon} color={colors.muted} size={14}>
                <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>Quitar</Text>
              </IconText>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {solo && (
            <>
              <Button label={viendo ? 'Viendo el video…' : 'Sacar la transcripción'} icon={SparkIcon} onPress={sacar} busy={viendo} style={{ marginTop: 12 }} />
              <Text style={[styles.nota, { color: colors.muted, textAlign: 'center' }]}>
                {viendo ? 'Puede tardar un minuto si el video es largo.' : 'La app escucha el video y escribe lo que se dice.'}
              </Text>
              <View style={styles.o}>
                <View style={[styles.linea, { backgroundColor: colors.border }]} />
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>o pégala tú</Text>
                <View style={[styles.linea, { backgroundColor: colors.border }]} />
              </View>
            </>
          )}
          <Text style={[styles.pasos, { color: colors.text, marginTop: solo ? 0 : 12 }]}>
            {Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 700
              ? 'En YouTube, debajo del video abre la descripción («…más») y toca «Mostrar transcripción». Selecciona el texto, cópialo y pégalo aquí.'
              : 'En la app de YouTube, toca la descripción del video, baja hasta «Transcripción» y toca «Mostrar transcripción». Mantén pulsado el texto, cópialo y pégalo aquí.'}
          </Text>
          <Field
            value={pegado}
            onChangeText={(t) => setPegado(t.slice(0, MAX_TRANSCRIPCION))}
            multiline
            placeholder="Pega aquí la transcripción del video"
            accessibilityLabel="Transcripción del video"
            style={{ maxHeight: 200, marginTop: 10, fontSize: 15, lineHeight: 21 }}
          />
          <View style={styles.acciones}>
            <Button label="Usar esta transcripción" kind="outline" onPress={usar} disabled={palabras(pegado) < MIN_PALABRAS} style={{ flex: 1 }} />
            {!!info?.transcripcion && <Button label="Cancelar" kind="quiet" onPress={() => (setPegado(info.transcripcion), setEditando(false))} />}
          </View>
        </>
      )}
      {!!error && <Text style={[styles.nota, { color: colors.warm, marginTop: 8 }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 20, padding: 14 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  mini: { width: 112, height: 63, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  play: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  kicker: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 },
  titulo: { fontFamily: serif, fontSize: 16.5, lineHeight: 22, marginTop: 2 },
  estado: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginTop: 12 },
  vista: { fontFamily: serif, fontStyle: 'italic', fontSize: 14.5, lineHeight: 21, marginTop: 10 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12 },
  nota: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  o: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  linea: { flex: 1, height: StyleSheet.hairlineWidth },
  pasos: { fontSize: 14, lineHeight: 20 },
});
