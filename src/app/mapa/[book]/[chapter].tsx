// /mapa/juan/3: los lugares que nombra un capítulo, sobre el mapa
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import PlaceMap from '@/components/PlaceMap';
import { Book, Place, getBooks, getPlaces } from '@/lib/data';
import { bookIdFromParam, verseHref } from '@/lib/routes';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

export default function ChapterMap() {
  const params = useLocalSearchParams<{ book: string; chapter: string }>();
  const bookId = bookIdFromParam(params.book);
  const chapter = Number(params.chapter);
  const colors = useColors();
  const [book, setBook] = useState<Book | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    getBooks().then((bs) => setBook(bs.find((b) => b.id === bookId) ?? null));
    getPlaces(bookId, chapter).then(setPlaces);
  }, [bookId, chapter]);

  const open = (v: number) => navigate(() => router.push(verseHref(bookId, chapter, v)), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: book ? `Lugares de ${book.name} ${chapter}` : 'Lugares' }} />
      {!places ? (
        <ActivityIndicator color={colors.accent} />
      ) : !places.length ? (
        <Text style={{ color: colors.muted }}>Este capítulo no nombra lugares que se puedan ubicar.</Text>
      ) : (
        <>
          <PlaceMap places={places} colors={colors} height={380} onVerse={open} />
          <View style={{ marginTop: 20 }}>
            {places.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => open(p.verses[0])}
                style={[styles.row, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17 }}>{p.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {p.verses.length === 1 ? `v. ${p.verses[0]}` : `vv. ${p.verses.join(', ')}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
