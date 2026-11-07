import { Stack, router } from 'expo-router';
import { ComponentRef, ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbienteBoton from '@/components/Ambiente';
import Appear from '@/components/Appear';
import AskBar from '@/components/AskBar';
import Cuaderno from '@/components/Cuaderno';
import Welcome from '@/components/comunidad/Welcome';
import { Button, Chips, IconText } from '@/components/comunidad/ui';
import {
  type IconProps,
  BooksIcon,
  CommentIcon,
  CompassIcon,
  GlobeIcon,
  LampIcon,
  LecternIcon,
  PeopleIcon,
  PersonIcon,
  PrayIcon,
  ScrollIcon,
  SparkIcon,
  StarIcon,
} from '@/components/icons';
import Investigacion from '@/components/Investigacion';
import { NeedsConnection } from '@/components/SinConexion';
import { Markdown, SourcePeek, Sources } from '@/components/StudyText';
import { useAmbienteEnPantalla } from '@/lib/ambiente';
import { crearDesdeBorrador, leerBorrador } from '@/lib/borrador';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { paraGuardar, useConversations } from '@/lib/conversaciones';
import { dinamica } from '@/lib/dinamicas';
import { Book, getBooks, parseRef } from '@/lib/data';
import { type EstudioGuardado, paraLaIA, preguntasParaBorrador } from '@/lib/estudioASermon';
import { Source, askStudy } from '@/lib/estudio';
import { chapterHref, verseHref } from '@/lib/routes';
import { PLANTILLAS, Pasaje, TIPOS, Tipo, pasajeLabel, plantilla as plantillaDe, tipoInfo } from '@/lib/taller';
import { borrarTallerIa, guardarTallerIa, leerTallerIa } from '@/lib/tallerIa';
import { useTecladoWeb } from '@/lib/teclado';
import { MAX_TEMA, MIN_TEMA, conCitas, estructuraParaIA, leerExploracion } from '@/lib/tallerTema';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const ICONOS: Record<Tipo, (p: IconProps) => ReactNode> = { reflexion: LampIcon, encuentro: PeopleIcon, sermon: LecternIcon };

type Etapa = 'orar' | 'investigar' | 'direccion' | 'borrador';
type Clave = 'investigar' | 'borrador';
const ETAPAS: { etapa: Etapa; label: string }[] = [
  { etapa: 'orar', label: 'Orar' },
  { etapa: 'investigar', label: 'Investigar' },
  { etapa: 'direccion', label: 'Dirección' },
  { etapa: 'borrador', label: 'Borrador' },
];

/** Dónde se guarda en el almacén del Taller con la IA (src/lib/tallerIa.ts), para volver si la app se cierra. */
const CLAVE = 'preparar';
type Guardado = {
  texto: string;
  tipo: Tipo;
  etapa: Etapa;
  marcadas: string[];
  enfoque: number | null;
  direccion: string;
  plantilla: string;
  pedido?: { pasaje: Pasaje; plantilla: string } | null;
  /** Un estudio profundo convertido en mensaje: la IA parte de él y de las preguntas que hizo la persona. */
  estudio?: EstudioGuardado | null;
};

/**
 * El Taller con borrador. La persona ora y cuenta lo que Dios le puso; la IA investiga con todas las fuentes de la
 * app y predicaciones evangélicas de la web; la persona marca lo que le sirve y le da la dirección; la IA escribe el
 * mensaje completo como borrador, que se abre para revisarlo, cambiarlo hablando, escucharlo y presentarlo.
 */
export default function PrepararScreen() {
  const colors = useColors();
  const { settings } = useSettings();
  useAmbienteEnPantalla();
  // Que el teclado no tape la caja de pedir más ni lo que se escribe (como en Pregúntale a la Biblia, src/lib/teclado.ts).
  const teclado = useTecladoWeb(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [cargado, setCargado] = useState(false);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<Tipo>('encuentro');
  const [etapa, setEtapa] = useState<Etapa>('orar');
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [enfoque, setEnfoque] = useState<number | null>(0);
  const [direccion, setDireccion] = useState('');
  const [plantillaId, setPlantillaId] = useState(PLANTILLAS.find((p) => p.tipo === 'encuentro')!.id);
  const [pregunta, setPregunta] = useState('');
  const [peek, setPeek] = useState<Source | null>(null);
  const [creando, setCreando] = useState(false);
  const [estudio, setEstudio] = useState<EstudioGuardado | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // El pasaje y la estructura con que se pidió el borrador, y lo marcado y la dirección de ese momento.
  const pedido = useRef<{ pasaje: Pasaje; plantilla: string; investigacion: string; direccion: string } | null>(null);
  const [pedidoVisto, setPedidoVisto] = useState<{ pasaje: Pasaje; plantilla: string } | null>(null);

  const convs = useConversations<Clave>((clave, history, onUpdate, signal) => {
    if (clave === 'investigar')
      return askStudy(
        { tema: { texto, tipo, preparar: true, ...(estudio && { estudio: paraLaIA(estudio) }) }, messages: history, version: settings.version },
        onUpdate,
        signal,
      );
    const p = pedido.current!;
    const single = p.pasaje.from && !p.pasaje.to ? p.pasaje.from : undefined;
    return askStudy(
      {
        book: p.pasaje.book,
        chapter: p.pasaje.chapter,
        verse: single,
        messages: [],
        version: settings.version,
        taller: {
          modo: 'borrador',
          paso: 'bosquejo',
          tipo,
          plantilla: plantillaDe(p.plantilla)?.nombre,
          desde: single ? undefined : p.pasaje.from,
          hasta: single ? undefined : p.pasaje.to,
          borrador: estructuraParaIA(p.plantilla),
          situacion: texto,
          investigacion: p.investigacion.slice(0, 12_000) || undefined,
          direccion: p.direccion || undefined,
          minutos: tipoInfo(tipo).minutos,
        },
      },
      onUpdate,
      signal,
    );
  });

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    // Si la app se cerró a mitad, vuelve a lo contado, a la investigación y a lo marcado tal como estaban.
    leerTallerIa(CLAVE).then((e) => {
      const g = e?.vista as Guardado | undefined;
      if (g && typeof g.texto === 'string') {
        setTexto(g.texto);
        setTipo(g.tipo);
        setPlantillaId(plantillaDe(g.plantilla)?.tipo === g.tipo ? g.plantilla : PLANTILLAS.find((p) => p.tipo === g.tipo)!.id);
        setMarcadas(g.marcadas ?? []);
        setEnfoque(g.enfoque ?? 0);
        setDireccion(g.direccion ?? '');
        setEstudio(g.estudio ?? null);
        if (e?.convs?.investigar?.length) convs.set('investigar', e.convs.investigar);
        if (g.pedido && e?.convs?.borrador?.length) {
          pedido.current = { ...g.pedido, investigacion: '', direccion: g.direccion ?? '' };
          setPedidoVisto(g.pedido);
          convs.set('borrador', e.convs.borrador);
        }
        const hay = (k: Clave) => !!e?.convs?.[k]?.length;
        if (g.etapa === 'orar' || (g.etapa === 'borrador' ? hay('borrador') && g.pedido : hay('investigar'))) setEtapa(g.etapa);
      }
      setCargado(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cargado || creando) return;
    const vista: Guardado = { texto, tipo, etapa, marcadas, enfoque, direccion, plantilla: plantillaId, pedido: pedidoVisto, estudio };
    guardarTallerIa(CLAVE, { vista, convs: paraGuardar(convs.all) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, tipo, etapa, marcadas, enfoque, direccion, plantillaId, pedidoVisto, estudio, convs.all, cargado]);

  const inv = convs.get('investigar');
  const ultima = [...inv.turns].reverse().find((t) => t.role === 'assistant');
  const exp = leerExploracion(ultima?.text ?? '', books);
  const fuentesInv = ultima?.sources ?? [];
  const listo = !inv.busy && !!ultima?.text;
  const bor = convs.get('borrador');
  const borTurn = bor.turns[bor.turns.length - 1];
  const borrador = leerBorrador(borTurn?.text ?? '');

  const irA = (e: Etapa) => {
    setEtapa(e);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const elegirTipo = (t: Tipo) => {
    setTipo(t);
    setPlantillaId(PLANTILLAS.find((p) => p.tipo === t)!.id);
  };

  const investigar = () => {
    setMarcadas([]);
    setEnfoque(0);
    irA('investigar');
    convs.run('investigar', []);
  };

  const afinar = () => {
    const q = pregunta.trim();
    if (!q || inv.busy) return;
    setPregunta('');
    setPeek(null);
    convs.ask('investigar', q);
  };

  const marcar = (k: string) => setMarcadas((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));

  // Lo marcado, en texto, para que la IA escriba sobre eso. Las citas pasan a referencias con su fuente.
  const investigacionMarcada = () => {
    const c = (s: string) => conCitas(s, fuentesInv);
    const lineas: string[] = [];
    exp.pasajes.forEach((p, i) => marcadas.includes(`p${i}`) && lineas.push(`- Pasaje: ${p.cita}: ${c(p.porque)}`));
    exp.fuentes.forEach((f, i) => marcadas.includes(`f${i}`) && lineas.push(`- Fuentes: ${c(f)}`));
    exp.vistas.forEach((v, i) => marcadas.includes(`v${i}`) && lineas.push(`- Punto de vista: ${v.pregunta}: ${c(v.texto)}`));
    exp.predicaciones.forEach((p, i) => marcadas.includes(`r${i}`) && lineas.push(`- Predicación «${p.titulo}»: ${c(p.idea)}`));
    exp.contexto.forEach((x, i) => marcadas.includes(`c${i}`) && lineas.push(`- Momento histórico: ${c(x)}`));
    exp.protagonistas.forEach((x, i) => marcadas.includes(`h${i}`) && lineas.push(`- Protagonista ${x.nombre}: ${c(x.texto)}`));
    exp.deEstudio.forEach((x, i) => marcadas.includes(`q${i}`) && lineas.push(`- Pregunta de mi estudio «${x.pregunta}»: ${c(x.texto)}`));
    // Las preguntas que hizo al estudiar van siempre: son las que también tendrá la gente.
    return [lineas.join('\n'), estudio ? preguntasParaBorrador(estudio) : ''].filter(Boolean).join('\n\n');
  };

  // El pasaje sobre el que se escribe: el del enfoque elegido; si no, el primer pasaje marcado o el más fuerte.
  const pasajeBase = (): Pasaje | null => {
    const e = enfoque !== null ? exp.enfoques[enfoque] : undefined;
    if (e?.pasaje) return e.pasaje;
    const marcado = exp.pasajes.find((p, i) => marcadas.includes(`p${i}`) && p.pasaje);
    return marcado?.pasaje ?? exp.pasajes.find((p) => p.pasaje)?.pasaje ?? null;
  };

  const escribir = () => {
    const pasaje = pasajeBase();
    if (!pasaje) return;
    const e = enfoque !== null ? exp.enfoques[enfoque] : undefined;
    const dir = [e && `Enfoque elegido: «${e.titulo}»: ${conCitas(e.idea, fuentesInv)}`, direccion.trim()].filter(Boolean).join('\n');
    pedido.current = { pasaje, plantilla: plantillaId, investigacion: investigacionMarcada(), direccion: dir };
    setPedidoVisto({ pasaje, plantilla: plantillaId });
    irA('borrador');
    convs.run('borrador', []);
  };

  const crear = async () => {
    if (!pedidoVisto || !borrador.partes.length) return;
    setCreando(true);
    const id = await crearDesdeBorrador({
      tipo,
      plantilla: pedidoVisto.plantilla,
      pasaje: pedidoVisto.pasaje,
      situacion: texto,
      borrador,
      sources: borTurn?.sources ?? [],
    });
    borrarTallerIa(CLAVE);
    navigate(() => router.replace(`/taller/${id}/borrador`), 'forward');
  };

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    setPeek(null);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };
  const leer = (p: Pasaje) => navigate(() => router.push(p.from ? verseHref(p.book, p.chapter, p.from) : chapterHref(p.book, p.chapter)), 'forward');

  const clave: Clave = etapa === 'borrador' ? 'borrador' : 'investigar';
  const conv = clave === 'borrador' ? bor : inv;
  const fallo =
    conv.error === NEEDS_CONNECTION ? (
      <NeedsConnection title="La IA necesita internet" intro="Lo que contaste queda guardado. Cuando vuelvas a tener conexión, sigue desde aquí." />
    ) : conv.error === NEEDS_ACCOUNT ? (
      <Welcome
        kind="ia"
        title="Prepara con IA"
        intro="Investiga con los comentarios, el diccionario, las teologías y predicaciones, y te escribe un borrador para revisar. Solo necesitas una cuenta gratuita."
        onReady={() => convs.retry(clave)}
      />
    ) : !conv.busy && !conv.error && conv.turns[conv.turns.length - 1]?.cortada ? (
      <View style={styles.center}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{clave === 'borrador' ? 'El borrador se cortó antes de terminar.' : 'La investigación se cortó antes de terminar.'}</Text>
        <Button label="Continuar" kind="outline" onPress={() => convs.retry(clave)} style={{ marginTop: 12 }} />
      </View>
    ) : conv.error ? (
      <View style={styles.center}>
        <Text style={{ color: colors.text, textAlign: 'center' }}>{conv.error}</Text>
        <Button label="Reintentar" kind="outline" onPress={() => convs.retry(clave)} style={{ marginTop: 12 }} />
      </View>
    ) : null;

  const disponibles: Record<Etapa, boolean> = {
    orar: true,
    investigar: inv.turns.length > 0,
    direccion: listo,
    borrador: !!pedidoVisto && bor.turns.length > 0,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background, paddingBottom: teclado }} behavior="padding">
      <Stack.Screen options={{ title: 'Preparar un mensaje', headerRight: () => <View style={{ marginRight: 12 }}><AmbienteBoton colors={colors} label={false} /></View> }} />
      <Pasos etapa={etapa} disponibles={disponibles} onIr={irA} colors={colors} />
      <ScrollView ref={scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {etapa === 'orar' && (
          <Orar
            texto={texto}
            setTexto={setTexto}
            tipo={tipo}
            setTipo={elegirTipo}
            colors={colors}
            onInvestigar={investigar}
            hayInvestigacion={inv.turns.length > 0}
            onVolver={() => irA('investigar')}
            estudio={estudio}
            onQuitarEstudio={() => setEstudio(null)}
            onAbrirEstudio={() => estudio && navigate(() => router.push(estudio.verse ? verseHref(estudio.book, estudio.chapter, estudio.verse) : chapterHref(estudio.book, estudio.chapter)), 'forward')}
          />
        )}

        {etapa === 'investigar' && (
          <>
            <Encabezado kicker="PASO 2 DE 4" titulo="Lo que encontré" colors={colors}>
              Marca con la estrella lo que te sirve: el borrador se escribe sobre eso. Abajo puedes pedir más o corregir el rumbo.
            </Encabezado>
            <View style={[styles.quote, { borderColor: colors.accent }]}>
              <Text style={[styles.quoteText, { color: colors.text }]} numberOfLines={4}>
                {texto.trim()}
              </Text>
            </View>
            {!!ultima?.pasos?.length && (
              <View style={{ marginBottom: 16 }}>
                <Investigacion pasos={ultima.pasos} working={!ultima.text && inv.busy} colors={colors} />
              </View>
            )}
            {inv.busy && !exp.entiendo && !exp.pasajes.length && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>
                  {ultima?.pasos?.length ? 'Leyendo lo que encontró…' : 'Buscando en la Biblia, los comentarios, el diccionario, las teologías y la web…'}
                </Text>
              </View>
            )}
            {!!exp.entiendo && (
              <Appear>
                <Text style={[styles.label, { color: colors.muted }]}>LO QUE ENTIENDO</Text>
                <Markdown text={exp.entiendo} colors={colors} sources={fuentesInv} onCite={setPeek} />
              </Appear>
            )}

            <Grupo titulo="PASAJES" icon={ScrollIcon} colors={colors} vacio={!exp.pasajes.length}>
              {exp.pasajes.map((p, i) => (
                <Hallazgo key={`p${i}`} on={marcadas.includes(`p${i}`)} onMarcar={() => marcar(`p${i}`)} colors={colors}>
                  <View style={styles.pasajeHead}>
                    <Text style={[styles.cita, { color: colors.text }]}>{p.pasaje ? pasajeLabel(p.pasaje, books) || p.cita : p.cita}</Text>
                    {p.pasaje && (
                      <Pressable onPress={() => p.pasaje && leer(p.pasaje)} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Leer ${p.cita}`}>
                        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Leer ›</Text>
                      </Pressable>
                    )}
                  </View>
                  {!!p.porque && <Markdown text={p.porque} colors={colors} sources={fuentesInv} onCite={setPeek} />}
                </Hallazgo>
              ))}
            </Grupo>

            <Grupo titulo="COMENTARIOS, DICCIONARIO Y TEOLOGÍAS" icon={BooksIcon} colors={colors} vacio={!exp.fuentes.length}>
              {exp.fuentes.map((f, i) => (
                <Hallazgo key={`f${i}`} on={marcadas.includes(`f${i}`)} onMarcar={() => marcar(`f${i}`)} colors={colors}>
                  <Markdown text={f} colors={colors} sources={fuentesInv} onCite={setPeek} />
                </Hallazgo>
              ))}
            </Grupo>

            <Grupo titulo="PUNTOS DE VISTA" icon={CompassIcon} colors={colors} vacio={!exp.vistas.length}>
              {exp.vistas.map((v, i) => (
                <Hallazgo key={`v${i}`} on={marcadas.includes(`v${i}`)} onMarcar={() => marcar(`v${i}`)} colors={colors}>
                  {!!v.pregunta && <Text style={[styles.hTitulo, { color: colors.text }]}>{v.pregunta}</Text>}
                  <Markdown text={v.texto} colors={colors} sources={fuentesInv} onCite={setPeek} />
                </Hallazgo>
              ))}
            </Grupo>

            <Grupo titulo="PREDICACIONES EN LA WEB" icon={GlobeIcon} colors={colors} vacio={!exp.predicaciones.length}>
              {exp.predicaciones.map((p, i) => (
                <Hallazgo key={`r${i}`} on={marcadas.includes(`r${i}`)} onMarcar={() => marcar(`r${i}`)} colors={colors}>
                  {!!p.titulo && <Text style={[styles.hTitulo, { color: colors.text }]}>«{p.titulo}»</Text>}
                  <Markdown text={p.idea} colors={colors} sources={fuentesInv} onCite={setPeek} />
                </Hallazgo>
              ))}
            </Grupo>

            <Grupo titulo="MOMENTO HISTÓRICO" icon={CompassIcon} colors={colors} vacio={!exp.contexto.length}>
              {exp.contexto.map((x, i) => (
                <Hallazgo key={`c${i}`} on={marcadas.includes(`c${i}`)} onMarcar={() => marcar(`c${i}`)} colors={colors}>
                  <Markdown text={x} colors={colors} sources={fuentesInv} onCite={setPeek} />
                </Hallazgo>
              ))}
            </Grupo>

            <Grupo titulo="PROTAGONISTAS" icon={PersonIcon} colors={colors} vacio={!exp.protagonistas.length}>
              {exp.protagonistas.map((x, i) => (
                <Hallazgo key={`h${i}`} on={marcadas.includes(`h${i}`)} onMarcar={() => marcar(`h${i}`)} colors={colors}>
                  {!!x.nombre && <Text style={[styles.hTitulo, { color: colors.text }]}>{x.nombre}</Text>}
                  <Markdown text={x.texto} colors={colors} sources={fuentesInv} onCite={setPeek} />
                </Hallazgo>
              ))}
            </Grupo>

            {!!estudio?.preguntas.length && (
              <Grupo titulo="LO QUE PREGUNTASTE AL ESTUDIAR" icon={CommentIcon} colors={colors} vacio={!exp.deEstudio.length}>
                {exp.deEstudio.map((x, i) => (
                  <Hallazgo key={`q${i}`} on={marcadas.includes(`q${i}`)} onMarcar={() => marcar(`q${i}`)} colors={colors}>
                    {!!x.pregunta && <Text style={[styles.hTitulo, { color: colors.text }]}>«{x.pregunta}»</Text>}
                    <Markdown text={x.texto} colors={colors} sources={fuentesInv} onCite={setPeek} />
                  </Hallazgo>
                ))}
              </Grupo>
            )}

            {listo && !!fuentesInv.length && <Sources sources={fuentesInv} colors={colors} onOpen={open} />}
            {fallo}

            {listo && exp.pasajes.some((p) => p.pasaje) && (
              <Appear style={[styles.seguir, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
                  {marcadas.length
                    ? `Marcaste ${marcadas.length} ${marcadas.length === 1 ? 'idea' : 'ideas'}. El borrador se basa en ${marcadas.length === 1 ? 'ella' : 'ellas'}.`
                    : 'Aún no marcaste nada: el borrador tomará lo más fuerte de la investigación.'}
                </Text>
                <Button label="Dar la dirección" icon={CompassIcon} onPress={() => irA('direccion')} style={{ marginTop: 12 }} />
              </Appear>
            )}
          </>
        )}

        {etapa === 'direccion' && (
          <>
            <Encabezado kicker="PASO 3 DE 4" titulo="¿Hacia dónde lo llevamos?" colors={colors}>
              Elige un enfoque o dicta tú la dirección. Puedes combinarlos: «el primero, pero cierra con Filipenses».
            </Encabezado>
            <View style={{ gap: 10 }}>
              {exp.enfoques.map((e, i) => (
                <Opcion key={i} on={enfoque === i} onPress={() => setEnfoque(i)} colors={colors}>
                  <Text style={{ fontFamily: serif, fontSize: 18, lineHeight: 24, color: colors.text }}>{e.titulo}</Text>
                  {!!e.cita && <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 2 }}>{e.pasaje ? pasajeLabel(e.pasaje, books) || e.cita : e.cita}</Text>}
                  {!!e.idea && (
                    <View style={{ marginTop: 4 }}>
                      <Markdown text={e.idea} colors={colors} sources={fuentesInv} onCite={setPeek} />
                    </View>
                  )}
                </Opcion>
              ))}
              <Opcion on={enfoque === null} onPress={() => setEnfoque(null)} colors={colors}>
                <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>Ninguno: la dirección la doy yo</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>Escríbela o díctala abajo.</Text>
              </Opcion>
            </View>

            <View style={{ height: 20 }} />
            <Cuaderno
              value={direccion}
              onChange={setDireccion}
              colors={colors}
              max={MAX_TEMA}
              label={enfoque === null ? 'Tu dirección' : 'Tu dirección (opcional)'}
              placeholder="Por ejemplo: «Que sea muy práctico para los jóvenes, toma la idea del contexto de Galilea y cierra con una oración en parejas.»"
              accessibilityLabel="Tu dirección para el mensaje"
              dictarLabel="Grabar"
              minHeight={120}
            />

            <Text style={[styles.label, { color: colors.muted, marginTop: 22 }]}>ESTRUCTURA</Text>
            <Chips options={PLANTILLAS.filter((p) => p.tipo === tipo).map((p) => ({ value: p.id, label: p.nombre }))} value={plantillaId} onChange={setPlantillaId} />
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
              {plantillaDe(plantillaId)?.descripcion} {tipo === 'encuentro' ? 'Con dinámicas del catálogo donde encajen.' : ''}
            </Text>

            <Button
              label="Escribir el borrador"
              icon={SparkIcon}
              onPress={escribir}
              disabled={!pasajeBase() || (enfoque === null && direccion.trim().length < MIN_TEMA)}
              style={{ marginTop: 22 }}
            />
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8, textAlign: 'center' }}>
              Sobre {pasajeBase() ? pasajeLabel(pasajeBase(), books) : 'el pasaje principal'} · {tipoInfo(tipo).duracion}
              {marcadas.length ? ` · con ${marcadas.length} ${marcadas.length === 1 ? 'idea marcada' : 'ideas marcadas'}` : ''}
            </Text>
          </>
        )}

        {etapa === 'borrador' && pedidoVisto && (
          <>
            <Encabezado kicker="PASO 4 DE 4" titulo={borrador.titulo || 'Escribiendo el borrador'} colors={colors}>
              {pasajeLabel(pedidoVisto.pasaje, books)} · {plantillaDe(pedidoVisto.plantilla)?.nombre}. Lo revisas, lo cambias y lo haces tuyo.
            </Encabezado>
            {!!borTurn?.pasos?.length && (
              <View style={{ marginBottom: 16 }}>
                <Investigacion pasos={borTurn.pasos} working={!borTurn.text && bor.busy} colors={colors} />
              </View>
            )}
            {bor.busy && !borrador.partes.length && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>
                  {borTurn?.pasos?.length ? 'Escribiendo cada parte…' : 'Leyendo los pasajes y las fuentes…'}
                </Text>
              </View>
            )}
            {borrador.idea && (
              <Appear style={[styles.idea, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.label, { color: colors.muted, marginBottom: 4 }]}>IDEA CENTRAL</Text>
                <Text style={{ fontFamily: serif, fontSize: 17, lineHeight: 25, color: colors.text }}>
                  <Text style={{ fontWeight: '700' }}>{borrador.idea.tema}:</Text> {borrador.idea.complemento}
                </Text>
              </Appear>
            )}
            {borrador.partes.map((p, i) => (
              <Appear key={i} style={[styles.parte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.parteHead}>
                  <Text style={[styles.parteTitulo, { color: colors.text }]}>{p.titulo}</Text>
                  {!!p.minutos && <Text style={{ color: colors.muted, fontSize: 13 }}>{p.minutos} min</Text>}
                </View>
                {!!p.texto && <Markdown text={p.texto} colors={colors} sources={borTurn?.sources} onCite={setPeek} />}
                {!!p.dinamica && (
                  <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
                    Dinámica · <Text style={{ color: colors.text, fontWeight: '700' }}>{dinamica(p.dinamica)?.nombre}</Text>
                  </Text>
                )}
              </Appear>
            ))}
            {!bor.busy && !!borTurn?.sources?.length && <Sources sources={borTurn.sources} colors={colors} onOpen={open} />}
            {fallo}
            {!bor.busy && borrador.partes.length > 0 && (
              <View style={{ gap: 10, marginTop: 22 }}>
                <Button label="Abrir el borrador para revisarlo" icon={SparkIcon} onPress={crear} busy={creando} />
                <Button label="Escribirlo otra vez" kind="quiet" onPress={() => convs.run('borrador', [])} />
              </View>
            )}
          </>
        )}

        <Text style={[styles.disclaimer, { color: colors.muted }]}>
          La IA investiga en la Biblia, los comentarios, el diccionario bíblico, las teologías y credos de la app, y en predicaciones
          evangélicas de la web. Cita cada fuente y la app revisa cada versículo. El borrador es un punto de partida: la oración y la
          última palabra son tuyas.
        </Text>
      </ScrollView>

      {peek && <SourcePeek source={peek} colors={colors} onOpen={open} onClose={() => setPeek(null)} version={settings.version} />}
      {etapa === 'investigar' && (listo || inv.busy) && inv.turns.length > 0 && (
        <AskBar
          value={pregunta}
          onChange={setPregunta}
          onSend={afinar}
          placeholder="Pide más, añade una idea o un enlace"
          busy={inv.busy}
          onStop={inv.turns.length > 1 ? () => convs.stop('investigar') : undefined}
          disabled={!ultima?.text}
          sendLabel="Enviar"
          colors={colors}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function Orar({
  texto,
  setTexto,
  tipo,
  setTipo,
  colors,
  onInvestigar,
  hayInvestigacion,
  onVolver,
  estudio,
  onQuitarEstudio,
  onAbrirEstudio,
}: {
  texto: string;
  setTexto: (t: string | ((t: string) => string)) => void;
  tipo: Tipo;
  setTipo: (t: Tipo) => void;
  colors: Colors;
  onInvestigar: () => void;
  hayInvestigacion: boolean;
  onVolver: () => void;
  estudio: EstudioGuardado | null;
  onQuitarEstudio: () => void;
  onAbrirEstudio: () => void;
}) {
  return (
    <>
      <Appear style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconText icon={PrayIcon} color={colors.accent} size={13}>
          <Text style={[styles.kicker, { color: colors.accent }]}>ANTES DE EMPEZAR</Text>
        </IconText>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Pídele dirección</Text>
        <Text style={[styles.oracion, { color: colors.text }]}>«Señor, ¿qué quieres decirles esta vez? Dame tus ideas, no las mías.»</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          Tómate un momento. Si quieres, pon música de ambiente arriba. Luego cuenta lo que te vino: ideas, un versículo, una persona, una
          situación del grupo.
        </Text>
      </Appear>

      {estudio && <DesdeEstudio estudio={estudio} onQuitar={onQuitarEstudio} onAbrir={onAbrirEstudio} colors={colors} />}

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
              aria-checked={on}
              style={({ pressed }) => [
                styles.tipo,
                { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Icon color={on ? colors.accent : colors.muted} size={22} />
              <Text style={{ color: on ? colors.accent : colors.text, fontWeight: '700', fontSize: 14, marginTop: 6, textAlign: 'center' }}>{t.nombre}</Text>
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
        label="Lo que Dios te puso"
        placeholder="Por ejemplo: «Siento que los muchachos andan con ansiedad por el futuro… me vino Mateo 6 y lo de Pedro caminando sobre el agua.»"
        accessibilityLabel="Lo que Dios te puso"
        dictarLabel="Grabar"
        minHeight={170}
      />
      <Button label="Investigar esto" icon={SparkIcon} onPress={onInvestigar} disabled={texto.trim().length < MIN_TEMA} style={{ marginTop: 16 }} />
      {hayInvestigacion && <Button label="Volver a lo que encontré" kind="quiet" onPress={onVolver} style={{ marginTop: 6 }} />}
    </>
  );
}

/** El estudio profundo del que parte el mensaje: su pasaje, el comienzo del estudio y las preguntas que hizo. */
function DesdeEstudio({ estudio, onQuitar, onAbrir, colors }: { estudio: EstudioGuardado; onQuitar: () => void; onAbrir: () => void; colors: Colors }) {
  const n = estudio.preguntas.length;
  const inicio = estudio.texto.replace(/^#+.*$/gm, '').replace(/[*_>#]/g, '').replace(/\s+/g, ' ').trim();
  return (
    <Appear style={[styles.desde, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <View style={styles.desdeHead}>
        <IconText icon={SparkIcon} color={colors.accent} size={13}>
          <Text style={[styles.kicker, { color: colors.accent }]}>DESDE TU ESTUDIO PROFUNDO</Text>
        </IconText>
        <Pressable onPress={onQuitar} hitSlop={8} accessibilityRole="button" accessibilityLabel="No usar el estudio">
          <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Quitar</Text>
        </Pressable>
      </View>
      <Pressable onPress={onAbrir} accessibilityRole="link" accessibilityLabel={`Abrir ${estudio.cita}`}>
        <Text style={[styles.desdeCita, { color: colors.text }]}>{estudio.cita} ›</Text>
      </Pressable>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 4 }} numberOfLines={2}>
        {inicio}
      </Text>
      {n > 0 && (
        <View style={[styles.desdePreguntas, { borderTopColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.muted, marginBottom: 6 }]}>
            {n === 1 ? 'TU PREGUNTA, PARA ENRIQUECER EL MENSAJE' : `TUS ${n} PREGUNTAS, PARA ENRIQUECER EL MENSAJE`}
          </Text>
          {estudio.preguntas.map((p, i) => (
            <View key={i} style={styles.desdePregunta}>
              <CommentIcon color={colors.accent} size={14} />
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }} numberOfLines={2}>
                {p.pregunta}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 10 }}>
        La IA parte de este pasaje, amplía el estudio con las fuentes{n ? ' y te dice cómo usar cada pregunta en el mensaje' : ''}.
      </Text>
    </Appear>
  );
}

/** Las cuatro etapas arriba, como pestañas: se puede volver a las que ya se hicieron. */
function Pasos({ etapa, disponibles, onIr, colors }: { etapa: Etapa; disponibles: Record<Etapa, boolean>; onIr: (e: Etapa) => void; colors: Colors }) {
  return (
    <View style={[styles.pasos, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.pasosIn}>
        {ETAPAS.map((e, i) => {
          const on = e.etapa === etapa;
          const puede = disponibles[e.etapa] && !on;
          return (
            <Pressable
              key={e.etapa}
              onPress={() => puede && onIr(e.etapa)}
              disabled={!puede}
              accessibilityRole="tab"
              aria-selected={on}
              style={[styles.paso, on && { borderBottomColor: colors.text }]}
            >
              <Text style={{ color: on ? colors.text : disponibles[e.etapa] ? colors.muted : colors.border, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                {i + 1} {e.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Encabezado({ kicker, titulo, colors, children }: { kicker: string; titulo: string; colors: Colors; children?: ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.kicker, { color: colors.muted }]}>{kicker}</Text>
      <Text style={[styles.heroTitle, { color: colors.text, marginTop: 2 }]}>{titulo}</Text>
      {!!children && <Text style={[styles.lead, { color: colors.muted }]}>{children}</Text>}
    </View>
  );
}

function Grupo({ titulo, icon: Icon, colors, vacio, children }: { titulo: string; icon: (p: IconProps) => ReactNode; colors: Colors; vacio: boolean; children: ReactNode }) {
  if (vacio) return null;
  return (
    <Appear style={{ marginTop: 24 }}>
      <IconText icon={Icon} color={colors.muted} size={13}>
        <Text style={[styles.label, { color: colors.muted, marginBottom: 0 }]}>{titulo}</Text>
      </IconText>
      <View style={{ gap: 10, marginTop: 10 }}>{children}</View>
    </Appear>
  );
}

/** Un hallazgo de la investigación, con la estrella para marcarlo. */
function Hallazgo({ on, onMarcar, colors, children }: { on: boolean; onMarcar: () => void; colors: Colors; children: ReactNode }) {
  return (
    <View style={[styles.hallazgo, { backgroundColor: on ? colors.accentSoft : colors.surface, borderColor: on ? colors.accent : colors.border }]}>
      <View style={{ flex: 1 }}>{children}</View>
      <Pressable
        onPress={onMarcar}
        hitSlop={10}
        accessibilityRole="checkbox"
        aria-checked={on}
        accessibilityLabel={on ? 'Quitar de lo que me sirve' : 'Me sirve'}
        style={({ pressed }) => [styles.estrella, pressed && { opacity: 0.6 }]}
      >
        <StarIcon color={on ? colors.warm : colors.muted} size={20} filled={on} />
      </Pressable>
    </View>
  );
}

/** Una opción para elegir con un toque, con su círculo de selección. */
function Opcion({ on, onPress, colors, children }: { on: boolean; onPress: () => void; colors: Colors; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={on}
      style={({ pressed }) => [
        styles.opcion,
        { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.radio, { borderColor: on ? colors.accent : colors.border }]}>{on && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 120, maxWidth: 680, width: '100%', alignSelf: 'center' },
  pasos: { borderBottomWidth: StyleSheet.hairlineWidth },
  pasosIn: { flexDirection: 'row', gap: 18, paddingHorizontal: 20, maxWidth: 680, width: '100%', alignSelf: 'center' },
  paso: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', flexShrink: 1 },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroTitle: { fontFamily: serif, fontSize: 27, lineHeight: 34, marginTop: 8 },
  oracion: { fontFamily: serif, fontSize: 18, lineHeight: 27, fontStyle: 'italic', marginTop: 10 },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  tipos: { flexDirection: 'row', gap: 10 },
  tipo: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
  quote: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 16 },
  desde: { borderWidth: 1, borderRadius: 20, padding: 18, marginTop: 16 },
  desdeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  desdeCita: { fontFamily: serif, fontSize: 21, lineHeight: 28, marginTop: 8 },
  desdePreguntas: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
  desdePregunta: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 3 },
  quoteText: { fontFamily: serif, fontSize: 16, lineHeight: 25, fontStyle: 'italic' },
  center: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  hallazgo: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14 },
  estrella: { paddingTop: 2 },
  hTitulo: { fontFamily: serif, fontSize: 16, lineHeight: 22, fontWeight: '700', marginBottom: 2 },
  pasajeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  cita: { fontFamily: serif, fontSize: 19, fontWeight: '700' },
  seguir: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18, marginTop: 26 },
  opcion: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  idea: { borderRadius: 16, padding: 16, marginBottom: 6 },
  parte: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 16, marginTop: 12 },
  parteHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  parteTitulo: { fontFamily: serif, fontSize: 19, flex: 1 },
  disclaimer: { fontSize: 12, lineHeight: 17, marginTop: 28, textAlign: 'center' },
});
