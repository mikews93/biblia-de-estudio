// El guion de un capítulo dramatizado a pedido (api/dramatizado.ts): lo escribe la IA en líneas simples y aquí se
// lee, se revisa contra el texto bíblico y se convierte en las escenas que se graban.
//
// Formato que escribe la IA (una cosa por línea):
//   PERSONAJE JUAN | hombre | joven | Juan el Bautista
//   ESCENA El desierto y el Jordán | ambiente: dry desert wind, open wilderness
//   EFECTO a person being immersed in a river | 3
//   1 NARRADOR [slow, solemn]: Las primeras palabras de las buenas nuevas…
//   3 JUAN [proclaiming]: “Preparen el camino del Señor…”
//   11 DIOS aprobacion: Tú eres mi Hijo amado…
//
// La IA tiene poca libertad: cada versículo tiene que decir exactamente el texto de la versión (solo puede repartirlo
// entre el narrador y los personajes). Si un versículo no coincide o falta, lo lee el narrador tal cual. Así el audio
// nunca cambia la Biblia.

export type Genero = 'hombre' | 'mujer';
export type Edad = 'niño' | 'joven' | 'adulto' | 'mayor';
/** Cómo suena la voz de Dios según el pasaje (pipeline/audio_dramatizado/voz-de-dios.md). */
export type Registro = 'aprobacion' | 'llamado' | 'poder' | 'gloria';
export const REGISTROS: Registro[] = ['aprobacion', 'llamado', 'poder', 'gloria'];

export type Personaje = { id: string; genero: Genero; edad: Edad; nombre: string };
export type Linea = { voz: string; texto: string; tag?: string; registro?: Registro };
export type Paso = { v: number; lineas: Linea[] } | { efecto: string; dur: number };
export type Escena = { titulo: string; ambiente?: string; pasos: Paso[] };
export type Plan = { personajes: Personaje[]; escenas: Escena[] };

export const NARRADOR = 'NARRADOR';
export const JESUS = 'JESUS';
export const DIOS = 'DIOS';

/** Para que un capítulo no gaste de más en sonidos: ambientes y efectos por capítulo. */
export const MAX_AMBIENTES = 3;
export const MAX_EFECTOS = 4;

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

/** Indicaciones de interpretación de ElevenLabs v4, en inglés y cortas: «[slow, solemn]». */
const tagValido = (t: string | undefined) => (t && /^\[[a-zA-Z ,'-]{1,60}\]$/.test(t.trim()) ? t.trim() : undefined);

/** Los sonidos se piden en inglés a ElevenLabs: texto corto sin saltos ni signos raros. */
const sonido = (s: string) => s.replace(/[^\p{L}\p{N} ,.'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

type Item =
  | { tipo: 'escena'; titulo: string; ambiente?: string }
  | { tipo: 'efecto'; prompt: string; dur: number }
  | { tipo: 'linea'; v: number; linea: Linea };

/** Lee el texto de la IA. Las líneas que no entiende se ignoran (los versículos que falten los lee el narrador). */
export function leerGuion(texto: string): { personajes: Personaje[]; items: Item[] } {
  const personajes: Personaje[] = [];
  const items: Item[] = [];
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
        nombre: (m[4] ?? m[1]).trim().slice(0, 60),
      });
      continue;
    }
    m = line.match(/^ESCENA\s+([^|]*)(?:\|\s*ambiente\s*:\s*(.*))?$/i);
    if (m) {
      const ambiente = m[2] ? sonido(m[2]) : '';
      items.push({ tipo: 'escena', titulo: m[1].trim().slice(0, 80), ...(ambiente && ambiente !== '-' ? { ambiente } : {}) });
      continue;
    }
    m = line.match(/^EFECTO\s+([^|]+)(?:\|\s*([\d.,]+))?\s*$/i);
    if (m) {
      const dur = Math.min(6, Math.max(1, Number((m[2] ?? '3').replace(',', '.')) || 3));
      const prompt = sonido(m[1]);
      if (prompt) items.push({ tipo: 'efecto', prompt, dur });
      continue;
    }
    // «12 PEDRO [firm]: texto» o «11 DIOS aprobacion: texto»
    m = line.match(/^(\d{1,3})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ_0-9]+)(?:\s+([a-zA-Z]+))?\s*(\[[^\]]*\])?\s*:\s*(.+)$/);
    if (m) {
      const voz = limpiarId(m[2]);
      const texto = m[5].trim();
      if (!voz || !texto) continue;
      const registro = voz === DIOS ? (REGISTROS.find((r) => r === normalizar(m[3] ?? '')) ?? 'llamado') : undefined;
      const tag = tagValido(m[4]);
      items.push({ tipo: 'linea', v: Number(m[1]), linea: { voz, texto, ...(tag ? { tag } : {}), ...(registro ? { registro } : {}) } });
    }
  }
  return { personajes, items };
}

/**
 * El plan que se graba: el guion de la IA revisado contra los versículos. Cada versículo aparece una vez y en orden;
 * si sus líneas no dicen exactamente el texto (o falta), lo lee el narrador tal cual. Las voces sin declarar pasan a
 * ser personajes (hombre adulto) y los sonidos se recortan a lo que permite un capítulo.
 */
export function revisarGuion(texto: string, versiculos: [number, string][]): { plan: Plan; corregidos: number[] } {
  const { personajes, items } = leerGuion(texto);
  const porVerso = new Map<number, Linea[]>();
  for (const it of items) if (it.tipo === 'linea') porVerso.set(it.v, [...(porVerso.get(it.v) ?? []), it.linea]);
  const textoDe = new Map(versiculos);
  const orden = versiculos.map(([n]) => n);
  const corregidos: number[] = [];
  const hechos = new Set<number>();
  const escenas: Escena[] = [];
  let ambientes = 0;
  let efectos = 0;
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
    const dice = normalizar(lineas.map((l) => l.texto).join(' '));
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
      escenas.push({ titulo: it.titulo, ...(ambiente ? { ambiente } : {}), pasos: [] });
    } else if (it.tipo === 'efecto') {
      if (efectos < MAX_EFECTOS) {
        efectos++;
        actual().pasos.push({ efecto: it.prompt, dur: it.dur });
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
    plan: { personajes: personajes.filter((p) => usadas.has(p.id)), escenas: escenas.filter((e) => e.pasos.some((p) => 'v' in p)) },
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
