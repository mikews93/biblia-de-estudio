// El documento final de un mensaje del Taller: introducción, los puntos que llevan a la idea central, los puntos
// concretos para hablar de cada parte, la conclusión y los anuncios. Se arma solo con lo que escribió quien prepara:
// aquí no se inventa ni se resume nada, solo se ordena. Se ve en /taller/<id>/documento, se imprime o se guarda en PDF
// (web), se descarga para Word y se comparte como texto.

import { Platform } from 'react-native';

import type { Book } from './data';
import { dinamica } from './dinamicas';
import { Mensaje, Ocasion, Seccion, duracion, esConclusion, esIntroduccion, ideaCentral, pasajeLabel, tipoInfo, tituloDe } from './taller';

export type Rol = 'introduccion' | 'punto' | 'conclusion' | 'parte';

export type ParteDoc = {
  id: string;
  rol: Rol;
  /** «Introducción», «Punto 2», «Conclusión» o «Parte 3». */
  etiqueta: string;
  titulo: string;
  /** Lo escrito, en párrafos. */
  parrafos: string[];
  /** Los puntos para hablar, uno por línea. */
  claves: string[];
  /** Solo encuentros: lo que ve el grupo. */
  paraGrupo: string[];
  dinamica?: string;
  responsable?: string;
  apoyo?: { cita: string; porque: string };
  minutos: number;
};

export type Documento = {
  tipo: string;
  titulo: string;
  pasaje: string;
  idea: string;
  necesidad: string;
  gracia: string;
  partes: ParteDoc[];
  anuncios: string[];
  minutos: number;
  terminado?: string;
  ocasiones: Ocasion[];
};

const lineas = (s?: string) =>
  (s ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);

