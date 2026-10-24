// «Revisa» del Taller: además de decir qué mejorar, la IA puede proponer correcciones al texto que la persona ya
// escribió (ortografía, claridad, una frase que no sale del pasaje…). Cada corrección cambia un trozo exacto de un
// campo; la persona ve el cambio marcado y decide si lo acepta. La IA no escribe partes nuevas: solo ajusta lo escrito.
// El formato lo pide el modo «corregir» de tallerTask en api/estudiar.ts.

import { type Mensaje, destinosDe } from './taller';

export type Correccion = {
  /** El campo, con los mismos ids que las sugerencias: «tema», «observacion», «notas:<sección>», «grupo:<sección>», «claves:<sección>». */
  destino: string;
  /** Nombre del campo para mostrarlo («Punto 1», «La necesidad»…). */
  label: string;
  antes: string;
  despues: string;
  porque: string;
};

export type EstadoCorreccion = 'pendiente' | 'aplicada' | 'no-coincide';

const CAMPOS = ['titulo', 'observacion', 'tema', 'complemento', 'necesidad', 'gracia'] as const;
type Campo = (typeof CAMPOS)[number];

const LABELS: Record<Campo, string> = {
  titulo: 'Título',
  observacion: 'Observar',
  tema: 'Tema',
  complemento: 'Complemento',
  necesidad: 'La necesidad',
  gracia: 'La gracia',
};

/** El texto de un campo del mensaje, o undefined si el campo no existe. */
export function valorDe(m: Mensaje, destino: string): string | undefined {
  if ((CAMPOS as readonly string[]).includes(destino)) return m[destino as Campo];
  const [campo, id] = destino.split(':');
  const s = m.secciones.find((x) => x.id === id);
  if (!s) return undefined;
  if (campo === 'notas') return s.texto;
  if (campo === 'grupo') return s.paraGrupo ?? '';
  if (campo === 'claves') return s.claves ?? '';
  return undefined;
}

function conValor(m: Mensaje, destino: string, valor: string): Partial<Mensaje> {
  if ((CAMPOS as readonly string[]).includes(destino)) return { [destino]: valor };
  const [campo, id] = destino.split(':');
  const key = campo === 'notas' ? 'texto' : campo === 'claves' ? 'claves' : 'paraGrupo';
  return { secciones: m.secciones.map((x) => (x.id === id ? { ...x, [key]: valor } : x)) };
}

export function labelDe(m: Mensaje, destino: string) {
  if ((CAMPOS as readonly string[]).includes(destino)) return LABELS[destino as Campo];
  return destinosDe(m).find((d) => d.id === destino)?.label ?? 'Tu borrador';
}

/** Lo escrito, campo por campo con su id, para que la IA sepa dónde va cada corrección. Los campos vacíos no van. */
export function borradorParaCorregir(m: Mensaje) {
  const out: string[] = [];
  const ids = [...CAMPOS, ...m.secciones.flatMap((s) => (m.tipo === 'encuentro' ? [`notas:${s.id}`, `grupo:${s.id}`] : [`notas:${s.id}`, `claves:${s.id}`]))];
  for (const id of ids) {
    const v = valorDe(m, id)?.trim();
    if (v) out.push(`[${id}] ${labelDe(m, id)}:\n${v}`);
  }
  return out.join('\n\n').slice(0, 12000);
}

const sinComillas = (s: string) => s.trim().replace(/^[«"“]/, '').replace(/[»"”]$/, '');

/**
 * Lee las correcciones de la respuesta de la IA:
 *   @@ notas:abc
 *   - el texto tal como está
 *   + el texto corregido
 *   ? por qué
 * Las que no apuntan a un campo que exista, o no cambian nada, se ignoran.
 */
