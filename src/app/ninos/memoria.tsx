import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, HeartIcon } from '@/components/icons';
import { BotonGrande, Escuchar } from '@/components/ninos/ui';
import { barajar } from '@/lib/jovenes';
import { useNarrador } from '@/lib/narrador';
import { celebrarNinos, memorizado, useNinos, versoDeLaSemana } from '@/lib/ninos';
import { MEMORIA, trozos, type Memoria } from '@/lib/ninosHistorias';
import { Colors, serif, useColors } from '@/lib/theme';

// Guardar un versículo en el corazón, en dos niveles: «Ordena» (los trozos del versículo, con el texto a la vista
// como guía) y «De memoria» (sin la guía y con dos trozos que no son del versículo). Al decirlo de memoria se gana
// el corazón del versículo. Tocar un trozo equivocado no castiga: solo no entra.

type Nivel = 1 | 2;

export default function MemoriaScreen() {
  const params = useLocalSearchParams<{ verso?: string }>();
  const colors = useColors();
  const s = useNinos();
  const semana = versoDeLaSemana();
  const [id, setId] = useState(params.verso && MEMORIA.some((m) => m.id === params.verso) ? params.verso : semana.id);
  const [nivel, setNivel] = useState<Nivel>(1);
  const verso = MEMORIA.find((m) => m.id === id)!;
  const n = useNarrador([`${verso.texto} ${verso.ref}.`]);

  const elegir = (m: Memoria) => {
    n.parar();
    setId(m.id);
    setNivel(1);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: '' }} />
      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.warmSoft }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.kicker, { color: colors.warm, flex: 1 }]}>{id === semana.id ? 'Versículo de la semana' : 'Versículo para guardar'}</Text>
            {s.memoria[id] && (
              <View style={[styles.guardado, { backgroundColor: colors.surface }]}>
                <HeartIcon color={colors.warm} size={14} />
                <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 12 }}>Guardado</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
            <Text style={[styles.texto, { color: colors.text, fontFamily: serif, flex: 1 }]}>«{verso.texto}»</Text>
            <Escuchar sonando={n.sonando} onPress={() => (n.sonando ? n.parar() : n.leer())} label="Escuchar el versículo" />
          </View>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 8, opacity: 0.8 }}>{verso.ref}</Text>
        </View>
      </Appear>

      <View style={[styles.niveles, { backgroundColor: colors.accentSoft }]} accessibilityRole="tablist">
        {([1, 2] as Nivel[]).map((nv) => (
          <Pressable
            key={nv}
            onPress={() => setNivel(nv)}
            style={[styles.nivel, nivel === nv && { backgroundColor: colors.surface }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: nivel === nv }}
            testID={`nivel-${nv}`}
          >
            <Text style={{ color: nivel === nv ? colors.text : colors.muted, fontWeight: '800', fontSize: 15 }}>{nv === 1 ? '1 · Ordena' : '2 · De memoria'}</Text>
          </Pressable>
        ))}
      </View>

      <Juego key={`${id}-${nivel}`} verso={verso} nivel={nivel} colors={colors} onNivel2={() => setNivel(2)} />

      <Text style={[styles.kicker, { color: colors.muted, marginTop: 30 }]}>Tus versículos · {Object.keys(s.memoria).length} de {MEMORIA.length} guardados</Text>
      <View style={styles.lista}>
        {MEMORIA.map((m) => {
          const activo = m.id === id;
          const ok = !!s.memoria[m.id];
          return (
            <Pressable
              key={m.id}
              onPress={() => elegir(m)}
              style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, borderColor: activo ? colors.warm : colors.border }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
            >
              <View style={[styles.corazon, { backgroundColor: ok ? colors.warm : colors.accentSoft }]}>
                <HeartIcon color={ok ? colors.surface : colors.muted} size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{m.ref}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                  {m.texto}
                </Text>
              </View>
              {m.id === semana.id && <Text style={{ color: colors.warm, fontSize: 12, fontWeight: '800' }}>ESTA SEMANA</Text>}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Juego({ verso, nivel, colors, onNivel2 }: { verso: Memoria; nivel: Nivel; colors: Colors; onNivel2: () => void }) {
  const partes = useMemo(() => trozos(verso.texto), [verso.texto]);
  // En el nivel 2 se cuelan dos trozos de otro versículo.
  const fichas = useMemo(() => {
    const otro = MEMORIA[(MEMORIA.findIndex((m) => m.id === verso.id) + 3) % MEMORIA.length];
    const extra = nivel === 2 ? barajar(trozos(otro.texto), verso.id).slice(0, 2).map((x) => x.item) : [];
    return barajar([...partes, ...extra], `${verso.id}.${nivel}`).map(({ item, original }) => ({ texto: item, orden: original < partes.length ? original : -1 }));
  }, [partes, nivel, verso.id]);
  const [puestas, setPuestas] = useState<number[]>([]);
  const [mal, setMal] = useState<number | null>(null);
  const listo = puestas.length === partes.length;

  useEffect(() => {
    if (!listo || nivel !== 2) return;
    memorizado(verso.id).then(celebrarNinos);
  }, [listo, nivel, verso.id]);
  useEffect(() => {
    if (mal === null) return;
    const t = setTimeout(() => setMal(null), 600);
    return () => clearTimeout(t);
  }, [mal]);

  const tocar = (i: number) => {
    // Un trozo repetido en el versículo vale en cualquiera de sus lugares.
    if (fichas[i].texto === partes[puestas.length]) setPuestas((p) => [...p, i]);
    else setMal(i);
  };

  return (
    <View style={[styles.juego, { backgroundColor: colors.surface, borderColor: listo ? colors.warm : colors.border }]} testID="juego-memoria">
      {nivel === 1 && !listo && <Text style={[styles.guia, { color: colors.muted, fontFamily: serif }]}>{verso.texto}</Text>}
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>
        {listo ? (nivel === 2 ? '¡Lo dijiste de memoria! 💛' : '¡Muy bien! Está en orden.') : nivel === 1 ? 'Toca los trozos en orden' : 'Sin mirar: toca los trozos en orden'}
      </Text>

      <View style={[styles.frase, { borderColor: colors.border }]}>
        {puestas.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 16 }}>Aquí se arma el versículo…</Text>
        ) : (
          puestas.map((i) => (
            <View key={i} style={[styles.puesta, { backgroundColor: colors.warmSoft }]}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>{fichas[i].texto}</Text>
            </View>
          ))
        )}
      </View>

      {!listo && (
        <View style={styles.fichas}>
          {fichas.map((f, i) =>
            puestas.includes(i) ? null : (
              <Pressable
                key={i}
                onPress={() => tocar(i)}
                style={({ pressed }) => [
                  styles.ficha,
                  { backgroundColor: colors.background, borderColor: mal === i ? '#D9534F' : colors.border },
                  mal === i && { transform: [{ rotate: '-3deg' }] },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={f.texto}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>{f.texto}</Text>
              </Pressable>
            ),
          )}
        </View>
      )}

      {listo && nivel === 1 && <BotonGrande label="Ahora, de memoria ›" onPress={onNivel2} testID="a-nivel-2" />}
      {listo && nivel === 2 && (
        <View style={[styles.hecho, { backgroundColor: colors.warmSoft }]}>
          <CheckIcon color={colors.warm} size={18} strokeWidth={2.6} />
          <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Guardaste {verso.ref} en tu corazón. ¡Dilo en voz alta a alguien de tu casa!</Text>
        </View>
      )}
      {puestas.length > 0 && !listo && (
        <Pressable onPress={() => setPuestas([])} style={styles.otraVez} accessibilityRole="button">
          <Text style={{ color: colors.muted, fontWeight: '700' }}>Empezar otra vez</Text>
        </Pressable>
      )}
      {listo && (
        <Pressable onPress={() => setPuestas([])} style={styles.otraVez} accessibilityRole="button">
          <Text style={{ color: colors.muted, fontWeight: '700' }}>Jugar otra vez</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 72, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: 26, padding: 20 },
  kicker: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  guardado: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  texto: { fontSize: 24, lineHeight: 34 },
  niveles: { flexDirection: 'row', borderRadius: 16, padding: 4, marginTop: 18 },
  nivel: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  juego: { borderRadius: 24, borderWidth: 2, padding: 18, marginTop: 14 },
  guia: { fontSize: 17, lineHeight: 25, marginBottom: 12, opacity: 0.8 },
  frase: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderWidth: 2, borderStyle: 'dashed', borderRadius: 18, padding: 12, marginTop: 12, minHeight: 64, alignItems: 'center' },
  puesta: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  ficha: { borderWidth: 2, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  hecho: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, marginTop: 16 },
  otraVez: { alignSelf: 'center', paddingVertical: 12, marginTop: 4 },
  lista: { gap: 10, marginTop: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1.5, padding: 12 },
  corazon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
