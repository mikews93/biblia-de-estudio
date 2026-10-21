// FUMS (Fair Use Management System) de API.Bible: cada capítulo con derechos que se muestra se informa con su
// ficha, como pide la licencia. Sin datos personales: un id fijo y aleatorio del dispositivo y otro de la sesión.
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

/** Informa a FUMS de que se mostró el texto de una ficha. Nunca falla: si no hay red, no se cuenta. */
export async function reportView(token: string | null | undefined) {
  if (!token) return;
  const params = new URLSearchParams({ t: token, dId: await deviceId(), sId: session });
  fetch(`https://fums.api.bible/f3?${params}`, { mode: 'no-cors' }).catch(() => {});
}
