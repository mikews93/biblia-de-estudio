import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { InteraccionEvento, LanzarInteraccion } from '@/components/evento/Interaccion';
import { CitaDesplegable, EstadoPill, LiveDot, useEventoEnVivo } from '@/components/evento/piezas';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CommentIcon, HourglassIcon, LiveIcon, MegaphoneIcon, PencilIcon, ScreenIcon, ShareIcon } from '@/components/icons';
import { Tramos, useTic } from '@/components/vivo/Guion';
import { LIVE_RED } from '@/components/vivo/piezas';
import { useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import {
  Evento,
  Seguido,
  codigoLegible,
  enlaceEvento,
  guardarNotaEvento,
  limpiarCodigo,
  moverEvento,
  notasComoTexto,
  useEventosSeguidos,
} from '@/lib/eventos';
import { minutosPlaneados, segundosDesde } from '@/lib/guion';
import { ANUNCIOS, pasajeLabel } from '@/lib/taller';
import { clock } from '@/lib/vivo';
import { huella } from '@/lib/sellos';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** El último punto, con los anuncios del mensaje (src/lib/eventos.ts contenidoDe): con megáfono en vez de número. */
const esAnuncios = (p: { titulo: string } | undefined, i: number, total: number) => !!p && i === total - 1 && p.titulo === ANUNCIOS;

/**
 * La página del evento para la congregación: el bosquejo que avanza en vivo, los versículos de cada punto a un
 * toque y las notas propias. Quien lo publicó ve además los controles para avanzar, empezar y terminar.
 */
export default function EventoScreen() {
  const { codigo: raw } = useLocalSearchParams<{ codigo: string }>();
  const codigo = limpiarCodigo(raw ?? '');
  const colors = useColors();
  const { usuario } = useAccount();
  const { evento, error, propio, aplicar } = useEventoEnVivo(codigo);
  const { seguidos } = useEventosSeguidos();
  const guardado = seguidos[codigo];
  const [books, setBooks] = useState<Book[]>([]);
  const [seguir, setSeguir] = useState(true);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const posiciones = useRef<Record<number, number>>({});
  const listaY = useRef(0);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  // Seguir en vivo el evento de la iglesia es un sello de Mis sellos
  const enVivo = evento?.estado === 'en-vivo';
  useEffect(() => {
    if (enVivo) huella('evento', codigo);
  }, [enVivo, codigo]);

  // Cuando quien predica lanza algo para responder, la página sube hasta ahí.
  const interaccionY = useRef(0);
  const interaccion = evento?.estado === 'en-vivo' ? evento.interaccion?.id : undefined;
  useEffect(() => {
    if (!interaccion) return;
    const t = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, interaccionY.current - 16), animated: true }), 150);
    return () => clearTimeout(t);
  }, [interaccion]);

  // Al avanzar quien predica, la página baja sola hasta el punto nuevo (si se sigue en vivo y no hay nada para responder).
  const punto = evento?.punto ?? -1;
  useEffect(() => {
    if (!seguir || !evento || evento.estado !== 'en-vivo' || punto < 0 || evento.interaccion) return;
    const t = setTimeout(() => {
      const y = posiciones.current[punto];
      if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, listaY.current + y - 90), animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [punto, seguir, evento?.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!evento) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Evento' }} />
        {error ? (
          <View style={styles.notFound}>
            <Text style={[text.title, { color: colors.text, textAlign: 'center' }]}>{error.status === 404 ? 'No encontramos el evento' : 'No se pudo abrir'}</Text>
            <Text style={[text.body, { color: colors.muted, textAlign: 'center', marginTop: 8 }]}>{error.message}</Text>
            <Button label="Escribir otro código" kind="outline" onPress={() => router.replace('/eventos')} style={{ marginTop: 22 }} />
          </View>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const vivo = evento.estado === 'en-vivo';
  const terminado = evento.estado === 'terminado';
  const pasaje = pasajeLabel(evento.pasaje, books);
  // Lo que ya se vio queda aunque el servidor ahora no lo mande (por ejemplo, si quien predica retrocede).
  const puntos = guardado && guardado.puntos.length > evento.puntos.length ? guardado.puntos : evento.puntos;
  const faltan = evento.total - puntos.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView ref={scroll} contentContainerStyle={[styles.page, { paddingBottom: propio ? 260 : 90 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, !isDark(colors) && styles.heroShadow]}>
          <View style={styles.heroTop}>
            <EstadoPill estado={evento.estado} colors={colors} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>{codigoLegible(evento.codigo)}</Text>
          </View>
          {!!pasaje && <Text style={[styles.kicker, { color: colors.warm }]}>{pasaje.toUpperCase()}</Text>}
          <Text style={[styles.title, { color: colors.text }]}>{evento.titulo}</Text>
          <View style={styles.byline}>
            <Avatar name={evento.autor} size={28} />
            <Text style={{ color: colors.muted, fontSize: 14, flexShrink: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{evento.autor}</Text>
              {evento.iglesia ? ` · ${evento.iglesia}` : ''}
            </Text>
          </View>
          {!!evento.idea && (
            <View style={[styles.idea, { borderColor: colors.warm }]}>
              <Text style={[styles.ideaLabel, { color: colors.muted }]}>IDEA CENTRAL</Text>
              <Text style={[styles.ideaText, { color: colors.text }]}>{evento.idea}</Text>
            </View>
          )}
          {!!pasaje && evento.pasaje?.from && (
            <View style={{ marginTop: 14 }}>
              <CitaDesplegable label={pasaje} books={books} version={evento.version} />
            </View>
          )}
        </View>

        <View onLayout={(e) => (interaccionY.current = e.nativeEvent.layout.y)}>
          <InteraccionEvento evento={evento} propio={propio} onCambio={aplicar} />
        </View>

        {evento.estado === 'pronto' && (
          <Aviso colors={colors} titulo="Empieza pronto">
            Deja esta página abierta: los puntos aparecen aquí a medida que avance el mensaje. Mientras, puedes leer el pasaje.
          </Aviso>
        )}
        {terminado && guardado && <Terminado s={guardado} pasaje={pasaje} colors={colors} />}

        <View onLayout={(e) => (listaY.current = e.nativeEvent.layout.y)} style={{ marginTop: 22 }}>
          {puntos.map((p, i) => {
            const actual = vivo && i === evento.punto;
            const pasado = !terminado && i < evento.punto;
            const ultimo = i === puntos.length - 1 && faltan === 0;
            return (
              <View key={i} onLayout={(e) => (posiciones.current[i] = e.nativeEvent.layout.y)} style={styles.row}>
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.num,
                      { borderColor: actual ? colors.warm : colors.border, backgroundColor: actual ? colors.warm : colors.surface },
                    ]}
                  >
                    {pasado ? (
                      <CheckIcon color={colors.muted} size={14} strokeWidth={2.4} />
                    ) : esAnuncios(p, i, evento.total) ? (
                      <MegaphoneIcon color={actual ? colors.surface : colors.warm} size={15} strokeWidth={2} />
                    ) : (
                      <Text style={{ color: actual ? colors.surface : colors.text, fontWeight: '800', fontSize: 13 }}>{i + 1}</Text>
                    )}
                  </View>
                  {!ultimo && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                </View>
                <View style={[styles.point, { backgroundColor: colors.surface, borderColor: actual ? colors.warm : colors.border }, actual && styles.pointNow]}>
                  {actual && (
                    <View style={styles.nowRow}>
                      <LiveDot color={colors.warm} size={6} />
                      <Text style={{ color: colors.warm, fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>AHORA</Text>
                    </View>
                  )}
                  <Text style={[styles.pointTitle, { color: pasado ? colors.muted : colors.text }]}>{p.titulo}</Text>
                  {!!p.texto && <Text style={[styles.pointText, { color: colors.text }]}>{p.texto}</Text>}
                  {p.citas.length > 0 && (
                    <View style={styles.citas}>
                      {p.citas.map((c) => (
                        <CitaDesplegable key={c} label={c} books={books} version={evento.version} />
                      ))}
                    </View>
                  )}
                  <Nota codigo={codigo} donde={String(i)} valor={guardado?.notas[String(i)] ?? ''} colors={colors} />
                </View>
              </View>
            );
          })}

          {faltan > 0 && (
            <View style={styles.row}>
              <View style={styles.rail}>
                <View style={[styles.num, { borderColor: colors.border, borderStyle: 'dashed', backgroundColor: 'transparent' }]}>
                  <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>{puntos.length + 1}</Text>
                </View>
              </View>
              <View style={[styles.point, styles.pending, { borderColor: colors.border }]}>
                <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
                  {faltan === 1 ? 'Falta 1 punto.' : `Faltan ${faltan} puntos.`} Aparecerán aquí cuando avance el mensaje.
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.section, { color: colors.muted }]}>MIS NOTAS</Text>
        <Card>
          <Nota codigo={codigo} donde="general" valor={guardado?.notas.general ?? ''} colors={colors} abierta />
        </Card>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 10 }}>
          {usuario ? (
            'Tus notas se guardan en tu cuenta. Las encuentras en Mis eventos.'
          ) : (
            <>
              Tus notas se guardan en este dispositivo.{' '}
              <Text onPress={() => navigate(() => router.push('/registro'), 'forward')} style={{ color: colors.accent, fontWeight: '700' }}>
                Crea una cuenta gratis
              </Text>{' '}
              para tenerlas también en tus otros dispositivos.
            </>
          )}
        </Text>
        <Pressable onPress={() => navigate(() => router.push('/eventos'), 'forward')} hitSlop={8} style={{ marginTop: 14 }}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Mis eventos ›</Text>
        </Pressable>
      </ScrollView>

      {propio ? (
        <Controles evento={evento} books={books} onCambio={aplicar} colors={colors} />
      ) : (
        vivo &&
        evento.punto >= 0 && (
          <View style={[styles.follow, { bottom: 16 }]} pointerEvents="box-none">
            <Pressable
              onPress={() => {
                setSeguir(true);
                const y = posiciones.current[evento.punto];
                if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, listaY.current + y - 90), animated: true });
              }}
              onLongPress={() => setSeguir(!seguir)}
              accessibilityRole="button"
              accessibilityLabel="Ir al punto actual"
              style={[styles.followPill, { backgroundColor: colors.text }]}
            >
              <LiveDot color={colors.warm} size={6} />
              <Text style={{ color: colors.background, fontWeight: '700', fontSize: 14 }}>
                {esAnuncios(evento.puntos[evento.punto], evento.punto, evento.total) ? 'Anuncios' : `Punto ${evento.punto + 1} de ${evento.total}`}
              </Text>
            </Pressable>
          </View>
        )
      )}
    </View>
  );
}

function Aviso({ titulo, children, colors }: { titulo: string; children: React.ReactNode; colors: Colors }) {
  return (
    <View style={[styles.aviso, { backgroundColor: colors.accentSoft }]}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{titulo}</Text>
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{children}</Text>
    </View>
  );
}

function Terminado({ s, pasaje, colors }: { s: Seguido; pasaje: string; colors: Colors }) {
  const [hecho, setHecho] = useState(false);
  const compartir = async () => {
    const message = notasComoTexto(s, pasaje);
    try {
      if (Platform.OS === 'web') throw new Error('web');
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      setHecho(true);
      setTimeout(() => setHecho(false), 2200);
    }
  };
  return (
    <View style={[styles.aviso, { backgroundColor: colors.accentSoft }]}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>El mensaje terminó</Text>
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
        Aquí quedan todos los puntos y tus notas, también en Mis eventos. Puedes volver a leerlos esta semana.
      </Text>
      <Button label={hecho ? 'Copiado' : 'Copiar mis notas'} icon={hecho ? CheckIcon : ShareIcon} kind="outline" onPress={compartir} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
    </View>
  );
}

/** La nota de un punto: cerrada es un enlace «Escribir una nota»; abierta, un campo que se guarda solo. */
function Nota({ codigo, donde, valor, colors, abierta }: { codigo: string; donde: string; valor: string; colors: Colors; abierta?: boolean }) {
  // Se escribe directo en lo guardado: así una nota que llega de otro dispositivo también se ve aquí.
  const [pedida, setPedida] = useState(false);
  const open = !!abierta || !!valor || pedida;

  if (!open) {
    return (
      <Pressable onPress={() => setPedida(true)} hitSlop={6} style={styles.noteLink} accessibilityRole="button">
        <PencilIcon color={colors.muted} size={15} />
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>Escribir una nota</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ marginTop: abierta ? 0 : 14 }}>
      <Field
        value={valor}
        onChangeText={(t) => guardarNotaEvento(codigo, donde, t)}
        placeholder={abierta ? 'Lo que Dios te habló, una oración, algo para hacer esta semana…' : 'Mi nota de este punto'}
        accessibilityLabel={abierta ? 'Mis notas del mensaje' : 'Mi nota de este punto'}
        multiline
        autoFocus={!abierta && !valor}
        style={{ backgroundColor: colors.background, minHeight: abierta ? 120 : 80 }}
      />
    </View>
  );
}

/** La barra de quien predica: avanzar los puntos, empezar y terminar, y la pantalla para proyectar. */
function Controles({ evento, books, onCambio, colors }: { evento: Evento; books: Book[]; onCambio: (e: Evento) => void; colors: Colors }) {
  const { busy, error, run } = useAction();
  const [copiado, setCopiado] = useState(false);
  const [interactuar, setInteractuar] = useState(false);
  const mover = (cambio: Parameters<typeof moverEvento>[1]) => run(async () => onCambio(await moverEvento(evento.codigo, cambio)));
  const ultimo = evento.total - 1;
  const copiar = async () => {
    await Clipboard.setStringAsync(enlaceEvento(evento.codigo));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <View style={[styles.controls, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: 12 }]}>
      <View style={styles.controlsInner}>
        <View style={styles.controlsTop}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
            TU EVENTO · {evento.estado === 'en-vivo' ? (evento.punto < 0 ? 'PORTADA' : `PUNTO ${evento.punto + 1} DE ${evento.total}`) : evento.estado === 'pronto' ? 'SIN EMPEZAR' : 'TERMINADO'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={copiar} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{copiado ? 'Copiado' : 'Copiar enlace'}</Text>
            </Pressable>
            <Pressable
              onPress={() => navigate(() => router.push(`/evento/${evento.codigo}/proyectar`), 'fade')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Proyectar"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <ScreenIcon color={colors.accent} size={15} strokeWidth={2} />
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Proyectar</Text>
            </Pressable>
          </View>
        </View>
        {evento.estado === 'en-vivo' && <Reloj evento={evento} colors={colors} />}
        {evento.estado === 'en-vivo' ? (
          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => setInteractuar(true)}
              accessibilityRole="button"
              accessibilityLabel="Interactuar: que la iglesia responda"
              style={[styles.round, { borderColor: evento.interaccion ? colors.warm : colors.border, backgroundColor: evento.interaccion ? colors.warmSoft : 'transparent' }]}
            >
              <CommentIcon color={evento.interaccion ? colors.warm : colors.text} size={19} strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => mover({ punto: evento.punto - 1 })}
              disabled={busy || evento.punto < 0}
              accessibilityRole="button"
              accessibilityLabel="Punto anterior"
              style={[styles.round, { borderColor: colors.border }, evento.punto < 0 && { opacity: 0.35 }]}
            >
              <ChevronLeftIcon color={colors.text} size={20} strokeWidth={2} />
            </Pressable>
            {evento.punto < ultimo ? (
              <Button
                label={evento.punto < 0 ? 'Mostrar el punto 1' : `Siguiente: punto ${evento.punto + 2}`}
                icon={ChevronRightIcon}
                iconAfter
                onPress={() => mover({ punto: evento.punto + 1 })}
                busy={busy}
                style={{ flex: 1 }}
              />
            ) : (
              <Button label="Terminar el evento" onPress={() => mover({ estado: 'terminado' })} busy={busy} style={{ flex: 1 }} />
            )}
          </View>
        ) : (
          <Button
            label={evento.estado === 'pronto' ? 'Empezar en vivo' : 'Volver a abrirlo en vivo'}
            icon={LiveIcon}
            kind={evento.estado === 'pronto' ? 'primary' : 'outline'}
            onPress={() => mover({ estado: 'en-vivo' })}
            busy={busy}
          />
        )}
        <ErrorText>{error}</ErrorText>
      </View>
      {interactuar && <LanzarInteraccion evento={evento} books={books} onCambio={onCambio} onClose={() => setInteractuar(false)} />}
    </View>
  );
}

