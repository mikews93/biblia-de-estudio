import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';

import { resumenProgreso } from './progress';
import { RecuerdoResena, tocaPedirResena } from './resenaTexto';
import { desdeCuando } from './sembrar';
import { todayKey } from './temporadas';
import { getSettings } from './theme';

// Pedir una reseña en Google Play con la ventana propia de Google (src/lib/resenaTexto.ts dice cuándo).
// expo-store-review es un módulo nativo: llega con la próxima compilación de la tienda, no con EAS Update.

const KEY = 'resena';
const PAQUETE = 'com.migueblanco.zarza';
/** La ficha de Zarza en Google Play. */
export const ENLACE_PLAY = `https://play.google.com/store/apps/details?id=${PAQUETE}`;

/** Lo que tarda en aparecer la ventana después de tocar «Terminé este capítulo», para que se vea primero la semana. */
const PAUSA_MS = 1800;

let pidiendo = false;

async function leer(): Promise<RecuerdoResena> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecuerdoResena) : {};
  } catch {
    return {};
  }
}

/** Al terminar un capítulo: si toca, abre la ventana de reseña de Google Play. Devuelve si la abrió. */
export async function pedirResenaSiToca(): Promise<boolean> {
  if (pidiendo || Platform.OS === 'web') return false;
  pidiendo = true;
  try {
    const [recuerdo, desde, progreso] = await Promise.all([leer(), desdeCuando(), resumenProgreso()]);
    const s = getSettings();
    const hoy = todayKey();
    const toca = tocaPedirResena({
      ...recuerdo,
      hoy,
      desde,
      plataforma: Platform.OS === 'android' ? 'android' : 'ios',
      modo: s.modo,
      tranquila: s.tranquila,
      ...progreso,
    });
    if (!toca || !(await StoreReview.isAvailableAsync().catch(() => false))) return false;
    // Se anota antes de abrirla: Google no avisa si la persona la cerró o la escribió, y no se vuelve a pedir pronto.
    await AsyncStorage.setItem(KEY, JSON.stringify({ pedidas: [...(recuerdo.pedidas ?? []), hoy] })).catch(() => {});
    await new Promise((r) => setTimeout(r, PAUSA_MS));
    await StoreReview.requestReview().catch(() => {});
    return true;
  } finally {
    pidiendo = false;
  }
}

/**
 * Abrir la ficha de Zarza en Google Play para escribir una reseña cuando la persona lo elige (en Acerca de Zarza).
 * En Android abre la app de la tienda; si no está, o en la web, la página de Play.
 */
export async function abrirFichaPlay() {
  if (Platform.OS === 'android') {
    const tienda = `market://details?id=${PAQUETE}&showAllReviews=true`;
    if (await Linking.openURL(tienda).then(() => true, () => false)) return;
  }
  Linking.openURL(ENLACE_PLAY).catch(() => {});
}
