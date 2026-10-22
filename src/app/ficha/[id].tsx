// /ficha/h1732-david: ficha de una persona o un lugar de la Biblia (STEPBible TIPNR): quién fue, su familia, cuándo
// vivió, dónde, sus versículos clave y en qué libros aparece. Junta las genealogías, los mapas y la línea de tiempo.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import Appear from '@/components/Appear';
import { Rich } from '@/components/Commentary';
import { Icono } from '@/components/FichaChips';
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, ClockIcon, TreeIcon } from '@/components/icons';
import PlaceMap from '@/components/PlaceMap';
import { Book, Place, formatRef, getBooks, parseRef } from '@/lib/data';
import {
  FUENTE_FICHAS,
  Ficha,
  FichaRef,
  LugarRef,
  epocaDe,
  fichaHref,
  fichaId,
  getDescripcion,
  getFicha,
  traducirFicha,
} from '@/lib/fichas';
import { ERAS, REGION_COLORS, esCorriente, eventosDe, fechaEvento, fechaPeriodo, rango } from '@/lib/historia';
import { verseHref } from '@/lib/routes';
import { huella, huellaLugar } from '@/lib/sellos';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Libros que se muestran antes de «Ver todos». */
const LIBROS_CORTO = 6;
const JESUS = 'g2424g';

export default function FichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fid = fichaId(String(id));
  const colors = useColors();
  const wide = useWindowDimensions().width >= 1000;
  // Lo cargado va con su id: al pasar de una ficha a otra no se ve la anterior
  const [loaded, setLoaded] = useState<{ id: string; ficha?: Ficha; error?: string } | null>(null);
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    getFicha(fid).then(
      (ficha) => setLoaded({ id: fid, ficha }),
      (e) =>
        setLoaded({
          id: fid,
          error: e instanceof Error && /404/.test(e.message) ? 'No encontramos esta ficha.' : 'No se pudo cargar la ficha.',
        }),
    );
    getBooks().then(setBooks, () => {});
  }, [fid]);
  const ficha = loaded?.id === fid ? loaded.ficha : undefined;
  const error = loaded?.id === fid ? loaded.error : undefined;
  // El pasaporte de Mis sellos: cada lugar visitado y cada persona conocida
  useEffect(() => {
    if (!ficha) return;
    if (ficha.tipo === 'l') huellaLugar(ficha.nombre);
    else if (ficha.tipo !== 'g') huella('persona', ficha.id);
  }, [ficha]);

  const go = (href: string) => navigate(() => router.push(href as never), 'forward');
  const open = (r: { id: string; nombre: string }) => go(fichaHref(r));
  const openRef = (ref: string) => {
    const { start } = parseRef(ref);
    go(verseHref(start.book, start.chapter, start.verse));
  };

  if (error) return <Text style={[styles.message, { color: colors.muted }]}>{error}</Text>;
  if (!ficha) return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;

  const lugar = ficha.tipo === 'l';
  const descripcion = <Descripcion ficha={ficha} books={books} colors={colors} onRef={openRef} />;
  const claves = ficha.claves.length > 0 && (
    <Section title="Versículos clave" colors={colors}>
      {ficha.claves.map(([ref, text]) => (
        <Pressable
          key={ref}
          onPress={() => openRef(ref)}
          style={({ pressed }) => [styles.verse, { borderColor: colors.accent }, pressed && styles.pressed]}
          accessibilityRole="link"
        >
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{books.length ? formatRef(ref, books) : ref}</Text>
          <Text style={[styles.verseText, { color: colors.text }]} numberOfLines={4}>
            {text}
            {ref.includes('-') ? ' …' : ''}
          </Text>
        </Pressable>
      ))}
    </Section>
  );
  const apariciones = <Apariciones ficha={ficha} books={books} colors={colors} onVerse={openRef} />;
  const contexto = (
    <>
      {lugar ? <MapaLugar ficha={ficha} colors={colors} onOpen={open} /> : <Epoca ficha={ficha} colors={colors} onGo={go} />}
      {!lugar && <Familia ficha={ficha} colors={colors} onOpen={open} onTree={go} />}
      {!lugar && !!ficha.lugares?.length && (
        <Section title="Lugares de su historia" colors={colors} hint="Los que más se nombran con esta persona. Toca uno para ver su ficha.">
          <PlaceMap
            places={ficha.lugares.map(toPlace)}
            colors={colors}
            height={260}
            onOpen={(pid) => {
              const l = ficha.lugares!.find((x) => x.id === pid);
              if (l) open(l);
            }}
          />
        </Section>
      )}
      {lugar && <Gente title="Fundado por" people={ficha.fundador} colors={colors} onOpen={open} />}
      {lugar && <Gente title="Vivieron aquí" people={ficha.habitantes} colors={colors} onOpen={open} />}
      <Gente
        title={lugar ? 'Personas de este lugar' : 'Aparece con'}
        hint={lugar ? 'Las que más se nombran en los mismos versículos.' : 'Otras personas que se nombran en los mismos versículos.'}
        people={lugar ? ficha.personas : ficha.junto}
        colors={colors}
        onOpen={open}
      />
    </>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, wide && styles.contentWide]}>
      <Stack.Screen options={{ title: ficha.nombre.split(' (')[0] }} />
      <Hero ficha={ficha} colors={colors} wide={wide} />
      {wide ? (
        <View style={styles.columns}>
          <View style={{ flex: 1.15 }}>
            {descripcion}
            {claves}
            {apariciones}
          </View>
          <View style={{ flex: 1 }}>{contexto}</View>
        </View>
      ) : (
        <>
          {descripcion}
          {claves}
          {contexto}
          {apariciones}
        </>
      )}
      <Text style={[styles.source, { color: colors.muted }]}>
        {FUENTE_FICHAS}
        {ficha.genealogia ? ' Árbol familiar: Theographic Bible Metadata (CC BY-SA 4.0).' : ''}
        {ficha.mapa || ficha.lugares?.length ? ' Ubicaciones: OpenBible.info (CC BY 4.0).' : ''}
      </Text>
    </ScrollView>
  );
}