/** Para quien predica: en qué punto va, cuánto lleva en él (contra los minutos que planeó) y en todo el mensaje. */
function Reloj({ evento, colors }: { evento: Evento; colors: Colors }) {
  useTic();
  const p = evento.punto >= 0 ? evento.puntos[evento.punto] : null;
  const enElPunto = segundosDesde(evento.puntoDesde);
  const total = segundosDesde(evento.inicio);
  const plan = minutosPlaneados(evento.puntos);
  const pasado = !!p?.minutos && enElPunto > p.minutos * 60;
  return (
    <View style={{ gap: 8 }}>
      <Tramos partes={evento.puntos} parte={evento.punto} enLaParte={enElPunto} />
      <View style={styles.relojRow}>
        <Text style={{ color: colors.text, fontFamily: serif, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>
          {p ? p.titulo : 'Portada'}
        </Text>
        {p && (
          <View style={[styles.relojPill, { backgroundColor: pasado ? 'rgba(200,70,47,0.12)' : colors.accentSoft }]}>
            <HourglassIcon color={pasado ? LIVE_RED : colors.text} size={13} strokeWidth={2} />
            <Text style={{ color: pasado ? LIVE_RED : colors.text, fontWeight: '800', fontSize: 13.5, fontVariant: ['tabular-nums'] }}>
              {clock(enElPunto)}
              {p.minutos ? <Text style={{ color: pasado ? LIVE_RED : colors.muted, fontWeight: '600' }}> / {p.minutos}:00</Text> : null}
            </Text>
          </View>
        )}
        <Text style={{ color: colors.muted, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>
          Total {clock(total)}
          {plan ? ` de ${plan} min` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  relojRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  relojPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFound: { maxWidth: 420, alignItems: 'center' },
  page: { padding: 16, paddingTop: 8, maxWidth: 720, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  heroShadow: { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 8px 28px rgba(60, 40, 20, 0.07)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 18 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 36, fontWeight: '700', marginTop: 4 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  idea: { borderLeftWidth: 3, paddingLeft: 14, marginTop: 18 },
  ideaLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  ideaText: { fontFamily: serif, fontStyle: 'italic', fontSize: 18, lineHeight: 26, marginTop: 4 },
  aviso: { borderRadius: 16, padding: 16, marginTop: 14 },
  row: { flexDirection: 'row', gap: 12 },
  rail: { width: 30, alignItems: 'center' },
  num: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  line: { width: 1.5, flex: 1, marginTop: 4, marginBottom: -14 },
  point: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 14 },
  pointNow: { borderWidth: 1.5, boxShadow: '0 6px 24px rgba(168, 100, 31, 0.12)' },
  pending: { borderStyle: 'dashed', borderWidth: 1, backgroundColor: 'transparent' },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -4, marginBottom: 2 },
  pointTitle: { fontFamily: serif, fontSize: 21, lineHeight: 27, fontWeight: '700' },
  pointText: { fontSize: 16, lineHeight: 24, marginTop: 8 },
  citas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  noteLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 18, marginBottom: 10 },
  follow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  followPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, paddingLeft: 10, paddingRight: 16, paddingVertical: 9, boxShadow: '0 6px 20px rgba(0,0,0,0.18)' },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingHorizontal: 16 },
  controlsInner: { maxWidth: 720, width: '100%', alignSelf: 'center', gap: 10 },
  controlsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
