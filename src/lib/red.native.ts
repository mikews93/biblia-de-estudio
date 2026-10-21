import { NetworkState, addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

// Si el teléfono tiene internet, según expo-network. Mientras no se sabe (isInternetReachable aún sin
// valor), se supone que sí: lo que falle por red avisa igual.

const up = (s: NetworkState) => s.isConnected !== false && s.isInternetReachable !== false;

let online = true;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l());
}

getNetworkStateAsync()
  .then((s) => set(up(s)))
  .catch(() => {});
addNetworkStateListener((s) => set(up(s)));

export const nativeOnline = () => online;

export function onNativeChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
