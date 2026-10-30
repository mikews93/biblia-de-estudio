// «Llévate lo tuyo»: las notas, los resaltados, el diario, las oraciones y los mensajes del Taller en un documento
// que se abre en Word, se guarda en PDF o se copia como texto. Es una de las quejas más repetidas de otras apps
// (investigación de 2026-10-30): lo que uno escribe queda encerrado en la app. Aquí se puede sacar todo, sin cuenta.

import { documentoDe, fechaLarga, type Documento } from './documento';
import type { Book } from './data';
import type { Entrada } from './diario';
import type { HighlightColor } from './highlights';
import type { MyNote } from './notas';
import type { Oracion } from './oraciones';
import { leerAlmacen } from './sincronia';
import type { Mensaje } from './taller';

// Los almacenes se registran al importar sus módulos.
import './diario';
import './highlights';
import './notas';
import './oraciones';
import './taller';

export type Parte = 'notas' | 'diario' | 'oraciones' | 'mensajes';

export const PARTES: { value: Parte; titulo: string; detalle: string }[] = [
  { value: 'notas', titulo: 'Notas y resaltados', detalle: 'Con el texto de cada versículo, en el orden de la Biblia.' },
  { value: 'diario', titulo: 'Diario devocional', detalle: 'La frase que te detuvo, tu oración y el paso de cada día.' },
  { value: 'oraciones', titulo: 'Oraciones', detalle: 'Lo que pides, los versículos que te acompañan y las respuestas.' },
  { value: 'mensajes', titulo: 'Sermones y estudios del Taller', detalle: 'Los terminados y los borradores.' },
];

export type Versiculo = { key: string; book: string; chapter: number; verse: number; referencia: string; texto?: string; nota?: string; color?: HighlightColor; fecha: number };

export type Contenido = {
  versiculos: Versiculo[];
  diario: Entrada[];
  oraciones: Oracion[];
  mensajes: Documento[];
  /** Cuántos mensajes son borradores (sin terminar). */
  borradores: number;
};

const vacio = (c: Contenido, p: Parte) =>
  p === 'notas' ? !c.versiculos.length : p === 'diario' ? !c.diario.length : p === 'oraciones' ? !c.oraciones.length : !c.mensajes.length;
export const cuantos = (c: Contenido, p: Parte) =>
  p === 'notas' ? c.versiculos.length : p === 'diario' ? c.diario.length : p === 'oraciones' ? c.oraciones.length : c.mensajes.length;

/** Junta lo guardado en el dispositivo (que también trae lo de la cuenta, si hay una). */
export async function reunir(
  books: Book[],
  capitulo: (book: string, chapter: number) => Promise<[number, string, ...unknown[]][]>,
): Promise<Contenido> {
  const [notas, marcas, diario, oraciones, taller] = await Promise.all([
    leerAlmacen('notas') as Promise<Record<string, MyNote> | undefined>,
    leerAlmacen('resaltados') as Promise<Record<string, { color: HighlightColor; at: number }> | undefined>,
    leerAlmacen('diario') as Promise<Entrada[] | undefined>,
    leerAlmacen('oraciones') as Promise<Oracion[] | undefined>,
    leerAlmacen('taller') as Promise<Mensaje[] | undefined>,
  ]);
  const orden = new Map(books.map((b, i) => [b.id, i]));
  const nombre = (id: string) => books.find((b) => b.id === id)?.name ?? id;
  const claves = [...new Set([...Object.keys(notas ?? {}), ...Object.keys(marcas ?? {})])];
  const versiculos = claves
    .map((key): Versiculo => {
      const [book, c, v] = key.split('.');
      const n = notas?.[key];
      const m = marcas?.[key];
      return {
        key,
        book,
        chapter: Number(c),
        verse: Number(v),
        referencia: `${nombre(book)} ${c}:${v}`,
        nota: n?.text?.trim() || undefined,
        color: m?.color,
        fecha: Math.max(n?.updated ?? 0, m?.at ?? 0),
      };
    })
    .filter((x) => x.nota || x.color)
    .sort((a, b) => (orden.get(a.book) ?? 99) - (orden.get(b.book) ?? 99) || a.chapter - b.chapter || a.verse - b.verse);
  // El texto de cada versículo, en la RV1909 (libre): así el documento se entiende solo.
  const caps = new Map<string, Promise<[number, string, ...unknown[]][] | null>>();
  await Promise.all(
    versiculos.map(async (x) => {
      const k = `${x.book}.${x.chapter}`;
      if (!caps.has(k)) caps.set(k, capitulo(x.book, x.chapter).catch(() => null));
      x.texto = (await caps.get(k))?.find(([n]) => n === x.verse)?.[1];
    }),
  );
  const todos = [...(taller ?? [])].sort((a, b) => (b.terminado ?? b.actualizado).localeCompare(a.terminado ?? a.actualizado));
  return {
    versiculos,
    diario: [...(diario ?? [])].sort((a, b) => b.created - a.created),
    oraciones: [...(oraciones ?? [])].sort((a, b) => b.created - a.created),
    mensajes: todos.map((m) => documentoDe(m, books)),
    borradores: todos.filter((m) => !m.terminado).length,
  };
}

