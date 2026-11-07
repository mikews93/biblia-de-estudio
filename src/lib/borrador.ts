// El Taller con borrador: la persona ora y cuenta lo que Dios le puso, la IA investiga con todas las fuentes de la app
// (y predicaciones evangélicas en la web), la persona marca lo que le sirve y le da la dirección, y la IA escribe el
// mensaje completo como borrador. Luego la persona lo cambia hablándole a la IA, lo escucha para practicar y lo
// presenta como cualquier mensaje del Taller.
// Los formatos los piden prepararTask, borradorAsk y cambiarAsk en api/estudiar.ts; no cambiar uno sin el otro.

import { dinamica } from './dinamicas';
import type { Source } from './estudio';
import { type Mensaje, type Pasaje, type Seccion, type Tipo, ANUNCIOS, PLANTILLAS, actualizarMensaje, anunciosDe, crearMensaje, plantilla as plantillaDe } from './taller';
import { conCitas } from './tallerTema';

export type ParteBorrador = { titulo: string; minutos: number; texto: string; dinamica?: string; claves: string[] };
export type Borrador = { titulo: string; idea?: { tema: string; complemento: string }; partes: ParteBorrador[] };

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
const sinMarcas = (s: string) => s.replace(/(?:\s*⟦\d+⟧)+/g, '').replace(/\*\*/g, '').trim();

