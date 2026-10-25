import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { IconText } from '@/components/comunidad/ui';
import { CommentaryIcon, PeopleIcon, SparkIcon } from '@/components/icons';
import EnviarAmigo from '@/components/EnviarAmigo';
import Laminas from '@/components/Laminas';
import VerseArt from '@/components/VerseArt';
import {
  IMAGE_SIZE,
  ImageFormat,
  MAX_CONTEXTO,
  ImageLook,
  PalabraOriginal,
  VerseToShare,
  datosDeImagen,
  downloadImage,
  drawVerseImage,
  shareImageOnWeb,
  shareVerse,
} from '@/lib/compartir';
import { useAccount } from '@/lib/comunidad';
import { getContexto } from '@/lib/comentarios';
import { getInterlinear, Word } from '@/lib/data';
import { DEDICATORIAS, FONDOS, Fondo, LETRAS, Letra, fondoPorNombre, idsUnicos, letraPorId, useLetras } from '@/lib/fondos';
import { GANCHOS, compartirLaminas, drawLaminas, laminasDe } from '@/lib/laminas';
import { huella } from '@/lib/sellos';
import { highlightOf } from '@/lib/highlights';
import { Audiencia, publish } from '@/lib/social';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Props = {
  verse: VerseToShare;
  onClose: () => void;
  /** Cómo empieza la imagen (por ejemplo, desde una ocasión o un sermón): fondo, letra y dedicatoria. */
  inicial?: { fondo?: string; letra?: string; dedicatoria?: string };
};

type Pestaña = 'fondo' | 'letra' | 'dedicar' | 'estudio';
const PESTAÑAS: { id: Pestaña; label: string }[] = [
  { id: 'fondo', label: 'Fondo' },
  { id: 'letra', label: 'Letra' },
  { id: 'dedicar', label: 'Dedicar' },
  { id: 'estudio', label: 'Estudio' },
];

// Palabras que no vale la pena poner al pie (artículos, conjunciones, preposiciones).
const MORFOLOGIA_MENOR = /^(T-|CONJ|PREP|PRT|COND|ART|H(C|R|T|Td|Tr)\b)/;

/** Las palabras hebreas o griegas del versículo que se pueden poner al pie, sin repetir. */
export function palabrasOriginales(words: Word[] | undefined): PalabraOriginal[] {
  const vistas = new Set<string>();
  const out: PalabraOriginal[] = [];
  for (const w of words ?? []) {
    const [palabra, translit, glosa, , , , strong, morfo] = w;
    const g = glosa?.replace(/[[\]<>]/g, '').trim();
    if (!palabra || !g || !strong || MORFOLOGIA_MENOR.test(morfo ?? '') || g.length < 3) continue;
    if (vistas.has(strong)) continue;
    vistas.add(strong);
    out.push({ palabra: palabra.replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3\u05BE/]/g, '').replace(/[.,;:·;!?]+$/u, ''), translit, glosa: g });
  }
  return out.slice(0, 14);
}

const PREF = 'compartir-estilo';

/**
 * Hoja para compartir un versículo como imagen (cuadrada para publicaciones o vertical para historias)
 * o como texto. La vista previa es la misma imagen que se comparte: fondo ilustrado o de color, letra, palabras
 * destacadas, una dedicatoria para alguien y, si se quiere, una palabra hebrea o griega al pie.
 */