const toPlace = (l: LugarRef): Place => ({ ...l, name: l.nombre, en: '', type: '', alt: [], verses: [] });

function Hero({ ficha, colors, wide }: { ficha: Ficha; colors: Colors; wide: boolean }) {
  const lugar = ficha.tipo === 'l';
  const kicker = lugar ? (ficha.clase ?? 'Lugar') : ficha.tipo === 'g' ? 'Pueblo' : ficha.rol ?? (ficha.tipo === 'f' ? 'Mujer de la Biblia' : 'Personaje');
  const [nombre, aparte] = ficha.nombre.split(' (');
  const libros = ficha.citas.length;
  // Sin repetir lo que ya dice el antetítulo: «Rey, hijo de Isaí» -> «Hijo de Isaí»
  const quitar = [ficha.rol, ficha.clase].find((p) => p && ficha.breve.startsWith(p));
  const resto = quitar ? ficha.breve.slice(quitar.length).replace(/^,\s*/, '').trim() : ficha.breve;
  const breve = resto.charAt(0).toUpperCase() + resto.slice(1);
  return (
    <Appear>
      {ficha.foto && <Foto foto={ficha.foto} nombre={nombre} colors={colors} height={wide ? 320 : 210} />}
      <View style={styles.hero}>
        <Icono tipo={ficha.tipo} nombre={nombre} colors={colors} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.accent }]}>{kicker.toUpperCase()}</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {nombre}
            {aparte ? <Text style={{ color: colors.muted, fontSize: 20 }}> ({aparte}</Text> : null}
          </Text>
          {!!breve && <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>{breve}</Text>}
        </View>
      </View>
      {(ficha.original.length > 0 || ficha.otros.length > 0) && (
        <View style={styles.names}>
          {ficha.original.map(([o]) => (
            <View key={o} style={[styles.namePill, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.greek, fontSize: 16 }}>{o}</Text>
            </View>
          ))}
          {ficha.otros.filter((o) => !ficha.nombre.includes(o)).slice(0, 5).map((o) => (
            <View key={o} style={[styles.namePill, { borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: 14 }}>{o}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.stats}>
        <Stat value={ficha.menciones} label={ficha.menciones === 1 ? 'versículo' : 'versículos'} colors={colors} />
        <Stat value={libros} label={libros === 1 ? 'libro' : 'libros'} colors={colors} />
        {lugar ? (
          <Stat text={ficha.mapa ? (ficha.mapa.conf >= 800 ? 'Segura' : ficha.mapa.conf >= 500 ? 'Probable' : 'Discutida') : '—'} label="ubicación" colors={colors} />
        ) : (
          <Stat text={ficha.tribu?.replace(/^(Tribu|Pueblo) de /, '') ?? ficha.epoca?.replace(/^(El|La|Los) /, '') ?? '—'} label={ficha.tribu ? (ficha.tribu.startsWith('Tribu') ? 'tribu' : 'pueblo') : 'época'} colors={colors} />
        )}
      </View>
    </Appear>
  );
}

function Foto({ foto, nombre, colors, height }: { foto: NonNullable<Ficha['foto']>; nombre: string; colors: Colors; height: number }) {
  return (
    <View style={[styles.photo, { backgroundColor: colors.accentSoft }]}>
      <Image source={{ uri: foto.img }} style={{ width: '100%', height }} resizeMode="cover" accessibilityLabel={`Foto de la zona de ${nombre}`} />
      <Text
        style={[styles.photoCredit, { color: colors.muted }]}
        onPress={() => Linking.openURL(foto.page)}
        accessibilityRole="link"
      >
        Foto actual de la zona{foto.author ? ` · ${foto.author}` : ''} · {foto.license} · Wikimedia Commons
      </Text>
    </View>
  );
}

function Stat({ value, text, label, colors }: { value?: number; text?: string; label: string; colors: Colors }) {
  return (
    <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.text, fontFamily: serif, fontSize: text ? 17 : 22, fontWeight: '600', lineHeight: 28 }} numberOfLines={1}>
        {text ?? value?.toLocaleString('es')}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Section({ title, hint, colors, children, right }: { title: string; hint?: string; colors: Colors; children: ReactNode; right?: ReactNode }) {
  return (
    <Appear style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.sectionHead}>
        <Text style={[styles.h2, { color: colors.text }]}>{title}</Text>
        {right}
      </View>
      {!!hint && <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text>}
      {children}
    </Appear>
  );
}

type Desc = { state: 'cargando' } | { state: 'traduciendo'; texto: string } | { state: 'listo'; texto: string } | { state: 'error'; message: string };

/** La descripción de STEPBible en español: la ya traducida, o se traduce ahora (una vez para todos). */
function Descripcion(props: { ficha: Ficha; books: Book[]; colors: Colors; onRef: (ref: string) => void }) {
  // Cada intento vuelve a montar el cuerpo, que empieza cargando
  const [intento, setIntento] = useState(0);
  if (!props.ficha.en) return null;
  return <DescripcionCuerpo key={`${props.ficha.id}-${intento}`} {...props} onRetry={() => setIntento((n) => n + 1)} />;
}

function DescripcionCuerpo({
  ficha,
  books,
  colors,
  onRef,
  onRetry,
}: {
  ficha: Ficha;
  books: Book[];
  colors: Colors;
  onRef: (ref: string) => void;
  onRetry: () => void;
}) {
  const [desc, setDesc] = useState<Desc>({ state: 'cargando' });

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    getDescripcion(ficha.id)
      .then(({ texto }) => {
        if (texto) return texto;
        if (live) setDesc({ state: 'traduciendo', texto: '' });
        return traducirFicha(ficha.id, (t) => live && setDesc({ state: 'traduciendo', texto: t }), controller.signal).then((r) => r.texto);
      })
      .then((texto) => live && setDesc({ state: 'listo', texto }))
      .catch((e) => live && !controller.signal.aborted && setDesc({ state: 'error', message: e instanceof Error ? e.message : 'No se pudo traducir la descripción.' }));
    return () => {
      live = false;
      controller.abort();
    };
  }, [ficha.id]);

  const lugar = ficha.tipo === 'l';
  return (
    <Section title={lugar ? 'Qué fue' : ficha.tipo === 'g' ? 'Quiénes fueron' : 'Quién fue'} colors={colors}>
      {desc.state === 'cargando' && <Placeholder colors={colors} />}
      {desc.state === 'traduciendo' && (
        <>
          {desc.texto ? <Rich text={desc.texto} books={books} colors={colors} onRef={onRef} /> : <Placeholder colors={colors} />}
          <View style={styles.translating}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 8, flex: 1 }}>
              Traduciendo la descripción al español. Queda guardada para todos.
            </Text>
          </View>
        </>
      )}
      {desc.state === 'listo' && <Rich text={desc.texto} books={books} colors={colors} onRef={onRef} />}
      {desc.state === 'error' && (
        <View>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{desc.message}</Text>
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [styles.secondary, { borderColor: colors.accent }, pressed && styles.pressed]}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Intentar de nuevo</Text>
          </Pressable>
        </View>
      )}
      <Text style={[styles.credit, { color: colors.muted }]}>Descripción de STEPBible (Tyndale House), traducida con IA.</Text>
    </Section>
  );
}

