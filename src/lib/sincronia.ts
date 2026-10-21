import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Lo que la persona guarda en el dispositivo (ajustes, lo leído, planes, notas, resaltados, diario, tarjetas,
// Taller…) se copia a su cuenta en /api/sincronizar y vuelve a cualquier otro dispositivo donde entre. Sin cuenta
// todo sigue igual que antes: solo en el dispositivo.
//
// Cada almacén se registra aquí con cómo partir su estado en entradas («jhn.3», una nota, un plan…) y cómo
// volver a unirlas. Al cambiar algo se compara cada entrada con la última copia sincronizada (por su huella) y
// se mandan solo las que cambiaron, con la hora del cambio; el servidor se queda con la más reciente de cada una
// y devuelve lo que otros dispositivos cambiaron desde la última vez. Borrar algo manda la entrada vacía.
//
// La primera vez que un dispositivo se une a la cuenta, lo que ya tenía se manda con su propia fecha (o con una
// muy antigua si no la tiene): así lo que ya está en la cuenta no se pisa con valores por defecto, y lo nuevo
// del dispositivo se suma.

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const META = 'sincronia';
/** Entradas por petición: el servidor acepta hasta 400. */
const LOTE = 300;
const ESPERA = 1500;

export type Entradas = Record<string, unknown>;

export type Almacen<S> = {
  /** Nombre en el servidor (ver ALMACENES en api/sincronizar.ts). */
  nombre: string;
  leer: () => Promise<S>;
  escribir: (estado: S) => void;
  partir: (estado: S) => Entradas;
  /** Vuelve a formar el estado con las entradas; `antes` sirve para conservar el orden que ya tenía. */
  unir: (entradas: Entradas, antes: S) => S;
  /** Fecha propia de una entrada (ms), para la primera vez que el dispositivo se une a la cuenta. */
  hora?: (valor: unknown) => number | undefined;
};

/** Por entrada: [huella, hora del cambio, 1 si falta mandarla]. Huella vacía = borrada. */
type Marca = [string, number, 0 | 1];
type Meta = { usuario: string | null; cursor: number; ultima: number | null; vistos: string[]; almacenes: Record<string, Record<string, Marca>> };

export type Estado = 'sin-cuenta' | 'al-dia' | 'guardando' | 'pendiente' | 'sin-conexion' | 'error';

const vacia = (usuario: string | null): Meta => ({ usuario, cursor: 0, ultima: null, vistos: [], almacenes: {} });

const almacenes = new Map<string, Almacen<unknown>>();
let meta: Meta = vacia(null);
let metaCargada: Promise<void> | null = null;
let cuenta: { llave: string; usuario: string } | null = null;
let estado: Estado = 'sin-cuenta';
let error: string | null = null;
let enCurso: Promise<void> | null = null;
let otraVez = false;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let reloj = 0;
const escuchas = new Set<() => void>();
const alUnirse = new Set<(traidas: number) => void>();

export function registrar<S>(almacen: Almacen<S>) {
  almacenes.set(almacen.nombre, almacen as Almacen<unknown>);
}

/** El estado de un almacén registrado (para las pruebas). */
export const leerAlmacen = (nombre: string) => almacenes.get(nombre)?.leer();

function avisar(patch: { estado?: Estado; error?: string | null }) {
  if (patch.estado) estado = patch.estado;
  if (patch.error !== undefined) error = patch.error;
  escuchas.forEach((l) => l());
}

function cargarMeta() {
  metaCargada ??= AsyncStorage.getItem(META)
    .then((raw) => {
      if (raw) meta = { ...vacia(null), ...JSON.parse(raw) };
    })
    .catch(() => {});
  return metaCargada;
}

const guardarMeta = () => AsyncStorage.setItem(META, JSON.stringify(meta)).catch(() => {});

/** Huella corta de una entrada (FNV-1a de 32 bits sobre su JSON). */
export function huella(valor: unknown) {
  const s = JSON.stringify(valor) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

/** Hora de un cambio: siempre mayor que la anterior, aunque dos cambios caigan en el mismo milisegundo. */
const ahora = () => (reloj = Math.max(Date.now(), reloj + 1));

/** La cuenta con la que se sincroniza (o null al salir). Lo llama SincroniaCuenta al entrar o salir. */
export async function conectar(llave: string | null, usuario: string | null) {
  await cargarMeta();
  if (!llave || !usuario) {
    cuenta = null;
    // Al salir, lo que quedó en el dispositivo se queda; la próxima cuenta empieza a unirse desde cero.
    if (meta.usuario) {
      meta = vacia(null);
      guardarMeta();
    }
    avisar({ estado: 'sin-cuenta', error: null });
    return;
  }
  cuenta = { llave, usuario };
  if (meta.usuario !== usuario) {
    meta = vacia(usuario);
    guardarMeta();
  }
  await sincronizar();
}

/** Un almacén cambió: se sincroniza poco después (varios cambios seguidos van juntos). */
export function cambio(_nombre?: string) {
  if (!cuenta) return;
  if (estado === 'al-dia') avisar({ estado: 'pendiente' });
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    sincronizar();
  }, ESPERA);
}