const fecha = (ms: number) => fechaLarga(new Date(ms).toISOString());
const COLOR: Record<HighlightColor, string> = { amarillo: '#F7D774', verde: '#9ED9A0', azul: '#9CC3EE', rosa: '#F3A9C4' };

// Texto (Markdown sencillo), para copiar o pegar en cualquier sitio

export function comoTexto(c: Contenido, partes: Parte[], hoy = Date.now()): string {
  const out = ['# Lo mío en Zarza', `Guardado el ${fecha(hoy)}`];
  for (const p of partes) {
    if (vacio(c, p)) continue;
    out.push('', `## ${PARTES.find((x) => x.value === p)!.titulo}`);
    if (p === 'notas') {
      for (const v of c.versiculos) {
        out.push('', `**${v.referencia}**${v.color ? ` (resaltado ${v.color})` : ''}`);
        if (v.texto) out.push(`> ${v.texto}`);
        if (v.nota) out.push(v.nota);
      }
    }
    if (p === 'diario') {
      for (const e of c.diario) {
        out.push('', `**${fecha(e.created)} · ${e.reference}**`);
        if (e.palabra) out.push(`Lo que me detuvo: ${e.palabra}`);
        if (e.oracion) out.push(`Mi oración: ${e.oracion}`);
        if (e.paso) out.push(`El paso de hoy: ${e.paso}${e.hecho ? ' (hecho)' : ''}`);
        if (e.llevar) out.push(`Para llevar: «${e.llevar.text}»`);
      }
    }
    if (p === 'oraciones') {
      for (const o of c.oraciones) {
        out.push('', `**${o.titulo}** · desde el ${fecha(o.created)}`);
        if (o.detalle) out.push(o.detalle);
        if (o.versiculos.length) out.push(`Me acompañan: ${o.versiculos.map((v) => v.reference).join(', ')}`);
        if (o.respondida) out.push(`Respondida el ${fecha(o.respondida.fecha)}${o.respondida.nota ? `: ${o.respondida.nota}` : ''}`);
      }
    }
    if (p === 'mensajes') {
      for (const d of c.mensajes) {
        out.push('', `### ${d.titulo || 'Sin título'}`, [d.tipo, d.pasaje, d.terminado ? `terminado el ${fechaLarga(d.terminado)}` : 'borrador'].filter(Boolean).join(' · '));
        if (d.idea) out.push(`Idea central: ${d.idea}`);
        for (const parte of d.partes) {
          out.push('', `**${parte.etiqueta}${parte.titulo ? `: ${parte.titulo}` : ''}**`, ...parte.paraGrupo, ...parte.parrafos);
          if (parte.claves.length) out.push(...parte.claves.map((x) => `- ${x}`));
        }
      }
    }
  }
  return out.join('\n');
}

// HTML, para imprimir, guardar en PDF o abrir en Word

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parrafos = (s: string) => s.split(/\n+/).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join('');

