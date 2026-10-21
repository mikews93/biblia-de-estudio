// Promesa y cumplimiento: hilos que van de una profecía o promesa del Antiguo Testamento a su cumplimiento.
//
// Criterio: solo se incluyen los hilos que el mismo Nuevo Testamento (o el Antiguo, en las profecías ya cumplidas
// en la historia de Israel) presenta como cumplidos, más las figuras que el NT interpreta así (el cordero, la
// serpiente de bronce, Jonás). Es la lectura de la iglesia histórica y de los comentarios de dominio público
// (Matthew Henry, Jamieson-Fausset-Brown); no se siguen interpretaciones de sectas.
// Lo que aún esperamos va sin fechas: «del día y hora nadie sabe» (Mateo 24:36).
//
// Los años de cada paso salen del periodo de su capítulo (src/lib/historia.ts), salvo los que llevan `año`.

import { Periodo, periodoDe, rango } from './historia';
import { parseRef } from './refs';

export type Tema = 'hilo' | 'llegada' | 'ministerio' | 'pasion' | 'victoria' | 'naciones' | 'historia' | 'esperanza';

/**
 * promesa: el anuncio. figura: algo que pasó y que el NT lee como imagen de Cristo. eco: la promesa se repite o
 * se aclara. cumple: el cumplimiento. espera: lo que aún no se ha cumplido del todo.
 */
export type Rol = 'promesa' | 'figura' | 'eco' | 'cumple' | 'espera';

export type Paso = {
  rol: Rol;
  /** 'isa.7.14' o 'mat.1.22-mat.1.23'. Sin ref, un hecho de la historia fuera de la Biblia (con `año`). */
  ref?: string;
  titulo: string;
  nota?: string;
  /** Año del paso cuando el periodo del capítulo no basta. */
  año?: number;
};

export type Hilo = {
  id: string;
  titulo: string;
  tema: Tema;
  /** Una o dos frases: qué se prometió y cómo se cumplió. */
  resumen: string;
  pasos: Paso[];
  /** El NT lo dice con todas las letras («para que se cumpliese…», «esta Escritura se ha cumplido»). */
  citado?: boolean;
  /** Para pensar: un párrafo breve, propio, en la línea de los comentarios clásicos. */
  reflexion?: string;
  /** Año del cumplimiento cuando el primer paso que lo cuenta es una carta escrita después (Gálatas, Hebreos). */
  cumplido?: number;
  /** En lugar de «unos 700 años después». */
  esperaTexto?: string;
};

export const TEMAS: Record<Tema, { titulo: string; corto: string; color: string }> = {
  hilo: { titulo: 'Los grandes hilos', corto: 'Hilos', color: '#A8641F' },
  llegada: { titulo: 'Su llegada', corto: 'Llegada', color: '#3B6FB6' },
  ministerio: { titulo: 'Su vida y ministerio', corto: 'Ministerio', color: '#2E8B83' },
  pasion: { titulo: 'Su muerte', corto: 'Pasión', color: '#B03A2E' },
  victoria: { titulo: 'Resurrección y reinado', corto: 'Victoria', color: '#C08A2E' },
  naciones: { titulo: 'El Espíritu y las naciones', corto: 'Naciones', color: '#7D5BA6' },
  historia: { titulo: 'Cumplidas en la historia de Israel', corto: 'Historia', color: '#5D6D7E' },
  esperanza: { titulo: 'Lo que aún esperamos', corto: 'Esperanza', color: '#4E8B3A' },
};

export const ORDEN_TEMAS: Tema[] = ['hilo', 'llegada', 'ministerio', 'pasion', 'victoria', 'naciones', 'historia', 'esperanza'];

export const ROLES: Record<Rol, string> = {
  promesa: 'La promesa',
  figura: 'La figura',
  eco: 'Se repite',
  cumple: 'Se cumple',
  espera: 'Lo que esperamos',
};