/** Lee el borrador mientras llega: el título, la idea central y cada parte con su texto, dinámica y puntos clave. */
export function leerBorrador(markdown: string): Borrador {
  const out: Borrador = { titulo: '', partes: [] };
  let actual: (ParteBorrador & { lineas: string[] }) | null = null;
  let enIdea = false;
  const cerrar = () => {
    if (!actual) return;
    actual.texto = actual.lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const { lineas: _, ...parte } = actual;
    out.partes.push(parte);
    actual = null;
  };
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    const t1 = line.match(/^#\s+(.+)/);
    if (t1) {
      out.titulo = sinMarcas(t1[1]);
      continue;
    }
    const h = line.match(/^##\s+(.+)/);
    if (h) {
      cerrar();
      const titulo = sinMarcas(h[1]);
      if (fold(titulo).startsWith('idea central')) {
        enIdea = true;
        continue;
      }
      enIdea = false;
      const [nombre, min] = titulo.split('|').map((x) => x.trim());
      const minutos = Number(min?.match(/\d+/)?.[0]);
      actual = { titulo: nombre, minutos: Number.isFinite(minutos) && minutos > 0 ? minutos : 0, texto: '', claves: [], lineas: [] };
      continue;
    }
    if (enIdea) {
      const m = sinMarcas(line.replace(/^[-*•]\s+/, '')).match(/^tema\s*:\s*(.+?)\s*(?:\||·|—|–|;)\s*complemento\s*:\s*(.+)$/i);
      if (m) out.idea = { tema: m[1].replace(/^[«"]|[«»".]+$/g, ''), complemento: m[2].replace(/[«»"]/g, '').trim() };
      continue;
    }
    if (!actual) continue;
    const a: ParteBorrador & { lineas: string[] } = actual;
    const din = line.match(/^>\s*din[aá]mica\s*:\s*([a-z0-9-]+)/i);
    if (din) {
      if (dinamica(din[1].toLowerCase())) a.dinamica = din[1].toLowerCase();
      continue;
    }
    const clave = line.match(/^\*\s+(.+)/);
    if (clave) {
      a.claves.push(clave[1].trim());
      continue;
    }
    a.lineas.push(line);
  }
  cerrar();
  return out;
}

export const palabras = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Crea el mensaje con el borrador de la IA: las partes con su texto (las citas ⟦n⟧ pasan a referencias entre
 * paréntesis), sus minutos, la dinámica sugerida y los puntos clave. Si la IA devolvió otras partes que la
 * plantilla, manda el borrador. Queda como borrador hasta que la persona lo da por terminado.
 */
export async function crearDesdeBorrador(o: {
  tipo: Tipo;
  plantilla: string;
  pasaje: Pasaje;
  situacion: string;
  borrador: Borrador;
  sources: Source[];
  minutos?: number;
}): Promise<string> {
  const id = await crearMensaje(o.tipo, o.pasaje, o.borrador.titulo);
  const p = plantillaDe(o.plantilla) ?? PLANTILLAS.find((x) => x.tipo === o.tipo)!;
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const secciones: Seccion[] = o.borrador.partes.map((parte, i) => {
    const base = p.secciones.find((b) => fold(b.titulo) === fold(parte.titulo)) ?? p.secciones[i];
    return {
      id: uid(),
      titulo: parte.titulo || base?.titulo || `Parte ${i + 1}`,
      ayuda: base?.ayuda ?? '',
      texto: conCitas(parte.texto, o.sources),
      minutos: parte.minutos || base?.minutos || 5,
      dinamica: parte.dinamica,
      claves: parte.claves.map((c) => conCitas(c, o.sources)).join('\n') || undefined,
    };
  });
  const total = secciones.reduce((n, s) => n + s.minutos, 0);
  actualizarMensaje(id, {
    plantilla: p.id,
    secciones,
    situacion: o.situacion.trim(),
    ia: new Date().toISOString(),
    minutos: o.minutos ?? total,
    ...(o.borrador.idea && { tema: o.borrador.idea.tema, complemento: o.borrador.idea.complemento }),
  });
  return id;
}

/** Lo que lleva el mensaje, parte por parte con su id, para que la IA sepa qué cambia cuando la persona le habla. */
export function borradorParaCambiar(m: Mensaje) {
  const out: string[] = [];
  if (m.titulo.trim()) out.push(`[titulo] ${m.titulo.trim()}`);
  if (m.tema.trim() || m.complemento.trim()) out.push(`Idea central: ${m.tema.trim()}: ${m.complemento.trim()}`);
  for (const s of m.secciones) {
    out.push(
      '',
      `[titulo:${s.id}] ${s.titulo} | ${s.minutos} min${s.dinamica ? ` | dinámica: ${dinamica(s.dinamica)?.nombre ?? s.dinamica}` : ''}`,
      `[texto:${s.id}]`,
      s.texto.trim() || '(vacía)',
    );
  }
  return out.join('\n').slice(0, 12000);
}

export type Cambio = {
  /** «texto:<id>», «titulo:<id>», «titulo» (el del mensaje) o «nueva:despues:<id>». */
  destino: string;
  texto: string;
  /** Solo en una parte nueva: su título y sus minutos. */
  titulo?: string;
  minutos?: number;
};

/** Lee la respuesta a un pedido de cambio: la explicación y los bloques «@@ id» con el texto nuevo. */
export function leerCambios(markdown: string): { resumen: string; cambios: Cambio[] } {
  const [antes, ...bloques] = markdown.split(/^@@\s*/m);
  const cambios: Cambio[] = [];
  for (const b of bloques) {
    const [cabeza, ...resto] = b.split('\n');
    const destino = cabeza.trim().replace(/[[\]]/g, '');
    if (!/^(titulo|texto:[\w-]+|titulo:[\w-]+|nueva:despues:[\w-]+)$/.test(destino)) continue;
    const lineas = resto.join('\n').trim().split('\n');
    const c: Cambio = { destino, texto: '' };
    if (destino.startsWith('nueva:')) {
      const h = lineas[0]?.match(/^##\s+(.+)/);
      if (h) {
        const [t, min] = sinMarcas(h[1]).split('|').map((x) => x.trim());
        c.titulo = t;
        const n = Number(min?.match(/\d+/)?.[0]);
        if (Number.isFinite(n) && n > 0) c.minutos = n;
        lineas.shift();
      }
    }
    c.texto = lineas.join('\n').trim();
    if (c.texto || c.titulo) cambios.push(c);
  }
  return { resumen: antes.trim(), cambios };
}

/** El texto de ahora en el destino de un cambio, para mostrar el antes. */
export function antesDe(m: Mensaje, c: Cambio): string {
  if (c.destino === 'titulo') return m.titulo;
  const [campo, id] = c.destino.split(':');
  const s = m.secciones.find((x) => x.id === id);
  if (!s) return '';
  return campo === 'titulo' ? s.titulo : campo === 'texto' ? s.texto : '';
}

/** El nombre de la parte que toca un cambio. */
export function parteDe(m: Mensaje, c: Cambio): string {
  if (c.destino === 'titulo') return 'Título del mensaje';
  if (c.destino.startsWith('nueva:')) return `Parte nueva${c.titulo ? `: ${c.titulo}` : ''}`;
  const id = c.destino.split(':')[1];
  return m.secciones.find((x) => x.id === id)?.titulo ?? 'Una parte';
}

/** Si el cambio aún tiene dónde ir (la parte puede haberse borrado mientras tanto). */
export const valeCambio = (m: Mensaje, c: Cambio) =>
  c.destino === 'titulo' || m.secciones.some((x) => x.id === c.destino.split(':').pop());

/** Aplica un cambio aceptado. Devuelve lo que hay que guardar en el mensaje. */
export function aplicarCambio(m: Mensaje, c: Cambio, sources: Source[]): Partial<Mensaje> {
  const texto = conCitas(c.texto, sources);
  if (c.destino === 'titulo') return { titulo: sinMarcas(texto.split('\n')[0]) };
  const [campo, , despues] = c.destino.split(':');
  if (campo === 'nueva') {
    const i = m.secciones.findIndex((x) => x.id === despues);
    const nueva: Seccion = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      titulo: c.titulo || 'Nueva parte',
      ayuda: '',
      texto,
      minutos: c.minutos ?? 5,
    };
    const secciones = [...m.secciones];
    secciones.splice(i < 0 ? secciones.length : i + 1, 0, nueva);
    return { secciones };
  }
  const id = c.destino.split(':')[1];
  return {
    secciones: m.secciones.map((x) => (x.id !== id ? x : campo === 'titulo' ? { ...x, titulo: sinMarcas(texto.split('\n')[0]) } : { ...x, texto })),
  };
}

/** Las partes del mensaje para escucharlo entero con la voz del dispositivo: título, cada parte y los anuncios. */
export function partesParaEscuchar(m: Mensaje, titulo: string): string[] {
  const limpiar = (s: string) =>
    s
      // Las referencias entre paréntesis (las citas de las fuentes) no se leen en voz alta.
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/[*_#>]/g, '')
      .trim();
  const partes = [titulo];
  for (const s of m.secciones) {
    const t = limpiar(s.texto);
    if (t) partes.push(`${s.titulo}. ${t}`);
  }
  const anuncios = anunciosDe(m);
  if (anuncios.length) partes.push(`${ANUNCIOS}. ${anuncios.join('. ')}`);
  return partes;
}

/** Una huella corta del texto, para saber si el repaso hablado quedó viejo después de un cambio. */
export function huellaDe(m: Mensaje) {
  const s = [m.titulo, ...m.secciones.map((x) => `${x.titulo}\n${x.texto}`)].join('\n');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${s.length}-${(h >>> 0).toString(36)}`;
}

/** El repaso hablado en párrafos, para leerlo con la voz del dispositivo uno por uno. */
export const partesDelRepaso = (texto: string) =>
  texto
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[*_#>]/g, '').replace(/(?:\s*⟦\d+⟧)+/g, '').trim())
    .filter(Boolean);
