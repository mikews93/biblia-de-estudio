// El «Camino de preparación» que va antes del Círculo de solteros (src/lib/circulo.ts), compartido por la app y el
// servidor (api/_circulo.ts). Sin React Native.
//
// Mike (2026-10-25) no quería que la gente se conociera «vagamente»: primero conectar con Dios y con su propósito,
// sanar lo que duele, tener una vida estable, y solo después buscar la ayuda idónea para el llamado de cada uno.
// La investigación está en /mnt/project-files/investigacion/preparacion-noviazgo.md (Keller, Gary Thomas, Tripp,
// Enfoque a la Familia, e625, Dante Gebel). Los textos de aquí son propios, a partir de la Biblia y de esas ideas.
//
// Siete etapas, una por día como mucho, para meditar y no correr. Lo que cada persona escribe se
// queda en su teléfono (src/lib/caminoDiario.ts): el servidor solo sabe qué etapas terminó y cuándo. Para entrar al
// Círculo de su iglesia basta con responder «Lo que sí importa» (preguntas directas sobre hijos, misiones,
// ministerio, estudio y trabajo, y finanzas); para usar «Me gustaría conocerte» hay que terminar las siete etapas.
//
// Mike también pidió (2026-10-25) no poner demasiadas trabas: la etapa 7 enseña a acercarse con valentía y a
// recibir un no sin enojo, y la 6 a no esperar a alguien perfecto ni mirar solo el atractivo o la economía. Por
// eso estudio, trabajo y finanzas nunca son innegociables: son temas para conversar.

import type { Pasaje } from './circulo';

const p = (book: string, chapter: number, from: number, to = from): Pasaje => ({ book, chapter, from, to });

export type EtapaCamino = {
  n: number;
  titulo: string;
  /** Una línea que resume la etapa. */
  lema: string;
  intro: string[];
  pasajes: { referencia: string; pasaje: Pasaje }[];
  preguntas: string[];
  /** Muestra siempre «Quiero hablar con alguien». */
  ayuda?: boolean;
  /** La pregunta cuya respuesta sirve de «propósito» en «Lo que sí importa». */
  proposito?: number;
};

