import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import ComoSigues from '@/components/ComoSigues';
import PlanIcon from '@/components/PlanIcon';
import { Button } from '@/components/comunidad/ui';
import { CheckIcon, ChevronRightIcon, CloseIcon, LockIcon, PrayIcon } from '@/components/icons';
import { Book, getChapter } from '@/lib/data';
import { LINEAS_VIDA, emergenciasDe, paisDelTelefono, telefonoLegible } from '@/lib/lineasVida';
import { acompanar, useOraciones } from '@/lib/oraciones';
import { ParaTi, TemaVivo, paraTi } from '@/lib/paraTi';
import { planDef, todayKey, usePlans } from '@/lib/planes';
import { useProgress } from '@/lib/progress';
import { verseHref } from '@/lib/routes';
import type { TemaId } from '@/lib/temas';
import { Colors, serif, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Ref = { book: string; chapter: number; verse: number };

/** Días que se esconde la tarjeta «No estás solo» después de «Ya tengo con quién hablar». */
const AYUDA_DIAS = 7;

/**
 * «Para ti» en Hoy, debajo del versículo de todos: un versículo para lo que la persona está orando y uno o dos planes,
 * elegidos en el teléfono (src/lib/paraTi.ts). En la cara de Hoy nunca se nombra el tema: alguien puede estar mirando
 * la pantalla. El porqué está a un toque.
 */
export default function ParaTiHoy({ books, comun, colors }: { books: Book[]; comun: Ref; colors: Colors }) {
  const { settings, update } = useSettings();
  const ajustes = settings.paraTi;
  const oraciones = useOraciones();
  const progress = useProgress();
  const plans = usePlans();
  const [porque, setPorque] = useState(false);

  const r = useMemo(
    () => paraTi({ oraciones, capitulos: progress.chapters, planes: plans, ajustes, comun }),
    [oraciones, progress.chapters, plans, ajustes, comun],
  );

  const vistaAyuda = ajustes.ayudaVista && Date.parse(todayKey()) - Date.parse(ajustes.ayudaVista) < AYUDA_DIAS * 86_400_000;
  const cambiar = (patch: Partial<typeof ajustes>) => update({ paraTi: { ...ajustes, ...patch } });
  const hayAlgo = r.versiculo || r.planes.length > 0;

  return (
    <View style={{ gap: 16 }}>
      {r.riesgo && !vistaAyuda && <NoEstasSolo colors={colors} onListo={() => cambiar({ ayudaVista: todayKey() })} />}
      {ajustes.activo && ajustes.acompanar !== false && <ComoSigues oraciones={oraciones} ocultos={ajustes.ocultos} colors={colors} />}
      {hayAlgo && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="para-ti">
          {r.versiculo && <Versiculo key={r.versiculo.palabra.ref.join('.')} r={r} books={books} colors={colors} />}
          {r.planes.length > 0 && (
            <View style={r.versiculo ? [styles.planes, { borderColor: colors.border }] : undefined}>
              <Text style={[styles.kicker, { color: r.versiculo ? colors.muted : colors.warm }]}>
                {r.planes.some((p) => p.tema) ? 'Un plan que te puede ayudar' : 'Un siguiente paso'}
              </Text>
              {r.planes.map((s) => {
                const def = planDef(s.plan, books);
                if (!def) return null;
                return (
                  <Pressable
                    key={s.plan}
                    onPress={() => navigate(() => router.push(`/planes/${s.plan}`), 'forward')}
                    style={({ pressed }) => [styles.plan, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${def.title}. ${s.porque}`}
                  >
                    <View style={[styles.planIcon, { backgroundColor: colors.accentSoft }]}>
                      <PlanIcon icono={def.icono} color={colors.accent} size={24} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontFamily: serif, fontSize: 17 }}>{def.title}</Text>
                      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{s.porque}</Text>
                    </View>
                    <ChevronRightIcon color={colors.muted} size={18} />
                  </Pressable>
                );
              })}
            </View>
          )}
          <Pressable onPress={() => setPorque(true)} hitSlop={8} style={styles.porqueLink} accessibilityRole="button">
            <LockIcon color={colors.muted} size={13} />
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>¿Por qué veo esto?</Text>
          </Pressable>
        </View>
      )}
      {porque && (
        <Porque
          r={r}
          books={books}
          colors={colors}
          onOcultar={(id) => cambiar({ ocultos: [...ajustes.ocultos, id], temas: ajustes.temas.filter((t) => t !== id) })}
          onApagar={() => {
            cambiar({ activo: false });
            setPorque(false);
          }}
          onClose={() => setPorque(false)}
        />
      )}
    </View>
  );
}

/** El versículo de hoy para el tema, con su línea y la manera de llevarlo a la oración. */
function Versiculo({ r, books, colors }: { r: ParaTi; books: Book[]; colors: Colors }) {
  const { settings } = useSettings();
  const { tema, palabra } = r.versiculo!;
  const [book, chapter, verse, hasta] = palabra.ref;
  const [texto, setTexto] = useState<string | null>(null);
  const [unido, setUnido] = useState(false);
  const vivo = r.temas.find((t) => t.tema.id === tema.id)!;
  const nombre = books.find((b) => b.id === book)?.name ?? '';
  const referencia = `${nombre} ${chapter}:${verse}${hasta ? `-${hasta}` : ''}`;

  useEffect(() => {
    getChapter(book, chapter, settings.version)
      .then((vs) => setTexto(vs.filter(([n]) => n >= verse && n <= (hasta ?? verse)).map(([, t]) => t).join(' ') || null))
      .catch(() => setTexto(null));
  }, [book, chapter, verse, hasta, settings.version]);

  const peticion = vivo.motivo.tipo === 'oracion' ? vivo.motivo.id : undefined;
  const unir = async () => {
    if (!peticion || !texto) return;
    await acompanar(peticion, { book, chapter, verse, reference: referencia, text: texto });
    setUnido(true);
  };
  const orar = () => navigate(() => router.push('/diario?vista=oraciones' as never), 'forward');

  return (
    <>
      <Text style={[styles.kicker, { color: colors.warm }]}>
        {vivo.motivo.tipo === 'respondida' ? 'Para dar gracias' : vivo.motivo.tipo === 'elegido' ? 'Una palabra para ti' : 'Para lo que estás orando'}
      </Text>
      <Text style={[styles.verse, { color: colors.text, fontFamily: serif }]}>{texto ? `«${texto}»` : ' '}</Text>
      <Text style={[styles.ref, { color: colors.muted }]}>{referencia}</Text>
      <View style={[styles.luz, { borderColor: colors.warm }]}>
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: serif, fontStyle: 'italic' }}>{palabra.luz}</Text>
      </View>
      <View style={styles.row}>
        {peticion ? (
          <Pressable
            onPress={unir}
            disabled={unido || !texto}
            style={({ pressed }) => [styles.small, { backgroundColor: unido ? colors.accentSoft : colors.accent }, pressed && styles.pressed]}
            accessibilityRole="button"
            aria-disabled={unido}
          >
            {unido ? <CheckIcon color={colors.accent} size={15} strokeWidth={2.4} /> : <PrayIcon color={colors.surface} size={15} strokeWidth={2} />}
            <Text style={{ color: unido ? colors.accent : colors.surface, fontWeight: '700', fontSize: 13 }}>
              {unido ? 'Unido a tu petición' : 'Unirlo a mi petición'}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={orar} style={({ pressed }) => [styles.small, { backgroundColor: colors.accent }, pressed && styles.pressed]} accessibilityRole="button">
            <PrayIcon color={colors.surface} size={15} strokeWidth={2} />
            <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 13 }}>Llevarlo a la oración</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => navigate(() => router.push(verseHref(book, chapter, verse)), 'forward')}
          style={({ pressed }) => [styles.small, { backgroundColor: colors.accentSoft }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Leer el capítulo</Text>
        </Pressable>
      </View>
    </>
  );
}

const motivoTexto = (t: TemaVivo) =>
  t.motivo.tipo === 'elegido'
    ? 'Lo elegiste en «Mis temas».'
    : t.motivo.tipo === 'respondida'
      ? `Marcaste como respondida «${t.motivo.titulo}».`
      : `Lo reconocimos en tu petición «${t.motivo.titulo}».`;

/** «¿Por qué veo esto?»: de dónde sale cada cosa, y cómo quitarla. */
function Porque({
  r,
  books,
  colors,
  onOcultar,
  onApagar,
  onClose,
}: {
  r: ParaTi;
  books: Book[];
  colors: Colors;
  onOcultar: (id: TemaId) => void;
  onApagar: () => void;
  onClose: () => void;
}) {
  const cuidado = r.temas.some((t) => t.tema.cuidado);
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sheetHead}>
            <Text style={{ color: colors.text, fontSize: 20, fontFamily: serif, flex: 1 }}>¿Por qué veo esto?</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
              <CloseIcon color={colors.muted} size={20} />
            </Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
            <View style={[styles.privado, { backgroundColor: colors.accentSoft }]}>
              <LockIcon color={colors.accent} size={18} />
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }}>
                Tu teléfono lo eligió con lo que tú escribiste y leíste. No se envía a nadie, tampoco a nosotros, y no guardamos
                tus temas en ningún servidor. Nada de esto se usa para que pases más tiempo en la app.
              </Text>
            </View>

            {r.temas.map((t) => (
              <View key={t.tema.id} style={[styles.motivo, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t.tema.nombre}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{motivoTexto(t)}</Text>
                </View>
                <Pressable
                  onPress={() => onOcultar(t.tema.id)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.ocultar, { borderColor: colors.border }, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`No mostrar ${t.tema.nombre}`}
                >
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>No mostrar</Text>
                </Pressable>
              </View>
            ))}
            {r.planes.map((s) => (
              <View key={s.plan} style={[styles.motivo, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{planDef(s.plan, books)?.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                    {s.tema ? 'Va con uno de tus temas de arriba.' : 'Por los capítulos que has leído. Solo sale si no tienes otro plan en curso.'}
                  </Text>
                </View>
              </View>
            ))}

            {cuidado && (
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>
                La Palabra consuela de verdad. Y buscar a un médico, un consejero o tu pastor también es cuidar la vida que Dios te
                dio: no es falta de fe.
              </Text>
            )}

            <Button
              label="Elegir mis temas"
              onPress={() => {
                onClose();
                navigate(() => router.push('/mis-temas' as never), 'forward');
              }}
            />
            <Button label="Apagar «Para ti»" kind="quiet" onPress={onApagar} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Si una petición reciente habla de no querer vivir, antes que un versículo: quién puede escuchar hoy. No pasa por
 * ningún servidor ni dispara avisos.
 */
export function NoEstasSolo({ colors, onListo }: { colors: Colors; onListo?: () => void }) {
  const [pais, setPais] = useState<string | null>(paisDelTelefono);
  const [eligiendo, setEligiendo] = useState(false);
  const linea = LINEAS_VIDA.find((l) => l.pais === pais) ?? null;
  const emergencias = emergenciasDe(pais);
  const llamar = (tel: string) => Linking.openURL(`tel:${tel.replace('*', '%2A')}`).catch(() => {});

  return (
    <View style={[styles.card, { backgroundColor: colors.warmSoft, borderColor: colors.warmSoft }]} testID="no-estas-solo">
      <Text style={[styles.kicker, { color: colors.warm }]}>No estás solo</Text>
      <Text style={[styles.ayudaTitulo, { color: colors.text, fontFamily: serif }]}>Tu vida vale mucho para Dios, y para nosotros.</Text>
      <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
        Si estás pensando en hacerte daño, habla hoy con alguien: tu pastor, una persona de confianza o una línea de ayuda.
        Escuchan gratis y sin juzgarte.
      </Text>

      <View style={[styles.linea, { backgroundColor: colors.surface }]}>
        {linea ? (
          <>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>{linea.nombre.toUpperCase()}</Text>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>{linea.linea}</Text>
            <Text style={{ color: colors.accent, fontSize: 30, fontFamily: serif, marginTop: 2 }}>{telefonoLegible(linea.tel)}</Text>
            {linea.nota && <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{linea.nota}</Text>}
            <Button label={`Llamar al ${telefonoLegible(linea.tel)}`} onPress={() => llamar(linea.tel)} style={{ marginTop: 12 }} />
          </>
        ) : (
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
            Elige tu país para ver una línea gratuita. Si no está en la lista, busca la del ministerio de salud de tu país.
          </Text>
        )}
        <Button label={`Si estás en peligro ahora: ${emergencias}`} kind="outline" onPress={() => llamar(emergencias)} style={{ marginTop: 10 }} />
        <Pressable onPress={() => setEligiendo(!eligiendo)} hitSlop={6} style={{ alignSelf: 'center', marginTop: 12 }} accessibilityRole="button">
          <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>{eligiendo ? 'Cerrar la lista' : linea ? 'Otro país' : 'Elegir país'}</Text>
        </Pressable>
        {eligiendo && (
          <View style={styles.paises}>
            {LINEAS_VIDA.map((l) => (
              <Pressable
                key={l.pais}
                onPress={() => {
                  setPais(l.pais);
                  setEligiendo(false);
                }}
                style={[styles.pais, { borderColor: l.pais === pais ? colors.accent : colors.border }]}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: l.pais === pais ? '700' : '500' }}>{l.nombre}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {onListo && (
        <Pressable onPress={onListo} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }} accessibilityRole="button">
          <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 14 }}>Ya tengo con quién hablar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  kicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  verse: { fontSize: 20, lineHeight: 30, marginTop: 10 },
  ref: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  luz: { borderLeftWidth: 2, paddingLeft: 12, marginTop: 14 },
  row: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  planes: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 16 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  planIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  porqueLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  wrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingBottom: 28,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  privado: { flexDirection: 'row', gap: 12, borderRadius: 14, padding: 14, alignItems: 'flex-start' },
  motivo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  ocultar: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  ayudaTitulo: { fontSize: 23, lineHeight: 30, marginTop: 6 },
  linea: { borderRadius: 16, padding: 16, marginTop: 16 },
  paises: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pais: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
});
