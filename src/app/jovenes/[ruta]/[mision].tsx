import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Field } from '@/components/comunidad/ui';
import { CheckIcon, HeartIcon, OpenBookIcon, PencilIcon, StarIcon } from '@/components/icons';
import { Estrellas, IconoRuta, tinte, type Tinte } from '@/components/jovenes/arte';
import { Book, Verse, getBooks, getChapter } from '@/lib/data';
import {
  MAX_RESPUESTA,
  barajar,
  buscarMision,
  celebrarMisiones,
  claveMision,
  completar,
  estrellas,
  marcarReto,
  responder,
  siguiente,
  useJovenes,
} from '@/lib/jovenes';
import type { Mision, Ruta } from '@/lib/jovenesRutas';
import { chapterHref } from '@/lib/routes';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

// Una misión en cuatro pasos cortos: Lee (el pasaje con un poco de contexto), Entiende (dos preguntas cuya respuesta
// está en el texto: se puede volver a intentar sin castigo), Piensa (una pregunta abierta, privada) y Vive (un reto
// para la semana). Al final, las estrellas y los sellos nuevos. Si la misión ya se hizo, se abre en «repaso».

type Paso = 'lee' | 'entiende' | 'piensa' | 'vive' | 'fin' | 'repaso';
const PASOS: { id: Paso; label: string }[] = [
  { id: 'lee', label: 'Lee' },
  { id: 'entiende', label: 'Entiende' },
  { id: 'piensa', label: 'Piensa' },
  { id: 'vive', label: 'Vive' },
];