function Placeholder({ colors }: { colors: Colors }) {
  return (
    <View style={{ gap: 8, paddingVertical: 4 }}>
      {[1, 0.94, 0.98, 0.6].map((w, i) => (
        <View key={i} style={{ height: 12, borderRadius: 6, width: `${w * 100}%`, backgroundColor: colors.accentSoft }} />
      ))}
    </View>
  );
}

/** Cuándo vivió: los periodos de la línea de tiempo, una franja con las eras y qué pasaba en el mundo. */
function Epoca({ ficha, colors, onGo }: { ficha: Ficha; colors: Colors; onGo: (href: string) => void }) {
  const epoca = useMemo(() => epocaDe(ficha), [ficha]);
  if (!epoca?.periodos.length) {
    if (!ficha.epoca) return null;
    return (
      <Section title="Época" colors={colors}>
        <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17 }}>{ficha.epoca}</Text>
      </Section>
    );
  }
  const { periodos } = epoca;
  const desde = Math.min(...periodos.map((p) => p.desde));
  const hasta = Math.max(...periodos.map((p) => p.hasta));
  const central = periodos[Math.floor((periodos.length - 1) / 2)];
  // Sin los imperios y culturas de siglos (siempre aparecerían los mismos)
  const eventos = eventosDe({ ...central, desde, hasta }, 8).filter((e) => !esCorriente(e)).slice(0, 3);
  return (
    <Section
      title="Cuándo vivió"
      colors={colors}
      right={
        <View style={[styles.datePill, { backgroundColor: colors.accent }]}>
          <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '700' }}>{rango(desde, hasta, desde < -1000)}</Text>
        </View>
      }
    >
      {periodos.map((p) => (
        <View key={p.id} style={styles.periodRow}>
          <ClockIcon color={colors.accent} size={15} />
          <Text style={{ color: colors.text, fontFamily: serif, fontSize: 16, flex: 1 }}>{p.titulo}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{fechaPeriodo(p)}</Text>
        </View>
      ))}
      <EraStrip desde={desde} hasta={hasta} colors={colors} />
      {eventos.length > 0 && (
        <>
          <Text style={[styles.sub, { color: colors.muted }]}>EN ESOS AÑOS, EN EL MUNDO</Text>
          {eventos.map((e) => (
            <View key={e.titulo} style={styles.eventRow}>
              <View style={[styles.eventDot, { backgroundColor: REGION_COLORS[e.region] }]} />
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{e.titulo}</Text>
                <Text style={{ color: colors.muted }}> · {e.region}, {fechaEvento(e)}</Text>
              </Text>
            </View>
          ))}
        </>
      )}
      <Pressable
        onPress={() => onGo(`/historia?libro=${epoca.libro}&cap=${epoca.capitulo}`)}
        style={({ pressed }) => [styles.secondary, { borderColor: colors.accent }, pressed && styles.pressed]}
        accessibilityRole="link"
      >
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver en la línea de tiempo</Text>
      </Pressable>
    </Section>
  );
}

