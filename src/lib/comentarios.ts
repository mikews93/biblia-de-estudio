// Cliente de /api/comentario: comentarios bíblicos traducidos al español (ver comentarioFuentes.ts).

export { FUENTES } from './comentarioFuentes';
export type { Fuente } from './comentarioFuentes';

// En web la función vive en el mismo dominio; en el teléfono, en la web publicada.
const API = process.env.EXPO_PUBLIC_API_URL ?? '';

/** traducido: con IA · revisado: con IA y revisado por otra pasada de IA · humano: revisado por una persona */
export type Estado = 'traducido' | 'revisado' | 'humano' | 'original';
export type Parte = { parte: number; texto: string; estado: Estado };
export type Seccion = { desde: number; hasta: number; partes: number; traducidas: Parte[] };
export type Comentario = { secciones: { desde: number; hasta: number; partes: number }[]; seccion: Seccion | null };

type Event = { type: 'text'; text: string } | { type: 'done'; estado: Estado } | { type: 'error'; message: string };

async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? fallback);
}

/** La sección del comentario que trata el versículo (0: introducción del capítulo), con lo ya traducido. */
export async function getComentario(fuente: string, book: string, chapter: number, verse: number) {
  const q = new URLSearchParams({ fuente, libro: book, capitulo: String(chapter), versiculo: String(verse) });
  // Sin conexión el service worker responde con los comentarios ya abiertos; los demás no se pueden traer.
  const res = await fetch(`${API}/api/comentario?${q}`).catch(() => {
    throw new Error('Sin conexión. Los comentarios que ya abriste se pueden leer sin internet; este todavía no.');
  });
  if (!res.ok) await fail(res, `No se pudo cargar el comentario (${res.status})`);
  return (await res.json()) as Comentario;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Traduce una parte (o la trae si ya está traducida) y llama a onUpdate con el texto que va llegando. */
export async function traducirParte(
  key: { fuente: string; libro: string; capitulo: number; desde: number; parte: number },
  onUpdate: (text: string) => void,
  signal?: AbortSignal,
): Promise<Parte> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/api/comentario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(key),
      signal,
    });
    // Otra persona la está traduciendo en este momento: se espera y se vuelve a pedir.
    if (res.status === 409 && attempt < 40) {
      await wait(4000);
      continue;
    }
    if (!res.ok) await fail(res, `No se pudo traducir el comentario (${res.status})`);

    let text = '';
    let estado: Estado = 'traducido';
    let failure: string | null = null;
    const handle = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line) as Event;
      if (event.type === 'text') text += event.text;
      else if (event.type === 'done') estado = event.estado;
      else if (event.type === 'error') failure = event.message;
    };
    const reader = res.body?.getReader?.();
    if (reader) {
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(handle);
        onUpdate(text);
      }
      handle(buffer);
    } else {
      // Sin lectura por partes (algunas versiones de React Native): se muestra al terminar.
      (await res.text()).split('\n').forEach(handle);
    }
    if (failure) throw new Error(failure);
    onUpdate(text);
    return { parte: key.parte, texto: text, estado };
  }
}

export async function reportarError(
  key: { fuente: string; libro: string; capitulo: number; desde: number; parte: number },
  nota: string,
) {
  const res = await fetch(`${API}/api/comentario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reporte: { ...key, nota } }),
  });
  if (!res.ok) await fail(res, 'No se pudo enviar el aviso');
}
