import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { Avatar, Button, ErrorText, text, useAction } from '@/components/comunidad/ui';
import { CheckIcon, InterlinearIcon, ListenIcon, OpenBookIcon, PeopleIcon, SparkIcon, type IconProps } from '@/components/icons';
import { useAccount } from '@/lib/comunidad';
import { acceptPending, cleanCode, savePending } from '@/lib/invitar';
import { verseHref } from '@/lib/routes';
import { PersonaBreve, Relacion, getPerson, personByCode } from '@/lib/social';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const QUE_HAY: { icon: (p: IconProps) => React.ReactNode; title: string; body: string }[] = [
  { icon: OpenBookIcon, title: 'Lee cada día', body: 'Varias traducciones, planes de lectura y descargas para leer sin conexión.' },
  { icon: InterlinearIcon, title: 'Griego y hebreo', body: 'El texto original palabra por palabra, con su significado y concordancia.' },
  { icon: ListenIcon, title: 'Escucha', body: 'Capítulos dramatizados y resúmenes en audio para el camino.' },
  { icon: SparkIcon, title: 'Estudia a fondo', body: 'Comentarios, referencias cruzadas y preguntas que te ayudan a pensar.' },
  { icon: PeopleIcon, title: 'En compañía', body: 'Amigos, grupos de tu iglesia y oración unos por otros.' },
];

/**
 * La invitación a Zarza: zarzabiblia.com/i/CODIGO (src/lib/invitar.ts). Presenta la app a quien llega y, con
 * cuenta, lo deja como amigo de quien la envió. El código queda guardado para completar la amistad después de
 * crear la cuenta, aunque primero se ponga a leer.
 */
