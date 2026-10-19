// /api/comunidades contra un Postgres de verdad (DATABASE_URL). Ver tests/api/helpers.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { planById } from '../../src/lib/planesCatalogo';
import { nextSeason } from '../../src/lib/temporadas';
import { client, DATA_DIR, DB_URL, ensureSchema, HAS_DATA, Post, prepareEnv, request, unique } from './helpers';

const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = local(new Date());
const daysAgo = (n: number) => local(new Date(Date.now() - n * 86_400_000));

const verse = (version: string, book: string, chapter: number, n: number) =>
  (JSON.parse(readFileSync(path.join(DATA_DIR, 'text', version, book, `${chapter}.json`), 'utf8')) as [number, string][]).find(
    ([v]) => v === n,
  )![1];

let POST: Post;
let aiRequests: unknown[];
let call: ReturnType<typeof client>;

beforeAll(async () => {
  ({ requests: aiRequests } = await prepareEnv({ ai: true }));
  ({ POST } = await import('../../api/comunidades'));
  call = client(POST, HOY);
  if (DB_URL) await ensureSchema(POST);
});

/** Crea una cuenta sin correo y devuelve su llave e id. */
async function persona(name: string) {
  const { nombre } = unique(name);
  const r = await call<{ llave: string; usuario: { id: string; nombre: string } }>('registrarse', { nombre });
  expect(r.status).toBe(200);
  return { llave: r.json.llave, id: r.json.usuario.id, nombre };
}

async function amigos(a: { llave: string }, b: { id: string; llave: string }) {
  await call('pedirAmistad', { usuario: b.id }, a.llave);
  const r = await call('pedirAmistad', { usuario: (await call('yo', {}, a.llave)).json.usuario.id }, b.llave);
  expect(r.json.relacion).toBe('amigos');
}

describe('/api/comunidades: peticiones mal formadas', () => {
  it('JSON roto y acciones que no existen (tampoco las heredadas de Object)', async () => {
    expect((await POST(request('/api/comunidades', '{roto'))).status).toBe(400);
    for (const accion of ['noExiste', 'constructor', 'toString', '__proto__', 42]) {
      const res = await POST(request('/api/comunidades', { accion }));
      expect(res.status, String(accion)).toBe(400);
      expect(await res.json()).toEqual({ error: 'Acción no válida' });
    }
  });

  it.skipIf(!!DB_URL)('sin base de datos responde 503', async () => {
    const r = await call('registrarse', { nombre: 'Ana' });
    expect(r.status).toBe(503);
  });
});

