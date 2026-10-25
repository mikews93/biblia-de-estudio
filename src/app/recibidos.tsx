// /recibidos: los versículos que los amigos te enviaron (con «Amén» o «Gracias» de un toque) y los que tú enviaste,
// con lo que respondieron. Se llega desde el aviso push, desde Comunidad y al enviar uno.
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import { Avatar, Button, Card, Chips, ErrorText, text } from '@/components/comunidad/ui';
import Welcome from '@/components/comunidad/Welcome';
import { CheckIcon, HeartIcon, PrayIcon } from '@/components/icons';
import VerseArt from '@/components/VerseArt';
import VerseImage from '@/components/VerseImage';
import { lookDeDatos } from '@/lib/compartir';
import { ago, chapterHref, useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { RespuestaVersiculo, VersiculoEnviado, VersiculoRecibido, answerVerse, receivedVerses } from '@/lib/social';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Vista = 'recibidos' | 'enviados';
const RESPUESTA: Record<RespuestaVersiculo, string> = { amen: 'Amén', gracias: 'Gracias' };

export default function Recibidos() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ ver?: string }>();
  const { ready, usuario } = useAccount();
  const [vista, setVista] = useState<Vista>(params.ver === 'enviados' ? 'enviados' : 'recibidos');
  const [datos, setDatos] = useState<{ recibidos: VersiculoRecibido[]; enviados: VersiculoEnviado[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [devolver, setDevolver] = useState<VersiculoRecibido | null>(null);
  const ancho = Math.min(width - 72, 420);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await receivedVerses());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar');
      setDatos((d) => d ?? { recibidos: [], enviados: [] });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (usuario) cargar();
    }, [usuario?.id, cargar]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const nombreLibro = (id: string) => books.find((b) => b.id === id)?.name ?? id;
  const referencia = (v: { libro: string; capitulo: number; versiculo: number }) => `${nombreLibro(v.libro)} ${v.capitulo}:${v.versiculo}`;

  const responder = async (v: VersiculoRecibido, r: RespuestaVersiculo) => {
    setDatos((d) => d && { ...d, recibidos: d.recibidos.map((x) => (x.id === v.id ? { ...x, respuesta: r } : x)) });
    try {
      await answerVerse(v.id, r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo responder');
      setDatos((d) => d && { ...d, recibidos: d.recibidos.map((x) => (x.id === v.id ? { ...x, respuesta: null } : x)) });
    }
  };

  const arte = (v: VersiculoRecibido | VersiculoEnviado) => (
    <Pressable
      onPress={() => navigate(() => router.push(chapterHref(v.libro, v.capitulo, v.versiculo) as never), 'forward')}
      style={{ alignSelf: 'center' }}
      accessibilityRole="link"
      accessibilityLabel={`Leer ${referencia(v)}`}
    >
      <VerseArt
        text={v.cita}
        caption={`${referencia(v)} (${v.version})`}
        format={v.datos.formato ?? 'cuadrado'}
        look={lookDeDatos(v.datos)}
        width={v.datos.formato === 'historia' ? Math.min(ancho * 0.62, 260) : ancho}
      />
    </Pressable>
  );

  const recibido = (v: VersiculoRecibido, i: number) => (
    <Appear key={v.id} delay={i * 40}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <Avatar name={v.deNombre} foto={v.deFoto} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15 }}>
              <Text style={{ fontWeight: '700' }}>{v.deNombre}</Text> te envió un versículo
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{ago(v.creado)}</Text>
          </View>
          {!v.visto && <View style={[styles.dot, { backgroundColor: colors.warm }]} accessibilityLabel="Nuevo" />}
        </View>
        {arte(v)}
        {v.respuesta ? (
          <View style={[styles.answered, { backgroundColor: colors.warmSoft }]}>
            <CheckIcon color={colors.warm} size={15} strokeWidth={2.4} />
            <Text style={{ color: colors.warm, fontWeight: '700' }}>
              Respondiste «{RESPUESTA[v.respuesta]}» a {v.deNombre.split(' ')[0]}
            </Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable
              onPress={() => responder(v, 'amen')}
              style={({ pressed }) => [styles.answer, { backgroundColor: colors.warm }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Amén a ${v.deNombre}`}
            >
              <PrayIcon color="#FFFFFF" size={18} />
              <Text style={styles.answerText}>Amén</Text>
            </Pressable>
            <Pressable
              onPress={() => responder(v, 'gracias')}
              style={({ pressed }) => [styles.answer, { borderWidth: 1.5, borderColor: colors.warm }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Gracias a ${v.deNombre}`}
            >
              <HeartIcon color={colors.warm} size={18} />
              <Text style={[styles.answerText, { color: colors.warm }]}>Gracias</Text>
            </Pressable>
          </View>
        )}
        <Pressable onPress={() => setDevolver(v)} hitSlop={8} style={{ alignSelf: 'center' }} accessibilityRole="button">
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Pasarlo a otra persona</Text>
        </Pressable>
      </Card>
    </Appear>
  );

  const enviado = (v: VersiculoEnviado, i: number) => (
    <Appear key={v.id} delay={i * 40}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <Avatar name={v.paraNombre} foto={v.paraFoto} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15 }}>
              Para <Text style={{ fontWeight: '700' }}>{v.paraNombre}</Text>
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{ago(v.creado)}</Text>
          </View>
        </View>
        {arte(v)}
        {v.respuesta ? (
          <View style={[styles.answered, { backgroundColor: colors.warmSoft }]}>
            {v.respuesta === 'amen' ? <PrayIcon color={colors.warm} size={16} /> : <HeartIcon color={colors.warm} size={16} />}
            <Text style={{ color: colors.warm, fontWeight: '700' }}>
              {v.paraNombre.split(' ')[0]} {v.respuesta === 'amen' ? 'dijo «Amén»' : 'te dio las gracias'}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.muted, textAlign: 'center' }}>Aún sin respuesta</Text>
        )}
      </Card>
    </Appear>
  );

  const lista = vista === 'recibidos' ? datos?.recibidos : datos?.enviados;
  const nuevos = datos?.recibidos.filter((v) => !v.visto).length ?? 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.page}
      refreshControl={
        usuario ? <RefreshControl refreshing={refreshing} onRefresh={async () => (setRefreshing(true), await cargar(), setRefreshing(false))} /> : undefined
      }
    >
      <Stack.Screen options={{ title: 'Versículos para ti' }} />
      <Text style={[styles.title, { color: colors.text }]}>Versículos para ti</Text>
      <Text style={[styles.lead, { color: colors.muted }]}>
        Lo que tus amigos te enviaron pensando en ti, y lo que tú enviaste. Un «Amén» o un «Gracias» les dice que les llegó.
      </Text>

      {!ready ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />
      ) : !usuario ? (
        <Welcome intro="Con una cuenta gratuita tus amigos pueden enviarte versículos y tú a ellos, con un aviso en el teléfono." />
      ) : (
        <>
          <View style={styles.bar}>
            <Chips
              options={[
                { value: 'recibidos', label: nuevos ? `Recibidos · ${nuevos}` : 'Recibidos' },
                { value: 'enviados', label: 'Enviados' },
              ]}
              value={vista}
              onChange={setVista}
            />
          </View>
          <ErrorText>{error}</ErrorText>
          {!lista ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 30 }} />
          ) : !lista.length ? (
            <Card style={{ gap: 12 }}>
              <Text style={[text.body, { color: colors.text }]}>
                {vista === 'recibidos'
                  ? 'Todavía nadie te ha enviado un versículo. ¿Por qué no empiezas tú? Piensa en alguien a quien le haga falta hoy.'
                  : 'Aún no has enviado versículos. Al compartir uno, elige «Enviar a un amigo de Zarza».'}
              </Text>
              <Button label="Elegir uno para alguien" kind="outline" onPress={() => navigate(() => router.push('/ocasiones'), 'forward')} />
            </Card>
          ) : (
            <View style={{ gap: 16 }}>{vista === 'recibidos' ? datos!.recibidos.map(recibido) : datos!.enviados.map(enviado)}</View>
          )}
        </>
      )}
      {devolver && (
        <VerseImage
          verse={{ book: devolver.libro, chapter: devolver.capitulo, verse: devolver.versiculo, text: devolver.cita, reference: referencia(devolver), version: devolver.version }}
          inicial={{ fondo: devolver.datos.estilo, letra: devolver.datos.letra }}
          onClose={() => setDevolver(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', fontFamily: serif },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 6 },
  bar: { marginTop: 12, marginBottom: 14 },
  card: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  actions: { flexDirection: 'row', gap: 10 },
  answer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 24, paddingVertical: 12 },
  answerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  answered: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
