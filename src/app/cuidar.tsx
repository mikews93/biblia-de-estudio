import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import CirculosIglesia from '@/components/circulo/CirculosIglesia';
import { confirm } from '@/components/comunidad/confirm';
import { Button, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import {
  CheckIcon,
  ChevronDownIcon,
  ChurchIcon,
  ExternalIcon,
  FlameIcon,
  FlagIcon,
  HeartIcon,
  type IconProps,
  PeopleIcon,
  QrIcon,
  SparkIcon,
} from '@/components/icons';
import { useAccount } from '@/lib/comunidad';
import {
  FalloApp,
  marcarReporte,
  type ReporteApp,
  FrecuenteCuidada,
  IglesiaCuidada,
  PasajePendiente,
  PostulacionCuidada,
  PreguntaAnonima,
  Propuesta,
  Raro,
  Resumen,
  aprobar,
  aprobarPostulacion,
  cambiarIglesia,
  descartar,
  detallePasaje,
  fallos,
  marcarFallo,
  marcarRevisado,
  nuevaIglesia,
  proponer,
  quitarFrecuente,
  rechazarPostulacion,
  rehacer,
  resumen,
} from '@/lib/cuidar';
import { Book, getBooks } from '@/lib/data';
import { chapterHref, verseHref } from '@/lib/routes';
import { MOTIVOS } from '@/lib/senales';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Tab = 'avisos' | 'preguntas' | 'iglesias' | 'fallos';
const TABS: Tab[] = ['avisos', 'preguntas', 'iglesias', 'fallos'];

/**
 * «Cuidar Zarza»: lo que revisan quienes cuidan la app (CUIDADORES en Vercel). Los avisos de «Algo suena raro», las
 * preguntas anónimas que ya hicieron cinco o más personas, las iglesias anfitrionas y los fallos de la app.
 */
export default function Cuidar() {
  const colors = useColors();
  const { ready, usuario, cuidador } = useAccount();
  const [data, setData] = useState<Resumen | null>(null);
  const [books, setBooks] = useState<Map<string, Book>>(new Map());
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(TABS.find((t) => t === params.tab) ?? 'avisos');
  const [errores, setErrores] = useState<FalloApp[]>([]);
  const [reportes, setReportes] = useState<ReporteApp[]>([]);
  const load = useAction();

  const refresh = () =>
    load.run(async () => {
      const [r, f] = await Promise.all([resumen(), fallos().catch(() => ({ errores: [], reportes: [] }))]);
      setData(r);
      setErrores(f.errores);
      setReportes(f.reportes ?? []);
    });
  const refreshFallos = () =>
    fallos()
      .then((f) => {
        setErrores(f.errores);
        setReportes(f.reportes ?? []);
      })
      .catch(() => {});
  useEffect(() => {
    getBooks().then((b) => setBooks(new Map(b.map((x) => [x.id, x]))));
  }, []);
  useEffect(() => {
    if (ready && usuario) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, usuario?.id]);

  const name = (id: string) => books.get(id)?.name ?? id;

  if (ready && (!usuario || cuidador === false) && !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Cuidar Zarza' }} />
        <Text style={[text.body, { color: colors.muted, textAlign: 'center' }]}>
          {load.error ?? 'Esta página es para quienes cuidan Zarza.'}
        </Text>
        <Button label="Volver al inicio" kind="outline" onPress={() => router.replace('/')} style={{ marginTop: 16 }} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Cuidar Zarza' }} />
        {load.error ? <ErrorText>{load.error}</ErrorText> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  const tabs: { value: Tab; label: string; icon: (p: IconProps) => ReactNode; n: number }[] = [
    { value: 'avisos', label: 'Avisos', icon: FlagIcon, n: data.raros.length },
    { value: 'preguntas', label: 'Preguntas', icon: PeopleIcon, n: data.pasajes.length },
    // Lo que espera a alguien: postulaciones nuevas e iglesias que se pausaron solas.
    { value: 'iglesias', label: 'Iglesias', icon: ChurchIcon, n: data.postulaciones.length + data.iglesias.filter((i) => i.pausa).length },
    { value: 'fallos', label: 'Fallos', icon: FlameIcon, n: errores.filter((e) => !e.resuelto).length + reportes.filter((r) => !r.resuelto).length },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Cuidar Zarza' }} />
      <Appear>
        <Text style={[styles.title, { color: colors.text }]}>Cuidar Zarza</Text>
        <Text style={[text.body, { color: colors.muted, marginTop: 4 }]}>
          Lo que la comunidad señaló y lo que más pregunta. Nada se publica solo: lo decides tú.
        </Text>
      </Appear>

      <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="tablist">
        {tabs.map((t) => {
          const on = t.value === tab;
          return (
            <Pressable
              key={t.value}
              onPress={() => setTab(t.value)}
              accessibilityRole="tab"
              aria-selected={on}
              style={({ pressed }) => [styles.tab, on && { backgroundColor: colors.accent }, pressed && !on && { opacity: 0.6 }]}
            >
              <t.icon color={on ? colors.surface : colors.text} size={15} />
              <Text style={{ color: on ? colors.surface : colors.text, fontWeight: '700', fontSize: 14 }}>{t.label}</Text>
              {t.n > 0 && (
                <View style={[styles.badge, { backgroundColor: on ? colors.surface : colors.accentSoft }]}>
                  <Text style={{ color: colors.accent, fontSize: 11.5, fontWeight: '800' }}>{t.n}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {tab === 'avisos' &&
        (data.raros.length ? (
          data.raros.map((r, i) => (
            <Appear key={r.clave} delay={i * 30}>
              <Aviso raro={r} name={name} colors={colors} onDone={refresh} />
            </Appear>
          ))
        ) : (
          <Empty colors={colors} icon={HeartIcon} title="Nada que revisar" body="Cuando alguien marque «Algo suena raro» en un estudio, aparecerá aquí." />
        ))}

      {tab === 'preguntas' && (
        <>
          <Text style={[text.small, { color: colors.muted }]}>
            Pasajes donde al menos {data.minPersonas} personas distintas dejaron preguntas nuevas. Hay {data.frecuentes}{' '}
            {data.frecuentes === 1 ? 'pregunta frecuente publicada' : 'preguntas frecuentes publicadas'}.
          </Text>
          {data.pasajes.length ? (
            data.pasajes.map((p, i) => (
              <Appear key={`${p.libro}.${p.capitulo}`} delay={i * 30}>
                <PasajeCard pasaje={p} name={name} colors={colors} onDone={refresh} />
              </Appear>
            ))
          ) : (
            <Empty
              colors={colors}
              icon={PeopleIcon}
              title="Todavía no hay suficientes"
              body={`Un pasaje aparece cuando ${data.minPersonas} personas distintas comparten preguntas sobre él.`}
            />
          )}
        </>
      )}

      {tab === 'fallos' && <Fallos errores={errores} reportes={reportes} colors={colors} onDone={refreshFallos} />}

      {tab === 'iglesias' && <Iglesias iglesias={data.iglesias} postulaciones={data.postulaciones} colors={colors} onDone={refresh} />}
    </ScrollView>
  );
}

function Aviso({ raro, name, colors, onDone }: { raro: Raro; name: (id: string) => string; colors: Colors; onDone: () => void }) {
  const act = useAction();
  const pasaje = `${name(raro.libro)} ${raro.capitulo}${raro.versiculo ? `:${raro.versiculo}` : ''}`;
  const tipo = raro.palabra !== null ? '¿Por qué esta palabra?' : raro.enfoque.startsWith('devocional') ? 'Devocional' : 'Estudio profundo';
  const counts = MOTIVOS.map((m) => ({ ...m, n: raro.motivos.filter((x) => x === m.value).length })).filter((m) => m.n);
  const open = () =>
    navigate(() => router.push((raro.versiculo ? verseHref(raro.libro, raro.capitulo, raro.versiculo) : chapterHref(raro.libro, raro.capitulo)) as never), 'forward');
  const redo = async () => {
    if (!(await confirm('Preparar de nuevo', `El estudio de ${pasaje} se borrará y la próxima persona que lo abra recibirá uno nuevo.`, 'Preparar de nuevo'))) return;
    if (await act.run(() => rehacer(raro.clave))) onDone();
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.accent }]}>{`${tipo}${raro.enfoque.endsWith('-jovenes') ? ' · Jóvenes' : ''}`.toUpperCase()}</Text>
          <Pressable onPress={open} accessibilityRole="link">
            <Text style={[styles.cardTitle, { color: colors.text }]}>{pasaje}</Text>
          </Pressable>
        </View>
        <View style={[styles.count, { backgroundColor: colors.accentSoft }]}>
          <FlagIcon color={colors.accent} size={14} />
          <Text style={{ color: colors.accent, fontWeight: '800' }}>{raro.raros}</Text>
        </View>
      </View>
      <View style={styles.chips}>
        {counts.map((m) => (
          <View key={m.value} style={[styles.chip, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 12.5 }}>{m.n > 1 ? `${m.label} · ${m.n}` : m.label}</Text>
          </View>
        ))}
        {raro.ayudo > 0 && (
          <View style={[styles.chip, { borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 12.5 }}>A {raro.ayudo} les ayudó</Text>
          </View>
        )}
      </View>
      {raro.notas.map((n, i) => (
        <Text key={i} style={[styles.quote, { color: colors.text, borderColor: colors.accent }]}>
          «{n}»
        </Text>
      ))}
      <View style={styles.actions}>
        <Button label="Está bien" kind="quiet" onPress={() => act.run(() => descartar(raro.clave)).then((ok) => ok && onDone())} disabled={act.busy} />
        <Button label="Preparar de nuevo" kind="outline" onPress={redo} busy={act.busy} />
      </View>
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

function PasajeCard({ pasaje, name, colors, onDone }: { pasaje: PasajePendiente; name: (id: string) => string; colors: Colors; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [detalle, setDetalle] = useState<{ preguntas: PreguntaAnonima[]; frecuentes: FrecuenteCuidada[] } | null>(null);
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null);
  const [mano, setMano] = useState('');
  const act = useAction();
  const titulo = `${name(pasaje.libro)} ${pasaje.capitulo}`;

  const cargar = () => act.run(async () => setDetalle(await detallePasaje(pasaje.libro, pasaje.capitulo)));
  const toggle = () => {
    setOpen(!open);
    if (!open && !detalle) cargar();
  };
  const pedir = () => act.run(async () => setPropuestas((await proponer(pasaje.libro, pasaje.capitulo)).propuestas));
  const aprobarUna = (p: Propuesta) =>
    act.run(async () => {
      await aprobar(pasaje.libro, pasaje.capitulo, p);
      setPropuestas((ps) => ps?.filter((x) => x !== p) ?? null);
      setDetalle(await detallePasaje(pasaje.libro, pasaje.capitulo));
    });
  const listo = () =>
    act.run(async () => {
      await marcarRevisado(pasaje.libro, pasaje.capitulo);
      onDone();
    });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: open ? colors.accent : colors.border }, shadow(colors)]}>
      <Pressable onPress={toggle} accessibilityRole="button" aria-expanded={open} style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{titulo}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
            {pasaje.personas} personas · {pasaje.nuevas} {pasaje.nuevas === 1 ? 'pregunta nueva' : 'preguntas nuevas'}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDownIcon color={colors.muted} size={20} />
        </View>
      </Pressable>

      {open && !detalle && <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />}
      {open && detalle && (
        <View style={{ gap: 14, marginTop: 14 }}>
          {detalle.frecuentes.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.kicker, { color: colors.accent }]}>PUBLICADAS</Text>
              {detalle.frecuentes.map((f) => (
                <View key={f.id} style={[styles.published, { backgroundColor: colors.accentSoft }]}>
                  <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>
                    {f.texto}
                    {f.versiculo ? <Text style={{ color: colors.muted }}>{`  · v. ${f.versiculo}`}</Text> : null}
                  </Text>
                  <Pressable
                    onPress={() => act.run(async () => (await quitarFrecuente(f.id), setDetalle(await detallePasaje(pasaje.libro, pasaje.capitulo))))}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>Quitar</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={{ gap: 6 }}>
            <Text style={[styles.kicker, { color: colors.accent }]}>LO QUE PREGUNTARON</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Sin nombres: P1, P2… es la misma persona solo dentro de este capítulo.</Text>
            {detalle.preguntas.map((q, i) => (
              <View key={i} style={styles.anon}>
                <Text style={[styles.who, { color: q.nueva ? colors.accent : colors.muted }]}>{q.quien}</Text>
                <Text style={{ color: q.nueva ? colors.text : colors.muted, flex: 1, fontSize: 14, lineHeight: 20 }}>
                  {q.versiculo ? <Text style={{ color: colors.muted }}>{`v. ${q.versiculo} · `}</Text> : null}
                  {q.texto}
                </Text>
              </View>
            ))}
          </View>

          {propuestas === null ? (
            <Button label="Proponer preguntas con IA" icon={SparkIcon} kind="outline" onPress={pedir} busy={act.busy} />
          ) : propuestas.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 13 }}>La IA no encontró una pregunta que hayan hecho cinco o más personas.</Text>
          ) : (
            propuestas.map((p, i) => (
              <Appear key={i} style={[styles.proposal, { borderColor: colors.accent, backgroundColor: colors.background }]}>
                <Text style={[styles.kicker, { color: colors.accent }]}>{`PROPUESTA · ${p.personas} PERSONAS${p.versiculo ? ` · V. ${p.versiculo}` : ''}`}</Text>
                <Field value={p.texto} onChangeText={(t) => setPropuestas((ps) => ps?.map((x) => (x === p ? { ...x, texto: t } : x)) ?? null)} multiline />
                <View style={styles.actions}>
                  <Button label="Descartar" kind="quiet" onPress={() => setPropuestas((ps) => ps?.filter((x) => x !== p) ?? null)} />
                  <Button label="Publicar" onPress={() => aprobarUna(p)} disabled={act.busy || !p.texto.trim()} />
                </View>
              </Appear>
            ))
          )}

          <View style={{ gap: 8 }}>
            <Field label="O escríbela tú" value={mano} onChangeText={setMano} placeholder="Una pregunta clara sobre el texto" />
            {!!mano.trim() && (
              <Button
                label="Publicar esta pregunta"
                kind="outline"
                onPress={() => aprobarUna({ texto: mano, versiculo: null, personas: pasaje.personas }).then(() => setMano(''))}
                disabled={act.busy}
              />
            )}
          </View>

          <Button label="Listo, ya lo revisé" kind="quiet" onPress={listo} disabled={act.busy} />
          <ErrorText>{act.error}</ErrorText>
        </View>
      )}
    </View>
  );
}

function Iglesias({
  iglesias,
  postulaciones,
  colors,
  onDone,
}: {
  iglesias: IglesiaCuidada[];
  postulaciones: PostulacionCuidada[];
  colors: Colors;
  onDone: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [lampara, setLampara] = useState('40');
  const act = useAction();
  const crear = () =>
    act.run(async () => {
      await nuevaIglesia(nombre, ciudad, Number(lampara) || 40);
      setNombre('');
      setCiudad('');
      onDone();
    });
  return (
    <>
      {postulaciones.length > 0 && (
        <Text style={[styles.kicker, { color: colors.accent, marginTop: 4 }]}>
          {postulaciones.length === 1 ? '1 IGLESIA QUIERE SER ANFITRIONA' : `${postulaciones.length} IGLESIAS QUIEREN SER ANFITRIONAS`}
        </Text>
      )}
      {postulaciones.map((p, n) => (
        <Appear key={p.id} delay={n * 30}>
          <PostulacionFila postulacion={p} colors={colors} onDone={onDone} />
        </Appear>
      ))}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 12 }, shadow(colors)]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Nueva iglesia anfitriona</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Las iglesias se postulan desde la app. Si una te escribió por otro lado, también puedes darla de alta aquí.
        </Text>
        <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Iglesia Bautista Central" />
        <Field label="Ciudad (opcional)" value={ciudad} onChangeText={setCiudad} placeholder="Medellín" />
        <Field label="Preguntas al día por miembro" value={lampara} onChangeText={setLampara} keyboardType="number-pad" />
        <Button label="Dar de alta" icon={ChurchIcon} onPress={crear} busy={act.busy} disabled={!nombre.trim()} />
        <ErrorText>{act.error}</ErrorText>
      </View>
      {iglesias.map((i, n) => (
        <Appear key={i.id} delay={n * 30}>
          <IglesiaFila iglesia={i} colors={colors} onDone={onDone} />
        </Appear>
      ))}
    </>
  );
}

/** Una postulación con lo necesario para comprobar que la iglesia existe, y aprobarla o rechazarla con un motivo. */
function PostulacionFila({ postulacion: p, colors, onDone }: { postulacion: PostulacionCuidada; colors: Colors; onDone: () => void }) {
  const act = useAction();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [lampara, setLampara] = useState('40');
  const aprobarla = async () => {
    if (!(await confirm('Aprobar iglesia', `${p.nombre} recibe su código y ${p.responsable} queda como encargado.`, 'Aprobar'))) return;
    if (await act.run(() => aprobarPostulacion(p.id, Number(lampara) || 40))) onDone();
  };
  const rechazarla = async () => {
    if (await act.run(() => rechazarPostulacion(p.id, motivo))) onDone();
  };
  const fila = (label: string, value: string | null) =>
    value ? (
      <View style={styles.dato}>
        <Text style={[styles.datoLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} selectable>
          {value}
        </Text>
      </View>
    ) : null;
  const mapa = `https://www.google.com/maps/search/${encodeURIComponent([p.nombre, p.direccion, p.ciudad].filter(Boolean).join(', '))}`;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent, gap: 10 }, shadow(colors)]} testID="postulacion">
      <View>
        <Text style={[styles.kicker, { color: colors.accent }]}>POSTULACIÓN · {p.creado.slice(0, 10)}</Text>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{p.nombre}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{[p.ciudad, p.denominacion].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={{ gap: 6 }}>
        {fila('Dirección', p.direccion)}
        {fila('Postula', [p.responsable, p.cargo].filter(Boolean).join(', '))}
        {fila('Contacto', p.contacto)}
        {fila('Cuenta', [p.cuenta, p.correo].filter(Boolean).join(' · '))}
      </View>
      {!!p.mensaje && <Text style={[styles.quote, { color: colors.text, borderColor: colors.border, marginTop: 0 }]}>{p.mensaje}</Text>}
      <View style={styles.verificar}>
        {p.enlace && <Button label="Sitio o redes" icon={ExternalIcon} kind="outline" onPress={() => Linking.openURL(p.enlace!)} />}
        <Button label="Buscar en el mapa" icon={ExternalIcon} kind="outline" onPress={() => Linking.openURL(mapa)} />
      </View>
      {rechazando ? (
        <View style={{ gap: 10 }}>
          <Field
            label="Motivo (lo verá quien la postuló)"
            value={motivo}
            onChangeText={setMotivo}
            placeholder="No encontramos la iglesia en el mapa: agrega la dirección."
            multiline
            maxLength={300}
          />
          <View style={styles.actions}>
            <Button label="Cancelar" kind="quiet" onPress={() => setRechazando(false)} />
            <Button label="Rechazar" kind="outline" onPress={rechazarla} busy={act.busy} disabled={!motivo.trim()} />
          </View>
        </View>
      ) : (
        <View style={[styles.decidir, { borderColor: colors.border }]}>
          <View style={{ width: 140 }}>
            <Field label="Preguntas al día" value={lampara} onChangeText={setLampara} keyboardType="number-pad" />
          </View>
          <View style={[styles.actions, { marginTop: 0, flexGrow: 1 }]}>
            <Button label="Rechazar" kind="quiet" onPress={() => setRechazando(true)} />
            <Button label="Aprobar" icon={CheckIcon} onPress={aprobarla} busy={act.busy} />
          </View>
        </View>
      )}
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

function IglesiaFila({ iglesia, colors, onDone }: { iglesia: IglesiaCuidada; colors: Colors; onDone: () => void }) {
  const act = useAction();
  const [circulos, setCirculos] = useState(false);
  const reanudar = async () => {
    if (await act.run(() => cambiarIglesia(iglesia.id, { reanudar: true }))) onDone();
  };
  const toggle = async () => {
    if (iglesia.activa && !(await confirm('Pausar iglesia', `Sus ${iglesia.miembros} miembros vuelven a la lámpara de siempre y el código deja de servir.`, 'Pausar'))) return;
    if (await act.run(() => cambiarIglesia(iglesia.id, { activa: !iglesia.activa }))) onDone();
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: iglesia.activa ? 1 : 0.7 }, shadow(colors)]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{iglesia.nombre}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
            {[iglesia.ciudad, `${iglesia.miembros} ${iglesia.miembros === 1 ? 'miembro' : 'miembros'}`, `${iglesia.lampara} preguntas al día`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {!!iglesia.encargado && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>Encargado: {iglesia.encargado}</Text>}
        </View>
        <Text style={[styles.code, { color: iglesia.activa ? colors.text : colors.muted }]}>{iglesia.codigo}</Text>
      </View>
      {!!iglesia.pausa && (
        <View style={[styles.published, { backgroundColor: colors.accentSoft, marginTop: 12 }]}>
          <PeopleIcon color={colors.accent} size={18} />
          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>
            Código en pausa: {iglesia.pausa.charAt(0).toLowerCase() + iglesia.pausa.slice(1)}. Quienes ya entraron siguen igual.
          </Text>
          <Button label="Reanudar" kind="outline" onPress={reanudar} busy={act.busy} />
        </View>
      )}
      <View style={styles.actions}>
        <Button label={iglesia.activa ? 'Pausar' : 'Activar'} kind="quiet" onPress={toggle} busy={act.busy} />
        {iglesia.activa && (
          <Button
            label="Ver su QR"
            icon={QrIcon}
            kind="outline"
            onPress={() => navigate(() => router.push(`/iglesia/${iglesia.codigo}` as never), 'forward')}
          />
        )}
        <Button label={circulos ? 'Ocultar círculos' : 'Círculos de solteros'} icon={PeopleIcon} kind="quiet" onPress={() => setCirculos(!circulos)} />
      </View>
      {circulos && <CirculosIglesia iglesia={iglesia.id} colors={colors} />}
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

const PLATAFORMA = { web: 'Web', android: 'Android', ios: 'iPhone' } as const;
const ORIGEN = { pantalla: 'Una pantalla', global: 'Fuera de las pantallas', promesa: 'Una tarea de fondo' } as const;

/** «hace 5 min», «hace 3 h», «hace 2 días». */
function hace(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/** Los fallos que mandó la app (src/lib/errores.ts), los más recientes primero; los resueltos van al final. */
function Fallos({ errores, reportes, colors, onDone }: { errores: FalloApp[]; reportes: ReporteApp[]; colors: Colors; onDone: () => void }) {
  const abiertos = errores.filter((e) => !e.resuelto);
  const resueltos = errores.filter((e) => e.resuelto);
  const porLeer = reportes.filter((r) => !r.resuelto);
  return (
    <>
      {reportes.length > 0 && (
        <>
          <Text style={[styles.kicker, { color: colors.muted }]}>LO QUE NOS CONTARON</Text>
          {[...porLeer, ...reportes.filter((r) => r.resuelto)].map((r, i) => (
            <Appear key={r.id} delay={i * 30}>
              <Reporte reporte={r} colors={colors} onDone={onDone} />
            </Appear>
          ))}
          <Text style={[styles.kicker, { color: colors.muted, marginTop: 12 }]}>FALLOS AUTOMÁTICOS</Text>
        </>
      )}
      <Text style={[text.small, { color: colors.muted }]}>
        Lo que se rompió en los teléfonos y en la web, sin datos de nadie. Los avisos iguales se juntan; si un fallo resuelto vuelve en otra versión, se abre otra
        vez.
      </Text>
      {abiertos.length ? (
        abiertos.map((e, i) => (
          <Appear key={e.firma} delay={i * 30}>
            <Fallo fallo={e} colors={colors} onDone={onDone} />
          </Appear>
        ))
      ) : (
        <Empty colors={colors} icon={CheckIcon} title="Sin fallos abiertos" body="Cuando algo se rompa en la app de alguien, aparecerá aquí con la pantalla y la versión." />
      )}
      {resueltos.length > 0 && (
        <>
          <Text style={[styles.kicker, { color: colors.muted, marginTop: 12 }]}>RESUELTOS</Text>
          {resueltos.map((e) => (
            <Fallo key={e.firma} fallo={e} colors={colors} onDone={onDone} />
          ))}
        </>
      )}
    </>
  );
}

function Fallo({ fallo, colors, onDone }: { fallo: FalloApp; colors: Colors; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const act = useAction();
  const cambiar = () => act.run(() => marcarFallo(fallo.firma, !fallo.resuelto)).then((ok) => ok && onDone());
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: fallo.fatal && !fallo.resuelto ? colors.accent : colors.border, opacity: fallo.resuelto ? 0.7 : 1 },
        shadow(colors),
      ]}
    >
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" aria-expanded={open} style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.accent }]}>
            {`${PLATAFORMA[fallo.plataforma]} · ${ORIGEN[fallo.origen]}${fallo.fatal ? ' · cerró la app' : ''}`.toUpperCase()}
          </Text>
          <Text style={[styles.falloTitle, { color: colors.text }]} numberOfLines={open ? undefined : 2}>
            {fallo.mensaje}
          </Text>
        </View>
        <View style={[styles.count, { backgroundColor: colors.accentSoft }]} accessibilityLabel={`${fallo.veces} ${fallo.veces === 1 ? 'vez' : 'veces'}`}>
          <Text style={{ color: colors.accent, fontWeight: '800' }}>×{fallo.veces}</Text>
        </View>
      </Pressable>
      <View style={styles.chips}>
        {!!fallo.ruta && (
          <View style={[styles.chip, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 12.5 }}>{fallo.ruta}</Text>
          </View>
        )}
        {!!fallo.version && (
          <View style={[styles.chip, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 12.5 }}>{fallo.version}</Text>
          </View>
        )}
        <View style={[styles.chip, { borderColor: colors.border }]}>
          <Text style={{ color: colors.muted, fontSize: 12.5 }}>{fallo.veces > 1 ? `Desde ${hace(fallo.primera)} · última ${hace(fallo.ultima)}` : hace(fallo.ultima)}</Text>
        </View>
      </View>
      {open && !!fallo.pila && (
        <View style={[styles.pila, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text selectable style={[styles.mono, { color: colors.text }]}>
            {fallo.pila}
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        <Button label={fallo.resuelto ? 'Abrir otra vez' : 'Ya lo arreglé'} kind={fallo.resuelto ? 'quiet' : 'outline'} onPress={cambiar} busy={act.busy} />
      </View>
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

function Reporte({ reporte, colors, onDone }: { reporte: ReporteApp; colors: Colors; onDone: () => void }) {
  const act = useAction();
  const cambiar = () => act.run(() => marcarReporte(reporte.id, !reporte.resuelto)).then((ok) => ok && onDone());
  return (
    <View
      testID="reporte"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: reporte.resuelto ? 0.7 : 1 }, shadow(colors)]}
    >
      <Text style={[styles.kicker, { color: colors.accent }]}>{`${PLATAFORMA[reporte.plataforma]} · ${hace(reporte.creado)}`.toUpperCase()}</Text>
      <Text selectable style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
        {reporte.texto}
      </Text>
      <View style={styles.chips}>
        {[reporte.ruta, reporte.version].filter(Boolean).map((x) => (
          <View key={x} style={[styles.chip, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 12.5 }}>{x}</Text>
          </View>
        ))}
        {!!reporte.contacto && (
          <Pressable
            onPress={() => Linking.openURL(`mailto:${reporte.contacto}?subject=${encodeURIComponent('Tu reporte en Zarza')}`)}
            accessibilityRole="link"
            style={[styles.chip, { borderColor: colors.accent }]}
          >
            <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '700' }}>Responder a {reporte.contacto}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.actions}>
        <Button label={reporte.resuelto ? 'Marcar sin atender' : 'Ya lo atendí'} kind={reporte.resuelto ? 'quiet' : 'outline'} onPress={cambiar} busy={act.busy} />
      </View>
      <ErrorText>{act.error}</ErrorText>
    </View>
  );
}

function Empty({ colors, icon: Icon, title, body }: { colors: Colors; icon: (p: IconProps) => ReactNode; title: string; body: string }) {
  return (
    <Appear style={[styles.empty, { borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon color={colors.accent} size={22} />
      </View>
      <Text style={[styles.cardTitle, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', maxWidth: 360 }}>{body}</Text>
    </Appear>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontFamily: serif, fontSize: 30, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 3, gap: 3, marginVertical: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 19, paddingVertical: 9 },
  badge: { borderRadius: 9, minWidth: 18, paddingHorizontal: 5, alignItems: 'center' },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  cardTitle: { fontFamily: serif, fontSize: 20, fontWeight: '700', marginTop: 2 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  quote: { fontSize: 14, lineHeight: 20, fontStyle: 'italic', borderLeftWidth: 2, paddingLeft: 10, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  published: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  anon: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  who: { width: 30, fontSize: 12, fontWeight: '800', marginTop: 2 },
  proposal: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  code: { fontSize: 17, fontWeight: '800', letterSpacing: 2.5 },
  dato: { flexDirection: 'row', gap: 10 },
  datoLabel: { width: 72, fontSize: 12, fontWeight: '700', marginTop: 2 },
  verificar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  decidir: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  empty: { alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: 20, padding: 28, marginTop: 8 },
  falloTitle: { fontSize: 15.5, fontWeight: '700', lineHeight: 21, marginTop: 4 },
  pila: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginTop: 12 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }), fontSize: 11.5, lineHeight: 17 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