const HILOS_LISTA: Hilo[] = [
  // ——— Los grandes hilos: una promesa que atraviesa toda la Biblia ———
  {
    id: 'simiente',
    cumplido: -5,
    titulo: 'La simiente de la mujer',
    tema: 'hilo',
    resumen:
      'La primera promesa de la Biblia: un descendiente de la mujer aplastaría la cabeza de la serpiente. Se estrecha de Abraham a Cristo, que vence al diablo en la cruz.',
    pasos: [
      { rol: 'promesa', ref: 'gen.3.15', titulo: 'Ésta te herirá en la cabeza', nota: 'Los padres de la iglesia lo llamaron el «primer evangelio».' },
      { rol: 'eco', ref: 'gen.22.18', titulo: 'En tu simiente serán benditas las naciones', nota: 'La promesa se concentra en la familia de Abraham.' },
      { rol: 'cumple', ref: 'gal.4.4', titulo: 'Nacido de mujer', nota: 'Pablo subraya que el Hijo vino «hecho de mujer».' },
      { rol: 'cumple', ref: 'gal.3.16', titulo: 'La simiente es Cristo', nota: 'Pablo lee la promesa a Abraham en singular: una simiente, Cristo.' },
      { rol: 'cumple', ref: 'heb.2.14', titulo: 'Destruyó al que tenía el imperio de la muerte' },
      { rol: 'espera', ref: 'rom.16.20', titulo: 'Quebrantará a Satanás debajo de vuestros pies' },
    ],
    reflexion:
      'La primera palabra de esperanza se dice en medio del juicio, antes de que Adán y Eva salgan del huerto. Toda la historia que sigue, con sus genealogías interminables, es Dios cuidando esa promesa generación tras generación.',
  },
  {
    id: 'abraham',
    titulo: 'Bendición para todas las familias',
    tema: 'hilo',
    resumen:
      'Dios prometió a Abraham que en él serían benditas todas las familias de la tierra. Pablo dice que esa promesa era el evangelio anunciado de antemano.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'gen.12.1-gen.12.3', titulo: 'Serán benditas en ti todas las familias' },
      { rol: 'eco', ref: 'gen.15.5-gen.15.6', titulo: 'Así será tu simiente', nota: 'Abraham creyó, y le fue contado por justicia.' },
      { rol: 'cumple', ref: 'gal.3.8', titulo: 'La Escritura evangelizó antes a Abraham' },
      { rol: 'cumple', ref: 'act.3.25-act.3.26', titulo: 'Dios levantó a su Hijo para bendeciros' },
      { rol: 'espera', ref: 'rev.7.9-rev.7.10', titulo: 'Una multitud de todas naciones', nota: 'La visión final: la promesa a Abraham cumplida del todo.' },
    ],
    reflexion:
      'Abraham no vio el cumplimiento, pero creyó. La iglesia de todas las naciones es la prueba visible de que Dios no olvidó a un anciano sin hijos que miraba las estrellas.',
  },
  {
    id: 'cetro',
    cumplido: -5,
    titulo: 'El cetro de Judá',
    tema: 'hilo',
    resumen:
      'Jacob anunció que el cetro no se apartaría de Judá «hasta que venga Siloh». Jesús nace de la tribu de Judá y Apocalipsis lo llama el León de Judá.',
    pasos: [
      { rol: 'promesa', ref: 'gen.49.10', titulo: 'No será quitado el cetro de Judá' },
      { rol: 'cumple', ref: 'heb.7.14', titulo: 'Nuestro Señor nació de Judá' },
      { rol: 'cumple', ref: 'rev.5.5', titulo: 'El León de la tribu de Judá ha vencido' },
    ],
  },
  {
    id: 'trono',
    titulo: 'El trono eterno de David',
    tema: 'hilo',
    resumen:
      'Dios juró a David que su descendiente reinaría para siempre. Los profetas lo repiten y el ángel lo aplica a Jesús antes de su nacimiento.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: '2sa.7.12-2sa.7.13', titulo: 'Afirmaré para siempre el trono de su reino' },
      { rol: 'eco', ref: 'psa.89.3-psa.89.4', titulo: 'Edificaré tu trono por todas las generaciones' },
      { rol: 'eco', ref: 'isa.9.7', titulo: 'Sobre el trono de David, para siempre', año: -735 },
      { rol: 'eco', ref: 'jer.23.5', titulo: 'Renuevo justo para David' },
      { rol: 'cumple', ref: 'luk.1.32-luk.1.33', titulo: 'Le dará el trono de David su padre' },
      { rol: 'cumple', ref: 'act.2.30-act.2.31', titulo: 'Pedro: David habló de la resurrección de Cristo' },
      { rol: 'espera', ref: 'rev.22.16', titulo: 'Yo soy la raíz y el linaje de David' },
    ],
    reflexion:
      'Cuando el último rey de Judá fue llevado a Babilonia, la promesa parecía muerta. Los profetas siguieron hablando de un «renuevo» que brotaría del tronco cortado de Isaí.',
  },
  {
    id: 'profeta',
    titulo: 'Un profeta como Moisés',
    tema: 'hilo',
    resumen: 'Moisés anunció que Dios levantaría otro profeta como él, a quien había que oír. Pedro proclama que ese profeta es Jesús.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'deu.18.15', titulo: 'Profeta como yo te levantará Jehová' },
      { rol: 'eco', ref: 'jhn.6.14', titulo: 'Este es el profeta que había de venir', nota: 'La multitud lo reconoce después de la multiplicación de los panes.' },
      { rol: 'cumple', ref: 'act.3.22-act.3.23', titulo: 'Pedro aplica la promesa a Jesús' },
    ],
  },
  {
    id: 'cordero',
    titulo: 'El cordero de la Pascua',
    tema: 'hilo',
    resumen:
      'La sangre del cordero protegió a Israel en Egipto. Isaías habla de un siervo llevado como cordero, y Juan el Bautista señala a Jesús: «He aquí el Cordero de Dios».',
    pasos: [
      { rol: 'figura', ref: 'exo.12.13', titulo: 'Veré la sangre y pasaré de vosotros' },
      { rol: 'eco', ref: 'isa.53.7', titulo: 'Como cordero fue llevado al matadero' },
      { rol: 'cumple', ref: 'jhn.1.29', titulo: 'He aquí el Cordero de Dios' },
      { rol: 'cumple', ref: '1co.5.7', titulo: 'Nuestra pascua, Cristo, fue sacrificada' },
      { rol: 'espera', ref: 'rev.5.12', titulo: 'El Cordero que fue inmolado es digno' },
    ],
    reflexion: 'Jesús murió en los días de la Pascua. Cada año, durante siglos, Israel había ensayado sin saberlo lo que pasaría aquel viernes.',
  },
  {
    id: 'nuevo-pacto',
    titulo: 'El nuevo pacto',
    tema: 'hilo',
    resumen:
      'Jeremías anunció un pacto nuevo, con la ley escrita en el corazón y el perdón de los pecados. Jesús lo inaugura en la última cena y Hebreos lo cita entero.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'jer.31.31-jer.31.34', titulo: 'Daré mi ley en su corazón' },
      { rol: 'eco', ref: 'ezk.36.26-ezk.36.27', titulo: 'Corazón nuevo y espíritu nuevo' },
      { rol: 'cumple', ref: 'luk.22.20', titulo: 'Este vaso es el nuevo pacto en mi sangre' },
      { rol: 'cumple', ref: 'heb.8.8-heb.8.10', titulo: 'Hebreos cita a Jeremías' },
    ],
  },

  // ——— Su llegada ———
  {
    id: 'virgen',
    titulo: 'Nacido de una virgen',
    tema: 'llegada',
    resumen: 'Isaías dio al rey Acaz la señal de una virgen que daría a luz un hijo llamado Emanuel. Mateo la ve cumplida en el nacimiento de Jesús.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.7.14', titulo: 'La virgen concebirá', año: -734 },
      { rol: 'cumple', ref: 'mat.1.22-mat.1.23', titulo: 'Todo esto aconteció para que se cumpliese' },
      { rol: 'cumple', ref: 'luk.1.34-luk.1.35', titulo: '¿Cómo será esto? Porque no conozco varón' },
    ],
    reflexion: 'Emanuel, «Dios con nosotros», no es solo un nombre bonito: es la explicación de quién es el niño.',
  },
  {
    id: 'belen',
    titulo: 'En Belén de Judá',
    tema: 'llegada',
    resumen: 'Miqueas anunció que de la pequeña Belén saldría el gobernante de Israel. Los escribas lo citaron a Herodes cuando llegaron los magos.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'mic.5.2', titulo: 'De ti me saldrá el que será Señor en Israel' },
      { rol: 'cumple', ref: 'luk.2.4-luk.2.7', titulo: 'José subió a la ciudad de David' },
      { rol: 'cumple', ref: 'mat.2.5-mat.2.6', titulo: 'Así está escrito por el profeta' },
    ],
    reflexion: 'Un edicto de César Augusto movió a una pareja de Nazaret justo a tiempo. Dios usó el censo de un emperador para cumplir la palabra de un profeta de aldea.',
  },
  {
    id: 'precursor',
    titulo: 'El mensajero que prepara el camino',
    tema: 'llegada',
    resumen: 'Isaías y Malaquías anunciaron una voz en el desierto que prepararía el camino del Señor. Los evangelios la identifican con Juan el Bautista.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.40.3', titulo: 'Voz que clama en el desierto' },
      { rol: 'eco', ref: 'mal.3.1', titulo: 'Yo envío mi mensajero' },
      { rol: 'cumple', ref: 'mat.3.1-mat.3.3', titulo: 'Este es aquel del cual fue dicho' },
      { rol: 'cumple', ref: 'mat.11.10', titulo: 'Jesús: este es de quien está escrito' },
    ],
  },
  {
    id: 'egipto',
    titulo: 'De Egipto llamé a mi Hijo',
    tema: 'llegada',
    resumen: 'Oseas recordaba el éxodo de Israel, el hijo de Dios. Mateo ve en el regreso de Jesús desde Egipto al Hijo que revive y completa la historia de su pueblo.',
    citado: true,
    pasos: [
      { rol: 'figura', ref: 'hos.11.1', titulo: 'De Egipto llamé a mi hijo' },
      { rol: 'cumple', ref: 'mat.2.14-mat.2.15', titulo: 'Para que se cumpliese lo dicho por el profeta' },
    ],
    reflexion: 'Mateo no ignora que Oseas hablaba del éxodo. Su punto es más profundo: Jesús recorre el camino de Israel y lo cumple donde Israel falló.',
  },
  {
    id: 'galilea',
    titulo: 'Luz en Galilea de los gentiles',
    tema: 'llegada',
    resumen: 'Isaías prometió una gran luz para la despreciada Galilea. Jesús comienza su ministerio en Capernaum, junto al mar.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.9.1-isa.9.2', titulo: 'El pueblo que andaba en tinieblas vio gran luz', año: -735 },
      { rol: 'cumple', ref: 'mat.4.13-mat.4.16', titulo: 'Habitó en Capernaum, para que se cumpliese' },
    ],
  },

  // ——— Su vida y ministerio ———
  {
    id: 'ungido',
    titulo: 'Ungido para dar buenas nuevas',
    tema: 'ministerio',
    resumen: 'En la sinagoga de Nazaret Jesús leyó Isaías 61 y dijo: «Hoy se ha cumplido esta Escritura en vuestros oídos».',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.61.1-isa.61.2', titulo: 'El Espíritu del Señor Jehová es sobre mí' },
      { rol: 'cumple', ref: 'luk.4.18-luk.4.21', titulo: 'Hoy se ha cumplido esta Escritura' },
    ],
    reflexion: 'Jesús cerró el libro a mitad de frase, antes de «el día de venganza del Dios nuestro». Vino primero a anunciar el año agradable del Señor.',
  },
  {
    id: 'sanidades',
    titulo: 'Los ciegos ven, los cojos andan',
    tema: 'ministerio',
    resumen: 'Isaías describió la llegada de Dios con ciegos que ven y cojos que saltan. Jesús respondió con esas señales cuando Juan preguntó si él era el que había de venir.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.35.5-isa.35.6', titulo: 'Los ojos de los ciegos serán abiertos' },
      { rol: 'eco', ref: 'isa.53.4', titulo: 'Llevó él nuestras enfermedades' },
      { rol: 'cumple', ref: 'mat.8.16-mat.8.17', titulo: 'Sanó a todos para que se cumpliese' },
      { rol: 'cumple', ref: 'mat.11.4-mat.11.5', titulo: 'Id y haced saber a Juan lo que oís y veis' },
    ],
  },
  {
    id: 'siervo-manso',
    titulo: 'El siervo que no quebrará la caña',
    tema: 'ministerio',
    resumen: 'El siervo de Isaías 42 trae justicia a las naciones sin gritar ni apagar el pábilo que humea. Mateo lo cita al describir cómo Jesús sanaba en silencio.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.42.1-isa.42.3', titulo: 'He aquí mi siervo, mi escogido' },
      { rol: 'cumple', ref: 'mat.12.17-mat.12.21', titulo: 'Para que se cumpliese lo dicho por Isaías' },
    ],
  },
  {
    id: 'parabolas',
    titulo: 'Hablará en parábolas',
    tema: 'ministerio',
    resumen: 'Asaf abrió su boca «en proverbios» para contar las cosas escondidas de la historia. Mateo ve cumplido el salmo en la enseñanza de Jesús.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.78.2', titulo: 'Abriré mi boca en parábola' },
      { rol: 'cumple', ref: 'mat.13.34-mat.13.35', titulo: 'Todo esto habló Jesús por parábolas' },
    ],
  },
  {
    id: 'celo',
    titulo: 'El celo de tu casa',
    tema: 'ministerio',
    resumen: 'Cuando Jesús echó a los cambistas del templo, sus discípulos recordaron el Salmo 69: «El celo de tu casa me comió».',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.69.9', titulo: 'Me consumió el celo de tu casa' },
      { rol: 'cumple', ref: 'jhn.2.15-jhn.2.17', titulo: 'Se acordaron sus discípulos' },
    ],
  },
  {
    id: 'asna',
    titulo: 'Tu rey viene, humilde, sobre un asno',
    tema: 'ministerio',
    resumen: 'Zacarías vio a un rey justo y humilde entrando en Jerusalén sobre un pollino. Jesús entra así el domingo antes de su muerte.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'zec.9.9', titulo: 'He aquí, tu rey vendrá a ti' },
      { rol: 'cumple', ref: 'mat.21.4-mat.21.5', titulo: 'Todo esto fue hecho para que se cumpliese' },
      { rol: 'cumple', ref: 'jhn.12.14-jhn.12.16', titulo: 'Sus discípulos lo entendieron después' },
    ],
    reflexion: 'Los reyes entraban en caballos de guerra. Jesús eligió un asno: rey de verdad, pero de paz.',
  },
  {
    id: 'incredulidad',
    titulo: '¿Quién ha creído a nuestro anuncio?',
    tema: 'ministerio',
    resumen: 'Isaías anunció que su mensaje encontraría oídos cerrados. Juan explica con él por qué muchos no creyeron a pesar de las señales.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.6.9-isa.6.10', titulo: 'Oíd bien, y no entendáis' },
      { rol: 'eco', ref: 'isa.53.1', titulo: '¿Quién ha creído a nuestro anuncio?' },
      { rol: 'cumple', ref: 'jhn.12.37-jhn.12.41', titulo: 'Esto dijo Isaías cuando vio su gloria' },
    ],
  },

  // ——— Su muerte ———
  {
    id: 'piedra',
    titulo: 'La piedra que desecharon',
    tema: 'pasion',
    resumen: 'El Salmo 118 canta a la piedra rechazada que llegó a ser cabeza del ángulo. Jesús se la aplicó a sí mismo y Pedro la predicó ante el concilio.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.118.22-psa.118.23', titulo: 'La piedra que desecharon los edificadores' },
      { rol: 'cumple', ref: 'mat.21.42', titulo: '¿Nunca leísteis en las Escrituras?' },
      { rol: 'cumple', ref: 'act.4.10-act.4.11', titulo: 'Este es la piedra reprobada por vosotros' },
      { rol: 'cumple', ref: '1pe.2.7', titulo: 'Para los que creéis, es precioso' },
    ],
  },
  {
    id: 'amigo',
    titulo: 'Traicionado por un amigo',
    tema: 'pasion',
    resumen: 'David se lamentó de un amigo que comía su pan y alzó contra él el calcañar. Jesús citó ese salmo en la última cena, hablando de Judas.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.41.9', titulo: 'El que de mi pan comía alzó contra mí el calcañar' },
      { rol: 'cumple', ref: 'jhn.13.18', titulo: 'Mas para que se cumpla la Escritura' },
    ],
  },
  {
    id: 'treinta',
    titulo: 'Treinta piezas de plata',
    tema: 'pasion',
    resumen: 'Zacarías fue «pagado» con treinta piezas de plata y las echó en la casa de Jehová, al alfarero. Judas vende a Jesús por esa suma y con ella se compra el campo del alfarero.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'zec.11.12-zec.11.13', titulo: 'Pesaron por mi salario treinta piezas de plata' },
      { rol: 'cumple', ref: 'mat.26.14-mat.26.15', titulo: 'Le señalaron treinta piezas de plata' },
      {
        rol: 'cumple',
        ref: 'mat.27.9-mat.27.10',
        titulo: 'Compraron el campo del alfarero',
        nota: 'Mateo lo atribuye a Jeremías: probablemente une Zacarías 11 con la compra del campo de Jeremías 32, citando por el profeta mayor, como se acostumbraba.',
      },
    ],
  },
  {
    id: 'pastor',
    titulo: 'Herido el pastor, dispersas las ovejas',
    tema: 'pasion',
    resumen: 'Zacarías anunció que herirían al pastor y se dispersarían las ovejas. Jesús lo citó camino del Getsemaní, y esa noche todos huyeron.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'zec.13.7', titulo: 'Hiere al pastor, y se derramarán las ovejas' },
      { rol: 'cumple', ref: 'mat.26.31', titulo: 'Todos vosotros seréis escandalizados en mí' },
      { rol: 'cumple', ref: 'mat.26.56', titulo: 'Todos los discípulos huyeron, dejándole' },
    ],
  },
  {
    id: 'herido',
    cumplido: 30,
    titulo: 'Herido por nuestras rebeliones',
    tema: 'pasion',
    resumen: 'Isaías 53 describe a un siervo que carga con el pecado de otros y es castigado en su lugar. Pedro y Pablo lo leen como el sentido de la cruz.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.53.4-isa.53.6', titulo: 'Jehová cargó en él el pecado de todos nosotros' },
      { rol: 'cumple', ref: '1pe.2.24-1pe.2.25', titulo: 'Por cuya herida habéis sido sanados' },
      { rol: 'cumple', ref: 'rom.4.25', titulo: 'Entregado por nuestros delitos' },
    ],
    reflexion: 'El capítulo se escribió siete siglos antes de la cruz y se lee como si el profeta hubiera estado al pie de ella. Por eso el eunuco etíope preguntó: «¿de quién dice el profeta esto?».',
  },
  {
    id: 'silencio',
    titulo: 'Como oveja delante del trasquilador',
    tema: 'pasion',
    resumen: 'El siervo de Isaías no abre su boca ante sus acusadores. Jesús calla ante Pilato, y Felipe explica el pasaje al etíope.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.53.7', titulo: 'No abrió su boca' },
      { rol: 'cumple', ref: 'mat.27.12-mat.27.14', titulo: 'No le respondió ni una palabra' },
      { rol: 'cumple', ref: 'act.8.32-act.8.35', titulo: 'Le anunció el evangelio de Jesús' },
    ],
  },
  {
    id: 'transgresores',
    titulo: 'Contado con los transgresores',
    tema: 'pasion',
    resumen: 'Isaías dijo que el siervo sería contado entre los malhechores. Jesús lo citó la noche antes y murió crucificado entre dos ladrones.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.53.12', titulo: 'Fue contado con los perversos' },
      { rol: 'cumple', ref: 'luk.22.37', titulo: 'Es necesario que se cumpla aún en mí' },
      { rol: 'cumple', ref: 'luk.23.32-luk.23.33', titulo: 'Crucificado con dos malhechores' },
    ],
  },
  {
    id: 'salmo-22',
    titulo: 'El Salmo 22 al pie de la cruz',
    tema: 'pasion',
    resumen: 'David describe burlas, manos y pies horadados y ropas repartidas a suertes. Jesús ora este salmo en la cruz y los evangelios narran cada detalle.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.22.1', titulo: 'Dios mío, ¿por qué me has dejado?' },
      { rol: 'promesa', ref: 'psa.22.16-psa.22.18', titulo: 'Horadaron mis manos y mis pies' },
      { rol: 'cumple', ref: 'mat.27.46', titulo: 'Jesús clamó con grande voz' },
      { rol: 'cumple', ref: 'jhn.19.23-jhn.19.24', titulo: 'Sobre mi ropa echaron suertes' },
      { rol: 'cumple', ref: 'mat.27.41-mat.27.43', titulo: 'Confió en Dios: líbrele ahora' },
    ],
    reflexion: 'La crucifixión no existía cuando David escribió. El salmo empieza en abandono y termina en alabanza: «los términos de la tierra se volverán a Jehová».',
  },
  {
    id: 'vinagre',
    titulo: 'En mi sed me dieron vinagre',
    tema: 'pasion',
    resumen: 'El Salmo 69 habla de hiel por comida y vinagre para la sed. En la cruz Jesús dice «sed tengo» y le dan vinagre.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.69.21', titulo: 'En mi sed me dieron a beber vinagre' },
      { rol: 'cumple', ref: 'jhn.19.28-jhn.19.30', titulo: 'Para que la Escritura se cumpliese: sed tengo' },
    ],
  },
  {
    id: 'huesos',
    titulo: 'Ni un hueso quebrado',
    tema: 'pasion',
    resumen: 'Al cordero de la Pascua no se le quebraba ningún hueso, y el salmo dice que Dios guarda los huesos del justo. Los soldados no quebraron las piernas de Jesús.',
    citado: true,
    pasos: [
      { rol: 'figura', ref: 'exo.12.46', titulo: 'No quebraréis hueso suyo' },
      { rol: 'promesa', ref: 'psa.34.20', titulo: 'Él guarda todos sus huesos' },
      { rol: 'cumple', ref: 'jhn.19.33-jhn.19.36', titulo: 'Hueso no quebrantaréis de él' },
    ],
  },
  {
    id: 'traspasado',
    titulo: 'Mirarán al que traspasaron',
    tema: 'pasion',
    resumen: 'Zacarías anunció que Jerusalén miraría al que traspasaron y lloraría. Un soldado abre el costado de Jesús; Apocalipsis dice que todo ojo le verá.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'zec.12.10', titulo: 'Mirarán a mí, a quien traspasaron' },
      { rol: 'cumple', ref: 'jhn.19.34-jhn.19.37', titulo: 'Le abrió el costado con una lanza' },
      { rol: 'espera', ref: 'rev.1.7', titulo: 'Todo ojo le verá, y los que le traspasaron' },
    ],
  },
  {
    id: 'sepultura',
    titulo: 'Con los ricos en su muerte',
    tema: 'pasion',
    resumen: 'Isaías dijo que su sepultura estaría con los impíos y con el rico en su muerte. Murió entre ladrones y lo sepultó José de Arimatea, un hombre rico.',
    pasos: [
      { rol: 'promesa', ref: 'isa.53.9', titulo: 'Con los ricos fue en su muerte' },
      { rol: 'cumple', ref: 'mat.27.57-mat.27.60', titulo: 'Un hombre rico de Arimatea' },
    ],
  },
  {
    id: 'serpiente',
    titulo: 'La serpiente levantada en el desierto',
    tema: 'pasion',
    resumen: 'Los israelitas mordidos vivían al mirar la serpiente de bronce. Jesús dijo a Nicodemo que así sería levantado el Hijo del hombre.',
    pasos: [
      { rol: 'figura', ref: 'num.21.8-num.21.9', titulo: 'Cualquiera que la mirare vivirá' },
      { rol: 'cumple', ref: 'jhn.3.14-jhn.3.15', titulo: 'Así es necesario que el Hijo del hombre sea levantado' },
    ],
  },

  // ——— Resurrección y reinado ———
  {
    id: 'jonas',
    titulo: 'La señal de Jonás',
    tema: 'victoria',
    resumen: 'Jonás pasó tres días y tres noches en el vientre del pez. Jesús dijo que esa sería la única señal: su muerte y resurrección.',
    pasos: [
      { rol: 'figura', ref: 'jon.2.1', titulo: 'Tres días y tres noches' },
      { rol: 'cumple', ref: 'mat.12.39-mat.12.40', titulo: 'Así estará el Hijo del hombre en el corazón de la tierra' },
    ],
  },
  {
    id: 'resurreccion',
    titulo: 'No verá corrupción',
    tema: 'victoria',
    resumen: 'David cantó que Dios no dejaría a su Santo ver corrupción. Pedro y Pablo predican que David murió y fue sepultado; el salmo hablaba de Cristo resucitado.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.16.10', titulo: 'Ni permitirás que tu santo vea corrupción' },
      { rol: 'eco', ref: 'isa.53.10-isa.53.11', titulo: 'Verá linaje, vivirá por largos días' },
      { rol: 'cumple', ref: 'act.2.31-act.2.32', titulo: 'A este Jesús resucitó Dios' },
      { rol: 'cumple', ref: 'act.13.35-act.13.37', titulo: 'Aquel a quien Dios levantó no vio corrupción' },
    ],
    reflexion: 'El argumento de Pedro es sencillo: el sepulcro de David seguía allí, con David dentro. El de Jesús estaba vacío.',
  },
  {
    id: 'hijo',
    cumplido: 30,
    titulo: 'Mi Hijo eres tú',
    tema: 'victoria',
    resumen: 'En el Salmo 2 Dios dice a su rey ungido: «Mi hijo eres tú; yo te engendré hoy». Pablo y Hebreos lo aplican a Jesús resucitado y exaltado.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.2.7-psa.2.8', titulo: 'Mi hijo eres tú; yo te engendré hoy' },
      { rol: 'cumple', ref: 'act.13.32-act.13.33', titulo: 'Resucitando a Jesús, como está escrito en el salmo segundo' },
      { rol: 'cumple', ref: 'heb.1.5', titulo: '¿A cuál de los ángeles dijo jamás?' },
    ],
  },
  {
    id: 'diestra',
    titulo: 'Siéntate a mi diestra',
    tema: 'victoria',
    resumen: 'David oyó a Jehová decir a su Señor: «Siéntate a mi diestra». Es el versículo del AT más citado en el NT: Jesús ascendido reina junto al Padre.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.110.1', titulo: 'Dijo Jehová a mi Señor' },
      { rol: 'eco', ref: 'mat.22.43-mat.22.45', titulo: 'Si David le llama Señor, ¿cómo es su hijo?' },
      { rol: 'cumple', ref: 'act.2.33-act.2.35', titulo: 'Ensalzado por la diestra de Dios' },
      { rol: 'espera', ref: 'heb.10.12-heb.10.13', titulo: 'Esperando hasta que sus enemigos sean puestos por estrado' },
    ],
  },
  {
    id: 'melquisedec',
    cumplido: 30,
    titulo: 'Sacerdote según Melquisedec',
    tema: 'victoria',
    resumen: 'El mismo salmo anuncia un sacerdote para siempre, no de la tribu de Leví sino del orden de Melquisedec. Hebreos lo desarrolla: Jesús es ese sacerdote.',
    citado: true,
    pasos: [
      { rol: 'figura', ref: 'gen.14.18-gen.14.20', titulo: 'Melquisedec, rey de Salem, sacerdote' },
      { rol: 'promesa', ref: 'psa.110.4', titulo: 'Tú eres sacerdote para siempre' },
      { rol: 'cumple', ref: 'heb.6.20', titulo: 'Jesús, hecho Pontífice eternalmente' },
      { rol: 'cumple', ref: 'heb.7.24-heb.7.25', titulo: 'Viviendo siempre para interceder' },
    ],
  },
  {
    id: 'ascension',
    titulo: 'Subiste a lo alto',
    tema: 'victoria',
    resumen: 'El Salmo 68 celebra a Dios que sube a lo alto llevando cautivos. Pablo lo aplica a Cristo ascendido, que reparte dones a su iglesia.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'psa.68.18', titulo: 'Subiste a lo alto, cautivaste la cautividad' },
      { rol: 'cumple', ref: 'act.1.9', titulo: 'Fue alzado, y una nube le recibió' },
      { rol: 'cumple', ref: 'eph.4.8', titulo: 'Dio dones a los hombres' },
    ],
  },

  // ——— El Espíritu y las naciones ———
  {
    id: 'espiritu',
    titulo: 'Derramaré mi Espíritu sobre toda carne',
    tema: 'naciones',
    resumen: 'Joel anunció el Espíritu derramado sobre hijos, hijas, siervos y siervas. En Pentecostés Pedro dijo: «esto es lo que fue dicho por el profeta Joel».',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'jol.2.28-jol.2.29', titulo: 'Derramaré mi Espíritu sobre toda carne' },
      { rol: 'eco', ref: 'jhn.14.16-jhn.14.17', titulo: 'Jesús promete otro Consolador' },
      { rol: 'cumple', ref: 'act.2.16-act.2.18', titulo: 'Esto es lo dicho por el profeta Joel' },
    ],
  },
  {
    id: 'luz-naciones',
    titulo: 'Luz para las naciones',
    tema: 'naciones',
    resumen: 'El siervo de Isaías no solo restauraría a Israel: sería luz de las gentes hasta lo postrero de la tierra. Simeón lo canta y Pablo lo predica.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'isa.49.6', titulo: 'Te di por luz de las gentes' },
      { rol: 'cumple', ref: 'luk.2.30-luk.2.32', titulo: 'Simeón: luz para revelación a los gentiles' },
      { rol: 'cumple', ref: 'act.13.46-act.13.47', titulo: 'Así nos ha mandado el Señor' },
    ],
  },
  {
    id: 'tabernaculo',
    titulo: 'El tabernáculo de David y los gentiles',
    tema: 'naciones',
    resumen: 'Amós prometió levantar la tienda caída de David para que la buscaran todas las naciones. Santiago lo cita en el concilio de Jerusalén para recibir a los gentiles.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'amo.9.11-amo.9.12', titulo: 'Levantaré el tabernáculo caído de David' },
      { rol: 'cumple', ref: 'act.15.14-act.15.17', titulo: 'Con esto concuerdan las palabras de los profetas' },
    ],
  },
  {
    id: 'no-mi-pueblo',
    titulo: 'Al que no era mi pueblo',
    tema: 'naciones',
    resumen: 'Oseas puso a su hijo el nombre «No mi pueblo», pero Dios prometió llamarlos otra vez «pueblo mío». Pablo y Pedro lo aplican a judíos y gentiles que creen.',
    citado: true,
    pasos: [
      { rol: 'promesa', ref: 'hos.2.23', titulo: 'Diré al que no era mi pueblo: Pueblo mío tú' },
      { rol: 'cumple', ref: 'rom.9.24-rom.9.26', titulo: 'No solo de los judíos, mas también de los gentiles' },
      { rol: 'cumple', ref: '1pe.2.10', titulo: 'Vosotros que en el tiempo pasado no erais pueblo' },
    ],
  },

  // ——— Cumplidas en la historia de Israel ———
  {
    id: 'ciro',
    titulo: 'Ciro, llamado por su nombre',
    tema: 'historia',
    resumen: 'Isaías nombra a Ciro como el que mandaría reedificar Jerusalén y el templo. Siglo y medio después, Ciro de Persia da ese edicto.',
    pasos: [
      { rol: 'promesa', ref: 'isa.44.28', titulo: 'Que dice de Ciro: Es mi pastor', año: -700 },
      { rol: 'eco', ref: 'isa.45.1', titulo: 'Así dice Jehová a su ungido, a Ciro', año: -700 },
      { rol: 'cumple', ref: 'ezr.1.1-ezr.1.3', titulo: 'Despertó Jehová el espíritu de Ciro', año: -538 },
    ],
    reflexion: 'Cuando Isaías escribió, Persia no era un imperio y Jerusalén no había caído. Dios habla de lo que aún no existe como si ya fuera.',
  },
  {
    id: 'setenta',
    titulo: 'Setenta años en Babilonia',
    tema: 'historia',
    resumen: 'Jeremías fijó el destierro en setenta años. Daniel leyó esa profecía y oró; Crónicas y Esdras cuentan el regreso.',
    pasos: [
      { rol: 'promesa', ref: 'jer.25.11-jer.25.12', titulo: 'Servirán al rey de Babilonia setenta años', año: -605 },
      { rol: 'eco', ref: 'jer.29.10', titulo: 'Os visitaré y os haré volver', año: -597 },
      { rol: 'eco', ref: 'dan.9.2', titulo: 'Daniel miró en los libros el número de los años', año: -539 },
      { rol: 'cumple', ref: '2ch.36.21-2ch.36.23', titulo: 'Para que se cumpliese la palabra por boca de Jeremías', año: -538 },
    ],
  },
  {
    id: 'josias',
    titulo: 'Josías, nombrado tres siglos antes',
    tema: 'historia',
    resumen: 'Un profeta de Judá anunció contra el altar de Betel que un rey llamado Josías quemaría allí huesos humanos. Unos tres siglos después, Josías lo hizo.',
    pasos: [
      { rol: 'promesa', ref: '1ki.13.2', titulo: 'He aquí que a la casa de David nacerá un hijo llamado Josías', año: -930 },
      { rol: 'cumple', ref: '2ki.23.15-2ki.23.16', titulo: 'Conforme a la palabra de Jehová', año: -622 },
    ],
  },
  {
    id: 'jerico',
    titulo: 'La maldición sobre Jericó',
    tema: 'historia',
    resumen: 'Josué advirtió que quien reedificara Jericó lo pagaría con sus hijos. En tiempos de Acab, Hiel la reconstruyó y se cumplió la palabra.',
    pasos: [
      { rol: 'promesa', ref: 'jos.6.26', titulo: 'Maldito el que reedificare esta ciudad', año: -1406 },
      { rol: 'cumple', ref: '1ki.16.34', titulo: 'Conforme a la palabra que Jehová había hablado por Josué', año: -870 },
    ],
  },
  {
    id: 'senaquerib',
    esperaTexto: 'esa misma noche',
    titulo: 'Senaquerib no entrará en la ciudad',
    tema: 'historia',
    resumen: 'Con Jerusalén sitiada, Isaías anunció que el rey de Asiria no entraría ni tiraría una saeta. Esa noche el ángel de Jehová hirió el campamento asirio.',
    pasos: [
      { rol: 'promesa', ref: '2ki.19.32-2ki.19.34', titulo: 'No entrará en esta ciudad', año: -701 },
      { rol: 'cumple', ref: '2ki.19.35-2ki.19.36', titulo: 'Salió el ángel de Jehová', año: -701 },
    ],
  },
  {
    id: 'templo',
    titulo: 'No quedará piedra sobre piedra',
    tema: 'historia',
    resumen: 'Jesús lloró sobre Jerusalén y anunció que el templo sería derribado. En el año 70 las legiones de Tito lo destruyeron.',
    pasos: [
      { rol: 'promesa', ref: 'luk.19.43-luk.19.44', titulo: 'Tus enemigos te cercarán con baluarte' },
      { rol: 'promesa', ref: 'mat.24.1-mat.24.2', titulo: 'No será dejada aquí piedra sobre piedra' },
      { rol: 'cumple', titulo: 'Tito toma Jerusalén y destruye el templo', año: 70, nota: 'Lo cuenta el historiador judío Flavio Josefo, testigo de la guerra.' },
    ],
  },

  // ——— Lo que aún esperamos ———
  {
    id: 'volvera',
    titulo: 'Así vendrá como le habéis visto ir',
    tema: 'esperanza',
    resumen: 'Jesús prometió volver por los suyos, y los ángeles lo repitieron en la ascensión. La iglesia lo espera sin poner fechas: del día y la hora nadie sabe.',
    pasos: [
      { rol: 'promesa', ref: 'jhn.14.2-jhn.14.3', titulo: 'Vendré otra vez, y os tomaré a mí mismo' },
      { rol: 'promesa', ref: 'act.1.10-act.1.11', titulo: 'Este mismo Jesús así vendrá' },
      { rol: 'eco', ref: 'mat.24.36', titulo: 'Del día y hora nadie sabe', nota: 'Por eso aquí no hay fechas ni cálculos: Jesús mismo los descartó.' },
      { rol: 'espera', ref: '1th.4.16-1th.4.17', titulo: 'El Señor mismo descenderá del cielo' },
      { rol: 'espera', ref: 'rev.22.20', titulo: 'Ciertamente, vengo en breve. Amén; sí, ven, Señor Jesús' },
    ],
    reflexion: 'Cada promesa cumplida en este recorrido es una garantía de las que faltan. El mismo Dios que cumplió Belén y la cruz cumplirá también su regreso.',
  },
  {
    id: 'resurreccion-muertos',
    cumplido: 30,
    titulo: 'Los muertos resucitarán',
    tema: 'esperanza',
    resumen: 'Isaías y Daniel anunciaron que los que duermen en el polvo despertarán. Cristo resucitó como primicias; la cosecha completa aún está por venir.',
    pasos: [
      { rol: 'promesa', ref: 'isa.26.19', titulo: 'Tus muertos vivirán' },
      { rol: 'promesa', ref: 'dan.12.2', titulo: 'Los que duermen en el polvo serán despertados' },
      { rol: 'cumple', ref: '1co.15.20-1co.15.23', titulo: 'Cristo ha resucitado, primicias de los que durmieron' },
      { rol: 'espera', ref: '1co.15.51-1co.15.52', titulo: 'Los muertos serán levantados sin corrupción' },
    ],
  },
  {
    id: 'nueva-creacion',
    titulo: 'Cielos nuevos y tierra nueva',
    tema: 'esperanza',
    resumen: 'Isaías vio a Dios creando cielos nuevos y tierra nueva y enjugando toda lágrima. Pedro y Juan recogen esa promesa como el final de la historia.',
    pasos: [
      { rol: 'promesa', ref: 'isa.65.17', titulo: 'Yo crearé nuevos cielos y nueva tierra' },
      { rol: 'promesa', ref: 'isa.25.8', titulo: 'Enjugará el Señor toda lágrima' },
      { rol: 'eco', ref: '2pe.3.13', titulo: 'Esperamos cielos nuevos según sus promesas' },
      { rol: 'espera', ref: 'rev.21.1-rev.21.4', titulo: 'Enjugará Dios toda lágrima de los ojos de ellos' },
    ],
  },
];

