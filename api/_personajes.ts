// La herramienta «personajes_y_lugares» de la IA: las fichas de la app (STEPBible TIPNR, CC BY 4.0; pipeline/fichas.py)
// de las personas, pueblos y lugares de un pasaje, unidas entre sí (familia, tribu, ciudad, lugares donde aparece) y con
// el momento histórico del capítulo (src/lib/historia.ts). Mike (2026-11-07): la Biblia usa mucho de dónde viene cada
// persona, cuán grande o pequeño era su pueblo y su entorno; la app ya tiene esa información y la IA debe usarla.

import { type Evento, type Periodo, eventosDe, periodoDe, rango } from '../src/lib/historia';

type Tipo = 'm' | 'f' | 'g' | 'l';
type Ref = { id: string; nombre: string; tipo?: Tipo; n?: number };
export type FichaDatos = {
  id: string;
  nombre: string;
  tipo: Tipo;
  breve?: string;
  otros?: string[];
  menciones?: number;
  en?: string;
  epoca?: string | null;
  rol?: string | null;
  tribu?: string | null;
  familia?: { padres: Ref[]; hermanos: Ref[]; conyuges: Ref[]; hijos: Ref[] };
  lugares?: Ref[];
  junto?: Ref[];
  clase?: string;
  fundador?: Ref[];
  habitantes?: Ref[];
  personas?: Ref[];
  cerca?: Ref[];
};
/** [id, nombre, tipo, versículos, formas del nombre en la RV1909] */
export type CapituloRow = [string, string, Tipo, number[], string[]];
/** [id, nombre, tipo, breve, menciones, otros nombres] */
export type IndiceRow = [string, string, Tipo, string, number, string[]];

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const nombres = (xs: Ref[] | undefined, max = 6) => (xs ?? []).slice(0, max).map((x) => x.nombre).join(', ');

/** «⟦jhn.1.44⟧» → «Juan 1:44» y «⟦luk.22.54-luk.22.62⟧» → «Lucas 22:54-62», con la etiqueta de la app. */
const conCitas = (texto: string, label: (ref: string) => string) =>
  texto.replace(/⟦([^⟧]+)⟧/g, (_, r: string) => {
    const [a, b] = r.split('-');
    try {
      if (!b) return label(a);
      const [ba, ca] = a.split('.');
      const [bb, cb, vb] = b.split('.');
      return ba === bb && ca === cb ? `${label(a)}-${vb}` : `${label(a)}–${label(b)}`;
    } catch {
      return '';
    }
  });

/** Los datos de una ficha en líneas cortas en español: quién es, de dónde viene, su familia y sus lugares. */
export function datosDe(f: FichaDatos): string[] {
  const out: string[] = [];
  const tipo = f.tipo === 'l' ? f.clase || 'Lugar' : f.tipo === 'g' ? 'Pueblo o grupo' : f.tipo === 'f' ? 'Mujer' : 'Varón';
  // Sin los otros nombres: los de la RV1909 a veces salen de una alineación dudosa («Juan, también Jordán»).
  const breve = f.breve && fold(f.breve) !== fold(tipo) ? `, ${f.breve.charAt(0).toLowerCase()}${f.breve.slice(1)}` : '';
  out.push(`${f.nombre}: ${tipo}${breve}.`);
  const sobre = [
    f.rol && `Papel: ${f.rol}`,
    f.tribu && `Tribu o pueblo: ${f.tribu}`,
    f.epoca && `Época: ${f.epoca}`,
    f.menciones && `Mencionado en ${f.menciones} ${f.menciones === 1 ? 'versículo' : 'versículos'}`,
  ].filter(Boolean);
  if (sobre.length) out.push(`${sobre.join('. ')}.`);
  const fam = f.familia;
  if (fam) {
    const partes = [
      fam.padres.length && `padres: ${nombres(fam.padres)}`,
      fam.hermanos.length && `hermanos: ${nombres(fam.hermanos)}`,
      fam.conyuges.length && `cónyuge: ${nombres(fam.conyuges)}`,
      fam.hijos.length && `hijos: ${nombres(fam.hijos, 8)}`,
    ].filter(Boolean);
    if (partes.length) out.push(`Familia: ${partes.join('; ')}.`);
  }
  if (f.lugares?.length) out.push(`Lugares donde aparece (en cuántos versículos): ${f.lugares.slice(0, 6).map((l) => `${l.nombre} (${l.n})`).join(', ')}.`);
  if (f.junto?.length) out.push(`Aparece sobre todo junto a: ${nombres(f.junto, 6)}.`);
  if (f.fundador?.length) out.push(`Fundado por: ${nombres(f.fundador)}.`);
  if (f.habitantes?.length) out.push(`Habitantes nombrados: ${nombres(f.habitantes)}.`);
  if (f.personas?.length) out.push(`Personas ligadas a este lugar: ${f.personas.slice(0, 8).map((p) => `${p.nombre} (${p.n})`).join(', ')}.`);
  if (f.cerca?.length) out.push(`Cerca de: ${nombres(f.cerca, 5)}.`);
  return out;
}

