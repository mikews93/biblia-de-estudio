// El carrusel para Historias (solo web): las láminas dibujadas con el mismo canvas con que se comparten. Al tocar una
// se editan sus textos debajo; también se mueven, se quitan y se agregan otras (hasta 10, lo que deja Instagram).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconText } from '@/components/comunidad/ui';
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, PlusIcon, RefreshIcon, TrashIcon } from '@/components/icons';
import type { ImageLook, VerseToShare } from '@/lib/compartir';
import { GANCHOS, Lamina, MAX_LAMINAS, Tipo, drawLamina, hayFondo, nombreLamina, nuevaLamina, textoDe } from '@/lib/laminas';
import { useColors } from '@/lib/theme';

type Props = { verse: VerseToShare; look: ImageLook; laminas: Lamina[]; onChange: (l: Lamina[]) => void; alto: number };
type Campo = 'titulo' | 'texto' | 'nota';

/** Lo que se puede agregar, con lo que trae escrito para empezar. */
const NUEVAS: { tipo: Tipo; label: string; textos?: Partial<Lamina> }[] = [
  { tipo: 'texto', label: 'Texto libre' },
  { tipo: 'gancho', label: 'Pregunta', textos: { texto: GANCHOS[1] } },
  { tipo: 'cierre', label: '¿Qué te dice?' },
  { tipo: 'fondo', label: 'A fondo' },
];

/** Qué campos tiene cada lámina y cómo se llaman. */
const CAMPOS: Record<Tipo, { campo: Campo; label: string; placeholder: string; largo?: boolean; max: number }[]> = {
  gancho: [
    { campo: 'titulo', label: 'Línea de arriba', placeholder: 'Opcional, en mayúsculas pequeñas', max: 40 },
    { campo: 'texto', label: 'Pregunta', placeholder: 'Lo que hace que alguien quiera deslizar', max: 90 },
    { campo: 'nota', label: 'Línea de abajo', placeholder: 'Desliza  →', max: 40 },
  ],
  versiculo: [],
  fondo: [
    { campo: 'titulo', label: 'Título', placeholder: 'CONTEXTO', max: 40 },
    { campo: 'texto', label: 'Texto', placeholder: 'Una línea que ayude a entender el versículo', largo: true, max: 320 },
  ],
  cierre: [
    { campo: 'titulo', label: 'Línea de arriba', placeholder: 'Opcional', max: 40 },
    { campo: 'texto', label: 'Pregunta final', placeholder: '¿Qué te dice a ti?', largo: true, max: 120 },
    { campo: 'nota', label: 'Línea de abajo', placeholder: 'Respóndeme por mensaje', max: 80 },
  ],
  texto: [
    { campo: 'titulo', label: 'Título', placeholder: 'PARA PENSAR', max: 40 },
    { campo: 'texto', label: 'Texto', placeholder: 'Lo que quieras decir en esta lámina', largo: true, max: 320 },
    { campo: 'nota', label: 'Línea de abajo', placeholder: 'Opcional', max: 80 },
  ],
};

