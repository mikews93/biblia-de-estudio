import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, CloseIcon, PencilIcon } from '@/components/icons';
import { Correccion, aplicarCorrecciones, deshacerCorrecciones, diferencias, estadoDe, leerCorrecciones } from '@/lib/correcciones';
import { Mensaje, actualizarMensaje } from '@/lib/taller';
import { Colors, serif } from '@/lib/theme';

type Props = {
  mensaje: Mensaje;
  /** La respuesta de la IA con las correcciones (vacía mientras no se han pedido). */
  text: string;
  busy: boolean;
  onPedir: () => void;
  colors: Colors;
};

const clave = (c: Correccion) => `${c.destino}\u0000${c.antes}`;

/**
 * Las correcciones de «Revisa» al texto de la persona: cada cambio marcado (lo que se quita tachado, lo que entra
 * resaltado) para aceptarlo o descartarlo, y luego se aplican de una vez al borrador, con deshacer.
 */
export default function Correcciones({ mensaje, text, busy, onPedir, colors }: Props) {
  const lista = leerCorrecciones(text, mensaje);
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set());
  const [hecho, setHecho] = useState<{ previo: Record<string, string>; n: number } | null>(null);
  const pendientes = lista.filter((c) => estadoDe(mensaje, c) === 'pendiente');
  const elegidas = pendientes.filter((c) => !descartadas.has(clave(c)));
  const sinCambios = !busy && !!text && (/^\s*SIN CAMBIOS/.test(text) || !lista.length);

  if (!text && !busy) {
    return (
      <Appear style={[styles.invite, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.inviteHead}>
          <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
            <PencilIcon color={colors.accent} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inviteTitle, { color: colors.text }]}>¿Corregimos tu texto?</Text>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>
              La IA propone ajustes puntuales a lo que ya escribiste, según esta revisión. Ves cada cambio y decides cuáles aplicar.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onPedir}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}
        >
          <Text style={{ color: colors.background, fontWeight: '700', fontSize: 15 }}>Proponer correcciones</Text>
        </Pressable>
      </Appear>
    );
  }

  const aplicar = () => {
    const { cambio, previo, aplicadas } = aplicarCorrecciones(mensaje, elegidas);
    if (!aplicadas) return;
    actualizarMensaje(mensaje.id, cambio);
    setHecho({ previo, n: aplicadas });
  };

  const deshacer = () => {
    if (!hecho) return;
    actualizarMensaje(mensaje.id, deshacerCorrecciones(mensaje, hecho.previo));
    setHecho(null);
  };

  return (
    <View style={styles.wrap} accessibilityLabel="Correcciones a tu texto">
      <Text style={[styles.kicker, { color: colors.muted }]}>CORRECCIONES A TU TEXTO</Text>
      {busy && !lista.length && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>Leyendo tu borrador frase por frase…</Text>
        </View>
      )}
      {sinCambios && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>No encontró nada que corregir en lo que escribiste.</Text>
        </View>
      )}

      {lista.map((c, i) => {
        const estado = estadoDe(mensaje, c);
        const fuera = descartadas.has(clave(c));
        const activa = estado === 'pendiente' && !fuera;
        return (
          <Appear key={`${clave(c)}-${i}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: activa ? colors.accent : colors.border }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
                {c.label.toUpperCase()}
              </Text>
              {estado === 'aplicada' ? (
                <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
                  <CheckIcon color={colors.accent} size={13} />
                  <Text style={[styles.pillText, { color: colors.accent }]}>Aplicada</Text>
                </View>
              ) : estado === 'no-coincide' ? (
                <Text style={[styles.pillText, { color: colors.muted }]}>Ya cambiaste este texto</Text>
              ) : null}
            </View>
            <Text style={[styles.diff, { color: colors.text, opacity: fuera || estado === 'no-coincide' ? 0.5 : 1 }]}>
              {diferencias(c.antes, c.despues).map((t, j) =>
                t.tipo === 'igual' ? (
                  <Text key={j}>{t.texto}</Text>
                ) : t.tipo === 'quitado' ? (
                  <Text key={j} style={[styles.quitado, { color: colors.muted, backgroundColor: colors.warmSoft }]}>
                    {t.texto}
                  </Text>
                ) : (
                  <Text key={j} style={[styles.puesto, { color: colors.text, backgroundColor: colors.highlight }]}>
                    {t.texto}
                  </Text>
                ),
              )}
            </Text>
            {!!c.porque && <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{c.porque}</Text>}
            {estado === 'pendiente' && (
              <View style={styles.choice} accessibilityRole="radiogroup">
                <Opcion on={!fuera} label="Aceptar" icon="si" colors={colors} onPress={() => setDescartadas((d) => sin(d, clave(c)))} />
                <Opcion on={fuera} label="Descartar" icon="no" colors={colors} onPress={() => setDescartadas((d) => new Set(d).add(clave(c)))} />
              </View>
            )}
          </Appear>
        );
      })}

      {hecho && (
        <Appear style={[styles.done, { backgroundColor: colors.text }]}>
          <CheckIcon color={colors.background} size={18} />
          <Text style={{ color: colors.background, fontWeight: '700', flex: 1 }}>
            {hecho.n === 1 ? 'Se aplicó 1 corrección a tu borrador' : `Se aplicaron ${hecho.n} correcciones a tu borrador`}
          </Text>
          <Pressable onPress={deshacer} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: colors.background, fontWeight: '700', textDecorationLine: 'underline' }}>Deshacer</Text>
          </Pressable>
        </Appear>
      )}
      {!busy &&
        pendientes.length > 0 &&
        !(hecho && !elegidas.length) && (
          <Pressable
            onPress={aplicar}
            disabled={!elegidas.length}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: elegidas.length ? colors.accent : colors.border }, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ color: colors.background, fontWeight: '700', fontSize: 15 }}>
              {elegidas.length === 0
                ? 'Ninguna corrección elegida'
                : elegidas.length === 1
                  ? 'Aplicar 1 corrección'
                  : `Aplicar ${elegidas.length} correcciones`}
            </Text>
          </Pressable>
        )}
    </View>
  );
}

const sin = (s: Set<string>, k: string) => {
  const next = new Set(s);
  next.delete(k);
  return next;
};

function Opcion({ on, label, icon, colors, onPress }: { on: boolean; label: string; icon: 'si' | 'no'; colors: Colors; onPress: () => void }) {
  const Icon = icon === 'si' ? CheckIcon : CloseIcon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={on}
      style={({ pressed }) => [
        styles.opcion,
        { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : 'transparent' },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Icon color={on ? colors.accent : colors.muted} size={14} />
      <Text style={{ color: on ? colors.accent : colors.muted, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, gap: 12 },
  invite: { marginTop: 24, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, gap: 14 },
  inviteHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  inviteTitle: { fontFamily: serif, fontSize: 19 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primary: { borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  center: { alignItems: 'center', paddingVertical: 24 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
  diff: { fontFamily: serif, fontSize: 16, lineHeight: 26 },
  quitado: { textDecorationLine: 'line-through' },
  puesto: { fontWeight: '600' },
  choice: { flexDirection: 'row', gap: 8, marginTop: 12 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
});
