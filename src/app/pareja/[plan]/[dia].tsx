import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import StudyPanel from '@/components/StudyPanel';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Avatar, Button, Field, text } from '@/components/comunidad/ui';
import { CheckIcon, HeartIcon, LockIcon, PrayIcon, SparkIcon } from '@/components/icons';
import { useAccount } from '@/lib/comunidad';
import { Book, Verse, getBooks, getChapter } from '@/lib/data';
import { type Acierto, type DiaRespuestas, borrarRespuesta, leerDia, marcarAcierto, ore, responder, usePareja } from '@/lib/parejaApi';
import { DIAS_PLAN, type PasajePareja, planPareja } from '@/lib/parejaPlanes';
import { verseHref } from '@/lib/routes';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Un día de un plan en pareja (o el encuentro del séptimo día). */
export default function DiaParejaScreen() {
  const colors = useColors();
  const { plan: planId, dia: diaParam } = useLocalSearchParams<{ plan: string; dia: string }>();
  const { usuario, ready } = useAccount();
  const { pareja, reload } = usePareja();
  const plan = planPareja(planId);
  const n = Number(diaParam);
  const encuentro = n === DIAS_PLAN;
  const dia = plan && n >= 1 && n < DIAS_PLAN ? plan.dias[n - 1] : undefined;
  const contenido = encuentro ? plan?.encuentro : dia;
  const [r, setR] = useState<DiaRespuestas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studying, setStudying] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);

  const cargar = useCallback(() => {
    if (!usuario || !plan) return;
    leerDia(plan.id, n)
      .then((x) => {
        setR(x);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [usuario, plan, n]);

  useEffect(() => {
    cargar();
    if (pareja === undefined) reload();
  }, [cargar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  if (ready && !usuario) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Stack.Screen options={{ title: 'En pareja' }} />
        <Welcome intro="Entra con tu cuenta para ver este día con tu pareja." />
      </ScrollView>
    );
  }
  if (!plan || !contenido) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={{ color: colors.muted }}>No encontramos este día.</Text>
      </View>
    );
  }

  const nombre = pareja?.otro?.nombre.split(' ')[0] ?? 'tu pareja';
  const book = books.find((b) => b.id === contenido.pasaje.book);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: plan.titulo }} />

      <Appear style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.bannerHead}>
          <Text style={[styles.kicker, { color: colors.warm }]}>
            {encuentro ? `ENCUENTRO · ${plan.encuentro.minutos} MINUTOS JUNTOS` : `DÍA ${n} DE ${DIAS_PLAN} · 5 MINUTOS`}
          </Text>
          <View style={styles.dots}>
            {Array.from({ length: DIAS_PLAN }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: pareja?.hechos?.[i + 1] ? colors.accent : i + 1 === n ? colors.warm : colors.border, width: i + 1 === n ? 16 : 6 },
                ]}
              />
            ))}
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{contenido.titulo}</Text>
        <Text style={[styles.idea, { color: colors.text }]}>{contenido.idea}</Text>
      </Appear>

      <Paso numero={1} titulo="Lean" colors={colors}>
        <Pasaje pasaje={contenido.pasaje} referencia={contenido.referencia} colors={colors} />
        <View style={[styles.row, { marginTop: 12, flexWrap: 'wrap' }]}>
          <Button
            label="Abrir en el lector"
            kind="quiet"
            onPress={() => navigate(() => router.push(verseHref(contenido.pasaje.book, contenido.pasaje.chapter, contenido.pasaje.from)), 'forward')}
          />
          {!encuentro && book && <Button label="Meditarlo a solas" icon={SparkIcon} kind="quiet" onPress={() => setStudying(true)} />}
        </View>
      </Paso>

      {encuentro ? (
        <>
          <Paso numero={2} titulo="Juntos, en persona" colors={colors}>
            <Pasos pasos={plan.encuentro.pasos} colors={colors} />
          </Paso>
          <Paso numero={3} titulo="Para conversar" colors={colors}>
            {plan.encuentro.conversen.map((q) => (
              <Text key={q} style={[styles.conversa, { color: colors.text, borderColor: colors.border }]}>
                {q}
              </Text>
            ))}
            <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>Estas no se escriben: se conversan mirándose a los ojos.</Text>
          </Paso>
        </>
      ) : (
        <Paso numero={2} titulo="Para hoy" colors={colors}>
          <Text style={[text.body, { color: colors.text }]}>{dia!.practica}</Text>
          {dia!.cuidado && <Cuidado colors={colors} />}
        </Paso>
      )}

      <Paso numero={encuentro ? 4 : 3} titulo={encuentro ? 'Al terminar' : 'Respondan, cada uno'} colors={colors}>
        <Text style={[styles.pregunta, { color: colors.text }]}>{encuentro ? plan.encuentro.cierre : dia!.pregunta}</Text>
        {error && !r ? (
          <Text style={[text.small, { color: colors.warm }]}>{error}</Text>
        ) : !r ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
        ) : (
          <Respuestas
            key={`${r.mia?.texto ?? ''}|${r.mia?.adivino ?? ''}`}
            plan={plan.id}
            dia={n}
            r={r}
            adivina={dia?.adivina}
            nombre={nombre}
            foto={pareja?.otro?.foto ?? null}
            colors={colors}
            onCambio={cargar}
          />
        )}
      </Paso>

      {!encuentro && (
        <Paso numero={4} titulo="Oren el uno por el otro" colors={colors} ultimo>
          <Text style={[text.body, { color: colors.text }]}>{dia!.ora}</Text>
          <Button
            label={pareja?.oreHoy ? `Oraste hoy por ${nombre}` : `Oré por ${nombre}`}
            icon={pareja?.oreHoy ? CheckIcon : PrayIcon}
            kind={pareja?.oreHoy ? 'outline' : 'primary'}
            disabled={!!pareja?.oreHoy || !pareja?.otro}
            onPress={() => ore().catch(() => {})}
            style={{ marginTop: 14, alignSelf: 'flex-start' }}
          />
        </Paso>
      )}

      <Pressable
        onPress={() => navigate(() => router.replace('/pareja' as never), 'back')}
        style={({ pressed }) => [styles.next, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.kicker, { color: colors.accent }]}>EN PAREJA</Text>
        <Text style={{ color: colors.text, fontFamily: serif, fontSize: 19, marginTop: 4 }}>Volver a su cordón ›</Text>
      </Pressable>

      {studying && book && (
        <StudyPanel book={book} chapter={contenido.pasaje.chapter} verse={contenido.pasaje.from} enfoque="devocional" onClose={() => setStudying(false)} />
      )}
    </ScrollView>
  );
}

