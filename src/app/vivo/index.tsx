import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { Button, Card, Chips, ErrorText, useAction } from '@/components/comunidad/ui';
import { LiveIcon, OpenBookIcon, PeopleIcon } from '@/components/icons';
import { PasajeSheet } from '@/components/vivo/Hojas';
import { vivoText } from '@/components/vivo/piezas';
import { useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { guionDe, rangoDe, soloRango } from '@/lib/guion';
import { huella } from '@/lib/sellos';
import { pasajeLabel, tipoInfo, tituloDe, useTaller } from '@/lib/taller';
import { getLastRead, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';
import { CODE_LENGTH, type Sala, cleanCode, vivoApi } from '@/lib/vivo';
import { usePantallaEncendida } from '@/lib/pantalla';

/** Entrar a una lectura en vivo con el código, o empezar una con tu grupo. */
export default function LecturaEnVivo() {
  const params = useLocalSearchParams<{ grupo?: string; libro?: string; capitulo?: string; taller?: string }>();
  const colors = useColors();
  const { settings } = useSettings();
  usePantallaEncendida(true);
  const { ready, usuario, grupos } = useAccount();
  const { mensajes } = useTaller();
  const [code, setCode] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [grupo, setGrupo] = useState<string>(params.grupo ?? '');
  const [pasaje, setPasaje] = useState<{ book: string; chapter: number } | null>(
    params.libro && params.capitulo ? { book: params.libro, chapter: Number(params.capitulo) } : null,
  );
  const [picking, setPicking] = useState(false);
  const { busy, error, run } = useAction();
  const taller = mensajes.find((m) => m.id === params.taller);

  useEffect(() => {
    getBooks().then(setBooks).catch(() => {});
  }, []);

  // Sin pasaje elegido: el del encuentro del Taller, la lectura de hoy del grupo o lo último que leíste.
  useEffect(() => {
    if (pasaje) return;
    if (taller?.pasaje) return setPasaje({ book: taller.pasaje.book, chapter: taller.pasaje.chapter });
    const g = grupos?.find((x) => x.id === grupo);
    if (g?.lectura?.capitulos[0]) return setPasaje({ book: g.lectura.libro, chapter: g.lectura.capitulos[0] });
    getLastRead().then((last) => setPasaje((p) => p ?? { book: last?.book ?? 'jhn', chapter: last?.chapter ?? 1 }));
  }, [pasaje, taller, grupo, grupos]);

  const groupOptions = useMemo(
    () => [{ value: '', label: 'Sin grupo' }, ...(grupos ?? []).map((g) => ({ value: g.id, label: g.nombre }))],
    [grupos],
  );
  const book = books.find((b) => b.id === pasaje?.book);
  const ready6 = code.length === CODE_LENGTH;

  const join = () => {
    if (ready6) navigate(() => router.push(`/vivo/${code}`), 'forward');
  };

  // Con un mensaje del Taller: solo sus versículos (si se empieza en su capítulo) y el guion de sus partes.
  const enSuPasaje = !!taller?.pasaje && taller.pasaje.book === pasaje?.book && taller.pasaje.chapter === pasaje?.chapter;
  const rango = enSuPasaje ? rangoDe(taller!.pasaje) : null;
  const guion = taller ? guionDe(taller, tituloDe(taller, books), books) : undefined;

  const start = () =>
    run(async () => {
      if (!pasaje) return;
      let sala = await vivoApi<Sala & { existente?: boolean }>('crearSala', {
        libro: pasaje.book,
        capitulo: pasaje.chapter,
        grupo: grupo || undefined,
        titulo: !grupo && taller ? guion!.titulo.slice(0, 80) : undefined,
        version: settings.version,
        rango,
        ...(guion && { guion }),
      });
      if (!sala.existente || sala.sala.guia.id === usuario?.id) huella('guiar', `sala:${sala.sala.codigo}`).catch(() => {});
      // El grupo ya tenía una lectura abierta: se entra en ella y, si guías, se lleva el mensaje ahí.
      if (sala.existente && guion && sala.sala.guia.id === usuario?.id) {
        sala = await vivoApi<Sala>('moverSala', { sala: sala.sala.codigo, guion, libro: pasaje.book, capitulo: pasaje.chapter, rango, version: settings.version });
      }
      const q = params.taller ? `?taller=${params.taller}` : '';
      navigate(() => router.replace(`/vivo/${sala.sala.codigo}${q}`), 'forward');
    });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Lectura en vivo' }} />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.warmSoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.surface }]}>
            <LiveIcon color={colors.warm} size={28} strokeWidth={2} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Lean juntos, cada uno en su teléfono</Text>
          <Text style={[styles.heroText, { color: colors.text }]}>
            Quien guía pasa la hoja y todos la ven al instante. El versículo que alguien toca se ilumina para todos, y las
            dinámicas del Taller aparecen en cada pantalla con su reloj.
          </Text>
        </View>
      </Appear>

      <Text style={[vivoText.kicker, styles.section, { color: colors.muted }]}>UNIRME CON UN CÓDIGO</Text>
      <Card>
        <Pressable style={styles.codeRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <View
              key={i}
              style={[
                styles.box,
                i === 3 && { marginLeft: 10 },
                { borderColor: i === code.length ? colors.accent : colors.border, backgroundColor: colors.background },
              ]}
            >
              <Text style={[styles.boxText, { color: colors.text }]}>{code[i] ?? ''}</Text>
            </View>
          ))}
          {/* Un solo campo invisible encima de las casillas: el teclado y el pegado funcionan como siempre. */}
          <TextInput
            value={code}
            onChangeText={(t) => setCode(cleanCode(t))}
            onSubmitEditing={join}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH + 2}
            accessibilityLabel="Código de la lectura en vivo"
            style={[StyleSheet.absoluteFill, styles.hiddenInput, Platform.OS === 'web' && ({ outlineStyle: 'none', caretColor: 'transparent' } as object)]}
          />
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 10 }}>
          Seis letras y números. Pídeselo a quien guía.
        </Text>
        <Button label="Entrar a la lectura" onPress={join} disabled={!ready6} style={{ marginTop: 14 }} />
      </Card>

      <Text style={[vivoText.kicker, styles.section, { color: colors.muted }]}>EMPEZAR UNA LECTURA</Text>
      {ready && !usuario ? (
        <Welcome intro="Para guiar una lectura en vivo necesitas una cuenta gratuita. Para seguir una basta el código." />
      ) : (
        <Card>
          {taller && (
            <View style={[styles.taller, { backgroundColor: colors.warmSoft }]}>
              <Text style={{ color: colors.warm, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8 }}>
                {`${tipoInfo(taller.tipo).nombre} del Taller`.toUpperCase()}
              </Text>
              <Text style={{ color: colors.text, fontFamily: serif, fontSize: 18, fontWeight: '700', marginTop: 3 }}>{guion!.titulo}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
                {taller.secciones.length} partes
                {taller.pasaje ? ` · ${pasajeLabel(taller.pasaje, books)}` : ''}. Lo llevarás parte por parte con su reloj: al pasar de
                parte, todos van a sus versículos y ven lo que escribiste para ellos y su dinámica. Tus notas solo las ves tú.
              </Text>
            </View>
          )}
          {(grupos?.length ?? 0) > 0 && (
            <>
              <View style={styles.label}>
                <PeopleIcon color={colors.muted} size={15} strokeWidth={2} />
                <Text style={[styles.labelText, { color: colors.muted }]}>CON QUÉ GRUPO</Text>
              </View>
              <Chips options={groupOptions} value={grupo} onChange={setGrupo} />
              <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 8 }}>
                {grupo ? 'Les avisamos a todos y verán «En vivo ahora» en la pantalla del grupo.' : 'Solo entra quien tenga el código.'}
              </Text>
            </>
          )}
          <View style={[styles.label, { marginTop: (grupos?.length ?? 0) > 0 ? 18 : 0 }]}>
            <OpenBookIcon color={colors.muted} size={15} strokeWidth={2} />
            <Text style={[styles.labelText, { color: colors.muted }]}>EMPEZAR EN</Text>
          </View>
          <Pressable
            onPress={() => setPicking(true)}
            style={[styles.passage, { borderColor: colors.border, backgroundColor: colors.background }]}
            accessibilityRole="button"
            accessibilityLabel="Elegir el pasaje"
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.passageText, { color: colors.text }]}>{book && pasaje ? `${book.name} ${pasaje.chapter}` : '…'}</Text>
              {rango && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>Se leerá {soloRango(rango)}</Text>}
            </View>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Cambiar</Text>
          </Pressable>
          <Button label="Empezar en vivo" icon={LiveIcon} onPress={start} busy={busy} disabled={!pasaje} style={{ marginTop: 16 }} />
          <ErrorText>{error}</ErrorText>
        </Card>
      )}

      {picking && pasaje && (
        <PasajeSheet
          books={books}
          book={pasaje.book}
          chapter={pasaje.chapter}
          onClose={() => setPicking(false)}
          onPick={(b, c) => {
            setPasaje({ book: b, chapter: c });
            setPicking(false);
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 80, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: 22, padding: 22, alignItems: 'flex-start' },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { fontFamily: serif, fontSize: 24, fontWeight: '700', lineHeight: 30 },
  heroText: { fontSize: 15, lineHeight: 22, marginTop: 8, opacity: 0.85 },
  section: { marginTop: 28, marginBottom: 10 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  box: { width: 44, height: 54, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boxText: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hiddenInput: { opacity: 0.011, color: 'transparent', fontSize: 24 },
  taller: { borderRadius: 14, padding: 12, marginBottom: 16 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  labelText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1 },
  passage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  passageText: { fontFamily: serif, fontSize: 20, fontWeight: '700' },
});
