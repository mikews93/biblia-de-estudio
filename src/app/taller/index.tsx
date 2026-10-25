import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Field, SectionTitle, text } from '@/components/comunidad/ui';
import { type IconProps, ChevronRightIcon, CopyIcon, LampIcon, LecternIcon, MicIcon, PeopleIcon, PlusIcon, TrashIcon } from '@/components/icons';
import ComoPresentar from '@/components/taller/ComoPresentar';
import Deslizable from '@/components/taller/Deslizable';
import OpcionesMensaje, { type Opcion, PELIGRO } from '@/components/taller/OpcionesMensaje';
import { ago } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { fechaLarga } from '@/lib/documento';
import {
  Mensaje,
  Pasaje,
  TIPOS,
  Tipo,
  borrarConDeshacer,
  crearMensaje,
  duplicarMensaje,
  duracion,
  esTerminado,
  ideaCentral,
  pasajeLabel,
  terminarMensaje,
  tipoInfo,
  tituloDe,
  useTaller,
  volverABorrador,
} from '@/lib/taller';
import { isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const ICONOS: Record<Tipo, (p: IconProps) => React.ReactNode> = { reflexion: LampIcon, encuentro: PeopleIcon, sermon: LecternIcon };

/** El Taller: preparar reflexiones, encuentros de grupo y sermones. Desde el lector llega con un pasaje. */
export default function TallerScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ libro?: string; capitulo?: string; versiculo?: string }>();
  const { mensajes, ready } = useTaller();
  const [books, setBooks] = useState<Book[]>([]);
  const [buscar, setBuscar] = useState('');
  const borradores = mensajes.filter((m) => !esTerminado(m));
  // Los terminados, del último que se predicó o terminó al primero.
  const reciente = (m: (typeof mensajes)[number]) => m.ocasiones?.[0]?.fecha ?? m.terminado ?? '';
  const terminados = mensajes.filter(esTerminado).sort((a, b) => reciente(b).localeCompare(reciente(a)));
  const [opciones, setOpciones] = useState<Mensaje | null>(null);
  const [presentar, setPresentar] = useState<Mensaje | null>(null);
  const [borrado, setBorrado] = useState<{ titulo: string; terminado: boolean; deshacer: () => void; confirmar: () => void } | null>(null);
  const { width } = useWindowDimensions();
  const peligro = isDark(colors) ? PELIGRO.oscuro : PELIGRO.claro;

  const abrir = (m: Mensaje) => navigate(() => router.push(esTerminado(m) ? `/taller/${m.id}/documento` : `/taller/${m.id}`), 'forward');
  const copiar = async (m: Mensaje) => {
    const copia = await duplicarMensaje(m.id);
    if (copia) navigate(() => router.push(`/taller/${copia}`), 'forward');
  };
  const borrar = (m: Mensaje) => {
    borrado?.confirmar();
    setBorrado({ titulo: tituloDe(m, books), terminado: esTerminado(m), ...borrarConDeshacer(m.id) });
  };
  const elegir = (m: Mensaje, o: Opcion) => {
    if (o === 'abrir' || o === 'editar') navigate(() => router.push(`/taller/${m.id}`), 'forward');
    else if (o === 'documento') navigate(() => router.push(`/taller/${m.id}/documento`), 'forward');
    else if (o === 'presentar') setPresentar(m);
    else if (o === 'copia') copiar(m);
    else if (o === 'terminar') terminarMensaje(m.id);
    else if (o === 'borrador') volverABorrador(m.id);
    else if (o === 'borrar') borrar(m);
  };
  const acciones = (m: Mensaje) => [
    { label: esTerminado(m) ? 'Adaptar' : 'Copia', icon: CopyIcon, color: colors.text, fondo: colors.accentSoft, onPress: () => copiar(m) },
    { label: esTerminado(m) ? 'Borrar' : 'Descartar', icon: TrashIcon, color: '#FFFFFF', fondo: peligro, onPress: () => borrar(m) },
  ];
  // En el computador, además del clic derecho, un botón «⋯» a la vista.
  const conBoton = Platform.OS === 'web' && width >= 820;

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const pasaje: Pasaje | null =
    params.libro && params.capitulo
      ? { book: params.libro, chapter: Number(params.capitulo), from: params.versiculo ? Number(params.versiculo) : undefined }
      : null;

  const crear = async (tipo: Tipo) => {
    const id = await crearMensaje(tipo, pasaje);
    navigate(() => router.replace(`/taller/${id}`), 'forward');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Taller' }} />
      <Text style={[text.title, { color: colors.text }]}>Taller</Text>
      <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
        Prepara lo que vas a compartir: del pasaje a una idea central, de la idea a un bosquejo, y de ahí a presentarlo. La IA
        te pregunta y sugiere, pero el mensaje lo escribes tú.
      </Text>

      {pasaje && books.length > 0 && (
        <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text }}>
            Preparar con <Text style={{ fontWeight: '700' }}>{pasajeLabel(pasaje, books)}</Text>. Elige qué quieres preparar.
          </Text>
        </View>
      )}

      {!pasaje && (
        <Pressable
          onPress={() => navigate(() => router.push('/taller/tema'), 'forward')}
          accessibilityRole="button"
          accessibilityHint="Graba o escribe de qué quieres hablar y la IA busca pasajes, comentarios y teologías"
          style={({ pressed }) => [styles.tema, { backgroundColor: colors.surface, borderColor: colors.accent }, pressed && { opacity: 0.8 }]}
        >
          <View style={[styles.temaMic, { backgroundColor: colors.accent }]}>
            <MicIcon color={colors.surface} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.temaTitle, { color: colors.text }]}>Tengo algo de qué hablar</Text>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>
              Grábalo o escríbelo. La IA te busca pasajes, comentarios y teologías, y te arma la maqueta.
            </Text>
          </View>
          <ChevronRightIcon color={colors.accent} size={20} />
        </Pressable>
      )}

      <SectionTitle>Preparar</SectionTitle>
      <View style={{ gap: 10 }}>
        {TIPOS.map((t) => (
          <Pressable
            key={t.tipo}
            onPress={() => crear(t.tipo)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.type, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
              {(() => {
                const Icon = ICONOS[t.tipo];
                return <Icon color={colors.accent} size={24} />;
              })()}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.typeName, { color: colors.text }]}>
                {t.nombre} <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '400' }}>· {t.duracion}</Text>
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{t.descripcion}</Text>
            </View>
            <PlusIcon color={colors.accent} size={22} />
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => navigate(() => router.push('/taller/dinamicas'), 'forward')} style={{ marginTop: 14 }}>
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver las 23 dinámicas para grupos ›</Text>
      </Pressable>

      {ready && borradores.length > 0 && (
        <>
          <SectionTitle>Borradores</SectionTitle>
          <View style={{ gap: 10 }}>
            {borradores.map((m) => {
              const mins = duracion(m);
              const escritas = m.secciones.filter((x) => x.texto.trim() || x.claves?.trim() || x.paraGrupo?.trim()).length;
              return (
                <Deslizable
                  key={m.id}
                  acciones={acciones(m)}
                  onPress={() => abrir(m)}
                  onOpciones={() => setOpciones(m)}
                  accessibilityLabel={`Borrador: ${tituloDe(m, books)}`}
                >
                  <Card>
                    <View style={styles.cardHead}>
                      <Text style={[styles.kicker, { color: colors.muted, flex: 1 }]}>
                        {tipoInfo(m.tipo).nombre.toUpperCase()}
                        {m.pasaje && m.titulo ? ` · ${pasajeLabel(m.pasaje, books).toUpperCase()}` : ''}
                      </Text>
                      {conBoton && <Mas onPress={() => setOpciones(m)} />}
                    </View>
                    <Text style={[styles.msgTitle, { color: colors.text }]}>{tituloDe(m, books)}</Text>
                    <View style={styles.progreso}>
                      <View style={[styles.barra, { backgroundColor: colors.accentSoft }]}>
                        <View style={{ width: `${m.secciones.length ? (escritas / m.secciones.length) * 100 : 0}%`, height: '100%', borderRadius: 3, backgroundColor: colors.accent }} />
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {escritas} de {m.secciones.length} partes
                      </Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
                      {m.tema.trim() ? `${m.tema.trim()} · ` : ''}
                      {mins ? `${mins} min · ` : ''}editado {ago(m.actualizado)}
                    </Text>
                  </Card>
                </Deslizable>
              );
            })}
          </View>
          <Pista conBoton={conBoton} />
        </>
      )}

      {ready && terminados.length > 0 && (
        <>
          <SectionTitle>Mis sermones</SectionTitle>
          {terminados.length > 4 && (
            <Field value={buscar} onChangeText={setBuscar} placeholder="Buscar por título, pasaje o tema" accessibilityLabel="Buscar en Mis sermones" style={{ marginBottom: 10 }} />
          )}
          <View style={{ gap: 10 }}>
            {terminados
              .filter((m) => !buscar.trim() || fold(`${tituloDe(m, books)} ${pasajeLabel(m.pasaje, books)} ${m.tema} ${m.complemento}`).includes(fold(buscar)))
              .map((m) => {
                const veces = m.ocasiones?.length ?? 0;
                const ultima = m.ocasiones?.[0];
                return (
                  <Deslizable
                    key={m.id}
                    acciones={acciones(m)}
                    onPress={() => abrir(m)}
                    onOpciones={() => setOpciones(m)}
                    accessibilityLabel={`Sermón: ${tituloDe(m, books)}`}
                  >
                    <View style={[styles.sermon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={[styles.lomo, { backgroundColor: colors.warm }]} />
                      <View style={{ flex: 1, paddingVertical: 14, paddingRight: conBoton ? 4 : 14 }}>
                        <Text style={[styles.kicker, { color: colors.muted }]}>
                          {tipoInfo(m.tipo).nombre.toUpperCase()}
                          {m.pasaje ? ` · ${pasajeLabel(m.pasaje, books).toUpperCase()}` : ''}
                        </Text>
                        <Text style={[styles.msgTitle, { color: colors.text }]}>{tituloDe(m, books)}</Text>
                        {ideaCentral(m) ? (
                          <Text style={{ color: colors.text, fontFamily: serif, fontStyle: 'italic', fontSize: 15, lineHeight: 21, marginTop: 4 }} numberOfLines={2}>
                            {ideaCentral(m)}
                          </Text>
                        ) : null}
                        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
                          {veces
                            ? `Predicado ${veces === 1 ? 'una vez' : `${veces} veces`} · la última el ${fechaLarga(ultima!.fecha)}${ultima!.lugar ? `, ${ultima!.lugar}` : ''}`
                            : `Terminado el ${fechaLarga(m.terminado!)}`}
                        </Text>
                      </View>
                      <View style={{ justifyContent: conBoton ? 'flex-start' : 'center', paddingRight: 12, paddingTop: conBoton ? 10 : 0 }}>
                        {conBoton ? <Mas onPress={() => setOpciones(m)} /> : <ChevronRightIcon color={colors.muted} size={18} />}
                      </View>
                    </View>
                  </Deslizable>
                );
              })}
          </View>
        </>
      )}
      {ready && terminados.length > 0 && borradores.length === 0 && <Pista conBoton={conBoton} />}
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 28, lineHeight: 17 }}>
        Los borradores se guardan mientras escribes, en este dispositivo y en tu cuenta si entraste. Al terminarlos pasan a
        «Mis sermones». Los encuentros se pueden enviar a tus grupos.
      </Text>
      {opciones && <OpcionesMensaje m={opciones} books={books} onElegir={(o) => elegir(opciones, o)} onClose={() => setOpciones(null)} />}
      {presentar && <ComoPresentar m={presentar} books={books} onClose={() => setPresentar(null)} />}
      {borrado && <AvisoBorrado {...borrado} onFin={() => setBorrado(null)} />}
    </ScrollView>
  );
}

