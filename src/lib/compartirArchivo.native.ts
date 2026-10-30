import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** En el teléfono: el documento se guarda en un archivo y se abre el menú de compartir (Drive, correo, Archivos…). */
export async function compartirDocumento(html: string, nombre: string, titulo: string) {
  const archivo = new File(Paths.cache, `${nombre}.doc`);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(html);
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/msword', dialogTitle: titulo, UTI: 'com.microsoft.word.doc' });
}