/** Sincroniza ahora. Si ya hay una ronda en curso, se hace otra al terminar. */
export function sincronizar(): Promise<void> {
  if (!cuenta) return Promise.resolve();
  if (enCurso) {
    otraVez = true;
    return enCurso;
  }
  enCurso = (async () => {
    do {
      otraVez = false;
      await ronda();
    } while (otraVez && cuenta);
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

type Fila = { a: string; k: string; v: unknown; t: number };

async function ronda() {
  await cargarMeta();
  const yo = cuenta;
  if (!yo) return;
  avisar({ estado: 'guardando' });
  const primeraVez = meta.ultima === null;
  let traidas = 0;
  try {
    for (;;) {
      if (cuenta !== yo) return;
      const { cambios, mandadas } = await pendientes();
      const res = await fetch(`${API}/api/sincronizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${yo.llave}` },
        body: JSON.stringify({ desde: meta.cursor, cambios }),
      }).catch(() => null);
      if (!res) return avisar({ estado: 'sin-conexion', error: null });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return avisar({ estado: res.status === 401 ? 'sin-cuenta' : 'error', error: json.error ?? `Algo falló (${res.status})` });
      if (cuenta !== yo) return;
      // Lo mandado ya está en la cuenta, salvo que haya vuelto a cambiar mientras viajaba.
      for (const [a, k, h] of mandadas) {
        const m = meta.almacenes[a]?.[k];
        if (m && m[0] === h) m[2] = 0;
      }
      traidas += await aplicar(json.filas as Fila[]);
      meta.cursor = json.cursor;
      guardarMeta();
      if (!json.mas && !hayPendientes()) break;
    }
    meta.vistos = [...almacenes.keys()];
    meta.ultima = Date.now();
    guardarMeta();
    avisar({ estado: hayPendientes() ? 'pendiente' : 'al-dia', error: null });
    if (primeraVez) alUnirse.forEach((l) => l(traidas));
  } catch (e) {
    console.error('sincronía', e);
    avisar({ estado: 'error', error: 'No se pudo guardar en tu cuenta.' });
  }
}

/** Estado actual de cada almacén, partido en entradas. */
const instantanea = new Map<string, { estado: unknown; entradas: Entradas }>();

/** Compara cada almacén con su última copia sincronizada y marca lo que cambió. */
function marcarCambios() {
  for (const [nombre, foto] of instantanea) {
    const almacen = almacenes.get(nombre)!;
    const marcas = (meta.almacenes[nombre] ??= {});
    const nuevo = !meta.vistos.includes(nombre);
    for (const [k, v] of Object.entries(foto.entradas)) {
      const h = huella(v);
      if (marcas[k]?.[0] === h) continue;
      marcas[k] = [h, nuevo && !marcas[k] ? (almacen.hora?.(v) ?? 1) : ahora(), 1];
    }
    for (const [k, m] of Object.entries(marcas)) if (!(k in foto.entradas) && m[0] !== '') marcas[k] = ['', ahora(), 1];
  }
}

async function leerTodo() {
  for (const [nombre, almacen] of almacenes) {
    const estado = await almacen.leer();
    instantanea.set(nombre, { estado, entradas: almacen.partir(estado) });
  }
}

const hayPendientes = () => Object.values(meta.almacenes).some((m) => Object.values(m).some((x) => x[2]));

async function pendientes() {
  await leerTodo();
  marcarCambios();
  const cambios: Fila[] = [];
  const mandadas: [string, string, string][] = [];
  for (const [a, marcas] of Object.entries(meta.almacenes)) {
    for (const [k, m] of Object.entries(marcas)) {
      if (!m[2] || cambios.length >= LOTE) continue;
      const v = m[0] === '' ? null : (instantanea.get(a)?.entradas[k] ?? null);
      cambios.push({ a, k, v, t: m[1] });
      mandadas.push([a, k, m[0]]);
    }
  }
  return { cambios, mandadas };
}

/** Pone en cada almacén lo que llegó de la cuenta. Devuelve cuántas entradas nuevas trajo. */
async function aplicar(filas: Fila[]) {
  let traidas = 0;
  const porAlmacen = new Map<string, Fila[]>();
  for (const f of filas) if (almacenes.has(f.a)) porAlmacen.set(f.a, [...(porAlmacen.get(f.a) ?? []), f]);
  for (const [nombre, lista] of porAlmacen) {
    const almacen = almacenes.get(nombre)!;
    const antes = await almacen.leer();
    const entradas = { ...almacen.partir(antes) };
    const marcas = (meta.almacenes[nombre] ??= {});
    let cambiado = false;
    for (const f of lista) {
      const m = marcas[f.k];
      // Un cambio local más nuevo que aún no llegó a la cuenta gana: se mandará en la próxima vuelta.
      if (m?.[2] && m[1] > f.t) continue;
      const h = f.v === null ? '' : huella(f.v);
      marcas[f.k] = [h, f.t, 0];
      const actual = f.k in entradas ? huella(entradas[f.k]) : '';
      if (actual === h) continue;
      if (f.v === null) delete entradas[f.k];
      else {
        if (!(f.k in entradas)) traidas++;
        entradas[f.k] = f.v;
      }
      cambiado = true;
    }
    if (cambiado) almacen.escribir(almacen.unir(entradas, antes));
  }
  return traidas;
}

/** Al terminar la primera sincronía del dispositivo con la cuenta, con cuántas entradas trajo de ella. */
export function alUnirseALaCuenta(l: (traidas: number) => void) {
  alUnirse.add(l);
  return () => {
    alUnirse.delete(l);
  };
}

export function useSincronia() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    escuchas.add(l);
    cargarMeta().then(l);
    return () => {
      escuchas.delete(l);
    };
  }, []);
  return { estado, error, ultima: meta.ultima };
}
