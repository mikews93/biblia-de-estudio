// En la web el documento se descarga (src/app/exportar.tsx); compartir un archivo es solo del teléfono
// (compartirArchivo.native.ts).
export async function compartirDocumento(_html: string, _nombre: string, _titulo: string): Promise<void> {
  throw new Error('Solo en el teléfono');
}