// Para que la franja no la ocupen los milenios de las primeras civilizaciones
const STRIP_FROM = -2200;
const STRIP_TO = ERAS[ERAS.length - 1].hasta;

/** Las eras de la historia bíblica a escala, con la vida de la persona marcada. */
function EraStrip({ desde, hasta, colors }: { desde: number; hasta: number; colors: Colors }) {
  const total = STRIP_TO - STRIP_FROM;
  const pct = (y: number) => `${((Math.max(STRIP_FROM, Math.min(STRIP_TO, y)) - STRIP_FROM) / total) * 100}%` as const;
  const eras = ERAS.filter((e) => e.hasta > STRIP_FROM);
  const actual = eras.find((e) => desde < e.hasta && hasta >= e.desde);
  return (
    <View style={{ marginTop: 14 }} accessibilityLabel={`Línea de tiempo: ${actual?.titulo ?? ''}`}>
      <View style={styles.strip}>
        {eras.map((e) => (
          <View
            key={e.titulo}
            style={{
              flex: Math.min(e.hasta, STRIP_TO) - Math.max(e.desde, STRIP_FROM),
              backgroundColor: e.color,
              opacity: desde < e.hasta && hasta >= e.desde ? 0.95 : 0.25,
            }}
          />
        ))}
        <View style={[styles.mark, { left: pct(desde), width: pct(STRIP_FROM + Math.max(hasta - desde, total * 0.012)), borderColor: colors.text }]} />
      </View>
      <View style={styles.stripLabels}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Abraham</Text>
        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>{actual?.titulo}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Iglesia</Text>
      </View>
    </View>
  );
}

