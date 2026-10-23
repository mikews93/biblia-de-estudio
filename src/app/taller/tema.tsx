import { Stack, router } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import AskBar from '@/components/AskBar';
import Cuaderno from '@/components/Cuaderno';
import Welcome from '@/components/comunidad/Welcome';
import { Button, Chips, IconText } from '@/components/comunidad/ui';
import { type IconProps, BooksIcon, CheckIcon, ChevronLeftIcon, LampIcon, LecternIcon, PeopleIcon, RefreshIcon, SparkIcon } from '@/components/icons';
import Investigacion from '@/components/Investigacion';
import { NeedsConnection } from '@/components/SinConexion';
import { Markdown, SourcePeek, Sources } from '@/components/StudyText';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { useConversations } from '@/lib/conversaciones';
import { Book, getBooks, parseRef } from '@/lib/data';
import { Source, askStudy } from '@/lib/estudio';
import { chapterHref, verseHref } from '@/lib/routes';
import { PLANTILLAS, Pasaje, TIPOS, Tipo, pasajeLabel, plantilla as plantillaDe } from '@/lib/taller';
import {
  MAX_TEMA,
  MIN_TEMA,
  PasajeSugerido,
  borrarBorradorTema,
  crearDesdeMaqueta,
  estructuraParaIA,
  guardarBorradorTema,
  leerBorradorTema,
  leerExploracion,
  leerMaqueta,
} from '@/lib/tallerTema';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const ICONOS: Record<Tipo, (p: IconProps) => React.ReactNode> = { reflexion: LampIcon, encuentro: PeopleIcon, sermon: LecternIcon };

type Etapa = 'contar' | 'explorar' | 'maqueta';
type Clave = 'explorar' | 'maqueta';

/**
 * El Taller desde un tema: grabar o escribir de qué se quiere hablar; la IA busca pasajes, comentarios y teologías,
 * y con el pasaje elegido arma la maqueta (títulos, preguntas guía y pasajes de apoyo). El mensaje lo escribe la persona.
 */
