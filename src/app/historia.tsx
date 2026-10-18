// /historia?libro=2ki&cap=18: la historia bíblica y la del mundo en carriles paralelos, de izquierda a derecha,
// como en la Carta sincronológica de Adams. Tocar algo marca sus años en todos los carriles.
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Book, formatRef, getBooks } from '@/lib/data';
import {
  ERAS,
  EVENTOS,
  Era,
  Evento,
  FUENTE_HISTORIA,
  PERIODOS,
  Periodo,
  RAMAS,
  REGION_COLORS,
  REINOS,
  TRONCO,
  Region,
  esCorriente,
  eventosDe,
  fechaEvento,
  fechaPeriodo,
  periodoDe,
} from '@/lib/historia';
import IconoHistoria from '@/components/IconoHistoria';
import { Ligadura, Rama } from '@/components/Rama';
import { iconoEvento, iconoPeriodo } from '@/lib/iconos';
import { FIN, INICIO, anchoTexto, apilar, crearEscala, etiquetaMarca, filasEn } from '@/lib/lineaTiempo';
import { chapterHref, verseHref } from '@/lib/routes';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

// Del vecino más cercano de Israel hacia los confines del mundo conocido
const CARRILES: Region[] = [
  'Levante',
  'Egipto',
  'Mesopotamia',
  'Asia Menor',
  'Persia',
  'Grecia',
  'Roma',
  'Europa',
  'India',
  'China',
  'América',
];
const NOMBRE_CARRIL: Partial<Record<Region, string>> = { Levante: 'Fenicia, Siria y Canaán' };

const ZOOMS = [0.5, 0.75, 1, 1.5, 2.2];
const MARGEN_IZQ = 20;
const MARGEN_DER = 60;
const EJE = 30;
const ROTULO = 4;
const CORRIENTE = 22;
const FILA = 28;
const TRONCO_ALTO = 44;
/** Centro de cada rama del tronco bíblico, medido desde arriba de su fila. */
const Y_TRONCO = { medio: 29, arriba: 22, abajo: 37 };
const FILA_BIBLIA = 32;
const PIE = 10;

/** «Cuando se escribió Romanos» → «Romanos» (con el icono de la pluma): en la línea de tiempo hace falta que quepa. */
const corto = (t: string) => t.replace(/^Cuando se escribi(?:ó|eron) (?:las )?(.)/, (_, c: string) => c.toUpperCase());

type Sel = { kind: 'periodo'; p: Periodo } | { kind: 'evento'; e: Evento };
const fin = (e: Evento) => e.hasta ?? e.desde;
const ORIGENES = PERIODOS.origenes;
/** Ancho del nombre de un carril (mayúsculas espaciadas) más su punto y su margen. */
const margenRotulo = (nombre: string) => anchoTexto(nombre, 10.5) * 1.3 + 44;

