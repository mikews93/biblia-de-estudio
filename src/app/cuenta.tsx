import { Stack, router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Avatar, Button, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { BellIcon, CameraIcon, ChevronRightIcon, ChurchIcon, FacebookLogo, KeyIcon, PinIcon } from '@/components/icons';
import { deleteAccount, protectAccount, signOut, useAccount } from '@/lib/comunidad';
import {
  disconnectFacebook,
  facebook,
  facebookAvailable,
  MAX_BIO,
  MAX_PLACE,
  pickPhoto,
  removePhoto,
  resumeFacebook,
  saveProfile,
} from '@/lib/perfil';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/** Tu perfil: la foto, cómo te ven los demás, las cuentas conectadas, cómo entrar y la sesión. */
export default function AccountScreen() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [church, setChurch] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [fbReady, setFbReady] = useState(false);
  const profileAction = useAction();
  const photoAction = useAction();
  const fbAction = useAction();
  const loginAction = useAction();
  const deleteAction = useAction();

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2500);
  };

  useEffect(() => {
    if (usuario) {
      setName(usuario.nombre);
      setBio(usuario.bio ?? '');
      setChurch(usuario.iglesia ?? '');
      setCity(usuario.ciudad ?? '');
      setEmail(usuario.correo ?? '');
    }
    // También cuando llegan del servidor datos más nuevos que los guardados en el dispositivo.
  }, [usuario?.id, usuario?.nombre, usuario?.bio, usuario?.iglesia, usuario?.ciudad, usuario?.correo]);

  useEffect(() => {
    facebookAvailable().then(setFbReady);
    // Si se fue a Facebook en esta misma pestaña, al volver se termina de conectar.
    fbAction.run(async () => {
      if (await resumeFacebook()) flash('Facebook quedó conectado');
    });
  }, []);

  if (ready && !usuario) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page}>
        <Stack.Screen options={{ title: 'Tu perfil' }} />
        <Welcome />
      </ScrollView>
    );
  }
  if (!usuario) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Tu perfil' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const dirty =
    name.trim() !== usuario.nombre ||
    bio.trim() !== (usuario.bio ?? '') ||
    church.trim() !== (usuario.iglesia ?? '') ||
    city.trim() !== (usuario.ciudad ?? '');
  const hasPassword = usuario.conClave ?? Boolean(usuario.correo);
  const place = [usuario.iglesia, usuario.ciudad].filter(Boolean).join(' · ');

  const save = () =>
    profileAction
      .run(() => saveProfile({ nombre: name, bio, iglesia: church, ciudad: city }))
      .then((ok) => ok && flash('Perfil guardado'));

  const choosePhoto = () => photoAction.run(pickPhoto).then((ok) => ok && flash('Foto actualizada'));

  const dropPhoto = async () => {
    if (!(await confirm('¿Quitar tu foto?', 'Se verán tus iniciales en su lugar.', 'Quitar foto'))) return;
    photoAction.run(removePhoto);
  };

  const connect = () => fbAction.run(async () => (await facebook('conectar')) && flash('Facebook quedó conectado'));

  const disconnect = async () => {
    if (!(await confirm('¿Desconectar Facebook?', 'Ya no podrás entrar con Facebook. Tu foto y tu nombre se quedan como están.', 'Desconectar'))) return;
    fbAction.run(disconnectFacebook);
  };

  const out = async () => {
    const msg = hasPassword
      ? 'Podrás volver a entrar con tu correo y tu contraseña.'
      : usuario.facebook
        ? 'Podrás volver a entrar con Facebook.'
        : 'Tu cuenta no tiene correo: si sales, no podrás volver a entrar en ella.';
    if (!(await confirm('¿Cerrar sesión en este dispositivo?', msg, 'Cerrar sesión'))) return;
    await signOut();
    navigate(() => router.replace('/comunidades'), 'back');
  };

  const remove = async () => {
    const ok = await confirm(
      '¿Borrar tu cuenta?',
      'Se borran tu nombre, tu foto, tus notas, tus peticiones, tus publicaciones, tus comentarios y tus amistades, y sales de todos tus grupos. No se puede deshacer.',
      'Borrar cuenta',
    );
    if (!ok) return;
    if (await deleteAction.run(deleteAccount)) navigate(() => router.replace('/comunidades'), 'back');
  };

  const go = (href: string) => navigate(() => router.push(href as never), 'forward');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Tu perfil' }} />

      <Appear>
        <View style={[styles.hero, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.cover, { backgroundColor: colors.accentSoft }]} />
          <View style={styles.photoWrap}>
            <Pressable
              onPress={choosePhoto}
              disabled={photoAction.busy}
              accessibilityRole="button"
              accessibilityLabel={usuario.foto ? 'Cambiar la foto' : 'Poner una foto'}
              style={[styles.photo, { borderColor: colors.surface, backgroundColor: colors.surface }]}
            >
              <Avatar name={usuario.nombre} foto={usuario.foto} size={104} filled />
              {photoAction.busy && (
                <View style={[styles.photoBusy, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              <View style={[styles.camera, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
                <CameraIcon color={colors.surface} size={17} />
              </View>
            </Pressable>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{usuario.nombre}</Text>
          {place ? <Text style={[styles.place, { color: colors.muted }]}>{place}</Text> : null}
          {usuario.bio ? <Text style={[styles.bio, { color: colors.text }]}>{usuario.bio}</Text> : null}
          <View style={styles.heroLinks}>
            <Pressable onPress={choosePhoto} hitSlop={6} accessibilityRole="button">
              <Text style={[styles.link, { color: colors.accent }]}>{usuario.foto ? 'Cambiar foto' : 'Poner foto'}</Text>
            </Pressable>
            {usuario.foto ? (
              <>
                <Text style={{ color: colors.border }}>·</Text>
                <Pressable onPress={dropPhoto} hitSlop={6} accessibilityRole="button">
                  <Text style={[styles.link, { color: colors.muted }]}>Quitar</Text>
                </Pressable>
              </>
            ) : null}
            <Text style={{ color: colors.border }}>·</Text>
            <Pressable onPress={() => go(`/comunidades/persona/${usuario.id}`)} hitSlop={6} accessibilityRole="link">
              <Text style={[styles.link, { color: colors.accent }]}>Ver cómo te ven</Text>
            </Pressable>
          </View>
          <ErrorText>{photoAction.error}</ErrorText>
        </View>
      </Appear>

      <Appear delay={60}>
        <Section colors={colors} title="Sobre ti" hint="Lo ven tus amigos, tus grupos y la comunidad.">
          <Field label="Tu nombre" value={name} onChangeText={setName} maxLength={40} autoComplete="name" />
          <View>
            <Field
              label="Unas líneas sobre ti"
              value={bio}
              onChangeText={setBio}
              maxLength={MAX_BIO}
              multiline
              placeholder="Por ejemplo: aprendiendo a leer la Biblia con mi familia"
            />
            <Text style={[styles.counter, { color: bio.length > MAX_BIO - 20 ? colors.accent : colors.muted }]}>
              {bio.length}/{MAX_BIO}
            </Text>
          </View>
          <View style={styles.pair}>
            <View style={styles.pairItem}>
              <IconLabel colors={colors} Icon={ChurchIcon} label="Tu iglesia" />
              <Field value={church} onChangeText={setChurch} maxLength={MAX_PLACE} placeholder="Opcional" />
            </View>
            <View style={styles.pairItem}>
              <IconLabel colors={colors} Icon={PinIcon} label="Tu ciudad" />
              <Field value={city} onChangeText={setCity} maxLength={MAX_PLACE} placeholder="Opcional" autoComplete="address-line2" />
            </View>
          </View>
          <Button label="Guardar cambios" onPress={save} busy={profileAction.busy} disabled={!dirty || !name.trim()} />
          <ErrorText>{profileAction.error}</ErrorText>
        </Section>
      </Appear>

      {(fbReady || usuario.facebook) && (
        <Appear delay={100}>
          <Section colors={colors} title="Cuentas conectadas">
            <View style={styles.service}>
              <FacebookLogo size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Facebook</Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                  {usuario.facebook
                    ? `Conectado como ${usuario.facebook}. Puedes entrar con Facebook en cualquier dispositivo.`
                    : 'Entra con un toque y, si no tienes foto, usa la de tu Facebook.'}
                </Text>
              </View>
              {usuario.facebook ? (
                <Button label="Desconectar" kind="quiet" onPress={disconnect} busy={fbAction.busy} />
              ) : (
                <Button label="Conectar" kind="outline" onPress={connect} busy={fbAction.busy} disabled={!fbReady} style={styles.small} />
              )}
            </View>
            <ErrorText>{fbAction.error}</ErrorText>
          </Section>
        </Appear>
      )}

      <Appear delay={140}>
        <Section
          colors={colors}
          title="Entrar desde otro dispositivo"
          Icon={KeyIcon}
          hint={
            hasPassword
              ? `Entras con ${usuario.correo}. Puedes cambiar el correo o la contraseña.`
              : usuario.correo
                ? `Tu correo es ${usuario.correo}. Elige una contraseña para entrar también sin Facebook.`
                : 'Añade un correo y una contraseña para abrir tu cuenta en otro teléfono o en el navegador.'
          }
        >
          <Field
            label="Correo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label={hasPassword ? 'Contraseña nueva' : 'Contraseña'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Al menos 8 caracteres"
          />
          <Button
            label="Guardar correo y contraseña"
            kind="outline"
            onPress={() =>
              loginAction.run(() => protectAccount(email, password)).then((ok) => {
                if (ok) {
                  setPassword('');
                  flash('Listo: ya puedes entrar desde otro dispositivo');
                }
              })
            }
            busy={loginAction.busy}
            disabled={!email.trim() || password.length < 8}
          />
          <ErrorText>{loginAction.error}</ErrorText>
        </Section>
      </Appear>

      <Appear delay={180}>
        <Pressable
          onPress={() => go('/notificaciones')}
          accessibilityRole="link"
          style={[styles.row, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}>
            <BellIcon color={colors.accent} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Notificaciones</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>Recordatorio diario y avisos de tus amigos</Text>
          </View>
          <ChevronRightIcon color={colors.muted} size={20} />
        </Pressable>
      </Appear>

      <View style={styles.session}>
        <Button label="Cerrar sesión" kind="quiet" onPress={out} />
        <Button label="Borrar mi cuenta" kind="quiet" onPress={remove} busy={deleteAction.busy} />
      </View>
      <ErrorText>{deleteAction.error}</ErrorText>

      {saved && (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={[styles.toast, { backgroundColor: colors.text }]} accessibilityLiveRegion="polite">
            <Text style={{ color: colors.background, fontWeight: '700' }}>{saved}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Section({
  colors,
  title,
  hint,
  Icon,
  children,
}: {
  colors: Colors;
  title: string;
  hint?: string;
  Icon?: (p: { color: string; size?: number }) => ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={[styles.card, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        {Icon && <Icon color={colors.accent} size={20} />}
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {hint && <Text style={[text.body, { color: colors.muted, marginTop: -6 }]}>{hint}</Text>}
      {children}
    </View>
  );
}

function IconLabel({ colors, Icon, label }: { colors: Colors; Icon: (p: { color: string; size?: number }) => ReactNode; label: string }) {
  return (
    <View style={styles.iconLabel}>
      <Icon color={colors.muted} size={15} />
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' };

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 64, maxWidth: 600, width: '100%', alignSelf: 'center', gap: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', paddingBottom: 20 },
  cover: { alignSelf: 'stretch', height: 84 },
  photoWrap: { marginTop: -56 },
  photo: { borderRadius: 60, borderWidth: 4 },
  photoBusy: { ...StyleSheet.absoluteFill, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: serif, fontSize: 26, fontWeight: '700', marginTop: 12, paddingHorizontal: 20, textAlign: 'center' },
  place: { fontSize: 14, marginTop: 4, paddingHorizontal: 20, textAlign: 'center' },
  bio: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    paddingHorizontal: 28,
    textAlign: 'center',
    maxWidth: 440,
  },
  heroLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14, paddingHorizontal: 16 },
  link: { fontWeight: '700', fontSize: 14 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: serif, fontSize: 19, fontWeight: '700' },
  counter: { fontSize: 12, textAlign: 'right', marginTop: 4 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pairItem: { flexGrow: 1, flexBasis: 200 },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  service: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  small: { paddingVertical: 8, paddingHorizontal: 16, minHeight: 38 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  session: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  toastWrap: {
    position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
  },
  toast: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11 },
});