export default function VerseImage({ verse, onClose, inicial }: Props) {
  const colors = useColors();
  const { width: screen, height: alto } = useWindowDimensions();
  const [format, setFormat] = useState<ImageFormat>('cuadrado');
  // Carrusel de láminas para Historias (solo en la web, donde se dibujan con canvas).
  const [carrusel, setCarrusel] = useState(false);
  const [gancho, setGancho] = useState(GANCHOS[0]);
  const [fondo, setFondo] = useState<Fondo>(inicial?.fondo ? fondoPorNombre(inicial.fondo) : FONDOS[0]);
  // Una ocasión trae su fondo: entonces no se cambia por el último que se usó.
  const fondoFijo = !!inicial?.fondo;
  const letraFija = !!inicial?.letra;
  const [letra, setLetra] = useState<Letra>(inicial?.letra ? letraPorId(inicial.letra) : LETRAS[0]);
  const [destacadas, setDestacadas] = useState<number[]>([]);
  const [dedicatoria, setDedicatoria] = useState(inicial?.dedicatoria ?? '');
  const [contexto, setContexto] = useState('');
  const [buscandoContexto, setBuscandoContexto] = useState<'no' | 'buscando' | 'sin-notas' | string>('no');
  const [original, setOriginal] = useState<PalabraOriginal | null>(null);
  const [originales, setOriginales] = useState<PalabraOriginal[] | null>(null);
  const [tab, setTab] = useState<Pestaña>('fondo');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const preview = useRef<ComponentRef<typeof View>>(null);
  useLetras();

  useEffect(() => {
    // Recuerda el último fondo y la última letra que se usaron en este dispositivo.
    AsyncStorage.getItem(PREF)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw) as { fondo?: string; letra?: string };
        if (p.fondo && !fondoFijo) setFondo(fondoPorNombre(p.fondo));
        if (p.letra && !letraFija) setLetra(letraPorId(p.letra));
      })
      .catch(() => {});
  }, [fondoFijo, letraFija]);

  useEffect(() => {
    let vivo = true;
    getInterlinear(verse.book, verse.chapter)
      .then((all) => vivo && setOriginales(palabrasOriginales(all[String(verse.verse)])))
      .catch(() => vivo && setOriginales([]));
    return () => {
      vivo = false;
    };
  }, [verse.book, verse.chapter, verse.verse]);

  const recordar = (f: Fondo, l: Letra) => AsyncStorage.setItem(PREF, JSON.stringify({ fondo: f.name, letra: l.id })).catch(() => {});
  const elegirFondo = (f: Fondo) => {
    setFondo(f);
    recordar(f, letra);
  };
  const elegirLetra = (l: Letra) => {
    setLetra(l);
    recordar(fondo, l);
  };
  const sorprender = () => {
    const otros = FONDOS.filter((f) => f !== fondo);
    const f = otros[Math.floor(Math.random() * otros.length)];
    const l = LETRAS.filter((x) => x !== letra)[Math.floor(Math.random() * (LETRAS.length - 1))];
    setFondo(f);
    setLetra(l);
    recordar(f, l);
  };
  const destacar = (i: number) => setDestacadas((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));

  const sugerirContexto = async () => {
    setBuscandoContexto('buscando');
    try {
      const t = await getContexto(verse.book, verse.chapter, verse.verse);
      if (t) setContexto(t);
      setBuscandoContexto(t ? 'no' : 'sin-notas');
    } catch (e) {
      setBuscandoContexto(e instanceof Error ? e.message : 'No se pudo traer el contexto');
    }
  };

  const look: ImageLook = { fondo, letra, destacadas, dedicatoria, original: original ?? undefined, contexto };
  const size = IMAGE_SIZE[format];
  // La historia es alta: se limita para que debajo se vean las opciones.
  const previewWidth = Math.min(format === 'cuadrado' ? 320 : Math.min(240, (alto * 0.42 * 9) / 16), screen - 64);
  const caption = `${verse.reference}${verse.version ? ` (${verse.version})` : ''}`;

  const copy = async () => {
    await Clipboard.setStringAsync(`«${verse.text}» ${caption}`);
    setNote('Versículo copiado');
  };

  const share = async (download = false) => {
    setBusy(true);
    setNote(null);
    try {
      if (carrusel) {
        const r = await compartirLaminas(await drawLaminas(verse, look, gancho), verse, download);
        if (r === 'descargadas') setNote(download ? 'Láminas descargadas' : 'Este navegador no comparte varias imágenes: las descargamos para que las subas.');
      } else if (Platform.OS === 'web') {
        const blob = await drawVerseImage(verse, format, look);
        if (download) {
          downloadImage(blob, verse);
          setNote('Imagen descargada');
        } else if ((await shareImageOnWeb(blob, verse)) === 'descargada') {
          setNote('Este navegador no comparte imágenes: la descargamos para que la subas.');
        }
      } else {
        const uri = await captureRef(preview, { format: 'png', quality: 1, width: size.width, height: size.height });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: verse.reference });
      }
      huella('compartir', `${verse.book}.${verse.chapter}.${verse.verse}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'No se pudo compartir la imagen');
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, on: boolean, onPress: () => void, extra?: object) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      style={[styles.chip, { borderColor: on ? colors.warm : colors.border }, on && { backgroundColor: colors.warmSoft }, extra]}
    >
      <Text style={{ color: on ? colors.warm : colors.text, fontWeight: on ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );

  const muestra = (f: Fondo) => {
    const on = f === fondo;
    return (
      <Pressable
        key={f.name}
        onPress={() => elegirFondo(f)}
        accessibilityRole="radio"
        accessibilityLabel={`Fondo ${f.name}`}
        accessibilityState={{ checked: on }}
        aria-checked={on}
        style={styles.thumbWrap}
      >
        <View style={[styles.thumbRing, { borderColor: on ? colors.warm : 'transparent' }]}>
          <View style={[styles.thumb, { backgroundColor: f.background, borderColor: colors.border }]}>
            {f.svg && <SvgXml xml={idsUnicos(f.svg(240, 240), `m${f.name.replace(/\W/g, '')}`)} width="100%" height="100%" style={StyleSheet.absoluteFill} />}
            <Text style={{ color: f.text, fontFamily: serif, fontSize: 20 }}>A</Text>
          </View>
        </View>
        <Text style={[styles.thumbLabel, { color: on ? colors.warm : colors.muted }, on && { fontWeight: '700' }]} numberOfLines={1}>
          {f.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      {/* Este contenedor centra la hoja: con position absolute, alignSelf no la centraba en pantallas anchas. */}
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: colors.text }]}>Compartir {verse.reference}</Text>

            {carrusel ? (
              <Laminas verse={verse} look={look} gancho={gancho} onGancho={setGancho} alto={alto} />
            ) : (
              <>
                <VerseArt
                  viewRef={preview}
                  text={verse.text}
                  caption={caption}
                  format={format}
                  look={look}
                  width={previewWidth}
                  onWordPress={destacar}
                />
                <Text style={[styles.hint, { color: colors.muted }]}>
                  {destacadas.length ? 'Toca otra vez una palabra para quitarle el color' : 'Toca una palabra del versículo para destacarla'}
                </Text>
              </>
            )}

            <View style={styles.row}>
              {chip('Publicación', !carrusel && format === 'cuadrado', () => (setCarrusel(false), setFormat('cuadrado')))}
              {chip('Historia', !carrusel && format === 'historia', () => (setCarrusel(false), setFormat('historia')))}
              {Platform.OS === 'web' && chip('Carrusel', carrusel, () => setCarrusel(true))}
              <Pressable onPress={sorprender} style={[styles.chip, styles.surprise, { borderColor: colors.border }]} accessibilityRole="button">
                <IconText icon={SparkIcon} color={colors.text} size={16}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Sorpréndeme</Text>
                </IconText>
              </Pressable>
            </View>

            <View style={[styles.tabs, { backgroundColor: colors.accentSoft }]} accessibilityRole="tablist">
              {PESTAÑAS.map((t) => {
                const on = t.id === tab;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setTab(t.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.tab, on && { backgroundColor: colors.surface }]}
                  >
                    <Text style={{ color: on ? colors.text : colors.muted, fontWeight: on ? '700' : '500' }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {tab === 'fondo' && (
              <View style={styles.panel}>
                <Text style={[styles.section, { color: colors.muted }]}>ILUSTRACIONES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll} contentContainerStyle={styles.strip}>
                  {FONDOS.filter((f) => f.grupo === 'ilustracion').map(muestra)}
                </ScrollView>
                <Text style={[styles.section, { color: colors.muted }]}>COLORES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll} contentContainerStyle={styles.strip}>
                  {FONDOS.filter((f) => f.grupo === 'color').map(muestra)}
                </ScrollView>
              </View>
            )}

            {tab === 'letra' && (
              <View style={[styles.panel, styles.fonts]}>
                {LETRAS.map((l) => {
                  const on = l === letra;
                  return (
                    <Pressable
                      key={l.id}
                      onPress={() => elegirLetra(l)}
                      accessibilityRole="radio"
                      accessibilityLabel={`Letra ${l.name}`}
                      accessibilityState={{ checked: on }}
                      aria-checked={on}
                      style={[styles.font, { borderColor: on ? colors.warm : colors.border }, on && { backgroundColor: colors.warmSoft }]}
                    >
                      <Text style={{ color: on ? colors.warm : colors.text, fontFamily: l.family ?? serif, fontSize: 26 * l.escala, lineHeight: 34 }}>
                        {l.mayusculas ? 'AA' : 'Aa'}
                      </Text>
                      <Text style={{ color: on ? colors.warm : colors.muted, fontSize: 12, fontWeight: on ? '700' : '500' }}>{l.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {tab === 'dedicar' && (
              <View style={styles.panel}>
                <Text style={[styles.ask, { color: colors.text }]}>¿A quién le hace falta hoy este versículo?</Text>
                <Text style={[styles.hint, { color: colors.muted }]}>Escríbele unas palabras: van arriba de la imagen, como una nota a mano.</Text>
                <TextInput
                  value={dedicatoria}
                  onChangeText={setDedicatoria}
                  placeholder="Para Ana, me acordé de ti"
                  placeholderTextColor={colors.muted}
                  maxLength={40}
                  style={[styles.input, styles.line, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  accessibilityLabel="Dedicatoria"
                />
                <View style={styles.row}>
                  {DEDICATORIAS.map((d) => chip(d, dedicatoria === d, () => setDedicatoria(dedicatoria === d ? '' : d), styles.small))}
                </View>
              </View>
            )}

            {tab === 'estudio' && (
              <View style={styles.panel}>
                <Text style={[styles.ask, { color: colors.text }]}>Una línea de contexto</Text>
                <Text style={[styles.hint, { color: colors.muted }]}>
                  Quién lo dice, a quién y cuándo, para que el versículo no viaje fuera de su contexto.
                </Text>
                <TextInput
                  value={contexto}
                  onChangeText={setContexto}
                  placeholder="Por ejemplo: Pablo lo escribe desde la cárcel"
                  placeholderTextColor={colors.muted}
                  maxLength={MAX_CONTEXTO}
                  multiline
                  style={[styles.input, styles.line, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  accessibilityLabel="Contexto"
                />
                <Pressable
                  onPress={sugerirContexto}
                  disabled={buscandoContexto === 'buscando'}
                  style={[styles.chip, { borderColor: colors.border }]}
                  accessibilityRole="button"
                >
                  <IconText icon={CommentaryIcon} color={colors.text} size={16}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      {buscandoContexto === 'buscando' ? 'Leyendo los comentarios…' : 'Sugerir desde los comentarios'}
                    </Text>
                  </IconText>
                </Pressable>
                {buscandoContexto === 'sin-notas' ? (
                  <Text style={[styles.hint, { color: colors.muted }]}>Los comentarios no tienen notas de este versículo: escribe la tuya.</Text>
                ) : buscandoContexto !== 'no' && buscandoContexto !== 'buscando' ? (
                  <Text style={[styles.hint, { color: '#B3412E' }]}>{buscandoContexto}</Text>
                ) : null}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.ask, { color: colors.text }]}>Una palabra del idioma original</Text>
                <Text style={[styles.hint, { color: colors.muted }]}>Elige una y se pone al pie de la imagen, con lo que significa.</Text>
                {originales === null ? (
                  <ActivityIndicator color={colors.muted} />
                ) : originales.length === 0 ? (
                  <Text style={[styles.hint, { color: colors.muted }]}>Este versículo no tiene palabras originales todavía.</Text>
                ) : (
                  <View style={styles.row}>
                    {originales.map((o) => {
                      const on = original?.palabra === o.palabra;
                      return (
                        <Pressable
                          key={o.palabra + o.glosa}
                          onPress={() => setOriginal(on ? null : o)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          aria-checked={on}
                          accessibilityLabel={`${o.translit}, ${o.glosa}`}
                          style={[styles.word, { borderColor: on ? colors.warm : colors.border }, on && { backgroundColor: colors.warmSoft }]}
                        >
                          <Text style={{ color: on ? colors.warm : colors.greek, fontFamily: serif, fontSize: 20 }}>{o.palabra}</Text>
                          <Text style={{ color: on ? colors.warm : colors.muted, fontSize: 12 }} numberOfLines={1}>
                            {o.glosa}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <Pressable
              onPress={() => share()}
              disabled={busy}
              style={[styles.primary, { backgroundColor: colors.accent }, busy && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>
                {busy
                  ? 'Preparando…'
                  : carrusel
                    ? `Compartir ${laminasDe(look).length} láminas`
                    : dedicatoria.trim()
                      ? 'Enviar imagen'
                      : 'Compartir imagen'}
              </Text>
            </Pressable>
            <View style={styles.row}>
              {Platform.OS === 'web' && (
                <Pressable onPress={() => share(true)} disabled={busy} hitSlop={8}>
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>Descargar</Text>
                </Pressable>
              )}
              <Pressable onPress={() => shareVerse(verse)} hitSlop={8}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Compartir como texto</Text>
              </Pressable>
              <Pressable onPress={copy} hitSlop={8}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>Copiar</Text>
              </Pressable>
            </View>
            {note && <Text style={{ color: colors.muted, textAlign: 'center' }}>{note}</Text>}

            <EnviarAmigo verse={verse} format={format} look={look} onClose={onClose} />
            <PublishToCommunity verse={verse} format={format} look={look} onClose={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Publicar el versículo en la pestaña Comunidad, como la imagen elegida o como versículo resaltado. */
function PublishToCommunity({
  verse,
  format,
  look,
  onClose,
}: {
  verse: VerseToShare;
  format: ImageFormat;
  look: ImageLook;
  onClose: () => void;
}) {
  const colors = useColors();
  const { usuario } = useAccount();
  const [open, setOpen] = useState(false);
  const [as, setAs] = useState<'imagen' | 'resaltado'>('imagen');
  const [audience, setAudience] = useState<Audiencia>('amigos');
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'listo' | 'enviando' | 'publicado' | string>('listo');

  const goToCommunity = () => {
    onClose();
    navigate(() => router.push('/comunidades'), 'forward');
  };

  const send = async () => {
    setState('enviando');
    try {
      await publish({
        tipo: as,
        audiencia: audience,
        texto: comment.trim(),
        libro: verse.book,
        capitulo: verse.chapter,
        versiculo: verse.verse,
        version: verse.version,
        datos: as === 'imagen' ? datosDeImagen(format, look) : { color: highlightOf(verse.book, verse.chapter, verse.verse) ?? 'amarillo' },
      });
      setState('publicado');
      huella('compartir', `${verse.book}.${verse.chapter}.${verse.verse}`);
    } catch (e) {
      setState(e instanceof Error ? e.message : 'No se pudo publicar');
    }
  };

  const option = (label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      style={[styles.chip, { borderColor: on ? colors.accent : colors.border }, on && { backgroundColor: colors.accentSoft }]}
    >
      <Text style={{ color: on ? colors.accent : colors.text, fontWeight: on ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={[styles.publish, { borderColor: colors.border }]} accessibilityRole="button">
        <IconText icon={PeopleIcon} color={colors.accent} size={18} gap={8}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Publicar en Comunidad</Text>
        </IconText>
      </Pressable>
    );
  }
  if (!usuario) {
    return (
      <View style={[styles.publishBox, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, textAlign: 'center' }}>Para publicar en Comunidad necesitas una cuenta gratuita.</Text>
        <Pressable onPress={() => router.push('/registro')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Crear mi cuenta</Text>
        </Pressable>
      </View>
    );
  }
  if (state === 'publicado') {
    return (
      <View style={[styles.publishBox, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Publicado en Comunidad</Text>
        <Pressable onPress={goToCommunity} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver en Comunidad</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={[styles.publishBox, { borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Publicar en Comunidad</Text>
      <View style={styles.row}>
        {option('Esta imagen', as === 'imagen', () => setAs('imagen'))}
        {option('Como resaltado', as === 'resaltado', () => setAs('resaltado'))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="¿Qué te dice este versículo? (opcional)"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={1000}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
      <View style={styles.row}>
        {option('Mis amigos', audience === 'amigos', () => setAudience('amigos'))}
        {option('Toda la comunidad', audience === 'todos', () => setAudience('todos'))}
      </View>
      <Pressable
        onPress={send}
        disabled={state === 'enviando'}
        style={[styles.primary, { backgroundColor: colors.accent }, state === 'enviando' && { opacity: 0.6 }]}
        accessibilityRole="button"
      >
        <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 15 }}>{state === 'enviando' ? 'Publicando…' : 'Publicar'}</Text>
      </Pressable>
      {state !== 'listo' && state !== 'enviando' && <Text style={{ color: '#B3412E' }}>{state}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, alignItems: 'center', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  // Sin flexShrink la lista crecía más que la hoja y lo de abajo quedaba fuera de la pantalla, sin poder desplazarse.
  scroll: { flexGrow: 0, flexShrink: 1 },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  body: { alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingBottom: 36 },
  title: { fontSize: 16, fontWeight: '700' },
  publish: { borderWidth: 1, borderRadius: 24, paddingVertical: 12, alignSelf: 'stretch', alignItems: 'center' },
  publishBox: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, alignSelf: 'stretch', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70, fontSize: 15, alignSelf: 'stretch', textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  small: { paddingHorizontal: 12, paddingVertical: 6 },
  surprise: { borderStyle: 'dashed' },
  hint: { fontSize: 13, textAlign: 'center' },
  ask: { fontSize: 17, fontWeight: '700', textAlign: 'center', fontFamily: serif },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, alignSelf: 'stretch' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  panel: { alignSelf: 'stretch', gap: 12, alignItems: 'center' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, alignSelf: 'flex-start' },
  // A todo el ancho: centrada (como el resto del panel) la tira se salía por la izquierda y escondía los primeros.
  stripScroll: { alignSelf: 'stretch' },
  strip: { gap: 6, paddingRight: 8 },
  thumbWrap: { alignItems: 'center', width: 70, gap: 4 },
  thumbRing: { borderWidth: 2, borderRadius: 18, padding: 2 },
  thumb: { width: 56, height: 56, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbLabel: { fontSize: 11 },
  fonts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  font: { width: 92, borderWidth: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 2 },
  word: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', maxWidth: 140 },
  line: { minHeight: 0 },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6 },
  primary: { borderRadius: 24, paddingVertical: 13, alignSelf: 'stretch', alignItems: 'center' },
});