export default function TemaScreen() {
  const colors = useColors();
  const { settings } = useSettings();
  const [books, setBooks] = useState<Book[]>([]);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<Tipo>('sermon');
  const [cargado, setCargado] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>('contar');
  const [elegido, setElegido] = useState<number>(0);
  const [plantillaId, setPlantillaId] = useState(PLANTILLAS.find((p) => p.tipo === 'sermon')!.id);
  const [idea, setIdea] = useState<number | null>(0);
  const [respuesta, setRespuesta] = useState('');
  const [peek, setPeek] = useState<Source | null>(null);
  const [creando, setCreando] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // El pasaje y la estructura con que se pidió la maqueta.
  // La ref la lee el pedido a la IA, que sale en el mismo toque; el estado, la pantalla.
  const pedido = useRef<{ pasaje: Pasaje; plantilla: string } | null>(null);
  const [pedidoVisto, setPedidoVisto] = useState<{ pasaje: Pasaje; plantilla: string } | null>(null);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    leerBorradorTema().then((b) => {
      if (b) {
        setTexto(b.texto);
        setTipo(b.tipo);
        setPlantillaId(PLANTILLAS.find((p) => p.tipo === b.tipo)!.id);
      }
      setCargado(true);
    });
  }, []);

  useEffect(() => {
    if (cargado) guardarBorradorTema({ texto, tipo });
  }, [texto, tipo, cargado]);

  const convs = useConversations<Clave>((clave, history, onUpdate, signal) => {
    if (clave === 'explorar') return askStudy({ tema: { texto, tipo }, messages: history, version: settings.version }, onUpdate, signal);
    const { pasaje, plantilla } = pedido.current!;
    const single = pasaje.from && !pasaje.to ? pasaje.from : undefined;
    return askStudy(
      {
        book: pasaje.book,
        chapter: pasaje.chapter,
        verse: single,
        messages: [],
        version: settings.version,
        taller: {
          modo: 'maqueta',
          paso: 'bosquejo',
          tipo,
          plantilla: plantillaDe(plantilla)?.nombre,
          desde: single ? undefined : pasaje.from,
          hasta: single ? undefined : pasaje.to,
          borrador: estructuraParaIA(plantilla),
          situacion: texto,
        },
      },
      onUpdate,
      signal,
    );
  });

  const exp = convs.get('explorar');
  const ultima = [...exp.turns].reverse().find((t) => t.role === 'assistant');
  const exploracion = leerExploracion(ultima?.text ?? '', books);
  const pasajes = exploracion.pasajes.filter((p) => p.pasaje);
  const listo = !exp.busy && !!ultima?.text;
  const maq = convs.get('maqueta');
  const maquetaTurn = maq.turns[maq.turns.length - 1];
  const maqueta = leerMaqueta(maquetaTurn?.text ?? '', books);

  const elegirTipo = (t: Tipo) => {
    setTipo(t);
    setPlantillaId(PLANTILLAS.find((p) => p.tipo === t)!.id);
  };

  const buscar = () => {
    setElegido(0);
    setEtapa('explorar');
    convs.run('explorar', []);
  };

  const afinar = () => {
    const q = respuesta.trim();
    if (!q || exp.busy) return;
    setRespuesta('');
    setPeek(null);
    convs.run('explorar', [...exp.turns, { role: 'user', text: q }]);
  };

  const armar = () => {
    const p = pasajes[elegido]?.pasaje;
    if (!p) return;
    pedido.current = { pasaje: p, plantilla: plantillaId };
    setPedidoVisto(pedido.current);
    setIdea(0);
    setEtapa('maqueta');
    convs.run('maqueta', []);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const crear = async () => {
    if (!pedidoVisto) return;
    setCreando(true);
    const id = await crearDesdeMaqueta({
      tipo,
      plantilla: pedidoVisto.plantilla,
      pasaje: pedidoVisto.pasaje,
      situacion: texto,
      maqueta,
      idea: idea === null ? undefined : maqueta.ideas[idea],
      sources: maquetaTurn?.sources ?? [],
    });
    borrarBorradorTema();
    navigate(() => router.replace(`/taller/${id}`), 'forward');
  };

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    setPeek(null);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const leer = (p: Pasaje) => navigate(() => router.push(p.from ? verseHref(p.book, p.chapter, p.from) : chapterHref(p.book, p.chapter)), 'forward');

  const conv = etapa === 'maqueta' ? maq : exp;
  const fallo =
    conv.error === NEEDS_CONNECTION ? (
      <NeedsConnection title="La IA necesita internet" intro="Lo que contaste queda guardado en este dispositivo. Cuando vuelvas a tener conexión, búscalo de nuevo." />
    ) : conv.error === NEEDS_ACCOUNT ? (
      <Welcome
        kind="ia"
        title="Prepara con IA"
        intro="Busca pasajes, comentarios y teologías sobre lo que quieres tratar, y te arma la maqueta; el mensaje lo escribes tú. Solo necesitas una cuenta gratuita."
        onReady={() => convs.retry(etapa === 'maqueta' ? 'maqueta' : 'explorar')}
      />
    ) : conv.error ? (
      <View style={styles.center}>
        <Text style={{ color: colors.text, textAlign: 'center' }}>{conv.error}</Text>
        <Button label="Reintentar" kind="outline" onPress={() => convs.retry(etapa === 'maqueta' ? 'maqueta' : 'explorar')} style={{ marginTop: 12 }} />
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Desde un tema' }} />
      <ScrollView ref={scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {etapa === 'contar' && (
          <Contar
            texto={texto}
            setTexto={setTexto}
            tipo={tipo}
            setTipo={elegirTipo}
            colors={colors}
            onBuscar={buscar}
            hayResultados={exp.turns.length > 0}
            onVolver={() => setEtapa('explorar')}
          />
        )}

        {etapa === 'explorar' && (
          <>
            <Paso n={1} total={2} titulo="Pasajes y fuentes" colors={colors} onBack={() => setEtapa('contar')} backLabel="Lo que contaste" />
            <View style={[styles.quote, { borderColor: colors.accent }]}>
              <Text style={[styles.quoteText, { color: colors.text }]} numberOfLines={4}>
                {texto.trim()}
              </Text>
            </View>
            {!!ultima?.pasos?.length && (
              <View style={{ marginBottom: 16 }}>
                <Investigacion pasos={ultima.pasos} working={!ultima.text && exp.busy} colors={colors} />
              </View>
            )}
            {exp.busy && !exploracion.pasajes.length && !exploracion.entiendo && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>
                  {ultima?.pasos?.length ? 'Leyendo lo que encontró…' : 'Buscando en la Biblia, los comentarios y las teologías…'}
                </Text>
              </View>
            )}
            {!!exploracion.entiendo && (
              <Appear>
                <Text style={[styles.label, { color: colors.muted }]}>LO QUE ENTIENDO</Text>
                <Markdown text={exploracion.entiendo} colors={colors} sources={ultima?.sources} onCite={setPeek} />
              </Appear>
            )}

            {exploracion.pasajes.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.muted, marginTop: 22 }]}>PASAJES · ELIGE EL PRINCIPAL</Text>
                <View style={{ gap: 10 }}>
                  {exploracion.pasajes.map((p, i) => {
                    const idx = pasajes.indexOf(p);
                    return (
                      <PasajeCard
                        key={`${p.cita}-${i}`}
                        p={p}
                        books={books}
                        on={idx >= 0 && idx === elegido}
                        onPress={() => idx >= 0 && setElegido(idx)}
                        onLeer={() => p.pasaje && leer(p.pasaje)}
                        colors={colors}
                        sources={ultima?.sources ?? []}
                        onCite={setPeek}
                      />
                    );
                  })}
                </View>
              </>
            )}

            {exploracion.fuentes.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.muted, marginTop: 24 }]}>LO QUE DICEN LOS COMENTARIOS Y LAS TEOLOGÍAS</Text>
                <View style={[styles.fuentes, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {exploracion.fuentes.map((f, i) => (
                    <View key={i} style={[styles.fuente, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                      <BooksIcon color={colors.accent} size={16} />
                      <View style={{ flex: 1 }}>
                        <Markdown text={f} colors={colors} sources={ultima?.sources} onCite={setPeek} />
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {exploracion.preguntas.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.muted, marginTop: 24 }]}>PARA AFINAR</Text>
                {exploracion.preguntas.map((q, i) => (
                  <Text key={i} style={[styles.pregunta, { color: colors.text }]}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>? </Text>
                    {q}
                  </Text>
                ))}
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>Respóndelas abajo y la búsqueda se ajusta.</Text>
              </>
            )}

            {listo && !!ultima?.sources?.length && <Sources sources={ultima.sources} colors={colors} onOpen={open} />}
            {fallo}

            {listo && pasajes.length > 0 && (
              <Appear style={[styles.armar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.muted }]}>ESTRUCTURA</Text>
                <Chips
                  options={PLANTILLAS.filter((p) => p.tipo === tipo).map((p) => ({ value: p.id, label: p.nombre }))}
                  value={plantillaId}
                  onChange={setPlantillaId}
                />
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{plantillaDe(plantillaId)?.descripcion}</Text>
                <Button
                  label={`Armar la maqueta con ${pasajes[elegido] ? pasajes[elegido].cita : 'el pasaje'}`}
                  icon={SparkIcon}
                  onPress={armar}
                  style={{ marginTop: 14 }}
                />
              </Appear>
            )}
          </>
        )}

        {etapa === 'maqueta' && pedidoVisto && (
          <>
            <Paso n={2} total={2} titulo="La maqueta" colors={colors} onBack={() => setEtapa('explorar')} backLabel="Pasajes y fuentes" />
            <Text style={[styles.lead, { color: colors.muted }]}>
              {pasajeLabel(pedidoVisto.pasaje, books)} · {plantillaDe(pedidoVisto.plantilla)?.nombre}. El esqueleto para que escribas el mensaje
              con tus palabras.
            </Text>
            {!!maquetaTurn?.pasos?.length && (
              <View style={{ marginBottom: 16 }}>
                <Investigacion pasos={maquetaTurn.pasos} working={!maquetaTurn.text && maq.busy} colors={colors} />
              </View>
            )}
            {maq.busy && !maqueta.ideas.length && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>Leyendo el pasaje y armando las partes…</Text>
              </View>
            )}

            {maqueta.ideas.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.muted, marginTop: 22 }]}>IDEA CENTRAL · ELIGE UNA</Text>
                <View style={{ gap: 8 }}>
                  {maqueta.ideas.map((x, i) => (
                    <Opcion key={i} on={idea === i} onPress={() => setIdea(i)} colors={colors}>
                      <Text style={{ fontFamily: serif, fontSize: 17, lineHeight: 25, color: colors.text }}>
                        <Text style={{ fontWeight: '700' }}>{x.tema}:</Text> {x.complemento}
                      </Text>
                    </Opcion>
                  ))}
                  <Opcion on={idea === null} onPress={() => setIdea(null)} colors={colors}>
                    <Text style={{ fontSize: 15, color: colors.muted }}>Prefiero escribirla yo</Text>
                  </Opcion>
                </View>
              </>
            )}

            {maqueta.partes.map((p, i) => (
              <Appear key={i} style={[styles.parte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.parteHead}>
                  <View style={[styles.num, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ color: colors.accent, fontFamily: serif, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.parteTitulo, { color: colors.text }]}>{p.titulo}</Text>
                </View>
                {!!p.pregunta && (
                  <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>? </Text>
                    {p.pregunta}
                  </Text>
                )}
                {!!p.apoyo && (
                  <Pressable
                    disabled={!p.apoyoPasaje}
                    onPress={() => p.apoyoPasaje && leer(p.apoyoPasaje)}
                    style={({ pressed }) => [styles.apoyo, { borderColor: colors.accent, backgroundColor: colors.accentSoft }, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>PASAJE DE APOYO</Text>
                    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 2 }}>
                      <Text style={{ fontWeight: '700' }}>{p.apoyo}</Text>
                    </Text>
                    {!!p.porque && <Markdown text={p.porque} colors={colors} sources={maquetaTurn?.sources} onCite={setPeek} />}
                  </Pressable>
                )}
                <Text style={[styles.vacio, { color: colors.muted, borderColor: colors.border }]}>Aquí escribes tú</Text>
              </Appear>
            ))}

            {!maq.busy && !!maquetaTurn?.sources?.length && <Sources sources={maquetaTurn.sources} colors={colors} onOpen={open} />}
            {fallo}

            {!maq.busy && maqueta.partes.length > 0 && (
              <View style={{ gap: 10, marginTop: 22 }}>
                <Button label="Crear el mensaje con esta maqueta" icon={CheckIcon} onPress={crear} busy={creando} />
                <Button label="Otra maqueta" icon={RefreshIcon} kind="quiet" onPress={() => convs.run('maqueta', [])} />
              </View>
            )}
          </>
        )}

        <Text style={[styles.disclaimer, { color: colors.muted }]}>
          La IA busca en la Biblia, en los comentarios libres de la app y en teologías clásicas de dominio público, y cita cada fuente.
          No escribe tu mensaje: la preparación y la oración son tuyas.
        </Text>
      </ScrollView>

      {peek && <SourcePeek source={peek} colors={colors} onOpen={open} onClose={() => setPeek(null)} version={settings.version} />}
      {etapa === 'explorar' && (listo || exp.busy) && exp.turns.length > 0 && (
        <AskBar
          value={respuesta}
          onChange={setRespuesta}
          onSend={afinar}
          placeholder="Responde o pide otro enfoque"
          busy={exp.busy}
          onStop={exp.turns.length > 1 ? () => convs.stop('explorar') : undefined}
          disabled={!ultima?.text}
          sendLabel="Enviar"
          colors={colors}
        />
      )}
    </View>
  );
}

