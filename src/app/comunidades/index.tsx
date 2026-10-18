import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import Post from '@/components/comunidad/Post';
import Welcome from '@/components/comunidad/Welcome';
import { Avatar, Button, Card, Chips, ErrorText, text } from '@/components/comunidad/ui';
import { useAccount } from '@/lib/comunidad';
import { Audiencia, Publicacion, network, wall } from '@/lib/social';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** La pestaña Comunidad: lo que leen y comparten tus amigos y la comunidad, con «me gusta» y comentarios. */
export default function Comunidad() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [filter, setFilter] = useState<Audiencia>('amigos');
  const [posts, setPosts] = useState<Publicacion[] | null>(null);
  const [more, setMore] = useState(true);
  const [requests, setRequests] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Solo cuenta la última carga: si se cambia de filtro a mitad, la respuesta anterior se descarta.
  const latest = useRef(0);

  const load = useCallback(async (which: Audiencia, append?: string) => {
    const n = ++latest.current;
    setError(null);
    try {
      const page = await wall(which, append);
      if (n !== latest.current) return;
      setPosts((old) => (append && old ? [...old, ...page] : page));
      setMore(page.length >= 30);
    } catch (e) {
      if (n !== latest.current) return;
      setError(e instanceof Error ? e.message : String(e));
      if (!append) setPosts([]);
    }
  }, []);

  // Al volver a la pestaña se refresca, para ver los «me gusta» y comentarios nuevos.
  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;
      load(filter);
      network()
        .then((r) => setRequests(r.recibidas.length))
        .catch(() => {});
    }, [usuario?.id, filter, load]),
  );

  const change = (f: Audiencia) => {
    setFilter(f);
    setPosts(null);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  };

  const go = (href: string) => navigate(() => router.push(href as never), 'forward');

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.page}
      refreshControl={usuario ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} /> : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Comunidad',
          headerRight: () =>
            usuario ? (
              <Pressable onPress={() => go('/cuenta')} hitSlop={8} style={{ marginRight: 16 }} accessibilityLabel="Tu cuenta">
                <Avatar name={usuario.nombre} size={30} />
              </Pressable>
            ) : null,
        }}
      />

      {!ready ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : !usuario ? (
        <>
          <Text style={[text.title, { color: colors.text, marginBottom: 12 }]}>La comunidad</Text>
          <Welcome intro="Mira lo que leen tus amigos, comparte los versículos que resaltas y las imágenes que creas, haz preguntas y anímense unos a otros." />
        </>
      ) : (
        <>
          <Pressable onPress={() => go('/comunidades/publicar')} accessibilityRole="button">
            <Card style={styles.composer}>
              <Avatar name={usuario.nombre} size={36} filled />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 15 }}>Pregúntale algo a la comunidad…</Text>
            </Card>
          </Pressable>

          <View style={styles.bar}>
            <Chips
              options={[
                { value: 'amigos', label: 'Amigos' },
                { value: 'todos', label: 'Todos' },
              ]}
              value={filter}
              onChange={change}
            />
            <Pressable onPress={() => go('/comunidades/amigos')} hitSlop={8} style={styles.friends} accessibilityRole="link">
              <Text style={{ color: colors.accent, fontWeight: '700' }}>＋ Amigos</Text>
              {requests > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={{ color: colors.surface, fontSize: 11, fontWeight: '700' }}>{requests}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <ErrorText>{error}</ErrorText>

          {posts === null ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : posts.length === 0 ? (
            <Card style={{ gap: 12, marginTop: 4 }}>
              <Text style={[text.body, { color: colors.text }]}>
                {filter === 'amigos'
                  ? 'Aquí verás lo que leen tus amigos, los versículos que resaltan, las imágenes que crean y sus preguntas.'
                  : 'Todavía nadie ha publicado para toda la comunidad. ¡Sé el primero con una pregunta o un versículo!'}
              </Text>
              {filter === 'amigos' && <Button label="Agregar amigos" kind="outline" onPress={() => go('/comunidades/amigos')} />}
              <Text style={[text.small, { color: colors.muted }]}>
                Para compartir un versículo, tócalo mientras lees y elige «Compartir» y luego «Publicar en Comunidad».
              </Text>
            </Card>
          ) : (
            <View style={{ gap: 14 }}>
              {posts.map((p) => (
                <Post key={p.id} post={p} />
              ))}
              {more && (
                <Button label="Ver más" kind="quiet" onPress={() => load(filter, posts[posts.length - 1].actualizado)} />
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 14 },
  friends: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});
