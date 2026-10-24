// Las hojas de quien guía: elegir el pasaje, poner algo en la pantalla de todos y ver quién está.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Field } from '@/components/comunidad/ui';
import { ChevronRightIcon, LiveIcon, RouteIcon } from '@/components/icons';
import type { Book } from '@/lib/data';
import { DINAMICAS, MOMENTOS, Momento, dinamica } from '@/lib/dinamicas';
import { type Mensaje, pasajeLabel, tipoInfo, tituloDe } from '@/lib/taller';
import { serif, useColors } from '@/lib/theme';
import type { Persona, Sala } from '@/lib/vivo';

import { AnonimaSwitch, EstudioTab, type TarjetaNueva } from './Estudio';
import { LanzarRepaso } from './Repaso';
import { Segmented, Sheet } from './piezas';

/** Elegir libro y capítulo: primero el libro, luego la cuadrícula de capítulos. */
export function PasajeSheet({
  books,
  book,
  chapter,
  onPick,
  onClose,
}: {
  books: Book[];
  book: string;
  chapter: number;
  onPick: (book: string, chapter: number) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [picked, setPicked] = useState<Book | null>(books.find((b) => b.id === book) ?? null);
  const [choosingBook, setChoosingBook] = useState(false);
  const [testament, setTestament] = useState<'AT' | 'NT'>(picked?.testament ?? 'NT');

  if (choosingBook || !picked) {
    return (
      <Sheet title="Elige el libro" kicker="PASAR A OTRO PASAJE" onClose={onClose}>
        <Segmented options={[['AT', 'Antiguo Testamento'], ['NT', 'Nuevo Testamento']]} value={testament} onChange={setTestament} />
        <View style={styles.books}>
          {books
            .filter((b) => b.testament === testament)
            .map((b) => {
              const on = b.id === picked?.id;
              return (
                <Pressable accessibilityRole="button"
                  key={b.id}
                  onPress={() => {
                    setPicked(b);
                    setChoosingBook(false);
                  }}
                  style={[styles.bookChip, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface }]}
                >
                  <Text style={{ color: colors.text, fontWeight: on ? '700' : '500' }}>{b.name}</Text>
                </Pressable>
              );
            })}
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet title={picked.name} kicker="ELIGE EL CAPÍTULO" onClose={onClose}>
      <Pressable onPress={() => setChoosingBook(true)} style={[styles.changeBook, { borderColor: colors.border }]} accessibilityRole="button">
        <Text style={{ color: colors.muted, fontSize: 13 }}>Libro</Text>
        <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{picked.name}</Text>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>Cambiar</Text>
      </Pressable>
      <View style={styles.grid}>
        {Array.from({ length: picked.chapters }, (_, i) => i + 1).map((n) => {
          const on = picked.id === book && n === chapter;
          return (
            <Pressable accessibilityRole="button"
              key={n}
              onPress={() => onPick(picked.id, n)}
              accessibilityLabel={`${picked.name} ${n}`}
              style={({ pressed }) => [
                styles.cell,
                { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border },
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
            >
              <Text style={{ color: on ? colors.surface : colors.text, fontWeight: '700', fontSize: 15 }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

export type NuevaTarjeta =
  | {
      tipo: 'dinamica' | 'pregunta' | 'parte';
      titulo?: string;
      texto?: string;
      pasos?: string[];
      dinamica?: string;
      minutos?: number | null;
    }
  | TarjetaNueva;

type Tab = 'estudio' | 'dinamicas' | 'pregunta' | 'encuentro';

/**
 * Poner algo en todas las pantallas: una sección del estudio Profundo del capítulo, una dinámica del catálogo,
 * una pregunta (para conversar o para que cada uno responda en secreto) o una parte de un mensaje del Taller.
 * Un mensaje entero también se puede llevar parte por parte, con su reloj (`onGuiar`).
 */
export function PantallaSheet({
  mensajes,
  guion,
  onGuiar,
  books,
  initialEncuentro,
  libro,
  capitulo,
  version,
  onPut,
  onClose,
}: {
  mensajes: Mensaje[];
  /** El mensaje que ya se lleva parte por parte, si hay uno. */
  guion: string | null;
  onGuiar: (m: Mensaje) => void;
  books: Book[];
  initialEncuentro?: string;
  libro: string;
  capitulo: number;
  version: string;
  onPut: (t: NuevaTarjeta) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>(initialEncuentro ? 'encuentro' : 'estudio');
  const [momento, setMomento] = useState<Momento>('conectar');
  const [pregunta, setPregunta] = useState('');
  const [ronda, setRonda] = useState(false);
  const [anonima, setAnonima] = useState(false);
  const nombre = `${books.find((b) => b.id === libro)?.name ?? ''} ${capitulo}`;
  // Los terminados («Mis sermones») primero, luego los borradores, cada grupo del más reciente al más antiguo.
  const lista = useMemo(
    () => [...mensajes].sort((a, b) => Number(!!b.terminado) - Number(!!a.terminado) || b.actualizado.localeCompare(a.actualizado)),
    [mensajes],
  );
  const [open, setOpen] = useState<string | null>(initialEncuentro ?? (lista.length === 1 ? lista[0].id : null));
  const mensaje = lista.find((m) => m.id === open);

  return (
    <Sheet title="Poner en todas las pantallas" kicker="PARA EL GRUPO" onClose={onClose}>
      <Segmented
        options={[
          ['estudio', 'Estudio'],
          ['pregunta', 'Pregunta'],
          ['dinamicas', 'Dinámicas'],
          ['encuentro', 'Taller'],
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'estudio' && (
        <>
          <LanzarRepaso libro={libro} capitulo={capitulo} onPut={(preguntas, modo, juego) => onPut({ tipo: 'repaso', preguntas, modo, juego })} />
          <EstudioTab libro={libro} capitulo={capitulo} nombre={nombre} version={version} onPut={onPut} />
        </>
      )}

      {tab === 'dinamicas' && (
        <>
          <View style={styles.momentos}>
            {MOMENTOS.map((m) => {
              const on = m.momento === momento;
              return (
                <Pressable accessibilityRole="button"
                  key={m.momento}
                  onPress={() => setMomento(m.momento)}
                  style={[styles.momento, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : 'transparent' }]}
                >
                  <Text style={{ color: on ? colors.text : colors.muted, fontWeight: '700', fontSize: 13 }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {DINAMICAS.filter((d) => d.momento === momento).map((d) => (
            <Row
              key={d.id}
              title={d.nombre}
              sub={`${d.minutos} min · ${d.grupo}`}
              detail={d.objetivo}
              onPress={() => onPut({ tipo: 'dinamica', dinamica: d.id })}
            />
          ))}
        </>
      )}

      {tab === 'pregunta' && (
        <View style={{ gap: 12 }}>
          <View style={styles.modes}>
            {(
              [
                [false, 'Para conversar', 'Aparece grande en cada teléfono mientras hablan.'],
                [true, 'Que cada uno responda', 'Escriben en secreto y tú revelas las respuestas juntas.'],
              ] as const
            ).map(([value, label, detail]) => {
              const on = ronda === value;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setRonda(value)}
                  style={[styles.mode, { borderColor: on ? colors.warm : colors.border, backgroundColor: on ? colors.warmSoft : colors.surface }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 17, marginTop: 3 }}>{detail}</Text>
                </Pressable>
              );
            })}
          </View>
          <Field
            value={pregunta}
            onChangeText={setPregunta}
            placeholder="¿Qué te llamó la atención de este pasaje?"
            multiline
            maxLength={ronda ? 280 : 120}
            accessibilityLabel="Pregunta para el grupo"
          />
          {ronda && <AnonimaSwitch value={anonima} onChange={setAnonima} />}
          <Button
            label={ronda ? 'Que todos respondan' : 'Mostrar a todos'}
            icon={LiveIcon}
            disabled={!pregunta.trim()}
            onPress={() => onPut(ronda ? { tipo: 'ronda', titulo: pregunta.trim(), anonima } : { tipo: 'pregunta', titulo: pregunta.trim() })}
          />
        </View>
      )}

      {tab === 'encuentro' &&
        (lista.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>
            Prepara un encuentro, una reflexión o un sermón en el Taller y aquí podrás llevarlo parte por parte a la
            pantalla de todos: lo que ve el grupo, los versículos de cada parte, la dinámica con sus pasos y el tiempo.
          </Text>
        ) : !mensaje ? (
          lista.map((m) => (
            <Row
              key={m.id}
              title={tituloDe(m, books)}
              sub={[m.terminado ? 'Mis sermones' : 'Borrador', tipoInfo(m.tipo).nombre, `${m.secciones.length} partes`, m.pasaje ? pasajeLabel(m.pasaje, books) : '']
                .filter(Boolean)
                .join(' · ')}
              onPress={() => setOpen(m.id)}
            />
          ))
        ) : (
          <>
            <Pressable onPress={() => setOpen(null)} style={{ marginBottom: 8 }} accessibilityRole="button">
              <Text style={{ color: colors.accent, fontWeight: '600' }}>‹ Otros mensajes</Text>
            </Pressable>
            <Text style={[styles.encuentro, { color: colors.text }]}>{tituloDe(mensaje, books)}</Text>
            {guion === mensaje.id ? (
              <View style={[styles.guiando, { backgroundColor: colors.warmSoft }]}>
                <RouteIcon color={colors.warm} size={17} />
                <Text style={{ color: colors.text, fontSize: 13.5, lineHeight: 19, flex: 1 }}>
                  Lo llevas parte por parte desde la barra de abajo. También puedes poner aquí una parte suelta.
                </Text>
              </View>
            ) : (
              <>
                <Button label="Llevarlo parte por parte" icon={RouteIcon} onPress={() => onGuiar(mensaje)} />
                <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 6, marginBottom: 14 }}>
                  Verás en qué parte vas y cuánto llevas. Al pasar de parte, todos van a sus versículos y ven su dinámica.
                </Text>
              </>
            )}
            {mensaje.secciones.map((s, i) => {
              const d = dinamica(s.dinamica);
              return (
                <Row
                  key={s.id}
                  index={i + 1}
                  title={s.titulo}
                  sub={[s.minutos ? `${s.minutos} min` : '', d?.nombre, s.responsable?.trim() ? `Guía ${s.responsable.trim()}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                  detail={s.paraGrupo?.trim() || undefined}
                  onPress={() =>
                    onPut({
                      tipo: 'parte',
                      titulo: s.titulo,
                      texto: s.paraGrupo?.trim() || undefined,
                      pasos: d?.pasos,
                      minutos: s.minutos || null,
                    })
                  }
                />
              );
            })}
          </>
        ))}
    </Sheet>
  );
}

function Row({ title, sub, detail, index, onPress }: { title: string; sub?: string; detail?: string; index?: number; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: pressed ? colors.accentSoft : colors.surface }]}
    >
      {index !== undefined && (
        <View style={[styles.index, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>{index}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15.5 }}>{title}</Text>
        {!!sub && <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>{sub}</Text>}
        {!!detail && (
          <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, marginTop: 6 }} numberOfLines={2}>
            {detail}
          </Text>
        )}
      </View>
      <ChevronRightIcon color={colors.muted} size={18} />
    </Pressable>
  );
}

/** Quiénes están. Quien empezó puede pasar la guía a otra persona (los co-líderes de cada parte) y terminar. */
export function PersonasSheet({
  sala,
  me,
  onGive,
  onEnd,
  onLeave,
  onClose,
}: {
  sala: Sala;
  me: string | null;
  onGive: (p: Persona) => void;
  onEnd: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const owner = me === sala.sala.dueno.id;
  const people = useMemo(() => {
    const list = [...sala.presentes];
    // Quien guía y quien empezó aparecen siempre primero.
    return list.sort((a, b) => rank(b) - rank(a));
    function rank(p: Persona) {
      return (p.id === sala.sala.guia.id ? 2 : 0) + (p.id === sala.sala.dueno.id ? 1 : 0);
    }
  }, [sala]);

  return (
    <Sheet
      title={`${sala.presentes.length} ${sala.presentes.length === 1 ? 'persona' : 'personas'} leyendo`}
      kicker={sala.sala.titulo.toUpperCase()}
      onClose={onClose}
      footer={
        owner ? (
          <Button label="Terminar la lectura para todos" kind="outline" onPress={onEnd} />
        ) : (
          <Button label="Salir de la lectura" kind="outline" onPress={onLeave} />
        )
      }
    >
      {people.map((p) => {
        const guides = p.id === sala.sala.guia.id;
        return (
          <View key={p.id} style={[styles.person, { borderColor: colors.border }]}>
            <Avatar name={p.nombre} foto={p.foto} size={38} filled={guides} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                {p.nombre}
                {p.id === me ? ' (tú)' : ''}
              </Text>
              <Text style={{ color: guides ? colors.warm : colors.muted, fontSize: 12.5, fontWeight: guides ? '700' : '400' }}>
                {guides ? 'Guía ahora' : p.id === sala.sala.dueno.id ? 'Empezó la lectura' : 'Leyendo'}
              </Text>
            </View>
            {(owner || me === sala.sala.guia.id) && !guides && (
              <Pressable onPress={() => onGive(p)} hitSlop={8} style={[styles.give, { borderColor: colors.border }]} accessibilityRole="button">
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{p.id === sala.sala.dueno.id ? 'Devolver la guía' : 'Darle la guía'}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 14 }}>
        Quien guía pasa la hoja y pone las dinámicas. Sirve para que cada co-líder lleve su parte del encuentro.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  books: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bookChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  changeBook: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  momentos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  momento: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginBottom: 8 },
  index: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  encuentro: { fontFamily: serif, fontSize: 19, fontWeight: '700', marginBottom: 10 },
  guiando: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, marginBottom: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  give: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