export const CAMINO: EtapaCamino[] = [
  {
    n: 1,
    titulo: 'Quién eres en Cristo',
    lema: 'Antes de ser soltero o casado, eres hijo o hija de Dios.',
    intro: [
      'Muchos buscan pareja para sentirse completos, valiosos o vistos. Pero ninguna persona puede llenar el lugar que solo Dios llena, y cuando se le pide eso, la relación se quiebra por el peso.',
      'Esta etapa es para mirar de dónde sacas tu valor. Quien sabe que Dios lo ama puede amar sin aferrarse, esperar sin desesperarse y decir que no sin miedo a quedarse solo.',
    ],
    pasajes: [
      { referencia: 'Efesios 1:3-7', pasaje: p('eph', 1, 3, 7) },
      { referencia: 'Salmo 139:13-16', pasaje: p('psa', 139, 13, 16) },
    ],
    preguntas: [
      '¿En qué buscas sentirte valioso o valiosa: logros, aprobación, una relación? ¿Qué dice Dios de ti en estos pasajes?',
      'Si nunca te casaras, ¿qué seguiría dando sentido a tu vida?',
      'Escribe una frase de estos pasajes que quieras creer de verdad esta semana.',
    ],
  },
  {
    n: 2,
    titulo: 'Tu llamado',
    lema: 'Primero el para qué; después el con quién.',
    intro: [
      'Dios no te salvó para que esperes sentado. Te dio dones, te puso en una iglesia y te dio cargas por personas concretas. Conocer tu llamado te ayuda a saber qué compañía necesitas, porque la ayuda idónea es ayuda para una tarea.',
      'No necesitas tenerlo todo claro. Basta con mirar con honestidad dónde sirves hoy, qué te arde en el corazón y qué te confirman quienes te conocen.',
    ],
    pasajes: [
      { referencia: 'Efesios 2:10', pasaje: p('eph', 2, 10) },
      { referencia: 'Romanos 12:4-8', pasaje: p('rom', 12, 4, 8) },
    ],
    preguntas: [
      '¿Dónde sirves hoy, y qué te dicen otros que haces bien?',
      '¿Por qué personas o qué causas sientes una carga especial: niños, misiones, enseñar, los pobres, quienes no conocen a Cristo?',
      '¿Te ves en misiones, predicando o sirviendo a tiempo completo? ¿Qué te dicen tus pastores o líderes?',
      'Escribe tu propósito en una o dos frases. Si quieres, más adelante podrás compartirlo con tu círculo.',
    ],
    proposito: 3,
  },
  {
    n: 3,
    titulo: 'Lo que todavía duele',
    lema: 'El matrimonio no sana las heridas: las saca a la luz.',
    intro: [
      'Todos llegamos con historia: una familia que nos marcó, relaciones que dolieron, cosas que hicimos o que nos hicieron. Lo que no se trae a la luz suele aparecer después en la pareja como celos, miedo, control o distancia.',
      'Perdonar no es decir que no pasó ni volver a confiar de inmediato: es entregarle a Dios la deuda. Algunas heridas necesitan más que una reflexión. Si algo pesa demasiado, habla con tu pastor o con un profesional: pedir ayuda también es prepararse.',
    ],
    pasajes: [
      { referencia: 'Salmo 147:3-5', pasaje: p('psa', 147, 3, 5) },
      { referencia: 'Efesios 4:31-32', pasaje: p('eph', 4, 31, 32) },
    ],
    preguntas: [
      '¿Qué cosas de tu familia quisieras repetir en tu propio hogar, y cuáles no quisieras llevar contigo?',
      '¿Hay alguna herida de una relación pasada que todavía te afecte? ¿Cómo se nota hoy?',
      '¿A quién necesitas perdonar, o a quién necesitas pedirle perdón? ¿Qué paso pequeño podrías dar?',
    ],
    ayuda: true,
  },
  {
    n: 4,
    titulo: 'Tu carácter',
    lema: 'El encanto se nota rápido; el carácter, con el tiempo.',
    intro: [
      'Cómo tratas a tu familia y cómo manejas el enojo, el dinero y tus errores dice más de cómo serás en un hogar que cualquier conversación bonita. Vale para ti y para quien llegues a conocer.',
      'Mírate con honestidad y con gracia. Nadie está terminado: lo que importa es si estás dispuesto o dispuesta a crecer.',
    ],
    pasajes: [
      { referencia: 'Gálatas 5:22-23', pasaje: p('gal', 5, 22, 23) },
      { referencia: 'Santiago 1:19-20', pasaje: p('jas', 1, 19, 20) },
    ],
    preguntas: [
      '¿Cómo reaccionas cuando te enojas o te sientes herido o herida? ¿Qué diría tu familia?',
      'Cuando te equivocas, ¿te cuesta reconocerlo y pedir perdón? Piensa en la última vez.',
      '¿Hay algún hábito o adicción que todavía te controle? ¿Con quién podrías hablarlo?',
    ],
    ayuda: true,
  },
  {
    n: 5,
    titulo: 'Una vida estable',
    lema: 'Prepararse también es aprender a sostener una vida.',
    intro: [
      'Formar un hogar pide más que amor: estudio o trabajo con rumbo, saber manejar el dinero y poder decidir sin depender de los padres para todo. No hace falta ser rico ni tenerlo todo resuelto, pero sí ir en camino.',
      'Mira dónde estás hoy y qué paso puedes dar este año.',
    ],
    pasajes: [
      { referencia: 'Proverbios 24:27', pasaje: p('pro', 24, 27) },
      { referencia: 'Lucas 14:28-30', pasaje: p('luk', 14, 28, 30) },
    ],
    preguntas: [
      '¿Cómo van tu estudio o tu trabajo? ¿Qué paso te falta para tener una base estable?',
      '¿Vives con un presupuesto? ¿Tienes deudas que te preocupen? ¿Das a Dios con alegría?',
      '¿Qué decisiones todavía dependen de tus padres, y cuáles deberías empezar a tomar tú?',
    ],
  },
  {
    n: 6,
    titulo: 'Soltería y matrimonio',
    lema: 'Casado o soltero, la vida es para el Reino.',
    intro: [
      'La Biblia honra las dos cosas. Pablo ve en la soltería una puerta para servir sin distracción, y presenta el matrimonio como un pacto que muestra el amor de Cristo por su iglesia. Ninguno es premio ni castigo.',
      'Casarse no es encontrar a alguien que te haga feliz, sino unirte a alguien con quien puedas seguir a Cristo mejor que por separado. Por eso la pregunta no es solo «¿me gusta?», sino «¿vamos hacia el mismo lugar?».',
      'Cuando el siervo de Abraham buscó esposa para Isaac, oró y esperó una señal de servicio: alguien que, sin que se lo pidieran, diera de beber también a diez camellos cansados. Rebeca era hermosa, pero lo que la mostró fue su corazón dispuesto. Conocerse es eso: descubrir si pueden aprender a servir juntos y ponerse de acuerdo. Y fue Rebeca quien decidió: «Sí, iré». No es un método para pedirle señales a Dios ni para que otros elijan por ti.',
    ],
    pasajes: [
      { referencia: 'Génesis 2:18-24', pasaje: p('gen', 2, 18, 24) },
      { referencia: 'Génesis 24:12-21', pasaje: p('gen', 24, 12, 21) },
      { referencia: 'Efesios 5:25-33', pasaje: p('eph', 5, 25, 33) },
    ],
    preguntas: [
      '¿Qué ideas sobre el matrimonio aprendiste de las películas, de tu casa o de la iglesia que estos pasajes confirman o corrigen?',
      '¿Qué significa para ti ser «ayuda idónea», o buscarla, para la tarea que Dios te dio?',
      'Rebeca sirvió más allá de lo que le pidieron. ¿Cómo sirves tú cuando nadie te ve? ¿Y qué te mostraría que con alguien pueden servir juntos y llegar a acuerdos?',
      'Haz tu lista de lo que esperas de una pareja. ¿Qué es carácter y fe, y qué es apariencia, dinero o un ideal que nadie cumple? ¿Qué podrías soltar?',
      '¿Puedes ver la soltería como un regalo para esta etapa? ¿Qué te da miedo de ella?',
    ],
  },
  {
    n: 7,
    titulo: 'Acercarse y recibir un no',
    lema: 'Invitar no compra nada, y un no no te quita nada.',
    intro: [
      'Muchos no se acercan por miedo al rechazo, y muchas esperan a alguien que no existe. Las dos cosas dejan a la iglesia llena de solteros que se miran de lejos. Acercarse con respeto, invitar a conversar o a compartir con el grupo, es un acto de valentía y de cortesía, no una apuesta.',
      'Invitar a alguien no significa que te deba algo. Un no es normal, no es un juicio sobre tu valor ni una razón para enojarte o alejarte: se puede seguir siendo amigos y hermanos. Y quien recibe la invitación puede responder con gracia y honestidad, mirando más allá de la primera impresión, el atractivo o la economía.',
    ],
    pasajes: [
      { referencia: 'Josué 1:9', pasaje: p('jos', 1, 9) },
      { referencia: '1 Juan 4:18-19', pasaje: p('1jn', 4, 18, 19) },
    ],
    preguntas: [
      '¿Qué te frena para acercarte a alguien, o para darle una oportunidad a quien se acerca a ti?',
      'Si te dicen que no, ¿cómo te gustaría responder? Escribe lo que dirías, con respeto y sin reproches.',
      '¿Cómo puedes decir que no, o que sí, con honestidad y bondad, sin jugar con el corazón del otro?',
    ],
  },
];

