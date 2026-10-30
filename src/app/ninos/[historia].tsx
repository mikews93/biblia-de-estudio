import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, HeartIcon, PauseIcon, PlayIcon } from '@/components/icons';
import { Estrellas } from '@/components/jovenes/arte';
import { BotonGrande, Cuadro, Escuchar } from '@/components/ninos/ui';
import { Verse, getChapter } from '@/lib/data';
import { barajar } from '@/lib/jovenes';
import { useNarrador } from '@/lib/narrador';
import { buscarHistoria, celebrarNinos, conversada, estrellasHistoria, siguienteHistoria, terminarHistoria, useNinos } from '@/lib/ninos';
import { HISTORIAS, type Historia, type PreguntaNinos } from '@/lib/ninosHistorias';
import { Colors, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

// Una historia en tres pasos: Mira (la ilustración y una entrada corta, que se puede escuchar), Escucha (los
// versículos en voz alta, iluminados mientras suenan) y Responde (dos preguntas con dos opciones grandes; si se
// equivoca, se escucha otra vez el versículo, sin castigo). Al final, las estrellas y una pregunta para conversar
// en familia: cuando un adulto la marca, llega la tercera estrella.

type Paso = 'mira' | 'escucha' | 'responde' | 'fin';
const PASOS: { id: Paso; label: string }[] = [
  { id: 'mira', label: 'Mira' },
  { id: 'escucha', label: 'Escucha' },
  { id: 'responde', label: 'Responde' },
];

export default function HistoriaScreen() {
  const { historia: id } = useLocalSearchParams<{ historia: string }>();
  const colors = useColors();
  const found = buscarHistoria(id);
  const [paso, setPaso] = useState<Paso>('mira');
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const book = found?.historia.book;
  const chapter = found?.historia.chapter;
  useEffect(() => {
    if (!book || !chapter) return;
    // Las historias se escuchan siempre en el Español Sencillo: las preguntas están escritas sobre ese texto.
    getChapter(book, chapter, 'bes')
      .then(setVerses)
      .catch(() => setVerses([]));
  }, [book, chapter]);
  useEffect(() => {
    if (paso === 'fin') celebrarNinos();
  }, [paso]);

  const ir = (p: Paso) => {
    setPaso(p);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  if (!found) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={{ color: colors.muted }}>Esta historia no existe.</Text>
      </View>
    );
  }

  const { historia, indice } = found;
  const pasaje = historia.versos.map((n) => (verses ?? []).find(([v]) => v === n)).filter((v): v is Verse => !!v);

  return (
    <ScrollView ref={scroll} style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: '' }} />
      {paso !== 'fin' && <Pasos actual={paso} colors={colors} />}

      {paso === 'mira' && <Mira key="mira" historia={historia} indice={indice} colors={colors} onSeguir={() => ir('escucha')} />}
      {paso === 'escucha' && <Escucha key="escucha" historia={historia} pasaje={pasaje} cargando={verses === null} colors={colors} onSeguir={() => ir('responde')} />}
      {paso === 'responde' && (
        <Responde
          key="responde"
          historia={historia}
          pasaje={pasaje}
          colors={colors}
          onListo={async () => {
            await terminarHistoria(historia.id);
            ir('fin');
          }}
        />
      )}
      {paso === 'fin' && <Fin historia={historia} colors={colors} />}
    </ScrollView>
  );
}

function Pasos({ actual, colors }: { actual: Paso; colors: Colors }) {
  const i = PASOS.findIndex((p) => p.id === actual);
  return (
    <View style={styles.pasos} accessibilityLabel={`Paso ${i + 1} de 3: ${PASOS[i].label}`}>
      {PASOS.map((p, j) => (
        <View key={p.id} style={styles.paso}>
          <View style={[styles.pasoPunto, { backgroundColor: j < i ? colors.warm : j === i ? colors.warmSoft : colors.accentSoft, borderColor: j <= i ? colors.warm : 'transparent' }]}>
            {j < i ? <CheckIcon color={colors.surface} size={14} strokeWidth={2.8} /> : <Text style={{ color: j === i ? colors.warm : colors.muted, fontWeight: '800', fontSize: 13 }}>{j + 1}</Text>}
          </View>
          <Text style={{ color: j === i ? colors.text : colors.muted, fontWeight: j === i ? '800' : '600', fontSize: 14 }}>{p.label}</Text>
          {j < PASOS.length - 1 && <View style={[styles.pasoLinea, { backgroundColor: j < i ? colors.warm : colors.border }]} />}
        </View>
      ))}
    </View>
  );
}

