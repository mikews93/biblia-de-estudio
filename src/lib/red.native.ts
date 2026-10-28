import { AppState } from 'react-native';
import { NetworkState, addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

// Si el teléfono tiene internet. Sin red (isConnected false) no hay duda. Pero Android a veces dice que la red no
// llega a internet (isInternetReachable false) cuando sí llega: al volver de segundo plano, con DNS privado o VPN.
// Como sin conexión la app no llama al servidor (requireConnection), ese falso «sin internet» se quedaba pegado
// hasta cerrar la app. Por eso, antes de creerlo, se pregunta al servidor, y mientras dure se vuelve a revisar
// cada pocos segundos y cada vez que la app vuelve a estar a la vista.

const API = process.env.EXPO_PUBLIC_API_URL ?? '';
const REVISAR_MS = 10_000;

let online = true;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next !== online) {
    online = next;
    listeners.forEach((l) => l());
  }
  if (!online && !timer) timer = setInterval(revisar, REVISAR_MS);
  if (online && timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Si el servidor contesta en pocos segundos, hay internet aunque Android diga lo contrario. */
async function servidorResponde() {
  if (!API) return false;
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${API}/version.json`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(corte);
  }
}

async function evaluar(s: NetworkState) {
  if (s.isConnected === false) return set(false);
  if (s.isInternetReachable !== false) return set(true);
  set(await servidorResponde());
}

function revisar() {
  getNetworkStateAsync()
    .then(evaluar)
    .catch(() => {});
}

revisar();
addNetworkStateListener((s) => void evaluar(s));
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') revisar();
});

export const nativeOnline = () => online;

export function onNativeChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
