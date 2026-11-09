// El guion de un capítulo dramatizado a pedido (api/dramatizado.ts): lo escribe la IA en líneas simples y aquí se
// lee, se revisa contra el texto bíblico y se convierte en las escenas que se graban.
//
// Formato que escribe la IA (una cosa por línea):
//   TONO esperanza
//   PERSONAJE JUAN | hombre | joven | Juan el Bautista | voz: young prophet, strong, rough
//   ESCENA El desierto y el Jordán | ambiente: dry desert wind, open wilderness | espacio: abierto | ritmo: lento
//   DIRECCION Juan grita a la multitud; el narrador cuenta despacio, con asombro contenido.
//   SONIDO distant crowd murmuring by the river | 4
//   EFECTO a person being immersed in a river | 3
//   PAUSA 1.5
//   1 NARRADOR [slow, solemn]: Las primeras palabras de las buenas nuevas…
//   3 JUAN [proclaiming]: “Preparen el camino del Señor, [short pause] enderecen sus caminos.”
//   11 DIOS aprobacion: Tú eres mi Hijo amado…
//
// Las tres capas de sonido: el ambiente de la escena (de fondo, en bucle), los SONIDO (detalles que suenan debajo de
// la voz que sigue, sin pararla) y los EFECTO (golpes dramáticos: la narración espera a que suenen). El espacio dice
// cómo suena el lugar (eco) y el ritmo, cuánto respiran las pausas. El TONO elige las cortinas de música del capítulo.
// Las indicaciones de voz van en inglés entre corchetes: una al empezar la línea y hasta dos dentro del texto (para un
// cambio a mitad de frase o una pausa). Las que piden gestos que no se oyen ([smiling], [walks away]) se quitan.
//
// La IA tiene poca libertad: cada versículo tiene que decir exactamente el texto de la versión (solo puede repartirlo
// entre el narrador y los personajes). Si un versículo no coincide o falta, lo lee el narrador tal cual. Así el audio
// nunca cambia la Biblia.

export type Genero = 'hombre' | 'mujer';
export type Edad = 'niño' | 'joven' | 'adulto' | 'mayor';
/** Cómo suena la voz de Dios según el pasaje (pipeline/audio_dramatizado/voz-de-dios.md). */
export type Registro = 'aprobacion' | 'llamado' | 'poder' | 'gloria';
export const REGISTROS: Registro[] = ['aprobacion', 'llamado', 'poder', 'gloria'];

/** Cuánto respiran las pausas de una escena. */
export type Ritmo = 'lento' | 'normal' | 'vivo';
export const RITMOS: Ritmo[] = ['lento', 'normal', 'vivo'];
/** Cómo suena el lugar: al aire libre casi sin eco; una casa, poco; el templo o un palacio, mucho; una cueva, piedra. */
export type Espacio = 'abierto' | 'interior' | 'grande' | 'cueva';
export const ESPACIOS: Espacio[] = ['abierto', 'interior', 'grande', 'cueva'];
/** El ánimo del capítulo, para sus cortinas de música (public/audio/cortinas). */
export type Tono = 'paz' | 'esperanza' | 'tension' | 'duelo' | 'gloria';
export const TONOS: Tono[] = ['paz', 'esperanza', 'tension', 'duelo', 'gloria'];

/** `voz`: cómo suena, en pocas palabras en inglés («old priest, tired, gentle»), para buscarle voz en la biblioteca. */
export type Personaje = { id: string; genero: Genero; edad: Edad; nombre: string; voz?: string };
/** `texto` puede llevar hasta dos indicaciones dentro («Sal de aquí, [short pause] Satanás»). */
export type Linea = { voz: string; texto: string; tag?: string; registro?: Registro };
export type Paso = { v: number; lineas: Linea[] } | { efecto: string; dur: number } | { sonido: string; dur: number } | { pausa: number };
export type Escena = { titulo: string; ambiente?: string; espacio?: Espacio; ritmo?: Ritmo; direccion?: string; pasos: Paso[] };
export type Plan = { personajes: Personaje[]; escenas: Escena[]; tono?: Tono };

export const NARRADOR = 'NARRADOR';
export const JESUS = 'JESUS';
export const DIOS = 'DIOS';

/** Para que un capítulo no gaste de más en sonidos: ambientes y efectos por capítulo. */
export const MAX_AMBIENTES = 3;
export const MAX_EFECTOS = 3;
export const MAX_SONIDOS = 6;
export const MAX_PAUSAS = 8;
/** Indicaciones dentro del texto de una línea, como mucho. */
export const MAX_TAGS_DENTRO = 2;