export const HILOS: Hilo[] = HILOS_LISTA;
const POR_ID = new Map(HILOS.map((h) => [h.id, h]));
export const hiloPorId = (id: string) => POR_ID.get(id);

export const promesaHref = (h: Hilo) => `/promesas/${h.id}`;

/** «c. 740–681 a.C.» o el año que trae el paso. */
export function fechaPaso(p: Paso): string {
  if (p.año != null) return rango(p.año, p.año, p.año < 0 && !!p.ref);
  const per = periodoPaso(p);
  if (!per) return '';
  if (per.sinFecha) return 'Sin fecha';
  return rango(per.desde, per.hasta, per.desde < -1000);
}

export function periodoPaso(p: Paso): Periodo | undefined {
  if (!p.ref) return undefined;
  const { start } = parseRef(p.ref);
  return periodoDe(start.book, start.chapter);
}

/** Año aproximado de un paso (el centro de su periodo), o undefined si no tiene fecha. */
export function añoPaso(p: Paso): number | undefined {
  if (p.año != null) return p.año;
  const per = periodoPaso(p);
  if (!per || per.sinFecha) return undefined;
  return Math.round((per.desde + per.hasta) / 2);
}

/** La primera promesa (o figura) y el primer cumplimiento: los dos extremos del arco. */
export function extremos(h: Hilo): { promesa: Paso; cumple?: Paso } {
  const promesa = h.pasos.find((p) => p.rol === 'promesa' || p.rol === 'figura') ?? h.pasos[0];
  const cumple = h.pasos.find((p) => p.rol === 'cumple');
  return { promesa, cumple };
}