function Paso({ numero, titulo, colors, ultimo, children }: { numero: number; titulo: string; colors: Colors; ultimo?: boolean; children: React.ReactNode }) {
  return (
    <Appear delay={numero * 50} style={styles.paso}>
      <View style={styles.pasoRail}>
        <View style={[styles.pasoNum, { borderColor: colors.accent }]}>
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{numero}</Text>
        </View>
        {!ultimo && <View style={[styles.pasoLinea, { backgroundColor: colors.border }]} />}
      </View>
      <View style={{ flex: 1, paddingBottom: 26 }}>
        <Text style={[styles.pasoTitulo, { color: colors.muted }]}>{titulo.toUpperCase()}</Text>
        {children}
      </View>
    </Appear>
  );
}

/** El pasaje del día en la RV1909, para leerlo sin salir. */
function Pasaje({ pasaje, referencia, colors }: { pasaje: PasajePareja; referencia: string; colors: Colors }) {
  const [verses, setVerses] = useState<Verse[] | null>(null);
  useEffect(() => {
    getChapter(pasaje.book, pasaje.chapter).then(
      (all) => setVerses(all.filter(([v]) => v >= pasaje.from && v <= pasaje.to)),
      () => setVerses([]),
    );
  }, [pasaje.book, pasaje.chapter, pasaje.from, pasaje.to]);
  return (
    <View style={[styles.pasaje, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.muted, marginBottom: 8 }]}>{referencia.toUpperCase()} · RV1909</Text>
      {verses === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Text style={[styles.verseText, { color: colors.text }]}>
          {verses.map(([v, t]) => (
            <Text key={v}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{v} </Text>
              {t}{' '}
            </Text>
          ))}
        </Text>
      )}
    </View>
  );
}

