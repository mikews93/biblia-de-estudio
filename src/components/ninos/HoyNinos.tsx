import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import SelloArte from '@/components/Sello';
import { HeartIcon, LockIcon, OpenBookIcon, PlayIcon, StarIcon } from '@/components/icons';
import { Estrellas } from '@/components/jovenes/arte';
import { Cuadro, Escuchar, Medallon } from '@/components/ninos/ui';
import { useNarrador } from '@/lib/narrador';
import { SELLOS_NINOS, charlaPendiente, conversada, estrellasHistoria, siguienteHistoria, totalEstrellas, useNinos, versoDeLaSemana } from '@/lib/ninos';
import { HISTORIAS } from '@/lib/ninosHistorias';
import { avance, useSellos } from '@/lib/sellos';
import { chapterHref } from '@/lib/routes';
import { serif, useColors, useLastRead } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Hoy en el Espacio Niños: la historia que sigue, el versículo de la semana, la charla en familia y los sellos. */
export default function HoyNinos() {
  const colors = useColors();
  const s = useNinos();
  const album = useSellos();
  const last = useLastRead();
  const sig = siguienteHistoria(s);
  const hoy = HISTORIAS[sig ?? 0];
  const verso = versoDeLaSemana();
  const charla = charlaPendiente(s);
  const n = useNarrador([`${verso.texto} ${verso.ref}.`]);
  const go = (href: string) => navigate(() => router.push(href as never), 'forward');
  const hechas = HISTORIAS.filter((h) => s.historias[h.id]).length;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false, title: 'Hoy' }} />

      <Appear>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hola, { color: colors.text, fontFamily: serif }]}>¡Hola! 👋</Text>
            <Text style={{ color: colors.muted, fontSize: 16, marginTop: 2 }}>¿Qué historia escuchamos hoy?</Text>
          </View>
          <Pressable
            onPress={() => go('/ninos')}
            style={({ pressed }) => [styles.estrellas, { backgroundColor: colors.warmSoft }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${totalEstrellas(s)} estrellas. Ver el camino`}
          >
            <StarIcon filled color={colors.warm} size={20} />
            <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 18 }}>{totalEstrellas(s)}</Text>
          </Pressable>
        </View>
      </Appear>

      <Appear delay={40}>
        <Pressable
          onPress={() => go(`/ninos/${hoy.id}`)}
          style={({ pressed }) => [styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Escuchar ${hoy.titulo}`}
          testID="historia-de-hoy"
        >
          <Cuadro id={hoy.id} radio={0} />
          <View style={styles.heroPie}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: colors.warm }]}>{sig === null ? 'Escucha otra vez' : hechas === 0 ? 'Tu primera historia' : 'La historia que sigue'}</Text>
              <Text style={[styles.heroTitulo, { color: colors.text, fontFamily: serif }]}>{hoy.titulo}</Text>
            </View>
            <View style={[styles.play, { backgroundColor: colors.warm }]}>
              <PlayIcon color={colors.surface} size={26} />
            </View>
          </View>
        </Pressable>
      </Appear>

      {charla && (
        <Appear delay={60}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="charla-pendiente">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HeartIcon color={colors.warm} size={18} />
              <Text style={[styles.kicker, { color: colors.warm }]}>Para hablar en familia</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 18, lineHeight: 26, marginTop: 8, fontFamily: serif }}>{charla.familia}</Text>
            <Pressable
              onPress={() => conversada(charla.id, true)}
              style={({ pressed }) => [styles.small, { backgroundColor: colors.warm }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.surface, fontWeight: '800', fontSize: 15 }}>Lo hablamos ⭐</Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>De «{charla.titulo}». Que lo marque un adulto.</Text>
          </View>
        </Appear>
      )}

      <Appear delay={80}>
        <View style={[styles.card, { backgroundColor: colors.warmSoft, borderColor: colors.warmSoft }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.kicker, { color: colors.warm, flex: 1 }]}>Versículo de la semana</Text>
            {s.memoria[verso.id] && <HeartIcon color={colors.warm} size={18} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 }}>
            <Text style={[styles.verso, { color: colors.text, fontFamily: serif, flex: 1 }]}>«{verso.texto}»</Text>
            <Escuchar sonando={n.sonando} onPress={() => (n.sonando ? n.parar() : n.leer())} label="Escuchar el versículo" />
          </View>
          <Text style={{ color: colors.text, fontWeight: '800', marginTop: 6, opacity: 0.8 }}>{verso.ref}</Text>
          <Pressable
            onPress={() => go('/ninos/memoria')}
            style={({ pressed }) => [styles.small, { backgroundColor: colors.surface }, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="jugar-memoria"
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{s.memoria[verso.id] ? 'Jugar otra vez' : '¡A memorizarlo!'} ›</Text>
          </Pressable>
        </View>
      </Appear>

      <Appear delay={100}>
        <Pressable
          onPress={() => go('/ninos')}
          style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[styles.kicker, { color: colors.accent, flex: 1 }]}>Camino de historias · {hechas} de {HISTORIAS.length}</Text>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Ver ›</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tira}>
            {HISTORIAS.map((h, i) => {
              const reg = s.historias[h.id];
              const abierta = i === 0 || !!s.historias[HISTORIAS[i - 1].id];
              return (
                <View key={h.id} style={{ alignItems: 'center', gap: 4, width: 70 }}>
                  <View>
                    <Medallon id={h.id} size={62} borde={reg || i === sig ? colors.warm : colors.border} grueso={i === sig ? 3 : 2} apagado={!abierta} />
                    {!abierta && (
                      <View style={[styles.candado, { backgroundColor: colors.surface }]}>
                        <LockIcon color={colors.muted} size={12} />
                      </View>
                    )}
                  </View>
                  {reg ? <Estrellas n={estrellasHistoria(reg)} color={colors.warm} vacio={colors.border} size={11} /> : <View style={{ height: 13 }} />}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Appear>

      <Appear delay={120}>
        <Pressable
          onPress={() => go('/sellos')}
          style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="sellos-ninos"
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[styles.kicker, { color: colors.accent, flex: 1 }]}>Mis sellos · {SELLOS_NINOS.filter((x) => album.ganados[x.id]).length} de {SELLOS_NINOS.length}</Text>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Ver todo ›</Text>
          </View>
          <View style={styles.vitrina}>
            {SELLOS_NINOS.slice(0, 4).map((x) => {
              const { ganado, parte } = avance(album, x);
              return (
                <View key={x.id} style={{ alignItems: 'center', width: 76 }}>
                  <SelloArte dibujo={x.dibujo} colors={colors} ganado={!!ganado} parte={parte} size={58} />
                  <Text style={{ color: ganado ? colors.text : colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' }} numberOfLines={2}>
                    {x.titulo}
                  </Text>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Appear>

      <Appear delay={140}>
        <Pressable
          onPress={() => go(chapterHref(last?.book ?? 'mrk', last?.chapter ?? 1))}
          style={({ pressed }) => [styles.biblia, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={[styles.bibliaIcono, { backgroundColor: colors.accentSoft }]}>
            <OpenBookIcon color={colors.accent} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Leer la Biblia</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Con un adulto, en el Español Sencillo</Text>
          </View>
        </Pressable>
      </Appear>

      <Pressable onPress={() => go('/modo')} style={styles.modo} accessibilityRole="link" testID="cambiar-modo">
        <LockIcon color={colors.muted} size={13} />
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Espacio Niños · <Text style={{ fontWeight: '700' }}>Para papás</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 48, paddingBottom: 64, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hola: { fontSize: 34 },
  estrellas: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, paddingHorizontal: 14, height: 44 },
  kicker: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  hero: { borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  heroPie: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  heroTitulo: { fontSize: 28, marginTop: 4, lineHeight: 34 },
  play: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  small: { alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 11, marginTop: 14 },
  verso: { fontSize: 22, lineHeight: 31 },
  tira: { gap: 6, paddingTop: 14 },
  candado: { position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  vitrina: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  biblia: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  bibliaIcono: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modo: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 10 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