export function leerCorrecciones(markdown: string, m: Mensaje): Correccion[] {
  const out: Correccion[] = [];
  let actual: Partial<Correccion> | null = null;
  const cerrar = () => {
    if (actual?.destino && actual.antes && actual.despues !== undefined && actual.antes !== actual.despues && valorDe(m, actual.destino) !== undefined) {
      out.push({ destino: actual.destino, label: labelDe(m, actual.destino), antes: actual.antes, despues: actual.despues, porque: actual.porque ?? '' });
    }
    actual = null;
  };
  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const head = line.match(/^@@\s*\[?([a-z]+(?::[a-z0-9]+)?)\]?/i);
    if (head) {
      cerrar();
      actual = { destino: head[1] };
      continue;
    }
    if (!actual) continue;
    if (line.startsWith('- ')) actual.antes = actual.antes === undefined ? sinComillas(line.slice(2)) : `${actual.antes}\n${sinComillas(line.slice(2))}`;
    else if (line.startsWith('+ ')) actual.despues = actual.despues === undefined ? sinComillas(line.slice(2)) : `${actual.despues}\n${sinComillas(line.slice(2))}`;
    else if (line.startsWith('+') && line.trim() === '+') actual.despues ??= '';
    else if (line.startsWith('? ')) actual.porque = line.slice(2).replace(/(?:\s*⟦\d+⟧)+/g, '').trim();
  }
  cerrar();
  return out;
}

/** Si el trozo sigue en el campo (pendiente), si ya está el texto corregido (aplicada) o si el texto cambió. */
export function estadoDe(m: Mensaje, c: Correccion): EstadoCorreccion {
  const v = valorDe(m, c.destino) ?? '';
  if (v.includes(c.antes)) return 'pendiente';
  if (c.despues && v.includes(c.despues)) return 'aplicada';
  return 'no-coincide';
}

/**
 * Aplica las correcciones que siguen pendientes. Devuelve el cambio y lo que había antes en cada campo tocado,
 * para deshacerlo.
 */
export function aplicarCorrecciones(m: Mensaje, lista: Correccion[]): { cambio: Partial<Mensaje>; previo: Record<string, string>; aplicadas: number } {
  let actual = m;
  const previo: Record<string, string> = {};
  let aplicadas = 0;
  for (const c of lista) {
    const v = valorDe(actual, c.destino);
    if (v === undefined || !v.includes(c.antes)) continue;
    if (!(c.destino in previo)) previo[c.destino] = v;
    actual = { ...actual, ...conValor(actual, c.destino, v.replace(c.antes, c.despues)) };
    aplicadas++;
  }
  return { cambio: cambioDe(actual, Object.keys(previo)), previo, aplicadas };
}

/** Lo que cambió en esos campos, para guardarlo con actualizarMensaje. */
function cambioDe(actual: Mensaje, destinos: string[]): Partial<Mensaje> {
  const cambio: Partial<Mensaje> = {};
  for (const destino of destinos) {
    if (destino.includes(':')) cambio.secciones = actual.secciones;
    else Object.assign(cambio, { [destino]: actual[destino as Campo] });
  }
  return cambio;
}

/** Devuelve los campos tocados a como estaban. */
export function deshacerCorrecciones(m: Mensaje, previo: Record<string, string>): Partial<Mensaje> {
  let actual = m;
  for (const [destino, v] of Object.entries(previo)) actual = { ...actual, ...conValor(actual, destino, v) };
  return cambioDe(actual, Object.keys(previo));
}

export type Trozo = { texto: string; tipo: 'igual' | 'quitado' | 'puesto' };

/** Las diferencias palabra por palabra entre el antes y el después, para marcarlas. */
export function diferencias(antes: string, despues: string): Trozo[] {
  const a = antes.split(/(\s+)/).filter(Boolean);
  const b = despues.split(/(\s+)/).filter(Boolean);
  // LCS clásico; los textos son de unas pocas frases.
  const n = a.length;
  const k = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = k - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Trozo[] = [];
  const push = (texto: string, tipo: Trozo['tipo']) => {
    const last = out[out.length - 1];
    if (last?.tipo === tipo) last.texto += texto;
    else out.push({ texto, tipo });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < k) {
    if (a[i] === b[j]) {
      push(a[i], 'igual');
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push(a[i++], 'quitado');
    else push(b[j++], 'puesto');
  }
  while (i < n) push(a[i++], 'quitado');
  while (j < k) push(b[j++], 'puesto');
  return out;
}
