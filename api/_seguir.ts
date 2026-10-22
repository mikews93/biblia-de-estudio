// Vercel deja terminar trabajo después de la respuesta con waitUntil (lo mismo que hace @vercel/functions).
export function waitUntil(promise: Promise<unknown>) {
  const ctx = (
    globalThis as Record<
      symbol,
      { get?: () => { waitUntil?: (p: Promise<unknown>) => void } }
    >
  )[Symbol.for("@vercel/request-context")]?.get?.();
  if (ctx?.waitUntil) ctx.waitUntil(promise);
}
