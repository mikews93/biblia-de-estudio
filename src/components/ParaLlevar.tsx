// «Para llevar a casa»: los versículos del mensaje como tarjetas listas para compartir, al terminar de presentar
// y en la página del evento cuando el mensaje terminó.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { IconText } from '@/components/comunidad/ui';
import { ShareIcon } from '@/components/icons';
import VerseArt from '@/components/VerseArt';
import VerseImage from '@/components/VerseImage';
import type { VerseToShare } from '@/lib/compartir';
import type { Book } from '@/lib/data';
import { fondoPorNombre, letraPorId, useLetras } from '@/lib/fondos';
import { ESTILOS_TARJETA, dedicatoriaDe, versiculosParaLlevar } from '@/lib/paraLlevar';
import type { Pasaje } from '@/lib/taller';
import { Colors, serif } from '@/lib/theme';

type Props = {
  titulo: string;
  pasaje: Pasaje | null | undefined;
  citas: string[];
  books: Book[];
  colors: Colors;
  /** Quien presenta lo ve como invitación para la congregación; quien escuchó, para sí. */
  para: 'presentar' | 'escuchar';
};

export default function ParaLlevar({ titulo, pasaje, citas, books, colors, para }: Props) {
  const { width } = useWindowDimensions();
  const [versos, setVersos] = useState<VerseToShare[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const clave = `${pasaje?.book}.${pasaje?.chapter}.${pasaje?.from}|${citas.join('|')}`;
  useLetras();

  useEffect(() => {
    if (!books.length) return;
    let vivo = true;
    versiculosParaLlevar(pasaje, citas, books).then((v) => vivo && setVersos(v));
    return () => {
      vivo = false;
    };
  }, [clave, books.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!versos.length) return null;
  const ancho = Math.min(220, Math.max(150, (Math.min(width, 820) - 80) / 3));
  const dedicatoria = dedicatoriaDe(titulo);
  const estilo = (i: number) => ESTILOS_TARJETA[i % ESTILOS_TARJETA.length];

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.warm }]}>PARA LLEVAR A CASA</Text>
      <Text style={[styles.title, { color: colors.text }]}>{para === 'presentar' ? 'Los versículos de hoy, listos para compartir' : 'Comparte lo que oíste hoy'}</Text>
      <Text style={[styles.lead, { color: colors.muted }]}>
        {para === 'presentar'
          ? 'Invita a la congregación a enviarle uno a alguien esta semana. Toca una tarjeta para hacer la imagen.'
          : '¿A quién le haría bien este versículo esta semana? Toca una tarjeta, cámbiala si quieres y envíala.'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.row}>
        {versos.map((v, i) => {
          const e = estilo(i);
          return (
            <Pressable
              key={`${v.book}.${v.chapter}.${v.verse}`}
              onPress={() => setAbierto(i)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`Compartir ${v.reference}`}
            >
              <VerseArt
                text={v.text}
                caption={`${v.reference} (${v.version})`}
                format="cuadrado"
                look={{ fondo: fondoPorNombre(e.fondo), letra: letraPorId(e.letra), dedicatoria }}
                width={ancho}
              />
              <IconText icon={ShareIcon} color={colors.accent} size={14} gap={6}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13.5 }}>{v.reference}</Text>
              </IconText>
            </Pressable>
          );
        })}
      </ScrollView>
      {abierto !== null && versos[abierto] && (
        <VerseImage
          verse={versos[abierto]}
          inicial={{ fondo: estilo(abierto).fondo, letra: estilo(abierto).letra, dedicatoria }}
          onClose={() => setAbierto(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginTop: 24 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontFamily: serif, fontSize: 21, fontWeight: '700', marginTop: 4 },
  lead: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  strip: { alignSelf: 'stretch', marginTop: 14, marginHorizontal: -18 },
  row: { gap: 12, paddingHorizontal: 18 },
  card: { gap: 8, borderRadius: 12, overflow: 'hidden' },
});
