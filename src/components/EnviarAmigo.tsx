// «Enviar a un amigo de Zarza»: la imagen del versículo va directo a uno o varios amigos, con un aviso en su
// teléfono, y ellos responden «Amén» o «Gracias» desde /recibidos.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, IconText } from '@/components/comunidad/ui';
import { CheckIcon, HeartIcon } from '@/components/icons';
import { useAccount } from '@/lib/comunidad';
import { ImageFormat, ImageLook, VerseToShare, datosDeImagen } from '@/lib/compartir';
import { huella } from '@/lib/sellos';
import { PersonaBreve, network, sendVerse } from '@/lib/social';
import { useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const MAX_A_LA_VEZ = 10;

type Props = { verse: VerseToShare; format: ImageFormat; look: ImageLook; onClose: () => void };

export default function EnviarAmigo({ verse, format, look, onClose }: Props) {
  const colors = useColors();
  const { usuario } = useAccount();
  const [open, setOpen] = useState(false);
  const [amigos, setAmigos] = useState<PersonaBreve[] | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado' | string>('listo');

  useEffect(() => {
    if (!open || !usuario) return;
    network()
      .then((r) => setAmigos(r.amigos))
      .catch((e) => (setAmigos([]), setEstado(e instanceof Error ? e.message : 'No se pudieron cargar tus amigos')));
  }, [open, usuario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ir = (href: string) => {
    onClose();
    navigate(() => router.push(href as never), 'forward');
  };
  const nombres = (ids: string[]) => {
    const n = ids.map((id) => amigos?.find((a) => a.id === id)?.nombre.split(' ')[0] ?? '');
    return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0];
  };
  const alternar = (id: string) =>
    setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : e.length < MAX_A_LA_VEZ ? [...e, id] : e));

  const enviar = async () => {
    setEstado('enviando');
    try {
      const datos = datosDeImagen(format, look);
      for (const para of elegidos) {
        await sendVerse({ para, libro: verse.book, capitulo: verse.chapter, versiculo: verse.verse, version: verse.version, datos });
      }
      setEstado('enviado');
      huella('compartir', `${verse.book}.${verse.chapter}.${verse.verse}`);
    } catch (e) {
      setEstado(e instanceof Error ? e.message : 'No se pudo enviar');
    }
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={[styles.closed, { borderColor: colors.border }]} accessibilityRole="button">
        <IconText icon={HeartIcon} color={colors.warm} size={18} gap={8}>
          <Text style={{ color: colors.warm, fontWeight: '700' }}>Enviar a un amigo de Zarza</Text>
        </IconText>
      </Pressable>
    );
  }

  let cuerpo;
  if (!usuario) {
    cuerpo = (
      <>
        <Text style={[styles.lead, { color: colors.text }]}>Para enviarle versículos a tus amigos necesitas una cuenta gratuita.</Text>
        <Pressable onPress={() => ir('/registro')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Crear mi cuenta</Text>
        </Pressable>
      </>
    );
  } else if (estado === 'enviado') {
    cuerpo = (
      <>
        <View style={[styles.done, { backgroundColor: colors.warmSoft }]}>
          <CheckIcon color={colors.warm} size={16} strokeWidth={2.4} />
          <Text style={{ color: colors.warm, fontWeight: '800' }}>Enviado a {nombres(elegidos)}</Text>
        </View>
        <Text style={[styles.lead, { color: colors.muted }]}>Le llega un aviso. Cuando responda «Amén» o «Gracias», te avisamos.</Text>
        <Pressable onPress={() => ir('/recibidos?ver=enviados')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Ver mis versículos enviados</Text>
        </Pressable>
      </>
    );
  } else if (amigos === null) {
    cuerpo = <ActivityIndicator color={colors.muted} />;
  } else if (!amigos.length) {
    cuerpo = (
      <>
        <Text style={[styles.lead, { color: colors.text }]}>Aún no tienes amigos en Zarza. Agrégalos con tu código y podrás enviarles versículos.</Text>
        <Pressable onPress={() => ir('/comunidades/amigos')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Agregar amigos</Text>
        </Pressable>
      </>
    );
  } else {
    cuerpo = (
      <>
        <Text style={[styles.lead, { color: colors.muted }]}>Le llega con un aviso y puede responderte «Amén» o «Gracias».</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.people}>
          {amigos.map((a) => {
            const on = elegidos.includes(a.id);
            return (
              <Pressable
                key={a.id}
                onPress={() => alternar(a.id)}
                accessibilityRole="checkbox"
                accessibilityLabel={a.nombre}
                aria-checked={on}
                style={styles.person}
              >
                <View style={[styles.ring, { borderColor: on ? colors.warm : 'transparent' }]}>
                  <Avatar name={a.nombre} foto={a.foto} size={46} />
                  {on && (
                    <View style={[styles.tick, { backgroundColor: colors.warm, borderColor: colors.surface }]}>
                      <CheckIcon color="#FFFFFF" size={11} strokeWidth={3} />
                    </View>
                  )}
                </View>
                <Text style={{ color: on ? colors.warm : colors.text, fontSize: 12.5, fontWeight: on ? '700' : '500' }} numberOfLines={1}>
                  {a.nombre.split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          onPress={enviar}
          disabled={!elegidos.length || estado === 'enviando'}
          style={[styles.primary, { backgroundColor: colors.warm }, (!elegidos.length || estado === 'enviando') && { opacity: 0.5 }]}
          accessibilityRole="button"
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
            {estado === 'enviando' ? 'Enviando…' : elegidos.length ? `Enviar a ${nombres(elegidos)}` : 'Elige a quién'}
          </Text>
        </Pressable>
        {estado !== 'listo' && estado !== 'enviando' && <Text style={{ color: '#B3412E' }}>{estado}</Text>}
      </>
    );
  }

  return (
    <View style={[styles.box, { borderColor: colors.border }]}>
      <IconText icon={HeartIcon} color={colors.warm} size={18} gap={8}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Enviar a un amigo de Zarza</Text>
      </IconText>
      {cuerpo}
    </View>
  );
}

const styles = StyleSheet.create({
  closed: { borderWidth: 1, borderRadius: 24, paddingVertical: 12, alignSelf: 'stretch', alignItems: 'center' },
  box: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, alignSelf: 'stretch', alignItems: 'center' },
  lead: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  strip: { alignSelf: 'stretch', flexGrow: 0 },
  people: { gap: 14, paddingHorizontal: 4, paddingVertical: 2, flexGrow: 1, justifyContent: 'center' },
  person: { alignItems: 'center', gap: 4, width: 64 },
  ring: { borderWidth: 2, borderRadius: 30, padding: 2 },
  tick: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  primary: { borderRadius: 24, paddingVertical: 12, paddingHorizontal: 22, alignItems: 'center', alignSelf: 'stretch' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
