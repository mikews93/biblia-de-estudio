// El documento de un mensaje del Taller como hoja: título, idea central, cada parte con lo escrito y sus puntos para
// hablar, y los anuncios al final. Solo muestra lo que escribió quien prepara (src/lib/documento.ts).
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Documento, ParteDoc, fechaLarga } from '@/lib/documento';
import { sans, serif, useColors } from '@/lib/theme';

export default function DocumentoVista({ d, vacio }: { d: Documento; /** Texto para las partes sin nada escrito. */ vacio?: string }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const ancho = width >= 820;
  return (
    <View
      style={[
        styles.hoja,
        { backgroundColor: colors.surface, borderColor: colors.border, padding: ancho ? 48 : 22 },
        ancho && { boxShadow: '0 18px 48px rgba(0,0,0,0.08)' },
      ]}
      accessibilityLabel={`Documento: ${d.titulo}`}
    >
      <Text style={[styles.kicker, { color: colors.muted }]}>
        {d.tipo.toUpperCase()}
        {d.minutos ? ` · ${d.minutos} MIN` : ''}
      </Text>
      <Text style={[styles.titulo, { color: colors.text, fontSize: ancho ? 34 : 27 }]}>{d.titulo}</Text>
      {!!d.pasaje && <Text style={{ color: colors.muted, fontFamily: serif, fontSize: 16, marginTop: 4 }}>{d.pasaje}</Text>}

      {d.idea ? (
        <View style={[styles.idea, { backgroundColor: colors.warmSoft, borderColor: colors.warm }]}>
          <Text style={[styles.mini, { color: colors.warm }]}>IDEA CENTRAL</Text>
          <Text style={{ color: colors.text, fontFamily: serif, fontSize: ancho ? 21 : 19, lineHeight: ancho ? 30 : 27, fontStyle: 'italic', marginTop: 4 }}>
            {d.idea}
          </Text>
        </View>
      ) : null}
      {(d.necesidad || d.gracia) && (
        <View style={{ gap: 8, marginTop: 4 }}>
          {!!d.necesidad && <Camino label="La necesidad" texto={d.necesidad} />}
          {!!d.gracia && <Camino label="La gracia" texto={d.gracia} />}
        </View>
      )}

      {d.partes.map((p) => (
        <Parte key={p.id} p={p} vacio={vacio} />
      ))}

      {d.anuncios.length > 0 && (
        <View style={[styles.anuncios, { borderColor: colors.text }]}>
          <Text style={[styles.mini, { color: colors.muted }]}>ANUNCIOS</Text>
          {d.anuncios.map((a, i) => (
            <View key={i} style={styles.vineta}>
              <View style={[styles.punto, { backgroundColor: colors.text }]} />
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, flex: 1 }}>{a}</Text>
            </View>
          ))}
        </View>
      )}

      {d.terminado && (
        <Text style={{ color: colors.muted, fontFamily: sans, fontSize: 12, marginTop: 28 }}>
          Terminado el {fechaLarga(d.terminado)}
          {d.ocasiones.length ? ` · predicado ${d.ocasiones.length === 1 ? 'una vez' : `${d.ocasiones.length} veces`}` : ''}
        </Text>
      )}
    </View>
  );
}

function Camino({ label, texto }: { label: string; texto: string }) {
  const colors = useColors();
  return (
    <Text style={{ color: colors.text, fontFamily: serif, fontSize: 15, lineHeight: 23 }}>
      <Text style={{ fontWeight: '700' }}>{label}. </Text>
      {texto}
    </Text>
  );
}

function Parte({ p, vacio }: { p: ParteDoc; vacio?: string }) {
  const colors = useColors();
  const extremo = p.rol === 'introduccion' || p.rol === 'conclusion';
  const nada = !p.parrafos.length && !p.claves.length && !p.paraGrupo.length;
  return (
    <View style={styles.parte}>
      <View style={styles.etiquetaFila}>
        {p.rol === 'punto' && (
          <View style={[styles.numero, { backgroundColor: colors.accent }]}>
            <Text style={{ color: colors.surface, fontWeight: '800', fontSize: 12 }}>{p.etiqueta.replace(/\D/g, '')}</Text>
          </View>
        )}
        <Text style={[styles.mini, { color: extremo ? colors.warm : colors.muted }]}>
          {p.etiqueta.toUpperCase()}
          {p.minutos ? <Text style={{ fontWeight: '400' }}> · {p.minutos} min</Text> : null}
        </Text>
      </View>
      {!!p.titulo && <Text style={[styles.parteTitulo, { color: colors.text }]}>{p.titulo}</Text>}
      {!!p.dinamica && (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
          Dinámica: {p.dinamica}
          {p.responsable ? ` · guía ${p.responsable}` : ''}
        </Text>
      )}
      {p.apoyo && (
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{p.apoyo.cita}</Text>
          {p.apoyo.porque ? ` · ${p.apoyo.porque}` : ''}
        </Text>
      )}
      {p.paraGrupo.map((x, i) => (
        <View key={`g${i}`} style={[styles.grupo, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{x}</Text>
        </View>
      ))}
      {p.parrafos.map((x, i) => (
        <Text key={i} style={[styles.parrafo, { color: colors.text }]}>
          {x}
        </Text>
      ))}
      {p.claves.length > 0 && (
        <View style={[styles.claves, { borderColor: colors.border }]}>
          <Text style={[styles.mini, { color: colors.muted }]}>PARA HABLAR</Text>
          {p.claves.map((c, i) => (
            <View key={i} style={styles.vineta}>
              <View style={[styles.punto, { backgroundColor: colors.warm }]} />
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, flex: 1 }}>{c}</Text>
            </View>
          ))}
        </View>
      )}
      {nada && vacio ? <Text style={{ color: colors.muted, fontStyle: 'italic', marginTop: 6 }}>{vacio}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hoja: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  kicker: { fontFamily: sans, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  titulo: { fontFamily: serif, fontWeight: '700', marginTop: 6, lineHeight: 38 },
  mini: { fontFamily: sans, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  idea: { borderLeftWidth: 3, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 20, marginBottom: 14 },
  parte: { marginTop: 26 },
  etiquetaFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numero: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  parteTitulo: { fontFamily: serif, fontSize: 21, fontWeight: '700', marginTop: 6, lineHeight: 28 },
  parrafo: { fontFamily: serif, fontSize: 16.5, lineHeight: 27, marginTop: 10 },
  grupo: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 10 },
  claves: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10, gap: 6 },
  vineta: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  punto: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  anuncios: { borderTopWidth: 2, marginTop: 34, paddingTop: 14, gap: 4 },
});
