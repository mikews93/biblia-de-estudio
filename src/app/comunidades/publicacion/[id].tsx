import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Post from '@/components/comunidad/Post';
import { confirm } from '@/components/comunidad/confirm';
import { Avatar, Button, ErrorText, Field, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import { ago } from '@/lib/comunidad';
import { Comentario, Publicacion, comment, deleteComment, getPost } from '@/lib/social';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Una publicación con sus comentarios. */
export default function PostScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Publicacion | null>(null);
  const [comments, setComments] = useState<Comentario[]>([]);
  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  const load = useCallback(() => {
    getPost(id)
      .then((r) => {
        setPost(r.publicacion);
        setComments(r.comentarios);
      })
      .catch((e) => setLoadError(e.message));
  }, [id]);

  useEffect(load, [load]);

  const send = () =>
    run(async () => {
      await comment(id, draft);
      setDraft('');
      load();
    });

  const remove = async (c: Comentario) => {
    if (!(await confirm('¿Borrar este comentario?', '', 'Borrar'))) return;
    await deleteComment(c.id).catch(() => {});
    load();
  };

  if (!post) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: '' }} />
        {loadError ? <ErrorText>{loadError}</ErrorText> : <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: post.tipo === 'pregunta' ? 'Pregunta' : 'Publicación' }} />
      {/* La clave cambia con el conteo para que la tarjeta muestre el número nuevo de comentarios. */}
      <Post key={`${post.id}-${post.comentarios}`} post={post} detail onRemoved={() => router.back()} />

      <SectionTitle>{comments.length ? 'Comentarios' : 'Sé el primero en comentar'}</SectionTitle>
      <View style={{ gap: 14 }}>
        {comments.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Pressable onPress={() => navigate(() => router.push(`/comunidades/persona/${c.autorId}`), 'forward')}>
              <Avatar name={c.autor} foto={c.autorFoto} racha={c.autorRacha} servicio={c.autorServicio} size={32} />
            </Pressable>
            <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{c.autor}</Text>
              <Text style={[text.body, { color: colors.text }]}>{c.texto}</Text>
              <View style={styles.meta}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{ago(c.creado)}</Text>
                {(c.mio || post.mia) && (
                  <Pressable onPress={() => remove(c)} hitSlop={8}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>Borrar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 10, marginTop: 20 }}>
        <Field
          value={draft}
          onChangeText={setDraft}
          placeholder={post.tipo === 'pregunta' ? 'Escribe tu respuesta…' : 'Escribe un comentario…'}
          multiline
          maxLength={500}
        />
        <Button label="Comentar" onPress={send} busy={busy} disabled={!draft.trim()} />
        <ErrorText>{error}</ErrorText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bubble: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  meta: { flexDirection: 'row', gap: 14, marginTop: 4 },
});
