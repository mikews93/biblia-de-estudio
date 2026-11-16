// Cabeceras de las respuestas que llegan por partes (la IA escribiendo, la traducción de un comentario).
// no-transform pide a la CDN y a cualquier proxy que no comprima ni cambie el cuerpo: comprimir junta los trozos
// pequeños hasta llenar un bloque y la respuesta deja de verse mientras se escribe. X-Accel-Buffering: no es la
// señal habitual para que un proxy no la retenga.
export const SIN_BUFFER = { 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } as const;
