import * as Clipboard from 'expo-clipboard';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { Avatar, Chips, ErrorText, text } from '@/components/comunidad/ui';
import { CheckIcon, ChevronRightIcon, CommentIcon, CopyIcon, InviteIcon, QrIcon, ShareIcon, type IconProps } from '@/components/icons';
import Qr from '@/components/Qr';
import { shareMessage } from '@/lib/compartir';
import { useAccount } from '@/lib/comunidad';
import { ESTILOS, EstiloMensaje, inviteMessage, inviteUrl, shortUrl, whatsappUrl } from '@/lib/invitar';
import { PersonaBreve, network } from '@/lib/social';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/**
 * Invitar amigos a Zarza: tu enlace (zarzabiblia.com/i/CODIGO), el mensaje para enviarlo, un QR para mostrarlo en
 * persona y quiénes se unieron con él. Sin cuenta se comparte la dirección de Zarza, sin la amistad.
 */
export default function Invitar() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [invitados, setInvitados] = useState<PersonaBreve[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estilo, setEstilo] = useState<EstiloMensaje>('sencillo');
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;
      network()
        .then((r) => {
          setCodigo(r.codigo);
          setInvitados(r.invitados ?? []);
        })
        .catch((e) => setError(e.message));
    }, [usuario?.id]),
  );

  const loading = !ready || (usuario && !codigo && !error);
  const url = inviteUrl(usuario ? codigo : null);
  const message = inviteMessage(estilo, url);
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);

  const copy = async () => {
    await Clipboard.setStringAsync(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: 'Invitar amigos' }} />

      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <View style={[styles.emblem, { backgroundColor: colors.warmSoft }]}>
            <InviteIcon color={colors.warm} size={30} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Lean la Biblia juntos</Text>
          <Text style={[text.body, styles.center, { color: colors.muted, maxWidth: 440 }]}>
            {usuario
              ? 'Comparte tu enlace. Quien se une con él queda como tu amigo: verán lo que cada uno lee, resalta y pregunta.'
              : 'Comparte Zarza con quien quieras. Es gratis y se lee sin cuenta.'}
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <View style={[styles.link, { backgroundColor: colors.background, borderColor: colors.border }]} testID="enlace-invitar">
                <Text style={[styles.linkText, { color: colors.text }]} numberOfLines={1} selectable>
                  {shortUrl(url)}
                </Text>
              </View>
              <View style={styles.actions}>
                {canShare && <Action icon={ShareIcon} label="Compartir" primary colors={colors} onPress={() => shareMessage(message)} />}
                <Action icon={copied ? CheckIcon : CopyIcon} label={copied ? 'Copiado' : 'Copiar'} colors={colors} onPress={copy} />
                <Action icon={CommentIcon} label="WhatsApp" colors={colors} onPress={() => Linking.openURL(whatsappUrl(message))} />
              </View>
            </>
          )}
          <ErrorText>{error}</ErrorText>
        </View>
      </Appear>

      {!loading && (
        <>
          <Appear delay={60}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
              <Text style={[styles.label, { color: colors.muted }]}>EL MENSAJE</Text>
              <Chips options={ESTILOS} value={estilo} onChange={setEstilo} />
              <View style={[styles.bubble, { backgroundColor: colors.accentSoft }]}>
                <Text style={[text.body, { color: colors.text }]} testID="mensaje-invitar">
                  {message}
                </Text>
              </View>
              <Text style={[text.small, { color: colors.muted }]}>
                Al compartir se envía este texto con tu enlace. Puedes cambiarlo antes de enviarlo.
              </Text>
            </View>
          </Appear>

          <Appear delay={100}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
              <Pressable onPress={() => setQr((v) => !v)} style={styles.row} accessibilityRole="button" accessibilityState={{ expanded: qr }}>
                <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                  <QrIcon color={colors.accent} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>En persona</Text>
                  <Text style={[text.small, { color: colors.muted, marginTop: 2 }]}>
                    {qr ? 'Que lo escaneen con la cámara del teléfono' : 'Muestra un código QR en la iglesia o en tu grupo'}
                  </Text>
                </View>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>{qr ? 'Ocultar' : 'Mostrar'}</Text>
              </Pressable>
              {qr && (
                <View style={styles.qr}>
                  <View style={styles.qrFrame}>
                    <Qr value={url} size={220} />
                  </View>
                  {usuario && <Text style={[text.small, { color: colors.muted }]}>Invitación de {usuario.nombre}</Text>}
                </View>
              )}
            </View>
          </Appear>

          {usuario ? (
            <Appear delay={140}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
                <Text style={[styles.label, { color: colors.muted }]}>
                  SE UNIERON CON TU ENLACE{invitados?.length ? ` · ${invitados.length}` : ''}
                </Text>
                {!invitados?.length ? (
                  <Text style={[text.body, { color: colors.muted }]}>
                    Aquí verás a quienes se unan a Zarza con tu enlace. Te avisamos cuando alguien lo haga.
                  </Text>
                ) : (
                  <View style={{ gap: 4 }}>
                    {invitados.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => navigate(() => router.push(`/comunidades/persona/${p.id}`), 'forward')}
                        style={({ pressed }) => [styles.person, pressed && { opacity: 0.7 }]}
                        accessibilityRole="link"
                      >
                        <Avatar name={p.nombre} foto={p.foto} size={36} />
                        <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{p.nombre}</Text>
                        <ChevronRightIcon color={colors.muted} size={18} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </Appear>
          ) : (
            <Appear delay={140}>
              <Welcome intro="Con tu cuenta, quien se une con tu enlace queda como tu amigo y ves cuántos se unieron." />
            </Appear>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Action({
  icon: Icon,
  label,
  primary,
  colors,
  onPress,
}: {
  icon: (p: IconProps) => React.ReactNode;
  label: string;
  primary?: boolean;
  colors: Colors;
  onPress: () => void;
}) {
  const color = primary ? colors.background : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        primary ? { backgroundColor: colors.accent } : { borderColor: colors.accent, borderWidth: 1 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Icon color={color} size={18} strokeWidth={2} />
      <Text style={{ color, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 64, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  center: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: 10, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24 },
  emblem: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: serif, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  link: { alignSelf: 'stretch', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 16, marginTop: 8 },
  linkText: { fontSize: 16, fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },
  actions: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  action: { flexGrow: 1, flexBasis: 100, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 24, paddingVertical: 12 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 12 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  bubble: { borderRadius: 18, borderTopLeftRadius: 6, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: serif, fontSize: 19 },
  qr: { alignItems: 'center', gap: 10, paddingTop: 4 },
  qrFrame: { padding: 12, borderRadius: 18, backgroundColor: '#FFFFFF' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