const EDADES: Edad[] = ['niño', 'joven', 'adulto', 'mayor'];

/** Solo letras y números, sin tildes ni mayúsculas: para comparar el texto de la IA con el de la Biblia. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, '');
}

const limpiarId = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24);

/**
 * Lo que no se oye (gestos, movimientos, la cara) o no se puede pedir a una voz (música, otras personas): ElevenLabs lo
 * lee mal o lo ignora, y a veces lo dice en voz alta.
 */
const NO_SE_OYE = /\b(smil|grin|nod|walk|look|stand|sits?\b|sitting|turn|point|gestur|wink|frown|music|sing\b|singing|song|footstep|applause|door|kneel|bows?\b|bowing|hands?\b|eyes|stare|glanc|pacing|enters|exits|leaves|leaving)/i;
/** Jesús sereno, sin sonar teatral (Mike); Dios sin risas ni ruidos de boca (voz-de-dios.md). */
const NO_EN_JESUS = /\b(laugh|giggl|chuckl|sob|scream|shout|yell|dramatic|theatric|angry|furious|maniac|sarcas|snort|mock)/i;

/** Indicaciones de interpretación de ElevenLabs v4, en inglés y cortas: «[slow, solemn]». */
const tagValido = (t: string | undefined, voz = '') => {
  const x = t?.trim();
  if (!x || !/^\[[a-zA-Z ,'-]{1,60}\]$/.test(x) || NO_SE_OYE.test(x)) return undefined;
  if (voz === DIOS) return undefined;
  if (voz === JESUS && NO_EN_JESUS.test(x)) return undefined;
  return x;
};

/** El texto sin indicaciones dentro, para compararlo con la Biblia y contar lo que dura. */
export const sinTags = (s: string) => s.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();

/** Deja hasta dos indicaciones válidas dentro del texto y quita las demás. */
function tagsDentro(texto: string, voz: string): string {
  let n = 0;
  return texto
    .replace(/\s*\[[^\]]*\]\s*/g, (m) => {
      const t = tagValido(m.trim(), voz);
      if (!t || n >= MAX_TAGS_DENTRO) return ' ';
      n++;
      return ` ${t} `;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const numero = (s: string | undefined, def: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number((s ?? '').replace(',', '.')) || def));

/** Los sonidos se piden en inglés a ElevenLabs: texto corto sin saltos ni signos raros. */
/** Un sonido de la biblioteca de Freesound (public/audio/sonidos) se pide como «lib:ovejas». */
export const PREFIJO_BIBLIOTECA = 'lib:';
const sonido = (s: string) => {
  const lib = s.match(/^\s*lib\s*:\s*([a-z0-9-]{2,40})\b/i);
  if (lib) return `${PREFIJO_BIBLIOTECA}${lib[1].toLowerCase()}`;
  return s.replace(/[^\p{L}\p{N} ,.'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
};

type Item =
  | { tipo: 'escena'; titulo: string; ambiente?: string; espacio?: Espacio; ritmo?: Ritmo }
  | { tipo: 'direccion'; texto: string }
  | { tipo: 'efecto'; prompt: string; dur: number }
  | { tipo: 'sonido'; prompt: string; dur: number }
  | { tipo: 'pausa'; s: number }
  | { tipo: 'linea'; v: number; linea: Linea };

/** «ESCENA título | ambiente: … | espacio: … | ritmo: …», con las partes en cualquier orden y todas opcionales. */
function leerEscena(resto: string): Extract<Item, { tipo: 'escena' }> {
  const [titulo, ...partes] = resto.split('|');
  const out: Extract<Item, { tipo: 'escena' }> = { tipo: 'escena', titulo: titulo.trim().slice(0, 80) };
  for (const parte of partes) {
    const m = parte.match(/^\s*([a-záéíóú]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const clave = normalizar(m[1]);
    const valor = m[2].trim();
    if (clave === 'ambiente') {
      const a = sonido(valor);
      if (a && a !== '-') out.ambiente = a;
    } else if (clave === 'espacio') {
      const e = ESPACIOS.find((x) => x === normalizar(valor));
      if (e) out.espacio = e;
    } else if (clave === 'ritmo') {
      const r = RITMOS.find((x) => x === normalizar(valor));
      if (r) out.ritmo = r;
    }
  }
  return out;
}

/** Lee el texto de la IA. Las líneas que no entiende se ignoran (los versículos que falten los lee el narrador). */
/** La descripción de la voz, sin el «voz:» delante y solo con letras, comas y espacios. */
function vozDescrita(texto: string | undefined): { voz?: string } {
  const v = (texto ?? '').replace(/^\s*voz\s*:/i, '').replace(/[^\p{L}, -]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return v ? { voz: v } : {};
}

export function leerGuion(texto: string): { personajes: Personaje[]; items: Item[]; tono?: Tono } {
  const personajes: Personaje[] = [];
  const items: Item[] = [];
  let tono: Tono | undefined;
  for (const raw of texto.split('\n')) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line) continue;
    let m = line.match(/^PERSONAJE\s+([^|]+)\|([^|]+)\|([^|]+)(?:\|(.*))?$/i);
    if (m) {
      const id = limpiarId(m[1]);
      const g = normalizar(m[2]);
      const e = normalizar(m[3]);
      if (!id || [NARRADOR, DIOS, JESUS].includes(id) || personajes.some((p) => p.id === id)) continue;
      personajes.push({
        id,
        genero: g.startsWith('m') ? 'mujer' : 'hombre',
        edad: EDADES.find((x) => normalizar(x) === e) ?? (e.startsWith('nin') ? 'niño' : e.startsWith('anc') || e.startsWith('viej') ? 'mayor' : 'adulto'),
        nombre: (m[4]?.split('|')[0] || m[1]).trim().slice(0, 60),
        ...vozDescrita(m[4]?.split('|').slice(1).join(' ')),
      });
      continue;
    }
    m = line.match(/^TONO\s+(\S+)/i);
    if (m) {
      tono = TONOS.find((x) => x === normalizar(m![1])) ?? tono;
      continue;
    }
    m = line.match(/^ESCENA\s+(.*)$/i);
    if (m) {
      items.push(leerEscena(m[1]));
      continue;
    }
    m = line.match(/^DIRECCI[OÓ]N\s*:?\s+(.+)$/i);
    if (m) {
      items.push({ tipo: 'direccion', texto: m[1].trim().slice(0, 300) });
      continue;
    }
    m = line.match(/^PAUSA\s+([\d.,]+)/i);
    if (m) {
      items.push({ tipo: 'pausa', s: numero(m[1], 1, 0.5, 4) });
      continue;
    }
    m = line.match(/^(EFECTO|SONIDO)\s+([^|]+)(?:\|\s*([\d.,]+))?\s*$/i);
    if (m) {
      const efecto = m[1].toUpperCase() === 'EFECTO';
      const dur = efecto ? numero(m[3], 3, 1, 6) : numero(m[3], 4, 1, 8);
      const prompt = sonido(m[2]);
      if (prompt) items.push({ tipo: efecto ? 'efecto' : 'sonido', prompt, dur });
      continue;
    }
    // «12 PEDRO [firm]: texto» o «11 DIOS aprobacion: texto»
    m = line.match(/^(\d{1,3})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ_0-9]+)(?:\s+([a-zA-Z]+))?\s*((?:\[[^\]]*\]\s*)*)\s*:\s*(.+)$/);
    if (m) {
      const voz = limpiarId(m[2]);
      // Varias indicaciones antes de los dos puntos: la primera que valga va al principio y las demás se quitan.
      const tag = (m[4].match(/\[[^\]]*\]/g) ?? []).map((t) => tagValido(t, voz)).find(Boolean);
      const texto = tagsDentro(m[5].trim(), voz);
      if (!voz || !sinTags(texto)) continue;
      const registro = voz === DIOS ? (REGISTROS.find((r) => r === normalizar(m[3] ?? '')) ?? 'llamado') : undefined;
      items.push({ tipo: 'linea', v: Number(m[1]), linea: { voz, texto, ...(tag ? { tag } : {}), ...(registro ? { registro } : {}) } });
    }
  }
  return { personajes, items, ...(tono ? { tono } : {}) };
}

/**
 * El plan que se graba: el guion de la IA revisado contra los versículos. Cada versículo aparece una vez y en orden;
 * si sus líneas no dicen exactamente el texto (o falta), lo lee el narrador tal cual. Las voces sin declarar pasan a
 * ser personajes (hombre adulto) y los sonidos se recortan a lo que permite un capítulo.
 */
export function revisarGuion(texto: string, versiculos: [number, string][]): { plan: Plan; corregidos: number[] } {
  const { personajes, items, tono } = leerGuion(texto);
  const porVerso = new Map<number, Linea[]>();
  for (const it of items) if (it.tipo === 'linea') porVerso.set(it.v, [...(porVerso.get(it.v) ?? []), it.linea]);
  const textoDe = new Map(versiculos);
  const orden = versiculos.map(([n]) => n);
  const corregidos: number[] = [];
  const hechos = new Set<number>();
  const escenas: Escena[] = [];
  let ambientes = 0;
  let efectos = 0;
  let sonidos = 0;
  let pausas = 0;
  const actual = () => {
    if (!escenas.length) escenas.push({ titulo: '', pasos: [] });
    return escenas[escenas.length - 1];
  };
  const declarar = (voz: string) => {
    if (voz === NARRADOR || voz === DIOS || voz === JESUS || personajes.some((p) => p.id === voz)) return;
    personajes.push({ id: voz, genero: 'hombre', edad: 'adulto', nombre: voz });
  };
  const emitir = (v: number) => {
    if (hechos.has(v)) return;
    hechos.add(v);
    const biblia = textoDe.get(v) ?? '';
    const lineas = porVerso.get(v) ?? [];
    const dice = normalizar(lineas.map((l) => sinTags(l.texto)).join(' '));
    if (lineas.length && dice === normalizar(biblia)) {
      lineas.forEach((l) => declarar(l.voz));
      actual().pasos.push({ v, lineas });
    } else {
      corregidos.push(v);
      actual().pasos.push({ v, lineas: [{ voz: NARRADOR, texto: biblia }] });
    }
  };
  for (const it of items) {
    if (it.tipo === 'escena') {
      const ambiente = it.ambiente && ambientes < MAX_AMBIENTES ? it.ambiente : undefined;
      if (ambiente) ambientes++;
      // Una escena vacía (sin versículos todavía) se reemplaza en vez de quedar sin nada.
      const ultima = escenas[escenas.length - 1];
      if (ultima && !ultima.pasos.some((p) => 'v' in p)) escenas.pop();
      escenas.push({
        titulo: it.titulo,
        ...(ambiente ? { ambiente } : {}),
        ...(it.espacio ? { espacio: it.espacio } : {}),
        ...(it.ritmo ? { ritmo: it.ritmo } : {}),
        pasos: [],
      });
    } else if (it.tipo === 'direccion') {
      const e = actual();
      e.direccion = e.direccion ? `${e.direccion} ${it.texto}`.slice(0, 400) : it.texto;
    } else if (it.tipo === 'efecto') {
      if (efectos < MAX_EFECTOS) {
        efectos++;
        actual().pasos.push({ efecto: it.prompt, dur: it.dur });
      }
    } else if (it.tipo === 'sonido') {
      if (sonidos < MAX_SONIDOS) {
        sonidos++;
        actual().pasos.push({ sonido: it.prompt, dur: it.dur });
      }
    } else if (it.tipo === 'pausa') {
      if (pausas < MAX_PAUSAS) {
        pausas++;
        actual().pasos.push({ pausa: it.s });
      }
    } else if (textoDe.has(it.v) && !hechos.has(it.v)) {
      for (const n of orden) {
        if (n === it.v) break;
        emitir(n);
      }
      emitir(it.v);
    }
  }
  for (const n of orden) emitir(n);
  const usadas = new Set(escenas.flatMap((e) => e.pasos.flatMap((p) => ('v' in p ? p.lineas.map((l) => l.voz) : []))));
  return {
    plan: {
      personajes: personajes.filter((p) => usadas.has(p.id)),
      escenas: escenas.filter((e) => e.pasos.some((p) => 'v' in p)),
      ...(tono ? { tono } : {}),
    },
    corregidos,
  };
}

/** La voz de Dios desde el cielo la dicen tres voces a la vez (voz-de-dios.md, Jn 12:29). */
export const vocesDeLinea = (l: Linea) => (l.voz === DIOS && l.registro === 'aprobacion' ? 3 : 1);

/** Caracteres que cobra ElevenLabs por las voces del plan (sin sonidos). */
export function caracteres(plan: Plan): number {
  let n = 0;
  for (const e of plan.escenas) {
    for (const p of e.pasos) {
      if (!('v' in p)) continue;
      for (const l of p.lineas) n += (l.texto.length + (l.tag?.length ?? 0) + 1) * vocesDeLinea(l);
    }
  }
  return n;
}
