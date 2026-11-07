import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import AskBar from '@/components/AskBar';
import { Button, Field, text } from '@/components/comunidad/ui';
import Welcome from '@/components/comunidad/Welcome';
import { BackIcon, ForwardIcon, PauseIcon, PlayIcon } from '@/components/audioIcons';
import { CheckIcon, CloseIcon, DocumentIcon, type IconProps, ListenIcon, LiveIcon, PencilIcon, RefreshIcon, SparkIcon } from '@/components/icons';
import { NeedsConnection } from '@/components/SinConexion';
import { Markdown, SourcePeek } from '@/components/StudyText';
import ComoPresentar from '@/components/taller/ComoPresentar';
import {
  type Cambio,
  antesDe,
  aplicarCambio,
  borradorParaCambiar,
  huellaDe,
  leerCambios,
  palabras,
  parteDe,
  partesDelRepaso,
  partesParaEscuchar,
  valeCambio,
} from '@/lib/borrador';
import { NEEDS_ACCOUNT } from '@/lib/comunidad';
import { NEEDS_CONNECTION } from '@/lib/conexion';
import { paraGuardar, useConversations } from '@/lib/conversaciones';
import { Book, getBooks, parseRef } from '@/lib/data';
import { dinamica } from '@/lib/dinamicas';
import { Source, askStudy } from '@/lib/estudio';
import { useNarrador } from '@/lib/narrador';
import { verseHref } from '@/lib/routes';
import { type Mensaje, actualizarMensaje, actualizarSeccion, pasajeLabel, terminarMensaje, tipoInfo, tituloDe, useTaller } from '@/lib/taller';
import { guardarTallerIa, leerTallerIa } from '@/lib/tallerIa';
import { Colors, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

type Clave = 'cambiar' | 'practicar';
type Estado = 'aceptado' | 'descartado';
type Escucha = 'completo' | 'repaso';

/**
 * El borrador de un mensaje, entero, para leerlo de corrido y ver si quedó bien: cada parte se edita a mano, se le
 * piden cambios a la IA hablándole (y se aceptan uno por uno), se escucha para practicar (el mensaje completo o un
 * repaso corto) y desde aquí se va al documento o a presentarlo.
 */
export default function BorradorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { settings } = useSettings();
  const { mensajes, ready } = useTaller();
  const [books, setBooks] = useState<Book[]>([]);
  const m = mensajes.find((x) => x.id === id);
  const [editando, setEditando] = useState<string | null>(null);
  const [pedido, setPedido] = useState('');
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [cargado, setCargado] = useState(false);
  const [peek, setPeek] = useState<Source | null>(null);
  const [presentar, setPresentar] = useState(false);
  const [escucha, setEscucha] = useState<Escucha | null>(null);

  const convs = useConversations<Clave>(
    (clave, history, onUpdate, signal) => {
      const msg = mensajes.find((x) => x.id === id)!;
      const p = msg.pasaje!;
      const single = p.from && !p.to ? p.from : undefined;
      const pedidoTexto = [...history].reverse().find((t) => t.role === 'user')?.text ?? '';
      return askStudy(
        {
          book: p.book,
          chapter: p.chapter,
          verse: single,
          messages: [],
          version: settings.version,
          taller: {
            modo: clave,
            paso: 'revisar',
            tipo: msg.tipo,
            desde: single ? undefined : p.from,
            hasta: single ? undefined : p.to,
            borrador: borradorParaCambiar(msg),
            situacion: msg.situacion,
            ...(clave === 'cambiar' && { pedido: pedidoTexto }),
          },
        },
        onUpdate,
        signal,
      );
    },
    (clave, turns) => {
      // El repaso hablado se guarda con el mensaje, junto con la huella del texto del que salió.
      const msg = mensajes.find((x) => x.id === id);
      const t = turns[turns.length - 1];
      if (clave === 'practicar' && msg && t?.role === 'assistant' && t.text && !t.cortada) {
        actualizarMensaje(msg.id, { practicar: { texto: t.text, huella: huellaDe(msg) } });
      }
    },
  );

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
    leerTallerIa(`${id}:borrador`).then((e) => {
      if (e?.convs?.cambiar?.length) convs.set('cambiar', e.convs.cambiar);
      const est = (e?.vista as { estados?: Record<string, Estado> } | undefined)?.estados;
      if (est) setEstados(est);
      setCargado(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cambiarConv = convs.get('cambiar');
  useEffect(() => {
    if (!cargado) return;
    guardarTallerIa(`${id}:borrador`, { vista: { estados }, convs: paraGuardar({ cambiar: cambiarConv }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estados, cambiarConv, cargado]);

  const titulo = m && books.length ? tituloDe(m, books) : '';
  const completo = useNarrador(m ? partesParaEscuchar(m, titulo) : []);
  const repasoTexto = m?.practicar?.texto ?? '';
  const repaso = useNarrador(partesDelRepaso(repasoTexto));

  if (!ready || !books.length) return <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />;
  if (!m) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: 'Borrador' }} />
        <Text style={[text.body, { color: colors.text }]}>Este mensaje ya no existe en este dispositivo.</Text>
        <Button label="Volver al Taller" kind="outline" onPress={() => router.replace('/taller')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const minutos = m.secciones.reduce((n, s) => n + (s.minutos || 0), 0);
  const total = m.secciones.reduce((n, s) => n + palabras(s.texto), 0);
  const repasoViejo = !!m.practicar && m.practicar.huella !== huellaDe(m);
  const practicarConv = convs.get('practicar');
  const sinPasaje = !m.pasaje;

  const pedir = () => {
    const q = pedido.trim();
    if (!q || cambiarConv.busy || sinPasaje) return;
    setPedido('');
    setPeek(null);
    convs.ask('cambiar', q);
  };

  const aceptar = (clave: string, c: Cambio, sources: Source[]) => {
    actualizarMensaje(m.id, aplicarCambio(m, c, sources));
    setEstados((e) => ({ ...e, [clave]: 'aceptado' }));
  };

  const open = (ref: string) => {
    const { start } = parseRef(ref);
    setPeek(null);
    navigate(() => router.push(verseHref(start.book, start.chapter, start.verse)), 'forward');
  };

  const elegirEscucha = (e: Escucha) => {
    completo.parar();
    repaso.parar();
    setEscucha((x) => (x === e ? null : e));
    if (e === 'repaso' && (!m.practicar || repasoViejo) && !practicarConv.busy && !sinPasaje) convs.run('practicar', []);
  };

  // La parte que suena al escuchar el mensaje completo (la 0 es el título), para resaltarla.
  const conTexto = m.secciones.filter((x) => x.texto.trim());
  const suenaId = escucha === 'completo' && completo.actual ? conTexto[completo.actual - 1]?.id : undefined;
  const turnos = cambiarConv.turns;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Borrador' }} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.cabeza}>
          {!!m.ia && !m.terminado && (
            <View style={[styles.tag, { backgroundColor: colors.warmSoft }]}>
              <Text style={[styles.tagText, { color: colors.warm }]}>BORRADOR DE LA IA</Text>
            </View>
          )}
          {!!m.terminado && (
            <View style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.tagText, { color: colors.accent }]}>EN MIS SERMONES</Text>
            </View>
          )}
          <Text style={[styles.titulo, { color: colors.text }]}>{titulo}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>
            {tipoInfo(m.tipo).nombre} · {pasajeLabel(m.pasaje, books)} · {minutos} min · {m.secciones.length} partes · {total.toLocaleString('es')} palabras
          </Text>
        </View>

        {(m.tema.trim() || m.complemento.trim()) && (
          <View style={[styles.idea, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.label, { color: colors.muted, marginBottom: 4 }]}>IDEA CENTRAL</Text>
            <Text style={{ fontFamily: serif, fontSize: 17, lineHeight: 25, color: colors.text }}>
              <Text style={{ fontWeight: '700' }}>{m.tema.trim()}:</Text> {m.complemento.trim()}
            </Text>
          </View>
        )}

        <View style={styles.acciones}>
          <Accion icon={ListenIcon} label="Escúchalo" on={!!escucha} onPress={() => setEscucha((x) => (x ? null : 'completo'))} colors={colors} />
          <Accion icon={DocumentIcon} label="Documento" onPress={() => navigate(() => router.push(`/taller/${m.id}/documento?desde=borrador`), 'forward')} colors={colors} />
          <Accion icon={LiveIcon} label="Presentar" onPress={() => setPresentar(true)} colors={colors} />
        </View>

        {escucha && (
          <Appear style={[styles.escuchar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.muted }]}>ESCÚCHALO PARA PRACTICAR</Text>
            <View style={styles.segmento}>
              {(
                [
                  ['completo', 'El mensaje completo', `${Math.max(1, Math.round(total / 150))} min`],
                  ['repaso', 'Repaso corto', '3 a 5 min'],
                ] as const
              ).map(([e, label, dur]) => (
                <Pressable
                  key={e}
                  onPress={() => elegirEscucha(e)}
                  accessibilityRole="radio"
                  aria-checked={escucha === e}
                  style={[styles.seg, { borderColor: escucha === e ? colors.accent : colors.border, backgroundColor: escucha === e ? colors.accentSoft : colors.background }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{dur}</Text>
                </Pressable>
              ))}
            </View>

            {escucha === 'completo' && (
              <Reproductor
                partes={['Título', ...m.secciones.filter((s) => s.texto.trim()).map((s) => s.titulo), ...(m.anuncios?.trim() ? ['Anuncios'] : [])]}
                narrador={completo}
                colors={colors}
              />
            )}
            {escucha === 'repaso' &&
              (practicarConv.busy ? (
                <View style={styles.centerRow}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={{ color: colors.muted }}>Preparando el repaso de tu mensaje…</Text>
                </View>
              ) : practicarConv.error && !repasoTexto ? (
                <Fallo error={practicarConv.error} onRetry={() => convs.retry('practicar')} colors={colors} />
              ) : repasoTexto ? (
                <>
                  <Reproductor partes={partesDelRepaso(repasoTexto).map((_, i) => (i === 0 ? 'La idea central' : `Parte ${i}`))} narrador={repaso} colors={colors} />
                  <View style={[styles.repaso, { borderColor: colors.border }]}>
                    {partesDelRepaso(repasoTexto).map((t, i) => {
                      const suenaAqui = repaso.sonando && repaso.actual === i;
                      return (
                        <Pressable key={i} onPress={() => repaso.leer(i)} accessibilityRole="button" accessibilityHint="Escuchar desde aquí">
                          <Text style={[styles.repasoText, { color: suenaAqui ? colors.text : colors.muted }, suenaAqui && { fontWeight: '600' }]}>{t}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {repasoViejo && (
                    <Pressable onPress={() => convs.run('practicar', [])} style={styles.rehacer} accessibilityRole="button">
                      <RefreshIcon color={colors.accent} size={14} />
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Cambiaste el texto: rehacer el repaso</Text>
                    </Pressable>
                  )}
                </>
              ) : null)}
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 10 }}>
              Con la voz de tu teléfono, gratis. Escúchalo varias veces antes de exponerlo.
            </Text>
          </Appear>
        )}

        {m.secciones.map((s, i) => {
          const on = editando === s.id;
          const suena = suenaId === s.id;
          return (
            <View
              key={s.id}
              style={[styles.parte, { backgroundColor: colors.surface, borderColor: suena ? colors.warm : colors.border }, suena && { borderWidth: 1.5 }]}
            >
              <View style={styles.parteHead}>
                <Text style={[styles.parteTitulo, { color: colors.text }]}>{s.titulo}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{s.minutos} min</Text>
              </View>
              {on ? (
                <>
                  <Field
                    value={s.texto}
                    onChangeText={(t) => actualizarSeccion(m.id, s.id, { texto: t })}
                    multiline
                    autoFocus
                    accessibilityLabel={`Texto de ${s.titulo}`}
                    style={{ fontFamily: serif, fontSize: 17, lineHeight: 26, minHeight: 160 }}
                  />
                  <Button label="Listo" icon={CheckIcon} kind="outline" onPress={() => setEditando(null)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
                </>
              ) : (
                <Pressable onPress={() => setEditando(s.id)} accessibilityRole="button" accessibilityHint="Toca para editar esta parte">
                  {s.texto.trim() ? (
                    s.texto
                      .split(/\n\s*\n/)
                      .filter((p) => p.trim())
                      .map((p, j) => (
                        <Text key={j} style={[styles.parrafo, { color: colors.text }]}>
                          {p.trim()}
                        </Text>
                      ))
                  ) : (
                    <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Vacía. Toca para escribir.</Text>
                  )}
                </Pressable>
              )}
              {!!s.dinamica && (
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>
                  Dinámica · <Text style={{ color: colors.text, fontWeight: '700' }}>{dinamica(s.dinamica)?.nombre ?? s.dinamica}</Text>
                </Text>
              )}
              {!!s.claves?.trim() && (
                <View style={[styles.claves, { borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.muted, marginBottom: 4 }]}>PARA TENER A MANO</Text>
                  {s.claves
                    .split('\n')
                    .filter((c) => c.trim())
                    .map((c, j) => (
                      <Text key={j} style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
                        · {c.trim()}
                      </Text>
                    ))}
                </View>
              )}
              {!on && (
                <Pressable onPress={() => setEditando(s.id)} style={styles.editar} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Editar ${s.titulo}`}>
                  <PencilIcon color={colors.muted} size={14} />
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>{i === 0 && !editando ? 'Toca una parte para editarla' : 'Editar'}</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <Text style={[styles.label, { color: colors.muted, marginTop: 24 }]}>ANUNCIOS AL FINAL</Text>
        <Field
          value={m.anuncios ?? ''}
          onChangeText={(t) => actualizarMensaje(m.id, { anuncios: t })}
          multiline
          placeholder="Uno por línea: el retiro del 22, la ofrenda para la familia Ruiz…"
          accessibilityLabel="Anuncios al final"
        />

        {turnos.length > 0 && (
          <>
            <Text style={[styles.label, { color: colors.muted, marginTop: 28 }]}>CAMBIOS QUE PEDISTE</Text>
            {turnos.map((t, ti) =>
              t.role === 'user' ? (
                <View key={ti} style={[styles.pedido, { backgroundColor: colors.accentSoft }]}>
                  <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{t.text}</Text>
                </View>
              ) : (
                <Respuesta
                  key={ti}
                  m={m}
                  text={t.text}
                  sources={t.sources ?? []}
                  busy={cambiarConv.busy && ti === turnos.length - 1}
                  estados={estados}
                  clave={(j) => `${ti}:${j}`}
                  onAceptar={aceptar}
                  onDescartar={(k) => setEstados((e) => ({ ...e, [k]: 'descartado' }))}
                  onOtra={() => convs.ask('cambiar', `${turnos[ti - 1]?.text ?? ''}\n\nDame otra versión distinta de este cambio.`)}
                  onCite={setPeek}
                  colors={colors}
                />
              ),
            )}
            {cambiarConv.error && <Fallo error={cambiarConv.error} onRetry={() => convs.retry('cambiar')} colors={colors} />}
          </>
        )}

        <View style={{ gap: 10, marginTop: 28 }}>
          {!m.terminado && (
            <Button
              label="Lo doy por terminado"
              icon={CheckIcon}
              onPress={() => {
                terminarMensaje(m.id);
                navigate(() => router.push(`/taller/${m.id}/documento`), 'forward');
              }}
            />
          )}
          <Button label="Editarlo paso a paso" icon={PencilIcon} kind="quiet" onPress={() => navigate(() => router.push(`/taller/${m.id}`), 'forward')} />
        </View>
        <Text style={[styles.nota, { color: colors.muted }]}>
          Las referencias entre paréntesis dicen de dónde salió cada idea. La app revisa los versículos citados, pero léelo con calma: el
          mensaje es tuyo.
        </Text>
      </ScrollView>

      {peek && <SourcePeek source={peek} colors={colors} onOpen={open} onClose={() => setPeek(null)} version={settings.version} />}
      {!sinPasaje && (
        <AskBar
          value={pedido}
          onChange={setPedido}
          onSend={pedir}
          placeholder="Pide un cambio: «cambia el punto 2 con Isaías 43:2»"
          busy={cambiarConv.busy}
          onStop={() => convs.stop('cambiar')}
          sendLabel="Pedir cambio"
          colors={colors}
        />
      )}
      {presentar && <ComoPresentar m={m} books={books} onClose={() => setPresentar(false)} />}
    </View>
  );
}

function Accion({ icon: Icon, label, onPress, on, colors }: { icon: (p: IconProps) => ReactNode; label: string; onPress: () => void; on?: boolean; colors: Colors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.accion,
        { backgroundColor: on ? colors.accent : colors.accentSoft },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Icon color={on ? colors.surface : colors.text} size={16} />
      <Text style={{ color: on ? colors.surface : colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Los controles para escuchar: la parte que suena, ⏮ ▶ ⏭. */
function Reproductor({ partes, narrador, colors }: { partes: string[]; narrador: ReturnType<typeof useNarrador>; colors: Colors }) {
  const { actual, sonando, leer, parar } = narrador;
  const i = actual ?? 0;
  return (
    <View style={styles.reproductor}>
      <Text style={{ color: sonando ? colors.warm : colors.muted, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
        {sonando ? `Sonando · ${partes[i] ?? ''}` : `${partes.length} partes`}
      </Text>
      <Pressable onPress={() => leer(Math.max(0, i - 1))} disabled={!sonando || i === 0} hitSlop={8} accessibilityLabel="Parte anterior" style={{ opacity: !sonando || i === 0 ? 0.35 : 1 }}>
        <BackIcon color={colors.text} size={22} />
      </Pressable>
      <Pressable
        onPress={() => (sonando ? parar() : leer(0))}
        accessibilityLabel={sonando ? 'Pausar' : 'Escuchar'}
        style={[styles.play, { backgroundColor: colors.accent }]}
      >
        {sonando ? <PauseIcon color={colors.surface} size={20} /> : <PlayIcon color={colors.surface} size={20} />}
      </Pressable>
      <Pressable
        onPress={() => leer(Math.min(partes.length - 1, i + 1))}
        disabled={!sonando || i >= partes.length - 1}
        hitSlop={8}
        accessibilityLabel="Parte siguiente"
        style={{ opacity: !sonando || i >= partes.length - 1 ? 0.35 : 1 }}
      >
        <ForwardIcon color={colors.text} size={22} />
      </Pressable>
    </View>
  );
}

/** Una respuesta a un pedido de cambio: lo que hizo y cada cambio con el antes y el después para aceptarlo o no. */
function Respuesta({
  m,
  text: t,
  sources,
  busy,
  estados,
  clave,
  onAceptar,
  onDescartar,
  onOtra,
  onCite,
  colors,
}: {
  m: Mensaje;
  text: string;
  sources: Source[];
  busy: boolean;
  estados: Record<string, Estado>;
  clave: (j: number) => string;
  onAceptar: (k: string, c: Cambio, sources: Source[]) => void;
  onDescartar: (k: string) => void;
  onOtra: () => void;
  onCite: (s: Source) => void;
  colors: Colors;
}) {
  const { resumen, cambios } = leerCambios(t);
  if (!t && busy) {
    return (
      <View style={styles.centerRow}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.muted }}>Leyendo tu borrador y las fuentes…</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 10, marginTop: 10 }}>
      {!!resumen && <Markdown text={resumen} colors={colors} sources={sources} onCite={onCite} />}
      {cambios.map((c, j) => {
        const k = clave(j);
        const estado = estados[k];
        const antes = antesDe(m, c);
        const vale = valeCambio(m, c);
        return (
          <Appear key={j} style={[styles.cambio, { backgroundColor: colors.surface, borderColor: estado === 'aceptado' ? colors.accent : colors.border }]}>
            <Text style={[styles.label, { color: colors.muted, marginBottom: 6 }]}>{parteDe(m, c).toUpperCase()}</Text>
            {!!antes && !estado && (
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, textDecorationLine: 'line-through', marginBottom: 6 }} numberOfLines={3}>
                {antes}
              </Text>
            )}
            <Markdown text={c.texto || c.titulo || ''} colors={colors} sources={sources} onCite={onCite} />
            {!busy &&
              (estado ? (
                <Text style={{ color: estado === 'aceptado' ? colors.accent : colors.muted, fontWeight: '700', fontSize: 13, marginTop: 8 }}>
                  {estado === 'aceptado' ? '✓ Aplicado al borrador' : 'Descartado'}
                </Text>
              ) : vale ? (
                <View style={styles.botones}>
                  <Button label="Aceptar" icon={CheckIcon} onPress={() => onAceptar(k, c, sources)} style={{ flex: 1 }} />
                  <Button label="Descartar" icon={CloseIcon} kind="outline" onPress={() => onDescartar(k)} style={{ flex: 1 }} />
                </View>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>Esa parte ya no está en el borrador.</Text>
              ))}
          </Appear>
        );
      })}
      {!busy && cambios.length > 0 && (
        <Pressable onPress={onOtra} style={styles.rehacer} accessibilityRole="button">
          <SparkIcon color={colors.accent} size={14} />
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Otra versión de este cambio</Text>
        </Pressable>
      )}
    </View>
  );
}

function Fallo({ error, onRetry, colors }: { error: string; onRetry: () => void; colors: Colors }) {
  if (error === NEEDS_CONNECTION) return <NeedsConnection title="La IA necesita internet" intro="Tu borrador está guardado. Pide el cambio cuando vuelvas a tener conexión." />;
  if (error === NEEDS_ACCOUNT) return <Welcome kind="ia" title="Cambia tu borrador con IA" intro="Solo necesitas una cuenta gratuita." onReady={onRetry} />;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
      <Text style={{ color: colors.text, textAlign: 'center' }}>{error}</Text>
      <Button label="Reintentar" kind="outline" onPress={onRetry} style={{ marginTop: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 140, maxWidth: 720, width: '100%', alignSelf: 'center' },
  cabeza: { marginBottom: 14 },
  tag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  tagText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  titulo: { fontFamily: serif, fontSize: 30, lineHeight: 37 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  idea: { borderRadius: 16, padding: 16, marginBottom: 14 },
  acciones: { flexDirection: 'row', gap: 8, marginBottom: 14, maxWidth: 460 },
  accion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 10 },
  escuchar: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 16, marginBottom: 14 },
  segmento: { flexDirection: 'row', gap: 8 },
  repaso: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12, gap: 10 },
  repasoText: { fontFamily: serif, fontSize: 15, lineHeight: 23 },
  seg: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  reproductor: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  rehacer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  parte: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginTop: 12 },
  parteHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  parteTitulo: { fontFamily: serif, fontSize: 20, flex: 1, fontWeight: '700' },
  parrafo: { fontFamily: serif, fontSize: 17, lineHeight: 27, marginBottom: 10 },
  claves: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  editar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  pedido: { alignSelf: 'flex-end', borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '88%', marginTop: 14 },
  cambio: { borderWidth: 1, borderRadius: 16, padding: 14 },
  botones: { flexDirection: 'row', gap: 8, marginTop: 12 },
  nota: { fontSize: 12, lineHeight: 17, marginTop: 20, textAlign: 'center' },
});
