import PaginaLegal, { type Parte } from '@/components/PaginaLegal';
import {
  BellIcon,
  BooksIcon,
  ChurchIcon,
  HeartIcon,
  ListenIcon,
  LockIcon,
  PeopleIcon,
  PersonIcon,
  SparkIcon,
} from '@/components/icons';

// La política de privacidad que piden las tiendas (App Store y Google Play), también en
// https://biblia.migueblanco.com/privacidad. Si cambia lo que la app guarda o a quién lo envía, hay que cambiarla aquí
// y en las fichas de las tiendas (etiquetas de privacidad y «Seguridad de los datos»).
const ACTUALIZADA = '25 de octubre de 2026';

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
      'Si entras con Google, Apple o Facebook, recibimos tu nombre, tu correo, tu foto de perfil (Apple no la da) y un identificador de esa cuenta. Nada más: no vemos tu contraseña ni publicamos nada en tu nombre.',
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
    icon: ChurchIcon,
    titulo: 'El Círculo de solteros',
    puntos: [
      'Es solo para mayores de 18 años de una iglesia que usa Zarza. Tu fecha de nacimiento la ven solo los líderes de tu círculo, que aprueban cada entrada.',
      'Tu etapa («abierto a conocer a alguien», por ejemplo) y tus respuestas de la semana las ven solo las personas de tu círculo.',
      '«Me gustaría conocerte» es secreto y vence a los 30 días. Los mensajes de «Conocernos» son solo de los dos: los líderes no los leen, solo reciben lo que alguien reporta.',
      'Lo que escribes en el camino de preparación se guarda solo en tu teléfono. Zarza solo sabe qué etapas terminaste y cuándo, y los líderes de tu círculo ven si lo terminaste.',
      'Tus respuestas de «Lo que sí importa» no las ve nadie: tu círculo solo ve en qué coinciden, tu propósito y dónde sirves.',
      'Al salir del círculo se borran tus marcas y se cierra tu «Conocernos».',
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
      'Para cualquier pregunta sobre tus datos, escríbenos a zarza@migueblanco.com.',
    ],
  },
];

/** Política de privacidad: qué guarda la app, a quién lo envía y cómo borrarlo. */
export default function Privacidad() {
  return (
    <PaginaLegal
      titulo="Tu privacidad"
      pantalla="Privacidad"
      emblema={LockIcon}
      resumen="Zarza es gratis y sin anuncios. Guardamos lo mínimo para que funcione, y nada se vende ni se comparte para publicidad."
      actualizada={ACTUALIZADA}
      partes={PARTES}
      otra={{ href: '/terminos', antes: 'Las reglas para usar Zarza están en los', nombre: 'Términos' }}
    />
  );
}