function Familia({ ficha, colors, onOpen, onTree }: { ficha: Ficha; colors: Colors; onOpen: (r: FichaRef) => void; onTree: (href: string) => void }) {
  const f = ficha.familia;
  if (!f) return null;
  const groups: [string, FichaRef[]][] = [
    ['Padres', f.padres],
    [ficha.tipo === 'f' ? 'Esposo' : 'Esposas', f.conyuges],
    ['Hermanos', f.hermanos],
    ['Hijos', f.hijos],
  ];
  if (!groups.some(([, g]) => g.length) && !ficha.genealogia) return null;
  return (
    <Section
      title="Familia"
      colors={colors}
      right={
        ficha.genealogia ? (
          <Pressable
            onPress={() => onTree(`/genealogia/${ficha.genealogia}`)}
            hitSlop={8}
            style={({ pressed }) => [styles.treeLink, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
            accessibilityRole="link"
          >
            <TreeIcon color={colors.accent} size={15} />
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Árbol</Text>
          </Pressable>
        ) : undefined
      }
    >
      {groups.map(
        ([title, people]) =>
          people.length > 0 && (
            <View key={title} style={{ marginTop: 6 }}>
              <Text style={[styles.sub, { color: colors.muted }]}>
                {(title === 'Esposas' && people.length === 1 ? 'Esposa' : title).toUpperCase()}
              </Text>
              <Chips
                people={people}
                colors={colors}
                onOpen={onOpen}
                note={(p) => (ficha.id === JESUS && title === 'Padres' && p.tipo === 'm' ? 'padre legal' : undefined)}
              />
            </View>
          ),
      )}
    </Section>
  );
}

function Gente({ title, hint, people, colors, onOpen }: { title: string; hint?: string; people?: FichaRef[]; colors: Colors; onOpen: (r: FichaRef) => void }) {
  if (!people?.length) return null;
  return (
    <Section title={title} hint={hint} colors={colors}>
      <Chips people={people} colors={colors} onOpen={onOpen} />
    </Section>
  );
}

function Chips({ people, colors, onOpen, note }: { people: FichaRef[]; colors: Colors; onOpen: (r: FichaRef) => void; note?: (p: FichaRef) => string | undefined }) {
  return (
    <View style={styles.chips}>
      {people.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onOpen(p)}
          style={({ pressed }) => [styles.chip, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}
          accessibilityRole="link"
          accessibilityLabel={p.nombre.split(' (')[0]}
        >
          <Icono tipo={p.tipo} nombre={p.nombre} colors={colors} size={24} />
          <Text style={{ color: colors.text, fontFamily: serif, fontSize: 15 }}>{p.nombre.split(' (')[0]}</Text>
          {!!note?.(p) && <Text style={{ color: colors.muted, fontSize: 12 }}>{note(p)}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

function MapaLugar({ ficha, colors, onOpen }: { ficha: Ficha; colors: Colors; onOpen: (r: { id: string; nombre: string }) => void }) {
  const places = useMemo(() => {
    if (!ficha.mapa) return [];
    const self: Place = { id: ficha.id, name: ficha.nombre.split(' (')[0], en: '', type: ficha.clase ?? '', lon: ficha.mapa.lon, lat: ficha.mapa.lat, conf: ficha.mapa.conf, alt: ficha.mapa.alt, verses: [] };
    // Los lugares nombrados con este, cerca (hasta unos 150 km) para que el mapa no se aleje demasiado
    const near = (ficha.cerca ?? []).filter((c) => Math.hypot(c.lon - self.lon, c.lat - self.lat) < 1.4).map(toPlace);
    return [self, ...near.filter((p) => p.id !== self.id)];
  }, [ficha]);
  if (!ficha.mapa) {
    return (
      <Section title="Dónde estaba" colors={colors}>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>No se conoce su ubicación con suficiente seguridad para ponerla en el mapa.</Text>
      </Section>
    );
  }
  return (
    <Section
      title="Dónde estaba"
      colors={colors}
      hint={ficha.mapa.cercaDe ? `Se ubica cerca de ${ficha.mapa.cercaDe}; el punto es el de ese lugar.` : 'En gris, otros lugares que se nombran con este. Toca uno para ver su ficha.'}
    >
      <PlaceMap
        places={places}
        colors={colors}
        height={280}
        focusIds={[ficha.id]}
        onOpen={(pid) => {
          const p = places.find((x) => x.id === pid);
          if (p) onOpen({ id: pid, nombre: p.name });
        }}
      />
    </Section>
  );
}

/** En qué libros aparece, con una barra por libro; al tocar un libro, sus capítulos. */
function Apariciones({ ficha, books, colors, onVerse }: { ficha: Ficha; books: Book[]; colors: Colors; onVerse: (ref: string) => void }) {
  const [todos, setTodos] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const filas = useMemo(
    () => ficha.citas.map(([libro, caps]) => ({ libro, caps, n: caps.reduce((s, [, vs]) => s + vs.length, 0) })),
    [ficha],
  );
  if (!books.length) return null;
  const max = Math.max(...filas.map((f) => f.n));
  // Muchas filas: primero los libros donde más aparece, en orden bíblico
  const mostrar = todos || filas.length <= LIBROS_CORTO + 2 ? filas : filas.filter((f) => [...filas].sort((a, b) => b.n - a.n).slice(0, LIBROS_CORTO).includes(f));
  const name = (id: string) => books.find((b) => b.id === id)?.name ?? id;
  return (
    <Section title="Dónde aparece" colors={colors} hint="Toca un libro para ver sus capítulos.">
      {mostrar.map((f) => {
        const on = abierto === f.libro;
        return (
          <View key={f.libro}>
            <Pressable
              onPress={() => setAbierto(on ? null : f.libro)}
              style={({ pressed }) => [styles.bookRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
            >
              <Text style={[styles.bookName, { color: colors.text }]} numberOfLines={1}>
                {name(f.libro)}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: colors.accentSoft }]}>
                <View style={{ width: `${Math.max(4, (f.n / max) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: colors.accent, opacity: on ? 1 : 0.75 }} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, width: 34, textAlign: 'right' }}>{f.n}</Text>
              {on ? <ChevronUpIcon color={colors.muted} size={14} /> : <ChevronDownIcon color={colors.muted} size={14} />}
            </Pressable>
            {on && (
              <View style={[styles.chips, { marginBottom: 10, marginTop: 2 }]}>
                {f.caps.map(([c, vs]) => (
                  <Pressable
                    key={c}
                    onPress={() => onVerse(`${f.libro}.${c}.${vs[0]}`)}
                    style={({ pressed }) => [styles.capChip, { borderColor: colors.border }, pressed && styles.pressed]}
                    accessibilityRole="link"
                    accessibilityLabel={`${name(f.libro)} ${c}, ${vs.length} ${vs.length === 1 ? 'versículo' : 'versículos'}`}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
                      {c}
                      <Text style={{ color: colors.muted, fontWeight: '400' }}>:{vs.slice(0, 3).join(', ')}{vs.length > 3 ? '…' : ''}</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}
      {mostrar.length < filas.length && (
        <Pressable onPress={() => setTodos(true)} style={styles.more} accessibilityRole="button">
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver los {filas.length} libros</Text>
          <ChevronRightIcon color={colors.accent} size={16} />
        </Pressable>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 64, maxWidth: 760, width: '100%', alignSelf: 'center' },
  contentWide: { maxWidth: 1160, paddingHorizontal: 32 },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  message: { textAlign: 'center', marginTop: 40, padding: 16 },
  photo: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  photoCredit: { fontSize: 11, paddingHorizontal: 12, paddingVertical: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 32, fontFamily: serif, marginTop: 2, lineHeight: 38 },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  namePill: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 4 },
  stat: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, marginTop: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  h2: { fontSize: 20, fontFamily: serif, fontWeight: '600', flexShrink: 1 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  sub: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 8 },
  verse: { borderLeftWidth: 2, paddingLeft: 12, paddingVertical: 6, marginTop: 8 },
  verseText: { fontFamily: serif, fontSize: 16, lineHeight: 24, marginTop: 2 },
  translating: { flexDirection: 'row', alignItems: 'center', paddingTop: 10 },
  credit: { fontSize: 11, marginTop: 12 },
  secondary: { marginTop: 14, borderWidth: 1, borderRadius: 24, paddingVertical: 10, alignItems: 'center' },
  datePill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  strip: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
  mark: { position: 'absolute', top: -3, bottom: -3, borderWidth: 2, borderRadius: 5, minWidth: 6 },
  stripLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  treeLink: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 18, paddingLeft: 5, paddingRight: 12, paddingVertical: 5 },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  bookName: { width: 110, fontFamily: serif, fontSize: 15 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  capChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 10 },
  source: { fontSize: 12, lineHeight: 17, marginTop: 32, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