/** El momento histórico de un capítulo y lo que pasaba en el mundo, para darlo a la IA. */
export function momentoDe(book: string, chapter: number): { periodo: Periodo; lineas: string[] } | null {
  const periodo = periodoDe(book, chapter);
  if (!periodo) return null;
  // Lo que pasaba en el mundo durante el periodo (con diez años de margen); si no hay nada, lo más cercano.
  const todos: Evento[] = periodo.sinFecha ? [] : eventosDe(periodo, 8);
  const durante = todos.filter((e) => e.desde <= periodo.hasta + 10 && (e.hasta ?? e.desde) >= periodo.desde - 10);
  const eventos = (durante.length ? durante : todos.slice(0, 3)).slice(0, 5);
  const punto = (x: string) => (x.endsWith('.') ? x : `${x}.`);
  const lineas = [
    `${punto(`Periodo: ${periodo.titulo}${periodo.sinFecha ? ' (el texto no permite fijar fechas)' : `, ${rango(periodo.desde, periodo.hasta, true)}`}`)}${periodo.nota ? ` ${periodo.nota}` : ''}`,
    ...eventos.map((e) => `En el mundo (${e.region}, ${rango(e.desde, e.hasta, e.c)}): ${e.titulo}. ${e.texto}`),
  ];
  return { periodo, lineas };
}

/** Las fichas de un tramo del capítulo, primero las personas y las que más aparecen en el tramo. */
export function delTramo(rows: CapituloRow[], desde?: number, hasta?: number, max = 6): CapituloRow[] {
  const dentro = (vs: number[]) => (desde ? vs.filter((v) => v >= desde && v <= (hasta ?? desde)) : vs);
  const orden: Record<Tipo, number> = { m: 0, f: 0, g: 1, l: 2 };
  const elegidas = rows
    .map((r) => ({ r, n: dentro(r[3]).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => orden[a.r[2]] - orden[b.r[2]] || b.n - a.n)
    .slice(0, max)
    .map((x) => x.r);
  // Si en el tramo no se nombra ningún lugar, los del capítulo, que suelen ser el escenario (el mar de Galilea en Mateo 14).
  const lugares = elegidas.some((r) => r[2] === 'l') ? [] : rows.filter((r) => r[2] === 'l' && !elegidas.includes(r)).slice(0, 2);
  return [...elegidas.slice(0, max - lugares.length), ...lugares];
}

/** La ficha que mejor responde a un nombre: igual, luego que empiece igual, la más mencionada. */
export function buscarNombre(indice: IndiceRow[], nombre: string): IndiceRow | undefined {
  const q = fold(nombre);
  if (!q) return undefined;
  const nombresDe = (r: IndiceRow) => [r[1], ...r[5]].map((x) => fold(x.split(' (')[0]));
  const exactos = indice.filter((r) => nombresDe(r).includes(q));
  const parecidos = exactos.length ? exactos : indice.filter((r) => nombresDe(r).some((x) => x.startsWith(q)));
  return parecidos.sort((a, b) => b[4] - a[4])[0];
}

export { conCitas as citasDeFicha };

/** El enlace público a la ficha en la app, como fichaHref de src/lib/fichas.ts. */
export const enlaceFicha = (f: { id: string; nombre: string }) =>
  `https://zarzabiblia.com/ficha/${f.id}-${fold(f.nombre.split(' (')[0]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
