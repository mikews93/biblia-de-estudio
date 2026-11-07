// La vista de quien presenta un mensaje del Taller en la lectura en vivo: arriba, los mandos grandes (parte, reloj,
// anterior y siguiente) y debajo sus notas con letra que se puede agrandar. En las notas, cada cita se toca para
// mostrarla en las pantallas de todos, y las preguntas que escribió salen listas para mandarlas al grupo.
// Las notas nunca salen de este teléfono.
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CommentIcon,
  EyeIcon,
  HourglassIcon,
  LiveIcon,
  PeopleIcon,
} from '@/components/icons';
import type { Book } from '@/lib/data';
import { dinamica, pasosDe } from '@/lib/dinamicas';
import { avance, citasDeParte, minutosPlaneados, segundosDesde } from '@/lib/guion';
import { preguntasDeParte, trozosConCitas } from '@/lib/presentador';
import { type Mensaje, ideaCentral, pasajeLabel } from '@/lib/taller';
import { serif, useColors } from '@/lib/theme';
import { type Guion, clock } from '@/lib/vivo';

import { EstudioTab, type TarjetaNueva } from './Estudio';
import { Tramos, useTic } from './Guion';
import { LIVE_RED, vivoText } from './piezas';

const CLAVE_TAMANO = 'presentador-letra';
const MIN = 15;
const MAX = 34;

/** El tamaño de la letra de las notas, recordado en este navegador (en la app, mientras dure la sala). */
export function useLetraNotas() {
  const [size, setSize] = useState(() => {
    if (Platform.OS !== 'web') return 20;
    try {
      const n = Number(localStorage.getItem(CLAVE_TAMANO));
      return n >= MIN && n <= MAX ? n : 20;
    } catch {
      return 20;
    }
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(CLAVE_TAMANO, String(size));
    } catch {
      // Sin almacenamiento (ventana privada): se queda en esta sesión.
    }
  }, [size]);
  return [size, (d: number) => setSize((n) => Math.max(MIN, Math.min(MAX, n + d)))] as const;
}

