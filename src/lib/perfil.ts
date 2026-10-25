// Cliente del perfil: nombre y unas líneas sobre la persona y la foto. Entrar con Google, Apple o Facebook está en
// src/lib/proveedores.ts.
// Usa la misma cuenta y la misma función que la comunidad (src/lib/comunidad.ts).

import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { api, updateUser, Usuario } from './comunidad';

export const MAX_BIO = 160;
export const MAX_PLACE = 60;
// La foto se guarda cuadrada y pequeña: se ve nítida en el perfil y pesa unos 50 KB.
const PHOTO_SIZE = 480;

export type Perfil = { nombre: string; bio: string; iglesia: string; ciudad: string };

export async function saveProfile(p: Perfil) {
  updateUser((await api<{ usuario: Usuario }>('guardarPerfil', p)).usuario);
}

/**
 * Abre la galería, recorta la foto al centro en un cuadrado, la achica y la sube.
 * Devuelve false si la persona no eligió ninguna.
 */
export async function pickPhoto() {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: Platform.OS !== 'web',
    aspect: [1, 1],
    quality: 1,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return false;
  const ctx = ImageManipulator.manipulate(asset.uri);
  const rendered = await ctx.renderAsync();
  const side = Math.min(rendered.width, rendered.height);
  const square = ImageManipulator.manipulate(asset.uri)
    .crop({ originX: (rendered.width - side) / 2, originY: (rendered.height - side) / 2, width: side, height: side })
    .resize({ width: Math.min(PHOTO_SIZE, side), height: Math.min(PHOTO_SIZE, side) });
  const saved = await (await square.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!saved.base64) throw new Error('No se pudo leer la foto');
  updateUser((await api<{ usuario: Usuario }>('subirFoto', { imagen: saved.base64 })).usuario);
  return true;
}

export async function removePhoto() {
  updateUser((await api<{ usuario: Usuario }>('quitarFoto')).usuario);
}
