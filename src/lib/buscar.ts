// Cliente de /api/buscar: búsqueda de pasajes por idea, comprobada contra el texto de la RV1909.

const API = process.env.EXPO_PUBLIC_API_URL ?? '';

export type IdeaResult = { ref: string; label: string; text: string; reason: string };

export async function searchByIdea(query: string, signal?: AbortSignal): Promise<{ results: IdeaResult[]; note?: string }> {
  const res = await fetch(`${API}/api/buscar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `No se pudo hacer la búsqueda (${res.status})`);
  return body;
}
