import { StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { CheckIcon, HeartIcon, PrayIcon } from '@/components/icons';
import { VersoFila } from '@/components/Oraciones';
import type { Entrada } from '@/lib/diario';
import { Momento, Oracion, cuantoTiempo, momentos, porAno, unDiaComoHoy } from '@/lib/oraciones';
import { Colors, isDark, serif, useColors } from '@/lib/theme';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TIPO = { devocional: 'Devocional', peticion: 'Empecé a orar', respuesta: 'Dios respondió' } as const;

/**
 * «Mi camino»: a lo largo de los años, qué versículos acompañaron cada momento (los devocionales, lo que la
 * persona empezó a pedir y lo que Dios respondió), con un recuerdo de lo que vivió en esta misma fecha.
 */
export default function MiCamino({ entradas, oraciones }: { entradas: Entrada[]; oraciones: Oracion[] }) {
  const colors = useColors();
  const lista = momentos(entradas, oraciones);
  const anos = porAno(lista);
  const recuerdo = unDiaComoHoy(lista);
  const versiculos = new Set(lista.flatMap((m) => m.versiculos.map((v) => `${v.book}.${v.chapter}.${v.verse ?? ''}`))).size;
  const respondidas = oraciones.filter((o) => o.respondida).length;
  const desde = lista.length ? new Date(lista[lista.length - 1].fecha) : null;

  if (!lista.length) {
    return (
      <Appear style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Tu camino empieza hoy</Text>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          Cada devocional y cada oración quedan aquí con el versículo que te acompañó. Con los años podrás mirar atrás y ver
          cómo Dios te habló en cada momento.
        </Text>
      </Appear>
    );
  }

  return (
    <View>
      <Appear style={[styles.hero, sombra(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.warm }]}>
          {desde ? `DESDE ${MESES[desde.getMonth()].toUpperCase()} DE ${desde.getFullYear()}` : 'MI CAMINO'}
        </Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          {versiculos === 1 ? 'Un versículo te ha acompañado' : `${versiculos} versículos te han acompañado`}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
          {[
            `${entradas.length} ${entradas.length === 1 ? 'devocional' : 'devocionales'}`,
            `${oraciones.length} ${oraciones.length === 1 ? 'oración' : 'oraciones'}`,
            respondidas ? `${respondidas} ${respondidas === 1 ? 'respondida' : 'respondidas'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Appear>

      {recuerdo && (
        <Appear delay={60} style={[styles.recuerdo, { backgroundColor: colors.warmSoft }]}>
          <Text style={[styles.kickerSmall, { color: colors.warm }]}>
            {recuerdo.anos === 1 ? 'HACE UN AÑO, POR ESTOS DÍAS' : `HACE ${recuerdo.anos} AÑOS, POR ESTOS DÍAS`}
          </Text>
          <Text style={[styles.recuerdoTitle, { color: colors.text }]}>
            {recuerdo.momento.tipo === 'devocional' ? `«${recuerdo.momento.titulo}»` : recuerdo.momento.titulo}
          </Text>
          <View style={{ marginTop: 10 }}>
            <VersoFila verso={recuerdo.momento.versiculos[0]} colors={colors} acento={colors.warm} />
          </View>
        </Appear>
      )}

      {anos.map((ano, ai) => (
        <Appear key={ano.ano} delay={Math.min(ai, 3) * 60 + 80} style={{ marginTop: 10 }}>
          <View style={styles.yearHead}>
            <Text style={[styles.year, { color: colors.text }]}>{ano.ano}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, flexShrink: 1 }}>
              {ano.versiculos} {ano.versiculos === 1 ? 'versículo' : 'versículos'}
              {ano.respondidas ? ` · ${ano.respondidas} ${ano.respondidas === 1 ? 'oración respondida' : 'oraciones respondidas'}` : ''}
            </Text>
          </View>
          {ano.meses.map((mes) => (
            <View key={mes.mes}>
              <Text style={[styles.month, { color: colors.muted }]}>{MESES[mes.mes].toUpperCase()}</Text>
              {mes.momentos.map((m, i) => (
                <Paso key={m.id} momento={m} ultimo={i === mes.momentos.length - 1} colors={colors} oraciones={oraciones} />
              ))}
            </View>
          ))}
        </Appear>
      ))}
    </View>
  );
}

function Paso({ momento: m, ultimo, colors, oraciones }: { momento: Momento; ultimo: boolean; colors: Colors; oraciones: Oracion[] }) {
  const respuesta = m.tipo === 'respuesta';
  const Icono = m.tipo === 'devocional' ? HeartIcon : respuesta ? CheckIcon : PrayIcon;
  const oracion = respuesta ? oraciones.find((o) => `r-${o.id}` === m.id) : null;
  const dia = new Date(m.fecha).toLocaleDateString('es', { weekday: 'long', day: 'numeric' });
  return (
    <View style={styles.step} testID={`momento-${m.tipo}`}>
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            respuesta
              ? { backgroundColor: colors.warm, borderColor: colors.warm }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Icono color={respuesta ? colors.surface : colors.accent} size={14} strokeWidth={respuesta ? 2.6 : 1.9} />
        </View>
        {!ultimo && <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={{ flex: 1, paddingBottom: ultimo ? 8 : 22 }}>
        <Text style={[styles.kickerSmall, { color: respuesta ? colors.warm : colors.muted }]}>
          {`${dia} · ${TIPO[m.tipo]}`.toUpperCase()}
          {oracion?.respondida ? ` ${cuantoTiempo(oracion.created, oracion.respondida.fecha).toUpperCase()}` : ''}
        </Text>
        <Text style={[styles.stepTitle, { color: colors.text }, m.tipo === 'devocional' && styles.italic]}>
          {m.tipo === 'devocional' ? `«${m.titulo}»` : m.titulo}
        </Text>
        {!!m.nota && (
          <Text style={[styles.stepNote, { color: colors.muted }]} numberOfLines={respuesta ? 4 : 2}>
            {m.nota}
          </Text>
        )}
        {m.versiculos.length > 0 && (
          <View style={{ gap: 8, marginTop: 10 }}>
            {m.versiculos.map((v) => (
              <VersoFila key={`${v.book}.${v.chapter}.${v.verse}`} verso={v} colors={colors} acento={respuesta ? colors.warm : colors.border} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const sombra = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 8px 24px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 20, padding: 26, alignItems: 'center' },
  emptyTitle: { fontFamily: serif, fontSize: 20, textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 20, marginBottom: 14 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8 },
  heroTitle: { fontFamily: serif, fontSize: 24, lineHeight: 31 },
  recuerdo: { borderRadius: 20, padding: 18, marginBottom: 14 },
  recuerdoTitle: { fontFamily: serif, fontSize: 19, lineHeight: 26, marginTop: 6 },
  kickerSmall: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  yearHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 12, marginBottom: 4 },
  year: { fontFamily: serif, fontSize: 40, lineHeight: 46 },
  month: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, marginTop: 14, marginBottom: 12, marginLeft: 44 },
  step: { flexDirection: 'row', gap: 14 },
  rail: { width: 30, alignItems: 'center' },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  line: { width: 1.5, flex: 1, marginVertical: 4 },
  stepTitle: { fontFamily: serif, fontSize: 18, lineHeight: 25, marginTop: 4 },
  italic: { fontStyle: 'italic' },
  stepNote: { fontSize: 14, lineHeight: 20, marginTop: 4 },
});