function Contar({
  texto,
  setTexto,
  tipo,
  setTipo,
  colors,
  onBuscar,
  hayResultados,
  onVolver,
}: {
  texto: string;
  setTexto: (t: string | ((t: string) => string)) => void;
  tipo: Tipo;
  setTipo: (t: Tipo) => void;
  colors: Colors;
  onBuscar: () => void;
  hayResultados: boolean;
  onVolver: () => void;
}) {
  const corto = texto.trim().length < MIN_TEMA;
  return (
    <>
      <Appear style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconText icon={SparkIcon} color={colors.accent} size={13}>
          <Text style={[styles.kicker, { color: colors.accent }]}>DESDE UN TEMA</Text>
        </IconText>
        <Text style={[styles.heroTitle, { color: colors.text }]}>¿De qué quieres hablar?</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          Cuéntalo como te salga: una situación de tu iglesia, una pregunta que te hicieron, algo que Dios te está mostrando. La IA busca pasajes,
          lo que dicen los comentarios y las teologías, y te arma la maqueta.
        </Text>
      </Appear>

      <Text style={[styles.label, { color: colors.muted, marginTop: 22 }]}>QUÉ VAS A PREPARAR</Text>
      <View style={styles.tipos}>
        {TIPOS.map((t) => {
          const on = t.tipo === tipo;
          const Icon = ICONOS[t.tipo];
          return (
            <Pressable
              key={t.tipo}
              onPress={() => setTipo(t.tipo)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.tipo,
                { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Icon color={on ? colors.accent : colors.muted} size={22} />
              <Text style={{ color: on ? colors.accent : colors.text, fontWeight: '700', fontSize: 14, marginTop: 6 }}>{t.nombre}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>{t.duracion}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 18 }} />
      <Cuaderno
        value={texto}
        onChange={setTexto}
        colors={colors}
        max={MAX_TEMA}
        label="Lo que quieres tratar"
        placeholder={'Por ejemplo: «Varios jóvenes del grupo están ansiosos por el futuro y sienten que Dios no los escucha. Quiero hablarles de la confianza sin minimizar lo que sienten.»'}
        accessibilityLabel="Lo que quieres tratar"
        dictarLabel="Grabar"
        minHeight={170}
      />
      <Button label="Buscar pasajes y fuentes" icon={SparkIcon} onPress={onBuscar} disabled={corto} style={{ marginTop: 16 }} />
      {hayResultados && <Button label="Volver a los resultados" kind="quiet" onPress={onVolver} style={{ marginTop: 6 }} />}
    </>
  );
}

function Paso({ n, total, titulo, colors, onBack, backLabel }: { n: number; total: number; titulo: string; colors: Colors; onBack: () => void; backLabel: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.back} accessibilityRole="button">
        <ChevronLeftIcon color={colors.accent} size={16} />
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{backLabel}</Text>
      </Pressable>
      <Text style={[styles.kicker, { color: colors.muted, marginTop: 14 }]}>
        PASO {n} DE {total}
      </Text>
      <Text style={[styles.heroTitle, { color: colors.text, marginTop: 2 }]}>{titulo}</Text>
    </View>
  );
}

function PasajeCard({
  p,
  books,
  on,
  onPress,
  onLeer,
  colors,
  sources,
  onCite,
}: {
  p: PasajeSugerido;
  books: Book[];
  on: boolean;
  onPress: () => void;
  onLeer: () => void;
  colors: Colors;
  sources: Source[];
  onCite: (s: Source) => void;
}) {
  const valido = !!p.pasaje;
  return (
    <Opcion on={on} onPress={onPress} colors={colors} disabled={!valido}>
      <View style={styles.pasajeHead}>
        <Text style={[styles.cita, { color: colors.text }]}>{valido ? pasajeLabel(p.pasaje, books) || p.cita : p.cita}</Text>
        {valido && (
          <Pressable onPress={onLeer} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Leer ${p.cita}`}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Leer ›</Text>
          </Pressable>
        )}
      </View>
      {!!p.porque && <Markdown text={p.porque} colors={colors} sources={sources} onCite={onCite} />}
      {!valido && <Text style={{ color: colors.muted, fontSize: 12 }}>No reconozco esta cita en la app.</Text>}
    </Opcion>
  );
}

/** Una opción para elegir con un toque, con su círculo de selección. */
function Opcion({ on, onPress, colors, disabled, children }: { on: boolean; onPress: () => void; colors: Colors; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      style={({ pressed }) => [
        styles.opcion,
        { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.radio, { borderColor: on ? colors.accent : colors.border }]}>{on && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 96, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroTitle: { fontFamily: serif, fontSize: 27, lineHeight: 34, marginTop: 8 },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  tipos: { flexDirection: 'row', gap: 10 },
  tipo: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  quote: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 16 },
  quoteText: { fontFamily: serif, fontSize: 16, lineHeight: 25, fontStyle: 'italic' },
  center: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  opcion: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  pasajeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  cita: { fontFamily: serif, fontSize: 19, fontWeight: '700' },
  fuentes: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 14 },
  fuente: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  pregunta: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  armar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18, marginTop: 26 },
  parte: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 16, marginTop: 14 },
  parteHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  parteTitulo: { fontFamily: serif, fontSize: 19, flex: 1 },
  apoyo: { borderLeftWidth: 3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 10 },
  vacio: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, textAlign: 'center', fontSize: 13, marginTop: 12 },
  disclaimer: { fontSize: 12, lineHeight: 17, marginTop: 28, textAlign: 'center' },
});