/** Años entre la promesa y su cumplimiento (sin año 0). */
export function espera(h: Hilo): number | undefined {
  const { promesa, cumple } = extremos(h);
  if (!cumple) return undefined;
  const a = añoPaso(promesa);
  const b = h.cumplido ?? añoPaso(cumple);
  if (a == null || b == null) return undefined;
  return b - a - (a < 0 && b > 0 ? 1 : 0);
}

/** «unos 700 años después», redondeado como se dice al hablar. */
export function textoEspera(años: number): string {
  if (años < 1) return 'el mismo año';
  if (años < 20) return `${años} ${años === 1 ? 'año' : 'años'} después`;
  const paso = años < 100 ? 10 : años < 1000 ? 50 : 100;
  return `unos ${(Math.round(años / paso) * paso).toLocaleString('es')} años después`;
}

function contiene(ref: string, book: string, chapter: number, verse?: number) {
  const { start, end } = parseRef(ref);
  if (start.book !== book) return false;
  const a = start.chapter * 1000 + start.verse;
  const z = end.chapter * 1000 + end.verse;
  if (verse == null) return chapter >= start.chapter && chapter <= end.chapter;
  const v = chapter * 1000 + verse;
  return v >= a && v <= z;
}

export type Encontrado = { hilo: Hilo; paso: Paso };

