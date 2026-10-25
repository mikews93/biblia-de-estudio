// Todas las opciones de un borrador o de un sermón, al mantenerlo pulsado en la lista del Taller: abrirlo, presentarlo,
// hacer una copia, pasarlo a Mis sermones (o devolverlo a borrador) y borrarlo.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CheckIcon,
  CopyIcon,
  DocumentIcon,
  type IconProps,
  PencilIcon,
  PlayIcon,
  RepeatIcon,
  TrashIcon,
} from '@/components/icons';
import { Sheet } from '@/components/vivo/piezas';
import type { Book } from '@/lib/data';
import { type Mensaje, esTerminado, pasajeLabel, tipoInfo, tituloDe } from '@/lib/taller';
import { isDark, useColors } from '@/lib/theme';

export const PELIGRO = { claro: '#B3412E', oscuro: '#E58A73' };

export type Opcion = 'abrir' | 'editar' | 'documento' | 'presentar' | 'copia' | 'terminar' | 'borrador' | 'borrar';

export default function OpcionesMensaje({ m, books, onElegir, onClose }: { m: Mensaje; books: Book[]; onElegir: (o: Opcion) => void; onClose: () => void }) {
  const colors = useColors();
  const terminado = esTerminado(m);
  const peligro = isDark(colors) ? PELIGRO.oscuro : PELIGRO.claro;
  // Se abre con el dedo todavía encima: el toque al soltarlo no debe elegir la opción que quedó debajo.
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setListo(true), 450);
    return () => clearTimeout(t);
  }, []);
  const elegir = (o: Opcion) => {
    if (!listo) return;
    onClose();
    onElegir(o);
  };
  const kicker = [tipoInfo(m.tipo).nombre, m.pasaje ? pasajeLabel(m.pasaje, books) : ''].filter(Boolean).join(' · ').toUpperCase();

  return (
    <Sheet title={tituloDe(m, books)} kicker={kicker} onClose={onClose}>
      <View style={[styles.grupo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {terminado ? (
          <>
            <Fila icon={DocumentIcon} label="Ver el documento" onPress={() => elegir('documento')} />
            <Fila icon={PencilIcon} label="Editar en el Taller" onPress={() => elegir('editar')} />
          </>
        ) : (
          <>
            <Fila icon={PencilIcon} label="Seguir escribiendo" onPress={() => elegir('abrir')} />
            <Fila icon={DocumentIcon} label="Ver cómo va el documento" onPress={() => elegir('documento')} />
          </>
        )}
        <Fila icon={PlayIcon} label="Presentarlo en vivo" detalle="En pantalla completa, en la iglesia o con tu grupo" onPress={() => elegir('presentar')} />
      </View>

      <View style={[styles.grupo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Fila
          icon={CopyIcon}
          label={terminado ? 'Adaptarlo para otra ocasión' : 'Hacer una copia'}
          detalle={terminado ? 'Una copia como borrador; este queda igual' : undefined}
          onPress={() => elegir('copia')}
        />
        {terminado ? (
          <Fila icon={RepeatIcon} label="Volver a borrador" onPress={() => elegir('borrador')} />
        ) : (
          <Fila icon={CheckIcon} label="Pasar a Mis sermones" detalle="Lo das por terminado" onPress={() => elegir('terminar')} />
        )}
      </View>

      <View style={[styles.grupo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Fila icon={TrashIcon} label={terminado ? 'Borrar este sermón' : 'Descartar el borrador'} color={peligro} onPress={() => elegir('borrar')} />
      </View>
    </Sheet>
  );
}

function Fila({ icon: Icon, label, detalle, color, onPress }: { icon: (p: IconProps) => React.ReactNode; label: string; detalle?: string; color?: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.fila, (pressed || hovered) && { backgroundColor: colors.accentSoft }]}
    >
      <Icon color={color ?? colors.text} size={20} strokeWidth={1.8} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: color ?? colors.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
        {detalle && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>{detalle}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grupo: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
});
