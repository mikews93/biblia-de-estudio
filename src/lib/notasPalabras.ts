// Notas breves y neutrales sobre palabras griegas y hebreas que las versiones españolas traducen de formas muy
// distintas. Las usa «¿Por qué difieren las versiones?» (src/lib/diferencias.ts) en lugar de la explicación general.
// Escritas a mano: describen las opciones de traducción sin decir cuál es la correcta.

const NOTAS: Record<string, string> = {
  // Antiguo Testamento
  H3068:
    'Es el nombre propio de Dios, יהוה (YHWH), escrito solo con consonantes. Por respeto, los judíos lo leían ' +
    '«Adonai», «el Señor». Por eso unas versiones lo transcriben («Jehová», «Yahvé», «Yavé») y otras siguen la ' +
    'costumbre antigua y dicen «el Señor» o «el SEÑOR».',
  H0430:
    'Elohim es la palabra hebrea común para «Dios». Tiene forma plural, pero con el Dios de Israel se usa con verbos ' +
    'en singular, así que casi todas las versiones dicen «Dios».',
  H0136: 'Adonai significa «Señor» o «mi Señor». Es un título, no el nombre propio de Dios (que es YHWH).',
  H2617:
    'Jésed es una de las palabras más ricas del hebreo: el amor leal que cumple lo prometido. No tiene una palabra ' +
    'exacta en español, así que las versiones eligen «misericordia», «bondad», «amor», «gran amor» o «fiel amor».',
  H7585:
    'Seol es el lugar de los muertos en el Antiguo Testamento. Unas versiones lo dejan como nombre propio («Seol») y ' +
    'otras lo traducen según el contexto: «sepulcro», «infierno», «la tumba» o «el reino de la muerte».',
  H5315:
    'Néfesh significa el ser vivo entero: la vida, la persona, el aliento, el deseo. Por eso unas versiones dicen ' +
    '«alma» y otras «vida», «persona» o «ser».',
  H7307:
    'Rúaj significa a la vez «espíritu», «viento» y «aliento». El contexto decide, y no todas las versiones lo leen ' +
    'igual.',
  H8451: 'Torá significa «enseñanza» o «instrucción». Se traduce «ley», pero la palabra es más amplia que un código legal.',
  H6635:
    'Tsebaot significa «ejércitos». El título «YHWH de los ejércitos» se traduce también «Señor Todopoderoso» o ' +
    '«Señor de los ejércitos celestiales».',
  H1285: 'Berit es un pacto o alianza: un compromiso solemne entre dos partes. Las versiones dicen «pacto», «alianza» o «acuerdo».',
  // Nuevo Testamento
  G3439:
    'Monogenés puede leerse como «unigénito» (único engendrado) o como «único», «sin igual». Las versiones clásicas ' +
    'dicen «unigénito»; muchas modernas, «único». Las dos lecturas tienen apoyo entre los estudiosos.',
  G0026:
    'Ágape es el amor que se entrega. La Reina-Valera antigua, siguiendo el latín (caritas), dice «caridad»; hoy ' +
    '«caridad» suele entenderse como dar limosna, por eso las versiones modernas dicen «amor».',
  G3056:
    'Logos significa «palabra», pero también «razón» o «mensaje». En Juan 1, la Reina-Valera dice «el Verbo» (del ' +
    'latín verbum) y muchas versiones modernas, «la Palabra». Las dos se refieren a Cristo.',
  G4561:
    'Sarx significa literalmente «carne». Pablo la usa a menudo para la naturaleza humana inclinada al pecado, y por ' +
    'eso algunas versiones la traducen así en lugar de «carne».',
  G5547: 'Jristós significa «ungido», como el hebreo «Mesías». Unas versiones lo dejan como nombre («Cristo») y otras dicen «el Mesías».',
  G1577:
    'Ekklesía significa «asamblea», la gente convocada. Las versiones dicen «iglesia», «congregación» o ' +
    '«comunidad»; en algunos pasajes no se refiere a la iglesia (Hechos 19:32).',
  G1401:
    'Dulos es la persona que pertenece a un amo. Las versiones clásicas dicen «siervo»; muchas modernas, «esclavo», ' +
    'que es más literal pero suena más duro.',
  G5485: 'Jaris significa «gracia», un favor que no se merece. Algunas versiones dicen «favor», «bondad» o «amor inmerecido».',
  G4102:
    'Pístis significa «fe», «confianza» y también «fidelidad». Algunas versiones eligen una u otra según el contexto.',
  G1343:
    'Dikaiosýne significa «justicia» y también «rectitud», estar bien con Dios. Las versiones dicen «justicia», ' +
    '«rectitud» o lo explican: «ser declarado justo».',
  G0165:
    'Aión significa «era», «edad» o «mundo». «Por todos los siglos» es la forma clásica de decir «para siempre», y ' +
    'otras versiones dicen simplemente «para siempre».',
  G0086: 'Hades es el lugar de los muertos, como el Seol hebreo. Unas versiones lo dejan como nombre y otras dicen «infierno», «sepulcro» o «muerte».',
  G1067: 'Guéenna era un valle junto a Jerusalén que se volvió imagen del castigo final. Las versiones dicen «infierno» o lo dejan como nombre.',
  G3341: 'Metánoia significa cambiar de mente y de rumbo. Las versiones dicen «arrepentimiento» o «cambio de vida».',
  G2434:
    'Hilasmós es el sacrificio que quita la culpa y reconcilia con Dios. La Reina-Valera dice «propiciación»; otras ' +
    'versiones lo explican con más palabras: «sacrificio por el perdón».',
  G4151: 'Pneuma significa «espíritu», «viento» y «aliento». Cuando se refiere al Espíritu Santo, unas versiones lo escriben con mayúscula y otras no.',
  G5590: 'Psyjé significa «alma» y también «vida» o «persona». Por eso unas versiones dicen «alma» y otras «vida».',
  G2962: 'Kýrios significa «señor» o «amo». La Septuaginta lo usa en lugar del nombre YHWH, y el Nuevo Testamento se lo aplica a Jesús.',
  G0932: 'Basileía es «reino», pero también «reinado»: que Dios reina. Algunas versiones dicen «reinado» o «gobierno de Dios».',
  G0040: 'Hágios significa «santo», apartado para Dios. Cuando habla de creyentes, unas versiones dicen «santos» y otras «el pueblo de Dios» o «los creyentes».',
};

/** Nota de una palabra por su número de Strong («G3439», «H3068G», «G26»); null si no hay. */
export function notaPalabra(strong: string): string | null {
  const m = /^([GH])0*(\d+)/.exec(strong.trim());
  return m ? (NOTAS[`${m[1]}${m[2].padStart(4, '0')}`] ?? null) : null;
}
