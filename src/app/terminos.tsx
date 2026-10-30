import PaginaLegal, { type Parte } from '@/components/PaginaLegal';
import {
  BooksIcon,
  DocumentIcon,
  FlagIcon,
  GlobeIcon,
  HeartIcon,
  LockIcon,
  PencilIcon,
  PeopleIcon,
  PersonIcon,
  RefreshIcon,
  ShieldIcon,
  SparkIcon,
  TrashIcon,
} from '@/components/icons';

// Los términos y condiciones de Zarza, también en https://zarzabiblia.com/terminos (los piden Google, Apple y
// Facebook para el inicio de sesión, y las tiendas). Parten de los términos de DeusRex que revisan los abogados de MB
// Technology Solutions LLC, adaptados a una app gratuita, sin anuncios y con comunidad. Si cambian en algo importante,
// hay que avisar en la app con 30 días de anticipación (ver «Si cambian estos términos»).
const ACTUALIZADA = '26 de octubre de 2026';

const PARTES: Parte[] = [
  {
    icon: DocumentIcon,
    titulo: 'Quiénes somos y qué aceptas',
    puntos: [
      'Zarza (zarzabiblia.com y sus apps) la ofrece MB Technology Solutions LLC, compañía de Nuevo México (Estados Unidos), número de registro 0008106326, con domicilio en 1209 Mountain Road Pl NE, Ste N, Albuquerque, NM 87110.',
      'Al usar Zarza, o al crear tu cuenta o entrar con Google, Apple o Facebook, aceptas estos términos y la política de Privacidad. Aceptarlos así, por medios electrónicos, vale igual que firmarlos (Ley 527 de 1999 de Colombia).',
      'Si no estás de acuerdo con ellos, no uses la app.',
    ],
  },
  {
    icon: HeartIcon,
    titulo: 'Gratis y sin anuncios',
    puntos: [
      'Zarza no cobra por leer, estudiar ni usar la comunidad, y no muestra publicidad.',
      'Las donaciones de «Sostén Zarza» son voluntarias: ayudan a que la app siga gratis para otros y no compran funciones ni privilegios.',
      'Algunas funciones tienen un límite diario para que alcancen para todos, como las preguntas a la IA o las grabaciones de pódcast. Podemos añadir, cambiar o retirar funciones cuando haga falta.',
    ],
  },
  {
    icon: PersonIcon,
    titulo: 'Tu cuenta',
    puntos: [
      'Zarza es para mayores de 13 años. Si tienes entre 13 y 17, úsala con el permiso de tu padre, tu madre o quien te cuide. El Círculo de solteros es solo para mayores de 18.',
      'Usa tu nombre real o un apodo que no confunda a nadie, y no te hagas pasar por otra persona. Cada cuenta es de una sola persona.',
      'Cuida tu contraseña y tus cuentas de Google, Apple o Facebook: lo que se haga desde tu cuenta cuenta como hecho por ti. Si crees que alguien entró a ella, cambia la contraseña y avísanos.',
      'Si entras con Google, Apple o Facebook, también aplican sus propias condiciones.',
    ],
  },
  {
    icon: SparkIcon,
    titulo: 'La IA ayuda, no reemplaza',
    puntos: [
      'Los estudios, preguntas, resúmenes y sugerencias de la IA pueden tener errores o quedarse cortos. Contrástalos siempre con la Escritura y con tu iglesia.',
      'La IA no es consejo pastoral, médico, psicológico, legal ni financiero, y no reemplaza a tu pastor ni a un profesional. Tampoco escribe sermones completos: hace preguntas y sugiere.',
      'Si estás en peligro o pensando en hacerte daño, busca ayuda ahora en los servicios de emergencia de tu país o con una persona de confianza.',
      'Lo que escribes a la IA no se usa para entrenar modelos.',
    ],
  },
  {
    icon: PeopleIcon,
    titulo: 'Cómo convivimos en la comunidad',
    puntos: [
      'Trata a los demás con respeto, aunque no piensen como tú. Se vale discrepar sobre un pasaje; no se vale humillar.',
      'No se permite: acoso, amenazas, odio contra personas o grupos, contenido sexual, violencia gráfica, estafas, publicidad o spam, ni publicar datos personales de otros sin su permiso.',
      'Cualquier contenido que ponga en riesgo a un menor se borra, se cierra la cuenta y se informa a las autoridades.',
      'Puedes reportar una publicación y bloquear a una persona. Podemos ocultar o borrar lo que incumpla estas reglas, y suspender o cerrar la cuenta de quien las incumpla, sin aviso cuando haya riesgo para otros.',
    ],
  },
  {
    icon: ShieldIcon,
    titulo: 'Usar la app como se debe',
    puntos: [
      'No intentes saltarte los límites, entrar a cuentas o datos de otros, copiar en masa los textos o estudios con programas automáticos, ni descompilar o atacar la app.',
      'No uses Zarza para nada ilegal ni para revender sus contenidos.',
    ],
  },
  {
    icon: PencilIcon,
    titulo: 'Lo que escribes es tuyo',
    puntos: [
      'Tus notas, oraciones, publicaciones, comentarios y sermones siguen siendo tuyos.',
      'Para mostrarlos donde elijas (tu dispositivo, tus amigos, tu grupo o la comunidad), nos das permiso gratuito y no exclusivo de guardarlos, mostrarlos y adaptarlos al formato de la app mientras estén publicados.',
      'Publica solo lo que tengas derecho a compartir. Si lo borras, deja de mostrarse.',
    ],
  },
  {
    icon: BooksIcon,
    titulo: 'Textos bíblicos y otros derechos',
    puntos: [
      'La Reina-Valera 1909 y los comentarios clásicos son de dominio público.',
      'Las versiones NBLA, NTV, NIV, NVI y LBLA pertenecen a sus dueños y se leen con su licencia, a través de API.Bible y YouVersion, solo para tu lectura dentro de la app. No las copies ni las publiques fuera de lo que esas licencias permiten.',
      'El nombre y el ícono de Zarza, su diseño, sus estudios, audios, ilustraciones y su código pertenecen a MB Technology Solutions LLC. Todos los derechos reservados.',
    ],
  },
  {
    icon: FlagIcon,
    titulo: 'Sin garantías',
    puntos: [
      'Hacemos lo posible para que Zarza funcione bien, pero se ofrece tal como está: puede tener fallos, pausas o cambios, y no garantizamos que esté siempre disponible ni libre de errores.',
      'Haz copias de lo que te importe: si borras la app o tu cuenta, lo guardado allí se pierde.',
    ],
  },
  {
    icon: LockIcon,
    titulo: 'Hasta dónde respondemos',
    puntos: [
      'En la medida que permita la ley, no respondemos por daños indirectos, por la pérdida de datos ni por decisiones tomadas a partir de lo que dice la app o la IA.',
      'Tampoco por lo que otras personas publiquen, aunque lo revisamos cuando se reporta.',
      'Si usas Zarza incumpliendo estos términos y eso causa un reclamo de un tercero, te corresponde responder por ello.',
      'Nada de esto limita lo que la ley no deja limitar, como la responsabilidad por dolo o culpa grave, ni los derechos que te da la ley de protección al consumidor.',
    ],
  },
  {
    icon: TrashIcon,
    titulo: 'Borrar tu cuenta',
    puntos: [
      'Puedes irte cuando quieras: en «Tu cuenta», «Borrar mi cuenta» la borra al instante con tus datos sincronizados, publicaciones y comentarios.',
      'Si cerramos tu cuenta por incumplir estos términos, te lo diremos cuando sea razonable hacerlo.',
    ],
  },
  {
    icon: RefreshIcon,
    titulo: 'Si cambian estos términos',
    puntos: [
      'Si hacemos un cambio importante, lo avisaremos en la app al menos 30 días antes de que aplique. Si sigues usando Zarza después, aceptas los nuevos términos.',
      'Si alguna parte de estos términos no fuera válida, el resto sigue vigente. No respondemos por fallas causadas por hechos fuera de nuestro control (fuerza mayor).',
    ],
  },
  {
    icon: GlobeIcon,
    titulo: 'Ley, quejas y contacto',
    puntos: [
      'Estos términos se rigen por las leyes de Colombia. Cualquier diferencia la resolverán los jueces competentes de Colombia, sin perjuicio de tus derechos como consumidor, incluido presentar una queja ante la Superintendencia de Industria y Comercio.',
      'Antes de eso, escríbenos a soporte@zarzabiblia.com: casi todo se arregla hablando.',
    ],
  },
];

/** Términos y condiciones: las reglas para usar Zarza, en palabras sencillas. */
export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos y condiciones"
      pantalla="Términos"
      emblema={DocumentIcon}
      resumen="Las reglas para usar Zarza, en palabras sencillas: qué te ofrecemos, qué esperamos de ti y qué pasa si algo sale mal."
      actualizada={ACTUALIZADA}
      partes={PARTES}
      otra={{ href: '/privacidad', antes: 'Cómo cuidamos tus datos está en', nombre: 'Privacidad' }}
    />
  );
}
