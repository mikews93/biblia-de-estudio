// El carrusel para Historias (solo web). Arriba, la tira de láminas (dibujadas con el mismo canvas con que se
// comparten) para elegir, ordenar y agregar. Debajo, la lámina elegida en grande: sus textos se escriben ahí mismo,
// sobre el dibujo, con la letra y los colores que va a tener la imagen.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextStyle, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { IconText } from '@/components/comunidad/ui';
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, PencilIcon, PlusIcon, RefreshIcon, TrashIcon } from '@/components/icons';
import { IMAGE_SIZE, ImageLook, VerseToShare, caption } from '@/lib/compartir';
import { LETRA_DEDICATORIA, idsUnicos, useLetras } from '@/lib/fondos';
import { GANCHOS, Lamina, MAX_LAMINAS, Tipo, drawLamina, hayFondo, nombreLamina, nuevaLamina, textoDe } from '@/lib/laminas';
import { sans, serif, useColors } from '@/lib/theme';

type Props = { verse: VerseToShare; look: ImageLook; laminas: Lamina[]; onChange: (l: Lamina[]) => void; alto: number };
type Campo = 'titulo' | 'texto' | 'nota';

/** Lo que se puede agregar, con lo que trae escrito para empezar. */
const NUEVAS: { tipo: Tipo; label: string; textos?: Partial<Lamina> }[] = [
  { tipo: 'texto', label: 'Texto libre' },
  { tipo: 'gancho', label: 'Pregunta', textos: { texto: GANCHOS[1] } },
  { tipo: 'cierre', label: '¿Qué te dice?' },
  { tipo: 'fondo', label: 'A fondo' },
];

/** Cómo se llama cada texto de cada lámina (para leerlo en voz alta) y qué se ve mientras está vacío. */
const CAMPOS: Record<Tipo, Partial<Record<Campo, { label: string; vacio: string; max: number }>>> = {
  gancho: {
    titulo: { label: 'Línea de arriba', vacio: '+ línea de arriba', max: 40 },
    texto: { label: 'Pregunta', vacio: 'Escribe la pregunta', max: 90 },
    nota: { label: 'Línea de abajo', vacio: '+ línea de abajo', max: 40 },
  },
  versiculo: {},
  fondo: {
    titulo: { label: 'Título', vacio: 'CONTEXTO', max: 40 },
    texto: { label: 'Texto', vacio: 'Escribe una línea que ayude a entender el versículo', max: 320 },
  },
  cierre: {
    titulo: { label: 'Línea de arriba', vacio: '+ línea de arriba', max: 40 },
    texto: { label: 'Pregunta final', vacio: 'Escribe la pregunta final', max: 120 },
    nota: { label: 'Línea de abajo', vacio: '+ línea de abajo', max: 80 },
  },
  texto: {
    titulo: { label: 'Título', vacio: '+ título', max: 40 },
    texto: { label: 'Texto', vacio: 'Escribe aquí lo que quieras decir', max: 320 },
    nota: { label: 'Línea de abajo', vacio: '+ línea de abajo', max: 80 },
  },
};