function Mira({ historia, indice, colors, onSeguir }: { historia: Historia; indice: number; colors: Colors; onSeguir: () => void }) {
  const n = useNarrador([`${historia.titulo}. ${historia.cuento}`]);
  return (
    <Appear>
      <Cuadro id={historia.id} titulo={historia.titulo} radio={28} />
      <Text style={[styles.kicker, { color: colors.warm, marginTop: 18 }]}>Historia {indice + 1} de {HISTORIAS.length}</Text>
      <View style={styles.tituloFila}>
        <Text style={[styles.titulo, { color: colors.text, fontFamily: serif, flex: 1 }]}>{historia.titulo}</Text>
        <Escuchar sonando={n.sonando} onPress={() => (n.sonando ? n.parar() : n.leer())} label="Escuchar la entrada" />
      </View>
      <Text style={[styles.cuento, { color: colors.text, backgroundColor: n.sonando ? colors.highlight : 'transparent' }]}>{historia.cuento}</Text>
      <BotonGrande label="Ahora, la Biblia ›" onPress={onSeguir} testID="a-la-biblia" />
    </Appear>
  );
}

function Escucha({ historia, pasaje, cargando, colors, onSeguir }: { historia: Historia; pasaje: Verse[]; cargando: boolean; colors: Colors; onSeguir: () => void }) {
  const n = useNarrador(pasaje.map(([, t]) => t));
  return (
    <Appear>
      <View style={styles.escuchaCabeza}>
        <Cuadro id={historia.id} radio={18} style={{ width: 92 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.warm }]}>La Biblia dice</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', fontFamily: serif, marginTop: 2 }}>{historia.titulo}</Text>
        </View>
      </View>
      <Pressable
        onPress={() => (n.sonando ? n.parar() : n.leer())}
        style={({ pressed }) => [styles.reproducir, { backgroundColor: n.sonando ? colors.warmSoft : colors.warm }, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="escuchar-historia"
      >
        <View style={[styles.reproducirIcono, { backgroundColor: n.sonando ? colors.warm : colors.surface }]}>
          {n.sonando ? <PauseIcon color={colors.surface} size={20} /> : <PlayIcon color={colors.warm} size={20} />}
        </View>
        <Text style={{ color: n.sonando ? colors.warm : colors.surface, fontWeight: '800', fontSize: 18 }}>{n.sonando ? 'Escuchando… (parar)' : 'Escuchar la historia'}</Text>
      </Pressable>
      <View style={[styles.pasaje, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {cargando ? (
          <Text style={{ color: colors.muted, fontSize: 17 }}>Cargando la historia…</Text>
        ) : pasaje.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 17 }}>No se pudo cargar. Revisa la conexión.</Text>
        ) : (
          pasaje.map(([v, t], i) => (
            <Pressable key={v} onPress={() => n.leer(i)} accessibilityRole="button" accessibilityHint="Escuchar desde aquí">
              <Text style={[styles.verso, { color: colors.text, backgroundColor: n.actual === i ? colors.highlight : 'transparent', fontFamily: serif }]}>
                <Text style={{ color: colors.warm, fontSize: 13, fontWeight: '800' }}>{v} </Text>
                {t}
              </Text>
            </Pressable>
          ))
        )}
      </View>
      <BotonGrande label="¡Ya la escuché! ›" onPress={onSeguir} testID="ya-la-escuche" />
    </Appear>
  );
}

