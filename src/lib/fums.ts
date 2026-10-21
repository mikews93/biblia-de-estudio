// FUMS (Fair Use Management System) de API.Bible: cada capítulo con derechos que se muestra se informa con su
// ficha, como pide la licencia (también los que se leen sin conexión, al volver la red). Sin datos personales: un id fijo y aleatorio del dispositivo y otro de la sesión.
// https://docs.api.bible/guides/fair-use

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_KEY = 'fums-dispositivo';
const random = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const session = random();
let device: Promise<string> | null = null;

function deviceId(): Promise<string> {
  device ??= AsyncStorage.getItem(DEVICE_KEY)
    .then(async (saved) => {
      if (saved) return saved;
      const id = random();
      await AsyncStorage.setItem(DEVICE_KEY, id);
      return id;
    })
    .catch(() => session);
  return device;
}

// Lecturas sin conexión (capítulos guardados): se informan cuando vuelve la red.
const PENDING_KEY = 'fums-pendientes';

async function send(token: string) {
  const params = new URLSearchParams({ t: token, dId: await deviceId(), sId: session });
  await fetch(`https://fums.api.bible/f3?${params}`, { mode: 'no-cors' });
}

async function pending(change?: (list: string[]) => string[]): Promise<string[]> {
  const list: string[] = JSON.parse((await AsyncStorage.getItem(PENDING_KEY).catch(() => null)) ?? '[]');
  if (!change) return list;
  const next = change(list).slice(-200);
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

/** Informa a FUMS de que se mostró el texto de una ficha. Nunca falla: sin red, queda pendiente para después. */
export async function reportView(token: string | null | undefined) {
  if (!token) return;
  try {
    await send(token);
  } catch {
    await pending((list) => [...list, token]).catch(() => {});
    return;
  }
  const queued = await pending().catch(() => []);
  if (!queued.length) return;
  await pending(() => []);
  for (const t of queued) await send(t).catch(() => pending((list) => [...list, t]));
}
