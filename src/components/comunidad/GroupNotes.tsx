import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAccount } from '@/lib/comunidad';
import { Book } from '@/lib/data';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import Notes from './Notes';
import { Button, text } from './ui';

type Props = { book: Book; books: Book[]; chapter: number; verse: number; onNavigate: () => void };

/** Pestaña «Grupo» del panel del versículo: notas de tus grupos sobre este versículo y la tuya. */
export default function GroupNotes({ book, books, chapter, verse, onNavigate }: Props) {
  const colors = useColors();
  const { ready, usuario, grupos } = useAccount();
  const go = () => {
    onNavigate();
    navigate(() => router.push('/comunidades'), 'forward');
  };

  if (!ready || (usuario && grupos === null)) return <ActivityIndicator color={colors.accent} />;
  if (!usuario || !grupos?.length) {
    return (
      <View style={{ gap: 14 }}>
        <Text style={[text.body, { color: colors.text }]}>
          Comparte lo que te dice este versículo con tu célula, tu iglesia o tu familia, y lee lo que escribieron ellos.
        </Text>
        <Button label={usuario ? 'Crear o unirme a un grupo' : 'Empezar un grupo'} kind="outline" onPress={go} />
      </View>
    );
  }
  return (
    <Notes
      books={books}
      writeTo={grupos.map((g) => ({ id: g.id, nombre: g.nombre }))}
      passage={{ book: book.id, chapter, verse }}
      fixed
      onNavigate={onNavigate}
    />
  );
}
