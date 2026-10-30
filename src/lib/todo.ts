import { chapterHref } from './routes';

/**
 * «Todo en Zarza» (/todo): cada función de la app en un solo lugar, por grupos, con una línea que dice para qué sirve.
 * Hoy muestra solo los accesos más usados y este catálogo guarda el resto. Las funciones que dependen de un capítulo
 * abren el último que se leyó.
 */

export type Icono =
  | 'books' | 'plans' | 'compare' | 'listen' | 'download' | 'sun' | 'spark' | 'search' | 'word' | 'arcs' | 'promise'
  | 'clock' | 'tree' | 'route' | 'pin' | 'mindmap' | 'cards' | 'heart' | 'pencil' | 'star' | 'sunrise' | 'topic'
  | 'lectern' | 'scroll' | 'calendar' | 'live' | 'people' | 'invite' | 'share' | 'gift' | 'rings' | 'candle' | 'hammer'
  | 'church' | 'bell' | 'person' | 'lamp' | 'flame' | 'shield' | 'dictionary';

export type Funcion = { id: string; titulo: string; detalle: string; icono: Icono; href: string; palabras?: string; soloAdultos?: boolean };
export type Grupo = { id: string; titulo: string; detalle: string; funciones: Funcion[] };

export function catalogo(ultimo: { book: string; chapter: number }): Grupo[] {
  const { book, chapter } = ultimo;
  return [
    {
      id: 'leer',
      titulo: 'Leer y escuchar',
      detalle: 'La Biblia cada día, en tu versión y también sin internet.',
      funciones: [
        { id: 'libros', titulo: 'Libros', detalle: 'Los 66 libros, para ir directo a un capítulo.', icono: 'books', href: '/libros' },
        { id: 'planes', titulo: 'Planes de lectura', detalle: 'Un camino por días, solo o con otros.', icono: 'plans', href: '/planes' },
        { id: 'comparar', titulo: 'Comparar versiones', detalle: 'El mismo capítulo en varias traducciones.', icono: 'compare', href: `/comparar/${book}/${chapter}`, palabras: 'traducciones nbla nvi' },
        { id: 'podcast', titulo: 'Resumen en audio', detalle: 'Ana y Tomás conversan sobre el capítulo.', icono: 'listen', href: `/podcast/${book}/${chapter}`, palabras: 'podcast pódcast escuchar' },
        { id: 'descargas', titulo: 'Sin conexión', detalle: 'Descarga versiones completas para leer sin internet.', icono: 'download', href: '/descargas', palabras: 'offline descargar' },
        { id: 'despertador', titulo: 'Despertador', detalle: 'Despierta con un versículo leído en voz alta.', icono: 'sun', href: '/despertador', palabras: 'alarma' },
      ],
    },
    {
      id: 'estudiar',
      titulo: 'Estudiar a fondo',
      detalle: 'El texto original, las conexiones y preguntas que te hacen pensar.',
      funciones: [
        { id: 'estudiar', titulo: 'Estudiar con IA', detalle: 'Preguntas y contexto del capítulo que lees, con fuentes.', icono: 'spark', href: chapterHref(book, chapter), palabras: 'inteligencia artificial devocional profundo' },
        { id: 'preguntar', titulo: 'Pregúntale a la Biblia', detalle: 'Una duda en tus palabras, respondida con pasajes.', icono: 'search', href: '/preguntar', palabras: 'pregunta duda' },
        { id: 'palabras', titulo: 'La historia de una palabra', detalle: 'Hesed, ágape y otras palabras del hebreo y el griego.', icono: 'word', href: '/palabras', palabras: 'griego hebreo original' },
        { id: 'conexiones', titulo: 'Conexiones', detalle: 'Todas las referencias cruzadas como arcos.', icono: 'arcs', href: '/conexiones', palabras: 'referencias cruzadas' },
        { id: 'promesas', titulo: 'Promesa y cumplimiento', detalle: 'Lo que se anunció y dónde se cumplió.', icono: 'promise', href: '/promesas', palabras: 'profecía' },
        { id: 'historia', titulo: 'Línea de tiempo', detalle: 'Los hechos de la Biblia en orden.', icono: 'clock', href: '/historia', palabras: 'cronología' },
        { id: 'genealogia', titulo: 'Genealogías', detalle: 'Los árboles familiares, de Adán a Jesús.', icono: 'tree', href: '/genealogia', palabras: 'familia árbol' },
        { id: 'recorridos', titulo: 'Recorridos', detalle: 'Los viajes de Abraham, Israel, Pablo y más en el mapa.', icono: 'route', href: '/recorridos', palabras: 'viajes mapa' },
        { id: 'lugares', titulo: 'Lugares del capítulo', detalle: 'Dónde pasa lo que estás leyendo.', icono: 'pin', href: `/mapa/${book}/${chapter}`, palabras: 'mapa' },
        { id: 'mapa-mental', titulo: 'Mapa mental', detalle: 'Las ideas del capítulo de un vistazo.', icono: 'mindmap', href: `/mapa-mental/${book}/${chapter}` },
        { id: 'repaso', titulo: 'Tarjetas de repaso', detalle: 'Recuerda lo que estudiaste, poco a poco.', icono: 'cards', href: '/repaso', palabras: 'memorizar' },
      ],
    },
    {
      id: 'crecer',
      titulo: 'Orar y crecer',
      detalle: 'Lo tuyo: tus oraciones, tus notas y tu camino.',
      funciones: [
        { id: 'diario', titulo: 'Mi diario', detalle: 'Escribe lo que Dios te habla y lo que oras.', icono: 'heart', href: '/diario', palabras: 'oración oraciones' },
        { id: 'notas', titulo: 'Mis resaltados y notas', detalle: 'Todo lo que marcaste mientras leías.', icono: 'pencil', href: '/notas' },
        { id: 'sellos', titulo: 'Mis sellos', detalle: 'Los pasos que vas dando, sin competir con nadie.', icono: 'star', href: '/sellos', palabras: 'logros racha' },
        { id: 'mi-ano', titulo: 'Mi año', detalle: 'Tu año con la Palabra en una imagen.', icono: 'sunrise', href: '/mi-ano' },
        { id: 'mis-temas', titulo: 'Mis temas', detalle: 'Lo que «Para ti» tiene en cuenta en Hoy.', icono: 'topic', href: '/mis-temas', palabras: 'para ti' },
      ],
    },
    {
      id: 'ensenar',
      titulo: 'Enseñar y predicar',
      detalle: 'Prepara y guía. La IA pregunta y sugiere; el mensaje lo escribes tú.',
      funciones: [
        { id: 'taller', titulo: 'Taller', detalle: 'Prepara un estudio o un sermón desde un tema o un pasaje.', icono: 'lectern', href: '/taller', palabras: 'sermón predicar' },
        { id: 'dinamicas', titulo: 'Dinámicas', detalle: 'Actividades para hacer con un grupo.', icono: 'scroll', href: '/taller/dinamicas', palabras: 'juegos grupo' },
        { id: 'semana', titulo: 'Del sermón a tu semana', detalle: 'Lo que escuchaste el domingo, en cinco días.', icono: 'calendar', href: '/semana' },
        { id: 'eventos', titulo: 'Eventos', detalle: 'La congregación sigue el bosquejo en vivo.', icono: 'church', href: '/eventos', palabras: 'iglesia culto' },
        { id: 'vivo', titulo: 'Lectura en vivo', detalle: 'Quien guía pasa la página para todos.', icono: 'live', href: '/vivo', palabras: 'célula grupo' },
      ],
    },
    {
      id: 'juntos',
      titulo: 'Juntos',
      detalle: 'La fe se vive con otros.',
      funciones: [
        { id: 'comunidad', titulo: 'Comunidad', detalle: 'Lo que leen y comparten tus amigos y tus grupos.', icono: 'people', href: '/comunidades', palabras: 'amigos' },
        { id: 'grupos', titulo: 'Planes en grupo', detalle: 'Lean el mismo plan y anímense.', icono: 'plans', href: '/grupos' },
        { id: 'invitar', titulo: 'Invitar amigos', detalle: 'Un enlace para que lleguen a Zarza contigo.', icono: 'invite', href: '/invitar' },
        { id: 'ocasiones', titulo: 'Para alguien', detalle: 'Un versículo en imagen para cumpleaños, duelo y más.', icono: 'share', href: '/ocasiones', palabras: 'compartir imagen' },
        { id: 'recibidos', titulo: 'Versículos para ti', detalle: 'Los que te enviaron tus amigos.', icono: 'gift', href: '/recibidos' },
        { id: 'pareja', titulo: 'En pareja', detalle: 'Devocionales para leer los dos.', icono: 'rings', href: '/pareja', palabras: 'matrimonio novios', soloAdultos: true },
        { id: 'circulo', titulo: 'Círculo de solteros', detalle: 'Conocerse de forma sana, con la iglesia cerca.', icono: 'candle', href: '/circulo', palabras: 'noviazgo', soloAdultos: true },
        { id: 'hombres', titulo: 'Hombres de pie', detalle: 'Doce semanas para crecer como hombre de Dios.', icono: 'hammer', href: '/hombres' },
        { id: 'iglesia', titulo: 'Iglesia anfitriona', detalle: 'Tu iglesia comparte estudios con su código.', icono: 'church', href: '/iglesia' },
      ],
    },
    {
      id: 'zarza',
      titulo: 'Tu Zarza',
      detalle: 'Ajustes, cuenta y cómo se sostiene la app.',
      funciones: [
        { id: 'modo', titulo: 'Niños y jóvenes', detalle: 'La app para adolescentes, con misiones.', icono: 'star', href: '/modo', palabras: 'modo jóvenes niños' },
        { id: 'notificaciones', titulo: 'Notificaciones', detalle: 'Recordatorios y avisos de tus grupos.', icono: 'bell', href: '/notificaciones', palabras: 'recordatorio' },
        { id: 'cuenta', titulo: 'Tu cuenta', detalle: 'Tu perfil y lo que se guarda en tus dispositivos.', icono: 'person', href: '/cuenta', palabras: 'perfil entrar' },
        { id: 'sostener', titulo: 'Sostén Zarza', detalle: 'Zarza es gratis; así se mantiene.', icono: 'lamp', href: '/sostener', palabras: 'donar donación' },
        { id: 'acerca', titulo: 'Acerca de Zarza', detalle: 'La versión que tienes y cómo reportar un fallo.', icono: 'flame', href: '/acerca', palabras: 'versión' },
        { id: 'privacidad', titulo: 'Privacidad', detalle: 'Qué guardamos y qué no.', icono: 'shield', href: '/privacidad', palabras: 'datos términos' },
      ],
    },
  ];
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Los grupos con solo las funciones que coinciden con lo que se escribió (sin importar tildes ni mayúsculas). */
export function filtrar(grupos: Grupo[], texto: string): Grupo[] {
  const q = sinTildes(texto.trim());
  if (!q) return grupos;
  const partes = q.split(/\s+/);
  return grupos
    .map((g) => ({
      ...g,
      funciones: g.funciones.filter((f) => {
        const donde = sinTildes(`${f.titulo} ${f.detalle} ${f.palabras ?? ''} ${g.titulo}`);
        return partes.every((p) => donde.includes(p));
      }),
    }))
    .filter((g) => g.funciones.length);
}
