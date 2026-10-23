import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Appear from '@/components/Appear';
import { Button } from '@/components/comunidad/ui';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, LiveIcon, OpenBookIcon, ShareIcon } from '@/components/icons';
import { BotonPreguntas, PreguntasSheet, TarjetaEstudio, TarjetaRonda, preguntarAlEstudio } from '@/components/vivo/Estudio';
import { TarjetaRepaso } from '@/components/vivo/Repaso';
import { NuevaTarjeta, PantallaSheet, PasajeSheet, PersonasSheet } from '@/components/vivo/Hojas';
import { Faces, LIVE_RED, LiveBadge, Sheet, vivoText } from '@/components/vivo/piezas';
import TarjetaVivo from '@/components/vivo/TarjetaVivo';
import TextoVivo from '@/components/vivo/TextoVivo';
import { chapterHref, useAccount } from '@/lib/comunidad';
import { Book, Verse, getBooks, getChapter } from '@/lib/data';
import { useTaller } from '@/lib/taller';
import { huella } from '@/lib/sellos';
import { serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { type PreguntaSala, type Sala, cleanCode, liveUrl, spacedCode, touchesByVerse, useSala, vivoApi } from '@/lib/vivo';

type Open = null | 'pasaje' | 'pantalla' | 'personas' | 'invitar' | 'preguntas';
/** La respuesta del estudio a una duda del grupo mientras se escribe (solo la ve quien guía). */
type Respondiendo = { pregunta: PreguntaSala; texto: string };

/** La sala en vivo: el capítulo que todos leen a la vez, lo que señala quien guía y la tarjeta de la dinámica. */
export default function SalaEnVivo() {
  const params = useLocalSearchParams<{ codigo: string; taller?: string }>();
  const codigo = cleanCode(params.codigo ?? '');
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { ready, usuario } = useAccount();
  const { sala, error, skew, apply } = useSala(codigo, ready && !!usuario);
  const { mensajes } = useTaller();
  const [books, setBooks] = useState<Book[]>([]);
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Mientras llega la respuesta del servidor: la hoja nueva y el versículo tocado se ven al instante.
  const [pending, setPending] = useState<{ libro: string; capitulo: number } | null>(null);
  const [pendingTap, setPendingTap] = useState<number | null>(null);
  const [respondiendo, setRespondiendo] = useState<Respondiendo | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef(new Map<number, number>());
  const textTop = useRef(0);

  const me = usuario?.id ?? null;
  const lead = !!sala && me === sala.sala.guia.id;
  const estado = sala?.estado;
  const libro = pending?.libro ?? estado?.libro;
  const capitulo = pending?.capitulo ?? estado?.capitulo;
  const book = books.find((b) => b.id === libro);
  const encuentros = useMemo(() => mensajes.filter((m) => m.tipo === 'encuentro'), [mensajes]);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  // Leer en vivo con la célula (guía o no) es un sello de Mis sellos
  const enSala = !!sala;
  useEffect(() => {
    if (enSala) huella('celula', codigo);
  }, [enSala, codigo]);

  // Mis sellos del estudio en grupo: tus preguntas que el grupo estudió y las que otros dos también tenían.
  const preguntasSala = sala?.preguntas;
  useEffect(() => {
    for (const p of preguntasSala ?? []) {
      if (p.autor !== me) continue;
      if (p.respondida) huella('pregunta-estudio', p.id);
      if (p.apoyos.length >= 2) huella('pregunta-apoyada', p.id);
    }
  }, [preguntasSala, me]);

  // El texto en la versión de cada quien (los números de versículo coinciden), con la RV1909 si no se puede.
  useEffect(() => {
    if (!libro || !capitulo) return;
    let gone = false;
    setVerses(null);
    positions.current.clear();
    getChapter(libro, capitulo, settings.version)
      .catch(() => getChapter(libro, capitulo))
      .then((v) => !gone && setVerses(v))
      .catch(() => {});
    scroll.current?.scrollTo({ y: 0, animated: false });
    return () => {
      gone = true;
    };
  }, [libro, capitulo, settings.version]);

  // Al llegar la hoja que se pidió, se olvida lo provisional.
  useEffect(() => {
    if (pending && estado && pending.libro === estado.libro && pending.capitulo === estado.capitulo) setPending(null);
  }, [estado, pending]);
  useEffect(() => setPendingTap(null), [sala?.version]);

  // Quien sigue ve un aviso corto cuando quien guía pasa la hoja.
  const lastPassage = useRef<string | null>(null);
  useEffect(() => {
    if (!estado || !sala) return;
    const key = `${estado.libro}.${estado.capitulo}`;
    if (lastPassage.current && lastPassage.current !== key && !lead) {
      const name = books.find((b) => b.id === estado.libro)?.name ?? '';
      setToast(`${sala.sala.guia.nombre.split(' ')[0]} pasó a ${name} ${estado.capitulo}`);
      const t = setTimeout(() => setToast(null), 2600);
      lastPassage.current = key;
      return () => clearTimeout(t);
    }
    lastPassage.current = key;
  }, [estado, sala, lead, books]);

  // El versículo que señala quien guía se lleva a la vista de todos.
  const scrollToFocus = useCallback((n: number | null | undefined) => {
    if (!n) return;
    const y = positions.current.get(n);
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, textTop.current + y - 140), animated: true });
  }, []);
  useEffect(() => {
    if (!lead) scrollToFocus(estado?.foco);
  }, [estado?.foco, lead, scrollToFocus, verses]);

  const act = useCallback(
    async (accion: string, body: Record<string, unknown> = {}) => {
      setProblem(null);
      try {
        const next = await vivoApi<Sala>(accion, { sala: codigo, ...body });
        apply(next);
        if (accion === 'responderSala' || accion === 'preguntarSala') huella('estudio-grupo', codigo);
        return next;
      } catch (e) {
        setPending(null);
        setPendingTap(null);
        setProblem(e instanceof Error ? e.message : String(e));
        return null;
      }
    },
    [codigo, apply],
  );

  const turn = useCallback(
    (delta: 1 | -1) => {
      if (!book || !capitulo || !lead) return;
      let target: { libro: string; capitulo: number } | null = null;
      if (capitulo + delta >= 1 && capitulo + delta <= book.chapters) target = { libro: book.id, capitulo: capitulo + delta };
      else {
        const i = books.indexOf(book) + delta;
        const other = books[i];
        if (other) target = { libro: other.id, capitulo: delta === 1 ? 1 : other.chapters };
      }
      if (!target) return;
      setPending(target);
      act('moverSala', target);
    },
    [book, capitulo, books, lead, act],
  );

  // En el computador quien guía pasa la hoja con las flechas ← →, como en el lector.
  useEffect(() => {
    if (Platform.OS !== 'web' || !lead || open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') turn(1);
      if (e.key === 'ArrowLeft') turn(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lead, open, turn]);

  const tap = (n: number) => {
    if (!sala) return;
    if (!me) {
      setProblem('Entra con tu cuenta para iluminar versículos.');
      return;
    }
    if (lead) {
      act('moverSala', { foco: estado?.foco === n ? null : n });
      return;
    }
    setPendingTap(n);
    act('tocar', { versiculo: n });
  };

  const put = async (t: NuevaTarjeta) => {
    setOpen(null);
    const tarjeta = t.tipo === 'estudio' || t.tipo === 'ronda' || t.tipo === 'repaso' ? t : { ...t, texto: t.texto?.slice(0, 1500) };
    await act('moverSala', { tarjeta });
  };

  /** Le pregunta al estudio la duda que eligió quien guía y, al terminar, la respuesta va a todas las pantallas. */
  const askStudy = async (p: PreguntaSala) => {
    if (!libro || !capitulo || respondiendo) return;
    setOpen(null);
    setRespondiendo({ pregunta: p, texto: '' });
    scroll.current?.scrollTo({ y: 0, animated: true });
    try {
      const answer = await preguntarAlEstudio(libro, capitulo, settings.version, p.texto, (texto) =>
        setRespondiendo((r) => (r?.pregunta.id === p.id ? { ...r, texto } : r)),
      );
      await act('moverSala', {
        tarjeta: { tipo: 'estudio', titulo: p.texto, texto: answer.text.slice(0, 8000), fuentes: answer.sources, pregunta: p.id },
      });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setRespondiendo(null);
    }
  };

  const toques = useMemo(() => {
    const list = sala?.toques ?? [];
    if (pendingTap === null || !me) return touchesByVerse(list);
    const had = list.find((t) => t.usuario === me);
    const rest = list.filter((t) => t.usuario !== me);
    return touchesByVerse(had?.versiculo === pendingTap ? rest : [...rest, { usuario: me, nombre: usuario!.nombre, versiculo: pendingTap }]);
  }, [sala?.toques, pendingTap, me, usuario]);

  const close = () => navigate(() => (router.canGoBack() ? router.back() : router.replace('/')), 'back');

  // --- Estados sin sala: cargando, código que no existe, sin conexión ---
  if (!sala) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        {error && error.status !== 0 ? (
          <Appear style={styles.missing}>
            <View style={[styles.bigIcon, { backgroundColor: colors.accentSoft }]}>
              <LiveIcon color={colors.muted} size={30} />
            </View>
            <Text style={[styles.endTitle, { color: colors.text }]}>No encontramos esa lectura</Text>
            <Text style={[styles.endText, { color: colors.muted }]}>{error.message}</Text>
            <Button label="Escribir otro código" onPress={() => router.replace('/vivo')} style={{ marginTop: 20, alignSelf: 'stretch' }} />
          </Appear>
        ) : (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.muted, marginTop: 14 }}>{error ? error.message : 'Entrando a la lectura…'}</Text>
          </>
        )}
      </View>
    );
  }

  // --- La lectura terminó ---
  if (!sala.sala.enVivo) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.ended, { paddingTop: insets.top + 40 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Appear style={{ alignItems: 'center' }}>
          <LiveBadge live={false} />
          <Text style={[styles.endTitle, { color: colors.text, marginTop: 18 }]}>La lectura terminó</Text>
          <Text style={[styles.endText, { color: colors.muted }]}>
            {sala.sala.titulo}. Gracias por leer en compañía.
          </Text>
          <Text style={[vivoText.kicker, { color: colors.muted, marginTop: 28 }]}>LEYERON JUNTOS</Text>
          <View style={styles.route}>
            {sala.estado.recorrido.map((key) => {
              const [b, c] = key.split('.');
              const name = books.find((x) => x.id === b)?.name ?? b;
              return (
                <Pressable
                  key={key}
                  onPress={() => navigate(() => router.push(chapterHref(b, Number(c))), 'forward')}
                  style={[styles.routeChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  accessibilityRole="link"
                >
                  <OpenBookIcon color={colors.accent} size={16} />
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {name} {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 32 }}>
            {sala.sala.grupo && (
              <Button label={`Volver a ${sala.sala.grupo.nombre}`} onPress={() => router.replace(`/grupos/${sala.sala.grupo!.id}`)} />
            )}
            <Button label="Ir a Hoy" kind={sala.sala.grupo ? 'outline' : 'primary'} onPress={() => router.replace('/')} />
          </View>
        </Appear>
      </ScrollView>
    );
  }

  const guia = lead ? 'Tú' : sala.sala.guia.nombre;
  const abiertas = sala.preguntas.filter((p) => !p.respondida).length;
  const tarjeta = estado?.tarjeta;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cabecera: la sala, quién guía, quiénes están y el código */}
      <View style={[styles.top, { paddingTop: insets.top + 8, borderColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.topInner}>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" onPress={close} hitSlop={10} accessibilityLabel="Salir de la lectura en vivo" style={[styles.iconButton, { backgroundColor: colors.accentSoft }]}>
              <CloseIcon color={colors.text} size={18} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {sala.sala.titulo}
              </Text>
              <Text style={{ color: lead ? colors.warm : colors.muted, fontSize: 12.5, fontWeight: lead ? '700' : '500' }} numberOfLines={1}>
                {lead ? 'Tú guías la lectura' : `Guía: ${sala.sala.guia.nombre}`}
              </Text>
            </View>
            <LiveBadge />
          </View>
          <View style={styles.topRow}>
            <Pressable onPress={() => setOpen('personas')} style={styles.people} accessibilityRole="button" accessibilityLabel="Ver quiénes están">
              <Faces people={sala.presentes} />
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>
                {sala.presentes.length} {sala.presentes.length === 1 ? 'leyendo' : 'leyendo'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOpen('invitar')}
              style={[styles.code, { borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel={`Código ${spacedCode(sala.sala.codigo)}. Invitar`}
            >
              <Text style={[styles.codeText, { color: colors.text }]}>{spacedCode(sala.sala.codigo)}</Text>
              <ShareIcon color={colors.muted} size={15} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {respondiendo ? (
          <TarjetaEstudio
            tarjeta={{ titulo: respondiendo.pregunta.texto, texto: respondiendo.texto || '…', pregunta: respondiendo.pregunta.id }}
            lead
            escribiendo
          />
        ) : tarjeta?.tipo === 'estudio' ? (
          <TarjetaEstudio key={tarjeta.id} tarjeta={tarjeta} lead={lead} onClose={() => act('moverSala', { tarjeta: null })} />
        ) : tarjeta?.tipo === 'repaso' ? (
          <TarjetaRepaso
            key={tarjeta.id}
            tarjeta={tarjeta}
            respuestas={sala.respuestas}
            presentes={sala.presentes}
            guia={sala.sala.guia.id}
            me={me}
            lead={lead}
            onAnswer={async (r) =>
              !!(await act('responderSala', { ronda: `${tarjeta.id}:${tarjeta.paso}`, ...(typeof r === 'string' ? { respuesta: r } : { opcion: r }) }))
            }
            onReveal={() => act('moverSala', { revelar: true })}
            onNext={(paso) => act('moverSala', { paso })}
            onClose={() => act('moverSala', { tarjeta: null })}
          />
        ) : tarjeta?.tipo === 'ronda' ? (
          <TarjetaRonda
            key={tarjeta.id}
            tarjeta={tarjeta}
            respuestas={sala.respuestas}
            presentes={sala.presentes}
            guia={sala.sala.guia.id}
            me={me}
            lead={lead}
            onAnswer={async (texto) => !!(await act('responderSala', { ronda: tarjeta.id, texto }))}
            onReveal={(revelar) => act('moverSala', { revelar })}
            onClose={() => act('moverSala', { tarjeta: null })}
          />
        ) : (
          tarjeta && (
            <TarjetaVivo
              key={`${tarjeta.titulo}-${tarjeta.tipo}`}
              tarjeta={tarjeta}
              skew={skew}
              lead={lead}
              onStep={(paso) => act('moverSala', { paso })}
              onTimer={(reloj) => act('moverSala', { reloj })}
              onClose={() => act('moverSala', { tarjeta: null })}
            />
          )
        )}
        <View onLayout={(e) => (textTop.current = e.nativeEvent.layout.y)}>
          {verses && book ? (
            <TextoVivo
              bookName={book.name}
              chapter={capitulo!}
              verses={verses}
              toques={toques}
              foco={pending ? null : (estado?.foco ?? null)}
              guia={guia}
              me={me}
              lead={lead}
              onTap={tap}
              onVerseLayout={(n, y) => positions.current.set(n, y)}
            />
          ) : (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
          )}
        </View>
      </ScrollView>

      {/* Avisos: la hoja que pasó, o un problema */}
      {(toast || problem) && (
        <View pointerEvents="box-none" style={[styles.toastWrap, { bottom: insets.bottom + (lead ? 96 : 76) }]}>
          <Appear from={6}>
            <Pressable accessibilityRole="button"
              onPress={() => (problem && !me ? router.push('/entrar') : setProblem(null))}
              style={[styles.toast, { backgroundColor: problem ? LIVE_RED : colors.accent }]}
            >
              <Text style={{ color: problem ? '#FFFFFF' : colors.surface, fontWeight: '600', fontSize: 14 }}>{problem ?? toast}</Text>
            </Pressable>
          </Appear>
        </View>
      )}

      {/* Abajo: los mandos de quien guía, o para los demás a quién siguen */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
        {lead ? (
          <View style={[styles.dock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable accessibilityRole="button" onPress={() => turn(-1)} accessibilityLabel="Capítulo anterior" style={[styles.dockRound, { backgroundColor: colors.accentSoft }]}>
              <ChevronLeftIcon color={colors.text} size={20} />
            </Pressable>
            <Pressable onPress={() => setOpen('pasaje')} style={styles.passage} accessibilityRole="button" accessibilityLabel="Elegir pasaje">
              <Text style={[vivoText.kicker, { color: colors.muted, fontSize: 10 }]}>PASAJE</Text>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                {book?.name} {capitulo}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => turn(1)} accessibilityLabel="Capítulo siguiente" style={[styles.dockRound, { backgroundColor: colors.accent }]}>
              <ChevronRightIcon color={colors.surface} size={20} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <BotonPreguntas compact count={abiertas} onPress={() => setOpen('preguntas')} />
            <Pressable
              onPress={() => setOpen('pantalla')}
              style={({ pressed }) => [styles.put, { backgroundColor: colors.warmSoft }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <LiveIcon color={colors.warm} size={18} strokeWidth={2} />
              <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 13.5 }}>Mostrar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.followRow}>
            <View style={[styles.follow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LiveIcon color={colors.muted} size={16} />
              <Text style={{ color: colors.muted, fontSize: 13, flexShrink: 1 }} numberOfLines={2}>
                {me ? (
                  <>
                    Sigues a <Text style={{ color: colors.text, fontWeight: '700' }}>{sala.sala.guia.nombre.split(' ')[0]}</Text>. Toca un
                    versículo para iluminarlo para todos.
                  </>
                ) : (
                  <>
                    Sigues a <Text style={{ color: colors.text, fontWeight: '700' }}>{sala.sala.guia.nombre.split(' ')[0]}</Text>.{' '}
                    <Text onPress={() => router.push('/entrar')} style={{ color: colors.accent, fontWeight: '700' }}>
                      Entra
                    </Text>{' '}
                    para iluminar versículos.
                  </>
                )}
              </Text>
            </View>
            <BotonPreguntas floating count={abiertas} onPress={() => setOpen('preguntas')} />
          </View>
        )}
      </View>

      {open === 'pasaje' && book && capitulo && (
        <PasajeSheet
          books={books}
          book={book.id}
          chapter={capitulo}
          onClose={() => setOpen(null)}
          onPick={(b, c) => {
            setOpen(null);
            setPending({ libro: b, capitulo: c });
            act('moverSala', { libro: b, capitulo: c });
          }}
        />
      )}
      {open === 'pantalla' && (
        <PantallaSheet
          encuentros={encuentros}
          books={books}
          initialEncuentro={params.taller}
          libro={libro!}
          capitulo={capitulo!}
          version={settings.version}
          onPut={put}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'preguntas' && (
        <PreguntasSheet
          preguntas={sala.preguntas}
          me={me}
          lead={lead}
          guia={sala.sala.guia.nombre}
          respondiendo={respondiendo?.pregunta.id ?? null}
          onAsk={async (texto) => !!(await act('preguntarSala', { texto }))}
          onSupport={(p) => act('apoyarSala', { pregunta: p.id })}
          onRemove={(p) => act('quitarPreguntaSala', { pregunta: p.id })}
          onTalk={(p) => {
            setOpen(null);
            act('moverSala', { tarjeta: { tipo: 'pregunta', titulo: p.texto.slice(0, 120) } });
          }}
          onStudy={askStudy}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'personas' && (
        <PersonasSheet
          sala={sala}
          me={me}
          onClose={() => setOpen(null)}
          onGive={async (p) => {
            await act('cederGuia', { usuario: p.id });
          }}
          onEnd={async () => {
            setOpen(null);
            setBusy(true);
            await act('cerrarSala');
            setBusy(false);
          }}
          onLeave={async () => {
            setOpen(null);
            await vivoApi('salirSala', { sala: codigo }).catch(() => {});
            close();
          }}
        />
      )}
      {open === 'invitar' && <Invitar sala={sala} onClose={() => setOpen(null)} />}
      {busy && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </View>
  );
}

/** El código grande para dictarlo en voz alta, y el enlace para mandarlo por el chat del grupo. */
function Invitar({ sala, onClose }: { sala: Sala; onClose: () => void }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const url = liveUrl(sala.sala.codigo);
  const message = `Estamos leyendo la Biblia en vivo (${sala.sala.titulo}). Entra aquí: ${url}`;
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);
  return (
    <Sheet title="Invitar a la lectura" kicker="EN VIVO" onClose={onClose}>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>
        Quien tenga la app entra en «Unirme con un código» o abre el enlace. Sin cuenta puede seguir la lectura; con cuenta
        también ilumina versículos.
      </Text>
      <View style={[styles.bigCode, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.bigCodeText, { color: colors.text }]} selectable>
          {spacedCode(sala.sala.codigo)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          label={copied ? 'Enlace copiado' : 'Copiar enlace'}
          kind="outline"
          style={{ flex: 1 }}
          onPress={async () => {
            await Clipboard.setStringAsync(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        />
        {canShare && <Button label="Compartir" style={{ flex: 1 }} onPress={() => Share.share({ message, url }).catch(() => {})} />}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missing: { alignItems: 'center', maxWidth: 380, width: '100%' },
  bigIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  ended: { padding: 24, paddingBottom: 60, maxWidth: 520, width: '100%', alignSelf: 'center' },
  endTitle: { fontFamily: serif, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  endText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  route: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  routeChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  top: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10 },
  topInner: { paddingHorizontal: 16, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 18, fontWeight: '700' },
  people: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  code: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6 },
  codeText: { fontSize: 14, fontWeight: '800', letterSpacing: 1.6, fontVariant: ['tabular-nums'] },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 160, maxWidth: 680, width: '100%', alignSelf: 'center' },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  toast: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 12 },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 7,
    maxWidth: 520,
    width: '100%',
    boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
  },
  dockRound: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  passage: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  divider: { width: StyleSheet.hairlineWidth, height: 28 },
  put: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, paddingHorizontal: 14, height: 44 },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 580, width: '100%', justifyContent: 'center' },
  follow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 520,
    boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
  },
  bigCode: { borderRadius: 18, borderWidth: 1, paddingVertical: 22, alignItems: 'center', marginVertical: 18 },
  bigCodeText: { fontSize: 38, fontWeight: '800', letterSpacing: 8, fontVariant: ['tabular-nums'] },
});