/** Los pasos del encuentro, para irlos marcando mientras lo hacen (solo en este teléfono). */
function Pasos({ pasos, colors }: { pasos: { titulo: string; texto: string }[]; colors: Colors }) {
  const [hechos, setHechos] = useState<number[]>([]);
  return (
    <View style={{ gap: 10 }}>
      {pasos.map((p, i) => {
        const on = hechos.includes(i);
        return (
          <Pressable
            key={p.titulo}
            onPress={() => setHechos(on ? hechos.filter((x) => x !== i) : [...hechos, i])}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={[styles.encPaso, { backgroundColor: colors.surface, borderColor: on ? colors.accent : colors.border }]}
          >
            <View style={[styles.check, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : 'transparent' }]}>
              {on && <CheckIcon color={colors.surface} size={13} strokeWidth={2.6} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{p.titulo}</Text>
              <Text style={[text.body, { color: colors.text, marginTop: 3, opacity: on ? 0.6 : 1 }]}>{p.texto}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Para los temas que en una relación con abuso podrían leerse como «aguanta»: el amor no pide soportar miedo ni
 * violencia, y la ayuda está a un toque (la misma pantalla privada de /pareja/ayuda).
 */
function Cuidado({ colors }: { colors: Colors }) {
  return (
    <Pressable
      onPress={() => navigate(() => router.push('/pareja/ayuda' as never), 'forward')}
      accessibilityRole="link"
      style={({ pressed }) => [styles.cuidado, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[text.small, { color: colors.muted, lineHeight: 19 }]}>
        Esto es para parejas donde los dos están seguros. Si en tu relación hay miedo, control, amenazas o golpes, Dios no te pide
        aguantarlo. <Text style={{ color: colors.accent, fontWeight: '600' }}>Busca ayuda ›</Text>
      </Text>
    </Pressable>
  );
}

/**
 * Lo que escribió cada uno. La respuesta del otro llega del servidor solo cuando yo ya respondí; antes se ve
 * un candado (y, si ya respondió, la invitación a responder para verla).
 */
function Respuestas({
  plan,
  dia,
  r,
  adivina,
  nombre,
  foto,
  colors,
  onCambio,
}: {
  plan: string;
  dia: number;
  r: DiaRespuestas;
  /** Qué se adivina este día, si se adivina. */
  adivina?: string;
  nombre: string;
  foto: string | null;
  colors: Colors;
  onCambio: () => void;
}) {
  const { usuario } = useAccount();
  const [borrador, setBorrador] = useState(r.mia?.texto ?? '');
  const [adivino, setAdivino] = useState(r.mia?.adivino ?? '');
  const [editando, setEditando] = useState(!r.mia);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!r.abierto) {
    return <Text style={[text.body, { color: colors.muted }]}>Este día se abre cuando terminen el anterior.</Text>;
  }

  const guardar = async () => {
    setBusy(true);
    setError(null);
    try {
      await responder(plan, dia, borrador, adivina ? adivino : undefined);
      onCambio();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const borrar = async () => {
    if (!(await confirm('¿Borrar tu respuesta?', `${nombre} dejará de verla.`, 'Borrar'))) return;
    await borrarRespuesta(plan, dia).catch(() => {});
    onCambio();
  };

  return (
    <View style={{ gap: 12 }}>
      {r.suyaEspera && (
        <View style={[styles.aviso, { backgroundColor: colors.warmSoft }]}>
          <LockIcon color={colors.warm} size={15} strokeWidth={2} />
          <Text style={[text.small, { color: colors.text, flex: 1 }]}>{nombre} ya respondió. Escribe lo tuyo para ver lo que escribió.</Text>
        </View>
      )}

      {editando ? (
        <>
          <Field
            value={borrador}
            onChangeText={setBorrador}
            multiline
            maxLength={1500}
            placeholder="Escribe con calma. Solo lo verán ustedes dos."
            style={{ minHeight: 110, fontFamily: serif, fontSize: 16, lineHeight: 24 }}
          />
          {adivina && (
            <View style={[styles.adivinaBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.warm }]}>Y AHORA, ADIVINA</Text>
              <Text style={[text.body, { color: colors.text, marginTop: 4, marginBottom: 10 }]}>
                ¿Qué crees que va a escribir {nombre}? {adivina[0].toUpperCase() + adivina.slice(1)}.
              </Text>
              <Field
                value={adivino}
                onChangeText={setAdivino}
                multiline
                maxLength={800}
                placeholder="Opcional. Cuando respondan los dos, verán cuánto se conocen."
                style={{ minHeight: 70, fontFamily: serif, fontSize: 16, lineHeight: 24 }}
              />
            </View>
          )}
          {error && <Text style={[text.small, { color: colors.warm }]}>{error}</Text>}
          <View style={styles.row}>
            <Button label={r.mia ? 'Guardar cambios' : 'Guardar mi respuesta'} onPress={guardar} busy={busy} disabled={!borrador.trim()} style={{ flex: 1 }} />
            {r.mia && <Button label="Cancelar" kind="outline" onPress={() => setEditando(false)} />}
          </View>
        </>
      ) : (
        r.mia && (
          <Burbuja autor="Tú" nombre={usuario?.nombre ?? 'Tú'} foto={usuario?.foto ?? null} texto={r.mia.texto} colors={colors}>
            {r.mia.adivino && (
              <Adivinanza
                titulo={`Lo que creíste de ${nombre}`}
                texto={r.mia.adivino}
                // Lo que marcó el otro solo existe cuando ya respondió
                acierto={r.suya ? r.mia.acierto : null}
                espera={r.suya ? `${nombre} todavía no marca si acertaste.` : undefined}
                colors={colors}
              />
            )}
            <View style={[styles.row, { marginTop: 8 }]}>
              <Pressable onPress={() => setEditando(true)} hitSlop={6}>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Editar</Text>
              </Pressable>
              <Pressable onPress={borrar} hitSlop={6}>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>Borrar</Text>
              </Pressable>
            </View>
          </Burbuja>
        )
      )}

      {r.mia &&
        (r.suya ? (
          <Appear from={14}>
            <Burbuja autor={nombre} nombre={nombre} foto={foto} texto={r.suya.texto} colors={colors} suya>
              {r.suya.adivino && (
                <Adivinanza
                  titulo={`Lo que ${nombre} creyó de ti`}
                  texto={r.suya.adivino}
                  acierto={r.suya.acierto}
                  marcar={async (v) => {
                    await marcarAcierto(plan, dia, v).catch(() => {});
                    onCambio();
                  }}
                  colors={colors}
                />
              )}
            </Burbuja>
          </Appear>
        ) : (
          <View style={[styles.cerrada, { borderColor: colors.border }]}>
            <LockIcon color={colors.muted} size={18} strokeWidth={1.8} />
            <Text style={[text.small, { color: colors.muted, flex: 1, lineHeight: 19 }]}>
              Lo que escriba {nombre} se abrirá aquí cuando responda. Te avisaremos.
            </Text>
          </View>
        ))}
    </View>
  );
}

const MARCAS: { valor: Acierto; label: string }[] = [
  { valor: 2, label: '¡Acertó!' },
  { valor: 1, label: 'Casi' },
  { valor: 0, label: 'No tanto' },
];
const RESULTADO = ['No tanto, pero ya lo saben', 'Casi', '¡Acertó!'];

/**
 * Una adivinanza dentro de la burbuja. Quien fue adivinado la marca (con `marcar`); los aciertos se suman para
 * los dos, así que no hay nada que ganarle al otro.
 */
function Adivinanza({
  titulo,
  texto,
  acierto,
  marcar,
  espera,
  colors,
}: {
  titulo: string;
  texto: string;
  acierto: Acierto | null;
  marcar?: (v: Acierto) => Promise<void>;
  espera?: string;
  colors: Colors;
}) {
  const [busy, setBusy] = useState<Acierto | null>(null);
  return (
    <View style={[styles.adivinanza, { borderTopColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.muted }]}>{titulo.toUpperCase()}</Text>
      <Text style={[styles.respuesta, { color: colors.text, fontSize: 16, marginTop: 4 }]}>{texto}</Text>
      {marcar ? (
        <View style={[styles.row, { marginTop: 10, flexWrap: 'wrap', gap: 8 }]}>
          {MARCAS.map((m) => {
            const on = acierto === m.valor;
            return (
              <Pressable
                key={m.valor}
                disabled={busy !== null}
                onPress={async () => {
                  setBusy(m.valor);
                  await marcar(m.valor);
                  setBusy(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [
                  styles.marca,
                  { borderColor: on ? colors.warm : colors.border, backgroundColor: on ? colors.warm : 'transparent' },
                  pressed && { opacity: 0.7 },
                ]}
              >
                {on && m.valor === 2 && <HeartIcon filled color={colors.surface} size={13} />}
                <Text style={{ color: on ? colors.surface : colors.text, fontSize: 13, fontWeight: '600' }}>{busy === m.valor ? '…' : m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : acierto !== null ? (
        <View style={[styles.row, { marginTop: 8, gap: 6 }]}>
          {acierto === 2 && <HeartIcon filled color={colors.warm} size={14} />}
          <Text style={{ color: acierto === 2 ? colors.warm : colors.muted, fontSize: 13, fontWeight: '700' }}>{RESULTADO[acierto]}</Text>
        </View>
      ) : (
        espera && <Text style={[text.small, { color: colors.muted, marginTop: 6 }]}>{espera}</Text>
      )}
    </View>
  );
}

function Burbuja({
  autor,
  nombre,
  foto,
  texto,
  colors,
  suya,
  children,
}: {
  autor: string;
  nombre: string;
  foto: string | null;
  texto: string;
  colors: Colors;
  suya?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.burbuja, { backgroundColor: suya ? colors.warmSoft : colors.surface, borderColor: suya ? colors.warm : colors.border }]}>
      <View style={styles.burbujaHead}>
        <Avatar name={nombre} foto={foto} size={26} />
        <Text style={{ color: suya ? colors.warm : colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>{autor.toUpperCase()}</Text>
      </View>
      <Text style={[styles.respuesta, { color: colors.text }]}>{texto}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 8, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18, marginBottom: 22 },
  bannerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  title: { fontFamily: serif, fontSize: 26, lineHeight: 32, marginTop: 8 },
  idea: { fontFamily: serif, fontSize: 17, lineHeight: 26, marginTop: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  paso: { flexDirection: 'row', gap: 14 },
  pasoRail: { alignItems: 'center', width: 28 },
  pasoNum: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pasoLinea: { width: 1.5, flex: 1, marginTop: 4 },
  pasoTitulo: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 6, marginBottom: 10 },
  pasaje: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16 },
  verseText: { fontFamily: serif, fontSize: 18, lineHeight: 29 },
  conversa: { fontFamily: serif, fontSize: 18, lineHeight: 26, borderLeftWidth: 3, paddingLeft: 12, marginBottom: 12 },
  pregunta: { fontFamily: serif, fontSize: 20, lineHeight: 28, marginBottom: 14 },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 12, padding: 12 },
  cerrada: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 16 },
  burbuja: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  burbujaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  respuesta: { fontFamily: serif, fontSize: 17, lineHeight: 25 },
  encPaso: { flexDirection: 'row', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  cuidado: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10 },
  adivinaBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
  adivinanza: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  next: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginTop: 8 },
});