/** El botón «⋯» de una fila, en el computador. */
function Mas({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Opciones"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.mas, (pressed || hovered) && { backgroundColor: colors.accentSoft }]}
    >
      <Text style={{ color: colors.muted, fontSize: 18, fontWeight: '800', lineHeight: 18, marginTop: -6 }}>···</Text>
    </Pressable>
  );
}

/** Cómo llegar a las opciones de un borrador o sermón. */
function Pista({ conBoton }: { conBoton: boolean }) {
  const colors = useColors();
  return (
    <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 10, textAlign: 'center' }}>
      {conBoton ? 'Clic derecho o «···» para ver las opciones: copiar, presentar, borrar…' : 'Mantén pulsado o desliza a la izquierda para ver las opciones'}
    </Text>
  );
}

/** «Se borró … · Deshacer», abajo, mientras todavía se puede deshacer. */
function AvisoBorrado({ titulo, terminado, deshacer, confirmar, onFin }: { titulo: string; terminado: boolean; deshacer: () => void; confirmar: () => void; onFin: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(y, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    const t = setTimeout(() => {
      confirmar();
      onFin();
    }, 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.aviso,
        { bottom: insets.bottom + 16, opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
        Platform.OS === 'web' && ({ position: 'fixed' } as object),
      ]}
    >
      <View style={[styles.avisoCaja, { backgroundColor: colors.text }]} accessibilityLiveRegion="polite">
        <TrashIcon color={colors.background} size={17} strokeWidth={1.9} />
        <Text style={{ color: colors.background, fontSize: 14.5, flex: 1 }} numberOfLines={2}>
          {terminado ? 'Se borró' : 'Se descartó'} <Text style={{ fontWeight: '700' }}>{titulo}</Text>
        </Text>
        <Pressable
          onPress={() => {
            deshacer();
            onFin();
          }}
          hitSlop={10}
          accessibilityRole="button"
          style={({ pressed }) => [styles.deshacer, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: isDark(colors) ? PELIGRO.claro : '#F2C48D', fontWeight: '800', fontSize: 14.5 }}>Deshacer</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 80, maxWidth: 640, width: '100%', alignSelf: 'center' },
  tema: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1.5, padding: 16, marginTop: 20 },
  temaMic: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  temaTitle: { fontFamily: serif, fontSize: 20, fontWeight: '700' },
  banner: { borderRadius: 12, padding: 14, marginTop: 16 },
  type: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  typeName: { fontSize: 17, fontWeight: '700' },
  msgTitle: { fontFamily: serif, fontSize: 19, fontWeight: '700', marginTop: 4 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  progreso: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  barra: { flex: 1, maxWidth: 160, height: 6, borderRadius: 3, overflow: 'hidden' },
  sermon: { flexDirection: 'row', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', gap: 14 },
  lomo: { width: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mas: { width: 32, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  aviso: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  avisoCaja: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingLeft: 16, paddingRight: 8, paddingVertical: 10, maxWidth: 520, width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.22)' },
  deshacer: { paddingHorizontal: 10, paddingVertical: 6 },
});
