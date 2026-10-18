// Genealogías a partir de Theographic Bible Metadata (CC BY-SA 4.0); ver pipeline/genealogias.py.
import { load } from './data';

/** [nombre, sexo «m»/«f», padres, madres, cónyuges, hijos, hermanos, primera cita «rut.4.17», versículos] */
type Row = [string, string, number[], number[], number[], number[], number[], string, number];

export type Persona = {
  id: number;
  nombre: string;
  sexo: 'm' | 'f' | '';
  padres: number[];
  madres: number[];
  conyuges: number[];
  hijos: number[];
  hermanos: number[];
  cita: string;
  versiculos: number;
};

export type Personas = Map<number, Persona>;

let personas: Promise<Personas> | null = null;

export function getPersonas(): Promise<Personas> {
  personas ??= load<Record<string, Row>>('genealogia/personas.json').then(
    (rows) =>
      new Map(
        Object.entries(rows).map(([id, r]) => [
          Number(id),
          {
            id: Number(id),
            nombre: r[0],
            sexo: r[1] as Persona['sexo'],
            padres: r[2],
            madres: r[3],
            conyuges: r[4],
            hijos: r[5],
            hermanos: r[6],
            cita: r[7],
            versiculos: r[8],
          },
        ]),
      ),
  );
  personas.catch(() => (personas = null));
  return personas;
}

/** Personas con familia conocida que nombra un capítulo: [id, versículos]. */
export const getPersonasCapitulo = (book: string, chapter: number) =>
  load<[number, number[]][]>(`genealogia/${book}/${chapter}.json`, true).then((r) => (Array.isArray(r) ? r : []));

const por = (sexo: Persona['sexo'], m: string, f: string, n = m) => (sexo === 'm' ? m : sexo === 'f' ? f : n);

/** Jesús en Theographic. Su genealogía pasa por José, su padre legal (Mateo 1:16). */
export const JESUS = 905;

/** Cómo se distingue de otras personas con el mismo nombre: «hijo de Isaí», «esposa de Booz». */
export function descripcion(p: Persona, all: Personas): string {
  if (p.id === JESUS) return 'nacido de María, desposada con José (Mateo 1:16)';
  const padre = all.get(p.padres[0]) ?? all.get(p.madres[0]);
  if (padre) return `${por(p.sexo, 'hijo', 'hija', 'descendiente')} de ${padre.nombre}`;
  const conyuge = all.get(p.conyuges[0]);
  if (conyuge) return `${por(p.sexo, 'esposo', 'esposa', 'cónyuge')} de ${conyuge.nombre}`;
  const hijo = all.get(p.hijos[0]);
  if (hijo) return `${por(p.sexo, 'padre', 'madre', 'antepasado')} de ${hijo.nombre}`;
  const hermano = all.get(p.hermanos[0]);
  if (hermano) return `${por(p.sexo, 'hermano', 'hermana')} de ${hermano.nombre}`;
  return '';
}

/** Antepasados por línea paterna (o materna si no consta el padre), de la persona hacia atrás. */
export function linaje(p: Persona, all: Personas): Persona[] {
  const out = [p];
  const seen = new Set([p.id]);
  let cur: Persona | undefined = p;
  while (cur) {
    const next: Persona | undefined = all.get(cur.padres[0]) ?? all.get(cur.madres[0]);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    out.push(next);
    cur = next;
  }
  return out;
}

/** Hermanos: los que da la fuente y los demás hijos de los mismos padres. */
export function hermanosDe(p: Persona, all: Personas): number[] {
  const ids = new Set(p.hermanos);
  for (const parent of [...p.padres, ...p.madres]) for (const h of all.get(parent)?.hijos ?? []) ids.add(h);
  ids.delete(p.id);
  return [...ids].filter((id) => all.has(id));
}

export const relacion = {
  padre: (p: Persona, hijo?: Persona) =>
    hijo?.id === JESUS && p.sexo === 'm' ? 'padre legal' : por(p.sexo, 'padre', 'madre', 'padre o madre'),
  abuelo: (p: Persona) => por(p.sexo, 'abuelo', 'abuela'),
  hijo: (p: Persona) => por(p.sexo, 'hijo', 'hija'),
  hermano: (p: Persona) => por(p.sexo, 'hermano', 'hermana'),
  conyuge: (p: Persona) => por(p.sexo, 'esposo', 'esposa', 'cónyuge'),
};

/** /genealogia/994-david */
export function personaHref(p: Persona) {
  const slug = p.nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `/genealogia/${p.id}-${slug}`;
}

/** Personas destacadas para empezar a explorar (ids de Theographic). */
export const DESTACADAS = [905, 78, 2210, 58, 682, 2108, 2450, 994, 2762, 1938];

export const FUENTE_GENEALOGIA =
  'Relaciones familiares: Theographic Bible Metadata (Robert Rouse, CC BY-SA 4.0). Nombres según la Reina-Valera 1909.';
