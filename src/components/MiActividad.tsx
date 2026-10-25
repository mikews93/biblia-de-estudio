// «Actividad» en Mi diario: la racha devocional, lo que ya hiciste hoy (devocional, estudio profundo, lectura,
// escuchar), las últimas cinco semanas de un vistazo y, día por día, todo lo que viviste con la Palabra.
import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { RachaInsignias, RachaTarjeta } from '@/components/Racha';
import Sello from '@/components/Sello';
import {
  CheckIcon,
  ChevronRightIcon,
  DramaIcon,
  FlameIcon,
  HeartIcon,
  type IconProps,
  InterlinearIcon,
  ListenIcon,
  LockIcon,
  OpenBookIcon,
  PencilIcon,
  PrayIcon,
  SparkIcon,
  StarIcon,
  TalkIcon,
} from '@/components/icons';
import { useActividad } from '@/lib/actividad';
import { Book, getBooks } from '@/lib/data';
import { useDiario } from '@/lib/diario';
import { useAllHighlights } from '@/lib/highlights';
import { Dia, Item, TipoItem, construirActividad, resumenDe } from '@/lib/miActividad';
import { useNotes } from '@/lib/notas';
import { useOraciones } from '@/lib/oraciones';
import { useRacha } from '@/lib/racha';
import { fechaLocal, sumarDias } from '@/lib/rachaTexto';
import { chapterHref } from '@/lib/routes';
import { selloPorId, useSellos } from '@/lib/sellos';
import { Colors, serif, useLastRead } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const ICONO: Record<TipoItem, (p: IconProps) => ReactNode> = {
  devocional: HeartIcon,
  profundo: SparkIcon,
  capitulo: OpenBookIcon,
  podcast: TalkIcon,
  dramatizado: DramaIcon,
  original: (p) => <InterlinearIcon {...p} />,
  escuchar: ListenIcon,
  resaltados: ({ size = 22 }) => <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: 5, backgroundColor: '#F2CF5B' }} />,
  nota: PencilIcon,
  oracion: PrayIcon,
  respondida: CheckIcon,
  sello: (p) => <StarIcon {...p} filled />,
};

/** Días que se ven al principio; «Ver días anteriores» suma otros tantos. */
const PAGINA = 10;

type Props = { colors: Colors; onDevocional: () => void; onProfundo: () => void };

export default function MiActividad({ colors, onDevocional, onProfundo }: Props) {
  const racha = useRacha();
  const registro = useActividad();
  const diario = useDiario();
  const resaltados = useAllHighlights();
  const notas = useNotes();
  const oraciones = useOraciones();
  const sellos = useSellos();
  const last = useLastRead();
  const [books, setBooks] = useState<Book[]>([]);
  const [mostrar, setMostrar] = useState(PAGINA);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  const dias = useMemo(() => {
    const nombre = (id: string) => books.find((b) => b.id === id)?.name ?? id;
    const ganados = Object.entries(sellos.ganados).flatMap(([id, g]) => {
      const s = selloPorId(id);
      return s ? [{ id, titulo: s.titulo, fecha: g.fecha }] : [];
    });
    return construirActividad({ registro, diario, resaltados, notas, oraciones, sellos: ganados, nombre });
  }, [registro, diario, resaltados, notas, oraciones, sellos, books]);

  const hoy = fechaLocal();
  const deHoy = resumenDe(dias.find((d) => d.fecha === hoy));
  const abrir = (href: string) => navigate(() => router.push(href as never), 'forward');
  const lectura = last ? chapterHref(last.book, last.chapter) : '/juan/1';

  return (
    <View>
      <Appear>
        <RachaTarjeta racha={racha} colors={colors} onHoy={onDevocional} />
      </Appear>

      <Appear delay={40}>
        <Text style={[styles.seccion, { color: colors.muted }]}>INSIGNIAS DE LA RACHA</Text>
        <RachaInsignias colors={colors} />
      </Appear>

      <Appear delay={70} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.accent }]}>HOY</Text>
        <Paso hecho={deHoy.devocional} icon={HeartIcon} titulo="Devocional" pendiente="Diez minutos con la Palabra" colors={colors} onPress={onDevocional} />
        <Paso hecho={deHoy.profundo} icon={SparkIcon} titulo="Estudio profundo" pendiente="Observa, interpreta y aplica" colors={colors} onPress={onProfundo} />
        <Paso hecho={deHoy.lectura} icon={OpenBookIcon} titulo="Leer un capítulo" pendiente="Sigue donde te quedaste" colors={colors} onPress={() => abrir(lectura)} />
        <Paso
          hecho={deHoy.escuchado}
          icon={ListenIcon}
          titulo="Escuchar"
          pendiente="El pódcast, el audio dramatizado o la lectura"
          colors={colors}
          onPress={() => abrir(lectura)}
          ultimo
        />
      </Appear>

      <Appear delay={100} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Calendario dias={dias} devocionales={new Set(racha.dias)} colors={colors} />
      </Appear>

      {dias.length === 0 ? (
        <Appear delay={130} style={[styles.vacio, { borderColor: colors.border }]}>
          <Text style={[styles.vacioTitulo, { color: colors.text }]}>Tu actividad aparecerá aquí</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6 }}>
            Cada devocional, estudio profundo, capítulo leído, versículo resaltado, nota, oración y pódcast que escuches
            queda aquí, día por día.
          </Text>
        </Appear>
      ) : (
        dias.slice(0, mostrar).map((d, i) => (
          <Appear key={d.fecha} delay={Math.min(i, 5) * 30 + 130}>
            <DiaCard dia={d} hoy={hoy} devocional={racha.dias.includes(d.fecha)} colors={colors} onAbrir={abrir} />
          </Appear>
        ))
      )}

      {dias.length > mostrar && (
        <Pressable
          onPress={() => setMostrar((n) => n + PAGINA)}
          style={({ pressed }) => [styles.mas, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver días anteriores</Text>
        </Pressable>
      )}

      <View style={styles.privado}>
        <LockIcon color={colors.muted} size={13} />
        <Text style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}>Tu actividad es privada: solo tú la ves.</Text>
      </View>
    </View>
  );
}