export function comoHtml(c: Contenido, partes: Parte[], hoy = Date.now()): string {
  const secciones = partes
    .filter((p) => !vacio(c, p))
    .map((p) => {
      const titulo = PARTES.find((x) => x.value === p)!.titulo;
      let cuerpo = '';
      if (p === 'notas') {
        cuerpo = c.versiculos
          .map(
            (v) => `<div class="item">
  <div class="ref">${v.color ? `<span class="punto" style="background:${COLOR[v.color]}"></span>` : ''}${esc(v.referencia)}</div>
  ${v.texto ? `<blockquote${v.color ? ` style="background:${COLOR[v.color]}55"` : ''}>${esc(v.texto)}</blockquote>` : ''}
  ${v.nota ? parrafos(v.nota) : ''}
</div>`,
          )
          .join('');
      }
      if (p === 'diario') {
        cuerpo = c.diario
          .map(
            (e) => `<div class="item">
  <div class="ref">${esc(fecha(e.created))} · ${esc(e.reference)}</div>
  ${e.palabra ? `<p><b>Lo que me detuvo.</b> ${esc(e.palabra)}</p>` : ''}
  ${e.oracion ? `<p><b>Mi oración.</b> ${esc(e.oracion)}</p>` : ''}
  ${e.paso ? `<p><b>El paso de hoy.</b> ${esc(e.paso)}${e.hecho ? ' <span class="mini">· hecho</span>' : ''}</p>` : ''}
  ${e.llevar ? `<blockquote>${esc(e.llevar.text)}</blockquote>` : ''}
</div>`,
          )
          .join('');
      }
      if (p === 'oraciones') {
        cuerpo = c.oraciones
          .map(
            (o) => `<div class="item">
  <div class="ref">${esc(o.titulo)} <span class="mini">· desde el ${esc(fecha(o.created))}</span></div>
  ${o.detalle ? parrafos(o.detalle) : ''}
  ${o.versiculos.length ? `<p class="nota">Me acompañan: ${esc(o.versiculos.map((v) => v.reference).join(', '))}</p>` : ''}
  ${o.respondida ? `<p class="respondida"><b>Respondida el ${esc(fecha(o.respondida.fecha))}.</b> ${esc(o.respondida.nota ?? '')}</p>` : ''}
</div>`,
          )
          .join('');
      }
      if (p === 'mensajes') {
        cuerpo = c.mensajes
          .map(
            (d) => `<div class="mensaje">
  <div class="mini">${esc([d.tipo, d.terminado ? `terminado el ${fechaLarga(d.terminado)}` : 'borrador'].join(' · '))}</div>
  <h3>${esc(d.titulo || 'Sin título')}</h3>
  ${d.pasaje ? `<p class="nota">${esc(d.pasaje)}</p>` : ''}
  ${d.idea ? `<div class="idea">${esc(d.idea)}</div>` : ''}
  ${d.partes
    .map(
      (x) => `<div class="parte"><div class="mini">${esc(x.etiqueta)}</div>${x.titulo ? `<h4>${esc(x.titulo)}</h4>` : ''}${[...x.paraGrupo, ...x.parrafos].map((t) => `<p>${esc(t)}</p>`).join('')}${
        x.claves.length ? `<ul>${x.claves.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''
      }</div>`,
    )
    .join('')}
</div>`,
          )
          .join('');
      }
      return `<section><h2>${esc(titulo)} <span class="cuenta">${cuantos(c, p)}</span></h2>${cuerpo}</section>`;
    })
    .join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Lo mío en Zarza</title>
<style>
  @page { margin: 2cm 2.2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1C1B19; line-height: 1.55; font-size: 12pt; max-width: 17cm; margin: 0 auto; }
  .mini, .cuenta, .tapa { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
  .tapa { text-transform: uppercase; letter-spacing: .1em; font-size: 9pt; font-weight: 700; color: #6A6660; }
  h1 { font-size: 26pt; margin: 4pt 0 2pt; }
  .fecha { color: #6A6660; margin: 0 0 18pt; }
  section { margin-top: 26pt; }
  h2 { font-size: 17pt; border-bottom: 2px solid #1C1B19; padding-bottom: 4pt; }
  .cuenta { font-size: 10pt; color: #6A6660; font-weight: 400; }
  .item { margin: 12pt 0; break-inside: avoid-page; }
  .ref { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-weight: 700; font-size: 11pt; }
  .punto { display: inline-block; width: 8pt; height: 8pt; border-radius: 4pt; margin-right: 6pt; }
  blockquote { margin: 4pt 0; padding: 6pt 10pt; border-left: 3pt solid #94561A; font-style: italic; }
  p { margin: 4pt 0; }
  .mini { text-transform: uppercase; letter-spacing: .08em; font-size: 8.5pt; font-weight: 700; color: #6A6660; }
  .nota { font-size: 10.5pt; color: #6A6660; }
  .respondida { border: 1px solid #E3E0DB; border-radius: 6pt; padding: 6pt 10pt; }
  .mensaje { margin-top: 20pt; break-before: auto; }
  h3 { font-size: 15pt; margin: 2pt 0; }
  h4 { font-size: 12.5pt; margin: 2pt 0; }
  .idea { border-left: 3pt solid #94561A; background: #F5E9D8; padding: 8pt 12pt; margin: 8pt 0; font-style: italic; }
  .parte { margin-top: 10pt; }
  footer { margin-top: 28pt; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 8.5pt; color: #6A6660; }
</style></head><body>
  <div class="tapa">Zarza · Biblia de estudio</div>
  <h1>Lo mío en Zarza</h1>
  <p class="fecha">Guardado el ${esc(fecha(hoy))}</p>
  ${secciones}
  <footer>Los versículos van en la Reina-Valera 1909, de dominio público.</footer>
</body></html>`;
}

export const nombreArchivo = (hoy = Date.now()) => `zarza-lo-mio-${new Date(hoy).toISOString().slice(0, 10)}`;
