// Plantas, animales y objetos de la Biblia (Flora, Fauna and Realia Handbooks de las Sociedades Bíblicas Unidas,
// CC BY-SA 4.0; pipeline/build_fuentes_abiertas.py). El texto viene en inglés: /api/comentario lo traduce con IA la
// primera vez que alguien lo abre y lo guarda para todos, como las fichas.

import { traducir } from './comentarios';
import { load } from './data';

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type TipoObjeto = 'flora' | 'fauna' | 'realia';
export type Objeto = { id: string; t: string; tipo: TipoObjeto; refs: string[] };

export const TIPO_OBJETO: Record<TipoObjeto, string> = {
  flora: 'Planta de la Biblia',
  fauna: 'Animal de la Biblia',
  realia: 'Objeto o costumbre de la Biblia',
};

export const FUENTE_OBJETOS =
  'Adaptado de los manuales Flora, Fauna and Realia © Sociedades Bíblicas Unidas, 2025 (CC BY-SA 4.0), traducido al español con IA y sin los consejos para traductores. Esta traducción se comparte con la misma licencia.';

/** «nombre»: cómo se llama en español (la glosa del léxico), para el título mientras llega la traducción. */
export const objetoHref = (id: string, nombre?: string) => `/objeto/${id}${nombre ? `?nombre=${encodeURIComponent(nombre)}` : ''}`;

/** Como pipeline/build_fuentes_abiertas.py: sin acentos, puntos vocálicos ni signos. */
export const lemaClave = (lema: string) =>
  lema
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .replace(/[^\p{L}\p{N}_]/gu, '');

/** Las entradas de los manuales para una palabra hebrea o griega. */
export async function objetosDeLema(lemas: string[]): Promise<[string, TipoObjeto][]> {
  const indice = await load<Record<string, [string, TipoObjeto][]>>('objetos/lemas.json', true);
  const out: [string, TipoObjeto][] = [];
  for (const l of lemas) for (const e of indice[lemaClave(l)] ?? []) if (!out.some((o) => o[0] === e[0])) out.push(e);
  return out;
}

export const getObjeto = (id: string) =>
  load<{ t?: string; tipo?: TipoObjeto; refs?: string[] }>(`objetos/a/${id}.json`, true).then((o): Objeto | null =>
    o.t ? { id, t: o.t, tipo: o.tipo ?? 'realia', refs: o.refs ?? [] } : null,
  );

/** La traducción guardada, o texto null si nadie la ha abierto todavía. */
export async function getObjetoTexto(id: string): Promise<{ texto: string | null }> {
  const res = await fetch(`${API}/api/comentario?objeto=${encodeURIComponent(id)}`).catch(() => {
    throw new Error('Sin conexión. Esta explicación se lee con internet.');
  });
  if (!res.ok) throw new Error('No se pudo cargar la explicación.');
  return res.json();
}

export const traducirObjeto = (id: string, onUpdate: (text: string) => void, signal?: AbortSignal) =>
  traducir({ objeto: id }, onUpdate, 'No se pudo preparar la explicación', signal);

/** «# Hisopo\n\n…» → el título y el resto. */
export function separarTitulo(texto: string): { titulo: string | null; cuerpo: string } {
  const m = /^#\s+(.+)\n+/.exec(texto.trimStart());
  return m ? { titulo: m[1].trim(), cuerpo: texto.trimStart().slice(m[0].length) } : { titulo: null, cuerpo: texto };
}
