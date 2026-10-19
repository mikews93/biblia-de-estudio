import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CommentIcon, HeartIcon } from '@/components/icons';
import VerseArt from '@/components/VerseArt';
import { IMAGE_STYLES } from '@/lib/compartir';
import { ago, chapterHref } from '@/lib/comunidad';
import { HIGHLIGHT_COLORS } from '@/lib/highlights';
import { Publicacion, chaptersLabel, deletePost, like, postReference, report } from '@/lib/social';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { confirm } from './confirm';
import { Avatar, Card, text } from './ui';

type Props = {
  post: Publicacion;
  /** En el detalle no hace falta el enlace a los comentarios. */
  detail?: boolean;
  onRemoved?: () => void;
};

const KIND: Record<Publicacion['tipo'], string> = {
  lectura: 'leyó hoy',
  resaltado: 'resaltó un versículo',
  imagen: 'compartió una imagen',
  pregunta: 'pregunta a la comunidad',
  reflexion: 'compartió lo que aprendió',
};

/** Una publicación del muro de Comunidad, con «me gusta» y comentarios. */
export default function Post({ post, detail, onRemoved }: Props) {
  const colors = useColors();
  const { width: screen } = useWindowDimensions();
  const [liked, setLiked] = useState(post.yoMeGusta);
  const [likes, setLikes] = useState(post.meGusta);
  const [hidden, setHidden] = useState(false);
  const reference = postReference(post);
  const inner = Math.min(screen, 640) - 40 - 34;

  const go = (href: string) => navigate(() => router.push(href as never), 'forward');
  const openPost = () => !detail && go(`/comunidades/publicacion/${post.id}`);

  const toggleLike = () => {
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    like(post.id, !liked).catch(() => {
      setLiked(liked);
      setLikes(post.meGusta);
    });
  };

  const more = async () => {
    if (post.mia) {
      if (!(await confirm('¿Borrar esta publicación?', 'Se borra con sus comentarios.', 'Borrar'))) return;
      await deletePost(post.id).catch(() => {});
    } else {
      const ok = await confirm(
        '¿Reportar esta publicación?',
        'Dejarás de verla. Si varias personas la reportan, se oculta para toda la comunidad.',
        'Reportar',
      );
      if (!ok) return;
      await report(post.id).catch(() => {});
    }
    setHidden(true);
    onRemoved?.();
  };

  if (hidden) return null;

  const verseLink = () => post.libro && post.capitulo && go(chapterHref(post.libro, post.capitulo, post.versiculo ?? undefined));
  const caption = `${reference ?? ''}${post.version ? ` (${post.version})` : ''}`;

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.head}>
        <Pressable onPress={() => go(`/comunidades/persona/${post.autorId}`)} accessibilityRole="link">
          <Avatar name={post.autor} foto={post.autorFoto} size={38} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text }} numberOfLines={2}>
            <Text style={{ fontWeight: '700' }} onPress={() => go(`/comunidades/persona/${post.autorId}`)}>
              {post.autor}
            </Text>{' '}
            <Text style={{ color: colors.muted }}>{KIND[post.tipo]}</Text>
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            {ago(post.actualizado)} · {post.audiencia === 'todos' ? 'Toda la comunidad' : 'Amigos'}
          </Text>
        </View>
        <Pressable onPress={more} hitSlop={10} accessibilityLabel={post.mia ? 'Borrar publicación' : 'Reportar publicación'}>
          <Text style={{ color: colors.muted, fontSize: 18 }}>⋯</Text>
        </Pressable>
      </View>

      {post.tipo === 'lectura' && (
        <Pressable
          onPress={() => post.libro && go(chapterHref(post.libro, post.datos.capitulos?.at(-1) ?? 1))}
          style={[styles.reading, { backgroundColor: colors.accentSoft }]}
          accessibilityRole="link"
        >
          <Text style={{ color: colors.accent, fontSize: 20 }}>¶</Text>
          <Text style={[styles.readingText, { color: colors.text }]}>{chaptersLabel(post)}</Text>
        </Pressable>
      )}

      {post.texto ? (
        <Pressable onPress={openPost} disabled={detail}>
          <Text
            style={[
              post.tipo === 'pregunta' ? styles.question : text.body,
              { color: colors.text },
            ]}
            numberOfLines={detail ? undefined : 8}
          >
            {post.texto}
          </Text>
        </Pressable>
      ) : null}

      {post.tipo === 'imagen' && post.cita && (
        <Pressable onPress={verseLink} style={{ alignSelf: 'center' }} accessibilityRole="link">
          <VerseArt
            text={post.cita}
            caption={caption}
            format={post.datos.formato ?? 'cuadrado'}
            look={IMAGE_STYLES.find((s) => s.name === post.datos.estilo) ?? IMAGE_STYLES[0]}
            width={post.datos.formato === 'historia' ? Math.min(inner * 0.62, 260) : Math.min(inner, 420)}
          />
        </Pressable>
      )}

      {post.tipo !== 'imagen' && post.cita && (
        <Pressable
          onPress={verseLink}
          style={[
            styles.quote,
            { borderColor: colors.accent },
            post.tipo === 'resaltado' && { backgroundColor: HIGHLIGHT_COLORS[post.datos.color ?? 'amarillo'] },
          ]}
          accessibilityRole="link"
        >
          <Text style={[styles.quoteText, { color: colors.text }]} numberOfLines={detail ? undefined : 6}>
            «{post.cita}»
          </Text>
          <Text style={{ color: colors.accent, fontWeight: '700', marginTop: 6 }}>{caption}</Text>
        </Pressable>
      )}

      <View style={[styles.foot, { borderColor: colors.border }]}>
        <Pressable
          onPress={toggleLike}
          hitSlop={8}
          style={styles.footItem}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={liked ? 'Ya no me gusta' : 'Me gusta'}
        >
          <HeartIcon color={liked ? '#C2410C' : colors.muted} size={20} filled={liked} />
          <Text style={{ color: liked ? '#C2410C' : colors.muted, fontWeight: '600' }}>{likes || 'Me gusta'}</Text>
        </Pressable>
        <Pressable onPress={openPost} disabled={detail} hitSlop={8} style={styles.footItem} accessibilityRole="button">
          <CommentIcon color={colors.muted} size={19} />
          <Text style={{ color: colors.muted, fontWeight: '600' }}>
            {post.comentarios ? `${post.comentarios} ${post.comentarios === 1 ? 'comentario' : 'comentarios'}` : 'Comentar'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  readingText: { fontFamily: serif, fontSize: 18, fontWeight: '700' },
  question: { fontFamily: serif, fontSize: 19, lineHeight: 27, fontWeight: '600' },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 },
  quoteText: { fontFamily: serif, fontSize: 16, lineHeight: 24 },
  foot: { flexDirection: 'row', gap: 24, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