export default function Laminas({ verse, look, laminas, onChange, alto }: Props) {
  const colors = useColors();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [elegida, setElegida] = useState(laminas[0]?.id);
  const [agregando, setAgregando] = useState(false);
  const ancho = Math.round((Math.min(300, Math.max(200, alto * 0.3)) * 9) / 16);
  const i = Math.max(0, laminas.findIndex((l) => l.id === elegida));
  const actual = laminas[i];
  const lleno = laminas.length >= MAX_LAMINAS;
  const clave = JSON.stringify([look.fondo.name, look.letra.id, look.destacadas, look.dedicatoria, look.original, look.contexto, verse.text, verse.version, laminas]);

  useEffect(() => {
    let vivo = true;
    let hechas: string[] = [];
    // Se espera un poco: escribir no redibuja en cada letra. Mientras tanto se ven las de antes.
    const t = setTimeout(() => {
      Promise.all(laminas.map((l) => drawLamina(l, verse, look, laminas).catch(() => null)))
        .then((blobs) => {
          const nuevas: Record<string, string> = {};
          blobs.forEach((b, j) => {
            if (b) nuevas[laminas[j].id] = URL.createObjectURL(b);
          });
          hechas = Object.values(nuevas);
          if (vivo) setUrls(nuevas);
        });
    }, 280);
    return () => {
      vivo = false;
      clearTimeout(t);
      setTimeout(() => hechas.forEach((u) => URL.revokeObjectURL(u)), 2000);
    };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  const editar = (campo: Campo, valor: string) => onChange(laminas.map((l) => (l.id === actual.id ? { ...l, [campo]: valor } : l)));
  const restablecer = () => onChange(laminas.map((l) => (l.id === actual.id ? { id: l.id, tipo: l.tipo } : l)));
  const mover = (d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= laminas.length) return;
    const ls = [...laminas];
    [ls[i], ls[j]] = [ls[j], ls[i]];
    onChange(ls);
  };
  const quitar = () => {
    const ls = laminas.filter((l) => l.id !== actual.id);
    setElegida(ls[Math.min(i, ls.length - 1)]?.id);
    onChange(ls);
  };
  const agregar = (n: (typeof NUEVAS)[number]) => {
    const l = nuevaLamina(n.tipo, n.textos);
    onChange([...laminas.slice(0, i + 1), l, ...laminas.slice(i + 1)]);
    setElegida(l.id);
    setAgregando(false);
  };
  const opciones = NUEVAS.filter((n) => n.tipo !== 'fondo' || (hayFondo(look) && !laminas.some((l) => l.tipo === 'fondo')));
  const editada = actual && (['titulo', 'texto', 'nota'] as const).some((c) => actual[c] !== undefined);
  const esVersiculo = actual?.tipo === 'versiculo';

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.row}>
        {laminas.map((l, j) => {
          const on = l.id === actual?.id;
          return (
            <Pressable
              key={l.id}
              onPress={() => {
                setElegida(l.id);
                setAgregando(false);
              }}
              style={{ gap: 6, alignItems: 'center' }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Lámina ${j + 1}: ${nombreLamina[l.tipo]}${on ? ', elegida' : ''}`}
            >
              <View style={[styles.ring, { borderColor: on ? colors.warm : 'transparent' }]}>
                <View style={[styles.frame, { width: ancho, height: (ancho * 16) / 9, borderColor: colors.border, backgroundColor: look.fondo.background }]}>
                  {urls[l.id] ? <Image source={{ uri: urls[l.id] }} style={{ width: '100%', height: '100%' }} /> : <ActivityIndicator color={look.fondo.muted} />}
                </View>
              </View>
              <Text style={{ color: on ? colors.warm : colors.muted, fontSize: 12.5, fontWeight: on ? '800' : '600' }}>
                {j + 1}. {nombreLamina[l.tipo]}
              </Text>
            </Pressable>
          );
        })}
        {!lleno && (
          <Pressable
            onPress={() => setAgregando((a) => !a)}
            style={{ gap: 6, alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Agregar lámina"
          >
            <View style={[styles.ring, { borderColor: 'transparent' }]}>
              <View style={[styles.frame, styles.add, { width: ancho, height: (ancho * 16) / 9, borderColor: agregando ? colors.warm : colors.border }]}>
                <View style={[styles.addIcon, { backgroundColor: agregando ? colors.warmSoft : colors.background }]}>
                  <PlusIcon color={agregando ? colors.warm : colors.muted} size={22} />
                </View>
              </View>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }}>Agregar</Text>
          </Pressable>
        )}
      </ScrollView>

      {agregando && (
        <View style={[styles.box, { borderColor: colors.warm, backgroundColor: colors.background }]}>
          <Text style={[styles.boxTitle, { color: colors.text }]}>Agregar después de la lámina {i + 1}</Text>
          <View style={styles.chips}>
            {opciones.map((n) => (
              <Pressable key={n.tipo} onPress={() => agregar(n)} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityRole="button">
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13.5 }}>{n.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {actual && (
        <View style={[styles.box, { borderColor: colors.border }]}>
          <View style={styles.head}>
            <Text style={[styles.boxTitle, { color: colors.text, flex: 1 }]}>
              Lámina {i + 1} · {nombreLamina[actual.tipo]}
            </Text>
            <Pressable
              onPress={() => mover(-1)}
              disabled={i === 0}
              hitSlop={6}
              style={[styles.iconBtn, { borderColor: colors.border }, i === 0 && styles.off]}
              accessibilityRole="button"
              accessibilityLabel="Mover a la izquierda"
            >
              <ChevronLeftIcon color={colors.text} size={18} />
            </Pressable>
            <Pressable
              onPress={() => mover(1)}
              disabled={i === laminas.length - 1}
              hitSlop={6}
              style={[styles.iconBtn, { borderColor: colors.border }, i === laminas.length - 1 && styles.off]}
              accessibilityRole="button"
              accessibilityLabel="Mover a la derecha"
            >
              <ChevronRightIcon color={colors.text} size={18} />
            </Pressable>
            {!esVersiculo && (
              <Pressable
                onPress={quitar}
                hitSlop={6}
                style={[styles.iconBtn, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Quitar lámina"
              >
                <TrashIcon color={colors.text} size={17} />
              </Pressable>
            )}
          </View>

          {actual.tipo === 'versiculo' ? (
            <View style={styles.lock}>
              <LockIcon color={colors.muted} size={17} />
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, flex: 1 }}>
                El versículo no se edita: cámbiale el fondo, la letra o la dedicatoria abajo, o toca una palabra en «Publicación» para destacarla.
              </Text>
            </View>
          ) : (
            <>
              {CAMPOS[actual.tipo].map((c) => (
                <View key={c.campo} style={{ gap: 6 }}>
                  <Text style={[styles.label, { color: colors.muted }]}>{c.label}</Text>
                  <TextInput
                    value={textoDe(actual, c.campo, look)}
                    onChangeText={(t) => editar(c.campo, t)}
                    placeholder={c.placeholder}
                    placeholderTextColor={colors.muted}
                    maxLength={c.max}
                    multiline={c.largo}
                    style={[styles.input, c.largo && styles.largo, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    accessibilityLabel={`${c.label} de la lámina ${i + 1}`}
                  />
                </View>
              ))}
              {actual.tipo === 'gancho' && (
                <View style={styles.chips}>
                  {GANCHOS.map((g) => {
                    const on = g === textoDe(actual, 'texto');
                    return (
                      <Pressable
                        key={g}
                        onPress={() => editar('texto', g)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        aria-checked={on}
                        style={[styles.chip, { borderColor: on ? colors.warm : colors.border }, on && { backgroundColor: colors.warmSoft }]}
                      >
                        <Text style={{ color: on ? colors.warm : colors.text, fontWeight: on ? '700' : '500', fontSize: 13.5 }}>{g}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {actual.tipo === 'fondo' && look.original && (
                <Text style={[styles.hint, { color: colors.muted }]}>
                  La palabra {look.original.palabra} se cambia en la pestaña «Estudio».
                </Text>
              )}
              {editada && (
                <Pressable onPress={restablecer} hitSlop={6} style={{ alignSelf: 'flex-start' }} accessibilityRole="button">
                  <IconText icon={RefreshIcon} color={colors.accent} size={15}>
                    <Text style={{ color: colors.accent, fontWeight: '600' }}>Volver al texto de siempre</Text>
                  </IconText>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
      {!laminas.some((l) => l.tipo === 'fondo') && !hayFondo(look) && (
        <Text style={[styles.hint, { color: colors.muted }]}>En «Estudio» elige una palabra original o un contexto y se suma una lámina «A fondo».</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 12 },
  strip: { alignSelf: 'stretch', flexGrow: 0 },
  row: { gap: 8, paddingHorizontal: 4, flexGrow: 1, justifyContent: 'center' },
  ring: { borderWidth: 2.5, borderRadius: 13, padding: 2 },
  frame: { borderRadius: 9, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  add: { borderStyle: 'dashed', borderWidth: 1.5 },
  addIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
  box: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  boxTitle: { fontWeight: '700', fontSize: 15 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  lock: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  largo: { minHeight: 76, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