/** Hilos que pasan por un capítulo o un versículo, con el paso que cae ahí. */
export function hilosEn(book: string, chapter: number, verse?: number): Encontrado[] {
  const out: Encontrado[] = [];
  for (const hilo of HILOS) {
    const paso = hilo.pasos.find((p) => p.ref && contiene(p.ref, book, chapter, verse));
    if (paso) out.push({ hilo, paso });
  }
  return out;
}

/** Para marcar una referencia cruzada: el paso de otro extremo del mismo hilo que cae en esa referencia. */
export function pasoEnRef(hilos: Encontrado[], ref: string): Encontrado | undefined {
  const { start } = parseRef(ref);
  for (const { hilo, paso: aqui } of hilos) {
    const otro = hilo.pasos.find((p) => p !== aqui && p.ref && contiene(p.ref, start.book, start.chapter, start.verse));
    if (otro) return { hilo, paso: otro };
  }
  return undefined;
}

export const FUENTE_PROMESAS =
  'Selección propia a partir de las citas que el mismo Nuevo Testamento hace del Antiguo, en la línea de los ' +
  'comentarios clásicos de dominio público (Matthew Henry, Jamieson-Fausset-Brown). Texto: Reina-Valera 1909. ' +
  'Fechas aproximadas, con la cronología de la línea de tiempo; lo que esperamos va sin fechas.';