export default function MisionScreen() {
  const params = useLocalSearchParams<{ ruta: string; mision: string }>();
  const colors = useColors();
  const { settings } = useSettings();
  const s = useJovenes();
  const found = buscarMision(params.ruta, params.mision);
  const reg = found ? s[claveMision(found.ruta.id, found.mision.id)] : undefined;
  const [paso, setPaso] = useState<Paso>(reg ? 'repaso' : 'lee');
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Una misión ya hecha se abre en repaso; desde ahí, editar la respuesta vuelve al repaso.
  const [repasando, setRepasando] = useState(!!reg);
  const empezada = useRef(false);
  useEffect(() => {
    if (reg && paso === 'lee' && !empezada.current) {
      setPaso('repaso');
      setRepasando(true);
    }
  }, [!!reg]);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);
  // Los sellos que se ganen se celebran al final, no a mitad de la misión.
  useEffect(() => {
    if (paso === 'fin' || paso === 'repaso') celebrarMisiones();
  }, [paso]);
  useEffect(() => {
    if (!found) return;
    const { book, chapter } = found.mision;
    getChapter(book, chapter, settings.version)
      .catch(() => getChapter(book, chapter, 'bes'))
      .then(setVerses)
      .catch(() => setVerses([]));
  }, [found?.mision.id, settings.version]);

  const ir = (p: Paso) => {
    setPaso(p);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  if (!found) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={{ color: colors.muted }}>Esta misión no existe.</Text>
      </View>
    );
  }

  const { ruta, mision, indice } = found;
  const t = tinte(ruta, colors);
  const libro = books.find((b) => b.id === mision.book)?.name ?? '';
  const cita = `${libro} ${mision.chapter}:${mision.from}-${mision.to}`;
  const pasaje = (verses ?? []).filter(([n]) => n >= mision.from && n <= mision.to);

  return (
    <ScrollView ref={scroll} style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: ruta.titulo }} />

      {paso !== 'fin' && paso !== 'repaso' && <Pasos actual={paso} t={t} colors={colors} />}

      {paso === 'lee' && (
        <Appear key="lee">
          <Text style={[styles.kicker, { color: t.accent }]}>Misión {indice + 1} de {ruta.misiones.length}</Text>
          <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]}>{mision.titulo}</Text>
          <Text style={[styles.cita, { color: colors.muted }]}>{cita}</Text>
          <View style={[styles.gancho, { backgroundColor: t.soft }]}>
            <Text style={[styles.mini, { color: t.accent }]}>ANTES DE LEER</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{mision.gancho}</Text>
          </View>
          {mision.cuidado && <Cuidado colors={colors} />}
          <Pasaje verses={pasaje} cargando={verses === null} colors={colors} t={t} />
          <Boton
            label="Ya lo leí"
            t={t}
            onPress={() => {
              empezada.current = true;
              ir('entiende');
            }}
          />
          <Enlace
            label="Abrir el capítulo completo"
            colors={colors}
            onPress={() => navigate(() => router.push(chapterHref(mision.book, mision.chapter)), 'forward')}
          />
        </Appear>
      )}

      {paso === 'entiende' && (
        <Entiende
          key="entiende"
          ruta={ruta}
          mision={mision}
          verses={pasaje}
          colors={colors}
          t={t}
          onListo={async () => {
            await completar(ruta.id, mision.id);
            ir('piensa');
          }}
        />
      )}

      {paso === 'piensa' && (
        <Piensa
          key="piensa"
          mision={mision}
          inicial={reg?.respuesta ?? ''}
          colors={colors}
          t={t}
          onGuardar={async (texto) => {
            if (texto.trim() || reg?.respuesta) await responder(ruta.id, mision.id, texto);
            ir(repasando ? 'repaso' : 'vive');
          }}
        />
      )}

      {paso === 'vive' && (
        <Appear key="vive">
          <Text style={[styles.kicker, { color: t.accent }]}>Vívelo</Text>
          <Text style={[styles.titulo, { color: colors.text, fontFamily: serif, fontSize: 26 }]}>Tu reto de esta semana</Text>
          <View style={[styles.reto, { backgroundColor: t.soft }]}>
            <View style={styles.retoGlifo} aria-hidden>
              <IconoRuta icono={ruta.id} color={t.accent} size={120} strokeWidth={1.1} />
            </View>
            <Text style={{ color: colors.text, fontSize: 19, lineHeight: 28, fontFamily: serif }}>{mision.vive}</Text>
          </View>
          <Text style={[styles.ayuda, { color: colors.muted }]}>
            Te lo recordamos en Hoy durante la semana. Cuando lo vivas, márcalo y ganas la tercera estrella.
          </Text>
          <Boton label="Acepto el reto" t={t} onPress={() => ir('fin')} />
        </Appear>
      )}

      {paso === 'fin' && <Fin ruta={ruta} mision={mision} colors={colors} t={t} />}

      {paso === 'repaso' && reg && (
        <Appear key="repaso">
          <Text style={[styles.kicker, { color: t.accent }]}>Misión {indice + 1} · hecha</Text>
          <Text style={[styles.titulo, { color: colors.text, fontFamily: serif }]}>{mision.titulo}</Text>
          <Text style={[styles.cita, { color: colors.muted }]}>{cita}</Text>
          <View style={{ marginTop: 12 }}>
            <Estrellas n={estrellas(reg)} color={colors.warm} vacio={colors.border} size={22} />
          </View>
          <Pasaje verses={pasaje} cargando={verses === null} colors={colors} t={t} />

          <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.mini, { color: t.accent }]}>PIÉNSALO</Text>
            <Text style={{ color: colors.text, fontSize: 16, lineHeight: 23 }}>{mision.piensa}</Text>
            {reg.respuesta ? (
              <Text style={[styles.respuesta, { color: colors.text, borderColor: t.accent, fontFamily: serif }]}>{reg.respuesta}</Text>
            ) : null}
            <Enlace label={reg.respuesta ? 'Editar mi respuesta' : 'Escribir mi respuesta'} colors={colors} onPress={() => ir('piensa')} />
          </View>

          <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.mini, { color: t.accent }]}>TU RETO</Text>
            <Text style={{ color: colors.text, fontSize: 16, lineHeight: 23 }}>{mision.vive}</Text>
            <Pressable
              onPress={() => marcarReto(ruta.id, mision.id, !reg.hecho)}
              style={({ pressed }) => [styles.check, { borderColor: reg.hecho ? t.accent : colors.border, backgroundColor: reg.hecho ? t.soft : 'transparent' }, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              aria-checked={!!reg.hecho}
              testID="reto-hecho"
            >
              <View style={[styles.caja, { borderColor: t.accent, backgroundColor: reg.hecho ? t.accent : 'transparent' }]}>
                {reg.hecho && <CheckIcon color={t.soft} size={14} strokeWidth={2.6} />}
              </View>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{reg.hecho ? '¡Lo viví!' : 'Ya lo viví'}</Text>
            </Pressable>
          </View>

          <SiguienteBoton ruta={ruta} t={t} />
        </Appear>
      )}
    </ScrollView>
  );
}