export const ETAPAS_CAMINO = CAMINO.length;
/** Días entre terminar una etapa y abrir la siguiente: una por día como mucho. */
export const DIAS_ENTRE_ETAPAS = 1;

export const sumarDias = (dia: string, n: number) => {
  const f = new Date(`${dia}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
};

/** «12 de octubre». */
export const fechaCorta = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export type ProgresoCamino = {
  hechas: number;
  /** La etapa que sigue (1 a 6), o null si ya terminó. */
  siguiente: number | null;
  abierta: boolean;
  /** Si la siguiente todavía no se abre, el día en que se abre. */
  abreEl: string | null;
  completo: boolean;
};

/** Dónde va alguien en el camino. `hechas` son las etapas terminadas con su fecha («AAAA-MM-DD»). */
export function progresoCamino(hechas: { etapa: number; fecha: string }[], hoy: string): ProgresoCamino {
  const n = hechas.length;
  if (n >= ETAPAS_CAMINO) return { hechas: ETAPAS_CAMINO, siguiente: null, abierta: false, abreEl: null, completo: true };
  const ultima = hechas.reduce((a, h) => (h.fecha > a ? h.fecha : a), '');
  const abre = ultima ? sumarDias(ultima, DIAS_ENTRE_ETAPAS) : null;
  const abierta = !abre || abre <= hoy;
  return { hechas: n, siguiente: n + 1, abierta, abreEl: abierta ? null : abre, completo: false };
}

// ——— «Lo que sí importa» ———

export type Respuesta = 'si' | 'no' | 'abierto';

export type PreguntaImporta = {
  clave: string;
  pregunta: string;
  /** Cómo se nombra en las coincidencias: «Coinciden: hijos». */
  tema: string;
  opciones: { value: Respuesta; label: string }[];
  /** Si se puede marcar como innegociable (las que definen hacia dónde va la vida). */
  innegociable: boolean;
};

export const IMPORTA: PreguntaImporta[] = [
  {
    clave: 'hijos',
    pregunta: '¿Quieres tener hijos?',
    tema: 'hijos',
    opciones: [
      { value: 'si', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'abierto', label: 'Abierto/a' },
    ],
    innegociable: true,
  },
  {
    clave: 'misiones',
    pregunta: '¿Te ves en misiones, o mudándote a otro lugar por el Evangelio?',
    tema: 'misiones',
    opciones: [
      { value: 'si', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'abierto', label: 'Abierto/a' },
    ],
    innegociable: true,
  },
  {
    clave: 'ministerio',
    pregunta: '¿Sientes llamado a predicar, pastorear o servir a tiempo completo?',
    tema: 'ministerio',
    opciones: [
      { value: 'si', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'abierto', label: 'Aún no lo sé' },
    ],
    innegociable: true,
  },
  {
    clave: 'estable',
    pregunta: '¿Tienes estudio o trabajo estable?',
    tema: 'estudio y trabajo',
    opciones: [
      { value: 'si', label: 'Sí' },
      { value: 'abierto', label: 'En camino' },
      { value: 'no', label: 'Todavía no' },
    ],
    innegociable: false,
  },
  {
    clave: 'finanzas',
    pregunta: '¿Vives con un presupuesto y sin deudas que te ahoguen?',
    tema: 'finanzas',
    opciones: [
      { value: 'si', label: 'Sí' },
      { value: 'abierto', label: 'En camino' },
      { value: 'no', label: 'Todavía no' },
    ],
    innegociable: false,
  },
];

export const MAX_SIRVO = 120;
export const MAX_PROPOSITO = 300;

export type Importa = {
  respuestas: Record<string, Respuesta>;
  /** Las claves que la persona no negocia. */
  innegociables: string[];
  /** En qué sirve hoy en su iglesia. */
  sirvo: string;
  /** Su propósito en una o dos frases (de la etapa 2). */
  proposito: string;
  /** «Me siento llamado o llamada a la soltería en esta etapa»: no aparece en ninguna coincidencia. */
  solteria: boolean;
};

const corto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Limpia lo que manda la app. Devuelve null si falta alguna respuesta. */
export function importaValido(v: unknown): Importa | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const r = (o.respuestas ?? {}) as Record<string, unknown>;
  const respuestas: Record<string, Respuesta> = {};
  for (const q of IMPORTA) {
    const x = r[q.clave];
    if (x !== 'si' && x !== 'no' && x !== 'abierto') return null;
    respuestas[q.clave] = x;
  }
  const innegociables = Array.isArray(o.innegociables)
    ? IMPORTA.filter((q) => q.innegociable && (o.innegociables as unknown[]).includes(q.clave)).map((q) => q.clave)
    : [];
  return { respuestas, innegociables, sirvo: corto(o.sirvo, MAX_SIRVO), proposito: corto(o.proposito, MAX_PROPOSITO), solteria: o.solteria === true };
}

export type Coincidencias = {
  /** Temas en que los dos dijeron lo mismo con claridad. */
  coinciden: string[];
  /** Temas que conviene conversar: alguno está abierto o en camino, o dijeron distinto en algo negociable. */
  conversar: string[];
  /** Dicen sí y no en algo que uno de los dos no negocia: no se pueden marcar. */
  choca: boolean;
};

/** Qué tienen en común dos personas, sin porcentajes ni orden: solo coinciden, para conversar o no encajan. */
export function coincidencias(a: Importa, b: Importa): Coincidencias {
  const out: Coincidencias = { coinciden: [], conversar: [], choca: false };
  for (const q of IMPORTA) {
    const x = a.respuestas[q.clave];
    const y = b.respuestas[q.clave];
    if (!x || !y) continue;
    if (x === y && x !== 'abierto') out.coinciden.push(q.tema);
    else if (x !== 'abierto' && y !== 'abierto' && (a.innegociables.includes(q.clave) || b.innegociables.includes(q.clave))) out.choca = true;
    else out.conversar.push(q.tema);
  }
  return out;
}

// ——— Red de seguridad ———

// Límites de palabra que entienden las tildes (\b de JavaScript no sabe que «ó» es letra).
const palabras = (alternativas: string) => new RegExp(`(?<!\\p{L})(${alternativas})(?!\\p{L})`, 'iu');

const CRISIS: { re: RegExp; tipo: 'vida' | 'abuso' }[] = [
  {
    re: palabras(
      'suicid\\p{L}*|quitarme la vida|matarme|me quiero morir|quiero morirme|no quiero vivir|no quiero seguir viviendo|hacerme da[ñn]o|me corto|cortarme|autolesi\\p{L}*',
    ),
    tipo: 'vida',
  },
  {
    re: palabras('me (golpea|golpeaba|golpeó|pega|pegaba|amenaza|amenazaba|violó|violaron|abusó|abusaron|abusa|obliga)|abus(o|aron|ó) de m[íi]'),
    tipo: 'abuso',
  },
];

/** Si lo escrito habla de hacerse daño o de abuso, para mostrar dónde pedir ayuda. No diagnostica nada. */
export function crisisEn(texto: string): 'vida' | 'abuso' | null {
  for (const c of CRISIS) if (c.re.test(texto)) return c.tipo;
  return null;
}

/**
 * Líneas de prevención del suicidio y salud mental por país. Cambian con el tiempo: hay que confirmarlas en la
 * fuente oficial de cada país antes de publicar. Donde no hay una, se muestra el número de emergencias.
 */
export const LINEAS_VIDA: { pais: string; linea: string; tel: string; nota?: string }[] = [
  { pais: 'US', linea: 'Línea 988 de Prevención del Suicidio y Crisis', tel: '988', nota: 'Atienden en español.' },
  { pais: 'ES', linea: 'Línea 024 de atención a la conducta suicida', tel: '024' },
  { pais: 'MX', linea: 'Línea de la Vida', tel: '8009112000' },
  { pais: 'CO', linea: 'Línea 192, opción 4 (salud mental)', tel: '192' },
  { pais: 'CL', linea: 'Línea *4141 de prevención del suicidio', tel: '*4141' },
  { pais: 'AR', linea: 'Centro de Asistencia al Suicida', tel: '135', nota: 'Desde Buenos Aires. En el resto del país, (011) 5275-1135.' },
];