// ——— Escala del arco de las promesas ———
// De Abraham a la cruz la distancia se comprime con una raíz: los siglos lejanos se juntan a la izquierda y la
// llegada de Cristo, donde caen casi todos los cumplimientos, tiene sitio. Después, el siglo I y lo que esperamos.

export const CRISTO = 0.84;
const DESPUES = 0.06;
export const FUTURO = 0.97;
const LEJOS = 2200;

/** Posición (de 0 a 1) de un año en el arco. Sin año: el principio. */
export function posicion(año: number | undefined): number {
  if (año == null) return 0;
  if (año <= 30) return Math.max(0.015, CRISTO * (1 - Math.sqrt(Math.min(LEJOS, 30 - año) / LEJOS)));
  return CRISTO + (Math.min(100, año) - 30) / 70 * DESPUES;
}

export type Arco = { hilo: Hilo; desde: number; hasta: number; futuro: boolean };

/** Extremos de cada hilo en el arco: de su primera promesa al cumplimiento (o a lo que esperamos). */
export function arcos(hilos: Hilo[] = HILOS): Arco[] {
  return hilos.map((hilo) => {
    const { promesa, cumple } = extremos(hilo);
    const futuro = hilo.tema === 'esperanza';
    const desde = posicion(añoPaso(promesa));
    const hasta = futuro ? FUTURO : posicion(hilo.cumplido ?? (cumple ? añoPaso(cumple) : undefined));
    return { hilo, desde, hasta: Math.max(hasta, desde + 0.01), futuro };
  });
}

/** Hitos para el eje, con su año. */
export const HITOS: [string, number][] = [
  ['Abraham', -2091],
  ['Moisés', -1446],
  ['David', -1010],
  ['Isaías', -700],
  ['Malaquías', -435],
];