export default function Laminas({ verse, look, laminas, onChange, alto }: Props) {
  const colors = useColors();
  const { width: pantalla } = useWindowDimensions();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [elegida, setElegida] = useState(laminas[0]?.id);
  const [agregando, setAgregando] = useState(false);
  const i = Math.max(0, laminas.findIndex((l) => l.id === elegida));
  const actual = laminas[i];
  const lleno = laminas.length >= MAX_LAMINAS;
  // La lámina grande ocupa lo que deja la pantalla; las de la tira son pequeñas, solo para elegir y ordenar.
  const grande = Math.round(Math.min(330, pantalla - 72, (alto * 0.56 * 9) / 16));
  const mini = 58;
  // Lo que ocupa cada lámina en la tira: la lámina, su anillo (2 + 2 a cada lado) y el espacio entre ellas.
  const paso = mini + 8 + 6;
  const { setTira, arrastrada, corrimiento } = useArrastre(laminas, paso, (de, a) => {
    const ls = [...laminas];
    const [l] = ls.splice(de, 1);
    ls.splice(a, 0, l);
    setElegida(l.id);
    onChange(ls);
  });
  const clave = JSON.stringify([look.fondo.name, look.letra.id, look.destacadas, look.dedicatoria, look.original, look.contexto, verse.text, verse.version, laminas]);

  useEffect(() => {
    let vivo = true;
    let hechas: string[] = [];
    // Se espera un poco: escribir no redibuja en cada letra. Mientras tanto se ven las de antes.
    const t = setTimeout(() => {
      Promise.all(laminas.map((l) => drawLamina(l, verse, look, laminas).catch(() => null))).then((blobs) => {
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
  const boton = (label: string, Icono: typeof TrashIcon, onPress: () => void, off = false) => (
    <Pressable
      onPress={onPress}
      disabled={off}
      hitSlop={6}
      style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }, off && styles.off]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icono color={colors.text} size={18} />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View ref={(n) => setTira(n as unknown as HTMLElement | null)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.row}>
        {laminas.map((l, j) => {
          const on = l.id === actual?.id;
          const movida = arrastrada?.id === l.id;
          return (
            <Pressable
              key={l.id}
              nativeID={`lamina-${l.id}`}
              onPress={() => {
                setElegida(l.id);
                setAgregando(false);
              }}
              style={[
                { gap: 4, alignItems: 'center' },
                arrastrada && { transform: [{ translateX: movida ? arrastrada.dx : corrimiento(j) }, { scale: movida ? 1.08 : 1 }] },
                movida && styles.levantada,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Lámina ${j + 1}: ${nombreLamina[l.tipo]}${on ? ', elegida' : ''}`}
            >
              <View style={[styles.ring, { borderColor: on ? colors.warm : 'transparent' }]}>
                <View style={[styles.frame, { width: mini, height: (mini * 16) / 9, borderColor: colors.border, backgroundColor: look.fondo.background }]}>
                  {urls[l.id] ? <Image source={{ uri: urls[l.id] }} style={{ width: '100%', height: '100%' }} /> : <ActivityIndicator size="small" color={look.fondo.muted} />}
                </View>
              </View>
              <Text style={{ color: on ? colors.warm : colors.muted, fontSize: 11.5, fontWeight: on ? '800' : '600' }}>{j + 1}</Text>
            </Pressable>
          );
        })}
        {!lleno && (
          <Pressable onPress={() => setAgregando((a) => !a)} style={{ gap: 4, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel="Agregar lámina">
            <View style={[styles.ring, { borderColor: 'transparent' }]}>
              <View
                style={[
                  styles.frame,
                  styles.add,
                  { width: mini, height: (mini * 16) / 9, borderColor: agregando ? colors.warm : colors.border, backgroundColor: agregando ? colors.warmSoft : 'transparent' },
                ]}
              >
                <PlusIcon color={agregando ? colors.warm : colors.muted} size={20} />
              </View>
            </View>
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '600' }}>Agregar</Text>
          </Pressable>
        )}
        </ScrollView>
      </View>
      {Platform.OS === 'web' && laminas.length > 1 && !arrastrada && (
        <Text style={[styles.hint, { color: colors.muted, marginTop: -6 }]}>Arrastra una lámina para cambiarla de lugar</Text>
      )}

      {agregando && (
        <View style={[styles.menu, { borderColor: colors.warm, backgroundColor: colors.background }]}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Agregar después de la lámina {i + 1}</Text>
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
        <View style={styles.stage}>
          <View style={styles.stageHead}>
            <Text style={[styles.stageTitle, { color: colors.text }]}>
              Lámina {i + 1} · {nombreLamina[actual.tipo]}
            </Text>
            {boton('Mover a la izquierda', ChevronLeftIcon, () => mover(-1), i === 0)}
            {boton('Mover a la derecha', ChevronRightIcon, () => mover(1), i === laminas.length - 1)}
            {!esVersiculo && boton('Quitar lámina', TrashIcon, quitar)}
          </View>

          {esVersiculo ? (
            <View style={[styles.frame, styles.big, { width: grande, height: (grande * 16) / 9, borderColor: colors.border, backgroundColor: look.fondo.background }]}>
              {urls[actual.id] ? <Image source={{ uri: urls[actual.id] }} style={{ width: '100%', height: '100%' }} /> : <ActivityIndicator color={look.fondo.muted} />}
            </View>
          ) : (
            <LaminaEditable key={actual.id} lamina={actual} n={i + 1} verse={verse} look={look} width={grande} borde={colors.border} onEdit={editar} />
          )}

          {esVersiculo ? (
            <View style={styles.lock}>
              <LockIcon color={colors.muted} size={16} />
              <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, flex: 1 }}>
                El versículo no se edita: cámbiale el fondo, la letra o la dedicatoria abajo, o toca una palabra en «Publicación» para destacarla.
              </Text>
            </View>
          ) : (
            <View style={styles.tip}>
              <PencilIcon color={colors.muted} size={14} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>Toca el texto de la lámina para cambiarlo</Text>
            </View>
          )}

          {actual.tipo === 'gancho' && (
            <View style={[styles.chips, { justifyContent: 'center' }]}>
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
            <Text style={[styles.hint, { color: colors.muted }]}>La palabra {look.original.palabra} se cambia en la pestaña «Estudio».</Text>
          )}
          {editada && (
            <Pressable onPress={restablecer} hitSlop={6} style={{ alignSelf: 'center' }} accessibilityRole="button">
              <IconText icon={RefreshIcon} color={colors.accent} size={15}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Volver al texto de siempre</Text>
              </IconText>
            </Pressable>
          )}
        </View>
      )}
      {!laminas.some((l) => l.tipo === 'fondo') && !hayFondo(look) && (
        <Text style={[styles.hint, { color: colors.muted }]}>En «Estudio» elige una palabra original o un contexto y se suma una lámina «A fondo».</Text>
      )}
    </View>
  );
}

/**
 * Cambiar de lugar las láminas arrastrándolas en la tira (solo web). Con el mouse basta moverla; con el dedo se deja
 * un momento encima (si no, el gesto es para desplazar la tira).
 */
function useArrastre(laminas: Lamina[], paso: number, mover: (de: number, a: number) => void) {
  const [tira, setTira] = useState<HTMLElement | null>(null);
  const [arrastrada, setArrastrada] = useState<{ id: string; dx: number } | null>(null);
  const gesto = useRef<{ id: string; x: number; activo: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const ultimo = useRef({ laminas, paso, mover });
  useEffect(() => {
    ultimo.current = { laminas, paso, mover };
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !tira) return;
    const activar = (e: PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      g.activo = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      navigator.vibrate?.(12);
      setArrastrada({ id: g.id, dx: e.clientX - g.x });
    };
    const abajo = (e: PointerEvent) => {
      const nodo = (e.target as Element).closest?.('[id^="lamina-"]');
      if (!nodo || e.button > 0) return;
      gesto.current = { id: nodo.id.slice('lamina-'.length), x: e.clientX, activo: false };
      if (e.pointerType !== 'mouse') gesto.current.timer = setTimeout(() => activar(e), 300);
    };
    const mueve = (e: PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      const dx = e.clientX - g.x;
      if (!g.activo) {
        if (e.pointerType === 'mouse' && Math.abs(dx) > 6) activar(e);
        else if (e.pointerType !== 'mouse' && Math.abs(dx) > 10) {
          clearTimeout(g.timer);
          gesto.current = null;
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setArrastrada({ id: g.id, dx });
    };
    const soltar = (x: number) => {
      const g = gesto.current;
      gesto.current = null;
      if (!g) return;
      clearTimeout(g.timer);
      if (!g.activo) return;
      setArrastrada(null);
      const { laminas: ls, paso: p, mover: m } = ultimo.current;
      const de = ls.findIndex((l) => l.id === g.id);
      const a = Math.max(0, Math.min(ls.length - 1, de + Math.round((x - g.x) / p)));
      if (de >= 0 && a !== de) m(de, a);
    };
    const arriba = (e: PointerEvent) => {
      // Al soltar con el mouse el navegador manda un clic, que no debe elegir otra lámina.
      if (gesto.current?.activo && e.pointerType === 'mouse') {
        const tragar = (c: Event) => {
          c.stopPropagation();
          c.preventDefault();
        };
        window.addEventListener('click', tragar, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', tragar, { capture: true }), 0);
      }
      soltar(e.clientX);
    };
    const cancela = (e: PointerEvent) => {
      // Con el dedo, el navegador cancela el puntero al ver que se mueve; el arrastre sigue con los toques.
      if (gesto.current?.activo && e.pointerType !== 'mouse') return;
      clearTimeout(gesto.current?.timer);
      gesto.current = null;
      setArrastrada(null);
    };
    // Se escucha en la captura: los Pressable de dentro no dejan subir los toques.
    // Mientras se arrastra con el dedo, la tira no se desplaza ni sale el menú de la imagen.
    const quieto = (e: Event) => {
      if (gesto.current?.activo) e.preventDefault();
    };
    const toque = (e: TouchEvent) => {
      const g = gesto.current;
      if (!g?.activo) return;
      e.preventDefault();
      e.stopPropagation();
      setArrastrada({ id: g.id, dx: e.touches[0].clientX - g.x });
    };
    const finToque = (e: TouchEvent) => {
      if (gesto.current?.activo) soltar(e.changedTouches[0].clientX);
    };
    tira.addEventListener('pointerdown', abajo, true);
    tira.addEventListener('pointermove', mueve, true);
    tira.addEventListener('pointerup', arriba, true);
    tira.addEventListener('pointercancel', cancela, true);
    tira.addEventListener('touchmove', toque, { passive: false, capture: true });
    tira.addEventListener('touchend', finToque, true);
    tira.addEventListener('contextmenu', quieto, true);
    return () => {
      tira.removeEventListener('pointerdown', abajo, true);
      tira.removeEventListener('pointermove', mueve, true);
      tira.removeEventListener('pointerup', arriba, true);
      tira.removeEventListener('pointercancel', cancela, true);
      tira.removeEventListener('touchmove', toque, true);
      tira.removeEventListener('touchend', finToque, true);
      tira.removeEventListener('contextmenu', quieto, true);
    };
  }, [tira]);

  /** Cuánto se corre una lámina para dejarle sitio a la que se arrastra. */
  const corrimiento = (j: number) => {
    if (!arrastrada) return 0;
    const de = laminas.findIndex((l) => l.id === arrastrada.id);
    const a = Math.max(0, Math.min(laminas.length - 1, de + Math.round(arrastrada.dx / paso)));
    if (de < a && j > de && j <= a) return -paso;
    if (de > a && j >= a && j < de) return paso;
    return 0;
  };
  return { setTira, arrastrada, corrimiento };
}

/** El tamaño de la letra grande para que quepa, como lo calcula el canvas (src/lib/laminas.ts), a ojo. */
function tamaño(texto: string, base: number, ancho: number, alto: number, interlinea: number) {
  let size = base;
  for (; size > 40; size -= 4) {
    const porLinea = Math.max(1, Math.floor(ancho / (size * 0.5)));
    const lineas = texto.split('\n').reduce((n, p) => n + Math.max(1, Math.ceil(p.length / porLinea)), 0);
    if (lineas * size * interlinea <= alto) break;
  }
  return size;
}

type EditableProps = { lamina: Lamina; n: number; verse: VerseToShare; look: ImageLook; width: number; borde: string; onEdit: (c: Campo, v: string) => void };

/** Una lámina dibujada con vistas a escala, con sus textos escribibles en su sitio. */
function LaminaEditable({ lamina: l, n, verse, look, width, borde, onEdit }: EditableProps) {
  const { fondo, letra } = look;
  const { width: W, height: H } = IMAGE_SIZE.historia;
  const s = width / W;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const xml = useMemo(() => (fondo.svg ? idsUnicos(fondo.svg(W, H), `e${id}`) : null), [fondo, W, H, id]);
  const letras = useLetras();
  const [altos, setAltos] = useState<Partial<Record<Campo, number>>>({});
  const family = letra.family ?? serif;
  const sombra: TextStyle = fondo.sombra ? { textShadowColor: fondo.sombra, textShadowRadius: 18 * s, textShadowOffset: { width: 0, height: 2 * s } } : {};
  const campos = CAMPOS[l.tipo];
  const dedic = l.tipo === 'gancho' ? look.dedicatoria?.trim() : '';

  const texto = textoDe(l, 'texto', look);
  const base = l.tipo === 'gancho' ? 110 : l.tipo === 'cierre' ? 120 : texto.length > 120 ? 70 : 92;
  const grande = l.tipo === 'fondo' ? (look.original ? 46 : 64) : tamaño(texto || 'x', Math.round(base * letra.escala), 840, l.tipo === 'gancho' ? 700 : 900, letra.interlinea);

  /** Un texto de la lámina que se escribe en su sitio: el campo no se nota hasta que se toca. */
  const campo = (c: Campo, estilo: TextStyle, multiline = false) => {
    const def = campos[c];
    if (!def) return null;
    const valor = textoDe(l, c, look);
    return (
      <TextInput
        value={valor}
        onChangeText={(t) => onEdit(c, t)}
        placeholder={def.vacio}
        placeholderTextColor={fondo.muted}
        maxLength={def.max}
        multiline={multiline}
        onContentSizeChange={multiline ? (e) => setAltos((a) => ({ ...a, [c]: e.nativeEvent.contentSize.height })) : undefined}
        accessibilityLabel={`${def.label} de la lámina ${n}`}
        style={[
          styles.editable,
          { outlineWidth: 0 },
          sombra,
          estilo,
          multiline && altos[c] ? { height: altos[c] } : null,
          !valor && { opacity: 0.8 },
        ]}
      />
    );
  };
  const kicker = (c: Campo) =>
    campo(c, { color: fondo.accent, fontFamily: sans, fontWeight: '800', fontSize: 34 * s, letterSpacing: 3 * s, textTransform: 'uppercase', paddingVertical: 4 * s });
  const notaEstilo: TextStyle = { color: fondo.muted, fontFamily: sans, fontWeight: l.tipo === 'gancho' ? '600' : '400', fontSize: 40 * s, marginTop: 50 * s };

  return (
    <View key={letras ? 'letras' : 'sistema'} style={[styles.frame, styles.big, { width, height: H * s, backgroundColor: fondo.background, borderColor: borde }]}>
      {xml && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgXml xml={xml} width="100%" height="100%" />
        </View>
      )}
      <View style={[styles.slideBody, { paddingHorizontal: 110 * s, paddingBottom: 200 * s }]}>
        {dedic ? (
          <Text style={[{ color: fondo.accent, fontFamily: LETRA_DEDICATORIA, fontSize: 64 * s, textAlign: 'center', marginBottom: 20 * s }, sombra]}>{dedic}</Text>
        ) : null}
        {l.tipo === 'fondo' ? (
          <>
            {look.original && (
              <View style={{ alignItems: 'center', marginBottom: 60 * s }}>
                <Text style={[{ color: fondo.accent, fontFamily: sans, fontWeight: '800', fontSize: 34 * s, letterSpacing: 3 * s }, sombra]}>EN EL ORIGINAL</Text>
                <Text style={[{ color: fondo.text, fontFamily: serif, fontSize: 150 * s, marginTop: 30 * s }, sombra]}>{look.original.palabra}</Text>
                <Text style={[{ color: fondo.muted, fontFamily: serif, fontStyle: 'italic', fontSize: 52 * s }, sombra]}>{look.original.translit}</Text>
                <Text style={[{ color: fondo.accent, fontFamily: family, fontSize: 68 * letra.escala * s, marginTop: 10 * s }, sombra]}>«{look.original.glosa}»</Text>
              </View>
            )}
            {kicker('titulo')}
            {campo('texto', { color: fondo.text, fontFamily: serif, fontStyle: 'italic', fontSize: grande * s, lineHeight: grande * 1.4 * s, marginTop: 30 * s }, true)}
          </>
        ) : (
          <>
            {kicker('titulo')}
            <View style={{ width: 72 * s, height: Math.max(1.5, 4 * s), backgroundColor: fondo.accent, marginVertical: 22 * s, alignSelf: 'center' }} />
            {campo(
              'texto',
              {
                color: fondo.text,
                fontFamily: family,
                fontSize: grande * s,
                lineHeight: grande * letra.interlinea * s,
                textTransform: letra.mayusculas ? 'uppercase' : 'none',
              },
              true,
            )}
            {campo('nota', notaEstilo, l.tipo !== 'gancho')}
            {l.tipo === 'cierre' && (
              <Text style={[{ color: fondo.accent, fontFamily: sans, fontWeight: '700', fontSize: 40 * s, marginTop: 70 * s, textAlign: 'center' }, sombra]}>{caption(verse)}</Text>
            )}
          </>
        )}
      </View>
      <Text style={[styles.site, { color: fondo.muted, fontSize: 28 * s, bottom: (250 - 28) * s }]}>zarzabiblia.com</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 12 },
  strip: { alignSelf: 'stretch', flexGrow: 0 },
  row: { gap: 6, paddingHorizontal: 4, flexGrow: 1, justifyContent: 'center' },
  ring: { borderWidth: 2, borderRadius: 10, padding: 2 },
  frame: { borderRadius: 7, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  big: { borderRadius: 16, alignSelf: 'center' },
  add: { borderStyle: 'dashed', borderWidth: 1.5 },
  menu: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  menuTitle: { fontWeight: '700', fontSize: 15 },
  stage: { gap: 12 },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stageTitle: { fontWeight: '700', fontSize: 15, flex: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  levantada: { zIndex: 2, opacity: 0.92 },
  lock: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4 },
  tip: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  slideBody: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  editable: { padding: 0, margin: 0, borderWidth: 0, backgroundColor: 'transparent', textAlign: 'center', alignSelf: 'stretch' },
  site: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: sans },
});