function Pasos({ actual, t, colors }: { actual: Paso; t: Tinte; colors: Colors }) {
  const i = PASOS.findIndex((p) => p.id === actual);
  return (
    <View style={styles.pasos} accessibilityLabel={`Paso ${i + 1} de 4: ${PASOS[i].label}`}>
      {PASOS.map((p, j) => (
        <View key={p.id} style={{ flex: 1, gap: 6 }}>
          <View style={[styles.barra, { backgroundColor: j <= i ? t.accent : colors.border }]} />
          <Text style={{ color: j === i ? t.accent : colors.muted, fontSize: 12, fontWeight: j === i ? '800' : '600' }}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Pasaje({ verses, cargando, colors, t }: { verses: Verse[]; cargando: boolean; colors: Colors; t: Tinte }) {
  const { settings } = useSettings();
  return (
    <View style={[styles.pasaje, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {cargando ? (
        <Text style={{ color: colors.muted }}>Cargando el pasaje…</Text>
      ) : verses.length === 0 ? (
        <Text style={{ color: colors.muted }}>No se pudo cargar el pasaje. Ábrelo en la Biblia con el enlace de abajo.</Text>
      ) : (
        <Text style={{ color: colors.text, fontSize: settings.fontSize, lineHeight: settings.fontSize * 1.6, fontFamily: settings.font === 'serif' ? serif : undefined }}>
          {verses.map(([n, text]) => (
            <Text key={n}>
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{` ${n} `}</Text>
              {text}
            </Text>
          ))}
        </Text>
      )}
    </View>
  );
}

/** Las dos preguntas de comprensión. Una respuesta equivocada muestra el versículo donde está la correcta. */
function Entiende({ ruta, mision, verses, colors, t, onListo }: { ruta: Ruta; mision: Mision; verses: Verse[]; colors: Colors; t: Tinte; onListo: () => void }) {
  const [elegidas, setElegidas] = useState<(number | null)[]>([null, null]);
  const [fallos, setFallos] = useState<Set<string>>(new Set());
  const bien = elegidas.every((e) => e === 0);

  return (
    <Appear>
      <Text style={[styles.kicker, { color: t.accent }]}>¿Lo captaste?</Text>
      <Text style={[styles.titulo, { color: colors.text, fontFamily: serif, fontSize: 26 }]}>Dos preguntas sobre lo que leíste</Text>
      <Text style={[styles.ayuda, { color: colors.muted, marginTop: 6 }]}>Todas las respuestas están en el pasaje. Puedes intentar las veces que quieras.</Text>
      {mision.preguntas.map((p, qi) => {
        const ok = elegidas[qi] === 0;
        const verso = verses.find(([n]) => n === p.v);
        const fallo = elegidas[qi] !== null && !ok;
        return (
          <View key={qi} style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: ok ? t.accent : colors.border }]} testID={`pregunta-${qi}`}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 23 }}>{p.q}</Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {barajar(p.opciones, `${ruta.id}.${mision.id}.${qi}`).map(({ item, original }) => {
                const marcada = elegidas[qi] === original;
                const descartada = fallos.has(`${qi}.${original}`);
                return (
                  <Pressable
                    key={original}
                    disabled={ok}
                    onPress={() => {
                      setElegidas((e) => e.map((x, i) => (i === qi ? original : x)));
                      if (original !== 0) setFallos((f) => new Set(f).add(`${qi}.${original}`));
                    }}
                    style={({ pressed }) => [
                      styles.opcion,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      marcada && original === 0 && { borderColor: t.accent, backgroundColor: t.soft },
                      descartada && { opacity: 0.45 },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="radio"
                    aria-checked={marcada} aria-disabled={ok && !marcada}
                  >
                    <Text style={{ color: colors.text, fontSize: 15, flex: 1, lineHeight: 21, textDecorationLine: descartada ? 'line-through' : 'none' }}>{item}</Text>
                    {marcada && original === 0 && <CheckIcon color={t.accent} size={18} strokeWidth={2.4} />}
                  </Pressable>
                );
              })}
            </View>
            {fallo && (
              <Appear key={elegidas[qi]}>
                <View style={[styles.pista, { backgroundColor: colors.warmSoft }]}>
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
                    <Text style={{ fontWeight: '700' }}>Casi. </Text>Mira otra vez el versículo {p.v}:
                  </Text>
                  {verso && <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: serif, marginTop: 4 }}>«{verso[1]}»</Text>}
                </View>
              </Appear>
            )}
          </View>
        );
      })}
      <Boton label={bien ? '¡Bien! Continuar' : 'Responde las dos para seguir'} t={t} disabled={!bien} onPress={onListo} />
    </Appear>
  );
}

function Piensa({ mision, inicial, colors, t, onGuardar }: { mision: Mision; inicial: string; colors: Colors; t: Tinte; onGuardar: (texto: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <Appear>
      <Text style={[styles.kicker, { color: t.accent }]}>Piénsalo</Text>
      <Text style={[styles.pregunta, { color: colors.text, fontFamily: serif }]}>{mision.piensa}</Text>
      <Field
        value={texto}
        onChangeText={setTexto}
        placeholder="Escribe con tus palabras. Solo tú lo ves."
        multiline
        maxLength={MAX_RESPUESTA}
        style={{ minHeight: 140, fontSize: 16, lineHeight: 23 }}
        testID="respuesta"
      />
      <View style={styles.privado}>
        <PencilIcon color={colors.muted} size={14} />
        <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>Tu respuesta es privada: no se publica ni la ve tu grupo.</Text>
      </View>
      <Boton label={texto.trim() ? 'Guardar y seguir' : 'Seguir sin escribir'} t={t} onPress={() => onGuardar(texto)} />
      {!texto.trim() && (
        <Text style={[styles.ayuda, { color: colors.muted, textAlign: 'center' }]}>Si escribes tu respuesta ganas una estrella más.</Text>
      )}
    </Appear>
  );
}

function Fin({ ruta, mision, colors, t }: { ruta: Ruta; mision: Mision; colors: Colors; t: Tinte }) {
  const s = useJovenes();
  const reg = s[claveMision(ruta.id, mision.id)];
  const n = estrellas(reg);
  const [sube] = useState(() => new Animated.Value(0));
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) sube.setValue(1);
        else Animated.spring(sube, { toValue: 1, speed: 8, bounciness: 12, useNativeDriver: Platform.OS !== 'web' }).start();
      });
  }, [sube]);
  return (
    <View style={{ alignItems: 'center' }} testID="mision-cumplida">
      <Animated.View style={[styles.halo, { backgroundColor: t.soft, transform: [{ scale: sube }] }]}>
        <IconoRuta icono={ruta.id} color={t.accent} size={64} strokeWidth={1.6} />
      </Animated.View>
      <Text style={[styles.titulo, { color: colors.text, fontFamily: serif, textAlign: 'center', marginTop: 18 }]}>¡Misión cumplida!</Text>
      <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4, textAlign: 'center' }}>{mision.titulo}</Text>
      <View style={{ marginTop: 18 }}>
        <Estrellas n={n} color={colors.warm} vacio={colors.border} size={36} animar />
      </View>
      <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border, alignSelf: 'stretch' }]}>
        <Linea icon={<OpenBookIcon color={t.accent} size={18} />} on texto="Leíste y entendiste el pasaje" colors={colors} />
        <Linea icon={<PencilIcon color={n >= 2 ? t.accent : colors.muted} size={18} />} on={!!reg?.respuesta} texto={reg?.respuesta ? 'Escribiste lo que piensas' : 'Escribe tu respuesta cuando quieras'} colors={colors} />
        <Linea icon={<HeartIcon color={reg?.hecho ? t.accent : colors.muted} size={18} />} on={!!reg?.hecho} texto="Vive el reto y márcalo en Hoy" colors={colors} />
      </View>
      <View style={{ alignSelf: 'stretch' }}>
        <SiguienteBoton ruta={ruta} t={t} />
      </View>
    </View>
  );
}