/** Las dos preguntas. Una opción equivocada se aparta y se escucha otra vez el versículo de la respuesta. */
function Responde({ historia, pasaje, colors, onListo }: { historia: Historia; pasaje: Verse[]; colors: Colors; onListo: () => void }) {
  const [bien, setBien] = useState<boolean[]>([false, false]);
  const [fallos, setFallos] = useState<Set<string>>(new Set());
  const partes = historia.preguntas.map((p) => `${p.q} ¿${p.opciones[0].t}, o ${p.opciones[1].t}?`);
  const pistas = historia.preguntas.map((p) => pasaje.find(([v]) => v === p.v)?.[1] ?? '');
  const n = useNarrador([...partes, ...pistas]);
  const listo = bien.every(Boolean);

  return (
    <Appear>
      <Text style={[styles.kicker, { color: colors.warm }]}>¿Te acuerdas?</Text>
      <Text style={[styles.titulo, { color: colors.text, fontFamily: serif, fontSize: 26 }]}>Dos preguntas</Text>
      {historia.preguntas.map((p, qi) => (
        <Pregunta
          key={qi}
          p={p}
          semilla={`${historia.id}.${qi}`}
          ok={bien[qi]}
          descartadas={fallos}
          qi={qi}
          colors={colors}
          leyendo={n.actual === qi}
          pista={fallos.has(`${qi}.1`) && !bien[qi] ? pistas[qi] : null}
          onEscuchar={() => (n.actual === qi ? n.parar() : n.leer(qi, true))}
          onElegir={(original) => {
            if (original === 0) {
              n.parar();
              setBien((b) => b.map((x, i) => (i === qi ? true : x)));
            } else {
              setFallos((f) => new Set(f).add(`${qi}.${original}`));
              // Se escucha el versículo de la respuesta (las pistas van después de las preguntas).
              if (pistas[qi]) n.leer(partes.length + qi, true);
            }
          }}
        />
      ))}
      <BotonGrande label={listo ? '¡Muy bien! ›' : 'Responde las dos'} onPress={onListo} disabled={!listo} testID="terminar-historia" />
    </Appear>
  );
}