const parrafos = (s?: string) =>
  (s ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Introducción y conclusión por su nombre; en un sermón, lo de en medio son los puntos. */
function rolDe(m: Mensaje, s: Seccion): Rol {
  if (esIntroduccion(s)) return 'introduccion';
  if (esConclusion(s)) return 'conclusion';
  return m.tipo === 'sermon' ? 'punto' : 'parte';
}

export function documentoDe(m: Mensaje, books: Book[]): Documento {
  let punto = 0;
  let parte = 0;
  const partes = m.secciones.map((s): ParteDoc => {
    const rol = rolDe(m, s);
    const etiqueta =
      rol === 'introduccion' ? 'Introducción' : rol === 'conclusion' ? 'Conclusión' : rol === 'punto' ? `Punto ${++punto}` : `Parte ${++parte}`;
    return {
      id: s.id,
      rol,
      etiqueta,
      // «Punto 1» como título no dice nada más que la etiqueta.
      titulo: s.titulo.trim() && s.titulo.trim().toLowerCase() !== etiqueta.toLowerCase() ? s.titulo.trim() : '',
      parrafos: parrafos(s.texto),
      claves: lineas(s.claves),
      paraGrupo: parrafos(s.paraGrupo),
      dinamica: dinamica(s.dinamica)?.nombre,
      responsable: s.responsable?.trim() || undefined,
      apoyo: s.apoyo,
      minutos: s.minutos,
    };
  });
  const pasaje = pasajeLabel(m.pasaje, books);
  return {
    tipo: tipoInfo(m.tipo).nombre,
    titulo: tituloDe(m, books),
    pasaje: pasaje && pasaje !== tituloDe(m, books) ? pasaje : '',
    idea: ideaCentral(m),
    necesidad: m.necesidad.trim(),
    gracia: m.gracia.trim(),
    partes,
    anuncios: lineas(m.anuncios),
    minutos: m.tipo === 'encuentro' ? duracion(m) : m.minutos,
    terminado: m.terminado,
    ocasiones: m.ocasiones ?? [],
  };
}

export type Falta = { id: string; texto: string; accion?: 'introduccion' | 'conclusion' };

/** Lo que le falta al documento antes de darlo por terminado. Es una guía, no impide terminar. */
export function faltantes(m: Mensaje): Falta[] {
  const out: Falta[] = [];
  if (!m.tema.trim() || !m.complemento.trim()) out.push({ id: 'idea', texto: 'La idea central en una frase (tema y complemento)' });
  if (m.tipo !== 'encuentro') {
    if (!m.secciones.some(esIntroduccion) && m.plantilla === 'expositiva') out.push({ id: 'intro', texto: 'Una introducción', accion: 'introduccion' });
    if (!m.secciones.some(esConclusion) && m.plantilla === 'expositiva') out.push({ id: 'concl', texto: 'Una conclusión', accion: 'conclusion' });
  }
  const vacias = m.secciones.filter((s) => !s.texto.trim() && !s.claves?.trim() && !s.paraGrupo?.trim());
  if (vacias.length) out.push({ id: 'vacias', texto: `Escribir ${vacias.length === 1 ? `«${vacias[0].titulo}»` : `${vacias.length} partes que siguen vacías`}` });
  if (m.tipo !== 'encuentro' && !m.secciones.some((s) => s.claves?.trim())) out.push({ id: 'claves', texto: 'Puntos para hablar en alguna parte (te orientan al predicar)' });
  return out;
}

/** Las estructuras que no traen introducción o conclusión por nombre, para ofrecer añadirlas. */
export function extremosQueFaltan(m: Mensaje): ('introduccion' | 'conclusion')[] {
  if (m.tipo === 'encuentro') return [];
  const out: ('introduccion' | 'conclusion')[] = [];
  if (!m.secciones.some(esIntroduccion)) out.push('introduccion');
  if (!m.secciones.some(esConclusion)) out.push('conclusion');
  return out;
}

export const fechaLarga = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

// Texto, para compartir o copiar

export function documentoTexto(d: Documento) {
  const out = [d.titulo.toUpperCase()];
  if (d.pasaje) out.push(d.pasaje);
  if (d.idea) out.push('', `Idea central: ${d.idea}`);
  if (d.necesidad) out.push(`La necesidad: ${d.necesidad}`);
  if (d.gracia) out.push(`La gracia: ${d.gracia}`);
  for (const p of d.partes) {
    out.push('', `*${p.etiqueta}${p.titulo ? `: ${p.titulo}` : ''}*`);
    if (p.dinamica) out.push(`Dinámica: ${p.dinamica}`);
    if (p.apoyo) out.push(`Pasaje de apoyo: ${p.apoyo.cita}`);
    out.push(...p.paraGrupo, ...p.parrafos);
    if (p.claves.length) out.push('Para hablar:', ...p.claves.map((c) => `• ${c}`));
  }
  if (d.anuncios.length) out.push('', '*Anuncios*', ...d.anuncios.map((a) => `• ${a}`));
  return out.join('\n');
}

// HTML, para imprimir, guardar en PDF o abrir en Word

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function documentoHtml(d: Documento) {
  const parte = (p: ParteDoc) => `
    <section class="parte ${p.rol}">
      <div class="etiqueta">${esc(p.etiqueta)}${p.minutos ? ` <span>· ${p.minutos} min</span>` : ''}</div>
      ${p.titulo ? `<h2>${esc(p.titulo)}</h2>` : ''}
      ${p.dinamica ? `<p class="nota">Dinámica: ${esc(p.dinamica)}${p.responsable ? ` · guía ${esc(p.responsable)}` : ''}</p>` : ''}
      ${p.apoyo ? `<p class="apoyo"><b>${esc(p.apoyo.cita)}</b>${p.apoyo.porque ? ` · ${esc(p.apoyo.porque)}` : ''}</p>` : ''}
      ${p.paraGrupo.map((x) => `<p class="grupo">${esc(x)}</p>`).join('')}
      ${p.parrafos.map((x) => `<p>${esc(x)}</p>`).join('')}
      ${p.claves.length ? `<div class="claves"><div class="mini">Para hablar</div><ul>${p.claves.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    </section>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(d.titulo)}</title>
<style>
  @page { margin: 2cm 2.2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1C1B19; line-height: 1.55; font-size: 12pt; max-width: 17cm; margin: 0 auto; }
  .tipo, .etiqueta, .mini { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; text-transform: uppercase; letter-spacing: .08em; font-size: 8.5pt; font-weight: 700; color: #6A6660; }
  .etiqueta span { font-weight: 400; }
  h1 { font-size: 24pt; line-height: 1.15; margin: 4pt 0 2pt; }
  .pasaje { color: #6A6660; margin: 0 0 14pt; }
  .idea { border-left: 3pt solid #A8641F; background: #F5E9D8; padding: 10pt 14pt; margin: 14pt 0; font-size: 14pt; font-style: italic; }
  .camino p { margin: 4pt 0; }
  .parte { margin-top: 18pt; break-inside: avoid-page; }
  .parte.introduccion .etiqueta, .parte.conclusion .etiqueta { color: #A8641F; }
  h2 { font-size: 15pt; margin: 2pt 0 6pt; }
  .apoyo, .nota { font-size: 10.5pt; color: #6A6660; margin: 4pt 0; }
  .grupo { border: 1px solid #E3E0DB; border-radius: 6pt; padding: 6pt 10pt; }
  .claves { border-top: 1px solid #E3E0DB; margin-top: 8pt; padding-top: 6pt; }
  .claves ul { margin: 4pt 0 0; padding-left: 16pt; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 11pt; }
  .anuncios { margin-top: 24pt; border-top: 2px solid #1C1B19; padding-top: 10pt; break-inside: avoid-page; }
  .anuncios ul { padding-left: 16pt; }
  footer { margin-top: 28pt; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 8.5pt; color: #6A6660; }
</style></head><body>
  <div class="tipo">${esc(d.tipo)}${d.minutos ? ` · ${d.minutos} min` : ''}</div>
  <h1>${esc(d.titulo)}</h1>
  ${d.pasaje ? `<p class="pasaje">${esc(d.pasaje)}</p>` : ''}
  ${d.idea ? `<div class="idea">${esc(d.idea)}</div>` : ''}
  ${d.necesidad || d.gracia ? `<div class="camino">${d.necesidad ? `<p><b>La necesidad.</b> ${esc(d.necesidad)}</p>` : ''}${d.gracia ? `<p><b>La gracia.</b> ${esc(d.gracia)}</p>` : ''}</div>` : ''}
  ${d.partes.map(parte).join('')}
  ${d.anuncios.length ? `<section class="anuncios"><div class="etiqueta">Anuncios</div><ul>${d.anuncios.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}
  <footer>${d.terminado ? `Terminado el ${esc(fechaLarga(d.terminado))} · ` : ''}Preparado en el Taller de Zarza</footer>
</body></html>`;
}

const nombreArchivo = (d: Documento) =>
  (d.titulo || 'mensaje')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'mensaje';

export const puedeImprimir = Platform.OS === 'web' && typeof window !== 'undefined';

/** Abre el diálogo de imprimir del navegador con el documento (desde ahí también se guarda en PDF). */
export function imprimir(d: Documento) {
  if (!puedeImprimir) return;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(documentoHtml(d));
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

/** Descarga el documento como .doc (HTML que Word y Google Docs abren con su formato). */
export function descargarWord(d: Documento) {
  if (!puedeImprimir) return;
  const blob = new Blob(['﻿', documentoHtml(d)], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo(d)}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