export default function Invitacion() {
  const colors = useColors();
  const { codigo: raw } = useLocalSearchParams<{ codigo: string }>();
  const codigo = cleanCode(raw);
  const { ready, usuario } = useAccount();
  const [host, setHost] = useState<PersonaBreve | null>(null);
  const [fetched, setFetched] = useState<Relacion | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const { busy, error, run } = useAction();
  // Se llegó sin cuenta: al volver de crearla (o de entrar) la amistad se hace sola, sin otro toque.
  const guest = useRef(false);
  const relacion: Relacion | undefined =
    !host || !ready ? undefined : !usuario ? null : usuario.id === host.id ? 'yo' : fetched;

  useEffect(() => {
    personByCode(codigo)
      .then(setHost)
      .catch(() => setNotFound(true));
  }, [codigo]);

  const join = () =>
    run(async () => {
      await savePending(codigo);
      const r = await acceptPending();
      if (r) setFetched(r.relacion);
    });

  useEffect(() => {
    if (!host || !ready) return;
    if (!usuario) {
      guest.current = true;
      savePending(codigo);
      return;
    }
    if (usuario.id === host.id) return;
    getPerson(host.id)
      .then((r) => {
        setFetched(r.persona.relacion);
        if (guest.current && r.persona.relacion !== 'amigos' && r.persona.relacion !== 'bloqueada') join();
      })
      .catch(() => setFetched(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host?.id, ready, usuario?.id]);

  const go = (href: string) => navigate(() => router.push(href as never), 'forward');
  const start = () => navigate(() => router.replace('/'), 'forward');

  if (notFound) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
        <Stack.Screen options={{ title: 'Invitación' }} />
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <Text style={[styles.title, { color: colors.text }]}>Este enlace ya no funciona</Text>
          <Text style={[text.body, styles.center, { color: colors.muted }]}>
            Pide a quien te lo envió que lo comparta de nuevo. Mientras, Zarza está abierta para leer, sin cuenta.
          </Text>
          <Button label="Conocer Zarza" onPress={start} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      </ScrollView>
    );
  }

  if (!host || relacion === undefined) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Invitación' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const first = host.nombre.split(/\s+/)[0];
  const amigos = relacion === 'amigos';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Invitación' }} />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <View>
            <Avatar name={host.nombre} foto={host.foto} size={84} filled />
            <View style={[styles.badge, { backgroundColor: amigos ? colors.accent : colors.warm, borderColor: colors.surface }]}>
              {amigos ? <CheckIcon color={colors.surface} size={16} strokeWidth={2.4} /> : <PeopleIcon color={colors.surface} size={16} />}
            </View>
          </View>
          <Text style={[styles.kicker, { color: colors.warm }]}>{amigos ? 'YA SON AMIGOS' : 'UNA INVITACIÓN'}</Text>
          <Text style={[styles.title, { color: colors.text }]} testID="invitacion-titulo">
            {relacion === 'yo'
              ? 'Este es tu enlace de invitación'
              : amigos
                ? `Tú y ${first} leen la Biblia juntos`
                : `${host.nombre} te invita a leer la Biblia en Zarza`}
          </Text>
          <Text style={[text.body, styles.center, { color: colors.muted, maxWidth: 440 }]}>
            {relacion === 'yo'
              ? 'Así lo verán tus amigos. Quien se una con él quedará como tu amigo.'
              : amigos
                ? `Verán lo que cada uno lee, los versículos que resaltan y las preguntas que comparten. ${first} ya lo sabe.`
                : 'Una Biblia de estudio gratis, en español, sin anuncios. Para leer cada día y en compañía.'}
          </Text>

          <View style={styles.cta}>
            {relacion === 'yo' ? (
              <Button label="Invitar a más amigos" onPress={() => go('/invitar')} />
            ) : amigos ? (
              <>
                <Button label="Empezar a leer" onPress={start} />
                <Button label={`Ver a ${first}`} kind="outline" onPress={() => go(`/comunidades/persona/${host.id}`)} />
              </>
            ) : usuario ? (
              <Button label={`Unirme como amigo de ${first}`} onPress={join} busy={busy} disabled={relacion === 'bloqueada'} />
            ) : (
              <>
                <Button label="Crear cuenta gratis" onPress={() => go('/registro')} />
                <Pressable onPress={() => go('/entrar')} hitSlop={8} accessibilityRole="button" style={styles.quiet}>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>
                    ¿Ya tienes cuenta? <Text style={{ color: colors.accent, fontWeight: '700' }}>Entra</Text>
                  </Text>
                </Pressable>
              </>
            )}
            <ErrorText>{error}</ErrorText>
          </View>
          {!usuario && (
            <>
              <Text style={[text.small, styles.center, { color: colors.muted }]}>Con tu cuenta, tú y {first} quedan como amigos.</Text>
              <Pressable onPress={start} hitSlop={8} accessibilityRole="link" style={styles.quiet}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>O empieza a leer sin cuenta ›</Text>
              </Pressable>
            </>
          )}
        </View>
      </Appear>

      {!amigos && relacion !== 'yo' && (
        <Appear delay={80}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
            <Text style={[styles.label, { color: colors.muted }]}>QUÉ ENCUENTRAS EN ZARZA</Text>
            {QUE_HAY.map((f) => (
              <View key={f.title} style={styles.feature}>
                <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                  <f.icon color={colors.accent} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{f.title}</Text>
                  <Text style={[text.small, { color: colors.muted, marginTop: 2, lineHeight: 18 }]}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Appear>
      )}

      <Appear delay={120}>
        <Pressable onPress={() => go(verseHref('psa', 133, 1))} accessibilityRole="link" style={[styles.verse, { borderColor: colors.border }]}>
          <Text style={[styles.verseText, { color: colors.text }]}>
            «¡Mirad cuán bueno y cuán delicioso es habitar los hermanos igualmente en uno!»
          </Text>
          <Text style={[text.small, { color: colors.muted, marginTop: 6 }]}>Salmo 133:1 · RV1909</Text>
        </Pressable>
      </Appear>
    </ScrollView>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: 10, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 22, paddingVertical: 28 },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginTop: 8 },
  title: { fontFamily: serif, fontSize: 27, fontWeight: '700', textAlign: 'center', lineHeight: 34, maxWidth: 460 },
  cta: { alignSelf: 'stretch', gap: 10, marginTop: 10, maxWidth: 420, width: '100%', marginHorizontal: 'auto' },
  quiet: { alignItems: 'center', paddingVertical: 4 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  verse: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 18, alignItems: 'center' },
  verseText: { fontFamily: serif, fontSize: 18, lineHeight: 27, textAlign: 'center', fontStyle: 'italic' },
});