function Linea({ icon, on, texto, colors }: { icon: React.ReactNode; on: boolean; texto: string; colors: Colors }) {
  return (
    <View style={styles.linea}>
      {icon}
      <Text style={{ color: on ? colors.text : colors.muted, fontSize: 15, flex: 1 }}>{texto}</Text>
      {on && <StarIcon filled color={colors.warm} size={16} />}
    </View>
  );
}

function SiguienteBoton({ ruta, t }: { ruta: Ruta; t: Tinte }) {
  const s = useJovenes();
  const next = siguiente(ruta, s);
  return next === null ? (
    <Boton label="Volver a la ruta" t={t} onPress={() => navigate(() => router.back(), 'back')} />
  ) : (
    <Boton
      label={`Siguiente: ${ruta.misiones[next].titulo} ›`}
      t={t}
      onPress={() => navigate(() => router.replace(`/jovenes/${ruta.id}/${ruta.misiones[next].id}` as never), 'forward')}
    />
  );
}

/** Aviso en los pasajes que tocan la tristeza profunda: a quién acudir, sin dramatizar. */
function Cuidado({ colors }: { colors: Colors }) {
  return (
    <View style={[styles.cuidado, { borderColor: colors.border, backgroundColor: colors.surface }]} testID="aviso-cuidado">
      <HeartIcon color={colors.warm} size={18} />
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 }}>
        Si alguna vez sientes que no quieres vivir, o la tristeza no se va, no lo cargues a solas: cuéntaselo hoy a tus papás, a tu líder o a
        un adulto de confianza. Si estás en peligro, llama a emergencias.
      </Text>
    </View>
  );
}