function Paso({
  hecho,
  icon: Icon,
  titulo,
  pendiente,
  colors,
  onPress,
  ultimo,
}: {
  hecho: boolean;
  icon: (p: IconProps) => ReactNode;
  titulo: string;
  pendiente: string;
  colors: Colors;
  onPress: () => void;
  ultimo?: boolean;
}) {
  return (
    <Pressable
      onPress={hecho ? undefined : onPress}
      disabled={hecho}
      style={({ pressed }) => [
        styles.paso,
        !ultimo && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole={hecho ? undefined : 'button'}
      accessibilityState={{ checked: hecho }}
      accessibilityLabel={`${titulo}: ${hecho ? 'hecho hoy' : 'pendiente'}`}
    >
      <View style={[styles.pasoIcono, { backgroundColor: hecho ? colors.warmSoft : colors.accentSoft }]}>
        <Icon color={hecho ? colors.warm : colors.accent} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{titulo}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>{hecho ? 'Hecho hoy' : pendiente}</Text>
      </View>
      {hecho ? (
        <View style={[styles.check, { backgroundColor: colors.warm }]}>
          <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />
        </View>
      ) : (
        <ChevronRightIcon color={colors.muted} size={18} />
      )}
    </Pressable>
  );
}

/** Las últimas cinco semanas, de lunes a domingo: más intenso el día con más actividad, con la llama si hubo devocional. */
function Calendario({ dias, devocionales, colors }: { dias: Dia[]; devocionales: Set<string>; colors: Colors }) {
  const hoy = fechaLocal();
  const [y, m, d] = hoy.split('-').map(Number);
  const lunes = sumarDias(hoy, -((new Date(y, m - 1, d).getDay() + 6) % 7) - 28);
  const cuenta = new Map(dias.map((x) => [x.fecha, x.items.length]));
  const activos = Array.from({ length: 35 }, (_, i) => sumarDias(lunes, i)).filter((f) => f <= hoy && cuenta.get(f));
  const semanas = Array.from({ length: 5 }, (_, s) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, s * 7 + i)));
  return (
    <View>
      <View style={styles.calHead}>
        <Text style={[styles.kicker, { color: colors.accent }]}>ÚLTIMAS 5 SEMANAS</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {activos.length} {activos.length === 1 ? 'día' : 'días'} con la Palabra
        </Text>
      </View>
      <View style={styles.calFila}>
        {'LMXJVSD'.split('').map((l) => (
          <Text key={l} style={[styles.calLetra, { color: colors.muted }]}>
            {l}
          </Text>
        ))}
      </View>
      {semanas.map((semana) => (
        <View key={semana[0]} style={styles.calFila}>
          {semana.map((f) => {
            const n = f > hoy ? -1 : (cuenta.get(f) ?? 0);
            const nivel = n <= 0 ? 0 : n <= 2 ? 0.35 : n <= 5 ? 0.65 : 1;
            const esHoy = f === hoy;
            return (
              <View key={f} style={styles.calCelda}>
                <View
                  style={[
                    styles.calCuadro,
                    { backgroundColor: n < 0 ? 'transparent' : colors.accentSoft },
                    esHoy && { borderWidth: 2, borderColor: colors.warm },
                  ]}
                  accessibilityLabel={n > 0 ? `${f}: ${n} ${n === 1 ? 'cosa' : 'cosas'}` : undefined}
                >
                  {nivel > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent, opacity: nivel, borderRadius: 7 }]} />}
                  {devocionales.has(f) && (
                    <View style={[styles.calLlama, { backgroundColor: colors.warm, borderColor: colors.surface }]}>
                      <FlameIcon color={colors.surface} size={10} filled />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.leyenda}>
        <View style={[styles.calLlama, { backgroundColor: colors.warm, borderColor: colors.surface, width: 16, height: 16 }]}>
          <FlameIcon color={colors.surface} size={9} filled />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>devocional</Text>
        <View style={[styles.leyendaCuadro, { backgroundColor: colors.accentSoft, marginLeft: 10 }]} />
        <View style={[styles.leyendaCuadro, { backgroundColor: colors.accent, opacity: 0.35 }]} />
        <View style={[styles.leyendaCuadro, { backgroundColor: colors.accent, opacity: 0.65 }]} />
        <View style={[styles.leyendaCuadro, { backgroundColor: colors.accent }]} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>más actividad</Text>
      </View>
    </View>
  );
}

function tituloDia(fecha: string, hoy: string) {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const texto = f.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', ...(y !== Number(hoy.slice(0, 4)) ? { year: 'numeric' } : {}) });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const hora = (t: number) => new Date(t).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });

function DiaCard({ dia, hoy, devocional, colors, onAbrir }: { dia: Dia; hoy: string; devocional: boolean; colors: Colors; onAbrir: (href: string) => void }) {
  return (
    <View style={styles.dia}>
      <View style={styles.diaHead}>
        <Text style={[styles.diaTitulo, { color: colors.text }]}>{tituloDia(dia.fecha, hoy)}</Text>
        {devocional && (
          <View style={[styles.diaChip, { backgroundColor: colors.warmSoft }]}>
            <FlameIcon color={colors.warm} size={12} filled />
            <Text style={{ color: colors.warm, fontSize: 11, fontWeight: '700' }}>Devocional</Text>
          </View>
        )}
        <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 'auto' }}>
          {dia.items.length} {dia.items.length === 1 ? 'cosa' : 'cosas'}
        </Text>
      </View>
      <View style={[styles.card, styles.lista, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {dia.items.map((item, i) => (
          <Fila key={item.id} item={item} colors={colors} ultimo={i === dia.items.length - 1} onAbrir={onAbrir} />
        ))}
      </View>
    </View>
  );
}

function Fila({ item, colors, ultimo, onAbrir }: { item: Item; colors: Colors; ultimo: boolean; onAbrir: (href: string) => void }) {
  const Icon = ICONO[item.tipo];
  const sello = item.tipo === 'sello' ? selloPorId(item.id.replace(/^sello:/, '')) : undefined;
  const calido = item.tipo === 'devocional' || item.tipo === 'sello' || item.tipo === 'respondida';
  return (
    <Pressable
      onPress={item.href ? () => onAbrir(item.href!) : undefined}
      disabled={!item.href}
      style={({ pressed }) => [styles.fila, !ultimo && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
      accessibilityRole={item.href ? 'link' : undefined}
    >
      {sello ? (
        <View style={styles.filaIcono}>
          <Sello dibujo={sello.dibujo} colors={colors} ganado size={36} />
        </View>
      ) : (
        <View style={[styles.filaIcono, { backgroundColor: calido ? colors.warmSoft : colors.accentSoft }]}>
          <Icon color={calido ? colors.warm : colors.accent} size={17} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{item.titulo}</Text>
        {!!item.detalle && (
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }} numberOfLines={2}>
            {item.detalle}
          </Text>
        )}
      </View>
      {item.t !== null && <Text style={[styles.hora, { color: colors.muted }]}>{hora(item.t)}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18, marginBottom: 14 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  seccion: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8, marginTop: 2 },
  paso: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pasoIcono: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  calHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calFila: { flexDirection: 'row', marginBottom: 6 },
  calLetra: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  calCelda: { flex: 1, alignItems: 'center' },
  calLlama: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  calCuadro: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, flexWrap: 'wrap' },
  leyendaCuadro: { width: 12, height: 12, borderRadius: 3 },
  vacio: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 4 },
  vacioTitulo: { fontFamily: serif, fontSize: 21, textAlign: 'center' },
  dia: { marginTop: 8 },
  diaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  diaTitulo: { fontFamily: serif, fontSize: 19 },
  diaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  lista: { paddingVertical: 4, paddingHorizontal: 14 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  filaIcono: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  hora: { fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  mas: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  privado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
});