export default function Historia() {
  const params = useLocalSearchParams<{ libro?: string; cap?: string }>();
  const colors = useColors();
  const { width: pantalla } = useWindowDimensions();
  const [books, setBooks] = useState<Book[]>([]);
  const ancho2 = pantalla >= 700;
  const actual = params.libro ? periodoDe(params.libro, Number(params.cap) || 1) : undefined;
  const [sel, setSel] = useState<Sel | undefined>(actual ? { kind: 'periodo', p: actual } : undefined);
  const [zoom, setZoom] = useState(pantalla < 600 ? 1 : 2);
  const [vista, setVista] = useState({ w: 0, h: 0 });
  const [eraActiva, setEraActiva] = useState<Era | undefined>();
  const [detalleH, setDetalleH] = useState(0);

  const horizontal = useRef<ComponentRef<typeof ScrollView>>(null);
  const vertical = useRef<ComponentRef<typeof ScrollView>>(null);
  const eraBar = useRef<ComponentRef<typeof ScrollView>>(null);
  const chipX = useRef<Record<string, number>>({});
  const scrollX = useRef(new Animated.Value(0)).current;
  const posX = useRef(0);
  const centro = useRef<number | undefined>(undefined);
  const inicial = useRef(false);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    getBooks().then(setBooks, () => {});
  }, []);

  const go = (href: string) => navigate(() => router.push(href as never), 'forward');
  const openRef = (ref: string) => {
    const [b, c, v] = ref.split('.');
    go(v ? verseHref(b, Number(c), Number(v)) : chapterHref(b, Number(c)));
  };
  const refLabel = (ref: string) =>
    books.length ? (ref.split('.').length === 2 ? formatRef(`${ref}.1`, books).replace(/:1$/, '') : formatRef(ref, books)) : ref;

  // Escala y reparto en filas de cada carril
  const plano = useMemo(() => {
    const periodos = Object.values(PERIODOS).filter((p) => !p.sinFecha);
    const escala = crearEscala([...periodos.map((p) => p.desde), ...EVENTOS.filter((e) => !esCorriente(e)).map((e) => e.desde)], ZOOMS[zoom]);
    const span = (desde: number, hasta: number) => Math.max(4, escala.x(hasta) - escala.x(desde));

    const biblia = apilar(
      periodos,
      (p) => ({
        x: escala.x(p.desde),
        w: Math.max(span(p.desde, p.hasta), anchoTexto(corto(p.titulo), 13) + 40 + (p.id === actual?.id ? 78 : 0)),
      }),
      6,
      ancho2 ? 7 : 5,
      72,
      (p) => p.id === actual?.id,
    );
    const carriles = CARRILES.map((region) => {
      const corrientes = apilar(
        [...REINOS, ...EVENTOS.filter(esCorriente)].filter((e) => e.region === region),
        (e) => ({ x: escala.x(e.desde), w: span(e.desde, fin(e)) }),
        2,
      );
      const hechos = apilar(
        EVENTOS.filter((e) => e.region === region && !esCorriente(e)),
        (e) => ({ x: escala.x(e.desde) - 10, w: Math.max(span(e.desde, fin(e)) + 20, anchoTexto(e.titulo, 12) + 34) }),
        8,
        3,
        60,
      );
      return { region, corrientes, hechos };
    });

    return { escala, biblia, carriles };
  }, [zoom, actual?.id, ancho2]);

  // Cada carril mide lo que necesita lo que hay en pantalla (y una pantalla a cada lado): los siglos con poca
  // historia no dejan huecos enormes, como las corrientes de Adams que se ensanchan y se estrechan.
  const [ventana, setVentana] = useState<[number, number]>([0, 0]);
  const alturas = useMemo(() => {
    const a = ventana[0] - vista.w - MARGEN_IZQ;
    const b = ventana[1] + vista.w - MARGEN_IZQ;
    const origenes = plano.escala.x(ORIGENES.hasta) > a ? 2 : 1;
    const altoBiblia = ROTULO + TRONCO_ALTO + filasEn(plano.biblia.colocados, a, b, origenes) * FILA_BIBLIA + PIE;
    const tops: Record<string, number> = {};
    let y = altoBiblia;
    const corrientes: Record<string, number> = {};
    const altos = plano.carriles.map((c) => {
      tops[c.region] = y;
      corrientes[c.region] = filasEn(c.corrientes.colocados, a, b);
      const h = ROTULO + corrientes[c.region] * CORRIENTE + filasEn(c.hechos.colocados, a, b, 0) * FILA + PIE;
      y += h;
      return h;
    });
    return { altoBiblia, altos, tops, corrientes, alto: y };
  }, [plano, ventana, vista.w]);

  const { escala } = plano;
  const ancho = MARGEN_IZQ + escala.ancho + MARGEN_DER;
  const X = (año: number) => MARGEN_IZQ + escala.x(año);

  const irA = (año: number, animated = true, donde = 0.35) =>
    horizontal.current?.scrollTo({ x: Math.max(0, X(año) - vista.w * donde), animated });

  // Al abrir: el periodo del capítulo que se lee; al cambiar el zoom: el mismo año en el centro
  useEffect(() => {
    if (!vista.w) return;
    if (centro.current != null) {
      irA(centro.current, false, 0.5);
      centro.current = undefined;
    } else if (!inicial.current) {
      inicial.current = true;
      if (actual && !actual.sinFecha) setTimeout(() => irA(actual.desde, false), 0);
    }
    actualizarEra(posX.current);
    setTimeout(medirVentana, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escala, vista.w]);

  const medirVentana = () => {
    if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setVentana([posX.current, posX.current + vista.w]);
  };

  const cambiarZoom = (d: number) => {
    const z = Math.min(ZOOMS.length - 1, Math.max(0, zoom + d));
    if (z === zoom) return;
    centro.current = escala.año(posX.current + vista.w / 2 - MARGEN_IZQ);
    setZoom(z);
  };

  const actualizarEra = (x: number) => {
    const año = escala.año(x + vista.w / 2 - MARGEN_IZQ);
    const era = ERAS.find((e) => año >= e.desde && año < e.hasta) ?? (año < INICIO + 1 ? ERAS[0] : ERAS[ERAS.length - 1]);
    if (era !== eraActiva) {
      setEraActiva(era);
      const cx = chipX.current[era.titulo];
      if (cx != null) eraBar.current?.scrollTo({ x: Math.max(0, cx - 40), animated: true });
    }
  };

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: Platform.OS !== 'web',
    listener: (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      posX.current = e.nativeEvent.contentOffset.x;
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(medirVentana, 90);
      actualizarEra(posX.current);
    },
  });

  const elegir = (s: Sel) => {
    setSel(s);
    const desde = s.kind === 'periodo' ? s.p.desde : s.e.desde;
    const visibleX = X(desde) - posX.current;
    if (visibleX < 24 || visibleX > vista.w - 80) irA(desde);
    if (s.kind === 'evento') {
      const top = alturas.tops[s.e.region];
      if (top != null) vertical.current?.scrollTo({ y: Math.max(0, top - alturas.altoBiblia / 2), animated: true });
    } else vertical.current?.scrollTo({ y: 0, animated: true });
  };

  const selDesde = sel ? (sel.kind === 'periodo' ? sel.p.desde : sel.e.desde) : 0;
  const selHasta = sel ? (sel.kind === 'periodo' ? sel.p.hasta : fin(sel.e)) : 0;

  // Nombre que acompaña al usuario mientras se desplaza: se queda pegado al borde izquierdo
  const pegado = { transform: [{ translateX: scrollX }] };
  // Rótulo de una corriente: avanza con la vista sin salirse de su banda
  // (`margen`: lo que ocupa a la izquierda el nombre del carril, que va encima)
  const deslizante = (x0: number, w: number, rotulo: number, margen = 6) => {
    const libre = w - rotulo - 12;
    if (libre < 2) return undefined;
    const start = MARGEN_IZQ + x0 - margen;
    return {
      transform: [
        { translateX: scrollX.interpolate({ inputRange: [start, start + libre], outputRange: [0, libre], extrapolate: 'clamp' }) },
      ],
    };
  };

  const corriente = ({ e, x, w, fila, top, color, era, margen }: { e?: Evento; x: number; w: number; fila: number; top: number; color: string; era?: Era; margen: number }) => {
    const titulo = e?.titulo ?? era!.titulo;
    const on = !!e && sel?.kind === 'evento' && sel.e === e;
    const body = (
      <>
        {e && (
          <Rama w={w} h={CORRIENTE - 4} grosor={CORRIENTE - 7} color={on ? colors.accent : color} opacidad={0.5} punta={fin(e) < FIN} />
        )}
        <Animated.Text
          numberOfLines={1}
          style={[styles.corrienteTxt, { color: colors.text }, deslizante(x, w, anchoTexto(titulo, 12), fila === 0 ? margen : 6)]}
        >
          {titulo}
        </Animated.Text>
      </>
    );
    const style = [
      styles.corriente,
      {
        left: MARGEN_IZQ + x,
        width: w,
        top: top + fila * CORRIENTE,
      },
    ];
    if (!e) return <View key={titulo} style={style}>{body}</View>;
    return (
      <Pressable key={titulo} accessibilityRole="button" onPress={() => elegir({ kind: 'evento', e })} style={style}>
        {body}
      </Pressable>
    );
  };

  // Dónde queda cada reino (para unirlo con el que le sigue)
  const ramaPos: Record<string, { x: number; w: number; y: number; region: Region }> = {};
  for (const { region, corrientes } of plano.carriles)
    for (const { item, x, w, fila } of corrientes.colocados)
      if (fila < alturas.corrientes[region])
        ramaPos[item.titulo] = { x, w, y: alturas.tops[region] + ROTULO + fila * CORRIENTE + (CORRIENTE - 4) / 2, region };

  const titulo = (s: Sel) => (s.kind === 'periodo' ? s.p.titulo : s.e.titulo);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Línea de tiempo' }} />

      <View style={[styles.cabecera, { borderColor: colors.border }]}>
        <View style={styles.tituloFila}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.intro, { color: colors.text }, !ancho2 && { fontSize: 18 }]} numberOfLines={1}>
              La Biblia y el mundo, siglo a siglo
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={ancho2 ? 1 : 2}>
              {ancho2
                ? 'Recorre el tiempo de izquierda a derecha y toca un hecho para ver qué pasaba a la vez en el mundo.'
                : 'Desliza a los lados y toca un hecho para ver qué pasaba a la vez.'}
            </Text>
          </View>
          <View style={[styles.zoom, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Pressable accessibilityLabel="Alejar" onPress={() => cambiarZoom(-1)} style={styles.zoomBtn} hitSlop={4}>
              <Text style={[styles.zoomTxt, { color: zoom === 0 ? colors.border : colors.text }]}>−</Text>
            </Pressable>
            <View style={{ width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border }} />
            <Pressable accessibilityLabel="Acercar" onPress={() => cambiarZoom(1)} style={styles.zoomBtn} hitSlop={4}>
              <Text style={[styles.zoomTxt, { color: zoom === ZOOMS.length - 1 ? colors.border : colors.text }]}>+</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView ref={eraBar} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eraBarContent}>
          {ERAS.map((era) => {
            const on = era === eraActiva;
            return (
              <Pressable
                key={era.titulo}
                onLayout={(e) => (chipX.current[era.titulo] = e.nativeEvent.layout.x)}
                onPress={() => irA(era.desde, true, 0.04)}
                style={[styles.eraChip, { borderColor: era.color, backgroundColor: on ? era.color : 'transparent' }]}
              >
                <Text style={{ color: on ? '#fff' : colors.text, fontSize: 13, fontWeight: on ? '600' : '400' }}>{era.titulo}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setVista({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {vista.h > 0 && (
          <Animated.ScrollView
            ref={horizontal}
            horizontal
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={ancho2}
            contentContainerStyle={{ width: ancho, height: vista.h, flexDirection: 'column' }}
          >
            {/* Eje de los años */}
            <View style={[styles.eje, { borderColor: colors.border, backgroundColor: colors.background }]}>
              {sel && (
                <View
                  style={[styles.banda, { left: X(selDesde), width: Math.max(2, X(selHasta) - X(selDesde)), backgroundColor: `${colors.accent}30` }]}
                />
              )}
              {escala.marcas.map((y) => (
                <View key={y} style={[styles.marca, { left: X(y) }]}>
                  <View style={{ width: 1, height: 6, backgroundColor: colors.muted }} />
                  <Text style={[styles.marcaTxt, { color: y === 0 ? colors.accent : colors.muted }, y === 0 && { fontWeight: '700' }]}>
                    {etiquetaMarca(y)}
                  </Text>
                </View>
              ))}
            </View>

            <ScrollView
              ref={vertical}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={{ height: alturas.alto + 90 + (sel ? detalleH : 0) }}
            >
              {/* Fondo: columnas de cada era y líneas de los siglos */}
              {ERAS.map((era, i) => (
                <View
                  key={era.titulo}
                  style={[
                    styles.columna,
                    { left: X(era.desde), width: X(era.hasta) - X(era.desde), backgroundColor: `${era.color}${i % 2 ? '0C' : '16'}` },
                  ]}
                />
              ))}
              {escala.marcas.map((y) => (
                <View
                  key={y}
                  style={[styles.columna, { left: X(y), width: y === 0 ? 1.5 : StyleSheet.hairlineWidth, backgroundColor: y === 0 ? colors.accent : colors.border }]}
                />
              ))}
              {sel && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.columna,
                    {
                      left: X(selDesde),
                      width: Math.max(2, X(selHasta) - X(selDesde)),
                      backgroundColor: `${colors.accent}1C`,
                      borderLeftWidth: 1.5,
                      borderColor: colors.accent,
                      zIndex: 0,
                    },
                  ]}
                />
              )}

              {/* Carril de la historia bíblica */}
              <View style={[styles.carril, { top: 0, height: alturas.altoBiblia, borderColor: colors.border, backgroundColor: `${colors.surface}B0` }]} />
              <Animated.View style={[styles.rotulo, { top: ROTULO + 1, backgroundColor: colors.background }, pegado]}>
                <View style={[styles.rotuloPunto, { backgroundColor: colors.accent }]} />
                <Text style={[styles.rotuloTxt, { color: colors.accent }]}>HISTORIA BÍBLICA</Text>
              </Animated.View>
              {ERAS.map((era) => {
                const x0 = escala.x(era.desde);
                const w = escala.x(era.hasta) - x0;
                return (
                  <View key={era.titulo} pointerEvents="none" style={{ position: 'absolute', left: MARGEN_IZQ + x0, top: ROTULO, width: w, height: 16, overflow: 'hidden' }}>
                    <View style={{ position: 'absolute', left: 0, top: 3, width: 2, height: 11, borderRadius: 1, backgroundColor: era.color }} />
                    <Animated.Text numberOfLines={1} style={[styles.eraTxt, { color: colors.muted }, deslizante(x0, w, anchoTexto(era.titulo, 11) + 8, margenRotulo('Historia bíblica'))]}>
                      {era.titulo}
                    </Animated.Text>
                  </View>
                );
              })}
              {/* El tronco: raíz sin fechas, el reino que se divide en dos ramas, el destierro y el regreso */}
              {TRONCO.map((t) => {
                const x0 = escala.x(t.desde);
                const w = escala.x(t.hasta) - x0;
                const ultimo = t.hasta >= FIN;
                return (
                  <View key={`${t.desde}-${t.pos}`} pointerEvents="none" style={{ position: 'absolute', left: MARGEN_IZQ + x0, top: ROTULO, width: w, height: TRONCO_ALTO }}>
                    <Rama
                      w={w}
                      h={TRONCO_ALTO}
                      y0={Y_TRONCO[t.brotaDe ?? t.pos]}
                      y1={Y_TRONCO[t.pos]}
                      grosor={t.pos === 'medio' ? 15 : 11}
                      color={colors.accent}
                      opacidad={0.85}
                      brote={!t.brotaDe}
                      punta={!!t.punta}
                      punteado={t.punteado}
                    />
                    {!!t.titulo && !ultimo && (
                      <Animated.Text
                        numberOfLines={1}
                        style={[
                          styles.ramaTxt,
                          t.punteado
                            ? { top: Y_TRONCO[t.pos] + 3, color: colors.muted, fontWeight: '600', fontStyle: 'italic' }
                            : { top: Y_TRONCO[t.pos] - 6.5, color: colors.background },
                          deslizante(x0, w, anchoTexto(t.titulo, 9.5) + 30, 6),
                        ]}
                      >
                        {t.punteado ? t.titulo : t.titulo.toUpperCase()}
                      </Animated.Text>
                    )}
                  </View>
                );
              })}
              <Pressable
                onPress={() => elegir({ kind: 'periodo', p: ORIGENES })}
                style={[
                  styles.origenes,
                  {
                    left: X(ORIGENES.desde),
                    width: X(ORIGENES.hasta) - X(ORIGENES.desde) - 8,
                    top: ROTULO + TRONCO_ALTO + 4,
                    borderColor: sel?.kind === 'periodo' && sel.p === ORIGENES ? colors.accent : colors.muted,
                  },
                ]}
              >
                <Animated.Text numberOfLines={2} style={[styles.origenesTxt, { color: colors.text }, deslizante(escala.x(ORIGENES.desde), X(ORIGENES.hasta) - X(ORIGENES.desde) - 8, 130)]}>
                  Génesis 1–11{'\n'}
                  <Text style={{ color: colors.muted, fontStyle: 'italic', fontSize: 12 }}>sin fechas en la historia</Text>
                </Animated.Text>
              </Pressable>
              {plano.biblia.colocados.map(({ item: p, x, w, fila }) => {
                const era = ERAS.find((e) => p.desde >= e.desde && p.desde < e.hasta) ?? ERAS[ERAS.length - 1];
                const spanW = Math.max(4, escala.x(p.hasta) - escala.x(p.desde));
                const here = p.id === actual?.id;
                const on = sel?.kind === 'periodo' && sel.p === p;
                const icono = iconoPeriodo(p);
                const chipTop = ROTULO + TRONCO_ALTO + fila * FILA_BIBLIA + 4;
                return [
                  <View
                    key={`t-${p.id}`}
                    pointerEvents="none"
                    style={[styles.tallo, { left: MARGEN_IZQ + x + 10, top: ROTULO + Y_TRONCO.abajo, height: chipTop - ROTULO - Y_TRONCO.abajo, backgroundColor: `${colors.accent}38` }]}
                  />,
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    onPress={() => elegir({ kind: 'periodo', p })}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        left: MARGEN_IZQ + x,
                        width: w,
                        top: ROTULO + TRONCO_ALTO + fila * FILA_BIBLIA + 4,
                        backgroundColor: here ? colors.accentSoft : colors.surface,
                        borderColor: on || here ? colors.accent : `${era.color}80`,
                        borderWidth: on ? 2 : 1,
                      },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={[styles.chipSpan, { width: Math.min(spanW, w), backgroundColor: `${era.color}40`, borderLeftColor: era.color }]} />
                    {icono !== 'punto' && (
                      <View style={{ marginRight: 6 }}>
                        <IconoHistoria icono={icono} color={here || on ? colors.accent : colors.text} size={15} />
                      </View>
                    )}
                    {here && <Text style={[styles.aqui, { color: colors.accent }]}>AQUÍ ESTÁS</Text>}
                    <Text numberOfLines={1} style={[styles.chipTxt, { color: colors.text }]}>
                      {corto(p.titulo)}
                    </Text>
                  </Pressable>,
                ];
              })}

              {/* Ligaduras: el reino que brota de otro (o lo conquista), aunque esté en otro carril */}
              {RAMAS.map(([a, b]) => {
                const pa = ramaPos[a];
                const pb = ramaPos[b];
                if (!pa || !pb || (pa.region === pb.region && Math.abs(pa.y - pb.y) < 2)) return null;
                const xb = pb.x + 8;
                const xa = Math.min(Math.max(pa.x + 8, pb.x - 46), pa.x + pa.w - 8);
                if (xb - xa < 12) return null;
                const top = Math.min(pa.y, pb.y) - 3;
                const h = Math.abs(pa.y - pb.y) + 6;
                return (
                  <View key={`${a}>${b}`} pointerEvents="none" style={{ position: 'absolute', left: MARGEN_IZQ + xa, top }}>
                    <Ligadura w={xb - xa} h={h} desdeArriba={pa.y < pb.y} color={REGION_COLORS[pa.region]} />
                  </View>
                );
              })}

              {/* Carriles del mundo */}
              {plano.carriles.map(({ region, corrientes, hechos }, i) => {
                const top = alturas.tops[region];
                const color = REGION_COLORS[region];
                const topHechos = top + ROTULO + alturas.corrientes[region] * CORRIENTE;
                return (
                  <View key={region} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <View
                      style={[
                        styles.carril,
                        { top, height: alturas.altos[i], borderColor: colors.border, backgroundColor: i % 2 ? 'transparent' : `${colors.surface}60` },
                      ]}
                    />
                    <Animated.View style={[styles.rotulo, { top: top + ROTULO + 1, backgroundColor: colors.background }, pegado]}>
                      <View style={[styles.rotuloPunto, { backgroundColor: color }]} />
                      <Text style={[styles.rotuloTxt, { color }]}>{(NOMBRE_CARRIL[region] ?? region).toUpperCase()}</Text>
                    </Animated.View>
                    {corrientes.colocados.map(({ item: e, x, w, fila }) => (
                      corriente({ e, x, w, fila, top: top + ROTULO, color, margen: margenRotulo(NOMBRE_CARRIL[region] ?? region) })
                    ))}
                    {hechos.colocados.map(({ item: e, x, w, fila }) => {
                      const on = sel?.kind === 'evento' && sel.e === e;
                      const spanW = escala.x(fin(e)) - escala.x(e.desde);
                      const ex = escala.x(e.desde);
                      const markerTop = topHechos + fila * FILA;
                      // Cuelga de la rama del reino que había en ese momento, si había alguno
                      const rama = corrientes.colocados
                        .filter((c) => c.fila < alturas.corrientes[region] && c.x <= ex && c.x + c.w >= ex)
                        .sort((m, n) => n.fila - m.fila)[0];
                      const desdeY = rama ? top + ROTULO + rama.fila * CORRIENTE + CORRIENTE - 6 : undefined;
                      const icono = iconoEvento(e);
                      return [
                        desdeY != null && (
                          <View
                            key={`t-${e.titulo}`}
                            pointerEvents="none"
                            style={[styles.tallo, { left: MARGEN_IZQ + ex - 0.75, top: desdeY, height: markerTop + 2 - desdeY, backgroundColor: `${color}70` }]}
                          />
                        ),
                        <Pressable
                          key={e.titulo}
                          accessibilityRole="button"
                          onPress={() => elegir({ kind: 'evento', e })}
                          style={({ pressed }) => [
                            styles.hecho,
                            { left: MARGEN_IZQ + x, width: w, top: topHechos + fila * FILA },
                            on && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          {spanW > 6 && <View style={[styles.hechoSpan, { left: 10, width: spanW, backgroundColor: `${color}70` }]} />}
                          <View style={[styles.icono, { borderColor: color, backgroundColor: e.ref ? color : colors.background }]}>
                            <IconoHistoria icono={icono} color={e.ref ? '#fff' : color} size={12} grosor={2} />
                          </View>
                          <Text numberOfLines={1} style={[styles.hechoTxt, { color: colors.text }, on && { fontWeight: '700' }]}>
                            {e.titulo}
                          </Text>
                        </Pressable>,
                      ];
                    })}
                  </View>
                );
              })}

              <Animated.View style={[styles.pie, { top: alturas.alto + 14, width: Math.min(vista.w - 32, 640) }, pegado]}>
                <Text style={[styles.pieTxt, { color: colors.muted }]}>
                  Cada reino es una rama que brota del que le precede, y los hechos cuelgan de la rama de su tiempo. Los
                  iconos rellenos llevan a su pasaje. La escala se estira en los siglos con más acontecimientos. {FUENTE_HISTORIA}
                </Text>
              </Animated.View>
            </ScrollView>
          </Animated.ScrollView>
        )}

        {ancho2 && vista.w > 0 && (
          <>
            <Flecha lado="izq" onPress={() => horizontal.current?.scrollTo({ x: Math.max(0, posX.current - vista.w * 0.7), animated: true })} />
            <Flecha lado="der" onPress={() => horizontal.current?.scrollTo({ x: posX.current + vista.w * 0.7, animated: true })} />
          </>
        )}

        {sel && (
          <View
            onLayout={(e) => setDetalleH(e.nativeEvent.layout.height)}
            style={[styles.detalle, { backgroundColor: colors.surface, borderColor: colors.border }, ancho2 && styles.detalleAncho]}
          >
            <Detalle
              sel={sel}
              actual={actual}
              refLabel={refLabel}
              onRef={openRef}
              onElegir={elegir}
              onCerrar={() => setSel(undefined)}
              titulo={titulo(sel)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function Flecha({ lado, onPress }: { lado: 'izq' | 'der'; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityLabel={lado === 'izq' ? 'Antes' : 'Después'}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.flecha,
        lado === 'izq' ? { left: 10 } : { right: 10 },
        { backgroundColor: colors.surface, borderColor: colors.border },
        (hovered || pressed) && { borderColor: colors.accent },
      ]}
    >
      <Text style={{ color: colors.text, fontSize: 22, lineHeight: 24 }}>{lado === 'izq' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

function Detalle({
  sel,
  actual,
  titulo,
  refLabel,
  onRef,
  onElegir,
  onCerrar,
}: {
  sel: Sel;
  actual?: Periodo;
  titulo: string;
  refLabel: (ref: string) => string;
  onRef: (ref: string) => void;
  onElegir: (s: Sel) => void;
  onCerrar: () => void;
}) {
  const colors = useColors();
  let kicker: string;
  let color: string;
  let fecha: string;
  let texto: string | undefined;
  let ref: string | undefined;
  let relacion: string;
  let relacionados: Sel[];
  if (sel.kind === 'periodo') {
    const p = sel.p;
    const era = ERAS.find((e) => p.desde >= e.desde && p.desde < e.hasta) ?? ERAS[0];
    kicker = p.id === actual?.id ? 'Estás leyendo esta época' : era.titulo;
    color = p.id === actual?.id ? colors.accent : era.color;
    fecha = fechaPeriodo(p);
    texto = p.nota;
    ref = p.ref;
    relacion = 'Mientras tanto en el mundo';
    relacionados = (p.sinFecha ? EVENTOS.filter((e) => e.desde < p.hasta).slice(0, 6) : eventosDe(p, 6)).map((e) => ({ kind: 'evento', e }));
  } else {
    const e = sel.e;
    kicker = e.region;
    color = REGION_COLORS[e.region];
    fecha = fechaEvento(e);
    texto = e.texto;
    ref = e.ref;
    relacion = 'En la Biblia, por esos años';
    const periodos = Object.values(PERIODOS).filter((p) => !p.sinFecha);
    const cruzan = periodos.filter((p) => p.desde <= fin(e) && p.hasta >= e.desde);
    const cerca = [...periodos].sort((a, b) => dist(a, e) - dist(b, e));
    relacionados = (cruzan.length ? cruzan.slice(0, 5) : cerca.slice(0, 2)).map((p) => ({ kind: 'periodo', p }));
  }
  return (
    <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ padding: 16, paddingTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.rotuloPunto, { backgroundColor: color }]} />
        <Text style={[styles.kicker, { color, flex: 1 }]}>{kicker.toUpperCase()}</Text>
        <Pressable accessibilityLabel="Cerrar" onPress={onCerrar} hitSlop={10} style={styles.cerrar}>
          <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
      <Text style={[styles.detalleTitulo, { color: colors.text }]}>{titulo}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{fecha}</Text>
      {!!texto && <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 8 }}>{texto}</Text>}
      {!!ref && (
        <Pressable onPress={() => onRef(ref)} style={[styles.leer, { backgroundColor: colors.accent }]}>
          <Text style={{ color: colors.background, fontWeight: '700', fontSize: 14 }}>
            {sel.kind === 'periodo' ? `Leer ${refLabel(ref)} ›` : `${refLabel(ref)} ›`}
          </Text>
        </Pressable>
      )}
      {relacionados.length > 0 && (
        <>
          <Text style={[styles.relacion, { color: colors.muted }]}>{relacion.toUpperCase()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {relacionados.map((r) => {
              const c = r.kind === 'evento' ? REGION_COLORS[r.e.region] : colors.accent;
              return (
                <Pressable
                  key={r.kind === 'evento' ? r.e.titulo : r.p.id}
                  onPress={() => onElegir(r)}
                  style={({ pressed }) => [styles.rel, { borderColor: colors.border, backgroundColor: colors.background }, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.rotuloPunto, { backgroundColor: c }]} />
                  <View>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{r.kind === 'evento' ? r.e.titulo : r.p.titulo}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{r.kind === 'evento' ? `${r.e.region} · ${fechaEvento(r.e)}` : fechaPeriodo(r.p)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}

const dist = (p: Periodo, e: Evento) => (p.hasta < e.desde ? e.desde - p.hasta : p.desde > fin(e) ? p.desde - fin(e) : 0);

const styles = StyleSheet.create({
  cabecera: { borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  tituloFila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  intro: { fontSize: 21, fontFamily: serif, fontWeight: '600' },
  zoom: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  zoomBtn: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  zoomTxt: { fontSize: 20, lineHeight: 22, fontWeight: '500' },
  eraBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  eraChip: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  eje: { height: EJE, borderBottomWidth: StyleSheet.hairlineWidth },
  marca: { position: 'absolute', top: 0, alignItems: 'flex-start' },
  marcaTxt: { fontSize: 11, marginTop: 3, marginLeft: -2, fontVariant: ['tabular-nums'] },
  banda: { position: 'absolute', top: 0, bottom: 0 },
  columna: { position: 'absolute', top: 0, bottom: 0 },
  carril: { position: 'absolute', left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  rotulo: {
    position: 'absolute',
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 16,
    borderRadius: 8,
    zIndex: 3,
  },
  rotuloPunto: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  rotuloTxt: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3 },
  corriente: {
    position: 'absolute',
    height: CORRIENTE - 4,
    borderRadius: 9,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  corrienteTxt: { fontSize: 12, fontFamily: serif, fontStyle: 'italic', fontWeight: '600', paddingLeft: 18, paddingRight: 6 },
  eraTxt: { position: 'absolute', fontSize: 11, fontFamily: serif, fontStyle: 'italic', paddingLeft: 8 },
  ramaTxt: { position: 'absolute', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, paddingLeft: 26 },
  tallo: { position: 'absolute', width: 1.5, borderRadius: 1 },
  icono: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  origenes: {
    position: 'absolute',
    height: FILA_BIBLIA * 2 - 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  origenesTxt: { fontSize: 14, fontFamily: serif, fontWeight: '600', paddingHorizontal: 10 },
  chip: {
    position: 'absolute',
    height: FILA_BIBLIA - 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    overflow: 'hidden',
  },
  chipSpan: { position: 'absolute', left: 0, top: 0, bottom: 0, borderLeftWidth: 3 },
  chipTxt: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  aqui: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1, marginRight: 6 },
  hecho: {
    position: 'absolute',
    height: FILA - 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingRight: 6,
  },
  hechoSpan: { position: 'absolute', bottom: 1, height: 3, borderRadius: 2 },
  hechoTxt: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  pie: { position: 'absolute', left: 16 },
  pieTxt: { fontSize: 12, lineHeight: 17 },
  flecha: {
    position: 'absolute',
    top: '45%',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  detalle: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  detalleAncho: { left: undefined, right: 24, bottom: 24, width: 420 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  cerrar: { paddingLeft: 12 },
  detalleTitulo: { fontSize: 20, fontFamily: serif, fontWeight: '600', marginTop: 4 },
  leer: { alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  relacion: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 16, marginBottom: 8 },
  rel: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 260 },
});