describe.skipIf(!DB_URL || !HAS_DATA)('/api/comunidades con Postgres', () => {
  describe('cuentas', () => {
    it('registrarse solo con nombre da una llave que sirve para «yo»', async () => {
      const ana = await persona('Ana');
      const yo = await call('yo', {}, ana.llave);
      expect(yo.status).toBe(200);
      expect(yo.json).toEqual({
        usuario: { id: ana.id, nombre: ana.nombre, correo: null, foto: null, bio: null, iglesia: null, ciudad: null, conClave: false, facebook: null },
        grupos: [],
      });
    });

    it('valida nombre, correo y contraseña', async () => {
      expect((await call('registrarse', { nombre: '   ' })).json.error).toBe('Escribe tu nombre');
      expect((await call('registrarse', { nombre: 'x'.repeat(41) })).json.error).toBe('Es demasiado largo (máximo 40 caracteres)');
      expect((await call('registrarse', { nombre: 'Ana', correo: 'no-es-correo', clave: '12345678' })).json.error).toBe('Escribe un correo válido');
      const corta = await call('registrarse', { nombre: 'Ana', correo: unique('ana').correo, clave: '1234567' });
      expect(corta).toEqual({ status: 400, json: { error: 'La contraseña necesita al menos 8 caracteres' } });
    });

    it('con correo y contraseña: un solo registro por correo y entrar desde otro dispositivo', async () => {
      const { nombre, correo } = unique('Beto');
      const reg = await call('registrarse', { nombre, correo, clave: 'clave-segura' });
      expect(reg.json.usuario).toMatchObject({ nombre, correo });
      expect((await call('registrarse', { nombre, correo: correo.toUpperCase(), clave: 'otra-clave' })).status).toBe(409);

      const entrar = await call('entrar', { correo: `  ${correo.toUpperCase()} `, clave: 'clave-segura' });
      expect(entrar.status).toBe(200);
      expect(entrar.json.usuario.id).toBe(reg.json.usuario.id);
      expect(entrar.json.llave).not.toBe(reg.json.llave);

      const mala = await call('entrar', { correo, clave: 'clave-incorrecta' });
      const nadie = await call('entrar', { correo: unique('nadie').correo, clave: 'clave-segura' });
      // El mismo mensaje en los dos casos: no revela qué correos tienen cuenta
      expect(mala).toEqual({ status: 401, json: { error: 'El correo o la contraseña no son correctos' } });
      expect(nadie).toEqual(mala);
    });

    it('protegerCuenta añade correo y contraseña a una cuenta que solo tenía nombre', async () => {
      const ana = await persona('Ana');
      const { correo } = unique('ana');
      const r = await call('protegerCuenta', { correo, clave: 'clave-segura' }, ana.llave);
      expect(r.json.usuario).toMatchObject({ id: ana.id, nombre: ana.nombre, correo, conClave: true });
      expect((await call('entrar', { correo, clave: 'clave-segura' })).json.usuario.id).toBe(ana.id);
      // Otra persona no puede quedarse con ese correo
      const otra = await persona('Otra');
      expect((await call('protegerCuenta', { correo, clave: 'clave-segura' }, otra.llave)).status).toBe(409);
    });

    it('sin sesión, con una llave inventada o después de salir: 401', async () => {
      expect(await call('yo')).toEqual({ status: 401, json: { error: 'Necesitas una cuenta' } });
      expect(await call('yo', {}, 'inventada')).toEqual({ status: 401, json: { error: 'Tu sesión terminó. Vuelve a entrar.' } });
      const ana = await persona('Ana');
      await call('salirCuenta', {}, ana.llave);
      expect((await call('yo', {}, ana.llave)).status).toBe(401);
    });

    it('renombrarme y una fecha «hoy» mal escrita', async () => {
      const ana = await persona('Ana');
      expect((await call('renombrarme', { nombre: '  Ana María ' }, ana.llave)).json.usuario.nombre).toBe('Ana María');
      expect((await call('yo', {}, ana.llave)).json.usuario.nombre).toBe('Ana María');
      expect((await call('yo', { hoy: '18/10/2026' }, ana.llave)).json).toEqual({ error: 'Fecha no válida' });
    });
  });

  describe('amistades', () => {
    it('pedir por código, aceptar y ver la relación desde los dos lados', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const { codigo } = (await call('amigos', {}, ana.llave)).json;
      expect(codigo).toMatch(/^[A-Z2-9]{8}$/);
      expect((await call('amigos', {}, ana.llave)).json.codigo).toBe(codigo); // no cambia

      // El código se acepta en minúsculas y con guiones
      const escrito = `${codigo.slice(0, 4).toLowerCase()}-${codigo.slice(4)}`;
      expect((await call('verCodigoAmigo', { codigo: escrito })).json.persona).toEqual({ id: ana.id, nombre: ana.nombre, foto: null });
      expect((await call('pedirAmistad', { codigo: escrito }, beto.llave)).json).toEqual({ id: ana.id, relacion: 'enviada' });
      expect((await call('pedirAmistad', { codigo }, ana.llave)).json.error).toBe('Ese es tu propio código');

      let red = (await call('amigos', {}, ana.llave)).json;
      expect(red.recibidas).toEqual([{ id: beto.id, nombre: beto.nombre, foto: null }]);
      expect((await call('persona', { usuario: ana.id }, beto.llave)).json.persona.relacion).toBe('enviada');

      expect((await call('responderAmistad', { usuario: beto.id }, ana.llave)).json.relacion).toBe('amigos');
      red = (await call('amigos', {}, ana.llave)).json;
      expect(red).toMatchObject({ amigos: [{ id: beto.id, nombre: beto.nombre }], recibidas: [], enviadas: [] });
      expect((await call('persona', { usuario: beto.id }, ana.llave)).json.persona).toMatchObject({ relacion: 'amigos', amigos: 1 });

      await call('quitarAmigo', { usuario: ana.id }, beto.llave);
      expect((await call('amigos', {}, ana.llave)).json.amigos).toEqual([]);
    });

    it('si los dos se piden amistad, queda aceptada; rechazar borra la solicitud', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      await amigos(ana, beto);

      const carla = await persona('Carla');
      await call('pedirAmistad', { usuario: ana.id }, carla.llave);
      expect((await call('responderAmistad', { usuario: carla.id, aceptar: false }, ana.llave)).json.relacion).toBeNull();
      expect((await call('amigos', {}, carla.llave)).json.enviadas).toEqual([]);
    });

    it('códigos y personas que no existen', async () => {
      const ana = await persona('Ana');
      expect((await call('verCodigoAmigo', { codigo: 'ZZZZZZZZ' })).status).toBe(404);
      expect((await call('pedirAmistad', { usuario: '00000000-0000-0000-0000-000000000000' }, ana.llave)).status).toBe(404);
      expect((await call('pedirAmistad', { usuario: 'no-es-uuid' }, ana.llave)).json.error).toBe('Identificador no válido');
    });
  });

  describe('publicaciones', () => {
    it('«amigos» solo la ven los amigos; «todos» la ve cualquiera en el muro público', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const extra = await persona('Extraño');
      await amigos(ana, beto);

      const privada = (await call('publicar', { tipo: 'reflexion', audiencia: 'amigos', texto: 'Para mis amigos' }, ana.llave)).json.id;
      await new Promise((r) => setTimeout(r, 5)); // «antes» se compara en milisegundos: que no caigan en el mismo
      const publica = (await call('publicar', { tipo: 'pregunta', audiencia: 'todos', texto: '¿Qué significa nacer de nuevo?' }, ana.llave)).json.id;
      const ids = (r: { json: { publicaciones: { id: string }[] } }) => r.json.publicaciones.map((p) => p.id).filter((id) => [privada, publica].includes(id));

      expect(ids(await call('muro', { filtro: 'amigos' }, ana.llave))).toEqual([publica, privada]);
      expect(ids(await call('muro', { filtro: 'amigos' }, beto.llave))).toEqual([publica, privada]);
      expect(ids(await call('muro', { filtro: 'amigos' }, extra.llave))).toEqual([]);
      expect(ids(await call('muro', { filtro: 'todos' }, extra.llave))).toEqual([publica]);

      expect((await call('publicacion', { id: privada }, extra.llave)).status).toBe(404);
      expect((await call('meGusta', { id: privada }, extra.llave)).status).toBe(404);
      expect((await call('comentar', { id: privada, texto: 'hola' }, extra.llave)).status).toBe(404);
      const vista = (await call('publicacion', { id: privada }, beto.llave)).json.publicacion;
      expect(vista).toMatchObject({ autor: ana.nombre, mia: false, texto: 'Para mis amigos', audiencia: 'amigos' });

      // Paginación: «antes» de la más reciente deja fuera la pública
      const antes = (await call('publicacion', { id: publica }, ana.llave)).json.publicacion.actualizado;
      expect(ids(await call('muro', { filtro: 'amigos', antes }, beto.llave))).toEqual([privada]);

      // Solo quien publicó puede borrar
      await call('borrarPublicacion', { id: privada }, beto.llave);
      expect((await call('publicacion', { id: privada }, ana.llave)).status).toBe(200);
      await call('borrarPublicacion', { id: privada }, ana.llave);
      expect((await call('publicacion', { id: privada }, ana.llave)).status).toBe(404);
    });

    it('el texto del versículo lo pone el servidor, en la versión pedida', async () => {
      const ana = await persona('Ana');
      const id = (
        await call('publicar', { tipo: 'resaltado', libro: 'jhn', capitulo: 3, versiculo: 16, version: 'bes', datos: { color: 'neón' }, cita: 'texto falso' }, ana.llave)
      ).json.id;
      const p = (await call('publicacion', { id }, ana.llave)).json.publicacion;
      expect(p).toMatchObject({ tipo: 'resaltado', libroNombre: 'Juan', capitulo: 3, versiculo: 16, version: 'BES', texto: null, datos: { color: 'amarillo' } });
      expect(p.cita).toBe(verse('bes', 'jhn', 3, 16));

      // Versión desconocida: RV1909
      const otra = (await call('publicar', { tipo: 'imagen', libro: 'jhn', capitulo: 3, versiculo: 16, version: 'xyz', datos: { formato: 'historia' } }, ana.llave)).json.id;
      const img = (await call('publicacion', { id: otra }, ana.llave)).json.publicacion;
      expect(img).toMatchObject({ version: 'RV1909', datos: { estilo: '', formato: 'historia' } });
      expect(img.cita).toBe(verse('rv1909', 'jhn', 3, 16));
    });

    it('valida tipo, texto, libro, capítulo y versículo', async () => {
      const ana = await persona('Ana');
      const err = async (body: Record<string, unknown>) => (await call('publicar', body, ana.llave)).json.error;
      expect(await err({ tipo: 'lectura', texto: 'x' })).toBe('Tipo de publicación no válido');
      expect(await err({ tipo: 'reflexion', texto: '  ' })).toBe('Escribe lo que quieres compartir');
      expect(await err({ tipo: 'pregunta' })).toBe('Escribe tu pregunta');
      expect(await err({ tipo: 'reflexion', texto: 'x'.repeat(1001) })).toBe('Es demasiado largo (máximo 1000 caracteres)');
      expect(await err({ tipo: 'resaltado' })).toBe('Libro no válido');
      expect(await err({ tipo: 'resaltado', libro: 'jhn', capitulo: 22, versiculo: 1 })).toBe('Capítulo no válido');
      expect(await err({ tipo: 'resaltado', libro: 'jhn', capitulo: 3, versiculo: 99 })).toBe('Versículo no válido');
    });

    it('«me gusta» una sola vez por persona, y se puede quitar', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      await amigos(ana, beto);
      const id = (await call('publicar', { tipo: 'reflexion', texto: 'Gracias' }, ana.llave)).json.id;
      await call('meGusta', { id }, beto.llave);
      await call('meGusta', { id, si: true }, beto.llave);
      expect((await call('publicacion', { id }, beto.llave)).json.publicacion).toMatchObject({ meGusta: 1, yoMeGusta: true });
      expect((await call('publicacion', { id }, ana.llave)).json.publicacion).toMatchObject({ meGusta: 1, yoMeGusta: false });
      await call('meGusta', { id, si: false }, beto.llave);
      expect((await call('publicacion', { id }, ana.llave)).json.publicacion.meGusta).toBe(0);
    });

    it('comentarios: cada quien borra los suyos y quien publicó, los de su publicación', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const carla = await persona('Carla');
      await amigos(ana, beto);
      await amigos(ana, carla);
      const id = (await call('publicar', { tipo: 'pregunta', texto: '¿Cómo oran ustedes?' }, ana.llave)).json.id;
      const c1 = (await call('comentar', { id, texto: '  En la mañana  ' }, beto.llave)).json.id;
      const c2 = (await call('comentar', { id, texto: 'Con un salmo' }, carla.llave)).json.id;
      expect((await call('comentar', { id, texto: ' ' }, beto.llave)).json.error).toBe('Escribe tu comentario');

      let r = (await call('publicacion', { id }, beto.llave)).json;
      expect(r.publicacion.comentarios).toBe(2);
      expect(r.comentarios.map((c: { texto: string; mio: boolean }) => [c.texto, c.mio])).toEqual([
        ['En la mañana', true],
        ['Con un salmo', false],
      ]);

      await call('borrarComentario', { id: c2 }, beto.llave); // no es suyo: no pasa nada
      await call('borrarComentario', { id: c1 }, beto.llave);
      expect((await call('publicacion', { id }, ana.llave)).json.comentarios.map((c: { id: string }) => c.id)).toEqual([c2]);
      await call('borrarComentario', { id: c2 }, ana.llave);
      expect((await call('publicacion', { id }, ana.llave)).json.comentarios).toEqual([]);
    });

    it('con 3 reportes una publicación pública deja de verse para los demás, no para sus amigos', async () => {
      const ana = await persona('Ana');
      const amiga = await persona('Amiga');
      await amigos(ana, amiga);
      const id = (await call('publicar', { tipo: 'reflexion', audiencia: 'todos', texto: 'Algo polémico' }, ana.llave)).json.id;
      expect((await call('reportar', { id }, ana.llave)).json.error).toBe('No puedes reportar tu propia publicación');

      const visibleFor = async (llave: string) => (await call('publicacion', { id }, llave)).status === 200;
      const [r1, r2, r3, mirón] = await Promise.all(['R1', 'R2', 'R3', 'Mirón'].map(persona));
      await call('reportar', { id }, r1.llave);
      expect(await visibleFor(r1.llave)).toBe(false); // quien reporta deja de verla al instante
      expect(await visibleFor(mirón.llave)).toBe(true);
      await call('reportar', { id }, r1.llave); // repetir no suma
      await call('reportar', { id }, r2.llave);
      expect(await visibleFor(mirón.llave)).toBe(true);
      await call('reportar', { id }, r3.llave);
      expect(await visibleFor(mirón.llave)).toBe(false);
      const muro = (await call('muro', { filtro: 'todos' }, mirón.llave)).json.publicaciones.map((p: { id: string }) => p.id);
      expect(muro).not.toContain(id);
      expect(await visibleFor(amiga.llave)).toBe(true);
      expect(await visibleFor(ana.llave)).toBe(true);
    });

    it('lo que se lee hoy aparece en el muro de los amigos, una publicación por libro que suma capítulos', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      await amigos(ana, beto);
      await call('leido', { libro: 'rom', capitulo: 8 }, ana.llave);
      await call('leido', { libro: 'rom', capitulo: 1 }, ana.llave);
      await call('leido', { libro: 'rom', capitulo: 8 }, ana.llave);
      expect((await call('leido', { libro: 'rom', capitulo: 17 }, ana.llave)).json.error).toBe('Capítulo no válido');
      const lecturas = (await call('muro', { filtro: 'amigos' }, beto.llave)).json.publicaciones.filter(
        (p: { tipo: string; autorId: string }) => p.tipo === 'lectura' && p.autorId === ana.id,
      );
      expect(lecturas).toHaveLength(1);
      expect(lecturas[0]).toMatchObject({ libro: 'rom', libroNombre: 'Romanos', datos: { capitulos: [1, 8] }, audiencia: 'amigos' });

      // Con «compartir lecturas» apagado no se publica nada
      await call('compartirLecturas', { si: false }, beto.llave);
      await call('leido', { libro: 'gen', capitulo: 1 }, beto.llave);
      expect((await call('persona', { usuario: beto.id }, ana.llave)).json.publicaciones).toEqual([]);
      expect((await call('amigos', {}, beto.llave)).json.compartirLecturas).toBe(false);
    });
  });

  describe('grupos', () => {
    async function grupo(llave: string, plan?: Record<string, unknown>) {
      const { nombre } = unique('Célula');
      const r = await call('crearGrupo', { nombre, tipo: 'celula', plan }, llave);
      expect(r.status).toBe(200);
      const g = (await call('grupo', { grupo: r.json.id }, llave)).json.grupo;
      return { id: r.json.id as string, codigo: g.codigo as string, nombre };
    }

    it('crear con plan, invitar con el código, ver quién leyó y la meta de la semana', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const g = await grupo(ana.llave, { libro: 'jhn', inicio: HOY, porDia: 2 });

      expect((await call('verInvitacion', { codigo: g.codigo.toLowerCase() })).json.grupo).toEqual({ nombre: g.nombre, tipo: 'celula', miembros: 1 });
      expect((await call('grupo', { grupo: g.id }, beto.llave))).toEqual({ status: 403, json: { error: 'No perteneces a este grupo' } });
      expect((await call('unirse', { codigo: g.codigo.toLowerCase() }, beto.llave)).json.id).toBe(g.id);
      await call('unirse', { codigo: g.codigo }, beto.llave); // dos veces no duplica

      await call('leido', { libro: 'jhn', capitulo: 1 }, beto.llave);
      await call('leido', { libro: 'jhn', capitulo: 2 }, beto.llave);
      await call('leido', { libro: 'jhn', capitulo: 1 }, ana.llave); // le falta el 2

      const visto = (await call('grupo', { grupo: g.id }, ana.llave)).json.grupo;
      expect(visto).toMatchObject({
        tipo: 'celula',
        soyAdmin: true,
        plan: { libro: 'jhn', inicio: HOY, porDia: 2 },
        lectura: { libro: 'jhn', nombre: 'Juan', capitulos: [1, 2], estado: 'activo', dia: 1, total: 11 },
        semana: { dias: 2, meta: 10 },
      });
      expect(visto.miembros.map((m: Record<string, unknown>) => [m.id, m.rol, m.leyoHoy, m.soyYo])).toEqual([
        [ana.id, 'admin', false, true],
        [beto.id, 'miembro', true, false],
      ]);
      const resumen = (await call('yo', {}, beto.llave)).json.grupos;
      expect(resumen).toEqual([{ id: g.id, nombre: g.nombre, tipo: 'celula', miembros: 2, leyeronHoy: 1, lectura: visto.lectura }]);
    });

    it('el plan dice «pronto» antes de empezar y «terminado» después del último día', async () => {
      const ana = await persona('Ana');
      const futuro = await grupo(ana.llave, { libro: 'jhn', inicio: local(new Date(Date.now() + 3 * 86_400_000)) });
      expect((await call('grupo', { grupo: futuro.id }, ana.llave)).json.grupo.lectura).toMatchObject({ estado: 'pronto', capitulos: [], total: 21 });
      const pasado = await grupo(ana.llave, { libro: 'jhn', inicio: daysAgo(30), porDia: 1 });
      expect((await call('grupo', { grupo: pasado.id }, ana.llave)).json.grupo.lectura).toMatchObject({ estado: 'terminado', dia: 21 });
      const dia5 = await grupo(ana.llave, { libro: 'jhn', inicio: daysAgo(4), porDia: 3 });
      expect((await call('grupo', { grupo: dia5.id }, ana.llave)).json.grupo.lectura).toMatchObject({ capitulos: [13, 14, 15], dia: 5, total: 7 });
      const fin = await grupo(ana.llave, { libro: 'jhn', inicio: daysAgo(10), porDia: 2 });
      expect((await call('grupo', { grupo: fin.id }, ana.llave)).json.grupo.lectura).toMatchObject({ capitulos: [21], dia: 11 });

      expect((await call('crearGrupo', { nombre: 'X', plan: { libro: 'jhn', inicio: 'mañana' } }, ana.llave)).json.error).toBe('Fecha no válida');
      expect((await call('crearGrupo', { nombre: 'X', plan: { libro: 'jhn', inicio: HOY, porDia: 9 } }, ana.llave)).json.error).toBe('Ritmo no válido');
      expect((await call('crearGrupo', { nombre: 'X', plan: { libro: 'xyz', inicio: HOY } }, ana.llave)).json.error).toBe('Libro no válido');
    });

    it('un grupo puede seguir un reto de temporada: la lectura de cada fecha, el descanso y el final', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const adviento = nextSeason(planById('adviento')!)!;
      const y = adviento.year;
      const g = await grupo(ana.llave, { reto: `adviento-${y}` });
      await call('unirse', { codigo: g.codigo }, beto.llave);
      const ver = (hoy: string, llave = ana.llave) => call('grupo', { grupo: g.id, hoy }, llave).then((r) => r.json.grupo);

      expect((await ver(`${y}-11-20`)).plan).toMatchObject({ libro: null, inicio: `${y}-12-01`, reto: `adviento-${y}` });
      expect((await ver(`${y}-11-20`)).lectura).toMatchObject({ estado: 'pronto', capitulos: [], dia: 0, total: 25, libro: 'gen', siguiente: 3, reto: `adviento-${y}` });

      // Día 3: 2 Samuel 7. Beto ya lo leyó; cuenta aunque lo haya leído otro día
      await call('leido', { libro: '2sa', capitulo: 7, hoy: `${y}-12-02` }, beto.llave);
      const dia3 = await ver(`${y}-12-03`);
      expect(dia3.lectura).toEqual({ libro: '2sa', nombre: '2 Samuel', capitulos: [7], estado: 'activo', dia: 3, total: 25, reto: `adviento-${y}` });
      expect(dia3.miembros.map((m: { leyoHoy: boolean }) => m.leyoHoy)).toEqual([false, true]);
      expect((await call('yo', { hoy: `${y}-12-03` }, beto.llave)).json.grupos[0]).toMatchObject({ leyeronHoy: 1, lectura: dia3.lectura });

      expect((await ver(`${y}-12-26`)).lectura).toMatchObject({ estado: 'terminado', capitulos: [], dia: 25 });

      // En Cuaresma, el primer domingo (cuatro días después del Miércoles de Ceniza) es de descanso
      const cuaresma = nextSeason(planById('cuaresma')!)!;
      const c = await grupo(ana.llave, { reto: `cuaresma-${cuaresma.year}` });
      const domingo = local(new Date(new Date(`${cuaresma.start}T12:00:00`).getTime() + 4 * 86_400_000));
      expect(new Date(`${domingo}T12:00:00`).getDay()).toBe(0);
      expect((await call('grupo', { grupo: c.id, hoy: domingo }, ana.llave)).json.grupo.lectura).toMatchObject({
        estado: 'descanso',
        capitulos: [],
        dia: 4,
        libro: 'mat',
        siguiente: 5,
      });

      // Cambiar el reto por un libro lo quita
      await call('editarGrupo', { grupo: g.id, nombre: g.nombre, tipo: 'celula', plan: { libro: 'jhn', inicio: HOY } }, ana.llave);
      expect((await call('grupo', { grupo: g.id }, ana.llave)).json.grupo.plan).toEqual({ libro: 'jhn', inicio: HOY, porDia: 1, reto: null });

      expect((await call('crearGrupo', { nombre: 'X', plan: { reto: 'carnaval-2026' } }, ana.llave)).json.error).toBe('Reto no válido');
      expect((await call('crearGrupo', { nombre: 'X', plan: { reto: 'juan-2026' } }, ana.llave)).json.error).toBe('Reto no válido');
      expect((await call('crearGrupo', { nombre: 'X', plan: { reto: `adviento-${y + 5}` } }, ana.llave)).json.error).toBe('Reto no válido');
    });

    it('solo quien administra edita, cambia el código o quita a alguien', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const carla = await persona('Carla');
      const g = await grupo(ana.llave);
      await call('unirse', { codigo: g.codigo }, beto.llave);
      await call('unirse', { codigo: g.codigo }, carla.llave);

      expect((await call('editarGrupo', { grupo: g.id, nombre: 'Mío' }, beto.llave)).status).toBe(403);
      expect((await call('nuevoCodigo', { grupo: g.id }, beto.llave)).status).toBe(403);
      expect((await call('salir', { grupo: g.id, usuario: carla.id }, beto.llave)).status).toBe(403);

      await call('editarGrupo', { grupo: g.id, nombre: 'Familia Pérez', tipo: 'otro' }, ana.llave);
      expect((await call('grupo', { grupo: g.id }, beto.llave)).json.grupo).toMatchObject({ nombre: 'Familia Pérez', tipo: 'amigos' });

      const { codigo } = (await call('nuevoCodigo', { grupo: g.id }, ana.llave)).json;
      expect(codigo).not.toBe(g.codigo);
      expect((await call('verInvitacion', { codigo: g.codigo })).status).toBe(404);

      await call('salir', { grupo: g.id, usuario: carla.id }, ana.llave);
      expect((await call('grupo', { grupo: g.id }, carla.llave)).status).toBe(403);

      await call('hacerAdmin', { grupo: g.id, usuario: beto.id }, ana.llave);
      expect((await call('grupo', { grupo: g.id }, beto.llave)).json.grupo.soyAdmin).toBe(true);
    });

    it('si se va el último administrador pasa a serlo quien lleva más tiempo; sin nadie, el grupo se borra', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const carla = await persona('Carla');
      const g = await grupo(ana.llave);
      await call('unirse', { codigo: g.codigo }, beto.llave);
      await call('unirse', { codigo: g.codigo }, carla.llave);

      await call('salir', { grupo: g.id }, ana.llave);
      const visto = (await call('grupo', { grupo: g.id }, beto.llave)).json.grupo;
      expect(visto.soyAdmin).toBe(true);
      expect(visto.miembros.map((m: { id: string; rol: string }) => [m.id, m.rol])).toEqual([
        [beto.id, 'admin'],
        [carla.id, 'miembro'],
      ]);

      // Borrar la cuenta también sale de los grupos y pasa la administración
      await call('borrarCuenta', {}, beto.llave);
      expect((await call('yo', {}, beto.llave)).status).toBe(401);
      expect((await call('grupo', { grupo: g.id }, carla.llave)).json.grupo.soyAdmin).toBe(true);

      await call('salir', { grupo: g.id }, carla.llave);
      expect((await call('verInvitacion', { codigo: g.codigo })).status).toBe(404);
    });

    it('notas compartidas en un versículo', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const extra = await persona('Extraño');
      const g = await grupo(ana.llave);
      await call('unirse', { codigo: g.codigo }, beto.llave);

      const n1 = (await call('nuevaNota', { grupo: g.id, libro: 'jhn', capitulo: 3, versiculo: 16, texto: ' Amor ' }, ana.llave)).json.id;
      const n2 = (await call('nuevaNota', { grupo: g.id, libro: 'jhn', capitulo: 3, versiculo: 3, texto: 'Nacer' }, beto.llave)).json.id;
      await call('nuevaNota', { grupo: g.id, libro: 'rom', capitulo: 8, versiculo: 28, texto: 'Bien' }, beto.llave);
      expect((await call('nuevaNota', { grupo: g.id, libro: 'jhn', capitulo: 3, versiculo: 16, texto: 'x' }, extra.llave)).status).toBe(403);
      expect((await call('nuevaNota', { grupo: g.id, libro: 'jhn', capitulo: 3, versiculo: 16, texto: '' }, ana.llave)).json.error).toBe('Escribe la nota');

      const capitulo = (await call('notas', { grupo: g.id, libro: 'jhn', capitulo: 3 }, beto.llave)).json.notas;
      expect(capitulo.map((n: { id: string }) => n.id).sort()).toEqual([n1, n2].sort());
      const versiculo = (await call('notas', { libro: 'jhn', capitulo: 3, versiculo: 16 }, beto.llave)).json.notas;
      expect(versiculo).toHaveLength(1);
      expect(versiculo[0]).toMatchObject({ texto: 'Amor', autor: ana.nombre, mia: false, grupo: g.id, grupoNombre: g.nombre });
      expect((await call('notas', {}, beto.llave)).json.notas).toHaveLength(3);
      expect((await call('notas', {}, extra.llave)).json.notas).toEqual([]);

      expect((await call('borrarNota', { nota: n1 }, beto.llave)).status).toBe(403);
      await call('borrarNota', { nota: n2 }, ana.llave); // la administradora puede
      expect((await call('notas', { grupo: g.id, libro: 'jhn', capitulo: 3 }, ana.llave)).json.notas.map((n: { id: string }) => n.id)).toEqual([n1]);
    });

    it('peticiones de oración: orar una vez, marcarla respondida y borrarla', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const extra = await persona('Extraño');
      const g = await grupo(ana.llave);
      await call('unirse', { codigo: g.codigo }, beto.llave);

      const p1 = (await call('nuevaPeticion', { grupo: g.id, texto: 'Por mi mamá' }, beto.llave)).json.id;
      const p2 = (await call('nuevaPeticion', { grupo: g.id, texto: 'Por el trabajo' }, beto.llave)).json.id;
      await call('orar', { peticion: p1 }, ana.llave);
      await call('orar', { peticion: p1 }, ana.llave);
      expect((await call('orar', { peticion: p1 }, extra.llave)).status).toBe(403);

      let lista = (await call('peticiones', { grupo: g.id }, ana.llave)).json.peticiones;
      expect(lista.find((p: { id: string }) => p.id === p1)).toMatchObject({ orando: 1, yoOrando: true, mia: false, autor: beto.nombre });

      await call('orar', { peticion: p1, orando: false }, ana.llave);
      expect((await call('editarPeticion', { peticion: p2, respondida: true }, extra.llave)).status).toBe(403);
      await call('editarPeticion', { peticion: p2, respondida: true }, beto.llave);
      lista = (await call('peticiones', { grupo: g.id }, ana.llave)).json.peticiones;
      // Las respondidas van al final
      expect(lista.map((p: { id: string; respondida: boolean; orando: number }) => [p.id, p.respondida, p.orando])).toEqual([
        [p1, false, 0],
        [p2, true, 0],
      ]);

      await call('editarPeticion', { peticion: p1, borrar: true }, ana.llave); // la administradora puede
      expect((await call('peticiones', { grupo: g.id }, beto.llave)).json.peticiones.map((p: { id: string }) => p.id)).toEqual([p2]);
      expect((await call('orar', { peticion: p1 }, ana.llave)).status).toBe(404);
    });

    it('guías del Taller compartidas con el grupo', async () => {
      const ana = await persona('Ana');
      const beto = await persona('Beto');
      const g = await grupo(ana.llave);
      await call('unirse', { codigo: g.codigo }, beto.llave);
      const id = (await call('compartirGuia', { grupo: g.id, titulo: 'Nacer de nuevo', pasaje: 'Juan 3:1-8', texto: '## Conexión' }, ana.llave)).json.id;
      expect((await call('guias', { grupo: g.id }, beto.llave)).json.guias).toEqual([
        expect.objectContaining({ id, titulo: 'Nacer de nuevo', pasaje: 'Juan 3:1-8', texto: '## Conexión', mia: false }),
      ]);
      expect((await call('borrarGuia', { guia: id }, beto.llave)).status).toBe(403);
      await call('borrarGuia', { guia: id }, ana.llave);
      expect((await call('guias', { grupo: g.id }, beto.llave)).json.guias).toEqual([]);
    });

    it('preguntas para la reunión: la IA las sugiere una vez y quedan guardadas', async () => {
      const ana = await persona('Ana');
      const g = await grupo(ana.llave);
      const before = aiRequests.length;
      const r1 = await call('preguntas', { grupo: g.id, libro: 'jhn', capitulo: 3 }, ana.llave);
      expect(r1.json.texto).toContain('¿Qué nos enseña este pasaje sobre Dios?');
      expect(aiRequests.length).toBe(before + 1);
      // La IA recibió el texto real del capítulo
      const sent = JSON.stringify(aiRequests.at(-1));
      expect(sent).toContain('Pasaje para la reunión: Juan 3');
      expect(sent).toContain(verse('rv1909', 'jhn', 3, 16).slice(0, 30));

      expect((await call('preguntas', { grupo: g.id, libro: 'jhn', capitulo: 3 }, ana.llave)).json).toEqual(r1.json);
      expect(aiRequests.length).toBe(before + 1);
      await call('preguntas', { grupo: g.id, libro: 'jhn', capitulo: 3, nuevas: true }, ana.llave);
      expect(aiRequests.length).toBe(before + 2);
    });
  });
});
