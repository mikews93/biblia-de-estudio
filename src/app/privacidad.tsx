import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import { text } from '@/components/comunidad/ui';
import {
  BellIcon,
  BooksIcon,
  HeartIcon,
  ListenIcon,
  LockIcon,
  PeopleIcon,
  PersonIcon,
  SparkIcon,
  type IconProps,
} from '@/components/icons';
import { Colors, isDark, serif, useColors } from '@/lib/theme';

// La política de privacidad que piden las tiendas (App Store y Google Play), también en
// https://biblia.migueblanco.com/privacidad. Si cambia lo que la app guarda o a quién lo envía, hay que cambiarla aquí
// y en las fichas de las tiendas (etiquetas de privacidad y «Seguridad de los datos»).
const ACTUALIZADA = '25 de octubre de 2026';

type Parte = {
  icon: (p: IconProps) => React.ReactNode;
  titulo: string;
  puntos: string[];
};

const PARTES: Parte[] = [
  {
    icon: BooksIcon,
    titulo: 'Leer no pide nada',
    puntos: [
      'La Biblia, los planes, el interlineal, los comentarios y el audio se usan sin cuenta.',
      'Lo que haces sin cuenta (notas, subrayados, progreso, ajustes) se queda solo en tu dispositivo.',
      'No hay anuncios, no vendemos datos y no usamos herramientas de analítica ni de seguimiento de terceros.',
    ],
  },
  {
    icon: PersonIcon,
    titulo: 'Si creas una cuenta',
    puntos: [
      'Guardamos tu nombre, tu correo y tu contraseña cifrada. La foto, la biografía, la iglesia y la ciudad son opcionales.',
      'Si entras con Facebook, recibimos tu nombre, tu correo, tu foto de perfil y un identificador de Facebook. Nada más.',
      'Tu progreso, notas, diario, oraciones y «Mis preguntas» se guardan en tu cuenta para verlos en tus otros dispositivos. Son privados: nadie más los ve.',
    ],
  },
  {
    icon: SparkIcon,
    titulo: 'Las funciones con IA',
    puntos: [
      'Para preparar estudios y responder preguntas, enviamos el pasaje y lo que escribes a Anthropic (Claude). No enviamos tu nombre ni tu correo.',
      'Anthropic no usa esos datos para entrenar sus modelos. Los estudios generales de cada pasaje se guardan para que todos los lean sin volver a pedirlos.',
      'En el teléfono te pedimos permiso antes de la primera vez.',
      'Tus preguntas sobre un pasaje pueden ayudar a otros: se guardan sin tu nombre ni tu cuenta, después de borrar correos, teléfonos y enlaces. Una pregunta solo se publica si la hicieron al menos cinco personas, con otras palabras y revisada. Lo apagas con «No compartir» en el estudio. En el Modo Jóvenes nunca se guardan.',
    ],
  },
  {
    icon: ListenIcon,
    titulo: 'Audio y versiones con derechos',
    puntos: [
      'Los pódcast grabados con voz natural se hacen con ElevenLabs a partir del guion del capítulo, sin datos tuyos.',
      'Las versiones NBLA, NTV, NIV, NVI y LBLA se leen desde API.Bible y YouVersion. Ellos reciben qué capítulo se pide y un conteo anónimo de lecturas, que exigen sus licencias.',
    ],
  },
  {
    icon: PeopleIcon,
    titulo: 'La comunidad',
    puntos: [
      'Lo que publicas lo ven tus amigos, tu grupo o toda la comunidad, según elijas al publicar.',
      'Puedes reportar una publicación y bloquear a una persona desde su perfil. Si varias personas reportan algo, se oculta para todos.',
      'En el Modo Jóvenes no hay publicaciones públicas.',
      'Una petición de oración solo la ve el grupo al que la envías, nunca el muro, y deja de verse a los 30 días. Si la envías sin tu nombre, nadie del grupo ve quién la pidió, ni siquiera quien lo administra. Los ánimos que te envían solo los lees tú.',
    ],
  },
  {
    icon: HeartIcon,
    titulo: '«Para ti» en Hoy',
    puntos: [
      'Hoy puede mostrarte un versículo y un plan para lo que estás orando. Lo elige tu dispositivo con tu diario de oración, tus temas y los capítulos que leíste.',
      'Tus oraciones no se envían a ningún servidor ni a la IA para esto, no guardamos tus temas y no medimos qué te muestra Hoy. Lo apagas en «Mis temas».',
      'Si respondes «¿Cómo sigues?», tu respuesta se queda solo en ese dispositivo: no se guarda en tu cuenta.',
    ],
  },
  {
    icon: BellIcon,
    titulo: 'Notificaciones',
    puntos: [
      'Solo si las activas. Guardamos la dirección del dispositivo para enviarte el recordatorio diario y los avisos de tus amigos.',
    ],
  },
  {
    icon: HeartIcon,
    titulo: 'Niños y adolescentes',
    puntos: [
      'La app es para mayores de 13 años. El Espacio Niños de la web no pide cuenta, no usa IA ni comunidad y no envía nada fuera del dispositivo.',
      'No pedimos datos a menores de 13 años. Si un padre o una madre cree que su hijo nos dio datos, puede pedirnos que los borremos.',
    ],
  },
  {
    icon: LockIcon,
    titulo: 'Dónde se guarda y cómo borrarlo',
    puntos: [
      'La cuenta vive en Neon (base de datos) y Vercel (servidor y fotos), con conexión cifrada.',
      'En «Tu cuenta», «Borrar mi cuenta» borra al instante tu cuenta, tus datos sincronizados, tus publicaciones, tus comentarios y tu foto.',
      'Para cualquier pregunta sobre tus datos, escríbenos desde la comunidad o en biblia.migueblanco.com.',
    ],
  },
];

/** Política de privacidad: qué guarda la app, a quién lo envía y cómo borrarlo. */
export default function Privacidad() {
  const colors = useColors();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Privacidad' }} />
      <Appear>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
            <LockIcon color={colors.accent} size={28} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Tu privacidad</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 460 }]}>
            Zarza es gratis y sin anuncios. Guardamos lo mínimo para que funcione, y nada se vende ni se comparte para publicidad.
          </Text>
          <Text style={[text.small, { color: colors.muted }]}>Actualizada el {ACTUALIZADA}</Text>
        </View>
      </Appear>

      {PARTES.map((p, i) => (
        <Appear key={p.titulo} delay={40 + i * 30}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
            <View style={styles.cardHead}>
              <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                <p.icon color={colors.accent} size={18} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{p.titulo}</Text>
            </View>
            <View style={{ gap: 8, marginTop: 10 }}>
              {p.puntos.map((t) => (
                <View key={t} style={styles.point}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <Text style={[text.body, { color: colors.text, flex: 1 }]}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </Appear>
      ))}
    </ScrollView>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors)
    ? null
    : {
        boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)',
      };

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 64,
    gap: 12,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  emblem: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: serif, fontSize: 20, flex: 1 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
});
