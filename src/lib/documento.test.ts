import { describe, expect, it } from 'vitest';

import { BOOKS } from '../../tests/fixtures/books';
import { documentoDe, documentoHtml, documentoTexto, extremosQueFaltan, faltantes } from './documento';
import { Mensaje, Seccion, agregarSugerencia, destinosDe } from './taller';

const seccion = (patch: Partial<Seccion>): Seccion => ({ id: patch.titulo ?? 's', titulo: 'Parte', ayuda: '', texto: '', minutos: 5, ...patch });

const sermon = (patch: Partial<Mensaje> = {}): Mensaje => ({
  id: 'm',
  tipo: 'sermon',
  titulo: 'El Padre que corre',
  pasaje: { book: 'luk', chapter: 15, from: 11, to: 32 },
  plantilla: 'expositiva',
  observacion: '',
  tema: 'El amor del Padre',
  complemento: 'sale a buscarnos antes de que lleguemos',
  necesidad: 'Creemos que tenemos que ganarnos el regreso',
  gracia: '',
  secciones: [
    seccion({ id: 'i', titulo: 'Introducción: la necesidad', texto: 'Todos hemos querido volver a casa.' }),
    seccion({ id: 'p1', titulo: 'Punto 1', texto: 'El hijo se va.\n\nPide la herencia.', claves: '- La herencia en vida era desearle la muerte\nLejos de casa' }),
    seccion({ id: 'p2', titulo: 'El Padre lo ve de lejos', texto: '' }),
    seccion({ id: 'c', titulo: 'Conclusión', texto: 'Vuelve: él ya está corriendo.' }),
  ],
  revision: [],
  seguimiento: '',
  minutos: 30,
  creado: '2026-10-20T10:00:00.000Z',
  actualizado: '2026-10-20T10:00:00.000Z',
  anuncios: 'Célula el jueves\n\nBautismos el domingo',
  ...patch,
});

describe('documentoDe', () => {
  it('ordena introducción, puntos numerados y conclusión con lo escrito, sin inventar nada', () => {
    const d = documentoDe(sermon(), BOOKS);
    expect(d.titulo).toBe('El Padre que corre');
    expect(d.pasaje).toBe('Lucas 15:11-32');
    expect(d.idea).toBe('El amor del Padre: sale a buscarnos antes de que lleguemos');
    expect(d.partes.map((p) => [p.rol, p.etiqueta, p.titulo])).toEqual([
      ['introduccion', 'Introducción', 'Introducción: la necesidad'],
      ['punto', 'Punto 1', ''],
      ['punto', 'Punto 2', 'El Padre lo ve de lejos'],
      ['conclusion', 'Conclusión', ''],
    ]);
    expect(d.partes[1].parrafos).toEqual(['El hijo se va.', 'Pide la herencia.']);
    expect(d.partes[1].claves).toEqual(['La herencia en vida era desearle la muerte', 'Lejos de casa']);
    expect(d.partes[2].parrafos).toEqual([]);
    expect(d.anuncios).toEqual(['Célula el jueves', 'Bautismos el domingo']);
  });

  it('en una reflexión las partes no se llaman puntos', () => {
    const d = documentoDe(sermon({ tipo: 'reflexion', plantilla: 'oia', secciones: [seccion({ titulo: 'El versículo' })] }), BOOKS);
    expect(d.partes[0]).toMatchObject({ rol: 'parte', etiqueta: 'Parte 1', titulo: 'El versículo' });
  });
});

describe('faltantes', () => {
  it('pide lo que falta: partes vacías e introducción quitada', () => {
    const m = sermon({ secciones: sermon().secciones.filter((s) => s.id !== 'i') });
    const ids = faltantes(m).map((f) => f.id);
    expect(ids).toContain('intro');
    expect(ids).toContain('vacias');
    expect(ids).not.toContain('claves');
    expect(faltantes(m).find((f) => f.id === 'vacias')?.texto).toBe('Escribir «El Padre lo ve de lejos»');
  });

  it('ofrece introducción y conclusión a las estructuras que no las traen, nunca a un encuentro', () => {
    const yo = sermon({ plantilla: 'yo-nosotros', secciones: [seccion({ titulo: 'Yo' }), seccion({ titulo: 'Dios' })] });
    expect(extremosQueFaltan(yo)).toEqual(['introduccion', 'conclusion']);
    expect(extremosQueFaltan(sermon())).toEqual([]);
    expect(extremosQueFaltan(sermon({ tipo: 'encuentro' }))).toEqual([]);
  });
});

describe('exportar', () => {
  it('el texto y el HTML llevan todo, con los anuncios al final y el HTML escapado', () => {
    const d = documentoDe(sermon({ titulo: 'Padre <y> "hijo"' }), BOOKS);
    const t = documentoTexto(d);
    expect(t.indexOf('*Introducción')).toBeLessThan(t.indexOf('*Punto 1*'));
    expect(t).toContain('Para hablar:\n• La herencia en vida era desearle la muerte');
    expect(t.trim().endsWith('• Bautismos el domingo')).toBe(true);
    const html = documentoHtml(d);
    expect(html).toContain('<title>Padre &lt;y&gt; &quot;hijo&quot;</title>');
    expect(html).toContain('<li>Lejos de casa</li>');
    expect(html.indexOf('class="anuncios"')).toBeGreaterThan(html.indexOf('Conclusión'));
  });
});

describe('puntos para hablar como destino de las sugerencias', () => {
  it('una sugerencia se añade a los puntos para hablar de una parte', () => {
    const m = sermon();
    expect(destinosDe(m).some((x) => x.id === 'claves:p2')).toBe(true);
    const r = agregarSugerencia(m, 'claves:p1', { seccion: 'Punto 1', texto: 'El padre corre: en esa cultura era indigno' });
    expect(r?.cambio.secciones?.find((s) => s.id === 'p1')?.claves).toBe(
      '- La herencia en vida era desearle la muerte\nLejos de casa\nEl padre corre: en esa cultura era indigno',
    );
  });
});