/** Los mandos de quien presenta: en qué parte va, el reloj grande, la letra y los botones para pasar de parte. */
export function MandosPresentador({
  guion: g,
  skew,
  onParte,
  size,
  onSize,
}: {
  guion: Guion;
  skew: number;
  onParte: (parte: number) => void;
  size: number;
  onSize: (d: number) => void;
}) {
  const colors = useColors();
  useTic();
  const enLaParte = segundosDesde(g.desde, skew);
  const total = segundosDesde(g.inicio, skew);
  const p = g.parte >= 0 ? g.partes[g.parte] : null;
  const plan = minutosPlaneados(g.partes);
  const pasado = !!p?.minutos && enLaParte > p.minutos * 60;
  const ultima = g.parte >= g.partes.length - 1;
  const siguiente = !ultima ? g.partes[g.parte + 1] : null;

  return (
    <View
      style={[styles.mandos, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={p ? `Parte ${g.parte + 1} de ${g.partes.length}: ${p.titulo}` : `Antes de empezar: ${g.titulo}`}
    >
      <View style={styles.fila}>
        <Text style={[vivoText.kicker, { color: colors.warm, flex: 1 }]} numberOfLines={1}>
          {p ? `PARTE ${g.parte + 1} DE ${g.partes.length}` : 'ANTES DE EMPEZAR'}
        </Text>
        <Pressable
          onPress={() => onSize(-2)}
          disabled={size <= MIN}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Letra de las notas más pequeña"
          style={[styles.letra, { borderColor: colors.border }, size <= MIN && { opacity: 0.35 }]}
        >
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>A−</Text>
        </Pressable>
        <Pressable
          onPress={() => onSize(2)}
          disabled={size >= MAX}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Letra de las notas más grande"
          style={[styles.letra, { borderColor: colors.border }, size >= MAX && { opacity: 0.35 }]}
        >
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>A+</Text>
        </Pressable>
      </View>

      <Tramos partes={g.partes} parte={g.parte} enLaParte={enLaParte} alto={6} />

      <View style={styles.fila}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={2}>
            {p ? p.titulo : g.titulo}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 13.5,
              marginTop: 3,
              fontVariant: ['tabular-nums'],
            }}
            numberOfLines={1}
          >
            {p
              ? `Total ${clock(total)}${plan ? ` de ${plan} min` : ''} · ${Math.round(avance(g, enLaParte) * 100)} %`
              : `${g.partes.length} partes${plan ? ` · ${plan} min` : ''}`}
          </Text>
        </View>
        {p && (
          <View
            style={[
              styles.reloj,
              {
                backgroundColor: pasado ? 'rgba(200,70,47,0.12)' : colors.accentSoft,
              },
            ]}
            accessibilityLabel={`Llevas ${clock(enLaParte)} en esta parte${p.minutos ? ` de ${p.minutos} minutos` : ''}`}
          >
            <HourglassIcon color={pasado ? LIVE_RED : colors.text} size={16} strokeWidth={2} />
            <Text style={[styles.relojTexto, { color: pasado ? LIVE_RED : colors.text }]}>
              {clock(enLaParte)}
              {p.minutos ? (
                <Text
                  style={{
                    color: pasado ? LIVE_RED : colors.muted,
                    fontWeight: '600',
                    fontSize: 15,
                  }}
                >
                  {' '}
                  / {p.minutos}:00
                </Text>
              ) : null}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.fila}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onParte(g.parte - 1)}
          disabled={g.parte < 0}
          accessibilityLabel="Parte anterior"
          style={({ pressed }) => [
            styles.boton,
            styles.anterior,
            { borderColor: colors.border },
            g.parte < 0 && { opacity: 0.35 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <ChevronLeftIcon color={colors.text} size={22} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onParte(g.parte + 1)}
          disabled={ultima}
          accessibilityLabel={p ? 'Parte siguiente' : 'Empezar la parte 1'}
          style={({ pressed }) => [
            styles.boton,
            styles.siguiente,
            { backgroundColor: colors.warm },
            ultima && { opacity: 0.35 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1,
              }}
            >
              {p ? (ultima ? 'ÚLTIMA PARTE' : 'SIGUIENTE') : 'EMPEZAR'}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
              {siguiente ? siguiente.titulo : p ? 'Fin del mensaje' : g.titulo}
            </Text>
          </View>
          <ChevronRightIcon color="#FFFFFF" size={22} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Las notas de la parte: lo que escribiste y tus puntos, con cada cita lista para mostrarla a todos; las preguntas
 * que escribiste, para conversarlas o para que cada uno responda; y la dinámica explicada como la ven todos.
 */
export function NotasPresentador({
  m,
  parte,
  books,
  size,
  enPantalla,
  preguntaActual,
  onMostrar,
  onPregunta,
  onDinamica,
  estudio,
  onPut,
}: {
  m: Mensaje;
  parte: number;
  books: Book[];
  size: number;
  /** ¿Esta cita es lo que se ve ahora en las pantallas de todos? */
  enPantalla: (cita: string) => boolean;
  /** La pregunta que está ahora en las pantallas, si es una. */
  preguntaActual: string | null;
  onMostrar: (cita: string) => void;
  onPregunta: (pregunta: string, cadaUno: boolean) => void;
  onDinamica: () => void;
  /** El capítulo que se ve ahora: su estudio Profundo se abre aquí para mandar secciones a todos. */
  estudio?: {
    libro: string;
    capitulo: number;
    nombre: string;
    version: string;
  };
  onPut: (t: TarjetaNueva) => void;
}) {
  const colors = useColors();
  const [abiertas, setAbiertas] = useState(true);
  const [conEstudio, setConEstudio] = useState(false);
  const s = parte >= 0 ? m.secciones[parte] : undefined;
  const pasaje = m.pasaje ? pasajeLabel(m.pasaje, books) : null;
  const Chevron = abiertas ? ChevronUpIcon : ChevronDownIcon;

  // Antes de empezar: el título, la idea central y el pasaje del mensaje.
  if (parte < 0 || !s) {
    if (parte >= m.secciones.length) return null;
    return (
      <View style={[styles.notas, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[vivoText.kicker, { color: colors.muted }]}>TUS NOTAS · SOLO TÚ LAS VES</Text>
        {ideaCentral(m) ? (
          <Text
            style={{
              color: colors.text,
              fontFamily: serif,
              fontSize: size * 1.05,
              lineHeight: size * 1.5,
              fontStyle: 'italic',
              marginTop: 10,
            }}
          >
            {ideaCentral(m)}
          </Text>
        ) : null}
        {pasaje && (
          <View style={styles.chips}>
            <ChipCita label={pasaje} activa={enPantalla(pasaje)} onPress={() => onMostrar(pasaje)} />
          </View>
        )}
        <Text
          style={{
            color: colors.muted,
            fontSize: 14,
            lineHeight: 20,
            marginTop: 12,
          }}
        >
          Cuando empieces, aquí verás las notas de cada parte. Toca cualquier cita para mostrarla en las pantallas de todos.
        </Text>
      </View>
    );
  }

  const citas = citasDeParte(s, books, m.pasaje);
  if (pasaje && !citas.includes(pasaje)) citas.push(pasaje);
  const preguntas = preguntasDeParte(s);
  const d = dinamica(s.dinamica);
  const pasos = pasosDe(s);
  const claves = (s.claves ?? '')
    .split('\n')
    .map((c) => c.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
  const vacio = !s.texto.trim() && !claves.length;

  /** Un texto con sus citas tocables: la que está en pantalla se marca. */
  const conCitas = (texto: string, estilo: object) => (
    <Text style={estilo}>
      {trozosConCitas(texto, books, m.pasaje).map((t, i, todos) =>
        todos.length === 1 && !t.cita ? (
          t.texto
        ) : t.cita ? (
          <Text
            key={i}
            onPress={() => onMostrar(t.cita!)}
            role="button"
            accessibilityLabel={`Mostrar ${t.cita} a todos`}
            style={[
              styles.citaEnTexto,
              { color: colors.accent, textDecorationColor: colors.accent },
              enPantalla(t.cita) && {
                backgroundColor: colors.warmSoft,
                color: colors.warm,
              },
            ]}
          >
            {t.texto}
          </Text>
        ) : (
          <Text key={i}>{t.texto}</Text>
        ),
      )}
    </Text>
  );

  return (
    <View style={[styles.notas, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={() => setAbiertas(!abiertas)} accessibilityRole="button" aria-expanded={abiertas} style={styles.cabeza}>
        <Text style={[vivoText.kicker, { color: colors.muted, flex: 1 }]}>TUS NOTAS · SOLO TÚ LAS VES</Text>
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{abiertas ? 'Ocultar' : 'Ver notas'}</Text>
        <Chevron color={colors.accent} size={14} />
      </Pressable>

      {abiertas && (
        <>
          {vacio ? (
            <Text style={{ color: colors.muted, fontSize: 15, marginTop: 10 }}>No escribiste notas para esta parte.</Text>
          ) : (
            <>
              {!!s.texto.trim() &&
                s.texto
                  .trim()
                  .split(/\n{2,}/)
                  .map((par, i) => (
                    <View key={i} style={{ marginTop: i ? size * 0.6 : 10 }}>
                      {conCitas(par.trim(), {
                        color: colors.text,
                        fontFamily: serif,
                        fontSize: size,
                        lineHeight: size * 1.5,
                      })}
                    </View>
                  ))}
              {claves.length > 0 && (
                <View style={[styles.claves, { borderColor: colors.border }]}>
                  {claves.map((c, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        gap: 12,
                        marginTop: i ? 10 : 0,
                      }}
                    >
                      <View
                        style={[
                          styles.punto,
                          {
                            backgroundColor: colors.warm,
                            marginTop: size * 0.55,
                          },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        {conCitas(c, {
                          color: colors.text,
                          fontSize: size * 0.95,
                          lineHeight: size * 1.4,
                          fontWeight: '600',
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </>
      )}

      {citas.length > 0 && (
        <View style={styles.bloque}>
          <Text style={[vivoText.kicker, { color: colors.muted }]}>MOSTRAR A TODOS</Text>
          <View style={styles.chips}>
            {citas.map((c) => (
              <ChipCita key={c} label={c} activa={enPantalla(c)} onPress={() => onMostrar(c)} />
            ))}
          </View>
        </View>
      )}

      {preguntas.length > 0 && (
        <View style={styles.bloque}>
          <Text style={[vivoText.kicker, { color: colors.muted }]}>TUS PREGUNTAS PARA EL GRUPO</Text>
          {preguntas.map((q) => {
            const ahora = preguntaActual === q;
            return (
              <View
                key={q}
                style={[
                  styles.pregunta,
                  {
                    borderColor: ahora ? colors.warm : colors.border,
                    backgroundColor: ahora ? colors.warmSoft : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: serif,
                    fontSize: size * 0.9,
                    lineHeight: size * 1.3,
                  }}
                >
                  {q}
                </Text>
                {ahora ? (
                  <View style={styles.fila}>
                    <LiveIcon color={colors.warm} size={15} strokeWidth={2} />
                    <Text
                      style={{
                        color: colors.warm,
                        fontWeight: '800',
                        fontSize: 13,
                      }}
                    >
                      En las pantallas de todos
                    </Text>
                  </View>
                ) : (
                  <View style={styles.acciones}>
                    <Pressable
                      onPress={() => onPregunta(q, false)}
                      accessibilityRole="button"
                      accessibilityLabel={`Conversar: ${q}`}
                      style={({ pressed }) => [styles.accion, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.75 }]}
                    >
                      <CommentIcon color={colors.text} size={15} />
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: '700',
                          fontSize: 13.5,
                        }}
                      >
                        Para conversar
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onPregunta(q, true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Que cada uno responda: ${q}`}
                      style={({ pressed }) => [styles.accion, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.75 }]}
                    >
                      <PeopleIcon color={colors.text} size={15} />
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: '700',
                          fontSize: 13.5,
                        }}
                      >
                        Que cada uno responda
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {d && pasos && (
        <View style={[styles.bloque, styles.dinamica, { backgroundColor: colors.accentSoft }]}>
          <Text style={[vivoText.kicker, { color: colors.warm }]}>DINÁMICA · {d.minutos} MIN</Text>
          <Text
            style={{
              color: colors.text,
              fontFamily: serif,
              fontWeight: '700',
              fontSize: size * 0.95,
            }}
          >
            {d.nombre}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: size * 0.72,
              lineHeight: size * 1.05,
            }}
          >
            {d.objetivo}
          </Text>
          {pasos.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <View style={[styles.numero, { backgroundColor: colors.surface }]}>
                <Text
                  style={{
                    color: colors.warm,
                    fontWeight: '800',
                    fontSize: 13,
                  }}
                >
                  {i + 1}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: size * 0.8,
                  lineHeight: size * 1.18,
                  flex: 1,
                }}
              >
                {p}
              </Text>
            </View>
          ))}
          <Pressable
            onPress={onDinamica}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.accion,
              {
                backgroundColor: colors.warm,
                alignSelf: 'flex-start',
                marginTop: 6,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <EyeIcon color="#FFFFFF" size={15} />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Mostrar la dinámica a todos</Text>
          </Pressable>
        </View>
      )}

      {estudio && (
        <View style={[styles.bloque, styles.estudio, { borderColor: colors.border }]}>
          <Pressable onPress={() => setConEstudio(!conEstudio)} accessibilityRole="button" aria-expanded={conEstudio} style={styles.cabeza}>
            <View style={{ flex: 1 }}>
              <Text style={[vivoText.kicker, { color: colors.muted }]}>ESTUDIO DE {estudio.nombre.toUpperCase()}</Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14.5,
                  lineHeight: 20,
                  marginTop: 4,
                }}
              >
                Contexto, palabras originales y preguntas del estudio Profundo, para mandarlas a todos.
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{conEstudio ? 'Cerrar' : 'Abrir'}</Text>
            {conEstudio ? <ChevronUpIcon color={colors.accent} size={14} /> : <ChevronDownIcon color={colors.accent} size={14} />}
          </Pressable>
          {conEstudio && (
            <View style={{ marginTop: 6 }}>
              <EstudioTab libro={estudio.libro} capitulo={estudio.capitulo} nombre={estudio.nombre} version={estudio.version} onPut={onPut} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ChipCita({ label, activa, onPress }: { label: string; activa: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={activa ? `${label}, en las pantallas de todos` : `Mostrar ${label} a todos`}
      style={({ pressed }) => [
        styles.chip,
        activa ? { backgroundColor: colors.warm, borderColor: colors.warm } : { borderColor: colors.border, backgroundColor: colors.background },
        pressed && { opacity: 0.75 },
      ]}
    >
      {activa ? <LiveIcon color="#FFFFFF" size={14} strokeWidth={2.2} /> : <EyeIcon color={colors.accent} size={14} />}
      <Text
        style={{
          color: activa ? '#FFFFFF' : colors.text,
          fontWeight: '700',
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mandos: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  letra: {
    width: 38,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontFamily: serif,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  reloj: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  relojTexto: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  boton: {
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anterior: { width: 58, borderWidth: 1 },
  siguiente: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 22,
    paddingRight: 16,
  },
  notas: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginTop: 14,
  },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  citaEnTexto: {
    fontWeight: '700',
    textDecorationLine: 'underline',
    borderRadius: 4,
  },
  claves: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
    paddingTop: 14,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  bloque: { marginTop: 18, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  pregunta: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  dinamica: { borderRadius: 16, padding: 16, gap: 6 },
  estudio: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, gap: 0 },
  numero: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
