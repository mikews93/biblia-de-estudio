import { Stack, router } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import Appear from '@/components/Appear';
import {
  ArcsIcon,
  BellIcon,
  BooksIcon,
  CandleIcon,
  CardsIcon,
  ChevronRightIcon,
  ChurchIcon,
  ClockIcon,
  CloseIcon,
  CompareIcon,
  DictionaryIcon,
  DocumentIcon,
  DownloadIcon,
  FlameIcon,
  HammerIcon,
  HeartIcon,
  type IconProps,
  InviteIcon,
  LampIcon,
  LecternIcon,
  ListenIcon,
  LiveIcon,
  MindMapIcon,
  PeopleIcon,
  PencilIcon,
  PersonIcon,
  PinIcon,
  PlansIcon,
  PromiseIcon,
  RepeatIcon,
  RingsIcon,
  RouteIcon,
  ScrollIcon,
  SearchIcon,
  ShareIcon,
  ShieldIcon,
  SparkIcon,
  StarIcon,
  SunIcon,
  SunriseIcon,
  TopicIcon,
  TreeIcon,
  WordJourneyIcon,
} from '@/components/icons';
import { type Icono, catalogo, filtrar, type Funcion } from '@/lib/todo';
import { isDark, serif, useColors, useLastRead, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const ICONOS: Record<Icono, (p: IconProps) => ReactNode> = {
  books: BooksIcon,
  plans: PlansIcon,
  compare: CompareIcon,
  listen: ListenIcon,
  download: DownloadIcon,
  sun: SunIcon,
  spark: SparkIcon,
  search: SearchIcon,
  word: WordJourneyIcon,
  arcs: ArcsIcon,
  promise: PromiseIcon,
  clock: ClockIcon,
  tree: TreeIcon,
  route: RouteIcon,
  pin: PinIcon,
  mindmap: MindMapIcon,
  cards: CardsIcon,
  heart: HeartIcon,
  pencil: PencilIcon,
  document: DocumentIcon,
  star: (p) => <StarIcon {...p} />,
  sunrise: SunriseIcon,
  topic: TopicIcon,
  lectern: LecternIcon,
  scroll: ScrollIcon,
  calendar: RepeatIcon,
  live: LiveIcon,
  people: PeopleIcon,
  invite: InviteIcon,
  share: ShareIcon,
  gift: HeartIcon,
  rings: RingsIcon,
  candle: CandleIcon,
  hammer: HammerIcon,
  church: ChurchIcon,
  bell: BellIcon,
  person: PersonIcon,
  lamp: LampIcon,
  flame: FlameIcon,
  shield: ShieldIcon,
  dictionary: DictionaryIcon,
};

/** «Todo en Zarza»: cada función en un solo lugar, por grupos, con un buscador (src/lib/todo.ts). */
export default function Todo() {
  const colors = useColors();
  const { settings } = useSettings();
  const last = useLastRead();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const dosColumnas = width >= 820;

  const grupos = useMemo(() => {
    const todos = catalogo(last ?? { book: 'jhn', chapter: 1 }).map((g) => ({
      ...g,
      funciones: g.funciones.filter((f) => !(f.soloAdultos && settings.modo === 'jovenes')),
    }));
    return filtrar(todos, q);
  }, [last, q, settings.modo]);

  const abrir = (f: Funcion) => navigate(() => router.push(f.href as never), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.page, dosColumnas && { maxWidth: 980 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '' }} />
      <Appear>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Todo en Zarza
        </Text>
        <Text style={[styles.lead, { color: colors.muted }]}>Cada parte de la app, ordenada por lo que quieres hacer.</Text>
      </Appear>

      <Appear delay={40}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: q ? colors.accent : colors.border }]}>
          <SearchIcon color={colors.muted} size={20} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar: mapa, oración, sermón…"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
            accessibilityLabel="Buscar una función"
            returnKeyType="search"
            autoCorrect={false}
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
              <CloseIcon color={colors.muted} size={18} />
            </Pressable>
          )}
        </View>
      </Appear>

      {grupos.length === 0 && (
        <Appear style={[styles.empty, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontFamily: serif, fontSize: 19, fontWeight: '700', textAlign: 'center' }}>Nada con «{q.trim()}»</Text>
          <Text style={{ color: colors.muted, fontSize: 14.5, textAlign: 'center' }}>Prueba con otra palabra, o busca en la Biblia desde Hoy.</Text>
        </Appear>
      )}

      <View style={dosColumnas ? styles.columnas : undefined}>
        {grupos.map((g, gi) => (
          <Appear key={g.id} delay={60 + gi * 30} style={[styles.grupo, dosColumnas && styles.grupoColumna]}>
            <Text style={[styles.kicker, { color: colors.accent }]} accessibilityRole="header">
              {g.titulo.toUpperCase()}
            </Text>
            <Text style={[styles.grupoDetalle, { color: colors.muted }]}>{g.detalle}</Text>
            <View style={[styles.lista, { backgroundColor: colors.surface, borderColor: colors.border }, !isDark(colors) && styles.sombra]}>
              {g.funciones.map((f, i) => {
                const Icon = ICONOS[f.icono];
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => abrir(f)}
                    accessibilityRole="link"
                    accessibilityLabel={`${f.titulo}. ${f.detalle}`}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.fila,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                      (pressed || hovered) && { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <View style={[styles.icono, { backgroundColor: colors.accentSoft }]}>
                      <Icon color={colors.accent} size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.filaTitulo, { color: colors.text }]}>{f.titulo}</Text>
                      <Text style={[styles.filaDetalle, { color: colors.muted }]}>{f.detalle}</Text>
                    </View>
                    <ChevronRightIcon color={colors.muted} size={18} />
                  </Pressable>
                );
              })}
            </View>
          </Appear>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 96, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' },
  title: { fontFamily: serif, fontSize: 32, fontWeight: '700' },
  lead: { fontSize: 15.5, lineHeight: 22, marginTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, minHeight: 52, marginTop: 4 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 12, outlineStyle: 'none' } as never,
  columnas: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' },
  grupo: { gap: 4, marginTop: 10 },
  grupoColumna: { flexBasis: '46%', flexGrow: 1 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  grupoDetalle: { fontSize: 13.5, lineHeight: 19, marginBottom: 8 },
  lista: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sombra: { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' } as never,
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13, minHeight: 64 },
  icono: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  filaTitulo: { fontSize: 16, fontWeight: '700' },
  filaDetalle: { fontSize: 13.5, lineHeight: 18, marginTop: 2 },
  empty: { alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: 20, padding: 28, marginTop: 8 },
});
