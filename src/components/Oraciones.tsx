import { router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Button, Field, IconText } from '@/components/comunidad/ui';
import { CheckIcon, CloseIcon, LinkIcon, LockIcon, PencilIcon, PlusIcon, PrayIcon } from '@/components/icons';
import { parseCita } from '@/lib/cita';
import { Book, getBooks, getChapter } from '@/lib/data';
import {
  Acompana,
  Oracion,
  acompanar,
  borrarOracion,
  cuantoTiempo,
  editarOracion,
  nuevaOracion,
  quitarVersiculo,
  responder,
  seguirOrando,
  useOraciones,
} from '@/lib/oraciones';
import { chapterHref, verseHref } from '@/lib/routes';
import { Colors, isDark, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Verso = Omit<Acompana, 'added'>;

const corta = (t: number) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
const larga = (t: number) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
const abrir = (v: Pick<Acompana, 'book' | 'chapter' | 'verse'>) => navigate(() => router.push(verseHref(v.book, v.chapter, v.verse)), 'forward');

/** «Mis oraciones» en el diario: lo que la persona pide, los versículos que la acompañan y lo que Dios respondió. */
export function OracionesVista() {
  const colors = useColors();
  const oraciones = useOraciones();
  const [filtro, setFiltro] = useState<'orando' | 'respondidas'>('orando');
  const [editando, setEditando] = useState<Oracion | 'nueva' | null>(null);
  const [respondiendo, setRespondiendo] = useState<Oracion | null>(null);
  const [agregando, setAgregando] = useState<Oracion | null>(null);

  const orando = oraciones.filter((o) => !o.respondida);
  const respondidas = oraciones.filter((o) => o.respondida).sort((a, b) => b.respondida!.fecha - a.respondida!.fecha);
  const lista = filtro === 'orando' ? orando : respondidas;

  return (
    <View>
      <Appear style={[styles.hero, sombra(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.warm }]}>MIS ORACIONES</Text>
        <Text style={[styles.heroVerse, { color: colors.text }]}>
          «Sean notorias vuestras peticiones delante de Dios en toda oración y ruego, con hacimiento de gracias.»
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Filipenses 4:6</Text>
        <View style={[styles.stats, { borderColor: colors.border }]}>
          <View style={styles.stat}>
            <Text style={[styles.number, { color: colors.text }]}>{orando.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>en oración</Text>
          </View>
          <View style={[styles.stat, { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
            <Text style={[styles.number, { color: colors.warm }]}>{respondidas.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{respondidas.length === 1 ? 'respondida' : 'respondidas'}</Text>
          </View>
        </View>
        <Button label="Nueva petición" icon={PlusIcon} onPress={() => setEditando('nueva')} style={{ marginTop: 16 }} />
      </Appear>

      {oraciones.length > 0 && (
        <View style={[styles.segment, { backgroundColor: colors.accentSoft }]} accessibilityRole="tablist">
          {(
            [
              ['orando', `En oración · ${orando.length}`],
              ['respondidas', `Respondidas · ${respondidas.length}`],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setFiltro(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: filtro === k }}
              style={[styles.segmentItem, filtro === k && [styles.segmentOn, { backgroundColor: colors.surface }]]}
            >
              <Text style={{ color: filtro === k ? colors.text : colors.muted, fontWeight: filtro === k ? '700' : '600', fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {oraciones.length === 0 ? (
        <Appear delay={80} style={[styles.empty, { borderColor: colors.border }]}>
          <PrayIcon color={colors.muted} size={34} strokeWidth={1.4} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Escribe lo que le pides a Dios</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Une a cada petición los versículos que te sostienen mientras oras: desde aquí, o en el lector tocando un versículo y
            luego «Orar». Cuando llegue la respuesta, márcala; con los años verás cómo te acompañó la Palabra.
          </Text>
        </Appear>
      ) : lista.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.muted, marginTop: 24 }]}>
          {filtro === 'orando' ? 'No tienes peticiones abiertas ahora.' : 'Cuando Dios responda una oración, márcala y aparecerá aquí.'}
        </Text>
      ) : (
        lista.map((o, i) => (
          <Appear key={o.id} delay={Math.min(i, 6) * 40}>
            <OracionCard
              oracion={o}
              colors={colors}
              onEditar={() => setEditando(o)}
              onResponder={() => setRespondiendo(o)}
              onAgregar={() => setAgregando(o)}
            />
          </Appear>
        ))
      )}

      <IconText icon={LockIcon} color={colors.muted} size={13} style={{ marginTop: 10, justifyContent: 'center' }}>
        <Text style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}>Tus oraciones son privadas: solo tú las ves.</Text>
      </IconText>

      {editando && <OracionEditor oracion={editando === 'nueva' ? undefined : editando} onClose={() => setEditando(null)} />}
      {respondiendo && <RespuestaEditor oracion={respondiendo} onClose={() => setRespondiendo(null)} />}
      {agregando && <AgregarVersiculo oracion={agregando} onClose={() => setAgregando(null)} />}
    </View>
  );
}

function OracionCard({
  oracion: o,
  colors,
  onEditar,
  onResponder,
  onAgregar,
}: {
  oracion: Oracion;
  colors: Colors;
  onEditar: () => void;
  onResponder: () => void;
  onAgregar: () => void;
}) {
  const r = o.respondida;
  return (
    <View
      testID="oracion"
      style={[
        styles.card,
        sombra(colors),
        { backgroundColor: colors.surface, borderColor: r ? colors.warm : colors.border },
        r && { borderWidth: 1 },
      ]}
    >
      <View style={styles.cardHead}>
        <View style={[styles.badge, { backgroundColor: r ? colors.warmSoft : colors.accentSoft }]}>
          {r ? <CheckIcon color={colors.warm} size={16} strokeWidth={2.4} /> : <PrayIcon color={colors.accent} size={16} />}
        </View>
        <Text style={[styles.kickerSmall, { color: r ? colors.warm : colors.muted, flex: 1 }]} numberOfLines={1}>
          {r ? `RESPONDIDA ${cuantoTiempo(o.created, r.fecha).toUpperCase()}` : `ORANDO DESDE EL ${corta(o.created).toUpperCase()}`}
        </Text>
        <Pressable onPress={onEditar} hitSlop={10} accessibilityLabel="Editar petición" style={styles.iconBtn}>
          <PencilIcon color={colors.muted} size={17} />
        </Pressable>
      </View>

      <Text style={[styles.titulo, { color: colors.text }]}>{o.titulo}</Text>
      {!!o.detalle && <Text style={[styles.detalle, { color: colors.muted }]}>{o.detalle}</Text>}

      {r && (
        <View style={[styles.answer, { backgroundColor: colors.warmSoft }]}>
          <Text style={[styles.kickerSmall, { color: colors.warm }]}>{larga(r.fecha).toUpperCase()}</Text>
          <Text style={[styles.answerText, { color: colors.text }]}>{r.nota || 'Dios respondió.'}</Text>
        </View>
      )}

      {o.versiculos.length > 0 && (
        <View style={{ marginTop: 14, gap: 8 }}>
          <Text style={[styles.kickerSmall, { color: colors.muted }]}>{r ? 'ME ACOMPAÑARON' : 'ME ACOMPAÑAN'}</Text>
          {o.versiculos.map((v) => (
            <VersoFila key={`${v.book}.${v.chapter}.${v.verse}`} verso={v} colors={colors} acento={r ? colors.warm : colors.accent} />
          ))}
        </View>
      )}

      {!r && (
        <View style={styles.actions}>
          <Pressable
            onPress={onAgregar}
            style={({ pressed }) => [styles.chip, { borderColor: colors.border }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <IconText icon={PlusIcon} color={colors.accent} size={15}>
              <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Versículo</Text>
            </IconText>
          </Pressable>
          <Pressable
            onPress={onResponder}
            style={({ pressed }) => [styles.chip, { backgroundColor: colors.warmSoft, borderColor: colors.warmSoft }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <IconText icon={CheckIcon} color={colors.warm} size={15}>
              <Text style={{ color: colors.warm, fontWeight: '700', fontSize: 13 }}>Dios respondió</Text>
            </IconText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Un versículo con su texto; tocarlo lo abre en el lector. */
export function VersoFila({
  verso: v,
  colors,
  acento,
  onQuitar,
}: {
  verso: { book: string; chapter: number; verse?: number; reference: string; text?: string };
  colors: Colors;
  acento: string;
  onQuitar?: () => void;
}) {
  return (
    <Pressable
      onPress={() => (v.verse ? abrir({ ...v, verse: v.verse }) : navigate(() => router.push(chapterHref(v.book, v.chapter)), 'forward'))}
      accessibilityRole="link"
      style={({ pressed }) => [styles.verso, { borderColor: acento }, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.versoRef, { color: colors.text }]}>{v.reference}</Text>
        {!!v.text && (
          <Text style={[styles.versoText, { color: colors.muted }]} numberOfLines={3}>
            {v.text}
          </Text>
        )}
      </View>
      {onQuitar && (
        <Pressable onPress={onQuitar} hitSlop={10} accessibilityLabel={`Quitar ${v.reference}`}>
          <CloseIcon color={colors.muted} size={16} />
        </Pressable>
      )}
    </Pressable>
  );
}

/** Hoja que sube desde abajo, como la de las notas. */
function Hoja({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  const colors = useColors();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sheetHead}>
            <IconText icon={PrayIcon} color={colors.accent} size={17} gap={8}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{titulo}</Text>
            </IconText>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
              <CloseIcon color={colors.muted} size={20} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Nueva petición, o editar una. `inicial` llega del lector o del diario devocional. */
export function OracionEditor({
  oracion,
  inicial,
  onClose,
  onGuardada,
}: {
  oracion?: Oracion;
  inicial?: { detalle?: string; versiculo?: Verso };
  onClose: () => void;
  onGuardada?: () => void;
}) {
  const colors = useColors();
  const [titulo, setTitulo] = useState(oracion?.titulo ?? '');
  const [detalle, setDetalle] = useState(oracion?.detalle ?? inicial?.detalle ?? '');
  const [borrar, setBorrar] = useState(false);

  const guardar = async () => {
    if (oracion) await editarOracion(oracion.id, titulo, detalle);
    else await nuevaOracion(titulo, detalle, inicial?.versiculo);
    onGuardada?.();
    onClose();
  };

  return (
    <Hoja titulo={oracion ? 'Editar petición' : 'Nueva petición'} onClose={onClose}>
      {inicial?.versiculo && <VersoFila verso={inicial.versiculo} colors={colors} acento={colors.accent} />}
      <Field
        label="¿Qué le pides a Dios?"
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Por ejemplo: trabajo para papá"
        autoFocus={!oracion}
        maxLength={120}
        accessibilityLabel="Petición"
      />
      <Field
        label="Cuéntale más (opcional)"
        value={detalle}
        onChangeText={setDetalle}
        placeholder="Lo que sientes, por quién oras, qué esperas…"
        multiline
        accessibilityLabel="Detalle de la petición"
      />
      <View style={styles.buttons}>
        {oracion && (
          <Button
            label={borrar ? 'Toca otra vez' : 'Borrar'}
            kind="quiet"
            onPress={() => (borrar ? borrarOracion(oracion.id).then(onClose) : setBorrar(true))}
          />
        )}
        {oracion?.respondida && <Button label="Seguir orando" kind="outline" onPress={() => seguirOrando(oracion.id).then(onClose)} />}
        <Button label="Guardar" onPress={guardar} disabled={!titulo.trim()} style={{ flex: 1 }} />
      </View>
      {oracion && oracion.versiculos.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.kickerSmall, { color: colors.muted }]}>VERSÍCULOS</Text>
          {oracion.versiculos.map((v) => (
            <VersoFila
              key={`${v.book}.${v.chapter}.${v.verse}`}
              verso={v}
              colors={colors}
              acento={colors.border}
              onQuitar={() => quitarVersiculo(oracion.id, v).then(onClose)}
            />
          ))}
        </View>
      )}
    </Hoja>
  );
}

/** «Dios respondió»: cómo, para recordarlo después. */
function RespuestaEditor({ oracion, onClose }: { oracion: Oracion; onClose: () => void }) {
  const colors = useColors();
  const [nota, setNota] = useState('');
  const [tiempo] = useState(() => cuantoTiempo(oracion.created, Date.now()));
  return (
    <Hoja titulo="Dios respondió" onClose={onClose}>
      <View style={[styles.answer, { backgroundColor: colors.warmSoft, marginTop: 0 }]}>
        <Text style={[styles.kickerSmall, { color: colors.warm }]}>
          {tiempo === 'el mismo día' ? 'LA PEDISTE HOY' : `ORASTE ${tiempo.replace('después de', 'durante').toUpperCase()}`}
        </Text>
        <Text style={[styles.titulo, { color: colors.text, marginTop: 4 }]}>{oracion.titulo}</Text>
      </View>
      <Field
        label="¿Cómo respondió?"
        value={nota}
        onChangeText={setNota}
        placeholder="Lo que pasó, lo que aprendiste, a quién se lo contaste…"
        multiline
        autoFocus
        accessibilityLabel="Cómo respondió"
      />
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
        A veces la respuesta es un sí, a veces es «espera» o algo distinto. Escríbelo como lo vives.
      </Text>
      <Button label="Guardar respuesta" icon={CheckIcon} onPress={() => responder(oracion.id, nota).then(onClose)} />
    </Hoja>
  );
}

/** Une un versículo a una petición escribiendo la cita («Salmo 23:1»). */
function AgregarVersiculo({ oracion, onClose }: { oracion: Oracion; onClose: () => void }) {
  const colors = useColors();
  const { version } = useSettings().settings;
  const [books, setBooks] = useState<Book[]>([]);
  const [cita, setCita] = useState('');
  const [cargado, setCargado] = useState<{ cita: string; verso?: Verso; aviso?: string } | null>(null);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const c = cita.trim() ? parseCita(cita, books) : null;
  const valida = c && !c.problem && c.verse ? c : null;

  useEffect(() => {
    if (!valida) return;
    const book = books.find((b) => b.id === valida.book)!;
    const verse = valida.verse!;
    let vivo = true;
    getChapter(valida.book, valida.chapter, version)
      .catch(() => getChapter(valida.book, valida.chapter))
      .then((verses) => {
        const text = verses.find(([n]) => n === verse)?.[1];
        if (!vivo) return;
        setCargado(
          text
            ? { cita, verso: { book: valida.book, chapter: valida.chapter, verse, reference: `${book.name} ${valida.chapter}:${verse}`, text } }
            : { cita, aviso: 'No encontramos ese versículo.' },
        );
      })
      .catch(() => vivo && setCargado({ cita, aviso: 'No se pudo cargar el versículo. ¿Tienes conexión?' }));
    return () => {
      vivo = false;
    };
    // La cita ya válida decide qué cargar; `valida` cambia de objeto en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cita, books, version]);

  const actual = cargado?.cita === cita ? cargado : null;
  const verso = valida ? (actual?.verso ?? null) : null;
  const aviso = c?.problem ?? (c && !c.verse ? 'Escribe también el versículo, por ejemplo «Salmo 23:1».' : valida ? (actual?.aviso ?? null) : null);

  return (
    <Hoja titulo="Un versículo para esta oración" onClose={onClose}>
      <Text style={[styles.titulo, { color: colors.text, fontSize: 18 }]}>{oracion.titulo}</Text>
      <Field label="Cita" value={cita} onChangeText={setCita} placeholder="Salmo 23:1" autoFocus accessibilityLabel="Cita del versículo" />
      {verso ? (
        <VersoFila verso={verso} colors={colors} acento={colors.accent} />
      ) : (
        !!aviso && <Text style={{ color: colors.muted, fontSize: 13 }}>{aviso}</Text>
      )}
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
        También puedes hacerlo mientras lees: toca un versículo y elige «Orar».
      </Text>
      <Button label="Unir a mi oración" icon={LinkIcon} disabled={!verso} onPress={() => verso && acompanar(oracion.id, verso).then(onClose)} />
    </Hoja>
  );
}

/** Desde el lector: unir el versículo a una petición abierta, o empezar una nueva con él. */
export function OrarConVersiculo({ versiculo, onClose }: { versiculo: Verso; onClose: () => void }) {
  const colors = useColors();
  const abiertas = useOraciones().filter((o) => !o.respondida);
  const [nueva, setNueva] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);

  if (nueva) return <OracionEditor inicial={{ versiculo }} onClose={onClose} />;

  const unir = async (o: Oracion) => {
    await acompanar(o.id, versiculo);
    setHecho(o.titulo);
    setTimeout(onClose, 1100);
  };

  return (
    <Hoja titulo="Orar con este versículo" onClose={onClose}>
      <VersoFila verso={versiculo} colors={colors} acento={colors.accent} />
      {hecho ? (
        <View style={[styles.answer, { backgroundColor: colors.warmSoft, flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
          <CheckIcon color={colors.warm} size={18} strokeWidth={2.4} />
          <Text style={{ color: colors.text, flex: 1 }}>
            Quedó unido a «{hecho}».
          </Text>
        </View>
      ) : (
        <>
          <Button label="Nueva petición con este versículo" icon={PlusIcon} onPress={() => setNueva(true)} />
          {abiertas.length > 0 && (
            <>
              <Text style={[styles.kickerSmall, { color: colors.muted, marginTop: 6 }]}>O ÚNELO A UNA DE TUS ORACIONES</Text>
              {abiertas.map((o) => {
                const ya = o.versiculos.some((v) => v.book === versiculo.book && v.chapter === versiculo.chapter && v.verse === versiculo.verse);
                return (
                  <Pressable
                    key={o.id}
                    disabled={ya}
                    onPress={() => unir(o)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.pick, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}
                  >
                    <PrayIcon color={colors.accent} size={18} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                        {o.titulo}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {ya
                          ? 'Ya te acompaña'
                          : `Desde el ${corta(o.created)} · ${o.versiculos.length} ${o.versiculos.length === 1 ? 'versículo' : 'versículos'}`}
                      </Text>
                    </View>
                    {ya && <CheckIcon color={colors.muted} size={16} />}
                  </Pressable>
                );
              })}
            </>
          )}
        </>
      )}
      <IconText icon={LockIcon} color={colors.muted} size={13}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Tus oraciones son privadas.</Text>
      </IconText>
    </Hoja>
  );
}

const sombra = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 8px 24px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 20, marginBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  heroVerse: { fontFamily: serif, fontSize: 18, lineHeight: 27, fontStyle: 'italic' },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, marginTop: 16 },
  stat: { flex: 1, alignItems: 'center' },
  number: { fontFamily: serif, fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 2 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 16 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segmentOn: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 20, padding: 26, alignItems: 'center' },
  emptyTitle: { fontFamily: serif, fontSize: 20, marginTop: 10, textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18, marginBottom: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  kickerSmall: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  iconBtn: { padding: 4 },
  titulo: { fontFamily: serif, fontSize: 21, lineHeight: 28, marginTop: 10 },
  detalle: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  answer: { borderRadius: 14, padding: 14, marginTop: 12 },
  answerText: { fontFamily: serif, fontSize: 16, lineHeight: 24, fontStyle: 'italic', marginTop: 4 },
  verso: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 2 },
  versoRef: { fontSize: 14, fontWeight: '700' },
  versoText: { fontFamily: serif, fontSize: 15, lineHeight: 22, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingBottom: 28,
    maxWidth: 640,
    maxHeight: '90%',
    width: '100%',
    alignSelf: 'center',
  },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
});