function Pregunta({
  p,
  semilla,
  ok,
  descartadas,
  qi,
  colors,
  leyendo,
  pista,
  onEscuchar,
  onElegir,
}: {
  p: PreguntaNinos;
  semilla: string;
  ok: boolean;
  descartadas: Set<string>;
  qi: number;
  colors: Colors;
  leyendo: boolean;
  pista: string | null;
  onEscuchar: () => void;
  onElegir: (original: number) => void;
}) {
  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: ok ? colors.warm : colors.border }]} testID={`pregunta-${qi}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', lineHeight: 26, flex: 1 }}>{p.q}</Text>
        <Escuchar sonando={leyendo} onPress={onEscuchar} size={44} label="Escuchar la pregunta" />
      </View>
      <View style={styles.opciones}>
        {barajar(p.opciones, semilla).map(({ item, original }) => {
          const correcta = ok && original === 0;
          const fuera = descartadas.has(`${qi}.${original}`);
          return (
            <Pressable
              key={original}
              disabled={ok || fuera}
              onPress={() => onElegir(original)}
              style={({ pressed }) => [
                styles.opcion,
                { borderColor: correcta ? colors.warm : colors.border, backgroundColor: correcta ? colors.warmSoft : colors.background },
                fuera && { opacity: 0.35 },
                ok && !correcta && { opacity: 0.35 },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              aria-selected={correcta} aria-disabled={ok || fuera}
              accessibilityLabel={item.t}
            >
              <Text style={styles.emoji} aria-hidden>
                {item.e}
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 21 }}>{item.t}</Text>
              {correcta && (
                <View style={[styles.marca, { backgroundColor: colors.warm }]}>
                  <CheckIcon color={colors.surface} size={14} strokeWidth={2.8} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {pista && (
        <Appear>
          <View style={[styles.pista, { backgroundColor: colors.warmSoft }]}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>¡Casi! Escucha otra vez:</Text>
            <Text style={{ color: colors.text, fontSize: 17, lineHeight: 25, fontFamily: serif, marginTop: 4 }}>«{pista}»</Text>
          </View>
        </Appear>
      )}
      {ok && <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 16, marginTop: 10, textAlign: 'center' }}>¡Sí! 🎉</Text>}
    </View>
  );
}

function Fin({ historia, colors }: { historia: Historia; colors: Colors }) {
  const s = useNinos();
  const reg = s.historias[historia.id];
  const n = estrellasHistoria(reg);
  const sig = siguienteHistoria(s);
  const [sube] = useState(() => new Animated.Value(0));
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) sube.setValue(1);
        else Animated.spring(sube, { toValue: 1, speed: 8, bounciness: 14, useNativeDriver: Platform.OS !== 'web' }).start();
      });
  }, [sube]);
  const proxima = sig !== null ? HISTORIAS[sig] : null;

  return (
    <View testID="historia-terminada">
      <Animated.View style={{ transform: [{ scale: sube }], alignItems: 'center' }}>
        <Cuadro id={historia.id} radio={28} style={{ width: '100%' }} />
      </Animated.View>
      <Text style={[styles.titulo, { color: colors.text, fontFamily: serif, textAlign: 'center', marginTop: 18 }]}>¡Muy bien!</Text>
      <Text style={{ color: colors.muted, fontSize: 16, textAlign: 'center', marginTop: 4 }}>Escuchaste «{historia.titulo}»</Text>
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Estrellas n={n} color={colors.warm} vacio={colors.border} size={44} animar />
      </View>

      <View style={[styles.familia, { backgroundColor: colors.surface, borderColor: reg?.familia ? colors.warm : colors.border }]} testID="para-hablar">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <HeartIcon color={colors.warm} size={20} />
          <Text style={[styles.kicker, { color: colors.warm }]}>Para hablar en familia</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 19, lineHeight: 27, fontFamily: serif, marginTop: 10 }}>{historia.familia}</Text>
        <Pressable
          onPress={() => conversada(historia.id, !reg?.familia)}
          style={({ pressed }) => [styles.check, { borderColor: reg?.familia ? colors.warm : colors.border, backgroundColor: reg?.familia ? colors.warmSoft : 'transparent' }, pressed && styles.pressed]}
          accessibilityRole="checkbox"
          aria-checked={!!reg?.familia}
          testID="lo-hablamos"
        >
          <View style={[styles.caja, { borderColor: colors.warm, backgroundColor: reg?.familia ? colors.warm : 'transparent' }]}>
            {reg?.familia && <CheckIcon color={colors.surface} size={16} strokeWidth={2.8} />}
          </View>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{reg?.familia ? '¡Lo hablamos en familia!' : 'Lo hablamos en familia'}</Text>
          <Text style={{ color: colors.warm, fontWeight: '800' }}>+1 ⭐</Text>
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>Que lo marque un adulto, después de conversar.</Text>
      </View>

      {proxima ? (
        <BotonGrande label={`Siguiente: ${proxima.titulo} ›`} onPress={() => navigate(() => router.replace(`/ninos/${proxima.id}` as never), 'forward')} />
      ) : (
        <BotonGrande label="Volver al camino" onPress={() => navigate(() => router.back(), 'back')} />
      )}
      <BotonGrande label="Ir al camino de historias" kind="suave" onPress={() => navigate(() => router.dismissTo('/ninos' as never), 'back')} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 72, maxWidth: 640, width: '100%', alignSelf: 'center' },
  pasos: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  paso: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pasoPunto: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pasoLinea: { flex: 1, height: 3, borderRadius: 2, marginHorizontal: 4 },
  kicker: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  titulo: { fontSize: 32, lineHeight: 38, marginTop: 4 },
  cuento: { fontSize: 21, lineHeight: 32, marginTop: 12, borderRadius: 10 },
  escuchaCabeza: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  reproducir: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 26, padding: 8, paddingRight: 20, marginTop: 18, alignSelf: 'flex-start' },
  reproducirIcono: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pasaje: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginTop: 16, gap: 6 },
  verso: { fontSize: 21, lineHeight: 33, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tarjeta: { borderRadius: 22, borderWidth: 2, padding: 16, marginTop: 16 },
  opciones: { flexDirection: 'row', gap: 12, marginTop: 14 },
  opcion: { flex: 1, borderWidth: 2, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', gap: 8, minHeight: 120, justifyContent: 'center' },
  emoji: { fontSize: 40, lineHeight: 48 },
  marca: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pista: { borderRadius: 14, padding: 14, marginTop: 12 },
  familia: { borderRadius: 22, borderWidth: 2, padding: 18, marginTop: 22 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: 16, padding: 14, marginTop: 14 },
  caja: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