function Boton({ label, t, onPress, disabled }: { label: string; t: Tinte; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.boton, { backgroundColor: t.accent, opacity: disabled ? 0.4 : 1 }, pressed && styles.pressed]}
      accessibilityRole="button"
      aria-disabled={disabled}
    >
      <Text style={{ color: t.soft, fontWeight: '800', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

function Enlace({ label, colors, onPress }: { label: string; colors: Colors; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.enlace} accessibilityRole="link" hitSlop={6}>
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{label} ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, maxWidth: 640, width: '100%', alignSelf: 'center' },
  pasos: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  barra: { height: 5, borderRadius: 3 },
  kicker: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  mini: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  titulo: { fontSize: 30, marginTop: 6, lineHeight: 36 },
  cita: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  gancho: { borderRadius: 16, padding: 16, marginTop: 16 },
  pasaje: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 18, marginTop: 14 },
  tarjeta: { borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 14 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  pista: { borderRadius: 12, padding: 12, marginTop: 12 },
  pregunta: { fontSize: 23, lineHeight: 32, marginTop: 8, marginBottom: 16 },
  privado: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  reto: { borderRadius: 20, padding: 20, marginTop: 14, overflow: 'hidden', minHeight: 120 },
  retoGlifo: { position: 'absolute', right: -14, bottom: -18, opacity: 0.12 },
  ayuda: { fontSize: 13, lineHeight: 19, marginTop: 10 },
  respuesta: { fontSize: 16, lineHeight: 24, borderLeftWidth: 3, paddingLeft: 12, marginTop: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12, marginTop: 12 },
  caja: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cuidado: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  halo: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  boton: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  enlace: { alignSelf: 'center', paddingVertical: 12 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
